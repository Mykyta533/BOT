import { supabase, tgSendMessage } from './telegram.ts';
import { paginatedKeyboard, productCardKeyboard, backKeyboard } from './keyboards.ts';
import { showProductCard } from './catalog.ts';
import type { Product } from './types.ts';

export async function searchProducts(
  chatId: number,
  query: string,
  botUserId: string,
): Promise<void> {
  const q = query.trim();
  if (!q) {
    await tgSendMessage(chatId, 'Введіть запит для пошуку.');
    return;
  }
  const { data } = await supabase
    .from('products')
    .select('*, categories!inner(name)')
    .eq('is_active', true)
    .or(
      `name.ilike.%${q}%,brand.ilike.%${q}%,description.ilike.%${q}%,sku.ilike.%${q}%,barcode.ilike.%${q}%`,
    )
    .order('rating', { ascending: false })
    .limit(30);
  const products = (data || []) as Product[];
  if (!products.length) {
    await tgSendMessage(chatId, `За запитом «${q}» нічого не знайдено.`, backKeyboard('menu'));
    return;
  }
  if (products.length === 1) {
    await showProductCard(chatId, products[0].id, products[0].category_id || '', 0, botUserId);
    return;
  }
  const items = products.map((p) => ({
    id: p.id,
    label: `${p.name} — ${p.price} грн`,
  }));
  const kb = paginatedKeyboard(items, 0, 10, 'search', 'menu');
  await tgSendMessage(
    chatId,
    `🔍 Знайдено ${products.length} товарів за запитом «${q}»:`,
    kb,
  );
}

export async function showSearchResult(
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
