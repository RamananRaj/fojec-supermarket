import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import AdminLayout from '../../components/AdminLayout';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';

const input = 'w-full px-3 py-2.5 border border-stone-300 rounded-lg bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#C8401C]';
const primary = 'px-5 py-2.5 rounded-lg bg-[#C8401C] hover:bg-[#A8361A] text-white font-semibold disabled:opacity-50 min-h-[44px]';
const KINDS = [
  { id: 'delivery', label: 'Delivery', qtyLabel: 'Quantity received' },
  { id: 'writeoff', label: 'Write-off', qtyLabel: 'Quantity to write off' },
  { id: 'stocktake', label: 'Stocktake', qtyLabel: 'Quantity counted on the shelf' },
];
const when = (t) => new Date(t).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const newKey = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

async function authed(path, options = {}) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}`, ...(options.headers || {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

function stockState(p) {
  if (!p.track_inventory) return 'untracked';
  const q = Number(p.stock_qty);
  if (q <= 0) return 'out';
  if (q <= (p.low_stock_alert ?? 5)) return 'low';
  return 'ok';
}

export default function InventoryPage() {
  const { user, isAdmin, loading } = useAuth();
  const [products, setProducts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState('levels');
  const [search, setSearch] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);
  const [history, setHistory] = useState(null);
  const [historyError, setHistoryError] = useState(null);
  const [form, setForm] = useState({ variationId: '', kind: 'delivery', quantity: '', note: '' });
  const [alertAt, setAlertAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const keyRef = useRef(newKey());
  const formRef = useRef(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('catalog_products')
      .select('square_variation_id, name, sku, track_inventory, stock_qty, low_stock_alert, synced_at')
      .eq('is_deleted', false)
      .order('name');
    if (error) setMessage({ ok: false, text: error.message });
    setProducts(data || []);
    setLoaded(true);
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryError(null);
    try {
      const r = await authed('/api/square/inventory-history?days=14');
      setHistory(r.changes);
    } catch (e) {
      setHistoryError(e.message);
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      load();
      loadHistory();
    }
  }, [isAdmin, load, loadHistory]);

  const tracked = products.filter((p) => p.track_inventory);
  const counts = {
    tracked: tracked.length,
    low: products.filter((p) => stockState(p) === 'low').length,
    out: products.filter((p) => stockState(p) === 'out').length,
    untracked: products.length - tracked.length,
  };

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((p) => !q || `${p.name} ${p.sku || ''}`.toLowerCase().includes(q))
      .filter((p) => !onlyLow || ['low', 'out'].includes(stockState(p)))
      .sort((a, b) => {
        const rank = { out: 0, low: 1, ok: 2, untracked: 3 };
        return rank[stockState(a)] - rank[stockState(b)] || a.name.localeCompare(b.name);
      });
  }, [products, search, onlyLow]);

  const selected = products.find((p) => p.square_variation_id === form.variationId);
  useEffect(() => {
    setAlertAt(selected ? String(selected.low_stock_alert ?? 5) : '');
  }, [selected]);

  const qty = parseInt(form.quantity, 10);
  const current = selected?.track_inventory ? Number(selected.stock_qty) : null;
  let preview = null;
  if (selected?.track_inventory && Number.isInteger(qty) && qty >= 0) {
    const next = form.kind === 'delivery' ? current + qty : form.kind === 'writeoff' ? current - qty : qty;
    preview = `${current} → ${next}`;
  }

  const pick = (p) => {
    setMessage(null);
    setForm((f) => ({ ...f, variationId: p.square_variation_id }));
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const r = await authed('/api/square/inventory', {
        method: 'POST',
        body: JSON.stringify({ ...form, idempotencyKey: keyRef.current }),
      });
      keyRef.current = newKey();
      setMessage({ ok: true, text: `${r.label} saved to Square: ${selected?.name} ${r.before} → ${r.after}.` });
      setForm((f) => ({ ...f, quantity: '', note: '' }));
      await Promise.all([load(), loadHistory()]);
    } catch (err) {
      setMessage({ ok: false, text: err.message });
    }
    setSaving(false);
  };

  const saveAlert = async () => {
    const n = parseInt(alertAt, 10);
    if (!(n >= 0)) return setMessage({ ok: false, text: 'Alert level must be 0 or more.' });
    const { error } = await supabase.from('catalog_products').update({ low_stock_alert: n }).eq('square_variation_id', form.variationId);
    setMessage(error ? { ok: false, text: error.message } : { ok: true, text: `Low-stock alert for ${selected?.name} set to ${n}.` });
    load();
  };

  if (loading || !user || !isAdmin) return <AdminLayout />;

  const kind = KINDS.find((k) => k.id === form.kind);

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-3xl font-semibold">Inventory</h1>
          <p className="text-stone-600 mt-1">Stock counts are Square’s. Till sales and online orders both take from the same count.</p>
        </div>

        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <div className="bg-white border border-stone-200 rounded-2xl p-4"><div className="text-sm text-stone-600">Items tracked</div><div className="text-3xl font-semibold mt-1">{loaded ? counts.tracked : '…'}</div></div>
          <div className="bg-white border border-stone-200 rounded-2xl p-4"><div className="text-sm text-amber-800">Low stock</div><div className="text-3xl font-semibold mt-1 text-amber-800">{loaded ? counts.low : '…'}</div></div>
          <div className="bg-white border border-stone-200 rounded-2xl p-4"><div className="text-sm text-red-700">Out of stock</div><div className="text-3xl font-semibold mt-1 text-red-700">{loaded ? counts.out : '…'}</div></div>
          <div className="bg-white border border-stone-200 rounded-2xl p-4"><div className="text-sm text-stone-600">Not tracked in Square</div><div className="text-3xl font-semibold mt-1">{loaded ? counts.untracked : '…'}</div></div>
        </div>

        {message && (
          <div role="status" className={`p-3 rounded-lg border text-sm ${message.ok ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-800'}`}>
            {message.text}
          </div>
        )}

        {loaded && products.length === 0 && (
          <div className="bg-white border border-stone-200 rounded-2xl p-6">
            No products yet. Go to <Link href="/admin/settings" className="underline font-semibold">Settings</Link> and click <strong>Sync now</strong>.
          </div>
        )}

        <div className="flex flex-wrap gap-5 items-start">
          <div className="flex-[999_1_600px] min-w-0 space-y-3">
            <div className="flex flex-wrap gap-3 items-center">
              <div role="tablist" aria-label="Inventory views" className="inline-flex border border-stone-300 rounded-xl overflow-hidden bg-white">
                {[['levels', 'Stock levels'], ['history', 'Stock history']].map(([id, label]) => (
                  <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)}
                    className={`px-4 min-h-[44px] font-semibold ${view === id ? 'bg-[#1F1A14] text-white' : 'bg-white text-stone-900'}`}>
                    {label}
                  </button>
                ))}
              </div>
              {view === 'levels' && (
                <>
                  <label className="flex-1 min-w-[200px]">
                    <span className="sr-only">Search stock</span>
                    <input className={input} placeholder="Search by name or SKU" value={search} onChange={(e) => setSearch(e.target.value)} />
                  </label>
                  <label className="flex items-center gap-2 min-h-[44px]">
                    <input type="checkbox" className="w-5 h-5" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} />
                    Low and out of stock only
                  </label>
                </>
              )}
              {view === 'history' && (
                <button type="button" onClick={loadHistory} className="px-4 min-h-[44px] rounded-lg border border-stone-300 bg-white font-semibold">Refresh</button>
              )}
            </div>

            {view === 'levels' && (
              <div className="bg-white border border-stone-200 rounded-2xl overflow-x-auto">
                <table className="w-full text-sm min-w-[600px]">
                  <thead className="bg-stone-100 text-left">
                    <tr>
                      <th className="p-3">Product</th>
                      <th className="p-3 text-right">In stock</th>
                      <th className="p-3 text-right">Alert at</th>
                      <th className="p-3">Status</th>
                      <th className="p-3"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((p) => {
                      const st = stockState(p);
                      const pill = {
                        out: ['Out of stock', 'bg-red-100 text-red-800'],
                        low: ['Low', 'bg-amber-100 text-amber-900'],
                        ok: ['OK', 'bg-green-100 text-green-900'],
                        untracked: ['Not tracked', 'bg-stone-200 text-stone-700'],
                      }[st];
                      return (
                        <tr key={p.square_variation_id} className={`border-t border-stone-100 ${form.variationId === p.square_variation_id ? 'bg-amber-50' : ''}`}>
                          <td className="p-3"><div className="font-medium">{p.name}</div><div className="text-xs text-stone-500">{p.sku}</div></td>
                          <td className={`p-3 text-right tabular-nums font-semibold ${st === 'out' ? 'text-red-700' : st === 'low' ? 'text-amber-800' : ''}`}>{p.track_inventory ? Number(p.stock_qty) : '—'}</td>
                          <td className="p-3 text-right tabular-nums text-stone-600">{p.track_inventory ? p.low_stock_alert ?? 5 : '—'}</td>
                          <td className="p-3"><span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${pill[1]}`}>{pill[0]}</span></td>
                          <td className="p-3 text-right">
                            <button type="button" onClick={() => pick(p)} disabled={!p.track_inventory}
                              className="px-3 py-1.5 rounded-lg border border-stone-300 font-semibold disabled:opacity-40">Adjust</button>
                          </td>
                        </tr>
                      );
                    })}
                    {loaded && visible.length === 0 && products.length > 0 && (
                      <tr><td colSpan={5} className="p-6 text-center text-stone-500">{onlyLow ? 'Nothing is low or out of stock.' : 'No products match.'}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {view === 'history' && (
              <div className="bg-white border border-stone-200 rounded-2xl overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead className="bg-stone-100 text-left">
                    <tr>
                      <th className="p-3">When</th>
                      <th className="p-3">Product</th>
                      <th className="p-3">What</th>
                      <th className="p-3 text-right">Change</th>
                      <th className="p-3">By / note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history === null && <tr><td colSpan={5} className="p-6 text-center text-stone-500">Loading…</td></tr>}
                    {historyError && <tr><td colSpan={5} className="p-6 text-center text-red-700">{historyError}</td></tr>}
                    {history?.map((h) => (
                      <tr key={h.id} className="border-t border-stone-100">
                        <td className="p-3 whitespace-nowrap text-stone-600">{when(h.at)}</td>
                        <td className="p-3 font-medium">{h.product}</td>
                        <td className="p-3">{h.label}</td>
                        <td className={`p-3 text-right tabular-nums font-semibold whitespace-nowrap ${h.dir > 0 ? 'text-green-800' : h.dir < 0 ? 'text-stone-800' : ''}`}>{h.change}</td>
                        <td className="p-3 text-stone-700">{h.by}{h.note ? <span className="block text-stone-500">“{h.note}”</span> : null}</td>
                      </tr>
                    ))}
                    {history && !historyError && history.length === 0 && (
                      <tr><td colSpan={5} className="p-6 text-center text-stone-500">No stock changes in the last 14 days.</td></tr>
                    )}
                  </tbody>
                </table>
                <p className="p-3 text-xs text-stone-500 border-t border-stone-100">Last 14 days, straight from Square. Includes till sales and changes made in the Square app.</p>
              </div>
            )}
          </div>

          <div ref={formRef} className="flex-[1_1_340px] space-y-5">
            <form onSubmit={submit} aria-label="Record a stock change" className="bg-white border border-stone-200 rounded-2xl p-5 space-y-4">
              <h2 className="text-lg font-semibold">Record a stock change</h2>
              <fieldset>
                <legend className="sr-only">Type of change</legend>
                <div className="grid grid-cols-3 gap-2">
                  {KINDS.map((k) => (
                    <label key={k.id} className={`flex items-center justify-center min-h-[44px] rounded-xl text-sm cursor-pointer ${form.kind === k.id ? 'border-2 border-[#1F1A14] font-semibold' : 'border border-stone-300'}`}>
                      <input type="radio" name="kind" className="sr-only" checked={form.kind === k.id} onChange={() => setForm({ ...form, kind: k.id })} />
                      {k.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="block space-y-1.5">
                <span className="font-medium">Product</span>
                <select className={input} value={form.variationId} onChange={(e) => setForm({ ...form, variationId: e.target.value })} required>
                  <option value="">Choose…</option>
                  {tracked.map((p) => <option key={p.square_variation_id} value={p.square_variation_id}>{p.name} · {Number(p.stock_qty)} in stock</option>)}
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="font-medium">{kind.qtyLabel}</span>
                <input className={input} type="number" min={form.kind === 'stocktake' ? 0 : 1} step="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
              </label>
              <label className="block space-y-1.5">
                <span className="font-medium">{form.kind === 'writeoff' ? 'Reason' : 'Note'}</span>
                <input className={input} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} required={form.kind === 'writeoff'}
                  placeholder={form.kind === 'delivery' ? 'Supplier, invoice number' : form.kind === 'writeoff' ? 'Damaged, expired…' : 'Optional'} />
              </label>
              {preview && <div className="p-3 rounded-lg bg-stone-50 text-sm">New count: <strong>{preview}</strong></div>}
              <button type="submit" className={`${primary} w-full`} disabled={saving || !form.variationId}>{saving ? 'Saving…' : 'Save to Square'}</button>
            </form>

            {selected && (
              <div className="bg-white border border-stone-200 rounded-2xl p-5 space-y-3">
                <h2 className="text-lg font-semibold">Low-stock alert</h2>
                <p className="text-sm text-stone-600">Show {selected.name} as low when stock reaches this number. Website-only.</p>
                <div className="flex gap-3">
                  <label className="flex-1"><span className="sr-only">Alert at</span><input className={input} type="number" min="0" value={alertAt} onChange={(e) => setAlertAt(e.target.value)} /></label>
                  <button type="button" onClick={saveAlert} className="px-5 min-h-[44px] rounded-lg border border-stone-300 bg-white font-semibold">Save</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
