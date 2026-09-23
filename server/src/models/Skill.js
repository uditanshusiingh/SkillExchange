import mongoose from 'mongoose';

const skillSchema = new mongoose.Schema({
  title: { type: String, required: true },
  category: { type: String, required: true },
  level: { type: String, default: 'Beginner friendly' },
  format: { type: String, default: 'Video call' },
  description: { type: String, required: true },
  teacher: {
    name: String,
    role: String,
    avatar: String,
    location: String,
    rating: Number,
    exchanges: Number
  },
  wants: { type: String, required: true },
  color: { type: String, default: '#d7e7df' },
  moderationStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  featured: { type: Boolean, default: false },
  moderationNote: { type: String, default: '' },
  moderatedAt: { type: Date, default: null }
}, { timestamps: true });

export default mongoose.model('Skill', skillSchema);
