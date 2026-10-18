import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';

const RESULT_MESSAGES = {
  connected: { ok: true, text: 'Square is connected.' },
  denied: { ok: false, text: 'Square access was not approved, so nothing was connected.' },
  expired: { ok: false, text: 'The connection attempt expired or did not match. Please click Connect again.' },
  error: { ok: false, text: 'Square could not be connected. Please try again. If it keeps failing, check the Square settings in Vercel.' },
};

async function api(path, options = {}) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.session?.access_token || ''}`,
      ...(options.headers || {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

const card = 'bg-white border border-stone-200 rounded-2xl p-6 space-y-5';
const input = 'w-full px-3 py-2.5 border border-stone-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#C8401C]';
const primary = 'px-5 py-2.5 rounded-lg bg-[#C8401C] hover:bg-[#A8361A] text-white font-semibold disabled:opacity-50 min-h-[44px]';
const secondary = 'px-5 py-2.5 rounded-lg border border-stone-300 bg-white font-semibold disabled:opacity-50 min-h-[44px]';

export default function SettingsPage() {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [square, setSquare] = useState(null);
  const [squareError, setSquareError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [shop, setShop] = useState(null);
  const [notice, setNotice] = useState(null);

  const loadSquare = useCallback(async () => {
    setSquareError(null);
    try {
      setSquare(await api('/api/square/status'));
    } catch (e) {
      setSquareError(e.message);
    }
  }, []);

  const loadShop = useCallback(async () => {
    const { data, error } = await supabase.from('shop_settings').select('*').eq('id', 1).maybeSingle();
    if (error) setNotice({ ok: false, text: `Shop settings could not be loaded: ${error.message}` });
    setShop(data || null);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    loadSquare();
    loadShop();
  }, [isAdmin, loadSquare, loadShop]);

  // Show the result of returning from Square, then tidy the address bar.
  useEffect(() => {
    const result = router.query.square;
    if (typeof result === 'string' && RESULT_MESSAGES[result]) {
      setNotice(RESULT_MESSAGES[result]);
      router.replace('/admin/settings', undefined, { shallow: true });
    }
  }, [router]);

  const connect = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const { url } = await api('/api/square/connect', { method: 'POST' });
      window.location.href = url;
    } catch (e) {
      setNotice({ ok: false, text: e.message });
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm('Disconnect Square? The website will stop updating products and stock until it is connected again.')) return;
    setBusy(true);
    try {
      const r = await api('/api/square/disconnect', { method: 'POST' });
      setNotice({ ok: true, text: r.revoked ? 'Square is disconnected.' : 'Disconnected here. Square did not confirm, so also remove the app from the Square account’s settings.' });
      await loadSquare();
    } catch (e) {
      setNotice({ ok: false, text: e.message });
    }
    setBusy(false);
  };

  const chooseLocation = async (locationId) => {
    setBusy(true);
    try {
      await api('/api/square/location', { method: 'POST', body: JSON.stringify({ locationId }) });
      setNotice({ ok: true, text: 'Store location saved.' });
      await loadSquare();
    } catch (e) {
      setNotice({ ok: false, text: e.message });
    }
    setBusy(false);
  };

  const saveShop = async (e) => {
    e.preventDefault();
    const hold = parseInt(shop.hold_back_qty, 10);
    if (!(hold >= 0)) return setNotice({ ok: false, text: 'Hold-back stock must be 0 or more.' });
    const { error } = await supabase
      .from('shop_settings')
      .update({
        shop_name: shop.shop_name?.trim() || null,
        phone: shop.phone?.trim() || null,
        email: shop.email?.trim() || null,
        opening_hours: shop.opening_hours?.trim() || null,
        address: shop.address?.trim() || null,
        makeup_booking: shop.makeup_booking?.trim() || null,
        out_of_stock_mode: shop.out_of_stock_mode,
        hold_back_qty: hold,
        click_and_collect: shop.click_and_collect,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);
    setNotice(error ? { ok: false, text: error.message } : { ok: true, text: 'Settings saved.' });
  };

  const set = (field) => (e) => setShop({ ...shop, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">Settings</h1>
          <p className="text-stone-600 mt-1">Square connection, what the website shows, and store details.</p>
        </div>

        {notice && (
          <div role="status" className={`p-3 rounded-lg border text-sm ${notice.ok ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-800'}`}>
            {notice.text}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2 items-start">
          {/* Square connection */}
          <section className={card}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Square connection</h2>
              {square && (
                <span className={`text-sm font-semibold px-3 py-1 rounded-full ${square.connected ? 'bg-green-100 text-green-900' : 'bg-stone-200 text-stone-700'}`}>
                  {square.connected ? 'Connected' : 'Not connected'}
                </span>
              )}
            </div>

            {squareError && <p className="text-sm text-red-700">{squareError}</p>}
            {!square && !squareError && <p className="text-stone-600">Checking…</p>}

            {square && (
              <>
                <p className="text-sm">
                  Mode:{' '}
                  <span className={`font-semibold ${square.environment === 'production' ? 'text-green-800' : 'text-amber-800'}`}>
                    {square.environment === 'production' ? 'Live store' : 'Test (sandbox)'}
                  </span>
                  <span className="text-stone-600"> · set by SQUARE_ENVIRONMENT in Vercel</span>
                </p>

                {square.missing?.length > 0 && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900">
                    The website is missing these settings, so Square can’t be connected yet: <strong>{square.missing.join(', ')}</strong>
                  </div>
                )}

                {square.connected ? (
                  <>
                    <dl className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-2 text-sm">
                      <dt className="text-stone-600">Square account</dt>
                      <dd className="font-medium">{square.merchantName || square.merchantId}</dd>
                      <dt className="text-stone-600">Connected</dt>
                      <dd>
                        {new Date(square.connectedAt).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}
                        {square.connectedByEmail ? ` by ${square.connectedByEmail}` : ''}
                      </dd>
                    </dl>

                    {square.problem && <p className="text-sm text-red-700">{square.problem}</p>}

                    {square.locations?.length > 0 && (
                      <label className="block space-y-1.5">
                        <span className="font-medium">Store location</span>
                        <select className={input} value={square.locationId || ''} disabled={busy} onChange={(e) => chooseLocation(e.target.value)}>
                          {!square.locationId && <option value="">Choose a location…</option>}
                          {square.locations.map((l) => (
                            <option key={l.id} value={l.id}>{l.name}{l.address ? ` – ${l.address}` : ''}</option>
                          ))}
                        </select>
                        <span className="block text-sm text-stone-600">The website takes stock from, and sends orders to, this location.</span>
                        {square.locations.find((l) => l.id === square.locationId)?.currency &&
                          square.locations.find((l) => l.id === square.locationId).currency !== 'AUD' && (
                          <span className="block text-sm text-amber-800">This location uses {square.locations.find((l) => l.id === square.locationId).currency}, not AUD.</span>
                        )}
                      </label>
                    )}

                    <div className="flex flex-wrap gap-3">
                      <button type="button" className={secondary} disabled={busy} onClick={connect}>Reconnect</button>
                      <button type="button" className={`${secondary} text-red-700 border-red-200`} disabled={busy} onClick={disconnect}>Disconnect</button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-stone-700">
                      The Square account holder clicks Connect, signs in to Square on Square’s own page, and approves access. No passwords are shared or stored.
                    </p>
                    <button type="button" className={primary} disabled={busy || square.missing?.length > 0} onClick={connect}>
                      Connect to Square
                    </button>
                  </div>
                )}

                <p className="text-sm text-stone-600 bg-stone-50 rounded-lg p-3">
                  Square sign-in and keys stay on the server. The owner can remove this access from their Square account at any time.
                </p>
              </>
            )}
          </section>

          {/* Product sync placeholder */}
          <section className={card}>
            <h2 className="text-lg font-semibold">Product sync</h2>
            <p className="text-stone-700">
              Next step: once Square is connected, products, prices and stock will copy across from Square automatically, with a “Sync now” button and a log here.
            </p>
          </section>

          {shop && (
            <>
              {/* Store details */}
              <form onSubmit={saveShop} className={card}>
                <h2 className="text-lg font-semibold">Store details</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1.5"><span className="font-medium">Shop name</span><input className={input} value={shop.shop_name || ''} onChange={set('shop_name')} /></label>
                  <label className="space-y-1.5"><span className="font-medium">Phone</span><input className={input} value={shop.phone || ''} onChange={set('phone')} /></label>
                  <label className="space-y-1.5"><span className="font-medium">Email</span><input className={input} type="email" value={shop.email || ''} onChange={set('email')} /></label>
                  <label className="space-y-1.5"><span className="font-medium">Opening hours</span><input className={input} value={shop.opening_hours || ''} onChange={set('opening_hours')} /></label>
                </div>
                <label className="block space-y-1.5"><span className="font-medium">Address</span><input className={input} value={shop.address || ''} onChange={set('address')} placeholder="Shop address" /></label>
                <label className="block space-y-1.5">
                  <span className="font-medium">Make-up artist bookings</span>
                  <textarea className={input} rows={2} value={shop.makeup_booking || ''} onChange={set('makeup_booking')} placeholder="How customers book, e.g. call or message" />
                </label>
                <button type="submit" className={primary}>Save store details</button>
              </form>

              {/* Website display + pickup */}
              <form onSubmit={saveShop} className={card}>
                <h2 className="text-lg font-semibold">What shows on the website</h2>
                <fieldset className="space-y-2">
                  <legend className="font-medium mb-2">When an item is out of stock</legend>
                  <label className="flex items-center gap-3 min-h-[44px]">
                    <input type="radio" name="oos" className="w-5 h-5" checked={shop.out_of_stock_mode === 'sold_out'} onChange={() => setShop({ ...shop, out_of_stock_mode: 'sold_out' })} />
                    Show it as “Sold out”
                  </label>
                  <label className="flex items-center gap-3 min-h-[44px]">
                    <input type="radio" name="oos" className="w-5 h-5" checked={shop.out_of_stock_mode === 'hide'} onChange={() => setShop({ ...shop, out_of_stock_mode: 'hide' })} />
                    Hide it until it’s back
                  </label>
                </fieldset>
                <label className="block space-y-1.5">
                  <span className="font-medium">Hold back stock for the shop</span>
                  <input className={`${input} max-w-[120px]`} type="number" min="0" value={shop.hold_back_qty ?? 0} onChange={set('hold_back_qty')} />
                  <span className="block text-sm text-stone-600">The website shows an item as sold out when this many or fewer are left, so the last units aren’t sold twice.</span>
                </label>
                <label className="flex items-center gap-3 min-h-[44px]">
                  <input type="checkbox" className="w-5 h-5" checked={Boolean(shop.click_and_collect)} onChange={set('click_and_collect')} />
                  Click &amp; collect from the shop
                </label>
                <p className="text-sm text-stone-600">Online card payments arrive with checkout and use the same Square connection.</p>
                <button type="submit" className={primary}>Save</button>
              </form>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
