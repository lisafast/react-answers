import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  expiresAt: { type: Date, required: true, index: { expires: '1h' } }, // TTL index for auto-cleanup after 1 hour of inactivity (adjust as needed)
  chatId: { type: String, required: false }, // Optional: to link a chat to this session
  // You can add other session-specific data here, e.g., user agent, IP address for auditing
}, {
  timestamps: true, // Adds createdAt and updatedAt
  versionKey: false,
  id: false,
});

export const Session = mongoose.models.Session || mongoose.model('Session', sessionSchema);
