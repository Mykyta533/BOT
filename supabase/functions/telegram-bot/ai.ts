import { supabase, tgSendMessage, logError } from './telegram.ts';
import { productCardKeyboard } from './keyboards.ts';
import { showProductCard } from './catalog.ts';
import type { Product } from './types.ts';

const AI_FUNCTION_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-assistant`;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

export async function handleAiMessage(
  chatId: number,
  text: string,
  botUserId: string,
): Promise<void> {
  try {
    const resp = await fetch(AI_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({ message: text, bot_user_id: botUserId }),
    });
    if (!resp.ok) {
      await tgSendMessage(chatId, 'Вибачте, AI-асистент зараз недоступний. Спробуйте пізніше.');
      return;
    }
    const data = await resp.json();
    if (data.error) {
      await tgSendMessage(chatId, 'Вибачте, сталася помилка. Спробуйте переформулювати запит.');
      return;
    }
    const reply = data.reply || data.message || 'Я не зрозумів запит.';
    if (data.products && Array.isArray(data.products) && data.products.length > 0) {
      await tgSendMessage(chatId, reply);
      for (const p of data.products as Product[]) {
        await showProductCard(chatId, p.id, p.category_id || '', 0, botUserId);
      }
    } else {
      await tgSendMessage(chatId, reply);
    }
  } catch (err) {
    await logError('ai', err.message || 'AI request failed', { botUserId, context: { message: text } });
    await tgSendMessage(chatId, 'Вибачте, AI-асистент зараз недоступний.');
  }
}
