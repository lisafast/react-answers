import mongoose, { model } from 'mongoose';

const Schema = mongoose.Schema;

const contextSchema = new Schema({
    topic: { type: String, required: false, default: '' },
    topicUrl: { type: String, required: false, default: '' },
    department: { type: String, required: false, default: '' },
    departmentUrl: { type: String, required: false, default: '' },
    searchResults: { type: String, required: false, default: '' },
    inputTokens: { type: String, required: false, default: '' },
    outputTokens: { type: String, required: false, default: '' },
    model: { type: String, required: false, default: '' },
    searchProvider: { type: String, required: false, default: '' },
    tools: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tool' }], // Reference Tool documents
}, {
    timestamps: true, versionKey: false,
    id: false,
});

// Middleware to handle cascading delete of tool references when a context is deleted
contextSchema.pre('deleteMany', async function() {
  // Get the contexts that will be deleted
  const contexts = await this.model.find(this.getFilter());
  
  // Extract all the IDs of related tools
  const toolIds = contexts.flatMap(c => c.tools).filter(Boolean);

  // Delete all related tool documents
  if (toolIds.length > 0) {
    const Tool = mongoose.model('Tool');
    await Tool.deleteMany({ _id: { $in: toolIds } });
  }
});

export const Context = mongoose.models.Context || mongoose.model('Context', contextSchema);