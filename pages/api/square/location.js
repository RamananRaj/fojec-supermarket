// Saves which Square location the website uses for stock and orders.
import { requireAdmin } from '../../../lib/server/requireAdmin';
import { supabaseAdmin } from '../../../lib/server/supabaseAdmin';
import { getConnectionRow, getAccessToken, squareFetch } from '../../../lib/server/square';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await requireAdmin(req, res);
  if (!user) return;

  const { locationId } = req.body || {};
  if (!locationId) return res.status(400).json({ error: 'Choose a location.' });

  try {
    const row = await getConnectionRow();
    if (!row) return res.status(400).json({ error: 'Square is not connected.' });
    const token = await getAccessToken(row);
    const locs = await squareFetch('/v2/locations', { token });
    if (!(locs.locations || []).some((l) => l.id === locationId && l.status === 'ACTIVE')) {
      return res.status(400).json({ error: 'That location is not in this Square account.' });
    }
    const { error } = await supabaseAdmin()
      .from('square_connection')
      .update({ location_id: locationId, updated_at: new Date().toISOString() })
      .eq('environment', row.environment);
    if (error) throw error;
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
