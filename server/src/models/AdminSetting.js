import mongoose from 'mongoose';

const adminSettingSchema = new mongoose.Schema({
  key: { type: String, unique: true, required: true },
  value: { type: mongoose.Schema.Types.Mixed, default: null }
}, { timestamps: true });

export default mongoose.model('AdminSetting', adminSettingSchema);
