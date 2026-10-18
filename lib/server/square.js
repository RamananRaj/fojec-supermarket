// Square connection helpers (server only).
import { supabaseAdmin } from './supabaseAdmin';
import { encrypt, decrypt } from './crypto';

export const SQUARE_VERSION = '2026-07-15';

// What the website asks the shop owner to allow when they click "Connect to Square".
export const SQUARE_SCOPES = [
  'MERCHANT_PROFILE_READ',
  'ITEMS_READ',
  'ITEMS_WRITE',
  'INVENTORY_READ',
  'INVENTORY_WRITE',
  'ORDERS_READ',
  'ORDERS_WRITE',
  'PAYMENTS_READ',
  'PAYMENTS_WRITE',
  'CUSTOMERS_READ',
  'CUSTOMERS_WRITE',
];

export function squareConfig() {
  const environment = process.env.SQUARE_ENVIRONMENT === 'production' ? 'production' : 'sandbox';
  const applicationId = process.env.SQUARE_APPLICATION_ID;
  const applicationSecret = process.env.SQUARE_APPLICATION_SECRET;
  const redirectUrl = process.env.SQUARE_REDIRECT_URL;
  const missing = [
    ['SQUARE_APPLICATION_ID', applicationId],
    ['SQUARE_APPLICATION_SECRET', applicationSecret],
    ['SQUARE_REDIRECT_URL', redirectUrl],
    ['SQUARE_TOKEN_KEY', process.env.SQUARE_TOKEN_KEY],
    ['SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY],
  ].filter(([, v]) => !v).map(([k]) => k);
  return {
    environment,
    applicationId,
    applicationSecret,
    redirectUrl,
    missing,
    baseUrl: environment === 'production' ? 'https://connect.squareup.com' : 'https://connect.squareupsandbox.com',
  };
}

export async function squareFetch(path, { token, method = 'GET', body, headers = {} } = {}) {
  const { baseUrl } = squareConfig();
  const res = await fetch(baseUrl + path, {
    method,
    headers: {
      'Square-Version': SQUARE_VERSION,
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.errors?.[0]?.detail || data?.message || `Square returned ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export function exchangeCode(code) {
  const c = squareConfig();
  return squareFetch('/oauth2/token', {
    method: 'POST',
    body: {
      client_id: c.applicationId,
      client_secret: c.applicationSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: c.redirectUrl,
    },
  });
}

export async function getConnectionRow() {
  const { environment } = squareConfig();
  const { data, error } = await supabaseAdmin()
    .from('square_connection')
    .select('*')
    .eq('environment', environment)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveConnection({ merchantId, merchantName, accessToken, refreshToken, expiresAt, locationId, connectedBy }) {
  const { environment } = squareConfig();
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin().from('square_connection').upsert({
    environment,
    merchant_id: merchantId,
    merchant_name: merchantName,
    access_token_enc: encrypt(accessToken),
    refresh_token_enc: refreshToken ? encrypt(refreshToken) : null,
    expires_at: expiresAt || null,
    location_id: locationId || null,
    connected_by: connectedBy || null,
    connected_at: now,
    updated_at: now,
  });
  if (error) throw error;
}

// Returns a working access token, renewing it when it expires within 7 days.
// Square access tokens last 30 days; the refresh token renews them.
export async function getAccessToken(row) {
  const conn = row || (await getConnectionRow());
  if (!conn) return null;
  const expires = conn.expires_at ? new Date(conn.expires_at).getTime() : 0;
  if (expires - Date.now() > 7 * 24 * 60 * 60 * 1000) return decrypt(conn.access_token_enc);
  if (!conn.refresh_token_enc) return decrypt(conn.access_token_enc);

  const c = squareConfig();
  const t = await squareFetch('/oauth2/token', {
    method: 'POST',
    body: {
      client_id: c.applicationId,
      client_secret: c.applicationSecret,
      refresh_token: decrypt(conn.refresh_token_enc),
      grant_type: 'refresh_token',
    },
  });
  const { error } = await supabaseAdmin()
    .from('square_connection')
    .update({
      access_token_enc: encrypt(t.access_token),
      refresh_token_enc: t.refresh_token ? encrypt(t.refresh_token) : conn.refresh_token_enc,
      expires_at: t.expires_at || null,
      updated_at: new Date().toISOString(),
    })
    .eq('environment', conn.environment);
  if (error) throw error;
  return t.access_token;
}

export function parseCookies(header = '') {
  return Object.fromEntries(
    header.split(';').map((p) => p.trim()).filter(Boolean).map((p) => {
      const i = p.indexOf('=');
      return [p.slice(0, i), decodeURIComponent(p.slice(i + 1))];
    })
  );
}
