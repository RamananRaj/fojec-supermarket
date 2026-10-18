// Loads the products shoppers can see, applying the admin's website settings.
import { supabase } from './supabaseClient';

const EMOJI = { 'african foodstuffs': '🍚', 'frozen foods': '🥶', 'teas & beverages': '☕', 'make-up services': '💄' };
export const categoryEmoji = (name = '') => EMOJI[name.toLowerCase()] || '🛒';

export async function loadShopCatalog() {
  if (!supabase) return { products: [], categories: [] };
  const [{ data: p }, { data: c }, { data: s }] = await Promise.all([
    supabase
      .from('catalog_products')
      .select('square_variation_id, name, price_cents, track_inventory, stock_qty, photo_url, square_image_url, website_description, square_description, search_keywords, featured, show_online, category_square_id')
      .eq('is_deleted', false)
      .eq('show_online', true)
      .not('price_cents', 'is', null)
      .order('name'),
    supabase.from('catalog_categories').select('square_id, name, show_online').eq('is_deleted', false).order('name'),
    supabase.from('shop_settings').select('out_of_stock_mode, hold_back_qty').eq('id', 1).maybeSingle(),
  ]);

  const holdBack = Math.max(0, Number(s?.hold_back_qty ?? 0));
  const hideSoldOut = s?.out_of_stock_mode === 'hide';
  const cats = (c || []).filter((x) => x.show_online);
  const catById = new Map(cats.map((x) => [x.square_id, x]));
  const hiddenCats = new Set((c || []).filter((x) => !x.show_online).map((x) => x.square_id));

  const products = (p || [])
    .filter((x) => !hiddenCats.has(x.category_square_id))
    .map((x) => {
      // Hold back the last few units for the shop so they aren't sold twice.
      const available = x.track_inventory ? Math.max(0, Math.floor(Number(x.stock_qty) - holdBack)) : null;
      return {
        id: x.square_variation_id,
        name: x.name,
        price: x.price_cents / 100,
        category: catById.get(x.category_square_id)?.name || 'Other',
        imageUrl: x.photo_url || x.square_image_url || null,
        emoji: categoryEmoji(catById.get(x.category_square_id)?.name),
        description: x.website_description || x.square_description || '',
        keywords: x.search_keywords || '',
        featured: x.featured,
        stock: available,               // null = not tracked (always available)
        soldOut: available !== null && available <= 0,
      };
    })
    .filter((x) => !(hideSoldOut && x.soldOut));

  const categories = cats
    .filter((cat) => products.some((x) => x.category === cat.name))
    .map((cat) => ({ id: cat.square_id, name: cat.name, emoji: categoryEmoji(cat.name) }));

  return { products, categories };
}
