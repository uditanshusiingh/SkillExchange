import mongoose from 'mongoose';

const adminLogSchema = new mongoose.Schema({
  action: { type: String, required: true },
  admin: { type: String, default: 'Admin' },
  targetType: { type: String, default: '' },
  targetId: { type: String, default: '' },
  details: { type: String, default: '' },
  success: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
}, { versionKey: false });

export default mongoose.models.AdminLog || mongoose.model('AdminLog', adminLogSchema);
