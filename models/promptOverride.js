import mongoose from 'mongoose';

const promptOverrideSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Assuming your user model is named 'User'
    required: true,
    index: true, // Index for efficient user-specific lookups
  },
  filename: {
    type: String,
    required: true,
    trim: true,
    index: true, // Index for efficient filename lookups
  },
  content: {
    type: String,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true, // Index for filtering active overrides
  },
}, {
  timestamps: true, // Adds createdAt and updatedAt timestamps
});

// Compound index for the most common query: finding an active override for a specific user and filename
promptOverrideSchema.index({ userId: 1, filename: 1, isActive: 1 });

// Prevent duplicate overrides for the same user and filename
promptOverrideSchema.index({ userId: 1, filename: 1 }, { unique: true });

// Check if the model already exists before defining it
const PromptOverride = mongoose.models.PromptOverride || mongoose.model('PromptOverride', promptOverrideSchema);

export default PromptOverride;
