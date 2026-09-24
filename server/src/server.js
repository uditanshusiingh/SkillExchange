import 'dotenv/config';
import { createServer } from 'node:http';
import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { Server as SocketServer } from 'socket.io';
import routes from './routes.js';
import { verifySessionToken } from './auth.js';

const app = express();
const httpServer = createServer(app);
app.set('trust proxy', 1);
const allowedOrigins = (process.env.CLIENT_URLS || process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((origin) => origin.trim()).filter(Boolean);
const isAllowedOrigin = (origin) => !origin || allowedOrigins.includes(origin) || /^https:\/\/([a-z0-9-]+\.)*vercel\.app$/i.test(origin);
const corsOptions = { origin: (origin, callback) => { if (isAllowedOrigin(origin)) return callback(null, true); return callback(new Error('Origin is not allowed by CORS')); } };
const io = new SocketServer(httpServer, { cors: corsOptions });
const port = process.env.PORT || 5000;

app.use(cors(corsOptions));
app.use(express.json({ limit: '5mb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api/admin/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api/messages', rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api', routes);

io.use((socket, next) => {
  const token = String(socket.handshake.auth?.token || '');
  const session = verifySessionToken(token);
  if (!session) return next(new Error('Authentication required.'));
  socket.user = session;
  return next();
});

io.on('connection', (socket) => {
  socket.join(socket.user.email);
  socket.on('join-room', (email) => {
    if (String(email || '').toLowerCase() === socket.user.email) socket.join(socket.user.email);
  });
  socket.on('send-message', (message) => {
    const senderEmail = socket.user.email;
    const recipientEmail = String(message?.recipientEmail || '').toLowerCase();
    if (recipientEmail && senderEmail !== 'demo@gmail.com' && recipientEmail !== 'demo@gmail.com') {
      io.to(recipientEmail).emit('chat-message', { ...message, senderEmail });
    }
  });
  socket.on('message-seen', (message) => {
    const senderEmail = String(message?.senderEmail || '').toLowerCase();
    if (senderEmail && message?.messageId) io.to(senderEmail).emit('message-seen', { messageId: message.messageId });
  });
  socket.on('typing', (message) => {
    const recipientEmail = String(message?.recipientEmail || '').toLowerCase();
    if (recipientEmail) io.to(recipientEmail).emit('user-typing', {
      senderEmail: socket.user.email,
      senderName: message?.senderName || '',
      conversationId: socket.user.email,
      isTyping: Boolean(message?.isTyping)
    });
  });
});

if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB connected'))
    .catch((error) => console.error('MongoDB connection failed:', error.message));
}

httpServer.listen(port, () => console.log(`SkillSwap API running on http://localhost:${port}`));
