import mongoose from 'mongoose';

const embeddingSchema = new mongoose.Schema({
  model: { type: String, required: true },
  vector: { type: [Number], required: true },
  dimension: { type: Number, required: true },
  processedText: { type: String, required: false }, 
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, {
  timestamps: true,
  versionKey: false,
  id: false
});

export const Embedding = mongoose.models.Embedding || mongoose.model('Embedding', embeddingSchema);