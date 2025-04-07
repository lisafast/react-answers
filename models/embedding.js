import mongoose from 'mongoose';

const embeddingSchema = new mongoose.Schema({
  chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true, },
  interactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Interaction', required: true },
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
  answerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Answer', required: true },
  questionEmbedding: { type: [Number], required: false }, 
  questionsEmbedding: { type: [Number], required: false }, 
  questionsAnswerEmbedding: { type: [Number], required: false }, 
  answerEmbedding: { type: [Number], required: false }, 
  sentenceEmbeddings: [{ type: [Number], required: false }],
}, {
  timestamps: true,
  versionKey: false,
  id: false,
});

export const Embedding = mongoose.models.Embedding || mongoose.model('Embedding', embeddingSchema);