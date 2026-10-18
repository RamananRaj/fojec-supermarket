// Nightly full sync, run by Vercel Cron (see vercel.json). Catches anything
// a webhook missed. Vercel sends "Authorization: Bearer <CRON_SECRET>".
import { runSync } from '../../../lib/server/sync';

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: 'Unauthorized' });
  const result = await runSync('nightly');
  return res.status(result.ok ? 200 : 500).json(result);
}
