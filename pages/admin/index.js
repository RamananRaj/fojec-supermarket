import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AdminLayout from '../../components/AdminLayout';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';

const PAGE_SIZE = 25;
const input = 'w-full px-3 py-2.5 border border-stone-300 rounded-lg bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#C8401C]';
const primary = 'px-5 py-2.5 rounded-lg bg-[#C8401C] hover:bg-[#A8361A] text-white font-semibold disabled:opacity-50 min-h-[44px]';
const secondary = 'px-5 py-2.5 rounded-lg border border-stone-300 bg-white font-semibold disabled:opacity-50 min-h-[44px]';

const money = (cents) => (cents == null ? '—' : `$${(cents / 100).toFixed(2)}`);

function status(p, categoryHidden) {
  if (p.price_cents == null) return { label: 'Needs price', cls: 'bg-amber-100 text-amber-900' };
  if (!p.show_online || categoryHidden) return { label: 'Hidden', cls: 'bg-stone-200 text-stone-700' };
  if (p.track_inventory && Number(p.stock_qty) <= 0) return { label: 'Sold out', cls: 'bg-red-100 text-red-800' };
  return { label: 'Shown', cls: 'bg-green-100 text-green-900' };
}

async function api(path, body) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

export default function AdminProductsPage() {
  const { user, isAdmin, loading } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [show, setShow] = useState('all');
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    const [{ data: p, error: pe }, { data: c, error: ce }] = await Promise.all([
      supabase.from('catalog_products').select('*').eq('is_deleted', false).order('name'),
      supabase.from('catalog_categories').select('square_id, name, show_online').eq('is_deleted', false).order('name'),
    ]);
    if (pe || ce) setMessage({ ok: false, text: (pe || ce).message });
    setProducts(p || []);
    setCategories(c || []);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const catMap = useMemo(() => new Map(categories.map((c) => [c.square_id, c])), [categories]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (q && !`${p.name} ${p.sku || ''} ${p.search_keywords || ''}`.toLowerCase().includes(q)) return false;
      if (category && p.category_square_id !== category) return false;
      const st = status(p, catMap.get(p.category_square_id)?.show_online === false).label;
      if (show === 'shown' && st !== 'Shown') return false;
      if (show === 'hidden' && st !== 'Hidden') return false;
      if (show === 'soldout' && st !== 'Sold out') return false;
      if (show === 'noprice' && st !== 'Needs price') return false;
      if (show === 'nophoto' && (p.photo_url || p.square_image_url)) return false;
      return true;
    });
  }, [products, search, category, show, catMap]);

  useEffect(() => setPage(0), [search, category, show]);
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const shown = visible.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const open = (p) => {
    setMessage(null);
    setEditing({
      ...p,
      itemName: p.item_name || p.name,
      price: p.price_cents != null ? (p.price_cents / 100).toFixed(2) : '',
      categoryId: p.category_square_id || '',
      photo_url: p.photo_url || '',
      website_description: p.website_description || '',
      search_keywords: p.search_keywords || '',
    });
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const orig = products.find((p) => p.square_variation_id === editing.square_variation_id);
      const priceCents = Math.round(Number(editing.price) * 100);
      const squareChanged =
        editing.itemName.trim() !== (orig.item_name || orig.name) ||
        priceCents !== orig.price_cents ||
        (editing.categoryId || null) !== (orig.category_square_id || null);

      if (squareChanged) {
        await api('/api/square/item', {
          variationId: editing.square_variation_id,
          itemName: editing.itemName,
          price: editing.price,
          categoryId: editing.categoryId || null,
        });
      }

      const { error } = await supabase
        .from('catalog_products')
        .update({
          photo_url: editing.photo_url.trim() || null,
          website_description: editing.website_description.trim() || null,
          search_keywords: editing.search_keywords.trim() || null,
          show_online: editing.show_online,
          featured: editing.featured,
          updated_at: new Date().toISOString(),
        })
        .eq('square_variation_id', editing.square_variation_id);
      if (error) throw error;

      setMessage({ ok: true, text: squareChanged ? 'Saved to Square and the website.' : 'Saved.' });
      setEditing(null);
      await load();
    } catch (err) {
      setMessage({ ok: false, text: err.message });
    }
    setSaving(false);
  };

  if (loading || !user || !isAdmin) return <AdminLayout />;

  const set = (field) => (e) => setEditing({ ...editing, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold">Products</h1>
            <p className="text-stone-600 mt-1">
              {products.length} items from Square. Name, price and category save to Square. Photos, description and Featured are website-only.
            </p>
          </div>
          <Link href="/admin/settings" className={secondary + ' inline-flex items-center'}>Sync settings</Link>
        </div>

        {message && (
          <div role="status" className={`p-3 rounded-lg border text-sm ${message.ok ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-800'}`}>
            {message.text}
          </div>
        )}

        {loaded && products.length === 0 && (
          <div className="bg-white border border-stone-200 rounded-2xl p-6">
            <p className="font-semibold">No products yet.</p>
            <p className="text-stone-600 mt-1">
              Go to <Link href="/admin/settings" className="underline font-semibold">Settings</Link> and click <strong>Sync now</strong> to bring products across from Square.
            </p>
          </div>
        )}

        {products.length > 0 && (
          <>
            <div className="flex flex-wrap gap-3">
              <label className="flex-1 min-w-[220px]">
                <span className="sr-only">Search products</span>
                <input className={input} placeholder="Search by name, SKU or search words" value={search} onChange={(e) => setSearch(e.target.value)} />
              </label>
              <label>
                <span className="sr-only">Category</span>
                <select className={input} value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">All categories</option>
                  {categories.map((c) => <option key={c.square_id} value={c.square_id}>{c.name}</option>)}
                </select>
              </label>
              <label>
                <span className="sr-only">Show</span>
                <select className={input} value={show} onChange={(e) => setShow(e.target.value)}>
                  <option value="all">All items</option>
                  <option value="shown">Shown online</option>
                  <option value="hidden">Hidden online</option>
                  <option value="soldout">Sold out</option>
                  <option value="noprice">Needs a price</option>
                  <option value="nophoto">No photo</option>
                </select>
              </label>
            </div>

            <div className="flex flex-wrap gap-5 items-start">
              <div className="flex-[999_1_600px] min-w-0 bg-white border border-stone-200 rounded-2xl overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead className="bg-stone-100 text-left">
                    <tr>
                      <th className="p-3">Product</th>
                      <th className="p-3">Category</th>
                      <th className="p-3 text-right">Price</th>
                      <th className="p-3 text-right">Stock</th>
                      <th className="p-3">Online</th>
                      <th className="p-3"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((p) => {
                      const st = status(p, catMap.get(p.category_square_id)?.show_online === false);
                      const img = p.photo_url || p.square_image_url;
                      const qty = p.track_inventory ? Number(p.stock_qty) : null;
                      const selected = editing?.square_variation_id === p.square_variation_id;
                      return (
                        <tr key={p.square_variation_id} className={`border-t border-stone-100 ${selected ? 'bg-amber-50' : ''}`}>
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              {img ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={img} alt="" className="w-11 h-11 rounded-lg object-cover flex-none" />
                              ) : (
                                <div className="w-11 h-11 rounded-lg border-2 border-dashed border-stone-300 text-[10px] leading-tight text-stone-500 flex items-center justify-center text-center flex-none">No photo</div>
                              )}
                              <div>
                                <div className="font-medium">{p.name}{p.featured && <span className="ml-2 text-xs font-semibold text-amber-800">Featured</span>}</div>
                                <div className="text-xs text-stone-500">{p.sku}</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-stone-700">{catMap.get(p.category_square_id)?.name || '—'}</td>
                          <td className="p-3 text-right tabular-nums">{money(p.price_cents)}</td>
                          <td className={`p-3 text-right tabular-nums ${qty === null ? 'text-stone-500' : qty <= 0 ? 'text-red-700 font-semibold' : qty <= (p.low_stock_alert ?? 5) ? 'text-amber-800 font-semibold' : ''}`}>
                            {qty === null ? 'Not tracked' : qty}
                          </td>
                          <td className="p-3"><span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${st.cls}`}>{st.label}</span></td>
                          <td className="p-3 text-right">
                            <button type="button" onClick={() => open(p)} className="px-3 py-1.5 rounded-lg border border-stone-300 font-semibold">Edit</button>
                          </td>
                        </tr>
                      );
                    })}
                    {shown.length === 0 && (
                      <tr><td colSpan={6} className="p-6 text-center text-stone-500">No products match.</td></tr>
                    )}
                  </tbody>
                </table>
                <div className="flex justify-between items-center p-3 border-t border-stone-100 text-sm text-stone-600">
                  <span>{visible.length === 0 ? 'No items' : `Showing ${page * PAGE_SIZE + 1}–${Math.min(visible.length, (page + 1) * PAGE_SIZE)} of ${visible.length}`}</span>
                  <span className="flex gap-2">
                    <button type="button" className="px-3 py-1 rounded border border-stone-300 disabled:opacity-40" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
                    <button type="button" className="px-3 py-1 rounded border border-stone-300 disabled:opacity-40" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</button>
                  </span>
                </div>
              </div>

              {editing && (
                <form onSubmit={save} aria-label="Edit product" className="flex-[1_1_340px] bg-white border border-stone-200 rounded-2xl p-5 space-y-4">
                  <div className="flex justify-between items-start gap-3">
                    <h2 className="text-lg font-semibold">{editing.name}</h2>
                    <button type="button" aria-label="Close" onClick={() => setEditing(null)} className="w-10 h-10 rounded-lg border border-stone-200 flex-none">✕</button>
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs font-semibold tracking-wider uppercase text-stone-500">Saved to Square</p>
                    <label className="block space-y-1.5"><span className="font-medium">Name</span><input className={input} value={editing.itemName} onChange={set('itemName')} required /></label>
                    {editing.variation_name && editing.item_name && editing.name !== editing.item_name && (
                      <p className="text-xs text-stone-500">Variation: {editing.variation_name}. Renaming changes every variation of this item.</p>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block space-y-1.5"><span className="font-medium">Price (AUD)</span><input className={input} type="number" step="0.01" min="0.01" value={editing.price} onChange={set('price')} required /></label>
                      <label className="block space-y-1.5"><span className="font-medium">SKU</span><input className={`${input} bg-stone-50`} value={editing.sku || ''} readOnly /></label>
                    </div>
                    <label className="block space-y-1.5">
                      <span className="font-medium">Category</span>
                      <select className={input} value={editing.categoryId} onChange={set('categoryId')}>
                        <option value="">No category</option>
                        {categories.map((c) => <option key={c.square_id} value={c.square_id}>{c.name}</option>)}
                      </select>
                    </label>
                    <p className="text-xs text-stone-500">Change stock on the <Link href="/admin/inventory" className="underline">Inventory</Link> screen, so each change has a reason recorded.</p>
                  </div>

                  <hr className="border-stone-200" />

                  <div className="space-y-3">
                    <p className="text-xs font-semibold tracking-wider uppercase text-stone-500">Website only</p>
                    {editing.square_image_url && !editing.photo_url && <p className="text-xs text-stone-500">Using the photo from Square. Add a link below to use a different one.</p>}
                    <label className="block space-y-1.5"><span className="font-medium">Photo link</span><input className={input} value={editing.photo_url} onChange={set('photo_url')} placeholder="https://… (photo uploads come later)" /></label>
                    <label className="block space-y-1.5">
                      <span className="font-medium">Description</span>
                      <textarea className={input} rows={3} value={editing.website_description} onChange={set('website_description')} placeholder={editing.square_description || 'e.g. origin, how to prepare'} />
                    </label>
                    <label className="block space-y-1.5"><span className="font-medium">Search words</span><input className={input} value={editing.search_keywords} onChange={set('search_keywords')} placeholder="e.g. cassava, eba, gari" /></label>
                    <label className="flex items-center gap-3 min-h-[44px]"><input type="checkbox" className="w-5 h-5" checked={Boolean(editing.show_online)} onChange={set('show_online')} />Show on website</label>
                    <label className="flex items-center gap-3 min-h-[44px]"><input type="checkbox" className="w-5 h-5" checked={Boolean(editing.featured)} onChange={set('featured')} />Feature on home page</label>
                  </div>

                  <div className="flex gap-3 flex-wrap">
                    <button type="submit" className={primary} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                    <button type="button" className={secondary} onClick={() => setEditing(null)}>Cancel</button>
                  </div>
                </form>
              )}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
