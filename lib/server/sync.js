// Copies products, prices, categories and stock from Square into Supabase.
import crypto from 'crypto';
import { supabaseAdmin } from './supabaseAdmin';
import { getConnectionRow, getAccessToken, squareFetch } from './square';

const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

function atLocation(obj, locationId) {
  if (obj.present_at_all_locations === false) return (obj.present_at_location_ids || []).includes(locationId);
  return !(obj.absent_at_location_ids || []).includes(locationId);
}

async function listCatalog(token) {
  const objects = [];
  let cursor;
  do {
    const q = new URLSearchParams({ types: 'ITEM,CATEGORY,IMAGE', ...(cursor ? { cursor } : {}) });
    const r = await squareFetch(`/v2/catalog/list?${q}`, { token });
    objects.push(...(r.objects || []));
    cursor = r.cursor;
  } while (cursor);
  return objects;
}

async function retrieveCounts(token, variationIds, locationId) {
  const counts = new Map();
  for (const ids of chunk(variationIds, 500)) {
    let cursor;
    do {
      const r = await squareFetch('/v2/inventory/counts/batch-retrieve', {
        token,
        method: 'POST',
        body: { catalog_object_ids: ids, location_ids: [locationId], states: ['IN_STOCK'], ...(cursor ? { cursor } : {}) },
      });
      for (const c of r.counts || []) {
        if (c.location_id === locationId && c.state === 'IN_STOCK') counts.set(c.catalog_object_id, Number(c.quantity));
      }
      cursor = r.cursor;
    } while (cursor);
  }
  return counts;
}

async function writeLog(entry) {
  await supabaseAdmin().from('sync_log').insert({ finished_at: new Date().toISOString(), ...entry });
}

// Full sync. kind: manual | webhook | nightly | edit
export async function runSync(kind = 'manual') {
  const startedAt = new Date().toISOString();
  const db = supabaseAdmin();
  try {
    const conn = await getConnectionRow();
    if (!conn) throw new Error('Square is not connected.');
    if (!conn.location_id) throw new Error('Choose a store location in Settings first.');
    const locationId = conn.location_id;
    const token = await getAccessToken(conn);

    const objects = await listCatalog(token);
    const images = new Map(objects.filter((o) => o.type === 'IMAGE').map((o) => [o.id, o.image_data?.url]));
    const categories = objects.filter((o) => o.type === 'CATEGORY' && !o.is_deleted);
    const categoryIds = new Set(categories.map((c) => c.id));
    const items = objects.filter((o) => o.type === 'ITEM' && !o.is_deleted && !o.item_data?.is_archived && atLocation(o, locationId));

    // Categories
    const catRows = categories.map((c) => ({ square_id: c.id, name: c.category_data?.name || 'Unnamed', is_deleted: false, synced_at: startedAt }));
    for (const rows of chunk(catRows, 500)) {
      const { error } = await db.from('catalog_categories').upsert(rows, { onConflict: 'square_id' });
      if (error) throw error;
    }

    // Products: one row per variation sold at this location
    const rows = [];
    for (const item of items) {
      const d = item.item_data || {};
      const variations = (d.variations || []).filter((v) => !v.is_deleted && atLocation(v, locationId));
      const catId = d.categories?.[0]?.id || d.reporting_category?.id || d.category_id || null;
      const imageUrl = (d.image_ids || []).map((id) => images.get(id)).find(Boolean) || null;
      for (const v of variations) {
        const vd = v.item_variation_data || {};
        const override = (vd.location_overrides || []).find((o) => o.location_id === locationId) || {};
        const money = override.price_money || vd.price_money;
        const fixed = (vd.pricing_type || 'FIXED_PRICING') === 'FIXED_PRICING' && money?.amount != null;
        rows.push({
          square_variation_id: v.id,
          square_item_id: item.id,
          name: variations.length > 1 && vd.name ? `${d.name} – ${vd.name}` : d.name || 'Unnamed item',
          item_name: d.name || null,
          variation_name: vd.name || null,
          sku: vd.sku || null,
          category_square_id: catId && categoryIds.has(catId) ? catId : null,
          price_cents: fixed ? Number(money.amount) : null,
          currency: money?.currency || 'AUD',
          track_inventory: override.track_inventory ?? vd.track_inventory ?? false,
          square_description: d.description_plaintext || d.description || null,
          square_image_url: imageUrl,
          is_deleted: false,
          synced_at: startedAt,
        });
      }
    }

    const counts = await retrieveCounts(token, rows.map((r) => r.square_variation_id), locationId);
    for (const r of rows) {
      const has = counts.has(r.square_variation_id);
      if (has) r.track_inventory = true;
      r.stock_qty = r.track_inventory ? (has ? counts.get(r.square_variation_id) : 0) : null;
    }

    for (const part of chunk(rows, 500)) {
      const { error } = await db.from('catalog_products').upsert(part, { onConflict: 'square_variation_id' });
      if (error) throw error;
    }

    // Anything not seen this time was deleted or removed from this location in Square.
    const seen = new Set(rows.map((r) => r.square_variation_id));
    const { data: existing, error: exErr } = await db.from('catalog_products').select('square_variation_id').eq('is_deleted', false);
    if (exErr) throw exErr;
    const gone = (existing || []).map((r) => r.square_variation_id).filter((id) => !seen.has(id));
    for (const ids of chunk(gone, 200)) {
      await db.from('catalog_products').update({ is_deleted: true, synced_at: startedAt }).in('square_variation_id', ids);
    }
    const seenCats = new Set(catRows.map((c) => c.square_id));
    const { data: exCats } = await db.from('catalog_categories').select('square_id').eq('is_deleted', false);
    const goneCats = (exCats || []).map((c) => c.square_id).filter((id) => !seenCats.has(id));
    if (goneCats.length) await db.from('catalog_categories').update({ is_deleted: true }).in('square_id', goneCats);

    const noPrice = rows.filter((r) => r.price_cents == null).length;
    const warnings = [];
    if (noPrice) warnings.push(`${noPrice} item${noPrice === 1 ? ' has' : 's have'} no fixed price and won't show online`);
    if (gone.length) warnings.push(`${gone.length} removed`);
    const summary = { items: rows.length, categories: catRows.length, noPrice, removed: gone.length };
    await writeLog({
      started_at: startedAt,
      kind,
      status: noPrice ? 'warning' : 'ok',
      items: rows.length,
      message: [`${rows.length} products, ${catRows.length} categories`, ...warnings].join(' · '),
    });
    return { ok: true, ...summary };
  } catch (e) {
    await writeLog({ started_at: startedAt, kind, status: 'error', items: 0, message: e.message }).catch(() => {});
    return { ok: false, error: e.message };
  }
}

// Fast path for Square's inventory.count.updated webhook.
export async function applyInventoryCounts(inventoryCounts = []) {
  const conn = await getConnectionRow();
  if (!conn?.location_id) return 0;
  let n = 0;
  for (const c of inventoryCounts) {
    if (c.location_id !== conn.location_id || c.state !== 'IN_STOCK') continue;
    const { error } = await supabaseAdmin()
      .from('catalog_products')
      .update({ stock_qty: Number(c.quantity), track_inventory: true, synced_at: new Date().toISOString() })
      .eq('square_variation_id', c.catalog_object_id);
    if (!error) n += 1;
  }
  if (n) await writeLog({ started_at: new Date().toISOString(), kind: 'webhook', status: 'ok', items: n, message: `Stock updated for ${n} product${n === 1 ? '' : 's'}` });
  return n;
}

export function verifySquareSignature(rawBody, signature) {
  const key = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  const url = process.env.SQUARE_WEBHOOK_URL;
  if (!key || !url || !signature) return false;
  const expected = crypto.createHmac('sha256', key).update(url + rawBody).digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
