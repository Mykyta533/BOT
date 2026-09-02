import { supabase, tgSendMessage } from './telegram.ts';
import { backKeyboard } from './keyboards.ts';

export async function linkTelegramAccount(chatId: number, code: string, botUserId: string): Promise<void> {
  const { data: linkCode } = await supabase
    .from('telegram_link_codes')
    .select('*')
    .eq('code', code)
    .maybeSingle();
  if (!linkCode) {
    await tgSendMessage(chatId, "❌ Невірний код прив'язки.");
    return;
  }
  if (linkCode.used) {
    await tgSendMessage(chatId, '❌ Цей код вже використано.');
    return;
  }
  if (new Date(linkCode.expires_at) < new Date()) {
    await tgSendMessage(chatId, '❌ Термін дії коду минув. Запросіть новий код на сайті.');
    return;
  }
  const { error } = await supabase
    .from('telegram_link_codes')
    .update({ used: true, telegram_id: chatId })
    .eq('id', linkCode.id)
    .eq('used', false);
  if (error) {
    await tgSendMessage(chatId, "❌ Не вдалося прив'язати акаунт. Спробуйте ще раз.");
    return;
  }
  await supabase
    .from('bot_users')
    .update({ user_id: linkCode.user_id })
    .eq('id', botUserId);
  await tgSendMessage(
    chatId,
    "✅ <b>Акаунт успішно прив'язано!</b>\n\nТепер ви можете переглядати замовлення, обране та бонуси з сайту прямо в Telegram.",
    backKeyboard('menu'),
  );
}

export async function showHelp(chatId: number): Promise<void> {
  const text = [
    '⚙️ <b>Допомога</b>',
    '',
    '🛍 <b>Каталог</b> — перегляд товарів за категоріями',
    '🔍 <b>Пошук</b> — пошук за назвою, брендом, артикулом',
    '🔥 <b>Акції</b> — товари зі знижками',
    '🆕 <b>Новинки</b> — свіжі надходження',
    '⭐ <b>Хіти</b> — найпопулярніші товари',
    '🌿 <b>Еко</b> — екологічні товари',
    '❤️ <b>Обране</b> — збережені товари',
    '📦 <b>Мої замовлення</b> — історія та статуси',
    "💬 <b>Менеджер</b> — зв'язок з менеджером",
    '',
    "Для прив'язки акаунта сайту введіть команду /link та код з особистого кабінету.",
  ].join('\n');
  await tgSendMessage(chatId, text, backKeyboard('menu'));
}
