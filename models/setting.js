import mongoose from 'mongoose';

const settingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: String, required: true }
}, {
  timestamps: true,
  versionKey: false,
  id: false
});

export const Setting = mongoose.models.Setting || mongoose.model('Setting', settingSchema);
