import { supabase, tgSendMessage, tgEditMessage, logEvent } from './telegram.ts';
import { paginatedKeyboard, backKeyboard } from './keyboards.ts';
import { showProductCard } from './catalog.ts';
import type { Product } from './types.ts';

const PER_PAGE = 10;

export async function toggleFavorite(
  chatId: number,
  productId: string,
  botUserId: string,
): Promise<void> {
  const { data: existing } = await supabase
    .from('favorites')
    .select('id')
    .eq('bot_user_id', botUserId)
    .eq('product_id', productId)
    .maybeSingle();
  if (existing) {
    await supabase.from('favorites').delete().eq('id', existing.id);
    await tgSendMessage(chatId, '💔 Видалено з обраного.');
  } else {
    await supabase.from('favorites').insert({ bot_user_id: botUserId, product_id: productId });
    await tgSendMessage(chatId, '❤️ Додано в обране!');
    await logEvent(botUserId, 'add_favorite', { product_id: productId });
  }
}

export async function showFavorites(
  chatId: number,
  page: number,
  botUserId: string,
  messageId?: number,
): Promise<void> {
  const { data, count } = await supabase
    .from('favorites')
    .select('product_id, products!inner(id, name, price, stock)', { count: 'exact' })
    .eq('bot_user_id', botUserId)
    .range(page * PER_PAGE, page * PER_PAGE + PER_PAGE - 1);
  const favorites = (data || []) as unknown as {
    product_id: string;
    products: Product;
  }[];
  const total = count || 0;
  const totalPages = Math.ceil(total / PER_PAGE) || 1;
  if (!favorites.length) {
    const text = '❤️ <b>Обране</b>\n\nВаш список обраного порожній.';
    if (messageId) {
      await tgEditMessage(chatId, messageId, text, backKeyboard('menu'));
    } else {
      await tgSendMessage(chatId, text, backKeyboard('menu'));
    }
    return;
  }
  const items = favorites.map((f) => ({
    id: f.products.id,
    label: `${f.products.name} — ${f.products.price} грн`,
  }));
  const kb = paginatedKeyboard(items, page, PER_PAGE, 'fav', 'menu');
  const text = `❤️ <b>Обране</b> (${total})\n\nСторінка ${page + 1}/${totalPages}:`;
  if (messageId) {
    await tgEditMessage(chatId, messageId, text, kb);
  } else {
    await tgSendMessage(chatId, text, kb);
  }
}

export async function showFavoriteProduct(
  chatId: number,
  productId: string,
  botUserId: string,
): Promise<void> {
  const { data: p } = await supabase
    .from('products')
    .select('category_id')
    .eq('id', productId)
    .maybeSingle();
  await showProductCard(chatId, productId, (p as { category_id: string })?.category_id || '', 0, botUserId);
}
