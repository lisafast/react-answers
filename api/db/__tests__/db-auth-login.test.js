process.env.JWT_SECRET_KEY = 'testsecret';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import dbConnect from '../db-connect.js';
import handler from '../db-auth-login.js';
import { User } from '../../../models/user.js';

describe('db-auth-login handler (in-memory MongoDB)', { sequential: true }, () => {
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

  it('returns 401 if user not found', async () => {
    const req = { body: { email: 'nouser@example.com', password: 'pass' } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Invalid credentials' }));
  });

  it('returns 403 if user is inactive', async () => {
    await User.create({ email: 'inactive@example.com', password: 'pass', active: false });
    const req = { body: { email: 'inactive@example.com', password: 'pass' } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Account is deactivated' }));
  });

  it('returns 401 if password is incorrect', async () => {
    const user = new User({ email: 'user@example.com', password: 'correctpass', active: true });
    await user.save();
    const req = { body: { email: 'user@example.com', password: 'wrongpass' } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Invalid credentials' }));
  });

  it('returns 200 and token for valid login', async () => {
    const user = new User({ email: 'valid@example.com', password: 'validpass', active: true, role: 'user' });
    await user.save();
    const req = { body: { email: 'valid@example.com', password: 'validpass' } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, message: 'Login successful', token: expect.any(String), user: expect.objectContaining({ email: 'valid@example.com', role: 'user', active: true }) }));
  });
});
