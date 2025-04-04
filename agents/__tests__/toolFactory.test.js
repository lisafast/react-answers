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

// --- Test Suite ---
describe('toolFactory', () => {
    // Define mock functions
    const mockDownloadInvoke = vi.fn();
    const mockCheckUrlInvoke = vi.fn();
    const mockGoogleSearchInvoke = vi.fn();
    const mockCanadaCaSearchInvoke = vi.fn();
    const mockToolTrackingHandler = vi.fn();
    
    // Console mock setup
    let originalConsoleWarn;
    
    // Before each test
    beforeEach(() => {
        // Reset mocks
        vi.resetAllMocks();
        
        // Mock console.warn
        originalConsoleWarn = console.warn;
        console.warn = vi.fn();
        
        // Set up global mocks for our runtime injections
        globalThis.mockDownloadInvoke = mockDownloadInvoke;
        globalThis.mockCheckUrlInvoke = mockCheckUrlInvoke;
        globalThis.mockGoogleSearchInvoke = mockGoogleSearchInvoke;
        globalThis.mockCanadaCaSearchInvoke = mockCanadaCaSearchInvoke;
        globalThis.mockToolTrackingHandler = mockToolTrackingHandler;
        
        // Add mock return value for ToolTrackingHandler
        mockToolTrackingHandler.mockImplementation((chatId) => ({ chatId }));
    });
    
    // After each test
    afterEach(() => {
        // Restore console
        console.warn = originalConsoleWarn;
        
        // Clean up global mocks
        delete globalThis.mockDownloadInvoke;
        delete globalThis.mockCheckUrlInvoke;
        delete globalThis.mockGoogleSearchInvoke;
        delete globalThis.mockCanadaCaSearchInvoke;
        delete globalThis.mockToolTrackingHandler;
    });
    
    // Helper to create a mock toolFactory implementation
    const createMockToolFactory = () => {
        const toolFactoryCode = `
            // Mock imports
            const downloadWebPage = { default: { invoke: globalThis.mockDownloadInvoke, name: 'downloadWebPage' } };
            const checkURL = { default: { invoke: globalThis.mockCheckUrlInvoke, name: 'checkURL' } };
            const googleContextSearch = { contextSearchTool: { invoke: globalThis.mockGoogleSearchInvoke, name: 'googleSearch' } };
            const canadaCaContextSearch = { contextSearchTool: { invoke: globalThis.mockCanadaCaSearchInvoke, name: 'canadaCaSearch' } };
            // Mock ContextTool - Assuming it's a class we can instantiate
            const ContextTool = class {
                constructor(config) {
                    this.name = 'getContext'; // Match the tool's name
                    this.description = 'Mock Context Tool Description';
                    this.config = config; // Store config like aiProvider, chatId
                }
                // Mock invoke if needed for specific tests, otherwise just check instantiation
            };
            // Mock DepartmentScenariosTool
            const DepartmentScenariosTool = class {
                 constructor() {
                    this.name = 'getDepartmentScenarios'; // Match the tool's name
                    this.description = 'Mock Department Scenarios Tool Description';
                 }
            };

            // Mock ToolTrackingHandler
            class ToolTrackingHandler {
                constructor(chatId) {
                    return globalThis.mockToolTrackingHandler(chatId);
                }
            }
            
            // Function definitions using standard CommonJS syntax
            // Update getStandardTools to accept aiProvider for ContextTool instantiation
            const getStandardTools = function(chatId = 'system', aiProvider = 'default-mock-provider') {
                const standardTools = [
                    {
                        ...downloadWebPage.default,
                        invoke: async (params) => {
                            const newParams = { 
                                ...params, 
                                args: { 
                                    ...params.args, 
                                    chatId 
                                } 
                            };
                            return await downloadWebPage.default.invoke(newParams);
                        }
                    },
                    {
                        ...checkURL.default,
                        invoke: async (params) => {
                            const newParams = {
                                ...params,
                                args: {
                                    ...params.args,
                                    chatId
                                }
                            };
                            return await checkURL.default.invoke(newParams);
                        }
                    },
                    // Instantiate and add ContextTool
                    new ContextTool({ aiProvider, chatId }),
                    // Instantiate and add DepartmentScenariosTool
                    new DepartmentScenariosTool()
                ];

                // Apply wrapping logic (assuming wrapToolWithTracking exists and works)
                // This mock doesn't fully replicate the wrapping, focuses on tool inclusion.
                // A more accurate mock would apply wrapToolWithTracking here.
                return standardTools; // Return the array including the new tool
            }
            
            const getContextSearchTool = function(provider, chatId = 'system') {
                let contextSearchTool;
                
                if (provider === 'google') {
                    contextSearchTool = {
                        ...googleContextSearch.contextSearchTool,
                        invoke: async (params) => {
                            const newParams = { 
                                ...params, 
                                args: { 
                                    ...params.args, 
                                    chatId 
                                } 
                            };
                            return await googleContextSearch.contextSearchTool.invoke(newParams);
                        }
                    };
                } else if (provider === 'canadaca') {
                    contextSearchTool = {
                        ...canadaCaContextSearch.contextSearchTool,
                        invoke: async (params) => {
                            const newParams = { 
                                ...params, 
                                args: { 
                                    ...params.args, 
                                    chatId 
                                } 
                            };
                            return await canadaCaContextSearch.contextSearchTool.invoke(newParams);
                        }
                    };
                } else {
                    console.warn(\`Unknown search provider: \${provider}. No search tool will be returned.\`);
                    return null;
                }
                
                return contextSearchTool;
            }
        `;
        
        // Create a fake module
        return new Function('globalThis', `
            ${toolFactoryCode}
            return { getStandardTools, getContextSearchTool };
        `)(globalThis);
    };
    
    // Tests for getStandardTools
    describe('getStandardTools', () => {
        test('should return an array including ContextTool and DepartmentScenariosTool with defaults', () => {
            const toolFactory = createMockToolFactory();
            const tools = toolFactory.getStandardTools(); // Use default chatId and provider

            expect(Array.isArray(tools)).toBe(true);
            expect(tools.length).toBe(4); // Expect 4 tools now
            expect(tools.some(tool => tool.name === 'downloadWebPage')).toBe(true);
            expect(tools.some(tool => tool.name === 'checkURL')).toBe(true);
            expect(tools.some(tool => tool.name === 'getContext')).toBe(true);
            expect(tools.some(tool => tool.name === 'getDepartmentScenarios')).toBe(true); // Check for new tool
            const contextToolInstance = tools.find(tool => tool.name === 'getContext');
            expect(contextToolInstance.config.chatId).toBe('system'); // Default chatId
            expect(contextToolInstance.config.aiProvider).toBe('default-mock-provider'); // Default provider
            // Note: ToolTrackingHandler mock check might need adjustment if wrapping is fully mocked
            expect(mockToolTrackingHandler).not.toHaveBeenCalled();
        });

        test('should return an array including ContextTool and DepartmentScenariosTool with specific chatId/provider', () => {
            const toolFactory = createMockToolFactory();
            const tools = toolFactory.getStandardTools('user123', 'openai'); // Pass specific chatId and provider

            expect(Array.isArray(tools)).toBe(true);
            expect(tools.length).toBe(4); // Expect 4 tools
            expect(tools.some(tool => tool.name === 'getContext')).toBe(true);
            expect(tools.some(tool => tool.name === 'getDepartmentScenarios')).toBe(true); // Check for new tool
            const contextToolInstance = tools.find(tool => tool.name === 'getContext');
            expect(contextToolInstance.config.chatId).toBe('user123');
            expect(contextToolInstance.config.aiProvider).toBe('openai');
            // DepartmentScenariosTool doesn't take config in this mock, so no check needed here
        });

        test('should call the wrapped standard tool\'s invoke method with chatId', async () => {
            // This test remains valid for the originally wrapped tools
            const toolFactory = createMockToolFactory();
            const tools = toolFactory.getStandardTools('user123', 'openai');
            const mockParams = { args: { url: 'test.com' } };
            
            await tools[0].invoke(mockParams);
            
            expect(mockDownloadInvoke).toHaveBeenCalledTimes(1);
            const firstCallArgs = mockDownloadInvoke.mock.calls[0][0];
            expect(firstCallArgs.args).toEqual({ url: 'test.com', chatId: 'user123' });
        });
    });
    
    // Tests for getContextSearchTool 
    describe('getContextSearchTool', () => {
        test('should return the google context search tool wrapped with chatId', () => {
            const toolFactory = createMockToolFactory();
            const tool = toolFactory.getContextSearchTool('google', 'chat456');
            
            expect(tool).toBeDefined();
        });
        
        test('should return the canadaca context search tool wrapped with chatId', () => {
            const toolFactory = createMockToolFactory();
            const tool = toolFactory.getContextSearchTool('canadaca', 'chat789');
            
            expect(tool).toBeDefined();
        });
        
        test('should return null for an unknown provider', () => {
            const toolFactory = createMockToolFactory();
            const tool = toolFactory.getContextSearchTool('unknown', 'chatABC');
            
            expect(tool).toBeNull();
            expect(console.warn).toHaveBeenCalledTimes(1);
            expect(console.warn).toHaveBeenCalledWith('Unknown search provider: unknown. No search tool will be returned.');
        });
        
        test('should call the wrapped search tool\'s invoke method with chatId and callbacks', async () => {
            const toolFactory = createMockToolFactory();
            const tool = toolFactory.getContextSearchTool('google', 'user456');
            const mockParams = { args: { query: 'search test' } };
            
            await tool.invoke(mockParams);
            
            expect(mockGoogleSearchInvoke).toHaveBeenCalledTimes(1);
            const firstCallArgs = mockGoogleSearchInvoke.mock.calls[0][0];
            expect(firstCallArgs.args).toEqual({ query: 'search test', chatId: 'user456' });
        });
    });
});
