import { createHmac, timingSafeEqual } from 'node:crypto';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET must be configured in production.');
  }
  return 'skillswap-local-development-secret-change-me';
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function sign(value) {
  return createHmac('sha256', getAuthSecret()).update(value).digest('base64url');
}

export function createSessionToken(email) {
  const payload = {
    email: String(email).trim().toLowerCase(),
    exp: Date.now() + SESSION_TTL_MS
  };
  const encoded = encode(payload);
  return `${encoded}.${sign(encoded)}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  try {
    const expected = sign(encoded);
    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload?.email || !payload?.exp || payload.exp <= Date.now()) return null;
    return { email: String(payload.email).toLowerCase() };
  } catch {
    return null;
  }
}
