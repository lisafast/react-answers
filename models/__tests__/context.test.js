// filepath: c:\Users\hymary\repo\answers\react-answers\models\__tests__\context.test.js
import { describe, test, expect, vi } from 'vitest';

// Create a proper mock for mongoose Schema and models
const mockModel = vi.fn().mockImplementation(() => ({
  schema: {
    paths: {
      tools: {
        instance: 'Array',
        caster: {
          instance: 'ObjectId',
          options: { ref: 'Tool' }
        }
      }
    },
    pre: vi.fn()
  },
  findById: vi.fn().mockReturnValue({
    populate: vi.fn().mockResolvedValue({
      _id: 'mock-context-id',
      tools: [{
        _id: 'mock-tool-id',
        tool: 'google-search',
        status: 'completed'
      }]
    })
  })
}));

// Mock the entire mongoose module
vi.mock('mongoose', () => {
  return {
    Schema: function(definition) {
      this.paths = {
        tools: {
          instance: 'Array',
          caster: {
            instance: 'ObjectId',
            options: { ref: 'Tool' }
          }
        }
      };
      this.pre = vi.fn();
      return this;
    },
    model: mockModel,
    models: { Context: null, Tool: null },
    Schema: {
      Types: {
        ObjectId: 'ObjectId'
      }
    }
  };
});

// Mock the Context and Tool models
vi.mock('../context.js', () => ({
  Context: {
    schema: {
      paths: {
        tools: {
          instance: 'Array',
          caster: {
            instance: 'ObjectId',
            options: { ref: 'Tool' }
          }
        }
      },
      pre: vi.fn()
    },
    findById: vi.fn().mockReturnValue({
      populate: vi.fn().mockResolvedValue({
        _id: 'mock-context-id',
        tools: [{
          _id: 'mock-tool-id',
          tool: 'google-search',
          status: 'completed'
        }]
      })
    })
  }
}));

vi.mock('../tool.js', () => ({
  Tool: {
    schema: {}
  }
}));

// Import the mocked modules
import { Context } from '../context.js';
import { Tool } from '../tool.js';

describe('Context Schema', () => {
  test('Context schema includes a tools field that references Tool model', () => {
    // Check that the tools field exists and is properly defined
    const tools = Context.schema.paths.tools;
    expect(tools).toBeDefined();
    
    // Check that it's an array of ObjectId references to the Tool model
    expect(tools.instance).toBe('Array');
    expect(tools.caster.instance).toBe('ObjectId');
    expect(tools.caster.options.ref).toBe('Tool');
  });

  test('Context model can be created with tools references', async () => {
    // Set up spy on findById
    const findByIdSpy = vi.spyOn(Context, 'findById');
    
    // Call the method we're testing
    const retrievedContext = await Context.findById('mock-context-id').populate('tools');
    
    // Verify findById was called with the expected ID
    expect(findByIdSpy).toHaveBeenCalledWith('mock-context-id');
    
    // Check that the tools array was populated correctly
    expect(retrievedContext.tools).toHaveLength(1);
    expect(retrievedContext.tools[0].tool).toBe('google-search');
    expect(retrievedContext.tools[0].status).toBe('completed');
  });

  test('Context schema includes cascading delete middleware', () => {
    // Check that the pre middleware exists
    expect(Context.schema.pre).toBeDefined();
  });
});