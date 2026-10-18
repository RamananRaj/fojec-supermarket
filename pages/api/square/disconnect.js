// Removes the website's access to Square: revokes it at Square, then deletes the saved tokens.
import { requireAdmin } from '../../../lib/server/requireAdmin';
import { supabaseAdmin } from '../../../lib/server/supabaseAdmin';
import { squareConfig, getConnectionRow, squareFetch } from '../../../lib/server/square';
import { decrypt } from '../../../lib/server/crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await requireAdmin(req, res);
  if (!user) return;

  try {
    const row = await getConnectionRow();
    if (!row) return res.json({ ok: true });
    const c = squareConfig();
    let revoked = true;
    try {
      await squareFetch('/oauth2/revoke', {
        method: 'POST',
        headers: { Authorization: `Client ${c.applicationSecret}` },
        body: { client_id: c.applicationId, access_token: decrypt(row.access_token_enc) },
      });
    } catch (e) {
      // Still remove our copy; the owner can also remove the app from their Square account.
      console.error('Square revoke failed:', e.message);
      revoked = false;
    }
    const { error } = await supabaseAdmin().from('square_connection').delete().eq('environment', row.environment);
    if (error) throw error;
    return res.json({ ok: true, revoked });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
