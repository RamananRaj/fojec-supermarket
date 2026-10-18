// Starts "Connect to Square": returns Square's approval page URL for an admin.
import crypto from 'crypto';
import { requireAdmin } from '../../../lib/server/requireAdmin';
import { squareConfig, SQUARE_SCOPES } from '../../../lib/server/square';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await requireAdmin(req, res);
  if (!user) return;

  const c = squareConfig();
  if (c.missing.length) return res.status(500).json({ error: `Missing settings: ${c.missing.join(', ')}` });

  // The state value comes back from Square and must match this cookie,
  // which stops anyone else completing the connection.
  const state = `${crypto.randomBytes(24).toString('hex')}:${user.id}`;
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `sq_state=${encodeURIComponent(state)}; Path=/api/square; HttpOnly; SameSite=Lax; Max-Age=600${secure}`);

  const params = new URLSearchParams({
    client_id: c.applicationId,
    scope: SQUARE_SCOPES.join(' '),
    session: 'false',
    state,
  });
  res.json({ url: `${c.baseUrl}/oauth2/authorize?${params}` });
}
