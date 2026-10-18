// Saves a product's name, price and category to Square, then re-syncs so the
// website shows exactly what Square now holds.
import crypto from 'crypto';
import { requireAdmin } from '../../../lib/server/requireAdmin';
import { supabaseAdmin } from '../../../lib/server/supabaseAdmin';
import { getAccessToken, squareFetch } from '../../../lib/server/square';
import { runSync } from '../../../lib/server/sync';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await requireAdmin(req, res);
  if (!user) return;

  const { variationId, itemName, price, categoryId } = req.body || {};
  const name = String(itemName || '').trim();
  const cents = Math.round(Number(price) * 100);
  if (!variationId) return res.status(400).json({ error: 'Missing product.' });
  if (!name) return res.status(400).json({ error: 'Name is required.' });
  if (!(cents > 0)) return res.status(400).json({ error: 'Price must be more than 0.' });

  try {
    const { data: row, error } = await supabaseAdmin()
      .from('catalog_products')
      .select('square_item_id, currency')
      .eq('square_variation_id', variationId)
      .maybeSingle();
    if (error) throw error;
    if (!row) return res.status(404).json({ error: 'Product not found. Try Sync now.' });

    const token = await getAccessToken();
    const { object: item } = await squareFetch(`/v2/catalog/object/${row.square_item_id}`, { token });
    if (!item?.item_data) throw new Error('Square item not found.');

    item.item_data.name = name;
    if (categoryId) {
      item.item_data.categories = [{ id: categoryId }];
      item.item_data.reporting_category = { id: categoryId };
    }
    const variation = (item.item_data.variations || []).find((v) => v.id === variationId);
    if (!variation) throw new Error('Square variation not found.');
    variation.item_variation_data.pricing_type = 'FIXED_PRICING';
    variation.item_variation_data.price_money = { amount: cents, currency: row.currency || 'AUD' };

    // The object carries its version, so Square refuses the save if someone
    // changed the item at the till in the meantime.
    await squareFetch('/v2/catalog/object', {
      token,
      method: 'POST',
      body: { idempotency_key: crypto.randomUUID(), object: item },
    });

    const result = await runSync('edit');
    if (!result.ok) return res.status(500).json({ error: `Saved to Square, but the refresh failed: ${result.error}` });
    return res.json({ ok: true });
  } catch (e) {
    const msg = /version/i.test(e.message)
      ? 'This item was changed in Square since you opened it. Click Sync now and try again.'
      : e.message;
    return res.status(500).json({ error: msg });
  }
}
