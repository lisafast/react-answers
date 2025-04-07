import mongoose from 'mongoose';

const BatchSchema = new mongoose.Schema({
  status: { type: String, required: false, default: 'queued' },
  batchId: { type: String, required: true, default: '' },
  type: { type: String, required: true, default: '' },
  name: { type: String, required: true, default: '' },
  aiProvider: { type: String, required: true, default: '' },
  pageLanguage: { type: String, required: true, default: '' },
  totalItems: { type: Number, required: false, default: 0 },
  processedItems: { type: Number, required: false, default: 0 },
  failedItems: { type: Number, required: false, default: 0 },
  
  // New fields for user context and configuration
  uploaderUserId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
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
  
  interactions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Interaction'
  }]
},{
  timestamps: true, 
  versionKey: false,
  id: false,
});

// Add index on uploaderUserId to optimize queries
BatchSchema.index({ uploaderUserId: 1 });

export const Batch = mongoose.models.Batch || mongoose.model('Batch', BatchSchema);
