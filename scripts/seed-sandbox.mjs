// Adds sample Fojec products, with prices and stock, to the Square SANDBOX test shop.
// Only ever talks to Square's sandbox. Safe to re-run: items that already exist are skipped.
//
// Run from the project folder:
//   node --env-file=.env.local scripts/seed-sandbox.mjs
//
// Needs SQUARE_SANDBOX_ACCESS_TOKEN in .env.local (Square Developer console ->
// your app -> Credentials -> Sandbox tab -> Sandbox access token).

import crypto from 'node:crypto';

const BASE = 'https://connect.squareupsandbox.com';
const VERSION = '2026-07-15';
const token = process.env.SQUARE_SANDBOX_ACCESS_TOKEN;

if (!token) {
  console.error('SQUARE_SANDBOX_ACCESS_TOKEN is missing from .env.local');
  process.exit(1);
}

const CATEGORIES = ['African Foodstuffs', 'Frozen Foods', 'Teas & Beverages'];

// [name, category, price in dollars, stock, sku]
const ITEMS = [
  ['Garri (white) 5kg', 'African Foodstuffs', 14.99, 32, 'GAR-W-5K'],
  ['Indomie chicken, 40-pack', 'African Foodstuffs', 24.5, 6, 'IND-CH-40'],
  ['Ayoola poundo yam 1.8kg', 'African Foodstuffs', 19.99, 12, 'AYO-PY-18'],
  ['Red palm oil 1L', 'African Foodstuffs', 9.99, 18, 'PLM-1L'],
  ['Egusi (ground) 500g', 'African Foodstuffs', 8.5, 40, 'EGU-500'],
  ['Golden Penny semovita 2kg', 'African Foodstuffs', 12.0, 3, 'SEM-2K'],
  ['Frozen tilapia (whole) 1kg', 'Frozen Foods', 16.0, 0, 'FRZ-TIL-1K'],
  ['Frozen goat meat 1kg', 'Frozen Foods', 22.0, 4, 'FRZ-GOAT-1K'],
  ['Frozen croaker fish 1kg', 'Frozen Foods', 18.5, 15, 'FRZ-CRO-1K'],
  ['Peak milk powder 400g', 'Teas & Beverages', 11.5, 22, 'PEA-400'],
  ['Milo 1kg', 'Teas & Beverages', 18.99, 9, 'MIL-1K'],
  ['Lipton yellow label 100 bags', 'Teas & Beverages', 7.99, 7, 'LIP-100'],
];

async function sq(path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Square-Version': VERSION, 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path}: ${data?.errors?.[0]?.detail || res.status}`);
  return data;
}

async function listAll(types) {
  const out = [];
  let cursor;
  do {
    const q = new URLSearchParams({ types, ...(cursor ? { cursor } : {}) });
    const r = await sq(`/v2/catalog/list?${q}`);
    out.push(...(r.objects || []));
    cursor = r.cursor;
  } while (cursor);
  return out;
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const { locations = [] } = await sq('/v2/locations');
const location = locations.find((l) => l.status === 'ACTIVE');
if (!location) throw new Error('The sandbox account has no active location');
const currency = location.currency;
console.log(`Sandbox shop: ${location.name} (${location.id}), currency ${currency}`);
if (currency !== 'AUD') console.log(`Note: this sandbox account uses ${currency}. Prices will be in ${currency}.`);

const existing = await listAll('ITEM,CATEGORY');
const existingCats = new Map(existing.filter((o) => o.type === 'CATEGORY').map((o) => [o.category_data?.name, o.id]));
const existingItems = new Set(existing.filter((o) => o.type === 'ITEM').map((o) => o.item_data?.name));

const objects = [];
for (const name of CATEGORIES) {
  if (!existingCats.has(name)) objects.push({ type: 'CATEGORY', id: `#cat-${slug(name)}`, category_data: { name } });
}
const catId = (name) => existingCats.get(name) || `#cat-${slug(name)}`;

const toAdd = ITEMS.filter(([name]) => !existingItems.has(name));
for (const [name, cat, price, , sku] of toAdd) {
  const id = slug(name);
  objects.push({
    type: 'ITEM',
    id: `#item-${id}`,
    item_data: {
      name,
      categories: [{ id: catId(cat) }],
      reporting_category: { id: catId(cat) },
      variations: [{
        type: 'ITEM_VARIATION',
        id: `#var-${id}`,
        item_variation_data: {
          item_id: `#item-${id}`,
          name: 'Regular',
          sku,
          pricing_type: 'FIXED_PRICING',
          price_money: { amount: Math.round(price * 100), currency },
          track_inventory: true,
        },
      }],
    },
  });
}

if (toAdd.length === 0) {
  console.log('All sample items are already in the sandbox shop. Nothing to add.');
  process.exit(0);
}

const up = await sq('/v2/catalog/batch-upsert', {
  method: 'POST',
  body: { idempotency_key: crypto.randomUUID(), batches: [{ objects }] },
});
const idFor = new Map((up.id_mappings || []).map((m) => [m.client_object_id, m.object_id]));
console.log(`Added ${toAdd.length} items.`);

const now = new Date().toISOString();
const changes = toAdd.map(([name, , , stock]) => ({
  type: 'PHYSICAL_COUNT',
  physical_count: {
    catalog_object_id: idFor.get(`#var-${slug(name)}`),
    state: 'IN_STOCK',
    location_id: location.id,
    quantity: String(stock),
    occurred_at: now,
  },
}));
await sq('/v2/inventory/changes/batch-create', {
  method: 'POST',
  body: { idempotency_key: crypto.randomUUID(), changes, ignore_unchanged_counts: false },
});
console.log('Stock counts set. Open the sandbox Square Dashboard -> Items to see them.');
