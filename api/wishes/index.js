import {
  redis, KEYS, COLORS, MAX_TEXT, MAX_NAME, MAX_WISHES, LIST_LIMIT,
  sha256, newId, newToken, clientFingerprint, cleanText, hasBlockedWord,
  publicWish, send, requireStore
} from '../../lib/store.js';

const RATE_WINDOW_S = 60;
const RATE_MAX = Number(process.env.RATE_LIMIT_PER_MINUTE || 4);

export default async function handler(req, res) {
  if (!requireStore(res)) return;
  try {
    if (req.method === 'GET') return await list(req, res);
    if (req.method === 'POST') return await create(req, res);
    res.setHeader('Allow', 'GET, POST');
    return send(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('wishes handler failed', err);
    return send(res, 500, { error: 'Something went wrong. Please try again.' });
  }
}

// GET /api/wishes?v=<version>  -> latest wishes, or {unchanged:true} when nothing changed
async function list(req, res) {
  const version = String((await redis.get(KEYS.version)) ?? '0');
  if (req.query && req.query.v === version) return send(res, 200, { unchanged: true, version });

  const ids = await redis.zrange(KEYS.index, 0, LIST_LIMIT - 1, { rev: true });
  const total = await redis.zcard(KEYS.index);
  let wishes = [];
  if (ids.length) {
    const rows = await redis.mget(...ids.map(KEYS.wish));
    wishes = rows.filter(Boolean).map(publicWish);
  }
  return send(res, 200, { version, total, wishes });
}

// POST /api/wishes  {text, name?, color}
async function create(req, res) {
  const body = typeof req.body === 'object' && req.body ? req.body : {};
  const text = cleanText(body.text, MAX_TEXT);
  const name = cleanText(body.name, MAX_NAME);
  const color = COLORS.includes(body.color) ? body.color : 'gold';

  if (!text) return send(res, 400, { error: 'Please write your wish before releasing the lantern.' });
  if (hasBlockedWord(text) || hasBlockedWord(name)) {
    return send(res, 400, { error: 'Please keep wishes kind and festive, then try again.' });
  }

  // Rate limit per visitor (hashed IP)
  const rateKey = KEYS.rate(clientFingerprint(req));
  const count = await redis.incr(rateKey);
  if (count === 1) await redis.expire(rateKey, RATE_WINDOW_S);
  if (count > RATE_MAX) return send(res, 429, { error: 'Too many wishes. Please wait a minute.' });

  if ((await redis.zcard(KEYS.index)) >= MAX_WISHES) {
    return send(res, 507, { error: 'The sky is full.' });
  }

  const id = newId();
  const deleteToken = newToken();
  const wish = { id, text, name, color, createdAt: Date.now(), deleteHash: sha256(deleteToken) };

  await redis.set(KEYS.wish(id), wish);
  await redis.zadd(KEYS.index, { score: wish.createdAt, member: id });
  await redis.incr(KEYS.version);

  return send(res, 201, { wish: publicWish(wish), deleteToken });
}
