import type {
  InlineKeyboardMarkup,
  ReplyKeyboardMarkup,
  InlineKeyboardButton,
} from './types.ts';

export const mainMenuKeyboard: ReplyKeyboardMarkup = {
  keyboard: [
    [{ text: '🛍 Каталог' }, { text: '🔍 Пошук' }],
    [{ text: '🔥 Акції' }, { text: '🆕 Новинки' }],
    [{ text: '⭐ Хіти' }, { text: '🌿 Еко' }],
    [{ text: '❤️ Обране' }, { text: '📦 Мої замовлення' }],
    [{ text: '💬 Менеджер' }, { text: '⚙️ Допомога' }],
  ],
  resize_keyboard: true,
};

export function paginatedKeyboard(
  items: { id: string; label: string }[],
  page: number,
  perPage: number,
  prefix: string,
  backData: string,
): InlineKeyboardMarkup {
  const totalPages = Math.ceil(items.length / perPage) || 1;
  const start = page * perPage;
  const pageItems = items.slice(start, start + perPage);
  const rows: InlineKeyboardButton[][] = pageItems.map((item) => [
    { text: item.label, callback_data: `${prefix}:${item.id}` },
  ]);
  const navRow: InlineKeyboardButton[] = [];
  if (page > 0) navRow.push({ text: '◀️ Попер.', callback_data: `${prefix}_p:${page - 1}` });
  if (page < totalPages - 1) navRow.push({ text: 'Наступ. ▶️', callback_data: `${prefix}_p:${page + 1}` });
  if (navRow.length) rows.push(navRow);
  rows.push([{ text: '🔙 Назад', callback_data: backData }]);
  return { inline_keyboard: rows };
}

export function productCardKeyboard(
  productId: string,
  categoryId: string,
  page: number,
  isFavorite: boolean,
  siteUrl?: string,
): InlineKeyboardMarkup {
  const rows: InlineKeyboardButton[][] = [];
  rows.push([
    { text: '🛒 Купити', callback_data: `buy:${productId}` },
    { text: isFavorite ? '❤️ В обраному' : '🤍 В обране', callback_data: `fav:${productId}` },
  ]);
  if (siteUrl) {
    rows.push([{ text: '🌐 Відкрити на сайті', url: siteUrl }]);
  }
  rows.push([{ text: '🔙 Назад', callback_data: `cat:${categoryId}:${page}` }]);
  return { inline_keyboard: rows };
}

export function backKeyboard(backData: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [[{ text: '🔙 Назад', callback_data: backData }]],
  };
}

export function paymentKeyboard(
  orderId: string,
  providers: { name: string; label: string }[],
): InlineKeyboardMarkup {
  const rows: InlineKeyboardButton[][] = [];
  for (const p of providers) {
    const emoji = p.name === 'monobank' ? '🟢' :
      p.name === 'liqpay' ? '🟢' :
      p.name === 'wayforpay' ? '🟢' :
      p.name === 'privat' ? '🟢' :
      p.name === 'cod' ? '💵' : '💳';
    rows.push([{ text: `${emoji} ${p.label}`, callback_data: `pay:${p.name}:${orderId}` }]);
  }
  rows.push([{ text: '🔙 Назад', callback_data: 'orders:0' }]);
  return { inline_keyboard: rows };
}
