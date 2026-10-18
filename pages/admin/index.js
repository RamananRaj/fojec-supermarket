import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import PageFrame from '../../components/PageFrame';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../lib/AuthContext';

const blankProduct = {
  id: null,
  name: '',
  sku: '',
  category_id: '',
  price: '',
  stock_quantity: 0,
  low_stock_threshold: 10,
  description: '',
  image_url: '',
  is_active: true,
};

export default function AdminPage() {
  const router = useRouter();
  const { user, isAdmin, loading, signOut } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/login?next=/admin');
  }, [loading, user, router]);

  const load = useCallback(async () => {
    const [{ data: p, error: pe }, { data: c, error: ce }] = await Promise.all([
      supabase.from('products').select('*, categories(name)').order('name'),
      supabase.from('categories').select('id, name').order('name'),
    ]);
    if (pe || ce) setError((pe || ce).message);
    setProducts(p || []);
    setCategories(c || []);
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q));
  }, [products, search]);

  const save = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const price = Number(editing.price);
    if (!editing.name.trim()) return setError('Product name is required.');
    if (!editing.category_id) return setError('Choose a category.');
    if (!(price > 0)) return setError('Price must be more than 0.');

    const payload = {
      name: editing.name.trim(),
      sku: editing.sku.trim() || null,
      category_id: editing.category_id,
      price,
      stock_quantity: Math.max(0, parseInt(editing.stock_quantity, 10) || 0),
      low_stock_threshold: Math.max(0, parseInt(editing.low_stock_threshold, 10) || 0),
      description: editing.description.trim() || null,
      image_url: editing.image_url.trim() || null,
      is_active: editing.is_active,
      updated_at: new Date().toISOString(),
    };

    const request = editing.id
      ? supabase.from('products').update(payload).eq('id', editing.id)
      : supabase.from('products').insert(payload);
    const { error: err } = await request;
    if (err) return setError(err.message);

    setMessage(editing.id ? 'Product updated.' : 'Product added.');
    setEditing(null);
    load();
  };

  const toggleActive = async (p) => {
    const { error: err } = await supabase
      .from('products')
      .update({ is_active: !p.is_active, updated_at: new Date().toISOString() })
      .eq('id', p.id);
    if (err) return setError(err.message);
    load();
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete "${p.name}"? This cannot be undone. Hiding it is safer if it has past orders.`)) return;
    const { error: err } = await supabase.from('products').delete().eq('id', p.id);
    if (err) return setError(err.message);
    setMessage('Product deleted.');
    load();
  };

  const set = (field) => (e) => setEditing({ ...editing, [field]: e.target.value });

  if (loading || !user) {
    return <PageFrame title="Admin" wide><p className="text-gray-500">Loading…</p></PageFrame>;
  }

  if (!isAdmin) {
    return (
      <PageFrame title="Admin">
        <div className="bg-white rounded-xl shadow p-6 text-center space-y-3">
          <p className="font-bold text-gray-900">You do not have admin access.</p>
          <button type="button" onClick={async () => { await signOut(); router.replace('/'); }} className="text-green-700 font-bold">
            Log out
          </button>
        </div>
      </PageFrame>
    );
  }

  const input = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600';

  return (
    <PageFrame title="Admin · Products" wide>
      {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
      {message && <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">{message}</div>}

      <div className="flex flex-wrap gap-3 items-center justify-between mb-6">
        <input
          className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
          placeholder="Search by name or SKU"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setEditing({ ...blankProduct, category_id: categories[0]?.id || '' })}
          className="px-5 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold"
        >
          + Add product
        </button>
      </div>

      {editing && (
        <form onSubmit={save} className="bg-white rounded-xl shadow p-6 mb-8 grid gap-4 md:grid-cols-2">
          <h2 className="md:col-span-2 text-lg font-bold">{editing.id ? 'Edit product' : 'New product'}</h2>
          <label className="space-y-1"><span className="text-sm font-medium">Name *</span>
            <input className={input} value={editing.name} onChange={set('name')} required />
          </label>
          <label className="space-y-1"><span className="text-sm font-medium">SKU</span>
            <input className={input} value={editing.sku} onChange={set('sku')} />
          </label>
          <label className="space-y-1"><span className="text-sm font-medium">Category *</span>
            <select className={input} value={editing.category_id} onChange={set('category_id')} required>
              <option value="">Choose…</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="space-y-1"><span className="text-sm font-medium">Price (AUD) *</span>
            <input className={input} type="number" step="0.01" min="0.01" value={editing.price} onChange={set('price')} required />
          </label>
          <label className="space-y-1"><span className="text-sm font-medium">Stock quantity</span>
            <input className={input} type="number" min="0" value={editing.stock_quantity} onChange={set('stock_quantity')} />
          </label>
          <label className="space-y-1"><span className="text-sm font-medium">Low stock alert at</span>
            <input className={input} type="number" min="0" value={editing.low_stock_threshold} onChange={set('low_stock_threshold')} />
          </label>
          <label className="space-y-1 md:col-span-2"><span className="text-sm font-medium">Description</span>
            <textarea className={input} rows={3} value={editing.description} onChange={set('description')} />
          </label>
          <label className="space-y-1 md:col-span-2"><span className="text-sm font-medium">Image URL</span>
            <input className={input} value={editing.image_url} onChange={set('image_url')} placeholder="Paste a link for now; uploads come later" />
          </label>
          <label className="flex items-center gap-2 md:col-span-2">
            <input type="checkbox" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
            <span className="text-sm">Show on website</span>
          </label>
          <div className="md:col-span-2 flex gap-3">
            <button type="submit" className="px-5 py-2 rounded-lg bg-green-700 hover:bg-green-800 text-white font-bold">Save</button>
            <button type="button" onClick={() => setEditing(null)} className="px-5 py-2 rounded-lg border border-gray-300 font-bold">Cancel</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Category</th>
              <th className="p-3 text-right">Price</th>
              <th className="p-3 text-right">Stock</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-3 font-medium">{p.name}<div className="text-xs text-gray-500">{p.sku}</div></td>
                <td className="p-3">{p.categories?.name || '—'}</td>
                <td className="p-3 text-right">${Number(p.price).toFixed(2)}</td>
                <td className={`p-3 text-right ${p.stock_quantity <= p.low_stock_threshold ? 'text-red-600 font-bold' : ''}`}>{p.stock_quantity}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${p.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                    {p.is_active ? 'Live' : 'Hidden'}
                  </span>
                </td>
                <td className="p-3 text-right whitespace-nowrap space-x-2">
                  <button type="button" onClick={() => setEditing({ ...blankProduct, ...p, price: p.price, category_id: p.category_id || '', sku: p.sku || '', description: p.description || '', image_url: p.image_url || '' })} className="text-green-700 font-bold">Edit</button>
                  <button type="button" onClick={() => toggleActive(p)} className="text-gray-700 font-bold">{p.is_active ? 'Hide' : 'Show'}</button>
                  <button type="button" onClick={() => remove(p)} className="text-red-600 font-bold">Delete</button>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-gray-500">No products yet. Click “Add product”.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </PageFrame>
  );
}
