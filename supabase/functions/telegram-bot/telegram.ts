import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import type { TelegramUpdate, BotUser } from './types.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
export const WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') || '';

const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

export async function tgSendMessage(
  chatId: number,
  text: string,
  replyMarkup?: Record<string, unknown>,
  parseMode = 'HTML',
  disablePreview = true,
): Promise<Response> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: parseMode,
    disable_web_page_preview: disablePreview,
  };
  if (replyMarkup) body.reply_markup = replyMarkup;
  return await fetch(`${API_BASE}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function tgSendPhoto(
  chatId: number,
  photoUrl: string,
  caption: string,
  replyMarkup?: Record<string, unknown>,
): Promise<Response> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    photo: photoUrl,
    caption,
    parse_mode: 'HTML',
  };
  if (replyMarkup) body.reply_markup = replyMarkup;
  return await fetch(`${API_BASE}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function tgEditMessage(
  chatId: number,
  messageId: number,
  text: string,
  replyMarkup?: Record<string, unknown>,
): Promise<Response> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };
  if (replyMarkup) body.reply_markup = replyMarkup;
  return await fetch(`${API_BASE}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function tgAnswerCallback(callbackId: string): Promise<void> {
  await fetch(`${API_BASE}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackId }),
  });
}

export async function getBotUser(telegramId: number): Promise<BotUser | null> {
  const { data } = await supabase
    .from('bot_users')
    .select('*')
    .eq('telegram_id', telegramId)
    .maybeSingle();
  return data as BotUser | null;
}

export async function upsertBotUser(update: TelegramUpdate): Promise<BotUser> {
  const from = update.message?.from || update.callback_query?.from;
  if (!from) throw new Error('No user in update');
  const { data: existing } = await supabase
    .from('bot_users')
    .select('*')
    .eq('telegram_id', from.id)
    .maybeSingle();
  if (existing) {
    await supabase
      .from('bot_users')
      .update({
        username: from.username || existing.username,
        first_name: from.first_name || existing.first_name,
        last_name: from.last_name || existing.last_name,
        language_code: from.language_code || existing.language_code,
        last_activity: new Date().toISOString(),
      })
      .eq('id', existing.id);
    return existing;
  }
  const { data, error } = await supabase
    .from('bot_users')
    .insert({
      telegram_id: from.id,
      username: from.username,
      first_name: from.first_name,
      last_name: from.last_name,
      language_code: from.language_code,
    })
    .select('*')
    .single();
  if (error) throw error;
  await supabase.from('loyalty_accounts').insert({ bot_user_id: data.id, balance: 0 });
  return data as BotUser;
}

export async function isAdmin(telegramId: number): Promise<boolean> {
  const { data } = await supabase
    .from('admin_users')
    .select('id')
    .eq('telegram_id', telegramId)
    .maybeSingle();
  return !!data;
}

export async function logEvent(
  botUserId: string | null,
  eventType: string,
  eventData: Record<string, unknown> = {},
): Promise<void> {
  await supabase.from('analytics_events').insert({
    bot_user_id: botUserId,
    event_type: eventType,
    event_data: eventData,
  });
  await supabase.from('activity_log').insert({
    bot_user_id: botUserId,
    event_type: eventType,
    event_data: eventData,
  });
}

export async function logError(
  module: string,
  errorMessage: string,
  options: {
    stack?: string;
    botUserId?: string | null;
    severity?: 'error' | 'warning';
    context?: Record<string, unknown>;
  } = {},
): Promise<void> {
  await supabase.from('error_logs').insert({
    module,
    error_message: errorMessage,
    error_stack: options.stack || null,
    bot_user_id: options.botUserId || null,
    severity: options.severity || 'error',
    context: options.context || {},
  });
}

export async function isMaintenanceMode(): Promise<boolean> {
  const { data } = await supabase
    .from('bot_settings')
    .select('value')
    .eq('key', 'maintenance_mode')
    .maybeSingle();
  return data?.value === 'true';
}

export async function getSetting(key: string): Promise<string | null> {
  const { data } = await supabase
    .from('bot_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  return data?.value ?? null;
}

export async function checkRateLimit(
  telegramId: number,
  action: string,
  maxCount: number,
  windowMs: number,
): Promise<boolean> {
  const now = Date.now();
  const windowStart = new Date(now - windowMs).toISOString();
  const { data } = await supabase
    .from('rate_limits')
    .select('*')
    .eq('telegram_id', telegramId)
    .eq('action', action)
    .maybeSingle();
  if (!data) {
    await supabase.from('rate_limits').insert({
      telegram_id: telegramId,
      action,
      count: 1,
      window_start: new Date().toISOString(),
    });
    return true;
  }
  if (new Date(data.window_start).getTime() < now - windowMs) {
    await supabase
      .from('rate_limits')
      .update({ count: 1, window_start: new Date().toISOString() })
      .eq('id', data.id);
    return true;
  }
  if (data.count >= maxCount) return false;
  await supabase
    .from('rate_limits')
    .update({ count: data.count + 1 })
    .eq('id', data.id);
  return true;
}
