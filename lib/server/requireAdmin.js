// Checks the caller's Supabase session (sent as "Authorization: Bearer <token>")
// and that they are in admin_users. Sends the error response itself and
// returns null when access is refused.
import { supabaseAdmin } from './supabaseAdmin';

export async function requireAdmin(req, res) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'Not signed in.' });
    return null;
  }
  const db = supabaseAdmin();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) {
    res.status(401).json({ error: 'Not signed in.' });
    return null;
  }
  const { data: admin } = await db.from('admin_users').select('user_id').eq('user_id', data.user.id).maybeSingle();
  if (!admin) {
    res.status(403).json({ error: 'You do not have admin access.' });
    return null;
  }
  return data.user;
}
