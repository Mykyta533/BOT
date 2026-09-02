import { supabase, tgSendMessage } from './telegram.ts';
import { backKeyboard } from './keyboards.ts';

export async function showLoyalty(chatId: number, botUserId: string): Promise<void> {
  const { data: account } = await supabase
    .from('loyalty_accounts')
    .select('balance')
    .eq('bot_user_id', botUserId)
    .maybeSingle();
  const balance = account?.balance || 0;
  const { data: transactions } = await supabase
    .from('loyalty_transactions')
    .select('*')
    .eq('bot_user_id', botUserId)
    .order('created_at', { ascending: false })
    .limit(10);
  const txns = transactions || [];
  const txLines = txns
    .map((t: { amount: number; type: string; description: string | null; created_at: string }) => {
      const sign = t.amount >= 0 ? '+' : '';
      return `  ${new Date(t.created_at).toLocaleDateString('uk-UA')} ${sign}${t.amount} — ${t.type}${t.description ? ` (${t.description})` : ''}`;
    })
    .join('\n');
  const text = [
    '🎁 <b>Програма лояльності</b>',
    '',
    `💰 Ваш бонусний баланс: <b>${balance} грн</b>`,
    '',
    'Нарахування: 1 бонус за кожні 10 грн покупки.',
    'Бонусами можна оплатити до 50% вартості замовлення.',
    '',
    '<b>Останні транзакції:</b>',
    txLines || '  (поки немає)',
  ].join('\n');
  await tgSendMessage(chatId, text, backKeyboard('menu'));
}
