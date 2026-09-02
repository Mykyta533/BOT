import { supabase, tgSendMessage } from './telegram.ts';
import { backKeyboard } from './keyboards.ts';

const pendingBroadcast = new Map<number, { message: string; segment: string }>();

const SEGMENTS = [
  { key: 'all', label: '👥 Всі користувачі' },
  { key: 'new', label: '🆕 Нові клієнти (30 днів)' },
  { key: 'loyal', label: '⭐ Постійні клієнти (3+ замовлень)' },
  { key: 'inactive', label: '😴 Без замовлень 30+ днів' },
];

export async function getBroadcastSegmentUserIds(segment: string): Promise<string[]> {
  if (segment === 'all') {
    const { data } = await supabase.from('bot_users').select('id').eq('is_blocked', false);
    return (data || []).map((u: { id: string }) => u.id);
  }
  if (segment === 'new') {
    const { data } = await supabase
      .from('bot_users')
      .select('id')
      .eq('is_blocked', false)
      .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString());
    return (data || []).map((u: { id: string }) => u.id);
  }
  if (segment === 'loyal') {
    const { data } = await supabase
      .from('orders')
      .select('bot_user_id')
      .not('bot_user_id', 'is', null)
      .neq('status', 'cancelled');
    const counts: Record<string, number> = {};
    for (const o of data || []) {
      const uid = o.bot_user_id as string;
      counts[uid] = (counts[uid] || 0) + 1;
    }
    return Object.entries(counts).filter(([, c]) => c >= 3).map(([uid]) => uid);
  }
  if (segment === 'inactive') {
    const { data: all } = await supabase.from('bot_users').select('id').eq('is_blocked', false);
    const { data: recent } = await supabase
      .from('orders')
      .select('bot_user_id')
      .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString());
    const recentIds = new Set((recent || []).map((o: { bot_user_id: string }) => o.bot_user_id));
    return (all || []).filter((u: { id: string }) => !recentIds.has(u.id)).map((u: { id: string }) => u.id);
  }
  return [];
}

const SEND_DELAY_MS = 40;
const MAX_RETRIES = 2;

async function sendWithRetry(chatId: number, text: string): Promise<{ ok: boolean; blocked: boolean }> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const resp = await tgSendMessage(chatId, text);
    if (resp.ok) return { ok: true, blocked: false };
    const body = await resp.json().catch(() => ({}));
    const desc: string = body?.description || '';
    if (desc.includes('bot was blocked by the user') || desc.includes('chat not found')) {
      return { ok: false, blocked: true };
    }
    if (desc.includes('Too Many Requests') && attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      continue;
    }
    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      continue;
    }
    return { ok: false, blocked: false };
  }
  return { ok: false, blocked: false };
}

export async function executeBroadcast(
  broadcastId: string,
  message: string,
  segment: string,
  onProgress?: (sent: number, failed: number, blocked: number, total: number) => void,
): Promise<{ sent: number; failed: number; blocked: number }> {
  const userIds = await getBroadcastSegmentUserIds(segment);
  let sent = 0;
  let failed = 0;
  let blocked = 0;
  const total = userIds.length;

  for (const uid of userIds) {
    const { data: bu } = await supabase
      .from('bot_users')
      .select('telegram_id')
      .eq('id', uid)
      .maybeSingle();
    if (!bu) continue;

    const result = await sendWithRetry(bu.telegram_id, message);
    if (result.ok) {
      sent++;
      await supabase.from('broadcast_recipients').insert({
        broadcast_id: broadcastId,
        bot_user_id: uid,
        status: 'sent',
      });
    } else if (result.blocked) {
      blocked++;
      await supabase.from('bot_users').update({ is_blocked: true }).eq('id', uid);
      await supabase.from('broadcast_recipients').insert({
        broadcast_id: broadcastId,
        bot_user_id: uid,
        status: 'blocked',
      });
    } else {
      failed++;
      await supabase.from('broadcast_recipients').insert({
        broadcast_id: broadcastId,
        bot_user_id: uid,
        status: 'failed',
      });
    }

    if (onProgress && (sent + failed + blocked) % 10 === 0) {
      onProgress(sent, failed, blocked, total);
    }
    await new Promise((r) => setTimeout(r, SEND_DELAY_MS));
  }

  await supabase
    .from('broadcasts')
    .update({ status: 'completed', sent_count: sent, failed_count: failed + blocked })
    .eq('id', broadcastId);

  return { sent, failed, blocked };
}

export async function startBroadcast(chatId: number): Promise<void> {
  const rows = SEGMENTS.map((s) => [{ text: s.label, callback_data: `bc_seg:${s.key}` }]);
  await tgSendMessage(
    chatId,
    '📢 <b>Масова розсилка</b>\n\nОберіть сегмент аудиторії:',
    { inline_keyboard: [...rows, [{ text: '🔙 Назад', callback_data: 'admin_menu' }]] },
  );
}

export async function setBroadcastSegment(chatId: number, segment: string): Promise<void> {
  pendingBroadcast.set(chatId, { message: '', segment });
  await tgSendMessage(
    chatId,
    `📢 Сегмент: ${SEGMENTS.find((s) => s.key === segment)?.label}\n\nТепер введіть текст розсилки:`,
    backKeyboard('admin_cancel_bc'),
  );
}

export async function setBroadcastMessage(chatId: number, text: string): Promise<boolean> {
  const pending = pendingBroadcast.get(chatId);
  if (!pending) return false;
  pending.message = text;
  await tgSendMessage(
    chatId,
    `📢 <b>Попередній перегляд:</b>\n\n${text}\n\nНадіслати?`,
    {
      inline_keyboard: [
        [
          { text: '✅ Надіслати', callback_data: `bc_send` },
          { text: '❌ Скасувати', callback_data: `bc_cancel` },
        ],
      ],
    },
  );
  return true;
}

export async function sendBroadcast(chatId: number): Promise<void> {
  const pending = pendingBroadcast.get(chatId);
  if (!pending || !pending.message) {
    await tgSendMessage(chatId, 'Текст розсилки порожній.');
    return;
  }
  const { data: broadcast } = await supabase
    .from('broadcasts')
    .insert({ message: pending.message, segment: pending.segment, status: 'sending', created_by: chatId })
    .select('id')
    .single();
  if (!broadcast) {
    await tgSendMessage(chatId, 'Не вдалося створити розсилку.');
    return;
  }
  await tgSendMessage(chatId, '⏳ Розсилка розпочата. Повідомимо про результат.');
  const { sent, failed, blocked } = await executeBroadcast(
    broadcast.id,
    pending.message,
    pending.segment,
  );
  pendingBroadcast.delete(chatId);
  await tgSendMessage(
    chatId,
    `✅ Розсилку завершено.\n\nНадіслано: ${sent}\nНе вдалося: ${failed}\nЗаблокували бота: ${blocked}`,
  );
}

export function cancelBroadcast(chatId: number): boolean {
  return pendingBroadcast.delete(chatId);
}

export function isPendingBroadcastMessage(chatId: number): boolean {
  const p = pendingBroadcast.get(chatId);
  return !!p && p.segment !== '' && p.message === '';
}

export function isPendingBroadcast(chatId: number): boolean {
  return pendingBroadcast.has(chatId);
}
