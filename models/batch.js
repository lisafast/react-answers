import mongoose from 'mongoose';

const BatchSchema = new mongoose.Schema({
  status: { type: String, required: false, default: 'queued' },
  type: { type: String, required: true, default: '' },
  name: { type: String, required: true, default: '' },
  aiProvider: { type: String, required: true, default: '' },
  pageLanguage: { type: String, required: true, default: '' },
  totalItems: { type: Number, required: false, default: 0 },
  processedItems: { type: Number, required: false, default: 0 },
  failedItems: { type: Number, required: false, default: 0 },

  // User context and configuration
  uploaderUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function () { return this.applyOverrides === true; },
  },
  applyOverrides: {
    type: Boolean,
    default: false,
    required: true
  },
  searchProvider: {
    type: String,
    required: true
  },

  // New: Array of Chat references for batch processing
  chats: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: false
  }],

  // Deprecated: Inline entries (to be removed after migration)
  entries: {
    type: Array,
    required: false // was true, but now deprecated
  },

  lastProcessedIndex: {
    type: Number,
    required: false,
    default: 0
  }
}, {
  timestamps: true,
  versionKey: false,
  id: false,
});

// Add index on uploaderUserId to optimize queries
BatchSchema.index({ uploaderUserId: 1 });

// Middleware to handle cascading delete of chats and their children when a batch is deleted
BatchSchema.pre('deleteOne', { document: true, query: false }, async function() {
  // Delete all chats associated with this batch
  const Chat = mongoose.model('Chat');
  if (this.chats && this.chats.length > 0) {
    await Chat.deleteMany({ _id: { $in: this.chats } });
  }
});

BatchSchema.pre('deleteMany', async function() {
  // Get the batches that will be deleted
  const batches = await this.model.find(this.getFilter());
  const allChatIds = batches.flatMap(batch => batch.chats || []);
  const Chat = mongoose.model('Chat');
  if (allChatIds.length > 0) {
    await Chat.deleteMany({ _id: { $in: allChatIds } });
  }
});

export const Batch = mongoose.models.Batch || mongoose.model('Batch', BatchSchema);
