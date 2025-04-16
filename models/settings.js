import mongoose from 'mongoose';

const SettingsSchema = new mongoose.Schema({
  batchDuration: {
    type: Number,
    required: true,
    min: 1,
    validate: {
      validator: Number.isInteger,
      message: 'Batch Duration must be a positive integer.'
    }
  },
  embeddingDuration: {
    type: Number,
    required: true,
    min: 1,
    validate: {
      validator: Number.isInteger,
      message: 'Embedding Duration must be a positive integer.'
    }
  },
  evalDuration: {
    type: Number,
    required: true,
    min: 1,
    validate: {
      validator: Number.isInteger,
      message: 'Eval Duration must be a positive integer.'
    }
  }
}, { timestamps: true });

// Singleton pattern: only one settings document
SettingsSchema.statics.getSingleton = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({ batchDuration: 60, embeddingDuration: 60, evalDuration: 60 });
  }
  return settings;
};

const Settings = mongoose.model('Settings', SettingsSchema);
export default Settings;
