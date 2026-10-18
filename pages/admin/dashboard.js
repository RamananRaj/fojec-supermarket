import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AdminLayout from '../../components/AdminLayout';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';

const PERIODS = [['today', 'Today'], ['7d', '7 days'], ['30d', '30 days']];
const money = (c) => `$${(Number(c || 0) / 100).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const moneyShort = (c) => {
  const d = Number(c || 0) / 100;
  return d >= 1000 ? `$${(d / 1000).toFixed(1)}k` : `$${Math.round(d)}`;
};

function Delta({ now, before, label }) {
  if (!before && !now) return <span className="text-stone-500">No sales in the {label} either</span>;
  if (!before) return <span className="text-stone-500">None in the {label}</span>;
  const pct = Math.round(((now - before) / before) * 100);
  const up = pct >= 0;
  return (
    <span className={up ? 'text-green-800' : 'text-red-700'}>
      <span aria-hidden="true">{up ? '▲' : '▼'}</span> {Math.abs(pct)}% <span className="text-stone-500">vs {label}</span>
    </span>
  );
}

function SalesChart({ buckets }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...buckets.map((b) => b.sales));
  const step = max <= 5000 ? 1000 : max <= 20000 ? 5000 : max <= 100000 ? 20000 : 50000;
  const top = Math.ceil(max / step) * step;
  const ticks = [0, top / 2, top];
  const labelEvery = buckets.length > 16 ? Math.ceil(buckets.length / 8) : 1;
  const h = hover !== null ? buckets[hover] : null;

  return (
    <div>
      <div className="relative h-56 flex">
        <div className="w-12 flex flex-col justify-between text-xs text-stone-500 text-right pr-2 pb-6" aria-hidden="true">
          {[...ticks].reverse().map((t) => <span key={t}>{moneyShort(t)}</span>)}
        </div>
        <div className="flex-1 relative">
          <div className="absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between pointer-events-none" aria-hidden="true">
            {ticks.map((t) => <div key={t} className="border-t border-stone-200" />)}
          </div>
          <div
            role="img"
            aria-label={`Sales by ${buckets.length > 14 ? 'day' : 'hour'}. Highest: ${money(max)}.`}
            className="absolute inset-x-0 top-0 bottom-6 flex items-end gap-[2px]"
            onMouseLeave={() => setHover(null)}
          >
            {buckets.map((b, i) => (
              <div key={b.key} className="flex-1 h-full flex items-end justify-center cursor-default" onMouseEnter={() => setHover(i)}>
                <div
                  className={`w-full max-w-[28px] rounded-t ${hover === i ? 'bg-[#8F2E14]' : 'bg-[#C8401C]'}`}
                  style={{ height: `${(b.sales / top) * 100}%`, minHeight: b.sales ? 2 : 0 }}
                />
              </div>
            ))}
          </div>
          <div className="absolute inset-x-0 bottom-0 h-5 flex gap-[2px] text-[11px] text-stone-500" aria-hidden="true">
            {buckets.map((b, i) => <span key={b.key} className="flex-1 text-center truncate">{i % labelEvery === 0 ? b.label : ''}</span>)}
          </div>
          {h && (
            <div className="absolute top-0 right-0 bg-[#1F1A14] text-white text-sm rounded-lg px-3 py-2 pointer-events-none">
              <div className="font-semibold">{h.label}</div>
              <div>{money(h.sales)} · {h.count} sale{h.count === 1 ? '' : 's'}</div>
            </div>
          )}
        </div>
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-stone-600">Show as table</summary>
        <table className="mt-2 w-full max-w-sm">
          <tbody>
            {buckets.filter((b) => b.count).map((b) => (
              <tr key={b.key} className="border-t border-stone-100"><td className="py-1">{b.label}</td><td className="py-1 text-right tabular-nums">{money(b.sales)}</td><td className="py-1 text-right text-stone-500">{b.count}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

export default function DashboardPage() {
  const { user, isAdmin, loading } = useAuth();
  const [period, setPeriod] = useState('today');
  const [sales, setSales] = useState(null);
  const [salesError, setSalesError] = useState(null);
  const [health, setHealth] = useState(null);

  const loadSales = useCallback(async (p) => {
    setSalesError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch(`/api/square/dashboard?period=${p}`, { headers: { Authorization: `Bearer ${data.session?.access_token || ''}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
      setSales(json);
    } catch (e) {
      setSalesError(e.message);
    }
  }, []);

  const loadHealth = useCallback(async () => {
    const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
    const [{ data: products }, { data: cats }, { data: log }, { count: newCustomers }] = await Promise.all([
      supabase.from('catalog_products').select('name, track_inventory, stock_qty, low_stock_alert, show_online, price_cents, photo_url, square_image_url, category_square_id').eq('is_deleted', false),
      supabase.from('catalog_categories').select('square_id, show_online').eq('is_deleted', false),
      supabase.from('sync_log').select('started_at, status, message').order('started_at', { ascending: false }).limit(1),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
    ]);
    const p = products || [];
    const hiddenCats = new Set((cats || []).filter((c) => !c.show_online).map((c) => c.square_id));
    const low = p
      .filter((x) => x.track_inventory && Number(x.stock_qty) <= (x.low_stock_alert ?? 5))
      .sort((a, b) => Number(a.stock_qty) - Number(b.stock_qty))
      .slice(0, 6);
    setHealth({
      low,
      total: p.length,
      online: p.filter((x) => x.show_online && x.price_cents != null && !hiddenCats.has(x.category_square_id)).length,
      noPhoto: p.filter((x) => !x.photo_url && !x.square_image_url).length,
      lastSync: log?.[0] || null,
      newCustomers: newCustomers ?? 0,
    });
  }, []);

  useEffect(() => {
    if (isAdmin) loadHealth();
  }, [isAdmin, loadHealth]);

  useEffect(() => {
    if (isAdmin) loadSales(period);
  }, [isAdmin, period, loadSales]);

  if (loading || !user || !isAdmin) return <AdminLayout />;

  const c = sales?.current;
  const prevLabel = { today: 'same time yesterday', '7d': 'previous 7 days', '30d': 'previous 30 days' }[period];
  const heading = { today: 'Today', '7d': 'Last 7 days', '30d': 'Last 30 days' }[period];
  const todayLabel = new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap justify-between items-end gap-3">
          <div>
            <h1 className="text-3xl font-semibold">{heading}</h1>
            <p className="text-stone-600 mt-1">{todayLabel}{sales?.locationName ? ` · ${sales.locationName}` : ''}</p>
          </div>
          <div role="group" aria-label="Period" className="inline-flex border border-stone-300 rounded-xl overflow-hidden bg-white">
            {PERIODS.map(([id, label]) => (
              <button key={id} type="button" aria-pressed={period === id} onClick={() => setPeriod(id)}
                className={`px-4 min-h-[44px] font-semibold ${period === id ? 'bg-[#1F1A14] text-white' : 'bg-white text-stone-900'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {salesError && <div role="status" className="p-3 rounded-lg border text-sm bg-red-50 border-red-200 text-red-800">{salesError}</div>}
        {sales && !sales.connected && (
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50">Connect Square on <Link href="/admin/settings" className="underline font-semibold">Settings</Link> to see sales.</div>
        )}

        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <div className="bg-white border border-stone-200 rounded-2xl p-4">
            <div className="text-sm text-stone-600">Sales</div>
            <div className="text-3xl font-semibold mt-1 tabular-nums">{c ? money(c.sales) : '…'}</div>
            <div className="text-sm mt-1">{c && <Delta now={c.sales} before={sales.previous.sales} label={prevLabel} />}</div>
          </div>
          <div className="bg-white border border-stone-200 rounded-2xl p-4">
            <div className="text-sm text-stone-600">In store · Online</div>
            <div className="text-xl font-semibold mt-2 tabular-nums">{c ? `${money(c.inStore)} · ${money(c.online)}` : '…'}</div>
            <div className="text-sm text-stone-500 mt-1">{c ? `${c.onlineCount} online order${c.onlineCount === 1 ? '' : 's'}` : ''}</div>
          </div>
          <div className="bg-white border border-stone-200 rounded-2xl p-4">
            <div className="text-sm text-stone-600">Transactions</div>
            <div className="text-3xl font-semibold mt-1 tabular-nums">{c ? c.count : '…'}</div>
            <div className="text-sm mt-1">{c && <Delta now={c.count} before={sales.previous.count} label={prevLabel} />}</div>
          </div>
          <div className="bg-white border border-stone-200 rounded-2xl p-4">
            <div className="text-sm text-stone-600">Average sale</div>
            <div className="text-3xl font-semibold mt-1 tabular-nums">{c ? money(c.average) : '…'}</div>
            <div className="text-sm text-stone-500 mt-1">Per transaction</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-5 items-start">
          <section className="flex-[999_1_560px] min-w-0 bg-white border border-stone-200 rounded-2xl p-5 space-y-4">
            <h2 className="text-lg font-semibold">Sales by {period === 'today' ? 'hour' : 'day'}</h2>
            {sales?.buckets ? <SalesChart buckets={sales.buckets} /> : <div className="h-56 flex items-center justify-center text-stone-500">{salesError ? 'Couldn’t load sales.' : 'Loading…'}</div>}
          </section>

          <section className="flex-[1_1_300px] bg-white border border-stone-200 rounded-2xl p-5">
            <h2 className="text-lg font-semibold mb-2">Top sellers</h2>
            {sales?.top?.length ? (
              <ol>
                {sales.top.map((t, i) => (
                  <li key={t.name} className="flex justify-between gap-3 py-2.5 border-t border-stone-100 text-sm">
                    <span><span className="inline-block w-5 text-stone-500">{i + 1}</span>{t.name}</span>
                    <span className="font-semibold whitespace-nowrap tabular-nums">{t.qty} sold</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-stone-500 py-2">{sales ? 'No sales yet in this period.' : 'Loading…'}</p>
            )}
          </section>
        </div>

        <div className="grid gap-5 md:grid-cols-3 items-start">
          <section className="bg-white border border-stone-200 rounded-2xl p-5">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-semibold">Running low</h2>
              <Link href="/admin/inventory" className="text-sm font-semibold underline">All stock</Link>
            </div>
            {!health && <p className="text-sm text-stone-500">Loading…</p>}
            {health?.low.length === 0 && <p className="text-sm text-stone-500 py-2">Nothing is low.</p>}
            {health?.low.map((p) => (
              <div key={p.name} className="flex justify-between gap-3 py-2.5 border-t border-stone-100 text-sm">
                <span>{p.name}</span>
                <span className={`font-semibold whitespace-nowrap ${Number(p.stock_qty) <= 0 ? 'text-red-700' : 'text-amber-800'}`}>
                  {Number(p.stock_qty) <= 0 ? 'Out' : `${Number(p.stock_qty)} left`}
                </span>
              </div>
            ))}
          </section>

          <section className="bg-white border border-stone-200 rounded-2xl p-5 space-y-3">
            <h2 className="text-lg font-semibold">Online orders to pack</h2>
            <div className="p-5 border-2 border-dashed border-stone-300 rounded-xl text-center text-sm text-stone-600">
              Click &amp; collect orders will appear here once checkout is live.
            </div>
          </section>

          <section className="bg-white border border-stone-200 rounded-2xl p-5">
            <h2 className="text-lg font-semibold mb-2">Website health</h2>
            {health ? (
              <dl className="text-sm">
                <div className="flex justify-between gap-3 py-2 border-t border-stone-100">
                  <dt>Square sync</dt>
                  <dd className={`font-semibold text-right ${health.lastSync?.status === 'error' ? 'text-red-700' : 'text-green-800'}`}>
                    {health.lastSync ? `${health.lastSync.status === 'error' ? 'Failed' : 'Working'} · ${new Date(health.lastSync.started_at).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` : 'Never run'}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 py-2 border-t border-stone-100"><dt>Items shown online</dt><dd className="font-semibold">{health.online} of {health.total}</dd></div>
                <div className="flex justify-between gap-3 py-2 border-t border-stone-100"><dt>Items missing a photo</dt><dd><Link href="/admin" className="font-semibold underline">{health.noPhoto}</Link></dd></div>
                <div className="flex justify-between gap-3 py-2 border-t border-stone-100"><dt>New customer accounts this week</dt><dd className="font-semibold">{health.newCustomers}</dd></div>
              </dl>
            ) : (
              <p className="text-sm text-stone-500">Loading…</p>
            )}
          </section>
        </div>

        <p className="text-xs text-stone-500">
          Sales are completed orders from Square, so till and website sales are counted together. Stock figures are the website’s copy; on your laptop, click Sync now on Settings after test sales.
        </p>
      </div>
    </AdminLayout>
  );
}
