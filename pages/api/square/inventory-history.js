// Recent stock movements from Square (till sales, online orders, deliveries,
// write-offs, stocktakes), joined with the notes recorded in the admin.
import { requireAdmin } from '../../../lib/server/requireAdmin';
import { supabaseAdmin } from '../../../lib/server/supabaseAdmin';
import { getConnectionRow, getAccessToken, squareFetch } from '../../../lib/server/square';

function describe(change, ours) {
  if (ours) {
    const label = { delivery: 'Delivery', writeoff: 'Write-off', stocktake: 'Stocktake' }[ours.kind];
    return { label, by: ours.created_by_email || 'Admin', note: ours.note };
  }
  if (change.type === 'PHYSICAL_COUNT') return { label: 'Stocktake', by: sourceName(change.physical_count), note: null };
  const a = change.adjustment || {};
  if (a.to_state === 'SOLD') return { label: 'Sale', by: sourceName(a), note: null };
  if (a.from_state === 'SOLD' || a.to_state === 'RETURNED_BY_CUSTOMER' || a.from_state === 'RETURNED_BY_CUSTOMER') return { label: 'Refund / return', by: sourceName(a), note: null };
  if (a.to_state === 'WASTE') return { label: 'Write-off', by: sourceName(a), note: null };
  if (a.from_state === 'NONE' && a.to_state === 'IN_STOCK') return { label: 'Received', by: sourceName(a), note: null };
  return { label: `${(a.from_state || '').toLowerCase()} → ${(a.to_state || '').toLowerCase()}`, by: sourceName(a), note: null };
}

function sourceName(obj = {}) {
  const p = obj.source?.product;
  if (p === 'SQUARE_POS') return 'Square till';
  if (p === 'DASHBOARD') return 'Square Dashboard';
  if (p === 'EXTERNAL_API') return obj.source?.name || 'Website / app';
  return obj.source?.name || (p ? p.toLowerCase().replace(/_/g, ' ') : 'Square');
}

function signedQty(change) {
  if (change.type === 'PHYSICAL_COUNT') return { text: `${Number(change.physical_count.quantity)} counted`, dir: 0 };
  const a = change.adjustment;
  const q = Number(a.quantity);
  if (a.to_state === 'IN_STOCK') return { text: `+${q}`, dir: 1 };
  if (a.from_state === 'IN_STOCK') return { text: `−${q}`, dir: -1 };
  return { text: String(q), dir: 0 };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const user = await requireAdmin(req, res);
  if (!user) return;

  const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 14));
  const variationId = typeof req.query.variationId === 'string' ? req.query.variationId : null;

  try {
    const conn = await getConnectionRow();
    if (!conn?.location_id) return res.json({ changes: [] });
    const token = await getAccessToken(conn);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const raw = [];
    let cursor;
    do {
      const r = await squareFetch('/v2/inventory/changes/batch-retrieve', {
        token,
        method: 'POST',
        body: {
          location_ids: [conn.location_id],
          types: ['ADJUSTMENT', 'PHYSICAL_COUNT'],
          updated_after: since,
          limit: 1000,
          ...(variationId ? { catalog_object_ids: [variationId] } : {}),
          ...(cursor ? { cursor } : {}),
        },
      });
      raw.push(...(r.changes || []));
      cursor = r.cursor;
    } while (cursor && raw.length < 2000);

    const db = supabaseAdmin();
    const ids = raw.map((c) => c.adjustment?.id || c.physical_count?.id).filter(Boolean);
    const [{ data: notes }, { data: products }] = await Promise.all([
      ids.length ? db.from('stock_adjustments').select('*').in('square_change_id', ids.slice(0, 1000)) : { data: [] },
      db.from('catalog_products').select('square_variation_id, name'),
    ]);
    const noteById = new Map((notes || []).map((n) => [n.square_change_id, n]));
    const nameById = new Map((products || []).map((p) => [p.square_variation_id, p.name]));

    const changes = raw
      .map((c) => {
        const body = c.adjustment || c.physical_count || {};
        const ours = noteById.get(body.id);
        const d = describe(c, ours);
        const q = signedQty(c);
        return {
          id: body.id,
          at: body.occurred_at || body.created_at,
          variationId: body.catalog_object_id,
          product: nameById.get(body.catalog_object_id) || ours?.product_name || 'Unknown item',
          label: d.label,
          by: d.by,
          note: d.note,
          change: q.text,
          dir: q.dir,
        };
      })
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, 300);

    return res.json({ changes, days });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
