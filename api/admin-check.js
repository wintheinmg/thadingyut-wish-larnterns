import { isAdmin, send } from '../lib/store.js';

// POST /api/admin-check  (header X-Admin-Key) -> 200 if the moderator key is right
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'Method not allowed' });
  }
  // Small delay to slow down guessing
  await new Promise((r) => setTimeout(r, 400));
  return isAdmin(req) ? send(res, 200, { ok: true }) : send(res, 403, { error: 'Wrong key' });
}
