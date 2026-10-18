// Creates a few paid test sales in the Square SANDBOX shop so the admin
// Dashboard has figures to show. Uses Square's test card, so no real money moves.
// Each sale also reduces stock in Square, just like a real till sale.
//
// Run from the project folder:
//   node --env-file=.env.local scripts/seed-sandbox-sales.mjs
// Optional: number of sales (default 10), e.g.
//   node --env-file=.env.local scripts/seed-sandbox-sales.mjs 6

import crypto from 'node:crypto';

const BASE = 'https://connect.squareupsandbox.com';
const VERSION = '2026-07-15';
const token = process.env.SQUARE_SANDBOX_ACCESS_TOKEN;
const howMany = Math.min(30, Math.max(1, parseInt(process.argv[2], 10) || 10));

if (!token) {
  console.error('SQUARE_SANDBOX_ACCESS_TOKEN is missing from .env.local');
  process.exit(1);
}

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

const { locations = [] } = await sq('/v2/locations');
const location = locations.find((l) => l.status === 'ACTIVE');
if (!location) throw new Error('No active sandbox location');

// Sellable variations with stock
const { objects = [] } = await sq('/v2/catalog/list?types=ITEM');
const variations = objects.flatMap((i) => (i.item_data?.variations || []).map((v) => ({ id: v.id, name: i.item_data.name })));
const counts = await sq('/v2/inventory/counts/batch-retrieve', {
  method: 'POST',
  body: { catalog_object_ids: variations.map((v) => v.id), location_ids: [location.id], states: ['IN_STOCK'] },
});
const stock = new Map((counts.counts || []).map((c) => [c.catalog_object_id, Number(c.quantity)]));
const pool = variations.filter((v) => (stock.get(v.id) || 0) >= 3);
if (!pool.length) throw new Error('No items with at least 3 in stock. Record a delivery on the Inventory screen first.');

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
let total = 0;

for (let n = 0; n < howMany; n += 1) {
  const online = n % 4 === 3; // roughly 1 in 4 marked as a website order
  const lines = [];
  const used = new Set();
  const lineCount = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < lineCount; i += 1) {
    const v = pick(pool.filter((p) => !used.has(p.id)));
    if (!v) break;
    used.add(v.id);
    const qty = Math.min(1 + Math.floor(Math.random() * 2), (stock.get(v.id) || 1) - 1);
    if (qty < 1) continue;
    stock.set(v.id, stock.get(v.id) - qty);
    lines.push({ catalog_object_id: v.id, quantity: String(qty) });
  }
  if (!lines.length) continue;

  const { order } = await sq('/v2/orders', {
    method: 'POST',
    body: {
      idempotency_key: crypto.randomUUID(),
      order: { location_id: location.id, source: { name: online ? 'Fojec Website' : 'Test till sale' }, line_items: lines },
    },
  });
  await sq('/v2/payments', {
    method: 'POST',
    body: {
      idempotency_key: crypto.randomUUID(),
      source_id: 'cnon:card-nonce-ok',
      amount_money: order.total_money,
      order_id: order.id,
      location_id: location.id,
      autocomplete: true,
    },
  });
  total += Number(order.total_money.amount);
  console.log(`${online ? 'Online' : 'Till  '} sale: $${(order.total_money.amount / 100).toFixed(2)} (${lines.length} item${lines.length === 1 ? '' : 's'})`);
}

console.log(`Done: ${howMany} test sales, $${(total / 100).toFixed(2)} in total.`);
console.log('Open the admin Dashboard. Click Sync now on Settings to update stock on the website.');
