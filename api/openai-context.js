import { createContextAgent } from '../agents/AgentService.js';


const invokeAgent = async (agentType, systemPrompt, message, searchResults, searchProvider) => {
  try {
    const contextAgent = await createContextAgent(agentType);

    const messages = [
      {
        role: "system",
        content: `${systemPrompt}<searchResults>${searchResults.results}</searchResults>`,
      },
      {
        role: "user",
        content: message,
      },
    ];



    const answer = await contextAgent.invoke({
      messages: messages,
    });

    if (Array.isArray(answer.messages) && answer.messages.length > 0) {
      const lastResult = answer.messages[answer.messages.length - 1];
      const lastMessage = lastResult.content;
      console.log('ContextAgent Response:', {
        content: lastMessage,
        role: answer.messages[answer.messages.length - 1]?.response_metadata.role,
        usage: answer.messages[answer.messages.length - 1]?.response_metadata.usage,
      });
      return {
        message: lastMessage,
        inputTokens: lastResult.response_metadata.tokenUsage.promptTokens,
        outputTokens: lastResult.response_metadata.tokenUsage.completionTokens,
        model: lastResult.response_metadata.model_name,
        searchProvider: searchProvider,
        searchResults: searchResults

      }
    } else {
      return "No messages available";
    }
  } catch (error) {
    console.error(`Error with ${agentType} agent:`, error);
    throw error;
  }
};

export default async function handler(req, res) {
  if (req.method === 'POST') {
    console.log('Request body:', req.body);
    const { message, systemPrompt, aiProvider, searchResults, searchProvider } = req.body;
    const agentType = aiProvider;
    // TODO fix this
    const agentTypes = ['openai', 'openai'];

    // If agentType is provided in the request, use it as the first agent to try
    const agentsToTry = agentType ? [agentType, ...agentTypes.filter(agent => agent !== agentType)] : agentTypes;

    try {
      for (const agentType of agentsToTry) {
        try {
          const result = await invokeAgent(agentType, systemPrompt, message, searchResults, searchProvider);
          res.json(result);
          return;
        } catch (error) {
          console.error(`Error with ${agentType} agent:`, error);
          // Continue to the next agent type
        }
      }

      // If all agents fail
      res.status(500).json({ error: 'All agents failed to process the request' });

    } catch (error) {
      console.error('Error processing request:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}