import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongod;

// This will be called before all tests
export async function setup() {
  // Create an in-memory MongoDB instance
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  // Set the MongoDB connection string to the in-memory database
  process.env.MONGODB_URI = uri;
}

// This will be called after all tests
export async function teardown() {
  // Disconnect Mongoose and stop the MongoDB memory server
  await mongoose.disconnect();
  await mongod.stop();
}

// This will be called before each test
export async function reset() {
  // Clear all collections between tests
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany();
  }
}
