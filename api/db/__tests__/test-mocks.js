// Common test mocks for db-related tests
import { vi } from 'vitest';

export const createMockChat = () => ({
  interactions: [
    { interactionId: 'int1', save: vi.fn() },
    { interactionId: 'int2', save: vi.fn() }
  ],
  // Add a mock populate function that returns the object itself for chaining
  populate: vi.fn().mockReturnThis()
});

export const createMockExpertFeedbackInstance = () => ({
  _id: 'feedback123',
  save: vi.fn(),
  toObject: vi.fn(() => ({ _id: 'feedback123', score: 5 }))
});

export const reqRes = () => {
  const req = { method: 'POST', body: { chatId: 'chat1', interactionId: 'int1', expertFeedback: { score: 5 } } };
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  return { req, res };
};

// Stub implementation of dbConnect to be used in tests
export const mockDbConnect = vi.fn().mockResolvedValue(true);

// Optionally, a function to set up all vi.mocks for db tests
export function setupDbMocks() {
  // Mock the models but don't mock db-connect here (we'll handle it differently)
  vi.mock('../../../models/chat.js', () => ({
    Chat: { findOne: vi.fn() }
  }));
  vi.mock('../../../models/expertFeedback.js', () => ({
    ExpertFeedback: vi.fn()
  }));
}

export default {
  createMockChat,
  createMockExpertFeedbackInstance,
  reqRes,
  mockDbConnect,
  setupDbMocks
};
