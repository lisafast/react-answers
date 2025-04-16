import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import dbConnect from '../db-connect.js';
import { usersHandler as handler } from '../db-users.js';
import { User } from '../../../models/user.js';

describe('db-users handler (in-memory MongoDB)', { sequential: true }, () => {
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

  it('returns users (GET), omits password', async () => {
    await User.create({ email: 'a@test.com', password: 'secret', active: true });
    const req = { method: 'GET' };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const users = res.json.mock.calls[0][0];
    expect(Array.isArray(users)).toBe(true);
    expect(users[0].password).toBeUndefined();
    expect(users[0].email).toBe('a@test.com');
  });

  it('updates user active status (PATCH)', async () => {
    const user = await User.create({ email: 'b@test.com', password: 'pw', active: false });
    const req = { method: 'PATCH', body: { userId: user._id.toString(), active: true } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].active).toBe(true);
    expect(res.json.mock.calls[0][0].password).toBeUndefined();
  });

  it('returns 400 if PATCH missing userId', async () => {
    const req = { method: 'PATCH', body: { active: true } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'User ID is required' });
  });

  it('returns 400 if PATCH active not boolean', async () => {
    const req = { method: 'PATCH', body: { userId: 'id', active: 'yes' } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Active status must be boolean' });
  });

  it('returns 404 if PATCH user not found', async () => {
    const req = { method: 'PATCH', body: { userId: new mongoose.Types.ObjectId().toString(), active: true } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'User not found' });
  });

  it('deletes user (DELETE)', async () => {
    const user = await User.create({ email: 'c@test.com', password: 'pw', active: true });
    const req = { method: 'DELETE', body: { userId: user._id.toString() } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'User deleted successfully' });
    const found = await User.findById(user._id);
    expect(found).toBeNull();
  });

  it('returns 400 if DELETE missing userId', async () => {
    const req = { method: 'DELETE', body: {} };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'User ID is required' });
  });

  it('returns 404 if DELETE user not found', async () => {
    const req = { method: 'DELETE', body: { userId: new mongoose.Types.ObjectId().toString() } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'User not found' });
  });

  it('returns 405 for unsupported method', async () => {
    const req = { method: 'POST' };
    const res = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), end: vi.fn() };
    await handler(req, res);
    expect(res.setHeader).toHaveBeenCalledWith('Allow', ['GET', 'PATCH']);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.end).toHaveBeenCalledWith('Method POST Not Allowed');
  });
});
