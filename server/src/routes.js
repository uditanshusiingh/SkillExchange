import express from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import { randomBytes } from 'node:crypto';
import { createSessionToken, verifySessionToken } from './auth.js';
import Skill from './models/Skill.js';
import Profile from './models/Profile.js';
import Exchange from './models/Exchange.js';
import Review from './models/Review.js';
import AdminLog from './models/AdminLog.js';
import AdminSetting from './models/AdminSetting.js';
import { seedSkills } from './data/seedSkills.js';
import { readProfiles, writeProfiles } from './data/localProfiles.js';
import { readMessages, writeMessages } from './data/localMessages.js';
import { readCollection, writeCollection } from './data/localCollections.js';

const router = express.Router();
const adminSessions = new Map();
const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function readAdminSetting(key, fallback = null) {
  const item = readCollection('adminSettings.json').find((entry) => entry.key === key);
  return item ? item.value : fallback;
}

function writeAdminSetting(key, value) {
  const settings = readCollection('adminSettings.json').filter((entry) => entry.key !== key);
  writeCollection('adminSettings.json', [{ key, value, updatedAt: new Date().toISOString() }, ...settings]);
}

async function getAdminSetting(key, fallback = null) {
  if (process.env.MONGODB_URI) {
    const item = await AdminSetting.findOne({ key }).lean();
    return item ? item.value : fallback;
  }
  return readAdminSetting(key, fallback);
}

async function setAdminSetting(key, value) {
  if (process.env.MONGODB_URI) {
    await AdminSetting.findOneAndUpdate({ key }, { $set: { value } }, { upsert: true, new: true });
    return;
  }
  writeAdminSetting(key, value);
}

// Admin API enabled: deployed route group for SkillSwap control center.
// Analytics endpoint is part of the deployed admin API.
let localSkills = seedSkills.map((skill) => ({ ...skill, moderationStatus: 'approved', featured: false, moderationNote: '', moderatedAt: null, createdAt: new Date(0).toISOString() }));

const mailer = process.env.SMTP_HOST ? nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === 'true', family: 4, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 10000 }) : null;
const brevoApiKey = process.env.BREVO_API_KEY;

function emailServiceMessage(error) {
  if (error?.code === 'ENETUNREACH' || error?.code === 'ETIMEDOUT' || error?.code === 'ECONNREFUSED') return 'Email service is unreachable from the hosting server. Please check SMTP settings or try again later.';
  return error?.message || 'Email service is unavailable. Please try again later.';
}

async function sendEmail(message) {
  if (brevoApiKey) {
    const senderEmail = message.from.match(/<([^>]+)>/)?.[1] || message.from;
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { accept: 'application/json', 'api-key': brevoApiKey, 'content-type': 'application/json' },
      body: JSON.stringify({ sender: { email: senderEmail }, to: [{ email: message.to }], subject: message.subject, textContent: message.text, htmlContent: message.html })
    });
    if (!response.ok) throw new Error(`Brevo email service returned ${response.status}.`);
    return;
  }
  if (!mailer) return;
  await mailer.sendMail(message);
}

async function sendVerificationEmail(email, token) {
  if (!mailer && !brevoApiKey) {
    if (process.env.NODE_ENV === 'production') throw new Error('Email service is not configured.');
    return;
  }
  const verifyUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}?verify=${encodeURIComponent(token)}`;
  await sendEmail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: email, subject: 'Verify your SkillSwap account', text: `Verify your SkillSwap account: ${verifyUrl}`, html: `<p>Welcome to SkillSwap.</p><p><a href="${verifyUrl}">Verify your email address</a> to activate your account.</p><p>This link expires in 24 hours.</p>` });
}

async function sendResetEmail(email, token) {
  if (!mailer && !brevoApiKey) {
    if (process.env.NODE_ENV === 'production') throw new Error('Email service is not configured.');
    return;
  }
  const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}?reset=${encodeURIComponent(token)}`;
  await sendEmail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: email, subject: 'Reset your SkillSwap password', text: `We received a password reset request for your SkillSwap account. Reset your password here: ${resetUrl}. This link expires in 15 minutes.`, html: `<p>We received a password reset request for your SkillSwap account.</p><p><a href="${resetUrl}">Reset your password</a></p><p>This link expires in 15 minutes.</p>` });
}

function createVerificationToken(email) {
  const token = `verify-${randomBytes(32).toString('hex')}`;
  const tokens = readCollection('resetTokens.json').filter((item) => item.type !== 'verify' || item.expiresAt > Date.now());
  writeCollection('resetTokens.json', [{ token, type: 'verify', email: email.trim().toLowerCase(), expiresAt: Date.now() + 24 * 60 * 60 * 1000 }, ...tokens]);
  return token;
}


async function syncProfileSkills(profile, previousEmail = '') {
  const email = String(profile?.email || '').trim().toLowerCase();
  const oldEmail = String(previousEmail || '').trim().toLowerCase();
  if (oldEmail && oldEmail !== email) {
    if (process.env.MONGODB_URI) await Skill.deleteMany({ 'teacher.email': oldEmail });
    else localSkills = localSkills.filter((skill) => String(skill.teacher?.email || '').toLowerCase() !== oldEmail);
  }
  if (!email) return;
  const teaches = [...new Set((profile.teaches || []).map((item) => String(item).trim()).filter(Boolean))];
  const baseTeacher = {
    name: profile.name || 'Community member',
    role: teaches[0] || 'Community member',
    avatar: profile.avatar || String(profile.name || 'U').slice(0, 2).toUpperCase(),
    location: profile.location || 'Location not shared',
    rating: profile.rating || 0,
    exchanges: profile.exchanges || 0,
    email
  };
  if (process.env.MONGODB_URI) {
    await Skill.deleteMany({ 'teacher.email': email, title: { $nin: teaches } });
    for (const title of teaches) {
      await Skill.findOneAndUpdate(
        { 'teacher.email': email, title },
        {
          $set: {
            category: 'Community skills',
            level: 'All levels',
            format: 'Flexible',
            description: profile.bio || (profile.name + ' is open to sharing ' + title + '.'),
            teacher: { ...baseTeacher, role: teaches[0] || 'Community member' },
            wants: profile.wants?.length ? ('I want to learn ' + profile.wants.join(', ')) : 'Open to a useful skill exchange'
          },
          $setOnInsert: { moderationStatus: 'pending', featured: false, moderationNote: '', moderatedAt: null }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
    return;
  }
  localSkills = localSkills.filter((skill) => String(skill.teacher?.email || '').toLowerCase() !== email || teaches.includes(String(skill.title || '')));
  const now = new Date().toISOString();
  teaches.forEach((title) => {
    const existing = localSkills.find((skill) => String(skill.teacher?.email || '').toLowerCase() === email && skill.title === title);
    if (existing) {
      Object.assign(existing, {
        category: existing.category || 'Community skills',
        description: profile.bio || (profile.name + ' is open to sharing ' + title + '.'),
        teacher: { ...baseTeacher, role: teaches[0] || 'Community member' },
        wants: profile.wants?.length ? ('I want to learn ' + profile.wants.join(', ')) : 'Open to a useful skill exchange',
        updatedAt: now
      });
      return;
    }
    localSkills.unshift({
      _id: 'profile-skill-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      title,
      category: 'Community skills',
      level: 'All levels',
      format: 'Flexible',
      description: profile.bio || (profile.name + ' is open to sharing ' + title + '.'),
      teacher: { ...baseTeacher, role: teaches[0] || 'Community member' },
      wants: profile.wants?.length ? ('I want to learn ' + profile.wants.join(', ')) : 'Open to a useful skill exchange',
      color: '#dbe8de',
      availability: 'Flexible',
      moderationStatus: 'pending',
      featured: false,
      moderationNote: '',
      moderatedAt: null,
      createdAt: now,
      updatedAt: now
    });
  });
}

async function syncAllProfileSkills() {
  if (!process.env.MONGODB_URI) {
    const profiles = readProfiles();
    for (const profile of profiles) await syncProfileSkills(profile);
    return;
  }
  const profiles = await Profile.find({}).select('name email avatar location teaches wants bio rating').lean();
  for (const profile of profiles) await syncProfileSkills(profile);
  await Skill.updateMany(
    { moderationStatus: { $exists: false } },
    { $set: { moderationStatus: 'approved', featured: false, moderationNote: '', moderatedAt: null } }
  );
}

async function getPublicSkills() {
  await syncAllProfileSkills();
  if (process.env.MONGODB_URI) {
    return Skill.find({ moderationStatus: 'approved' }).sort({ featured: -1, createdAt: -1 }).lean();
  }
  return localSkills
    .filter((skill) => !skill.moderationStatus || skill.moderationStatus === 'approved')
    .sort((a, b) => Number(b.featured) - Number(a.featured));
}

function databaseRequired(response) {
  if (process.env.NODE_ENV === 'production' && !process.env.MONGODB_URI) {
    response.status(503).json({ message: 'Account service is not configured with MongoDB yet.' });
    return true;
  }
  return false;
}

async function findProfileForAuth(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return null;
  if (process.env.MONGODB_URI) return Profile.findOne({ email: normalizedEmail }).select('+passwordHash');
  return readProfiles().find((profile) => String(profile.email || '').toLowerCase() === normalizedEmail) || null;
}

async function requireAuth(request, response) {
  const authorization = String(request.headers.authorization || '');
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : String(request.headers['x-session-token'] || '').trim();
  const session = verifySessionToken(token);
  if (!session) {
    response.status(401).json({ message: 'Authentication required. Please log in again.' });
    return false;
  }
  const profile = await findProfileForAuth(session.email);
  if (!profile) {
    response.status(401).json({ message: 'Your account no longer exists. Please log in again.' });
    return false;
  }
  if (profile.accountBlocked) {
    response.status(403).json({ message: 'This account has been blocked by an administrator.' });
    return false;
  }
  if (profile.suspendedUntil && new Date(profile.suspendedUntil).getTime() > Date.now()) {
    response.status(403).json({ message: 'This account is currently suspended.' });
    return false;
  }
  request.user = publicProfile(profile);
  request.user.email = String(request.user.email).toLowerCase();
  return true;
}

function sameUser(request, identifier) {
  const value = String(identifier || '').trim().toLowerCase();
  return String(request.user?.email || '').toLowerCase() === value || String(request.user?._id || '').toLowerCase() === value;
}

function publicProfile(profile) {
  const { passwordHash: _passwordHash, ...safeProfile } = profile.toObject ? profile.toObject() : profile;
  return safeProfile;
}

function isDiscoverableProfile(profile) {
  return profile.email !== 'demo@gmail.com' && profile.profileVisible !== false && profile.accountBlocked !== true && !(profile.suspendedUntil && new Date(profile.suspendedUntil).getTime() > Date.now());
}

function discoverableProfileQuery() {
  return { profileVisible: { $ne: false }, email: { $ne: 'demo@gmail.com' }, accountBlocked: { $ne: true }, $or: [{ suspendedUntil: null }, { suspendedUntil: { $lte: new Date() } }, { suspendedUntil: { $exists: false } }] };
}

async function discoverableEmails() {
  if (process.env.MONGODB_URI) {
    const profiles = await Profile.find(discoverableProfileQuery()).select('email').lean();
    return new Set(profiles.map((profile) => profile.email.toLowerCase()));
  }
  return new Set(readProfiles().filter(isDiscoverableProfile).map((profile) => profile.email.toLowerCase()));
}

function hasDiscoverableParticipants(item, emails, fields) {
  return fields.every((field) => item[field] && emails.has(item[field].toLowerCase()));
}

router.get('/health', (_request, response) => response.json({ ok: true, mode: process.env.MONGODB_URI ? 'mongodb-ready' : 'memory' }));

router.post('/auth/send-verification', (request, response) => {
  const { email } = request.body;
  if (!email) return response.status(400).json({ message: 'Email is required.' });
  try {
    const token = createVerificationToken(email);
    return sendVerificationEmail(email.trim().toLowerCase(), token).then(() => response.json({ message: 'Verification email sent.' })).catch((error) => response.status(503).json({ message: error.message }));
  } catch (error) {
    return response.status(503).json({ message: error.message });
  }
});

router.post('/auth/verify-email', async (request, response) => {
  const tokens = readCollection('resetTokens.json');
  const record = tokens.find((item) => item.type === 'verify' && item.token === request.body.token && item.expiresAt > Date.now());
  if (!record) return response.status(400).json({ message: 'Verification token is invalid or expired.' });
  if (process.env.MONGODB_URI) {
    const profile = await Profile.findOneAndUpdate({ email: record.email }, { emailVerified: true, verified: true }, { new: true });
    if (!profile) return response.status(404).json({ message: 'Profile not found.' });
  } else {
    const profiles = readProfiles();
    const index = profiles.findIndex((profile) => profile.email === record.email);
    if (index === -1) return response.status(404).json({ message: 'Profile not found.' });
    profiles[index].emailVerified = true;
    profiles[index].verified = true;
    writeProfiles(profiles);
  }
  writeCollection('resetTokens.json', tokens.filter((item) => item.token !== record.token));
  return response.json({ message: 'Email verified successfully.' });
});

router.get('/profiles/:email/public', async (request, response) => {
  const email = decodeURIComponent(request.params.email).toLowerCase();
  if (!process.env.MONGODB_URI) {
    const profile = readProfiles().find((item) => item.email === email);
    if (!profile) return response.status(404).json({ message: 'Profile not found.' });
    if (!isDiscoverableProfile(profile)) return response.status(404).json({ message: 'Profile not found.' });
    return response.json({ ...publicProfile(profile), email: undefined });
  }
  const profile = await Profile.findOne({ ...discoverableProfileQuery(), email });
  if (!profile) return response.status(404).json({ message: 'Profile not found.' });
  const safe = publicProfile(profile);
  delete safe.email;
  return response.json(safe);
});

router.get('/profiles', async (request, response) => {
  const { search = '', location = '' } = request.query;
  const normalizedSearch = search.trim().toLowerCase();
  const normalizedLocation = location.trim().toLowerCase();
  if (!process.env.MONGODB_URI) {
    const profiles = readProfiles().filter(isDiscoverableProfile);
    return response.json(profiles.filter((profile) => {
      const text = `${profile.name} ${profile.bio || ''} ${(profile.teaches || []).join(' ')} ${(profile.wants || []).join(' ')}`.toLowerCase();
      return (!normalizedSearch || text.includes(normalizedSearch)) && (!normalizedLocation || (profile.location || '').toLowerCase().includes(normalizedLocation));
    }).map(publicProfile));
  }
  const query = discoverableProfileQuery();
  if (normalizedSearch) query.$or = [{ name: { $regex: normalizedSearch, $options: 'i' } }, { bio: { $regex: normalizedSearch, $options: 'i' } }, { teaches: { $regex: normalizedSearch, $options: 'i' } }, { wants: { $regex: normalizedSearch, $options: 'i' } }];
  if (normalizedLocation) query.location = { $regex: normalizedLocation, $options: 'i' };
  const profiles = await Profile.find(query).select('-passwordHash').sort({ createdAt: -1 }).limit(100);
  return response.json(profiles.map(publicProfile));
});


router.get('/skills', async (request, response) => {
  const { category, search, teach, wants, location, format, level, availability, page = 1, limit = 8, sort = 'newest' } = request.query;
  const pageNumber = Math.max(1, Number(page));
  const pageSize = Math.min(24, Math.max(1, Number(limit)));
  const availableSkills = await getPublicSkills();
  const discoverable = await discoverableEmails();
  const filtered = availableSkills.filter((skill) => {
    const text = [skill.title, skill.description, skill.teacher?.name, skill.wants, skill.category].filter(Boolean).join(' ').toLowerCase();
    const matchesCategory = !category || category === 'All' || String(skill.category || '').toLowerCase() === String(category).toLowerCase();
    const wantsMatch = !search || text.includes(String(search).toLowerCase());
    const teachMatch = !teach || String(skill.title || '').toLowerCase().includes(String(teach).toLowerCase()) || String(skill.description || '').toLowerCase().includes(String(teach).toLowerCase());
    const wantsFieldMatch = !wants || String(skill.wants || '').toLowerCase().includes(String(wants).toLowerCase());
    const locationMatch = !location || String(skill.teacher?.location || '').toLowerCase().includes(String(location).toLowerCase());
    const formatMatch = !format || String(skill.format || '').toLowerCase().includes(String(format).toLowerCase());
    const levelMatch = !level || String(skill.level || '').toLowerCase().includes(String(level).toLowerCase());
    const availabilityMatch = !availability || String(skill.availability || 'Flexible').toLowerCase() === String(availability).toLowerCase();
    const discoverableTeacher = !skill.teacher?.email || discoverable.has(String(skill.teacher.email).toLowerCase());
    return matchesCategory && wantsMatch && teachMatch && wantsFieldMatch && locationMatch && formatMatch && levelMatch && availabilityMatch && discoverableTeacher;
  });
  const sorted = [...filtered].sort((first, second) => sort === 'rating'
    ? Number(second.teacher?.rating || 0) - Number(first.teacher?.rating || 0)
    : String(second.createdAt || second._id).localeCompare(String(first.createdAt || first._id)));
  return response.json({ items: sorted.slice((pageNumber - 1) * pageSize, pageNumber * pageSize), page: pageNumber, limit: pageSize, total: sorted.length, hasMore: pageNumber * pageSize < sorted.length });
});
router.get('/recommendations/:email', async (request, response) => {
  const email = decodeURIComponent(request.params.email).toLowerCase();
  const profile = process.env.MONGODB_URI ? await Profile.findOne({ email }).lean() : readProfiles().find((item) => item.email === email);
  const interests = profile?.wants?.join(' ').toLowerCase() || '';
  const discoverable = await discoverableEmails();
  const skills = (await getPublicSkills()).filter((skill) => !skill.teacher?.email || discoverable.has(String(skill.teacher.email).toLowerCase()));
  const recommendations = skills
    .filter((skill) => interests && [skill.title, skill.category, skill.wants].join(' ').toLowerCase().split(' ').some((word) => word.length > 3 && interests.includes(word)))
    .slice(0, 6);
  return response.json(recommendations);
});
router.get('/profiles/:email/similar', (request, response) => {
  const email = decodeURIComponent(request.params.email).toLowerCase();
  const profile = readProfiles().find((item) => item.email === email);
  const interests = [...(profile?.teaches || []), ...(profile?.wants || [])].map((item) => item.toLowerCase());
  const similar = readProfiles().filter((item) => isDiscoverableProfile(item) && item.email !== email && [...(item.teaches || []), ...(item.wants || [])].some((skill) => interests.some((interest) => skill.toLowerCase().includes(interest)))).slice(0, 6).map(publicProfile);
  return response.json(similar);
});

router.get('/matching/:email', async (request, response) => {
  const email = decodeURIComponent(request.params.email).toLowerCase();
  const profile = process.env.MONGODB_URI ? await Profile.findOne({ email }).lean() : readProfiles().find((item) => item.email === email);
  const wants = (profile?.wants || []).map((item) => item.toLowerCase());
  const teaches = (profile?.teaches || []).map((item) => item.toLowerCase());
  const discoverable = await discoverableEmails();
  const skills = (await getPublicSkills()).filter((skill) => !skill.teacher?.email || discoverable.has(String(skill.teacher.email).toLowerCase()));
  const matches = skills.map((skill) => {
    const text = [skill.title, skill.category, skill.wants].join(' ').toLowerCase();
    const teachScore = teaches.filter((item) => text.includes(item)).length;
    const learnScore = wants.filter((item) => text.includes(item)).length;
    return { skill, matchScore: Math.min(99, 45 + (teachScore * 15) + (learnScore * 20)) };
  }).filter((item) => item.matchScore > 45).sort((first, second) => second.matchScore - first.matchScore).slice(0, 8);
  return response.json(matches);
});
router.put('/profiles/:id/portfolio', (request, response) => {
  const { portfolioUrl = '', resumeName = '', certificates = [] } = request.body;
  const profiles = readProfiles();
  const lookup = decodeURIComponent(request.params.id);
  const index = profiles.findIndex((profile) => profile._id === lookup || profile.email === lookup);
  if (index === -1) return response.status(404).json({ message: 'Profile not found.' });
  profiles[index] = { ...profiles[index], portfolioUrl, resumeName, certificates };
  writeProfiles(profiles);
  return response.json(publicProfile(profiles[index]));
});

router.get('/leaderboard', (request, response) => {
  const leaderboard = readProfiles().filter(isDiscoverableProfile).map((profile) => ({ name: profile.name, avatar: profile.avatar, exchanges: profile.exchanges || 0, rating: profile.rating || 0, verified: profile.verified || false })).sort((first, second) => (second.exchanges - first.exchanges) || (second.rating - first.rating)).slice(0, 20);
  return response.json(leaderboard);
});

router.get('/groups', (_request, response) => response.json(readCollection('groups.json')));
router.post('/groups', (request, response) => { const group = { _id: `group-${Date.now()}`, name: request.body.name, description: request.body.description || '', category: request.body.category || 'General', members: 1 }; const groups = readCollection('groups.json'); writeCollection('groups.json', [group, ...groups]); return response.status(201).json(group); });
router.post('/groups/:id/join', (request, response) => { const groups = readCollection('groups.json'); const index = groups.findIndex((group) => group._id === request.params.id); if (index === -1) return response.status(404).json({ message: 'Group not found.' }); groups[index].members += 1; writeCollection('groups.json', groups); return response.json(groups[index]); });

router.post('/video-rooms', (request, response) => { const room = `skillswap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; return response.status(201).json({ room, url: `https://meet.jit.si/${room}` }); });

router.post('/skills', async (request, response) => {
  const skill = request.body;
  if (!process.env.MONGODB_URI) {
    const created = { ...skill, _id: `local-${Date.now()}`, teacher: { ...skill.teacher, exchanges: 0, rating: 5 }, moderationStatus: 'pending', featured: false, moderationNote: '', moderatedAt: null, createdAt: new Date().toISOString() };
    localSkills = [created, ...localSkills];
    return response.status(201).json(created);
  }
  return response.status(201).json(await Skill.create({ ...skill, moderationStatus: 'pending', featured: false }));
});

router.get('/platform/status', async (_request, response) => {
  return response.json({
    maintenanceMode: await getAdminSetting('maintenanceMode', false),
    registrationEnabled: await getAdminSetting('registrationEnabled', true),
    announcement: await getAdminSetting('announcement', { enabled: false, title: '', message: '' })
  });
});

router.post('/profiles', async (request, response) => {
  if (databaseRequired(response)) return;
  if (await getAdminSetting('registrationEnabled', true) === false) return response.status(403).json({ message: 'Registration is currently disabled by an administrator.' });
  if (await getAdminSetting('maintenanceMode', false) === true) return response.status(503).json({ message: 'SkillSwap is currently under maintenance. Please try again later.' });
  const { name, email, password, teaches = [], wants = [] } = request.body;
  if (!name || !email || !password || password.length < 8) {
    return response.status(400).json({ message: 'Name, email and a password of at least 8 characters are required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, 12);
  const profileData = { name: name.trim(), email: normalizedEmail, passwordHash, teaches, wants };

  if (!process.env.MONGODB_URI) {
    const profiles = readProfiles();
    if (profiles.some((profile) => profile.email === normalizedEmail)) {
      return response.status(409).json({ message: 'An account with this email already exists.' });
    }
    const created = { ...profileData, _id: `local-${Date.now()}`, createdAt: new Date().toISOString() };
    const token = createVerificationToken(normalizedEmail);
    try {
      await sendVerificationEmail(normalizedEmail, token);
    } catch (error) {
      return response.status(503).json({ message: error.message || 'Email service is unavailable. Please try again later.' });
    }
    writeProfiles([created, ...profiles]);
    await syncProfileSkills(created);
    return response.status(201).json({ message: 'Account created. Check your email to verify it.', verificationRequired: true, email: created.email, developmentToken: mailer ? undefined : token });
  }

  try {
    const created = await Profile.create(profileData);
    const token = createVerificationToken(normalizedEmail);
    try {
      await sendVerificationEmail(normalizedEmail, token);
    } catch (error) {
      await Profile.deleteOne({ _id: created._id });
      return response.status(503).json({ message: error.message || 'Email service is unavailable. Please try again later.' });
    }
    await syncProfileSkills(created.toObject());
    return response.status(201).json({ message: 'Account created. Check your email to verify it.', verificationRequired: true, email: created.email });
  } catch (error) {
    if (error.code === 11000) return response.status(409).json({ message: 'An account with this email already exists.' });
    return response.status(500).json({ message: 'Could not create profile. Please try again.' });
  }
});

router.delete('/profiles/:email', async (request, response) => {
  if (!await requireAuth(request, response)) return;
  const email = decodeURIComponent(request.params.email).toLowerCase();
  if (!sameUser(request, email)) return response.status(403).json({ message: 'You can only delete your own account.' });
  if (process.env.MONGODB_URI) {
    const deleted = await Profile.findOneAndDelete({ email }).lean();
    if (!deleted) return response.status(404).json({ message: 'Profile not found.' });
    await Skill.deleteMany({ 'teacher.email': email });
    return response.json({ message: 'Account deleted successfully.' });
  }
  const profiles = readProfiles();
  const next = profiles.filter((profile) => profile.email !== email);
  if (next.length === profiles.length) return response.status(404).json({ message: 'Profile not found.' });
  writeProfiles(next);
  localSkills = localSkills.filter((skill) => String(skill.teacher?.email || '').toLowerCase() !== email);
  return response.json({ message: 'Account deleted successfully.' });
});

router.post('/reports', (request, response) => {
  const { reporterEmail, reportedEmail, reason, details = '', category = 'Other', priority = 'medium' } = request.body;
  if (!reporterEmail || !reportedEmail || !reason) return response.status(400).json({ message: 'Reporter, reported user and reason are required.' });
  const now = new Date().toISOString();
  const safePriority = ['low', 'medium', 'high'].includes(String(priority).toLowerCase()) ? String(priority).toLowerCase() : 'medium';
  const report = { _id: `report-${Date.now()}`, reporterEmail, reportedEmail, reason, details, category, priority: safePriority, assignedTo: '', internalNotes: [], status: 'open', createdAt: now, updatedAt: now, history: [{ action: 'created', status: 'open', at: now, actor: 'system' }] };
  const reports = readCollection('reports.json');
  writeCollection('reports.json', [report, ...reports]);
  return response.status(201).json({ message: 'Report submitted. Our team will review it.', report });
});

router.post('/blocks', (request, response) => {
  const { blockerEmail, blockedEmail } = request.body;
  if (!blockerEmail || !blockedEmail) return response.status(400).json({ message: 'Both account emails are required.' });
  const blocks = readCollection('blocks.json');
  if (!blocks.some((block) => block.blockerEmail === blockerEmail && block.blockedEmail === blockedEmail)) writeCollection('blocks.json', [{ blockerEmail, blockedEmail, createdAt: new Date().toISOString() }, ...blocks]);
  return response.json({ message: 'User blocked.' });
});

router.get('/admin/reports', async (request, response) => {
  if (!await requireAdmin(request, response)) return;
  const reports = readCollection('reports.json');
  return response.json(reports.map((report) => ({
    ...report,
    priority: report.priority || 'medium',
    category: report.category || 'Other',
    assignedTo: report.assignedTo || '',
    internalNotes: Array.isArray(report.internalNotes) ? report.internalNotes : [],
    history: Array.isArray(report.history) && report.history.length ? report.history : [{ action: 'legacy', status: report.status || 'open', at: report.createdAt, actor: 'system' }]
  })));
});

router.get('/admin/stats', async (request, response) => {
  if (!await requireAdmin(request, response)) return;
  if (process.env.MONGODB_URI) {
    const [total, verified, discoverable] = await Promise.all([
      Profile.countDocuments(),
      Profile.countDocuments({ emailVerified: true }),
      Profile.countDocuments(discoverableProfileQuery())
    ]);
    return response.json({ total, verified, discoverable });
  }
  const profiles = readProfiles();
  return response.json({
    total: profiles.length,
    verified: profiles.filter((profile) => profile.emailVerified).length,
    discoverable: profiles.filter(isDiscoverableProfile).length
  });
});

router.get('/admin/users', async (request, response) => {
  if (!await requireAdmin(request, response)) return;
  if (process.env.MONGODB_URI) {
    const profiles = await Profile.find({}).select('-passwordHash').sort({ createdAt: -1 }).lean();
    return response.json(profiles);
  }
  const profiles = readProfiles().sort((first, second) => new Date(second.createdAt || 0) - new Date(first.createdAt || 0));
  return response.json(profiles.map(({ passwordHash, ...profile }) => profile));
});

router.post('/admin/users/:id/send-verification', async (request, response) => {
  if (!await requireAdmin(request, response)) return;
  const lookup = decodeURIComponent(request.params.id);
  let profile;
  if (process.env.MONGODB_URI) {
    profile = await Profile.findOne(mongoose.isValidObjectId(lookup) ? { _id: lookup } : { email: lookup }).lean();
  } else {
    profile = readProfiles().find((item) => item._id === lookup || item.email === lookup);
  }
  if (!profile) return response.status(404).json({ message: 'Profile not found.' });
  const token = createVerificationToken(profile.email);
  try {
    await sendVerificationEmail(profile.email, token);
    const result = { message: 'Verification link sent to the user email.' };
    if (!mailer && !brevoApiKey) result.developmentToken = token;
    return response.json(result);
  } catch (error) {
    return response.status(503).json({ message: error.message || 'Could not send verification email.' });
  }
});

router.put('/admin/users/:id', async (request, response) => {
  if (!await requireAdmin(request, response)) return;
  const lookup = decodeURIComponent(request.params.id);
  const { name, email, location = '', bio = '', teaches = [], wants = [], profileVisible, allowMessages, verified, blockedEmails = [], accountBlocked, suspendedUntil } = request.body;
  const safeProfile = {
    ...(name !== undefined && { name: String(name).trim() }),
    ...(email !== undefined && { email: String(email).trim().toLowerCase() }),
    ...(location !== undefined && { location: String(location).trim() }),
    ...(bio !== undefined && { bio: String(bio).trim() }),
    ...(teaches !== undefined && { teaches: Array.isArray(teaches) ? teaches.map((item) => String(item).trim()).filter(Boolean) : [] }),
    ...(wants !== undefined && { wants: Array.isArray(wants) ? wants.map((item) => String(item).trim()).filter(Boolean) : [] }),
    ...(profileVisible !== undefined && { profileVisible: Boolean(profileVisible) }),
    ...(allowMessages !== undefined && { allowMessages: Boolean(allowMessages) }),
    ...(verified !== undefined && { verified: Boolean(verified), emailVerified: Boolean(verified) }),
    ...(blockedEmails !== undefined && { blockedEmails: Array.isArray(blockedEmails) ? blockedEmails.map((item) => String(item).trim().toLowerCase()).filter(Boolean) : [] }),
    ...(accountBlocked !== undefined && { accountBlocked: Boolean(accountBlocked) }),
    ...(suspendedUntil !== undefined && { suspendedUntil: suspendedUntil ? new Date(suspendedUntil) : null })
  };

  if (!process.env.MONGODB_URI) {
    const profiles = readProfiles();
    const index = profiles.findIndex((profile) => profile._id === lookup || profile.email === lookup);
    if (index === -1) return response.status(404).json({ message: 'Profile not found.' });
    const previousEmail = profiles[index].email;
    const updated = { ...profiles[index], ...safeProfile, updatedAt: new Date().toISOString() };
    await recordAdminLog(request, { action: 'user_updated', targetType: 'user', targetId: updated._id || updated.email, details: 'User profile or moderation settings updated.' });
    const nextProfiles = [...profiles]; nextProfiles[index] = updated; writeProfiles(nextProfiles);
    await syncProfileSkills(updated, previousEmail);
    return response.json(updated);
  }

  const query = mongoose.isValidObjectId(lookup) ? { _id: lookup } : { email: lookup };
  const existing = await Profile.findOne(query).select('email').lean();
  if (!existing) return response.status(404).json({ message: 'Profile not found.' });
  const updated = await Profile.findOneAndUpdate(query, { ...safeProfile, updatedAt: new Date() }, { new: true, runValidators: true });
  if (!updated) return response.status(404).json({ message: 'Profile not found.' });
  await syncProfileSkills(updated.toObject(), existing.email);
  await recordAdminLog(request, { action: 'user_updated', targetType: 'user', targetId: updated._id || updated.email, details: 'User profile or moderation settings updated.' });
  return response.json(updated);
});

router.get('/admin/users/:id/activity', async (request, response) => {
  if (!await requireAdmin(request, response)) return;
  const lookup = decodeURIComponent(request.params.id);
  let profile;
  if (process.env.MONGODB_URI) profile = await Profile.findOne(mongoose.isValidObjectId(lookup) ? { _id: lookup } : { email: lookup }).select('email').lean();
  else profile = readProfiles().find((item) => item._id === lookup || item.email === lookup);
  if (!profile) return response.status(404).json({ message: 'Profile not found.' });
  const email = String(profile.email).toLowerCase();
  const events = [];
  const exchanges = readCollection('exchanges.json');
  exchanges.filter((item) => [item.requesterEmail, item.ownerEmail].some((value) => String(value || '').toLowerCase() === email)).forEach((item) => events.push({ type: 'exchange', title: item.skillTitle || 'Skill exchange', detail: `${item.status || 'pending'} exchange`, createdAt: item.createdAt, id: item._id }));
  readMessages().filter((item) => [item.senderEmail, item.recipientEmail].some((value) => String(value || '').toLowerCase() === email)).forEach((item) => events.push({ type: 'message', title: 'Message activity', detail: item.message || 'Message sent', createdAt: item.createdAt, id: item._id }));
  readCollection('reports.json').filter((item) => [item.reporterEmail, item.reportedEmail].some((value) => String(value || '').toLowerCase() === email)).forEach((item) => events.push({ type: 'report', title: item.reason || 'Report', detail: item.status || 'open', createdAt: item.createdAt, id: item._id }));
  readCollection('reviews.json').filter((item) => [item.reviewerEmail, item.recipientEmail].some((value) => String(value || '').toLowerCase() === email)).forEach((item) => events.push({ type: 'review', title: 'Review activity', detail: item.text || `${item.rating || 0}/5 rating`, createdAt: item.createdAt, id: item._id }));
  const skills = process.env.MONGODB_URI
    ? await Skill.find({ $or: [{ 'teacher.email': email }, { teacher: { $exists: true } }] }).select('title category createdAt teacher').lean()
    : localSkills;
  skills.filter((item) => String(item.teacher?.email || '').toLowerCase() === email || String(item.teacher?.name || '').toLowerCase() === String(profile.name || '').toLowerCase()).forEach((item) => events.push({ type: 'skill', title: item.title || 'Skill', detail: item.category || 'Skill listed', createdAt: item.createdAt, id: item._id }));
  events.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return response.json(events.slice(0, 100));
});

router.delete('/admin/users/:id', async (request, response) => {
  if (!await requireAdmin(request, response)) return;
  const lookup = decodeURIComponent(request.params.id);

  if (!process.env.MONGODB_URI) {
    const profiles = readProfiles();
    const deleted = profiles.find((profile) => profile._id === lookup || profile.email === lookup);
    const next = profiles.filter((profile) => profile._id !== lookup && profile.email !== lookup);
    if (!deleted) return response.status(404).json({ message: 'Profile not found.' });
    writeProfiles(next);
    localSkills = localSkills.filter((skill) => String(skill.teacher?.email || '').toLowerCase() !== String(deleted.email || '').toLowerCase());
    await recordAdminLog(request, { action: 'user_deleted', targetType: 'user', targetId: lookup, details: 'User permanently deleted.' });
    return response.json({ message: 'User deleted successfully.' });
  }

  const query = mongoose.isValidObjectId(lookup) ? { _id: lookup } : { email: lookup };
  const deleted = await Profile.findOneAndDelete(query).lean();
  if (!deleted) return response.status(404).json({ message: 'Profile not found.' });
  await Skill.deleteMany({ 'teacher.email': String(deleted.email || '').toLowerCase() });
  await recordAdminLog(request, { action: 'user_deleted', targetType: 'user', targetId: lookup, details: 'User permanently deleted.' });
  return response.json({ message: 'User deleted successfully.' });
});

router.post('/auth/login', async (request, response) => {
  if (databaseRequired(response)) return;
  const { email, password } = request.body;
  if (!email || !password) return response.status(400).json({ message: 'Email and password are required.' });
  const normalizedEmail = email.trim().toLowerCase();

  if (!process.env.MONGODB_URI) {
    const profile = readProfiles().find((item) => item.email === normalizedEmail);
    if (!profile || !(await bcrypt.compare(password, profile.passwordHash))) {
      return response.status(401).json({ message: 'Invalid email or password.' });
    }
    if (profile.accountBlocked) return response.status(403).json({ message: 'This account has been blocked by an administrator.' });
    if (profile.suspendedUntil && new Date(profile.suspendedUntil).getTime() > Date.now()) return response.status(403).json({ message: `This account is suspended until ${new Date(profile.suspendedUntil).toLocaleString()}.` });
    if (!profile.emailVerified) return response.status(403).json({ message: 'Please verify your email before logging in.' });
    return response.json({ message: 'Login successful.', profile: publicProfile(profile), sessionToken: createSessionToken(profile.email) });
  }

  const profile = await Profile.findOne({ email: normalizedEmail }).select('+passwordHash');
  if (!profile || !(await bcrypt.compare(password, profile.passwordHash))) {
    return response.status(401).json({ message: 'Invalid email or password.' });
  }
  if (profile.accountBlocked) return response.status(403).json({ message: 'This account has been blocked by an administrator.' });
  if (profile.suspendedUntil && new Date(profile.suspendedUntil).getTime() > Date.now()) return response.status(403).json({ message: `This account is suspended until ${new Date(profile.suspendedUntil).toLocaleString()}.` });
  if (!profile.emailVerified) return response.status(403).json({ message: 'Please verify your email before logging in.' });
  return response.json({ message: 'Login successful.', profile: publicProfile(profile) });
});

router.post('/auth/change-password', async (request, response) => {
  if (!await requireAuth(request, response)) return;
  const { currentPassword, newPassword } = request.body;
  if (!currentPassword || !newPassword || newPassword.length < 8) return response.status(400).json({ message: 'Current password and a new password of 8+ characters are required.' });
  const normalizedEmail = request.user.email;
  if (!process.env.MONGODB_URI) {
    const profiles = readProfiles();
    const index = profiles.findIndex((profile) => profile.email === normalizedEmail);
    if (index === -1 || !(await bcrypt.compare(currentPassword, profiles[index].passwordHash))) return response.status(401).json({ message: 'Current password is incorrect.' });
    profiles[index].passwordHash = await bcrypt.hash(newPassword, 12);
    writeProfiles(profiles);
    return response.json({ message: 'Password changed successfully.' });
  }
  const profile = await Profile.findOne({ email: normalizedEmail }).select('+passwordHash');
  if (!profile || !(await bcrypt.compare(currentPassword, profile.passwordHash))) return response.status(401).json({ message: 'Current password is incorrect.' });
  profile.passwordHash = await bcrypt.hash(newPassword, 12);
  await profile.save();
  return response.json({ message: 'Password changed successfully.' });
});

router.post('/auth/forgot-password', async (request, response) => {
  const { email } = request.body;
  if (!email) return response.status(400).json({ message: 'Email is required.' });
  try {
    const token = `reset-${randomBytes(32).toString('hex')}`;
    const tokens = readCollection('resetTokens.json').filter((item) => item.expiresAt > Date.now());
    writeCollection('resetTokens.json', [{ token, email: email.trim().toLowerCase(), expiresAt: Date.now() + 15 * 60 * 1000 }, ...tokens]);
    if (process.env.MONGODB_URI) {
      const profile = await Profile.findOne({ email: email.trim().toLowerCase() });
      if (!profile) return response.json({ message: 'If the account exists, reset instructions are ready.' });
    }
    await sendResetEmail(email.trim().toLowerCase(), token);
    return response.json({ message: 'If the account exists, reset instructions are ready.', developmentToken: process.env.NODE_ENV === 'production' || mailer ? undefined : token });
  } catch (error) {
    return response.status(503).json({ message: emailServiceMessage(error) });
  }
});

router.post('/auth/reset-password', async (request, response) => {
  const { token, newPassword } = request.body;
  const tokens = readCollection('resetTokens.json');
  const record = tokens.find((item) => item.token === token && item.expiresAt > Date.now());
  if (!record || !newPassword || newPassword.length < 8) return response.status(400).json({ message: 'Reset token is invalid or expired.' });
  if (process.env.MONGODB_URI) {
    const profile = await Profile.findOne({ email: record.email });
    if (!profile) return response.status(404).json({ message: 'Profile not found.' });
    profile.passwordHash = await bcrypt.hash(newPassword, 12);
    await profile.save();
  } else {
    const profiles = readProfiles();
    const index = profiles.findIndex((profile) => profile.email === record.email);
    if (index === -1) return response.status(404).json({ message: 'Profile not found.' });
    profiles[index].passwordHash = await bcrypt.hash(newPassword, 12);
    writeProfiles(profiles);
  }
  writeCollection('resetTokens.json', tokens.filter((item) => item.token !== token));
  return response.json({ message: 'Password reset successfully.' });
});

router.put('/profiles/:id', async (request, response) => {
  if (!await requireAuth(request, response)) return;
  const { name, email, avatar = '', location = '', bio = '', teaches = [], wants = [], profileVisible = true, allowMessages = true } = request.body;
  if (!name || !email) return response.status(400).json({ message: 'Name and email are required.' });
  const lookup = decodeURIComponent(request.params.id);
  if (!sameUser(request, lookup)) return response.status(403).json({ message: 'You can only update your own profile.' });
  const normalizedEmail = email.trim().toLowerCase();
  if (!Array.isArray(teaches) || !Array.isArray(wants)) return response.status(400).json({ message: 'Teaches and wants must be arrays.' });
  const profileData = { name: name.trim(), email: normalizedEmail, avatar, location, bio, teaches, wants, profileVisible: Boolean(profileVisible), allowMessages: Boolean(allowMessages) };

  if (!process.env.MONGODB_URI) {
    const profiles = readProfiles();
    const index = profiles.findIndex((profile) => profile.email === request.user.email);
    if (index === -1) return response.status(404).json({ message: 'Profile not found.' });
    if (profiles.some((profile, profileIndex) => profileIndex !== index && profile.email === normalizedEmail)) return response.status(409).json({ message: 'An account with this email already exists.' });
    const previousEmail = profiles[index].email;
    const updated = { ...profiles[index], ...profileData, updatedAt: new Date().toISOString() };
    writeProfiles(profiles.toSpliced(index, 1, updated));
    await syncProfileSkills(updated, previousEmail);
    return response.json({ ...publicProfile(updated), sessionToken: createSessionToken(normalizedEmail) });
  }

  if (normalizedEmail !== request.user.email) {
    const duplicate = await Profile.findOne({ email: normalizedEmail }).select('_id').lean();
    if (duplicate) return response.status(409).json({ message: 'An account with this email already exists.' });
  }
  const updated = await Profile.findOneAndUpdate({ email: request.user.email }, profileData, { new: true, runValidators: true });
  if (!updated) return response.status(404).json({ message: 'Profile not found.' });
  await syncProfileSkills(updated.toObject(), request.user.email);
  return response.json({ ...publicProfile(updated), sessionToken: createSessionToken(normalizedEmail) });
});

router.post('/exchanges', async (request, response) => {
  if (!await requireAuth(request, response)) return;
  const requesterEmail = request.user.email;
  const ownerEmail = String(request.body.ownerEmail || '').trim().toLowerCase();
  if (!ownerEmail || ownerEmail === requesterEmail) return response.status(400).json({ message: 'A different exchange partner is required.' });
  const emails = await discoverableEmails();
  if (!emails.has(requesterEmail) || !emails.has(ownerEmail)) return response.status(403).json({ message: 'Exchanges are available only between verified community members.' });
  const now = new Date().toISOString();
  const exchange = {
    _id: `exchange-${Date.now()}-${randomBytes(6).toString('hex')}`,
    ...request.body,
    requesterEmail,
    ownerEmail,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    statusHistory: [{ status: 'pending', at: now, source: 'system' }]
  };
  const exchanges = readCollection('exchanges.json');
  writeCollection('exchanges.json', [exchange, ...exchanges]);
  return response.status(201).json(exchange);
});

router.get('/exchanges/:email', async (request, response) => {
  if (!await requireAuth(request, response)) return;
  const email = decodeURIComponent(request.params.email).toLowerCase();
  if (!sameUser(request, email)) return response.status(403).json({ message: 'You can only view your own exchanges.' });
  const emails = await discoverableEmails();
  return response.json(readCollection('exchanges.json').filter((item) => (item.requesterEmail === email || item.ownerEmail === email) && hasDiscoverableParticipants(item, emails, ['requesterEmail', 'ownerEmail'])));
});

router.patch('/exchanges/:id', async (request, response) => {
  if (!await requireAuth(request, response)) return;
  const exchanges = readCollection('exchanges.json');
  const index = exchanges.findIndex((item) => item._id === request.params.id);
  if (index === -1) return response.status(404).json({ message: 'Exchange not found.' });
  const exchange = exchanges[index];
  const actor = request.user.email;
  if (![String(exchange.requesterEmail || '').toLowerCase(), String(exchange.ownerEmail || '').toLowerCase()].includes(actor)) return response.status(403).json({ message: 'You are not a participant in this exchange.' });
  const allowedTransitions = {
    pending: ['accepted', 'rejected'],
    accepted: ['completed', 'rejected'],
    rejected: [],
    completed: []
  };
  const nextStatus = String(request.body.status || '').toLowerCase();
  const previous = String(exchange.status || 'pending').toLowerCase();
  if (!allowedTransitions[previous]?.includes(nextStatus)) return response.status(400).json({ message: `Invalid exchange status transition from ${previous} to ${nextStatus}.` });
  const now = new Date().toISOString();
  const history = Array.isArray(exchange.statusHistory) ? exchange.statusHistory : [{ status: previous, at: exchange.createdAt || now, source: 'legacy' }];
  history.push({ status: nextStatus, at: now, source: 'participant', actor });
  exchanges[index] = { ...exchange, status: nextStatus, updatedAt: now, statusHistory: history };
  writeCollection('exchanges.json', exchanges);
  return response.json(exchanges[index]);
});

router.patch('/exchanges/:id/schedule', async (request, response) => {
  if (!await requireAuth(request, response)) return;
  const exchanges = readCollection('exchanges.json');
  const index = exchanges.findIndex((item) => item._id === request.params.id);
  if (index === -1) return response.status(404).json({ message: 'Exchange not found.' });
  const exchange = exchanges[index];
  const actor = request.user.email;
  if (![String(exchange.requesterEmail || '').toLowerCase(), String(exchange.ownerEmail || '').toLowerCase()].includes(actor)) return response.status(403).json({ message: 'You are not a participant in this exchange.' });
  if (!['pending', 'accepted'].includes(String(exchange.status || 'pending').toLowerCase())) return response.status(400).json({ message: 'Only pending or accepted exchanges can be scheduled.' });
  const meetingLink = String(request.body.meetingLink || '').trim();
  if (meetingLink && !/^https:\/\//i.test(meetingLink)) return response.status(400).json({ message: 'Meeting link must use HTTPS.' });
  exchanges[index] = { ...exchange, scheduledAt: request.body.scheduledAt || '', meetingLink };
  writeCollection('exchanges.json', exchanges);
  return response.json(exchanges[index]);
});

router.post('/reviews', async (request, response) => {
  const { reviewerEmail, reviewerName, recipientEmail, rating, text } = request.body;
  if (!reviewerEmail || !recipientEmail || !rating || !text?.trim() || rating < 1 || rating > 5) return response.status(400).json({ message: 'Reviewer, recipient, rating and review text are required.' });
  const emails = await discoverableEmails();
  if (!hasDiscoverableParticipants({ reviewerEmail, recipientEmail }, emails, ['reviewerEmail', 'recipientEmail'])) return response.status(403).json({ message: 'Reviews are available only for verified community members.' });
  const review = { _id: `review-${Date.now()}`, reviewerEmail, reviewerName, recipientEmail, rating: Number(rating), text: text.trim(), createdAt: new Date().toISOString() };
  const reviews = readCollection('reviews.json');
  writeCollection('reviews.json', [review, ...reviews]);
  return response.status(201).json(review);
});

router.get('/reviews/:email', async (request, response) => {
  const emails = await discoverableEmails();
  const email = decodeURIComponent(request.params.email).toLowerCase();
  return response.json(readCollection('reviews.json').filter((review) => review.recipientEmail === email && hasDiscoverableParticipants(review, emails, ['reviewerEmail', 'recipientEmail'])));
});

router.post('/messages', async (request, response) => {
  if (!await requireAuth(request, response)) return;
  const { recipientName, recipientEmail = '', message } = request.body;
  const senderEmail = request.user.email;
  const senderName = request.user.name;
  const normalizedRecipient = String(recipientEmail || '').trim().toLowerCase();
  if (!senderName || !normalizedRecipient || !message?.trim()) {
    return response.status(400).json({ message: 'Recipient and message are required.' });
  }
  const emails = await discoverableEmails();
  if (!hasDiscoverableParticipants({ senderEmail, recipientEmail: normalizedRecipient }, emails, ['senderEmail', 'recipientEmail'])) {
    return response.status(403).json({ message: 'Messaging is available only between verified community members.' });
  }
  const recipientProfile = process.env.MONGODB_URI
    ? await Profile.findOne({ email: normalizedRecipient }).select('email name allowMessages').lean()
    : readProfiles().find((profile) => profile.email === normalizedRecipient);
  if (recipientProfile?.allowMessages === false) return response.status(403).json({ message: 'This user has disabled direct messages.' });
  const blocks = readCollection('blocks.json');
  if (blocks.some((block) => block.blockerEmail === normalizedRecipient && block.blockedEmail === senderEmail)) return response.status(403).json({ message: 'You cannot message this user.' });
  if (message.trim().length > 2000) return response.status(413).json({ message: 'Message is too long.' });
  const created = { _id: `message-${Date.now()}-${randomBytes(6).toString('hex')}`, senderName, senderEmail, recipientName: recipientProfile?.name || recipientName || 'SkillSwap member', recipientEmail: normalizedRecipient, message: message.trim(), status: 'sent', read: false, createdAt: new Date().toISOString() };
  const messages = readMessages();
  if (messages.some((item) => item.senderEmail === senderEmail && item.message === message.trim() && Date.now() - Date.parse(item.createdAt) < 30000)) return response.status(429).json({ message: 'Please wait before sending the same message again.' });
  writeMessages([created, ...messages]);
  const notifications = readCollection('notifications.json');
  writeCollection('notifications.json', [{ _id: `notification-${Date.now()}-${randomBytes(6).toString('hex')}`, email: normalizedRecipient, type: 'message', senderName, senderEmail, title: `${senderName} sent you a message`, read: false, createdAt: new Date().toISOString() }, ...notifications]);
  return response.status(201).json(created);
});

router.get('/messages/:email', async (request, response) => {
  if (!await requireAuth(request, response)) return;
  const email = decodeURIComponent(request.params.email).toLowerCase();
  if (!sameUser(request, email)) return response.status(403).json({ message: 'You can only view your own messages.' });
  const emails = await discoverableEmails();
  const profiles = process.env.MONGODB_URI
    ? new Map((await Profile.find({ email: { $in: [...emails] } }).select('email avatar').lean()).map((profile) => [profile.email, profile.avatar || '']))
    : new Map(readProfiles().map((profile) => [profile.email, profile.avatar || '']));
  return response.json(readMessages().filter((message) => (message.senderEmail === email || message.recipientEmail === email) && hasDiscoverableParticipants(message, emails, ['senderEmail', 'recipientEmail'])).map((message) => ({ ...message, senderAvatar: profiles.get(message.senderEmail) || '', recipientAvatar: profiles.get(message.recipientEmail) || '' })));
});

router.patch('/messages/:id/read', async (request, response) => {
  if (!await requireAuth(request, response)) return;
  const messages = readMessages();
  const index = messages.findIndex((message) => message._id === request.params.id);
  if (index === -1) return response.status(404).json({ message: 'Message not found.' });
  if (String(messages[index].recipientEmail || '').toLowerCase() !== request.user.email) return response.status(403).json({ message: 'You can only update messages sent to you.' });
  messages[index].read = true;
  writeMessages(messages);
  return response.json(messages[index]);
});

router.get('/notifications/:email', async (request, response) => {
  if (!await requireAuth(request, response)) return;
  const email = decodeURIComponent(request.params.email).toLowerCase();
  if (!sameUser(request, email)) return response.status(403).json({ message: 'You can only view your own notifications.' });
  const emails = await discoverableEmails();
  return response.json(readCollection('notifications.json').filter((notification) => notification.email === email && emails.has(notification.email)));
});

router.patch('/notifications/:email/read', async (request, response) => {
  if (!await requireAuth(request, response)) return;
  const email = decodeURIComponent(request.params.email).toLowerCase();
  if (!sameUser(request, email)) return response.status(403).json({ message: 'You can only update your own notifications.' });
  const notifications = readCollection('notifications.json').map((notification) => notification.email === email ? { ...notification, read: true } : notification);
  writeCollection('notifications.json', notifications);
  return response.json({ ok: true });
});

router.post('/contact', (request, response) => response.status(201).json({ message: 'Thanks, we will be in touch soon.', ...request.body }));

const adminIdentity = (request) => request.adminSession?.admin || request.headers['x-admin-name'] || process.env.ADMIN_NAME || 'Admin';

async function recordAdminLog(request, { action, targetType = '', targetId = '', details = '', success = true } = {}) {
  const entry = { action, admin: adminIdentity(request), targetType, targetId: String(targetId || ''), details, success, createdAt: new Date().toISOString() };
  if (process.env.MONGODB_URI) {
    await AdminLog.create(entry);
  } else {
    const logs = readCollection('adminLogs.json');
    writeCollection('adminLogs.json', [entry, ...logs].slice(0, 1000));
  }
  return entry;
}

function createAdminSession(adminName) {
  const token = randomBytes(32).toString('hex');
  adminSessions.set(token, { admin: adminName || 'Admin', createdAt: Date.now() });
  return token;
}

async function requireAdmin(request, response) {
  const token = String(request.headers['x-admin-session'] || '');
  const session = adminSessions.get(token);
  if (!session) {
    response.status(403).json({ message: 'Admin session required. Please sign in again.' });
    return false;
  }
  if (Date.now() - session.createdAt > ADMIN_SESSION_TTL_MS) {
    adminSessions.delete(token);
    response.status(403).json({ message: 'Admin session expired. Please sign in again.' });
    return false;
  }
  request.adminSession = session;
  return true;
}

router.post('/admin/auth', async (request, response) => {
  const providedKey = String(request.headers['x-admin-key'] || '');
  const storedHash = await getAdminSetting('adminKeyHash', '');
  let valid = Boolean(storedHash && providedKey && await bcrypt.compare(providedKey, storedHash));
  if (!storedHash) {
    const bootstrapKey = process.env.ADMIN_KEY || '';
  if (!bootstrapKey) return response.status(503).json({ message: 'Admin authentication is not configured. Set ADMIN_KEY or configure the admin key hash.' });
    valid = providedKey === bootstrapKey;
  }
  if (!valid) {
    await recordAdminLog(request, { action: 'admin_login_failed', details: 'Invalid admin key.', success: false });
    return response.status(403).json({ message: 'Admin access required.' });
  }
  const profile = await getAdminSetting('adminProfile', { name: process.env.ADMIN_NAME || 'Admin' });
  const sessionToken = createAdminSession(profile?.name || process.env.ADMIN_NAME || 'Admin');
  request.adminSession = adminSessions.get(sessionToken);
  await recordAdminLog(request, { action: 'admin_login', details: 'Admin authenticated successfully.' });
  return response.json({ ok: true, message: 'Admin authenticated.', sessionToken, expiresIn: ADMIN_SESSION_TTL_MS });
});

router.post('/admin/logout', async (request, response) => {
  if (!await requireAdmin(request, response)) return;
  const token = String(request.headers['x-admin-session'] || '');
  await recordAdminLog(request, { action: 'admin_logout', details: 'Admin session ended.' });
  adminSessions.delete(token);
  return response.json({ ok: true });
});

router.get('/admin/logs', async (request, response) => {
  if (!await requireAdmin(request, response)) return;
  if (process.env.MONGODB_URI) {
    return response.json(await AdminLog.find({}).sort({ createdAt: -1 }).limit(500).lean());
  }
  return response.json(readCollection('adminLogs.json').sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 500));
});

router.get('/admin/notifications', async (request, response) => {
  if (!await requireAdmin(request, response)) return;

  const notifications = [];
  const add = (type, title, detail, createdAt, targetId = '') => {
    if (!createdAt) return;
    notifications.push({
      id: `${type}-${targetId || createdAt}-${String(title).slice(0, 20)}`,
      type,
      title,
      detail,
      createdAt: new Date(createdAt).toISOString(),
      targetId
    });
  };

  const reports = readCollection('reports.json');
  reports.forEach((item) => add('report', 'New report received', item.reason || 'A new report needs review.', item.createdAt, item._id));

  const exchanges = readCollection('exchanges.json');
  exchanges.forEach((item) => add('exchange', 'New exchange requested', `${item.skillTitle || 'Skill exchange'} · ${item.requesterEmail || 'A user'}`, item.createdAt, item._id));

  if (process.env.MONGODB_URI) {
    const profiles = await Profile.find({}).select('email name createdAt').sort({ createdAt: -1 }).limit(100).lean();
    profiles.forEach((item) => add('user', 'New user registered', item.name || item.email || 'A new member joined SkillSwap.', item.createdAt, item._id));

    const skills = await Skill.find({}).select('title category createdAt').sort({ createdAt: -1 }).limit(100).lean();
    skills.forEach((item) => add('skill', 'New skill submitted', `${item.title || 'Untitled skill'} · ${item.category || 'Uncategorized'}`, item.createdAt, item._id));
  } else {
    readProfiles().forEach((item) => add('user', 'New user registered', item.name || item.email || 'A new member joined SkillSwap.', item.createdAt, item._id || item.email));
    localSkills.forEach((item) => add('skill', 'New skill submitted', `${item.title || 'Untitled skill'} · ${item.category || 'Uncategorized'}`, item.createdAt, item._id || item.id));
  }

  notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return response.json(notifications.slice(0, 100));
});

router.get('/admin/settings', async (request, response) => {
  if (!await requireAdmin(request, response)) return;
  return response.json({
    profile: await getAdminSetting('adminProfile', { name: 'SkillSwap Admin', email: '' }),
    dashboard: await getAdminSetting('dashboardPreferences', { compactMode: false, defaultSection: 'overview', refreshInterval: 0 }),
    maintenanceMode: await getAdminSetting('maintenanceMode', false),
    registrationEnabled: await getAdminSetting('registrationEnabled', true),
    announcement: await getAdminSetting('announcement', { enabled: false, title: '', message: '', updatedAt: null }),
    keyConfigured: Boolean(await getAdminSetting('adminKeyHash', ''))
  });
});

router.patch('/admin/settings', async (request, response) => {
  if (!await requireAdmin(request, response)) return;
  const body = request.body || {};
  if (body.profile) await setAdminSetting('adminProfile', { name: String(body.profile.name || '').trim() || 'SkillSwap Admin', email: String(body.profile.email || '').trim() });
  if (body.dashboard) await setAdminSetting('dashboardPreferences', { compactMode: Boolean(body.dashboard.compactMode), defaultSection: String(body.dashboard.defaultSection || 'overview'), refreshInterval: Number(body.dashboard.refreshInterval || 0) });
  if (body.maintenanceMode !== undefined) await setAdminSetting('maintenanceMode', Boolean(body.maintenanceMode));
  if (body.registrationEnabled !== undefined) await setAdminSetting('registrationEnabled', Boolean(body.registrationEnabled));
  if (body.announcement) await setAdminSetting('announcement', { enabled: Boolean(body.announcement.enabled), title: String(body.announcement.title || '').trim(), message: String(body.announcement.message || '').trim(), updatedAt: new Date().toISOString() });
  let replacementSessionToken = null;
  if (body.newAdminKey) {
    const newKey = String(body.newAdminKey).trim();
    if (newKey.length < 8) return response.status(400).json({ message: 'Admin key must be at least 8 characters.' });
    await setAdminSetting('adminKeyHash', await bcrypt.hash(newKey, 12));
    const currentToken = String(request.headers['x-admin-session'] || '');
    for (const token of adminSessions.keys()) {
      if (token !== currentToken) adminSessions.delete(token);
    }
    const profile = await getAdminSetting('adminProfile', { name: process.env.ADMIN_NAME || 'Admin' });
    replacementSessionToken = createAdminSession(profile?.name || process.env.ADMIN_NAME || 'Admin');
    adminSessions.delete(currentToken);
    request.adminSession = adminSessions.get(replacementSessionToken);
    await recordAdminLog(request, { action: 'admin_key_changed', details: 'Admin key was changed; active admin session rotated.' });
  }
  await recordAdminLog(request, { action: 'admin_settings_updated', details: 'Admin settings updated.' });
  return response.json({ ok: true, message: 'Admin settings saved.', ...(replacementSessionToken ? { sessionToken: replacementSessionToken, expiresIn: ADMIN_SESSION_TTL_MS } : {}) });
});

router.get('/admin/overview', async (request, response) => {
  if (!await requireAdmin(request, response)) return;
  await syncAllProfileSkills();
  const reports = readCollection('reports.json');
  const exchanges = readCollection('exchanges.json');
  let totalUsers = 0;
  let verifiedUsers = 0;
  let visibleUsers = 0;
  let skills = localSkills.length;

  if (process.env.MONGODB_URI) {
    [totalUsers, verifiedUsers, visibleUsers, skills] = await Promise.all([
      Profile.countDocuments(),
      Profile.countDocuments({ emailVerified: true }),
      Profile.countDocuments(discoverableProfileQuery()),
      Skill.countDocuments()
    ]);
  } else {
    const profiles = readProfiles();
    totalUsers = profiles.length;
    verifiedUsers = profiles.filter((profile) => profile.emailVerified || profile.verified).length;
    visibleUsers = profiles.filter(isDiscoverableProfile).length;
  }

  return response.json({
    totalUsers,
    verifiedUsers,
    visibleUsers,
    skills,
    exchanges: exchanges.length,
    openReports: reports.filter((report) => report.status === 'open').length
  });
});


router.get('/admin/analytics', async (request, response) => {
  if (!await requireAdmin(request, response)) return;
  await syncAllProfileSkills();

  const profiles = process.env.MONGODB_URI
    ? await Profile.find({}).select('email createdAt').lean()
    : readProfiles().map(({ email, createdAt }) => ({ email, createdAt }));
  const skills = process.env.MONGODB_URI
    ? await Skill.find({}).select('createdAt').lean()
    : localSkills.map(({ createdAt }) => ({ createdAt }));
  const exchanges = readCollection('exchanges.json');
  const reports = readCollection('reports.json');
  const messages = readMessages();

  const now = new Date();
  const startOfDay = (date) => {
    const value = new Date(date);
    value.setHours(0, 0, 0, 0);
    return value;
  };
  const dayKey = (date) => startOfDay(date).toISOString().slice(0, 10);
  const weekStart = (date) => {
    const value = startOfDay(date);
    const day = value.getDay();
    value.setDate(value.getDate() - day);
    return value;
  };
  const weekKey = (date) => weekStart(date).toISOString().slice(0, 10);
  const monthKey = (date) => {
    const value = new Date(date);
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
  };
  const validDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const countBetween = (items, from, to) => items.reduce((count, item) => {
    const date = validDate(item.createdAt);
    return count + (date && date >= from && date < to ? 1 : 0);
  }, 0);
  const lastDays = (count) => Array.from({ length: count }, (_, index) => {
    const date = startOfDay(now);
    date.setDate(date.getDate() - (count - 1 - index));
    return date;
  });
  const lastWeeks = (count) => Array.from({ length: count }, (_, index) => {
    const date = weekStart(now);
    date.setDate(date.getDate() - 7 * (count - 1 - index));
    return date;
  });
  const lastMonths = (count) => Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1);
    return date;
  });

  const buildSeries = (starts, keyFn, labelFn) => starts.map((start, index) => {
    const end = new Date(start);
    if (keyFn === dayKey) end.setDate(end.getDate() + 1);
    else if (keyFn === weekKey) end.setDate(end.getDate() + 7);
    else end.setMonth(end.getMonth() + 1);
    return {
      key: keyFn(start),
      label: labelFn(start),
      users: countBetween(profiles, start, end),
      skills: countBetween(skills, start, end),
      exchanges: countBetween(exchanges, start, end),
      reports: countBetween(reports, start, end),
      growth: profiles.filter((item) => {
        const date = validDate(item.createdAt);
        return date && date < end;
      }).length
    };
  });

  const daily = buildSeries(lastDays(30), dayKey, (date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  const weekly = buildSeries(lastWeeks(12), weekKey, (date) => `Week of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`);
  const monthly = buildSeries(lastMonths(12), monthKey, (date) => date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));

  const activeSince = new Date(now);
  activeSince.setDate(activeSince.getDate() - 30);
  const activeEmails = new Set();
  [...exchanges, ...messages].forEach((item) => {
    const date = validDate(item.createdAt);
    if (!date || date < activeSince) return;
    ['requesterEmail', 'ownerEmail', 'senderEmail', 'recipientEmail'].forEach((field) => {
      if (item[field]) activeEmails.add(String(item[field]).toLowerCase());
    });
  });

  return response.json({
    generatedAt: now.toISOString(),
    activeUsers: activeEmails.size,
    daily,
    weekly,
    monthly
  });
});

router.get('/admin/skills', async (request, response) => {
  if (!await requireAdmin(request, response)) return;
  await syncAllProfileSkills();
  let skills = process.env.MONGODB_URI ? await Skill.find({}).sort({ createdAt: -1 }).lean() : localSkills;
  const normalized = skills.map((skill) => ({ ...skill, moderationStatus: skill.moderationStatus || 'pending', featured: Boolean(skill.featured) }));
  const duplicateKeys = new Map();
  normalized.forEach((skill) => {
    const key = String(skill.title || '').trim().toLowerCase();
    if (key) duplicateKeys.set(key, (duplicateKeys.get(key) || 0) + 1);
  });
  const items = normalized.map((skill) => {
    const title = String(skill.title || '').trim();
    const description = String(skill.description || '').trim();
    const duplicate = title && duplicateKeys.get(title.toLowerCase()) > 1;
    const lowQuality = title.length < 4 || description.length < 20;
    return { ...skill, moderationFlags: { duplicate: Boolean(duplicate), lowQuality: Boolean(lowQuality) } };
  });
  return response.json(items);
});

router.patch('/admin/skills/:id/moderation', async (request, response) => {
  if (!await requireAdmin(request, response)) return;
  const { status, featured = false, moderationNote = '' } = request.body;
  if (!['pending', 'approved', 'rejected'].includes(status)) return response.status(400).json({ message: 'Invalid moderation status.' });
  const lookup = decodeURIComponent(request.params.id);
  if (process.env.MONGODB_URI) {
    const updated = await Skill.findByIdAndUpdate(lookup, { moderationStatus: status, featured: Boolean(featured), moderationNote: String(moderationNote || ''), moderatedAt: new Date() }, { new: true }).lean();
    if (!updated) return response.status(404).json({ message: 'Skill not found.' });
    await recordAdminLog(request, { action: 'skill_moderation_updated', targetType: 'skill', targetId: lookup, details: 'Skill moderation status or featured state updated.' });
    return response.json(updated);
  }
  const index = localSkills.findIndex((skill) => skill._id === lookup);
  if (index === -1) return response.status(404).json({ message: 'Skill not found.' });
  localSkills[index] = { ...localSkills[index], moderationStatus: status, featured: Boolean(featured), moderationNote: String(moderationNote || ''), moderatedAt: new Date().toISOString() };
  await recordAdminLog(request, { action: 'skill_moderation_updated', targetType: 'skill', targetId: lookup, details: 'Skill moderation status or featured state updated.' });
  return response.json(localSkills[index]);
});

router.get('/admin/skill-categories', async (request, response) => {
  if (!await requireAdmin(request, response)) return;
  const categories = readCollection('skillCategories.json');
  return response.json(categories.length ? categories : ['Programming', 'Design', 'Languages', 'Business', 'Marketing', 'Music', 'Academic', 'Other']);
});

router.post('/admin/skill-categories', async (request, response) => {
  if (!await requireAdmin(request, response)) return;
  const name = String(request.body.name || '').trim();
  if (!name) return response.status(400).json({ message: 'Category name is required.' });
  const categories = readCollection('skillCategories.json');
  if (categories.some((item) => String(item).toLowerCase() === name.toLowerCase())) return response.status(409).json({ message: 'Category already exists.' });
  writeCollection('skillCategories.json', [...categories, name]);
  await recordAdminLog(request, { action: 'skill_category_added', targetType: 'category', targetId: name, details: 'Skill category added.' });
  return response.status(201).json(name);
});

router.delete('/admin/skill-categories/:name', async (request, response) => {
  if (!await requireAdmin(request, response)) return;
  const name = decodeURIComponent(request.params.name);
  const categories = readCollection('skillCategories.json');
  const next = categories.filter((item) => String(item).toLowerCase() !== name.toLowerCase());
  if (next.length === categories.length) return response.status(404).json({ message: 'Category not found.' });
  writeCollection('skillCategories.json', next);
  await recordAdminLog(request, { action: 'skill_category_deleted', targetType: 'category', targetId: name, details: 'Skill category deleted.' });
  return response.json({ ok: true });
});

router.get('/admin/skill-statistics', async (request, response) => {
  if (!await requireAdmin(request, response)) return;
  await syncAllProfileSkills();
  const skills = process.env.MONGODB_URI ? await Skill.find({}).lean() : localSkills;
  const stats = {
    total: skills.length,
    pending: skills.filter((s) => (s.moderationStatus || 'pending') === 'pending').length,
    approved: skills.filter((s) => s.moderationStatus === 'approved').length,
    rejected: skills.filter((s) => s.moderationStatus === 'rejected').length,
    featured: skills.filter((s) => s.featured).length,
    categories: [...new Set(skills.map((s) => s.category).filter(Boolean))].length,
    flaggedDuplicates: skills.length - new Set(skills.map((s) => String(s.title || '').trim().toLowerCase()).filter(Boolean)).size,
    lowQuality: skills.filter((s) => String(s.title || '').trim().length < 4 || String(s.description || '').trim().length < 20).length
  };
  return response.json(stats);
});

router.delete('/admin/skills/:id', async (request, response) => {
  if (!await requireAdmin(request, response)) return;
  const lookup = decodeURIComponent(request.params.id);
  if (process.env.MONGODB_URI) {
    const deleted = await Skill.findByIdAndDelete(lookup);
    if (!deleted) return response.status(404).json({ message: 'Skill not found.' });
    await recordAdminLog(request, { action: 'skill_deleted', targetType: 'skill', targetId: lookup, details: `Deleted skill ${deleted.title || lookup}.` });
    return response.json({ ok: true });
  }
  const index = localSkills.findIndex((skill) => skill._id === lookup);
  if (index === -1) return response.status(404).json({ message: 'Skill not found.' });
  const deleted = localSkills[index];
  localSkills = localSkills.filter((_, itemIndex) => itemIndex !== index);
  await recordAdminLog(request, { action: 'skill_deleted', targetType: 'skill', targetId: lookup, details: `Deleted skill ${deleted.title || lookup}.` });
  return response.json({ ok: true });
});

router.get('/admin/exchanges', async (request, response) => {
  if (!await requireAdmin(request, response)) return;
  const exchanges = readCollection('exchanges.json');
  const emails = [...new Set(exchanges.flatMap((item) => [item.requesterEmail, item.ownerEmail]).filter(Boolean))];
  let profiles = [];
  if (process.env.MONGODB_URI && emails.length) profiles = await Profile.find({ email: { $in: emails } }).select('name email location avatar verified emailVerified teaches wants').lean();
  else if (!process.env.MONGODB_URI && emails.length) profiles = readProfiles().filter((profile) => emails.includes(profile.email));
  const byEmail = new Map(profiles.map((profile) => [profile.email.toLowerCase(), publicProfile(profile)]));
  return response.json(exchanges.map((item) => {
    const requester = byEmail.get(String(item.requesterEmail || '').toLowerCase());
    const owner = byEmail.get(String(item.ownerEmail || '').toLowerCase());
    return {
      ...item,
      statusHistory: Array.isArray(item.statusHistory) && item.statusHistory.length ? item.statusHistory : [{ status: item.status || 'pending', at: item.updatedAt || item.createdAt, source: 'legacy' }],
      requester: requester ? { name: requester.name, email: requester.email, location: requester.location, avatar: requester.avatar, verified: requester.verified || requester.emailVerified, teaches: requester.teaches || [], wants: requester.wants || [] } : null,
      owner: owner ? { name: owner.name, email: owner.email, location: owner.location, avatar: owner.avatar, verified: owner.verified || owner.emailVerified, teaches: owner.teaches || [], wants: owner.wants || [] } : null
    };
  }));
});

router.patch('/admin/exchanges/:id', async (request, response) => {
  if (!await requireAdmin(request, response)) return;
  const exchanges = readCollection('exchanges.json');
  const index = exchanges.findIndex((item) => item._id === request.params.id);
  if (index === -1) return response.status(404).json({ message: 'Exchange not found.' });
  const allowed = ['pending', 'accepted', 'rejected', 'completed', 'cancelled'];
  if (!allowed.includes(request.body.status)) return response.status(400).json({ message: 'Invalid exchange status.' });
  const now = new Date().toISOString();
  const previous = exchanges[index].status || 'pending';
  const history = Array.isArray(exchanges[index].statusHistory) ? exchanges[index].statusHistory : [{ status: previous, at: exchanges[index].createdAt || now, source: 'legacy' }];
  if (previous !== request.body.status) history.push({ status: request.body.status, at: now, source: 'admin' });
  exchanges[index] = { ...exchanges[index], status: request.body.status, updatedAt: now, statusHistory: history };
  writeCollection('exchanges.json', exchanges);
  await recordAdminLog(request, { action: 'exchange_status_updated', targetType: 'exchange', targetId: exchanges[index]._id, details: `Status changed from ${previous} to ${request.body.status}.` });
  return response.json(exchanges[index]);
});

router.patch('/admin/reports/:id', async (request, response) => {
  if (!await requireAdmin(request, response)) return;
  const reports = readCollection('reports.json');
  const index = reports.findIndex((item) => item._id === request.params.id);
  if (index === -1) return response.status(404).json({ message: 'Report not found.' });
  const current = reports[index];
  const nextStatus = request.body.status || current.status || 'open';
  if (!['open', 'resolved', 'dismissed'].includes(nextStatus)) return response.status(400).json({ message: 'Invalid report status.' });
  const priority = request.body.priority && ['low', 'medium', 'high'].includes(request.body.priority) ? request.body.priority : (current.priority || 'medium');
  const category = request.body.category ? String(request.body.category).trim() : (current.category || 'Other');
  const assignedTo = request.body.assignedTo !== undefined ? String(request.body.assignedTo || '').trim() : (current.assignedTo || '');
  const note = request.body.internalNote !== undefined ? String(request.body.internalNote || '').trim() : '';
  const now = new Date().toISOString();
  const history = Array.isArray(current.history) ? current.history : [{ action: 'legacy', status: current.status || 'open', at: current.createdAt || now, actor: 'system' }];
  const changed = current.status !== nextStatus || current.priority !== priority || (current.assignedTo || '') !== assignedTo || (current.category || 'Other') !== category;
  if (changed) history.push({ action: 'updated', status: nextStatus, priority, category, assignedTo, at: now, actor: adminIdentity(request) });
  const internalNotes = Array.isArray(current.internalNotes) ? current.internalNotes : [];
  if (note) {
    internalNotes.push({ note, at: now, actor: adminIdentity(request) });
    history.push({ action: 'note_added', at: now, actor: adminIdentity(request) });
  }
  reports[index] = { ...current, status: nextStatus, priority, category, assignedTo, internalNotes, history, updatedAt: now, reviewedAt: nextStatus === 'open' ? current.reviewedAt : now };
  writeCollection('reports.json', reports);
  await recordAdminLog(request, { action: 'report_updated', targetType: 'report', targetId: current._id, details: `Report updated: ${nextStatus}, ${priority}, ${category}, assigned to ${assignedTo || 'unassigned'}.` });
  return response.json(reports[index]);
});

export default router;
