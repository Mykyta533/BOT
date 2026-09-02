import { supabase, tgSendMessage } from './telegram.ts';
import { backKeyboard } from './keyboards.ts';

export async function showAnalytics(chatId: number): Promise<void> {
  const { count: totalUsers } = await supabase
    .from('bot_users')
    .select('*', { count: 'exact', head: true });
  const { count: activeUsers } = await supabase
    .from('bot_users')
    .select('*', { count: 'exact', head: true })
    .gte('last_activity', new Date(Date.now() - 7 * 86400000).toISOString());
  const { count: totalOrders } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true });
  const { count: tgOrders } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .not('bot_user_id', 'is', null);
  const { data: topButtons } = await supabase
    .from('analytics_events')
    .select('event_type')
    .like('event_type', 'menu_%')
    .limit(1000);
  const buttonCounts: Record<string, number> = {};
  for (const e of topButtons || []) {
    buttonCounts[e.event_type] = (buttonCounts[e.event_type] || 0) + 1;
  }
  const buttonStats = Object.entries(buttonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k, v]) => `  ${k.replace('menu_', '')}: ${v}`)
    .join('\n');
  const { data: broadcasts } = await supabase
    .from('broadcasts')
    .select('id, sent_count, failed_count')
    .eq('status', 'completed')
    .limit(10);
  const bcStats = (broadcasts || [])
    .map((b: { id: string; sent_count: number; failed_count: number }) => {
      const total = b.sent_count + b.failed_count;
      const rate = total ? Math.round((b.sent_count / total) * 100) : 0;
      return `  #${b.id.slice(0, 8)}: ${b.sent_count} відправлено (${rate}% успішно)`;
    })
    .join('\n');
  const conversion = totalUsers ? Math.round(((tgOrders || 0) / totalUsers) * 100) : 0;
  const text = [
    '📊 <b>Аналітика Telegram-бота</b>',
    '',
    `👥 Всього користувачів: ${totalUsers || 0}`,
    `🟢 Активних за 7 днів: ${activeUsers || 0}`,
    `📦 Всього замовлень: ${totalOrders || 0}`,
    `🤖 Замовлень через Telegram: ${tgOrders || 0}`,
    `📈 Конверсія каталогу: ${conversion}%`,
    '',
    '<b>Топ кнопок:</b>',
    buttonStats || '  (немає даних)',
    '',
    '<b>Ефективність розсилок:</b>',
    bcStats || '  (немає розсилок)',
  ].join('\n');
  await tgSendMessage(chatId, text, backKeyboard('admin_menu'));
}
