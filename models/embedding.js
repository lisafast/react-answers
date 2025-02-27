import mongoose from 'mongoose';

const embeddingSchema = new mongoose.Schema({
  model: { type: String, required: true },
  vector: { type: [Number], required: true },
  dimension: { type: Number, required: true },
  processedText: { type: String, required: false },
  // Reference to either a question or answer document
  objectId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true,
    refPath: 'objectType'
  },
  // Defines what type of object this embedding refers to ("question" or "answer")
  objectType: {
    type: String,
    required: true,
    enum: ['question', 'answer']
  },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, {
  timestamps: true,
  versionKey: false,
  id: false,
  // Index for faster lookups by object reference
  index: [
    { objectId: 1, objectType: 1 }
  ]
});

export const Embedding = mongoose.models.Embedding || mongoose.model('Embedding', embeddingSchema);