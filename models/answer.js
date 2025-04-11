import mongoose from 'mongoose';

const answerSchema = new mongoose.Schema({
  englishAnswer: { type: String, required: false, default: '' },
  content: { type: String, required: false, default: '' },
  sentences: [{ type: String, required: false, default: '' }],
  citation: { type: mongoose.Schema.Types.ObjectId, ref: 'Citation' },
  inputTokens: { type: String, required: false, default: '' },
  outputTokens: { type: String, required: false, default: '' },
  model: { type: String, required: false, default: '' },
  answerType: { type: String, required: false, default: '' },
  tools: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tool' }], // Reference Tool documents instead of storing directly
},{
  timestamps: true, versionKey: false,
  id: false,
});

// Middleware to handle cascading delete of citations and tools when an answer is deleted
answerSchema.pre('deleteMany', async function() {
  // Get the answers that will be deleted
  const answers = await this.model.find(this.getFilter());
  
  // Extract all the IDs of related documents
  const citationIds = answers.map(a => a.citation).filter(Boolean);
  const toolIds = answers.flatMap(a => a.tools).filter(Boolean);

  // Delete all related documents
  const Citation = mongoose.model('Citation');
  const Tool = mongoose.model('Tool');

  await Promise.all([
    Citation.deleteMany({ _id: { $in: citationIds } }),
    Tool.deleteMany({ _id: { $in: toolIds } })
  ]);
});

export const Answer = mongoose.models.Answer || mongoose.model('Answer', answerSchema);
