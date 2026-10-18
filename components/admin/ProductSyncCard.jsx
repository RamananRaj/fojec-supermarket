import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

const primary = 'px-5 py-2.5 rounded-lg bg-[#C8401C] hover:bg-[#A8361A] text-white font-semibold disabled:opacity-50 min-h-[44px]';
const when = (t) => (t ? new Date(t).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const KIND = { manual: 'Sync now', webhook: 'Change in Square', nightly: 'Nightly check', edit: 'Edit from admin' };

// Settings card: sync status, Sync now, recent activity, and which Square
// categories appear on the website.
export default function ProductSyncCard({ connected, hasLocation }) {
  const [log, setLog] = useState([]);
  const [stats, setStats] = useState(null);
  const [cats, setCats] = useState([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);

  const load = useCallback(async () => {
    const [{ data: l }, { data: p }, { data: c }] = await Promise.all([
      supabase.from('sync_log').select('*').order('started_at', { ascending: false }).limit(6),
      supabase.from('catalog_products').select('category_square_id, price_cents, photo_url, square_image_url, show_online').eq('is_deleted', false),
      supabase.from('catalog_categories').select('square_id, name, show_online').eq('is_deleted', false).order('name'),
    ]);
    const products = p || [];
    setLog(l || []);
    setCats((c || []).map((cat) => ({ ...cat, count: products.filter((x) => x.category_square_id === cat.square_id).length })));
    setStats({
      total: products.length,
      noPrice: products.filter((x) => x.price_cents == null).length,
      noPhoto: products.filter((x) => !x.photo_url && !x.square_image_url).length,
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const syncNow = async () => {
    setBusy(true);
    setNote(null);
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch('/api/square/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${data.session?.access_token || ''}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Sync failed (${res.status})`);
      setNote({ ok: true, text: `Synced ${json.items} products and ${json.categories} categories from Square.` });
    } catch (e) {
      setNote({ ok: false, text: e.message });
    }
    await load();
    setBusy(false);
  };

  const toggleCategory = async (cat) => {
    const { error } = await supabase.from('catalog_categories').update({ show_online: !cat.show_online }).eq('square_id', cat.square_id);
    if (error) setNote({ ok: false, text: error.message });
    load();
  };

  const last = log[0];

  return (
    <section className="bg-white border border-stone-200 rounded-2xl p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Product sync</h2>
        <button type="button" className={primary} disabled={busy || !connected || !hasLocation} onClick={syncNow}>
          {busy ? 'Syncing…' : 'Sync now'}
        </button>
      </div>

      {!connected && <p className="text-sm text-stone-600">Connect Square first.</p>}
      {connected && !hasLocation && <p className="text-sm text-amber-800">Choose a store location first.</p>}

      {note && (
        <div role="status" className={`p-3 rounded-lg border text-sm ${note.ok ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {note.text}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-stone-50 rounded-xl p-3"><div className="text-xs text-stone-600">Last sync</div><div className="font-semibold mt-1 text-sm">{last ? when(last.finished_at || last.started_at) : 'Never'}</div></div>
        <div className="bg-stone-50 rounded-xl p-3"><div className="text-xs text-stone-600">Products</div><div className="font-semibold mt-1">{stats ? stats.total : '…'}</div></div>
        <div className={`rounded-xl p-3 ${stats?.noPrice ? 'bg-amber-50' : 'bg-stone-50'}`}><div className="text-xs text-stone-600">Need a price</div><div className="font-semibold mt-1">{stats ? stats.noPrice : '…'}</div></div>
      </div>

      {stats?.noPhoto > 0 && (
        <div className="flex justify-between gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50 text-sm">
          <span>{stats.noPhoto} product{stats.noPhoto === 1 ? ' has' : 's have'} no photo</span>
          <Link href="/admin" className="font-semibold underline">Add photos</Link>
        </div>
      )}

      <p className="text-sm text-stone-600">
        On the live site, changes in Square appear within seconds, and a full check runs every night. On your laptop, use Sync now.
      </p>

      {cats.length > 0 && (
        <fieldset className="space-y-1">
          <legend className="font-medium mb-2">Square categories shown online</legend>
          {cats.map((c) => (
            <label key={c.square_id} className="flex items-center gap-3 min-h-[44px]">
              <input type="checkbox" className="w-5 h-5" checked={c.show_online} onChange={() => toggleCategory(c)} />
              {c.name} <span className="text-sm text-stone-500">· {c.count} item{c.count === 1 ? '' : 's'}</span>
            </label>
          ))}
        </fieldset>
      )}

      {log.length > 0 && (
        <div>
          <div className="font-medium mb-2">Recent sync activity</div>
          <div className="overflow-x-auto border border-stone-200 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left">
                <tr><th className="p-2.5">When</th><th className="p-2.5">What</th><th className="p-2.5">Result</th></tr>
              </thead>
              <tbody>
                {log.map((l) => (
                  <tr key={l.id} className="border-t border-stone-100">
                    <td className="p-2.5 whitespace-nowrap text-stone-600">{when(l.started_at)}</td>
                    <td className="p-2.5">{KIND[l.kind] || l.kind}</td>
                    <td className={`p-2.5 ${l.status === 'error' ? 'text-red-700' : l.status === 'warning' ? 'text-amber-800' : ''}`}>{l.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
