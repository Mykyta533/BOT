import { supabase, tgSendMessage, logEvent } from './telegram.ts';
import { backKeyboard } from './keyboards.ts';

const pendingTickets = new Map<number, string>();

export async function startManagerChat(chatId: number, botUserId: string): Promise<void> {
  const { data: existing } = await supabase
    .from('support_tickets')
    .select('id, status')
    .eq('bot_user_id', botUserId)
    .eq('status', 'open')
    .maybeSingle();
  let ticketId: string;
  if (existing) {
    ticketId = existing.id;
  } else {
    const { data, error } = await supabase
      .from('support_tickets')
      .insert({ bot_user_id: botUserId, subject: 'Звернення з Telegram-бота' })
      .select('id')
      .single();
    if (error) {
      await tgSendMessage(chatId, 'Не вдалося створити звернення. Спробуйте пізніше.');
      return;
    }
    ticketId = data.id;
  }
  pendingTickets.set(chatId, ticketId);
  await logEvent(botUserId, 'manager_chat_start', { ticket_id: ticketId });
  await tgSendMessage(
    chatId,
    '💬 <b>Чат із менеджером</b>\n\nНапишіть ваше повідомлення, і менеджер відповість вам найближчим часом.\n\nЩоб завершити — напишіть /end або натисніть кнопку.',
    backKeyboard('menu'),
  );
}

export async function handleManagerMessage(chatId: number, text: string, botUserId: string): Promise<boolean> {
  const ticketId = pendingTickets.get(chatId);
  if (!ticketId) return false;
  await supabase.from('support_messages').insert({
    ticket_id: ticketId,
    sender: 'user',
    message: text,
  });
  await supabase
    .from('support_tickets')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', ticketId);
  const { data: admins } = await supabase.from('admin_users').select('telegram_id');
  if (admins) {
    const { data: user } = await supabase
      .from('bot_users')
      .select('first_name, last_name, username')
      .eq('id', botUserId)
      .maybeSingle();
    const name = user?.first_name || user?.username || 'Клієнт';
    for (const admin of admins) {
      await tgSendMessage(
        admin.telegram_id,
        `💬 Нове повідомлення від ${name} (тикет #${ticketId.slice(0, 8)}):\n\n${text}`,
      );
    }
  }
  await tgSendMessage(chatId, '✅ Повідомлення надіслано менеджеру.');
  return true;
}

export function endManagerChat(chatId: number): boolean {
  return pendingTickets.delete(chatId);
}

export function isManagerChat(chatId: number): boolean {
  return pendingTickets.has(chatId);
}
