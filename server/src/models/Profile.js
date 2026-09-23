import mongoose from 'mongoose';

const profileSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  avatar: String,
  location: String,
  teaches: [String],
  wants: [String],
  bio: String,
  verified: { type: Boolean, default: false },
  emailVerified: { type: Boolean, default: false },
  blockedEmails: [String],
  profileVisible: { type: Boolean, default: true },
  allowMessages: { type: Boolean, default: true },
  accountBlocked: { type: Boolean, default: false },
  suspendedUntil: { type: Date, default: null },
  portfolioUrl: String,
  resumeName: String,
  certificates: [{ title: String, issuer: String, year: String }],
  rating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 }
}, { timestamps: true });

export default mongoose.model('Profile', profileSchema);
