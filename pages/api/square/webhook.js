// Square calls this when items or stock change, so the website updates within
// seconds. Only works on the deployed site (Square can't reach localhost).
import { getConnectionRow } from '../../../lib/server/square';
import { runSync, applyInventoryCounts, verifySquareSignature } from '../../../lib/server/sync';

export const config = { api: { bodyParser: false } };

async function readRaw(req) {
  const parts = [];
  for await (const p of req) parts.push(typeof p === 'string' ? Buffer.from(p) : p);
  return Buffer.concat(parts).toString('utf8');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const raw = await readRaw(req);
  if (!verifySquareSignature(raw, req.headers['x-square-hmacsha256-signature'])) {
    return res.status(401).json({ error: 'Bad signature' });
  }

  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return res.status(400).json({ error: 'Bad JSON' });
  }

  const conn = await getConnectionRow().catch(() => null);
  if (!conn || event.merchant_id !== conn.merchant_id) return res.status(200).json({ ignored: true });

  if (event.type === 'inventory.count.updated') {
    await applyInventoryCounts(event.data?.object?.inventory_counts || []);
  } else if (event.type === 'catalog.version.updated') {
    await runSync('webhook');
  }
  return res.status(200).json({ ok: true });
}
