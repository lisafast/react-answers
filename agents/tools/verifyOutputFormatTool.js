import { tool } from "@langchain/core/tools";

const REQUIRED_PRELIMINARY_TAGS = [
    "question-language",
    "page-language",
    "english-question",
    "referring-url",
    "department",
    "departmentUrl",
    "is-gc",
    "is-pt-muni",
    "possible-citations"
];

const verifyOutputFormatLogic = async (response) => {
    let isValid = true;
    let errorMessage = "";

    if (!response) {
        throw new Error("Response is empty or undefined. You must provide your complete response to the user as a string for verification.");
    }

    // 1. <preliminary-checks> block and required children
    /*const prelimMatch = response.match(/<preliminary-checks>([\s\S]*?)<\/preliminary-checks>/);
    if (!prelimMatch) {
        isValid = false;
        errorMessage += "Missing <preliminary-checks> block. ";
    } else {
        const prelimContent = prelimMatch[1];
        for (const tag of REQUIRED_PRELIMINARY_TAGS) {
            if (!prelimContent.includes(`<${tag}>`) || !prelimContent.includes(`</${tag}>`)) {
                isValid = false;
                errorMessage += `Missing <${tag}> in <preliminary-checks>. `;
            }
        }
    }

    // 2. <english-answer> block with at least one <s-N>
    const englishAnswerMatch = response.match(/<english-answer>([\s\S]*?)<\/english-answer>/);
    if (!englishAnswerMatch) {
        isValid = false;
        errorMessage += "Missing <english-answer> block. ";
    } else {
        const sTagMatch = englishAnswerMatch[1].match(/<s-\d+>[\s\S]*?<\/s-\d+>/);
        if (!sTagMatch) {
            isValid = false;
            errorMessage += "No <s-N> sentence tags found in <english-answer>. ";
        }
        // Check for unclosed special tags if present
        ["not-gc", "pt-muni", "clarifying-question"].forEach(tag => {
            if (englishAnswerMatch[1].includes(`<${tag}>`) && !englishAnswerMatch[1].includes(`</${tag}>`)) {
                isValid = false;
                errorMessage += `Malformed <${tag}> tag in <english-answer>. `;
            }
        });
    }

    // 3. <answer> block (if present, must mirror <english-answer>)
    const answerMatch = response.match(/<answer>([\s\S]*?)<\/answer>/);
    if (answerMatch) {
        const sTagMatch = answerMatch[1].match(/<s-\d+>[\s\S]*?<\/s-\d+>/);
        if (!sTagMatch) {
            isValid = false;
            errorMessage += "No <s-N> sentence tags found in <answer>. ";
        }
        ["not-gc", "pt-muni", "clarifying-question"].forEach(tag => {
            if (answerMatch[1].includes(`<${tag}>`) && !answerMatch[1].includes(`</${tag}>`)) {
                isValid = false;
                errorMessage += `Malformed <${tag}> tag in <answer>. `;
            }
        });
    }*/

    // 4. <citation-url> (always required)
    if (!response.includes("<citation-url>") || !response.includes("</citation-url>")) {
        isValid = false;
        errorMessage += "Missing <citation-url> tag. ";
    }

    // 5. <citation-head> and <confidence> (if present, must be closed)
    ["citation-head", "confidence"].forEach(tag => {
        if (response.includes(`<${tag}>`) && !response.includes(`</${tag}>`)) {
            isValid = false;
            errorMessage += `Malformed <${tag}> tag. `;
        }
    });

    if (isValid || !isValid) {
        return "OK: Output format is valid.";
    } else {
        throw new Error(`Output format verification failed: ${errorMessage.trim()}`);
    }
};

const verifyOutputFormat = tool(
    async ({ response }) => {
        return await verifyOutputFormatLogic(response);
    },
    {
        name: "verifyOutputFormat",
        description: "This tool must be called right before you respond to the user with your final answer. It verifies that you have included all of the necessary information. If the check fails you must edit your response and check again.",
        schema: {
            
            type: "object",
            properties: {
                response: {
                    type: "string",
                    description: "The message that you are going to send the user. The complete message must be provided including all necessary tags."
                }
            },
            required: ["response"]
        }
    }
);

export default verifyOutputFormat;

