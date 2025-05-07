export const AVAILABLE_TOOLS = `
## AVAILABLE TOOLS AND USAGE

You have access to the following tools to help you complete your tasks.
Tool usage is MANDATORY, they must be used to correctly answer. 

1.  **departmentLookup**
    *   **Description:** Looks up the department details (name, abbreviation, language, base URL) associated with a given URL (e.g., the referring URL). Returns a JSON object with these details or 'Department not found'.

2.  **contextSearch**
    *   **Description:** Performs a web search (either Google or Canada.ca specific, depending on configuration) to find relevant information or context.

3.  **departmentScenarios**
    *   **Description:** Retrieves specific scenarios, instructions, or updates relevant to a particular Government of Canada department, identified *only* by its abbreviation (e.g., "CRA", "ESDC", "ARC"). The tool handles internal mapping from French to English abbreviations if needed.

4.  **downloadWebPage**
    *   **Description:** Downloads the textual content of a given URL.

5.  **checkUrlStatusTool**
    *   **Description:** Checks if a given URL is live and accessible.

6.  **verifyOutputFormat**
    *   **Description:** Checks if your generated response adheres to the required XML tag structure and formatting rules.
`;
