import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Batch } from '../../models/batch.js';
import { User } from '../../models/user.js';
import dbConnect from '../../api/db/db-connect.js';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

describe('Batch API Integration Tests', () => {
  let mockUser;
  let authToken;
  const mockCsv = 'REDACTEDQUESTION,URL,chatId\n"Test question 1",http://test1.com,chat1\n"Test question 2",http://test2.com,chat1';
  
  beforeAll(async () => {
    await dbConnect();
    
    // Create test user
    mockUser = new User({
      email: 'test@example.com',
      password: 'hashedPassword123'
    });
    await mockUser.save();
    
    // Generate auth token
    authToken = jwt.sign(
      { userId: mockUser._id },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    // Cleanup test data
    await User.deleteMany({});
    await Batch.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await Batch.deleteMany({}); // Clear batches before each test
  });

  describe('POST /api/batch/create', () => {
    it('should create a new batch and return 202 status', async () => {
      const formData = new FormData();
      formData.append('file', new Blob([mockCsv], { type: 'text/csv' }), 'test.csv');
      formData.append('batchName', 'Test Batch');
      formData.append('aiProvider', 'openai');
      formData.append('searchProvider', 'google');
      formData.append('lang', 'en');
      formData.append('applyOverrides', 'false');

      const response = await fetch('/api/batch/create', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData
      });

      expect(response.status).toBe(202);
      const data = await response.json();
      expect(data).toHaveProperty('batchId');

      // Verify batch created in DB
      const batch = await Batch.findById(data.batchId);
      expect(batch).toBeDefined();
      expect(batch.name).toBe('Test Batch');
      expect(batch.uploaderUserId.toString()).toBe(mockUser._id.toString());
      expect(batch.status).toBe('processing');
      expect(batch.totalItems).toBe(2);
    });

    it('should return 400 for invalid CSV', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['invalid,csv'], { type: 'text/csv' }), 'test.csv');
      formData.append('batchName', 'Test Batch');
      // ... other required fields ...

      const response = await fetch('/api/batch/create', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData
      });

      expect(response.status).toBe(400);
      const error = await response.json();
      expect(error.message).toContain('CSV missing required columns');
    });
  });

  describe('GET /api/batch/status', () => {
    let testBatch;

    beforeEach(async () => {
      testBatch = await Batch.create({
        name: 'Status Test Batch',
        uploaderUserId: mockUser._id,
        type: 'question',
        aiProvider: 'openai',
        searchProvider: 'google',
        pageLanguage: 'en',
        status: 'processing',
        totalItems: 2,
        processedItems: 1,
        failedItems: 0
      });
    });

    it('should return batch status for authorized user', async () => {
      const response = await fetch(`/api/batch/status?batchId=${testBatch._id}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe('processing');
      expect(data.processedItems).toBe(1);
      expect(data.totalItems).toBe(2);
    });

    it('should return 404 for non-existent batch', async () => {
      const response = await fetch(`/api/batch/status?batchId=${new mongoose.Types.ObjectId()}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/batch/list', () => {
    beforeEach(async () => {
      // Create test batches
      await Batch.create([
        {
          name: 'Batch 1',
          uploaderUserId: mockUser._id,
          type: 'question',
          aiProvider: 'openai',
          status: 'completed'
        },
        {
          name: 'Batch 2',
          uploaderUserId: mockUser._id,
          type: 'question',
          aiProvider: 'anthropic',
          status: 'processing'
        }
      ]);
    });

    it('should return list of user batches', async () => {
      const response = await fetch('/api/batch/list', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.status).toBe(200);
      const batches = await response.json();
      expect(batches).toHaveLength(2);
      expect(batches[0].uploaderUserId.toString()).toBe(mockUser._id.toString());
      expect(batches).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Batch 1', status: 'completed' }),
          expect.objectContaining({ name: 'Batch 2', status: 'processing' })
        ])
      );
    });
  });

  describe('GET /api/batch/results', () => {
    let testBatch;

    beforeEach(async () => {
      testBatch = await Batch.create({
        name: 'Results Test Batch',
        uploaderUserId: mockUser._id,
        type: 'question',
        aiProvider: 'openai',
        status: 'completed',
        interactions: [] // Would be populated with real interaction IDs
      });
    });

    it('should return populated batch results', async () => {
      const response = await fetch(`/api/batch/results?batchId=${testBatch._id}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data._id.toString()).toBe(testBatch._id.toString());
      expect(data).toHaveProperty('interactions');
    });

    it('should return 403 for unauthorized access', async () => {
      // Create another user's batch
      const otherBatch = await Batch.create({
        name: 'Other User Batch',
        uploaderUserId: new mongoose.Types.ObjectId(),
        type: 'question',
        aiProvider: 'openai',
        status: 'completed'
      });

      const response = await fetch(`/api/batch/results?batchId=${otherBatch._id}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/batch/cancel', () => {
    let testBatch;

    beforeEach(async () => {
      testBatch = await Batch.create({
        name: 'Cancel Test Batch',
        uploaderUserId: mockUser._id,
        type: 'question',
        aiProvider: 'openai',
        status: 'processing'
      });
    });

    it('should cancel a processing batch', async () => {
      const response = await fetch('/api/batch/cancel', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ batchId: testBatch._id })
      });

      expect(response.status).toBe(200);
      
      // Verify batch status updated
      const updatedBatch = await Batch.findById(testBatch._id);
      expect(updatedBatch.status).toBe('cancelled');
    });

    it('should return 404 for non-existent batch', async () => {
      const response = await fetch('/api/batch/cancel', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ batchId: new mongoose.Types.ObjectId() })
      });

      expect(response.status).toBe(404);
    });
  });
});