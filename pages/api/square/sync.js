// "Sync now" on Settings: copies everything from Square.
import { requireAdmin } from '../../../lib/server/requireAdmin';
import { runSync } from '../../../lib/server/sync';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await requireAdmin(req, res);
  if (!user) return;
  const result = await runSync('manual');
  if (!result.ok) return res.status(500).json({ error: result.error });
  return res.json(result);
}
