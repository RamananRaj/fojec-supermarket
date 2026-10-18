// Connection details for the admin Settings page. Tokens never leave the server.
import { requireAdmin } from '../../../lib/server/requireAdmin';
import { supabaseAdmin } from '../../../lib/server/supabaseAdmin';
import { squareConfig, getConnectionRow, getAccessToken, squareFetch } from '../../../lib/server/square';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const user = await requireAdmin(req, res);
  if (!user) return;

  const c = squareConfig();
  const base = { environment: c.environment, missing: c.missing, connected: false };
  if (c.missing.length) return res.json(base);

  try {
    const row = await getConnectionRow();
    if (!row) return res.json(base);

    let connectedByEmail = null;
    if (row.connected_by) {
      const { data } = await supabaseAdmin().from('profiles').select('email').eq('id', row.connected_by).maybeSingle();
      connectedByEmail = data?.email || null;
    }

    const result = {
      ...base,
      connected: true,
      merchantId: row.merchant_id,
      merchantName: row.merchant_name,
      connectedAt: row.connected_at,
      connectedByEmail,
      locationId: row.location_id,
      locations: [],
    };

    try {
      const token = await getAccessToken(row);
      const locs = await squareFetch('/v2/locations', { token });
      result.locations = (locs.locations || [])
        .filter((l) => l.status === 'ACTIVE')
        .map((l) => ({
          id: l.id,
          name: l.name,
          address: [l.address?.address_line_1, l.address?.locality].filter(Boolean).join(', '),
          currency: l.currency,
        }));
    } catch (e) {
      result.problem = `Square could not be reached with the saved connection: ${e.message}. Try Reconnect.`;
    }
    return res.json(result);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
