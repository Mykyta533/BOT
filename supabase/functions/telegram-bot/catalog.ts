import { supabase } from './telegram.ts';
import type { Category, Product } from './types.ts';
import { paginatedKeyboard, productCardKeyboard, backKeyboard } from './keyboards.ts';
import { tgSendMessage, tgEditMessage, tgSendPhoto, logEvent } from './telegram.ts';

const PER_PAGE = 10;
const STORAGE_URL = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/product-images`;

export async function showCatalog(chatId: number, messageId?: number): Promise<void> {
  const { data } = await supabase
    .from('categories')
    .select('*')
    .is('parent_id', null)
    .eq('is_active', true)
    .order('sort_order');
  const cats = (data || []) as Category[];
  if (!cats.length) {
    await tgSendMessage(chatId, 'Каталог порожній.');
    return;
  }
  const items = cats.map((c) => ({ id: c.id, label: c.name }));
  const kb = paginatedKeyboard(items, 0, 50, 'cat', 'menu');
  const text = '🛍 <b>Каталог</b>\n\nОберіть категорію:';
  if (messageId) {
    await tgEditMessage(chatId, messageId, text, kb);
  } else {
    await tgSendMessage(chatId, text, kb);
  }
}

export async function showSubcategories(
  chatId: number,
  parentId: string,
  messageId?: number,
): Promise<void> {
  const { data: children } = await supabase
    .from('categories')
    .select('*')
    .eq('parent_id', parentId)
    .eq('is_active', true)
    .order('sort_order');
  const subs = (children || []) as Category[];
  if (subs.length > 0) {
    const items = subs.map((c) => ({ id: c.id, label: c.name }));
    const kb = paginatedKeyboard(items, 0, 50, 'cat', 'catalog');
    const text = '📁 <b>Підкатегорії</b>\n\nОберіть підкатегорію:';
    if (messageId) {
      await tgEditMessage(chatId, messageId, text, kb);
    } else {
      await tgSendMessage(chatId, text, kb);
    }
    return;
  }
  await showProducts(chatId, parentId, 0, messageId);
}

export async function showProducts(
  chatId: number,
  categoryId: string,
  page: number,
  messageId?: number,
): Promise<void> {
  const { data, count } = await supabase
    .from('products')
    .select('*', { count: 'exact' })
    .eq('category_id', categoryId)
    .eq('is_active', true)
    .order('name')
    .range(page * PER_PAGE, page * PER_PAGE + PER_PAGE - 1);
  const products = (data || []) as Product[];
  const total = count || 0;
  const totalPages = Math.ceil(total / PER_PAGE) || 1;
  if (!products.length) {
    const text = '📦 Товарів у цій категорії поки немає.';
    if (messageId) {
      await tgEditMessage(chatId, messageId, text, backKeyboard('catalog'));
    } else {
      await tgSendMessage(chatId, text, backKeyboard('catalog'));
    }
    return;
  }
  const items = products.map((p) => ({
    id: p.id,
    label: `${p.name} — ${p.price} грн${p.stock <= 0 ? ' (немає)' : ''}`,
  }));
  const prefix = `prod:${categoryId}`;
  const kb = paginatedKeyboard(items, page, PER_PAGE, prefix, 'catalog');
  const text = `📦 <b>Товари</b> (сторінка ${page + 1}/${totalPages}, всього ${total})\n\nОберіть товар:`;
  if (messageId) {
    await tgEditMessage(chatId, messageId, text, kb);
  } else {
    await tgSendMessage(chatId, text, kb);
  }
}

export async function showProductCard(
  chatId: number,
  productId: string,
  categoryId: string,
  page: number,
  botUserId: string,
  messageId?: number,
): Promise<void> {
  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .maybeSingle();
  if (!product) {
    await tgSendMessage(chatId, 'Товар не знайдено.');
    return;
  }
  const p = product as Product;
  if (!p.is_active) {
    await tgSendMessage(chatId, 'Цей товар більше не доступний.');
    return;
  }
  const outOfStock = p.stock <= 0;
  const { data: fav } = await supabase
    .from('favorites')
    .select('id')
    .eq('bot_user_id', botUserId)
    .eq('product_id', productId)
    .maybeSingle();
  const isFav = !!fav;
  const stockText = outOfStock ? '❌ Немає в наявності' : `✅ В наявності: ${p.stock} шт`;
  const productUrl = siteUrl ? `${siteUrl}/product/${productId}` : '';
  const kb = productCardKeyboard(productId, categoryId, page, isFav, productUrl || undefined);
  const discount = p.old_price && p.old_price > p.price
    ? ` (-${Math.round((1 - p.price / p.old_price) * 100)}%)`
    : '';
  const lines = [
    `<b>${p.name}</b>`,
    p.brand ? `🏷 Бренд: ${p.brand}` : '',
    `⭐ Рейтинг: ${p.rating}`,
    `💰 Ціна: ${p.price} грн${discount}`,
    p.old_price ? `❌ Стара ціна: ${p.old_price} грн` : '',
    `📦 ${stockText}`,
    p.description ? `\n📝 ${p.description}` : '',
    p.country ? `\n🌍 Країна: ${p.country}` : '',
    p.volume ? `📐 Об\u2019єм: ${p.volume}` : '',
    p.sku ? `🔖 Артикул: ${p.sku}` : '',
  ].filter(Boolean);
  const caption = lines.join('\n');
  await logEvent(botUserId, 'product_view', { product_id: productId });
  if (p.image_path) {
    const photoUrl = `${STORAGE_URL}/${p.image_path}`;
    if (messageId) {
      await tgSendMessage(chatId, caption, kb);
    } else {
      await tgSendPhoto(chatId, photoUrl, caption, kb);
    }
  } else {
    if (messageId) {
      await tgEditMessage(chatId, messageId, caption, kb);
    } else {
      await tgSendMessage(chatId, caption, kb);
    }
  }
}
