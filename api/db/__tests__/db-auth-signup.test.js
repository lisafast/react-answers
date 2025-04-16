process.env.JWT_SECRET_KEY = 'testsecret';

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import dbConnect from '../db-connect.js';
import handler from '../db-auth-signup.js';
import { User } from '../../../models/user.js';

describe('db-auth-signup handler (in-memory MongoDB)', { sequential: true }, () => {
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

  it('returns 400 if email or password is missing', async () => {
    const req = { body: { email: '' } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Email and password are required' }));
  });

  it('returns 400 if user already exists', async () => {
    await User.create({ email: 'exists@example.com', password: 'pass' });
    const req = { body: { email: 'exists@example.com', password: 'pass' } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'User already exists' }));
  });

  it('creates first user as admin and active', async () => {
    const req = { body: { email: 'admin@example.com', password: 'adminpass' } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, message: expect.stringContaining('admin'), token: expect.any(String), user: expect.objectContaining({ email: 'admin@example.com', role: 'admin', active: true }) }));
    const user = await User.findOne({ email: 'admin@example.com' });
    expect(user.role).toBe('admin');
    expect(user.active).toBe(true);
  });

  it('creates subsequent user as inactive', async () => {
    await User.create({ email: 'admin@example.com', password: 'adminpass', role: 'admin', active: true });
    const req = { body: { email: 'user2@example.com', password: 'user2pass' } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, message: expect.stringContaining('requires activation'), user: expect.objectContaining({ email: 'user2@example.com', active: false }) }));
    const user = await User.findOne({ email: 'user2@example.com' });
    expect(user.active).toBe(false);
  });
});
