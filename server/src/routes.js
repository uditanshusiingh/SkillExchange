import express from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import Skill from './models/Skill.js';
import Profile from './models/Profile.js';
import Exchange from './models/Exchange.js';
import Review from './models/Review.js';
import { seedSkills } from './data/seedSkills.js';
import { readProfiles, writeProfiles } from './data/localProfiles.js';
import { readMessages, writeMessages } from './data/localMessages.js';
import { readCollection, writeCollection } from './data/localCollections.js';

const router = express.Router();
// Admin API enabled: deployed route group for SkillSwap control center.
let localSkills = seedSkills;

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
  const token = `verify-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const tokens = readCollection('resetTokens.json').filter((item) => item.type !== 'verify' || item.expiresAt > Date.now());
  writeCollection('resetTokens.json', [{ token, type: 'verify', email: email.trim().toLowerCase(), expiresAt: Date.now() + 24 * 60 * 60 * 1000 }, ...tokens]);
  return token;
}

function databaseRequired(response) {
  if (process.env.NODE_ENV === 'production' && !process.env.MONGODB_URI) {
    response.status(503).json({ message: 'Account service is not configured with MongoDB yet.' });
    return true;
  }
  return false;
}

function publicProfile(profile) {
  const { passwordHash: _passwordHash, ...safeProfile } = profile.toObject ? profile.toObject() : profile;
  return safeProfile;
}

function isDiscoverableProfile(profile) {
  return profile.email !== 'demo@gmail.com' && profile.profileVisible !== false;
}

function discoverableProfileQuery() {
  return { profileVisible: { $ne: false }, email: { $ne: 'demo@gmail.com' } };
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

function profileSkills(profiles) {
  return profiles.flatMap((profile) => (profile.teaches || []).filter(Boolean).map((title, index) => ({
    _id: `profile-skill-${profile._id || profile.email}-${index}`,
    title,
    category: 'Community skills',
    level: 'All levels',
    format: 'Flexible',
    description: profile.bio || `${profile.name} is open to sharing ${title}.`,
    teacher: { name: profile.name, email: profile.email, role: 'Community member', avatar: profile.avatar || profile.name.slice(0, 2).toUpperCase(), location: profile.location || 'Location not shared', rating: profile.rating || 0, exchanges: profile.exchanges || 0 },
    wants: profile.wants?.length ? `I want to learn ${profile.wants.join(', ')}` : 'Open to a useful skill exchange',
    color: ['#dbe8de', '#efe1c5', '#d9e5ed'][index % 3],
    availability: 'Flexible'
  })));
}

router.get('/skills', async (request, response) => {
  const { category, search, teach, wants, location, format, level, availability, page = 1, limit = 8, sort = 'newest' } = request.query;
  const pageNumber = Math.max(1, Number(page));
  const pageSize = Math.min(24, Math.max(1, Number(limit)));
  const genuineProfiles = process.env.MONGODB_URI
    ? await Profile.find(discoverableProfileQuery()).select('-passwordHash').limit(500)
    : readProfiles().filter(isDiscoverableProfile);
  const availableSkills = profileSkills(genuineProfiles);
  if (!process.env.MONGODB_URI) {
    const filtered = availableSkills.filter((skill) => {
      const matchesCategory = !category || category === 'All' || skill.category === category;
      const wantsMatch = !search || skill.wants.toLowerCase().includes(search.toLowerCase()) || skill.title.toLowerCase().includes(search.toLowerCase()) || skill.teacher.name.toLowerCase().includes(search.toLowerCase()) || skill.teacher.role.toLowerCase().includes(search.toLowerCase()) || skill.category.toLowerCase().includes(search.toLowerCase());
      const teachMatch = !teach || skill.title.toLowerCase().includes(teach.toLowerCase()) || skill.description.toLowerCase().includes(teach.toLowerCase());
      const wantsFieldMatch = !wants || skill.wants.toLowerCase().includes(wants.toLowerCase());
      const locationMatch = !location || skill.teacher.location.toLowerCase().includes(location.toLowerCase());
      const formatMatch = !format || skill.format.toLowerCase().includes(format.toLowerCase());
      const levelMatch = !level || skill.level === level;
      const availabilityMatch = !availability || (skill.availability || 'Flexible') === availability;
      return matchesCategory && wantsMatch && teachMatch && wantsFieldMatch && locationMatch && formatMatch && levelMatch && availabilityMatch;
    });
    const sorted = [...filtered].sort((first, second) => sort === 'rating' ? second.teacher.rating - first.teacher.rating : sort === 'newest' ? String(second._id).localeCompare(String(first._id)) : 0);
    return response.json({ items: sorted.slice((pageNumber - 1) * pageSize, pageNumber * pageSize), page: pageNumber, limit: pageSize, total: sorted.length, hasMore: pageNumber * pageSize < sorted.length });
  }
  const filtered = availableSkills.filter((skill) => {
    const text = `${skill.title} ${skill.description} ${skill.teacher.name} ${skill.wants} ${skill.category}`.toLowerCase();
    return (!category || category === 'All' || skill.category === category || category === 'Community skills') && (!search || text.includes(search.toLowerCase())) && (!teach || skill.title.toLowerCase().includes(teach.toLowerCase())) && (!wants || skill.wants.toLowerCase().includes(wants.toLowerCase())) && (!location || skill.teacher.location.toLowerCase().includes(location.toLowerCase())) && (!format || skill.format.toLowerCase().includes(format.toLowerCase())) && (!level || skill.level === level);
  });
  const sorted = [...filtered].sort((first, second) => sort === 'rating' ? second.teacher.rating - first.teacher.rating : sort === 'newest' ? String(second._id).localeCompare(String(first._id)) : 0);
  return response.json({ items: sorted.slice((pageNumber - 1) * pageSize, pageNumber * pageSize), page: pageNumber, limit: pageSize, total: sorted.length, hasMore: pageNumber * pageSize < sorted.length });
});

router.get('/recommendations/:email', (request, response) => {
  const email = decodeURIComponent(request.params.email).toLowerCase();
  const profile = readProfiles().find((item) => item.email === email);
  const interests = profile?.wants?.join(' ').toLowerCase() || '';
  const profiles = readProfiles().filter(isDiscoverableProfile);
  const recommendations = profileSkills(profiles).filter((skill) => interests && `${skill.title} ${skill.category} ${skill.wants}`.toLowerCase().split(' ').some((word) => word.length > 3 && interests.includes(word))).slice(0, 6);
  return response.json(recommendations);
});

router.get('/profiles/:email/similar', (request, response) => {
  const email = decodeURIComponent(request.params.email).toLowerCase();
  const profile = readProfiles().find((item) => item.email === email);
  const interests = [...(profile?.teaches || []), ...(profile?.wants || [])].map((item) => item.toLowerCase());
  const similar = readProfiles().filter((item) => isDiscoverableProfile(item) && item.email !== email && [...(item.teaches || []), ...(item.wants || [])].some((skill) => interests.some((interest) => skill.toLowerCase().includes(interest)))).slice(0, 6).map(publicProfile);
  return response.json(similar);
});

router.get('/matching/:email', (request, response) => {
  const email = decodeURIComponent(request.params.email).toLowerCase();
  const profile = readProfiles().find((item) => item.email === email);
  const wants = (profile?.wants || []).map((item) => item.toLowerCase());
  const teaches = (profile?.teaches || []).map((item) => item.toLowerCase());
  const profiles = readProfiles().filter(isDiscoverableProfile);
  const matches = profileSkills(profiles).map((skill) => { const text = `${skill.title} ${skill.category} ${skill.wants}`.toLowerCase(); const teachScore = teaches.filter((item) => text.includes(item)).length; const learnScore = wants.filter((item) => text.includes(item)).length; return { skill, matchScore: Math.min(99, 45 + (teachScore * 15) + (learnScore * 20)) }; }).filter((item) => item.matchScore > 45).sort((first, second) => second.matchScore - first.matchScore).slice(0, 8);
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
    const created = { ...skill, _id: `local-${Date.now()}`, teacher: { ...skill.teacher, exchanges: 0, rating: 5 } };
    localSkills = [created, ...localSkills];
    return response.status(201).json(created);
  }
  return response.status(201).json(await Skill.create(skill));
});

router.post('/profiles', async (request, response) => {
  if (databaseRequired(response)) return;
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
    return response.status(201).json({ message: 'Account created. Check your email to verify it.', verificationRequired: true, email: created.email });
  } catch (error) {
    if (error.code === 11000) return response.status(409).json({ message: 'An account with this email already exists.' });
    return response.status(500).json({ message: 'Could not create profile. Please try again.' });
  }
});

router.delete('/profiles/:email', (request, response) => {
  const email = decodeURIComponent(request.params.email).toLowerCase();
  const profiles = readProfiles();
  const next = profiles.filter((profile) => profile.email !== email);
  if (next.length === profiles.length) return response.status(404).json({ message: 'Profile not found.' });
  writeProfiles(next);
  return response.json({ message: 'Account deleted successfully.' });
});

router.post('/reports', (request, response) => {
  const { reporterEmail, reportedEmail, reason, details = '' } = request.body;
  if (!reporterEmail || !reportedEmail || !reason) return response.status(400).json({ message: 'Reporter, reported user and reason are required.' });
  const report = { _id: `report-${Date.now()}`, reporterEmail, reportedEmail, reason, details, status: 'open', createdAt: new Date().toISOString() };
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

router.get('/admin/reports', (request, response) => {
  if (!process.env.ADMIN_KEY || request.headers['x-admin-key'] !== process.env.ADMIN_KEY) return response.status(403).json({ message: 'Admin access required.' });
  return response.json(readCollection('reports.json'));
});

router.get('/admin/stats', async (request, response) => {
  const adminKey = process.env.ADMIN_KEY || 'owner-secret';
  if (request.headers['x-admin-key'] !== adminKey) return response.status(403).json({ message: 'Admin access required.' });
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
  const adminKey = process.env.ADMIN_KEY || 'owner-secret';
  if (request.headers['x-admin-key'] !== adminKey) return response.status(403).json({ message: 'Admin access required.' });
  if (process.env.MONGODB_URI) {
    const profiles = await Profile.find({}).select('-passwordHash').sort({ createdAt: -1 }).lean();
    return response.json(profiles);
  }
  const profiles = readProfiles().sort((first, second) => new Date(second.createdAt || 0) - new Date(first.createdAt || 0));
  return response.json(profiles.map(({ passwordHash, ...profile }) => profile));
});

router.post('/admin/users/:id/send-verification', async (request, response) => {
  const adminKey = process.env.ADMIN_KEY || 'owner-secret';
  if (request.headers['x-admin-key'] !== adminKey) return response.status(403).json({ message: 'Admin access required.' });
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
  const adminKey = process.env.ADMIN_KEY || 'owner-secret';
  if (request.headers['x-admin-key'] !== adminKey) return response.status(403).json({ message: 'Admin access required.' });
  const lookup = decodeURIComponent(request.params.id);
  const { name, email, location = '', bio = '', teaches = [], wants = [], profileVisible, allowMessages, verified, blockedEmails = [] } = request.body;
  const safeProfile = {
    ...(name !== undefined && { name: String(name).trim() }),
    ...(email !== undefined && { email: String(email).trim().toLowerCase() }),
    ...(location !== undefined && { location: String(location).trim() }),
    ...(bio !== undefined && { bio: String(bio).trim() }),
    ...(teaches !== undefined && { teaches: Array.isArray(teaches) ? teaches.map((item) => String(item).trim()).filter(Boolean) : [] }),
    ...(wants !== undefined && { wants: Array.isArray(wants) ? wants.map((item) => String(item).trim()).filter(Boolean) : [] }),
    ...(profileVisible !== undefined && { profileVisible: Boolean(profileVisible) }),
    ...(allowMessages !== undefined && { allowMessages: Boolean(allowMessages) }),
    ...(verified !== undefined && { verified: Boolean(verified), emailVerified: true }),
    ...(blockedEmails !== undefined && { blockedEmails: Array.isArray(blockedEmails) ? blockedEmails.map((item) => String(item).trim().toLowerCase()).filter(Boolean) : [] })
  };

  if (!process.env.MONGODB_URI) {
    const profiles = readProfiles();
    const index = profiles.findIndex((profile) => profile._id === lookup || profile.email === lookup);
    if (index === -1) return response.status(404).json({ message: 'Profile not found.' });
    const updated = { ...profiles[index], ...safeProfile };
    const nextProfiles = [...profiles]; nextProfiles[index] = updated; writeProfiles(nextProfiles);
    return response.json(updated);
  }

  const query = mongoose.isValidObjectId(lookup) ? { _id: lookup } : { email: lookup };
  const updated = await Profile.findOneAndUpdate(query, safeProfile, { new: true, runValidators: true });
  if (!updated) return response.status(404).json({ message: 'Profile not found.' });
  return response.json(updated);
});

router.delete('/admin/users/:id', async (request, response) => {
  const adminKey = process.env.ADMIN_KEY || 'owner-secret';
  if (request.headers['x-admin-key'] !== adminKey) return response.status(403).json({ message: 'Admin access required.' });
  const lookup = decodeURIComponent(request.params.id);

  if (!process.env.MONGODB_URI) {
    const profiles = readProfiles();
    const next = profiles.filter((profile) => profile._id !== lookup && profile.email !== lookup);
    if (next.length === profiles.length) return response.status(404).json({ message: 'Profile not found.' });
    writeProfiles(next);
    return response.json({ message: 'User deleted successfully.' });
  }

  const query = mongoose.isValidObjectId(lookup) ? { _id: lookup } : { email: lookup };
  const result = await Profile.deleteOne(query);
  if (!result.deletedCount) return response.status(404).json({ message: 'Profile not found.' });
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
    if (!profile.emailVerified) return response.status(403).json({ message: 'Please verify your email before logging in.' });
    return response.json({ message: 'Login successful.', profile: publicProfile(profile) });
  }

  const profile = await Profile.findOne({ email: normalizedEmail }).select('+passwordHash');
  if (!profile || !(await bcrypt.compare(password, profile.passwordHash))) {
    return response.status(401).json({ message: 'Invalid email or password.' });
  }
  if (!profile.emailVerified) return response.status(403).json({ message: 'Please verify your email before logging in.' });
  return response.json({ message: 'Login successful.', profile: publicProfile(profile) });
});

router.post('/auth/change-password', async (request, response) => {
  const { email, currentPassword, newPassword } = request.body;
  if (!email || !currentPassword || !newPassword || newPassword.length < 8) return response.status(400).json({ message: 'Email, current password and a new password of 8+ characters are required.' });
  const normalizedEmail = email.trim().toLowerCase();
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
    const token = `reset-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
  const { name, email, avatar = '', location = '', bio = '', teaches = [], wants = [], profileVisible = true, allowMessages = true } = request.body;
  if (!name || !email) return response.status(400).json({ message: 'Name and email are required.' });
  const profileData = { name: name.trim(), email: email.trim().toLowerCase(), avatar, location, bio, teaches, wants, profileVisible, allowMessages };

  if (!process.env.MONGODB_URI) {
    const profiles = readProfiles();
    const lookup = decodeURIComponent(request.params.id);
    const index = profiles.findIndex((profile) => profile._id === lookup || profile.email === lookup);
    if (index === -1) return response.status(404).json({ message: 'Profile not found.' });
    const updated = { ...profiles[index], ...profileData };
    writeProfiles(profiles.toSpliced(index, 1, updated));
    return response.json(publicProfile(updated));
  }

  const lookup = decodeURIComponent(request.params.id);
  const query = mongoose.isValidObjectId(lookup) ? { _id: lookup } : { email: lookup };
  const updated = await Profile.findOneAndUpdate(query, profileData, { new: true, runValidators: true });
  if (!updated) return response.status(404).json({ message: 'Profile not found.' });
  return response.json(publicProfile(updated));
});

router.post('/exchanges', async (request, response) => {
  const emails = await discoverableEmails();
  if (!hasDiscoverableParticipants(request.body, emails, ['requesterEmail', 'ownerEmail'])) return response.status(403).json({ message: 'Exchanges are available only between verified community members.' });
  const exchange = { _id: `exchange-${Date.now()}`, ...request.body, status: 'pending', createdAt: new Date().toISOString() };
  const exchanges = readCollection('exchanges.json');
  writeCollection('exchanges.json', [exchange, ...exchanges]);
  return response.status(201).json(exchange);
});

router.get('/exchanges/:email', async (request, response) => {
  const email = decodeURIComponent(request.params.email).toLowerCase();
  const emails = await discoverableEmails();
  return response.json(readCollection('exchanges.json').filter((item) => (item.requesterEmail === email || item.ownerEmail === email) && hasDiscoverableParticipants(item, emails, ['requesterEmail', 'ownerEmail'])));
});

router.patch('/exchanges/:id', (request, response) => {
  const exchanges = readCollection('exchanges.json');
  const index = exchanges.findIndex((item) => item._id === request.params.id);
  if (index === -1) return response.status(404).json({ message: 'Exchange not found.' });
  exchanges[index] = { ...exchanges[index], status: request.body.status };
  writeCollection('exchanges.json', exchanges);
  return response.json(exchanges[index]);
});

router.patch('/exchanges/:id/schedule', (request, response) => {
  const exchanges = readCollection('exchanges.json');
  const index = exchanges.findIndex((item) => item._id === request.params.id);
  if (index === -1) return response.status(404).json({ message: 'Exchange not found.' });
  exchanges[index] = { ...exchanges[index], scheduledAt: request.body.scheduledAt, meetingLink: request.body.meetingLink || '' };
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
  const { senderName, senderEmail, recipientName, recipientEmail = '', message } = request.body;
  if (!senderName || !senderEmail || !recipientName || !message?.trim()) {
    return response.status(400).json({ message: 'Sender, recipient and message are required.' });
  }
  const emails = await discoverableEmails();
  if (!hasDiscoverableParticipants({ senderEmail, recipientEmail }, emails, ['senderEmail', 'recipientEmail'])) {
    return response.status(403).json({ message: 'Messaging is available only between verified community members.' });
  }
  const recipientProfile = recipientEmail ? readProfiles().find((profile) => profile.email === recipientEmail.toLowerCase()) : null;
  if (recipientProfile?.allowMessages === false) return response.status(403).json({ message: 'This user has disabled direct messages.' });
  const blocks = readCollection('blocks.json');
  if (blocks.some((block) => block.blockerEmail === recipientEmail.toLowerCase() && block.blockedEmail === senderEmail.toLowerCase())) return response.status(403).json({ message: 'You cannot message this user.' });
  if (message.trim().length > 2000) return response.status(413).json({ message: 'Message is too long.' });
  const created = { _id: `message-${Date.now()}`, senderName, senderEmail, recipientName, recipientEmail, message: message.trim(), status: 'sent', read: false, createdAt: new Date().toISOString() };
  const messages = readMessages();
  if (messages.some((item) => item.senderEmail === senderEmail && item.message === message.trim() && Date.now() - Date.parse(item.createdAt) < 30000)) return response.status(429).json({ message: 'Please wait before sending the same message again.' });
  writeMessages([created, ...messages]);
  if (recipientEmail) {
    const notifications = readCollection('notifications.json');
    writeCollection('notifications.json', [{ _id: `notification-${Date.now()}`, email: recipientEmail.toLowerCase(), type: 'message', senderName, senderEmail: senderEmail.toLowerCase(), title: `${senderName} sent you a message`, read: false, createdAt: new Date().toISOString() }, ...notifications]);
  }
  return response.status(201).json(created);
});

router.get('/messages/:email', async (request, response) => {
  const email = decodeURIComponent(request.params.email).toLowerCase();
  const emails = await discoverableEmails();
  const profiles = process.env.MONGODB_URI
    ? new Map((await Profile.find({ email: { $in: [...emails] } }).select('email avatar').lean()).map((profile) => [profile.email, profile.avatar || '']))
    : new Map(readProfiles().map((profile) => [profile.email, profile.avatar || '']));
  return response.json(readMessages().filter((message) => (message.senderEmail === email || message.recipientEmail === email) && hasDiscoverableParticipants(message, emails, ['senderEmail', 'recipientEmail'])).map((message) => ({ ...message, senderAvatar: profiles.get(message.senderEmail) || '', recipientAvatar: profiles.get(message.recipientEmail) || '' })));
});

router.patch('/messages/:id/read', (request, response) => {
  const messages = readMessages();
  const index = messages.findIndex((message) => message._id === request.params.id);
  if (index === -1) return response.status(404).json({ message: 'Message not found.' });
  messages[index].read = true;
  writeMessages(messages);
  return response.json(messages[index]);
});

router.get('/notifications/:email', async (request, response) => {
  const email = decodeURIComponent(request.params.email).toLowerCase();
  const emails = await discoverableEmails();
  return response.json(readCollection('notifications.json').filter((notification) => notification.email === email && emails.has(notification.email)));
});

router.patch('/notifications/:email/read', (request, response) => {
  const email = decodeURIComponent(request.params.email).toLowerCase();
  const notifications = readCollection('notifications.json').map((notification) => notification.email === email ? { ...notification, read: true } : notification);
  writeCollection('notifications.json', notifications);
  return response.json({ ok: true });
});

router.post('/contact', (request, response) => response.status(201).json({ message: 'Thanks, we will be in touch soon.', ...request.body }));

const requireAdmin = (request, response) => {
  const adminKey = process.env.ADMIN_KEY || 'owner-secret';
  if (request.headers['x-admin-key'] !== adminKey) {
    response.status(403).json({ message: 'Admin access required.' });
    return false;
  }
  return true;
};

router.post('/admin/auth', (request, response) => {
  if (!requireAdmin(request, response)) return;
  return response.json({ ok: true, message: 'Admin authenticated.' });
});

router.get('/admin/overview', async (request, response) => {
  if (!requireAdmin(request, response)) return;
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

router.get('/admin/skills', async (request, response) => {
  if (!requireAdmin(request, response)) return;
  if (process.env.MONGODB_URI) return response.json(await Skill.find({}).sort({ createdAt: -1 }).lean());
  return response.json(localSkills);
});

router.delete('/admin/skills/:id', async (request, response) => {
  if (!requireAdmin(request, response)) return;
  const lookup = decodeURIComponent(request.params.id);
  if (process.env.MONGODB_URI) {
    const deleted = await Skill.findByIdAndDelete(lookup);
    if (!deleted) return response.status(404).json({ message: 'Skill not found.' });
    return response.json({ ok: true });
  }
  const index = localSkills.findIndex((skill) => skill._id === lookup);
  if (index === -1) return response.status(404).json({ message: 'Skill not found.' });
  localSkills = localSkills.filter((_, itemIndex) => itemIndex !== index);
  return response.json({ ok: true });
});

router.get('/admin/exchanges', (request, response) => {
  if (!requireAdmin(request, response)) return;
  return response.json(readCollection('exchanges.json'));
});

router.patch('/admin/exchanges/:id', (request, response) => {
  if (!requireAdmin(request, response)) return;
  const exchanges = readCollection('exchanges.json');
  const index = exchanges.findIndex((item) => item._id === request.params.id);
  if (index === -1) return response.status(404).json({ message: 'Exchange not found.' });
  const allowed = ['pending', 'accepted', 'rejected', 'completed'];
  if (!allowed.includes(request.body.status)) return response.status(400).json({ message: 'Invalid exchange status.' });
  exchanges[index] = { ...exchanges[index], status: request.body.status };
  writeCollection('exchanges.json', exchanges);
  return response.json(exchanges[index]);
});

router.patch('/admin/reports/:id', (request, response) => {
  if (!requireAdmin(request, response)) return;
  const reports = readCollection('reports.json');
  const index = reports.findIndex((item) => item._id === request.params.id);
  if (index === -1) return response.status(404).json({ message: 'Report not found.' });
  const allowed = ['open', 'resolved', 'dismissed'];
  if (!allowed.includes(request.body.status)) return response.status(400).json({ message: 'Invalid report status.' });
  reports[index] = { ...reports[index], status: request.body.status, reviewedAt: new Date().toISOString() };
  writeCollection('reports.json', reports);
  return response.json(reports[index]);
});

export default router;
