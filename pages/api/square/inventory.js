// Records a delivery, write-off or stocktake in Square, then updates the
// website's copy of the count and keeps the note and who made the change.
import { requireAdmin } from '../../../lib/server/requireAdmin';
import { supabaseAdmin } from '../../../lib/server/supabaseAdmin';
import { getConnectionRow, getAccessToken, squareFetch } from '../../../lib/server/square';

const LABEL = { delivery: 'Delivery', writeoff: 'Write-off', stocktake: 'Stocktake' };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await requireAdmin(req, res);
  if (!user) return;

  const { variationId, kind, quantity, note, idempotencyKey } = req.body || {};
  const qty = Number(quantity);
  if (!variationId) return res.status(400).json({ error: 'Choose a product.' });
  if (!LABEL[kind]) return res.status(400).json({ error: 'Choose delivery, write-off or stocktake.' });
  if (!Number.isFinite(qty) || !Number.isInteger(qty) || qty < 0 || (kind !== 'stocktake' && qty === 0)) {
    return res.status(400).json({ error: kind === 'stocktake' ? 'Enter the counted quantity (0 or more).' : 'Enter a whole number more than 0.' });
  }
  if (kind === 'writeoff' && !String(note || '').trim()) return res.status(400).json({ error: 'Add a reason for the write-off.' });
  if (!idempotencyKey) return res.status(400).json({ error: 'Missing request key. Reload the page and try again.' });

  const db = supabaseAdmin();
  try {
    const conn = await getConnectionRow();
    if (!conn?.location_id) return res.status(400).json({ error: 'Square is not connected or no store location is chosen.' });

    const { data: product, error: pErr } = await db
      .from('catalog_products')
      .select('square_variation_id, name, track_inventory')
      .eq('square_variation_id', variationId)
      .eq('is_deleted', false)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!product) return res.status(404).json({ error: 'Product not found. Try Sync now on Settings.' });
    if (!product.track_inventory) {
      return res.status(400).json({ error: 'Stock isn’t tracked for this item in Square. Turn on stock tracking for it in Square first.' });
    }

    const token = await getAccessToken(conn);
    const locationId = conn.location_id;

    // Current count straight from Square, not the website's copy.
    const before = await squareFetch('/v2/inventory/counts/batch-retrieve', {
      token,
      method: 'POST',
      body: { catalog_object_ids: [variationId], location_ids: [locationId], states: ['IN_STOCK'] },
    });
    const beforeQty = Number((before.counts || []).find((c) => c.state === 'IN_STOCK')?.quantity || 0);
    if (kind === 'writeoff' && qty > beforeQty) {
      return res.status(400).json({ error: `Only ${beforeQty} in stock in Square, so you can’t write off ${qty}.` });
    }

    const occurredAt = new Date().toISOString();
    let change;
    if (kind === 'stocktake') {
      change = { type: 'PHYSICAL_COUNT', physical_count: { catalog_object_id: variationId, location_id: locationId, state: 'IN_STOCK', quantity: String(qty), occurred_at: occurredAt } };
    } else {
      change = {
        type: 'ADJUSTMENT',
        // Square API 2026-07-15 retired adjustment.location_id; the stock
        // stays at the same location, so "from" and "to" are both the shop.
        adjustment: {
          catalog_object_id: variationId,
          from_location_id: locationId,
          to_location_id: locationId,
          from_state: kind === 'delivery' ? 'NONE' : 'IN_STOCK',
          to_state: kind === 'delivery' ? 'IN_STOCK' : 'WASTE',
          quantity: String(qty),
          occurred_at: occurredAt,
        },
      };
    }

    const result = await squareFetch('/v2/inventory/changes/batch-create', {
      token,
      method: 'POST',
      body: { idempotency_key: String(idempotencyKey), changes: [change], ignore_unchanged_counts: false },
    });

    const created = (result.changes || [])[0] || {};
    const changeId = created.adjustment?.id || created.physical_count?.id || null;
    const afterCount = (result.counts || []).find((c) => c.catalog_object_id === variationId && c.state === 'IN_STOCK');
    const afterQty = afterCount ? Number(afterCount.quantity) : kind === 'stocktake' ? qty : kind === 'delivery' ? beforeQty + qty : beforeQty - qty;

    await db.from('catalog_products').update({ stock_qty: afterQty, synced_at: occurredAt }).eq('square_variation_id', variationId);

    const { data: profile } = await db.from('profiles').select('email').eq('id', user.id).maybeSingle();
    const { error: logErr } = await db.from('stock_adjustments').upsert(
      {
        square_change_id: changeId,
        square_variation_id: variationId,
        product_name: product.name,
        kind,
        quantity: qty,
        before_qty: beforeQty,
        after_qty: afterQty,
        note: String(note || '').trim() || null,
        created_by: user.id,
        created_by_email: profile?.email || user.email || null,
      },
      { onConflict: 'square_change_id' }
    );
    if (logErr) console.error('Could not save stock note:', logErr.message);

    return res.json({ ok: true, before: beforeQty, after: afterQty, label: LABEL[kind] });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
