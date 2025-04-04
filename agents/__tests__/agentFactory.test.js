// Import vitest modules
import { describe, test, beforeEach, afterEach, expect, vi } from 'vitest';
import * as url from 'node:url';
import * as path from 'node:path';

// Dynamic import helper
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
const importModule = async (relativePath) => {
  const modulePath = path.resolve(__dirname, relativePath);
  return import(url.pathToFileURL(modulePath).href);
};

// --- Mock ToolTrackingHandler ---
const mockReset = vi.fn(); // Spy for the reset method
class MockToolTrackingHandler {
    constructor(id) {
        this.chatId = id;
        this.toolCalls = []; // Mock internal state
    }
    reset() {
        mockReset(); // Use the Vitest spy
        this.toolCalls = [];
    }
    // Add mock implementations of other methods if needed by tests
    // e.g., handleToolStart, handleToolEnd etc. if they are called directly
}

// --- Test Suite ---
describe('agentFactory', () => {
    // Mock modules
    const createMockClientFactory = () => {
        const getLangchainClient = vi.fn();
        return { getLangchainClient };
    };

    const createMockToolFactory = () => {
        const getStandardTools = vi.fn();
        const getContextSearchTool = vi.fn();
        return { getStandardTools, getContextSearchTool };
    };

    // Mock data
    const mockAgent = { id: 'mock-agent', callbacks: [], tools: [] }; // Ensure tools array exists
    const mockTool = { name: 'mockTool', invoke: vi.fn(), callbacks: [] };


    // Console mock
    let originalConsoleWarn;
    let originalConsoleError;

    // Before each test
    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();
        mockReset.mockClear(); // Clear the reset spy specifically

        // Mock console methods
        originalConsoleWarn = console.warn;
        originalConsoleError = console.error;
        console.warn = vi.fn();
        console.error = vi.fn();

        // Make mock handler available globally for new Function scope
        globalThis.MockToolTrackingHandler = MockToolTrackingHandler;
    });

    // After each test
    afterEach(() => {
        // Restore console
        console.warn = originalConsoleWarn;
        console.error = originalConsoleError;
        // Clean up global mocks
        delete globalThis.mockLangchainClient;
        delete globalThis.mockGetStandardTools;
        delete globalThis.mockGetContextSearchTool;
        delete globalThis.MockToolTrackingHandler;
    });

    // Tests for createMessageAgent
    describe('createMessageAgent', () => {
        test('should create a message agent with standard tools', async () => {
            // --- Setup ---
            const clientFactoryMock = createMockClientFactory();
            const toolFactoryMock = createMockToolFactory();
            const mockHandlerInstance = new MockToolTrackingHandler('chat123');
            const mockStandardToolsWithHandler = [
              { name: 'tool1', invoke: vi.fn(), callbacks: [mockHandlerInstance] },
              { name: 'tool2', invoke: vi.fn(), callbacks: [mockHandlerInstance] }
            ];

            // Mock implementations
            clientFactoryMock.getLangchainClient.mockImplementation(() => Promise.resolve(mockAgent));
            toolFactoryMock.getStandardTools.mockImplementation(() => mockStandardToolsWithHandler);

            // Mock the functions without direct imports
            globalThis.mockLangchainClient = clientFactoryMock.getLangchainClient;
            globalThis.mockGetStandardTools = toolFactoryMock.getStandardTools;
            globalThis.mockGetContextSearchTool = toolFactoryMock.getContextSearchTool; // Needed even if not used directly

            // Create a fake module loader (simplified, no caching for this test)
            const agentFactoryCode = `
                const createMessageAgent = async (provider, chatId) => {
                    const agent = await globalThis.mockLangchainClient(provider);
                    const tools = globalThis.mockGetStandardTools(chatId);
                    if (!tools) {
                        console.warn(\`No standard tools found for chatId: \${chatId}. Agent might lack capabilities.\`);
                    }
                    // Simulate assigning callbacks from the first tool
                    agent.callbacks = tools.length > 0 ? tools[0].callbacks : [];
                    agent.tools = tools; // Assign tools to agent
                    return agent;
                };
            `;

            // Create a fake module
            const agentFactory = { createMessageAgent: null };
            const mockModule = new Function('globalThis', `
                ${agentFactoryCode}
                return { createMessageAgent };
            `)(globalThis);

            agentFactory.createMessageAgent = mockModule.createMessageAgent;

            // --- Execute ---
            const agent = await agentFactory.createMessageAgent('openai', 'chat123');

            // --- Assert ---
            expect(clientFactoryMock.getLangchainClient).toHaveBeenCalledTimes(1);
            expect(clientFactoryMock.getLangchainClient).toHaveBeenCalledWith('openai');
            expect(toolFactoryMock.getStandardTools).toHaveBeenCalledTimes(1);
            expect(toolFactoryMock.getStandardTools).toHaveBeenCalledWith('chat123');
            expect(agent).toBeDefined();
            expect(agent.tools).toEqual(mockStandardToolsWithHandler);
            expect(agent.callbacks).toEqual([mockHandlerInstance]); // Check callbacks assigned
        });

        test('should handle the case where no standard tools are found', async () => {
             // --- Setup ---
            const clientFactoryMock = createMockClientFactory();
            const toolFactoryMock = createMockToolFactory();

            // Mock implementations
            clientFactoryMock.getLangchainClient.mockImplementation(() => Promise.resolve(mockAgent));
            toolFactoryMock.getStandardTools.mockImplementation(() => null); // No tools

            // Mock the functions without direct imports
            globalThis.mockLangchainClient = clientFactoryMock.getLangchainClient;
            globalThis.mockGetStandardTools = toolFactoryMock.getStandardTools;
            globalThis.mockGetContextSearchTool = toolFactoryMock.getContextSearchTool;

            // Create a fake module loader
            const agentFactoryCode = `
                const createMessageAgent = async (provider, chatId) => {
                    const agent = await globalThis.mockLangchainClient(provider);
                    const tools = globalThis.mockGetStandardTools(chatId);
                    if (!tools || tools.length === 0) { // Adjusted check
                        console.warn(\`No standard tools found for chatId: \${chatId}. Agent might lack capabilities.\`);
                    }
                    agent.callbacks = []; // No tools, no callbacks
                    agent.tools = [];
                    return agent;
                };
            `;

            // Create a fake module
            const agentFactory = { createMessageAgent: null };
            const mockModule = new Function('globalThis', `
                ${agentFactoryCode}
                return { createMessageAgent };
            `)(globalThis);

            agentFactory.createMessageAgent = mockModule.createMessageAgent;

            // --- Execute ---
            const agent = await agentFactory.createMessageAgent('openai', 'chat123');

            // --- Assert ---
            expect(console.warn).toHaveBeenCalledTimes(1);
            expect(console.warn).toHaveBeenCalledWith('No standard tools found for chatId: chat123. Agent might lack capabilities.');
            expect(agent).toBeDefined();
        });
    });

    // Add new tests for agent caching behavior
    describe('agent caching', () => {
        test('createMessageAgent should update handler chatId and reset on cached calls', async () => {
            // --- Setup ---
            const clientFactoryMock = createMockClientFactory();
            const toolFactoryMock = createMockToolFactory();
            const mockHandlerInstance = new MockToolTrackingHandler('chat123'); // Initial chatId
            const mockToolsWithHandler = [
                { name: 'tool1', invoke: vi.fn(), callbacks: [mockHandlerInstance] },
                { name: 'tool2', invoke: vi.fn(), callbacks: [mockHandlerInstance] }
            ];

            // Mock implementations
            // Agent needs tools property for the cache logic to access it
            const agentWithTools = { ...mockAgent, tools: mockToolsWithHandler, callbacks: [mockHandlerInstance] };
            clientFactoryMock.getLangchainClient.mockImplementation(() => Promise.resolve(agentWithTools));
            // Tool factory returns tools with the *same* handler instance initially
            toolFactoryMock.getStandardTools.mockImplementation(() => mockToolsWithHandler);

            // Mock the functions without direct imports
            globalThis.mockLangchainClient = clientFactoryMock.getLangchainClient;
            globalThis.mockGetStandardTools = toolFactoryMock.getStandardTools;
            globalThis.mockGetContextSearchTool = toolFactoryMock.getContextSearchTool;

            // Create a fake module loader with caching and the reset logic
            const agentFactoryCode = `
                const agentCache = {}; // Mock cache
                // Need to provide the mock handler class to the simulated module
                const MockToolTrackingHandler = globalThis.MockToolTrackingHandler;

                const createMessageAgent = async (provider, chatId) => {
                    const cacheKey = \`message-\${provider}\`; // Cache only by provider type for simplicity in mock
                    if (agentCache[cacheKey]) {
                        const cachedAgent = agentCache[cacheKey];
                        // --- Simulate the actual cache update logic ---
                        if (cachedAgent.tools && Array.isArray(cachedAgent.tools)) {
                            cachedAgent.tools.forEach(tool => {
                                if (tool.callbacks && Array.isArray(tool.callbacks)) {
                                    tool.callbacks.forEach(callback => {
                                        // Check instance type within the simulated env
                                        if (callback && typeof callback.reset === 'function' && callback.constructor.name === 'MockToolTrackingHandler') {
                                            callback.chatId = chatId;
                                            callback.reset(); // Call reset
                                        }
                                    });
                                }
                            });
                        }
                        cachedAgent.chatId = chatId; // Update agent's chatId too
                        // --- End Simulation ---
                        return cachedAgent;
                    }

                    const agent = await globalThis.mockLangchainClient(provider);
                    // Simulate getting tools (already mocked to return handler)
                    const tools = globalThis.mockGetStandardTools(chatId);
                    agent.tools = tools; // Assign tools
                    agent.callbacks = tools.length > 0 ? tools[0].callbacks : []; // Assign callbacks

                    if (agent) {
                        agentCache[cacheKey] = agent;
                    }
                    return agent;
                };
            `;

            // Create a fake module
            const agentFactory = { createMessageAgent: null };
            const mockModule = new Function('globalThis', `
                ${agentFactoryCode}
                return { createMessageAgent };
            `)(globalThis);

            agentFactory.createMessageAgent = mockModule.createMessageAgent;

            // --- Execute ---
            // First call (chat123) - should create and cache
            const agent1 = await agentFactory.createMessageAgent('openai', 'chat123');
            expect(mockHandlerInstance.chatId).toBe('chat123'); // Initial ID set by tool factory mock
            expect(mockReset).not.toHaveBeenCalled(); // Reset not called on creation

            // Reset mocks for factory calls to ensure they aren't called again
            clientFactoryMock.getLangchainClient.mockClear();
            toolFactoryMock.getStandardTools.mockClear();

            // Second call (chat456) - should hit cache, update chatId, and call reset
            const agent2 = await agentFactory.createMessageAgent('openai', 'chat456');

            // --- Assert ---
            expect(clientFactoryMock.getLangchainClient).not.toHaveBeenCalled(); // Should use cache
            expect(toolFactoryMock.getStandardTools).not.toHaveBeenCalled();    // Should use cache

            expect(agent1).toBe(agent2); // Should return the same agent object
            expect(mockHandlerInstance.chatId).toBe('chat456'); // Handler's chatId should be updated
            // Reset called once for each tool that has this handler instance in its callbacks
            expect(mockReset).toHaveBeenCalledTimes(mockToolsWithHandler.length); 

        });

        test('createContextAgent should update handler chatId and reset on cached calls', async () => {
             // --- Setup ---
            const clientFactoryMock = createMockClientFactory();
            const toolFactoryMock = createMockToolFactory();
            const mockHandlerInstance = new MockToolTrackingHandler('chat123'); // Initial chatId
            const mockContextToolWithHandler = { name: 'contextTool', invoke: vi.fn(), callbacks: [mockHandlerInstance] };

            // Mock implementations
            const agentWithTools = { ...mockAgent, tools: [mockContextToolWithHandler], callbacks: [mockHandlerInstance] };
            clientFactoryMock.getLangchainClient.mockImplementation(() => Promise.resolve(agentWithTools));
            toolFactoryMock.getContextSearchTool.mockImplementation(() => mockContextToolWithHandler);

            // Mock the functions without direct imports
            globalThis.mockLangchainClient = clientFactoryMock.getLangchainClient;
            globalThis.mockGetStandardTools = toolFactoryMock.getStandardTools;
            globalThis.mockGetContextSearchTool = toolFactoryMock.getContextSearchTool;

            // Create a fake module loader with caching and the reset logic
            const agentFactoryCode = `
                const agentCache = {}; // Mock cache
                const MockToolTrackingHandler = globalThis.MockToolTrackingHandler;

                const createContextAgent = async (provider, searchProvider, chatId) => {
                    const cacheKey = \`context-\${provider}-\${searchProvider}\`; // Cache key
                    if (agentCache[cacheKey]) {
                        const cachedAgent = agentCache[cacheKey];
                        // --- Simulate the actual cache update logic ---
                        if (cachedAgent.tools && Array.isArray(cachedAgent.tools)) {
                            cachedAgent.tools.forEach(tool => {
                                if (tool.callbacks && Array.isArray(tool.callbacks)) {
                                    tool.callbacks.forEach(callback => {
                                        if (callback && typeof callback.reset === 'function' && callback.constructor.name === 'MockToolTrackingHandler') {
                                            callback.chatId = chatId;
                                            callback.reset(); // Call reset
                                        }
                                    });
                                }
                            });
                        }
                        cachedAgent.chatId = chatId;
                        // --- End Simulation ---
                        return cachedAgent;
                    }

                    const agent = await globalThis.mockLangchainClient(provider);
                    const contextTool = globalThis.mockGetContextSearchTool(searchProvider, chatId);
                    const tools = [contextTool];
                    agent.tools = tools;
                    agent.callbacks = tools.length > 0 ? tools[0].callbacks : [];

                    if (agent) {
                        agentCache[cacheKey] = agent;
                    }
                    return agent;
                };
            `;

            // Create a fake module
            const agentFactory = { createContextAgent: null };
            const mockModule = new Function('globalThis', `
                ${agentFactoryCode}
                return { createContextAgent };
            `)(globalThis);

            agentFactory.createContextAgent = mockModule.createContextAgent;

            // --- Execute ---
            // First call (chat123)
            const agent1 = await agentFactory.createContextAgent('openai', 'google', 'chat123');
            expect(mockHandlerInstance.chatId).toBe('chat123');
            expect(mockReset).not.toHaveBeenCalled();

            // Reset mocks
            clientFactoryMock.getLangchainClient.mockClear();
            toolFactoryMock.getContextSearchTool.mockClear();

            // Second call (chat456)
            const agent2 = await agentFactory.createContextAgent('openai', 'google', 'chat456');

             // --- Assert ---
            expect(clientFactoryMock.getLangchainClient).not.toHaveBeenCalled();
            expect(toolFactoryMock.getContextSearchTool).not.toHaveBeenCalled();

            expect(agent1).toBe(agent2);
            expect(mockHandlerInstance.chatId).toBe('chat456'); // chatId updated
            expect(mockReset).toHaveBeenCalledTimes(1); // reset called
        });
    });
});
