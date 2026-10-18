// Square sends the owner back here after they approve (or decline) access.
import { exchangeCode, squareFetch, saveConnection, parseCookies } from '../../../lib/server/square';

export default async function handler(req, res) {
  const { code, state, error } = req.query;
  const cookies = parseCookies(req.headers.cookie);
  res.setHeader('Set-Cookie', 'sq_state=; Path=/api/square; HttpOnly; SameSite=Lax; Max-Age=0');
  const back = (result) => {
    res.redirect(302, `/admin/settings?square=${result}`);
  };

  if (error) {
    back(error === 'access_denied' ? 'denied' : 'error');
    return;
  }
  if (!code || !state || !cookies.sq_state || cookies.sq_state !== state) {
    back('expired');
    return;
  }

  try {
    const token = await exchangeCode(code);
    const [merchant, locs] = await Promise.all([
      squareFetch(`/v2/merchants/${token.merchant_id}`, { token: token.access_token }).catch(() => null),
      squareFetch('/v2/locations', { token: token.access_token }),
    ]);
    const active = (locs.locations || []).filter((l) => l.status === 'ACTIVE');
    await saveConnection({
      merchantId: token.merchant_id,
      merchantName: merchant?.merchant?.business_name || null,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: token.expires_at,
      locationId: active.length === 1 ? active[0].id : null,
      connectedBy: String(state).split(':')[1] || null,
    });
    back('connected');
  } catch (e) {
    console.error('Square connect failed:', e.message);
    back('error');
  }
}
