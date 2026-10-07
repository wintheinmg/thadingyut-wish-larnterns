import { redis, KEYS, sha256, safeEqual, isAdmin, send, requireStore } from '../../lib/store.js';

// DELETE /api/wishes/:id
// Allowed for a moderator (X-Admin-Key) or the wish's author (X-Delete-Token from when it was created).
export default async function handler(req, res) {
  if (!requireStore(res)) return;
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE');
    return send(res, 405, { error: 'Method not allowed' });
  }
  try {
    const id = String(req.query.id || '');
    if (!/^[a-z0-9]{6,12}-[a-f0-9]{12}$/.test(id)) return send(res, 404, { error: 'Wish not found' });

    const wish = await redis.get(KEYS.wish(id));
    if (!wish) return send(res, 404, { error: 'Wish not found' });

    const token = req.headers['x-delete-token'];
    const allowed = isAdmin(req) || (token && safeEqual(sha256(token), wish.deleteHash));
    if (!allowed) return send(res, 403, { error: 'Not allowed' });

    await redis.del(KEYS.wish(id));
    await redis.zrem(KEYS.index, id);
    await redis.incr(KEYS.version);
    return send(res, 200, { ok: true });
  } catch (err) {
    console.error('delete failed', err);
    return send(res, 500, { error: 'Something went wrong. Please try again.' });
  }
}
