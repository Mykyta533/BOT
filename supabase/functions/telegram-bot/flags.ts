import { supabase, tgSendMessage, tgEditMessage, logEvent } from './telegram.ts';
import { paginatedKeyboard, backKeyboard } from './keyboards.ts';
import { showProductCard } from './catalog.ts';
import type { Product } from './types.ts';

const PER_PAGE = 10;

export async function showFlaggedProducts(
  chatId: number,
  flag: 'promo' | 'new' | 'hit' | 'eco',
  page: number,
  messageId: number | undefined,
  botUserId: string,
): Promise<void> {
  const titles: Record<typeof flag, string> = {
    promo: '🔥 <b>Акції</b>',
    new: '🆕 <b>Новинки</b>',
    hit: '⭐ <b>Хіти продажів</b>',
    eco: '🌿 <b>Екотовари</b>',
  };
  let query = supabase.from('products').select('*', { count: 'exact' }).eq('is_active', true);
  if (flag === 'promo') {
    query = query.not('old_price', 'is', null).lt('old_price', 0).gt('old_price', 0);
    query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .not('old_price', 'is', null);
  } else if (flag === 'new') {
    query = query.eq('is_new', true);
  } else if (flag === 'hit') {
    query = query.eq('is_hit', true);
  } else if (flag === 'eco') {
    query = query.eq('is_eco', true);
  }
  const { data, count } = await query
    .order('rating', { ascending: false })
    .range(page * PER_PAGE, page * PER_PAGE + PER_PAGE - 1);
  const products = (data || []) as Product[];
  const total = count || 0;
  const totalPages = Math.ceil(total / PER_PAGE) || 1;
  await logEvent(botUserId, `menu_${flag}`, {});
  if (!products.length) {
    const text = `${titles[flag]}\n\nПоки немає товарів у цій категорії.`;
    if (messageId) {
      await tgEditMessage(chatId, messageId, text, backKeyboard('menu'));
    } else {
      await tgSendMessage(chatId, text, backKeyboard('menu'));
    }
    return;
  }
  const items = products.map((p) => {
    let label = `${p.name} — ${p.price} грн`;
    if (flag === 'promo' && p.old_price) {
      const pct = Math.round((1 - p.price / p.old_price) * 100);
      label = `-${pct}% ${p.name} (${p.old_price}→${p.price} грн)`;
    }
    return { id: p.id, label };
  });
  const prefix = `flag:${flag}`;
  const kb = paginatedKeyboard(items, page, PER_PAGE, prefix, 'menu');
  const text = `${titles[flag]}\n\nСторінка ${page + 1}/${totalPages}, всього ${total}:`;
  if (messageId) {
    await tgEditMessage(chatId, messageId, text, kb);
  } else {
    await tgSendMessage(chatId, text, kb);
  }
}

export async function showFlaggedProduct(
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
