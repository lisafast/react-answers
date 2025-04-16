import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import dbConnect from '../db-connect.js';
import handler from '../db-persist-feedback.js';
import { Chat } from '../../../models/chat.js';
import { Interaction } from '../../../models/interaction.js';
import { ExpertFeedback } from '../../../models/expertFeedback.js';

describe('db-persist-feedback handler (in-memory MongoDB)', { sequential: true }, () => {
  let mongod;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await dbConnect(mongod.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  beforeEach(async () => {
    await mongoose.connection.db.dropDatabase();
  });

  it('returns 405 for non-POST', async () => {
    const req = { method: 'GET' };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ message: 'Method Not Allowed' });
  });

  it('saves feedback and links to interaction', async () => {
    // Create interactions and chat
    const inter1 = await Interaction.create({ interactionId: 'int1' });
    await Interaction.create({ interactionId: 'int2' });
    await Chat.create({ chatId: 'chat1', interactions: [inter1._id] });

    const req = {
      method: 'POST',
      body: { chatId: 'chat1', interactionId: 'int1', expertFeedback: { totalScore: 5 } }
    };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Feedback logged successfully' });

    const updated = await Interaction.findOne({ interactionId: 'int1' }).populate('expertFeedback');
    expect(updated.expertFeedback).toBeDefined();
    expect(updated.expertFeedback.totalScore).toBe(5);
  });

  it('handles errors and returns 500 when chat not found', async () => {
    const req = {
      method: 'POST',
      body: { chatId: 'missing', interactionId: 'int1', expertFeedback: { score: 5 } }
    };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Failed to log Feedback' }));
  });
});
