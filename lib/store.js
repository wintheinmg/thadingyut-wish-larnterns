import { Redis } from '@upstash/redis';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

// Works with the Upstash for Redis integration from the Vercel Marketplace
// (it sets KV_REST_API_URL / KV_REST_API_TOKEN) or with Upstash variables set by hand.
const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

export const redis = url && token ? new Redis({ url, token }) : null;

export const KEYS = {
  index: 'lanterns:index',        // sorted set: wish id scored by createdAt
  wish: (id) => `lanterns:wish:${id}`,
  version: 'lanterns:version',    // bumps on every create / delete
  rate: (who) => `lanterns:rate:${who}`
};

export const COLORS = ['gold', 'ruby', 'lotus', 'jade', 'sky', 'violet'];
export const MAX_TEXT = 150;
export const MAX_NAME = 40;
export const MAX_WISHES = Number(process.env.MAX_WISHES || 5000);
export const LIST_LIMIT = 200;

export const sha256 = (s) => createHash('sha256').update(String(s)).digest('hex');
export const newId = () => Date.now().toString(36) + '-' + randomBytes(6).toString('hex');
export const newToken = () => randomBytes(24).toString('base64url');

export function safeEqual(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

export function isAdmin(req) {
  const key = process.env.ADMIN_KEY;
  return !!key && key.length >= 16 && safeEqual(req.headers['x-admin-key'], key);
}

// Client IP is hashed with a salt so raw IPs are never stored.
export function clientFingerprint(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = fwd || req.socket?.remoteAddress || 'unknown';
  return sha256((process.env.RATE_LIMIT_SALT || 'thadingyut') + ':' + ip).slice(0, 32);
}

// Remove control characters and collapse whitespace.
export function cleanText(v, max) {
  if (typeof v !== 'string') return '';
  return v.replace(/[\u0000-\u001F\u007F-\u009F​-‏‪-‮⁦-⁩]/g, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, max);
}

export function hasBlockedWord(text) {
  const list = String(process.env.BLOCKED_WORDS || '').split(',').map((w) => w.trim().toLowerCase()).filter(Boolean);
  const t = text.toLowerCase();
  return list.some((w) => t.includes(w));
}

export function publicWish(w) {
  return { id: w.id, text: w.text, name: w.name || '', color: w.color, createdAt: Number(w.createdAt) || 0 };
}

export function send(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(status).send(JSON.stringify(body));
}

export function requireStore(res) {
  if (!redis) {
    send(res, 503, { error: 'The wish database is not configured. Add Upstash Redis to this Vercel project.' });
    return false;
  }
  return true;
}
