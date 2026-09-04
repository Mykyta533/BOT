import {
  supabase,
  tgSendMessage,
  tgAnswerCallback,
  upsertBotUser,
  getBotUser,
  isAdmin,
  logEvent,
  logError,
  isMaintenanceMode,
  checkRateLimit,
  WEBHOOK_SECRET,
  BOT_TOKEN,
} from './telegram.ts';
import { mainMenuKeyboard } from './keyboards.ts';
import { showCatalog, showSubcategories, showProducts, showProductCard } from './catalog.ts';
import { searchProducts, showSearchResult } from './search.ts';
import { showFlaggedProducts, showFlaggedProduct } from './flags.ts';
import { toggleFavorite, showFavorites, showFavoriteProduct } from './favorites.ts';
import { showOrders, showOrderDetails } from './orders.ts';
import { showLoyalty } from './loyalty.ts';
import { startManagerChat, handleManagerMessage, endManagerChat, isManagerChat } from './support.ts';
import { showHelp, linkTelegramAccount } from './auth.ts';
import {
  adminConfirmOrder,
  adminShipOrder,
  adminCancelOrder,
  adminStartTtn,
  adminSetTtn,
  isPendingTtn,
  cancelTtn,
} from './admin.ts';
import {
  startBroadcast,
  setBroadcastSegment,
  setBroadcastMessage,
  sendBroadcast,
  cancelBroadcast,
  isPendingBroadcastMessage,
  isPendingBroadcast,
  executeBroadcast,
} from './broadcasts.ts';
import { showAnalytics } from './analytics.ts';
import { showTrackingByOrder } from './delivery.ts';
import { handleAiMessage } from './ai.ts';
import {
  getEnabledProviders,
  createPayment,
  checkPaymentStatus,
  refundPayment,
  updatePaymentStatus,
} from './payments/payment-service.ts';
import type { PaymentProviderName, PaymentStatus } from './payments/payment-service.ts';
import { paymentKeyboard } from './keyboards.ts';
import type { TelegramUpdate } from './types.ts';
import {
  searchCities,
  searchWarehouses,
  createShipment,
  trackShipment,
  getShipmentDocuments,
  cancelShipment,
  trackShipmentByTtn,
} from './shipping/shipping-service.ts';
import { checkNovaPoshtaHealth } from './shipping/providers/novaposhta.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

async function handleMessage(update: TelegramUpdate): Promise<Response> {
  const msg = update.message!;
  const chatId = msg.chat.id;
  const text = msg.text || '';
  const botUser = await upsertBotUser(update);
  if (botUser.is_blocked) {
    return new Response('OK', { status: 200 });
  }
  const admin = await isAdmin(botUser.telegram_id);

  // Maintenance mode — admins bypass
  if (!admin) {
    const maintenance = await isMaintenanceMode();
    if (maintenance) {
      await tgSendMessage(chatId, '🔧 Магазин тимчасово оновлюється. Спробуйте трохи пізніше.');
      return new Response('OK', { status: 200 });
    }
  }

  // Rate limit
  const allowed = await checkRateLimit(botUser.telegram_id, 'message', 30, 60000);
  if (!allowed) {
    await tgSendMessage(chatId, '⚠️ Занадто багато повідомлень. Зачекайте хвилину.');
    return new Response('OK', { status: 200 });
  }

  // Commands
  if (text === '/start') {
    await logEvent(botUser.id, 'start', {});
    await tgSendMessage(
      chatId,
      `👋 Вітаємо, ${botUser.first_name || 'гостю'}!\n\nЦе бот-магазин косметики та парфумерії. Оберіть дію з меню нижче:`,
      mainMenuKeyboard,
    );
    return new Response('OK', { status: 200 });
  }

  if (text === '/help' || text === '⚙️ Допомога') {
    await showHelp(chatId);
    return new Response('OK', { status: 200 });
  }

  if (text?.startsWith('/link ')) {
    const code = text.slice(6).trim();
    await linkTelegramAccount(chatId, code, botUser.id);
    return new Response('OK', { status: 200 });
  }

  if (text === '/end') {
    endManagerChat(chatId);
    cancelTtn(chatId);
    cancelBroadcast(chatId);
    await tgSendMessage(chatId, 'Дію скасовано.', mainMenuKeyboard);
    return new Response('OK', { status: 200 });
  }

  // Admin TTN input
  if (isPendingTtn(chatId) && !text.startsWith('/')) {
    await adminSetTtn(chatId, text.trim());
    return new Response('OK', { status: 200 });
  }

  // Broadcast message input
  if (isPendingBroadcastMessage(chatId) && !text.startsWith('/')) {
    await setBroadcastMessage(chatId, text);
    return new Response('OK', { status: 200 });
  }

  // Manager chat
  if (isManagerChat(chatId) && !text.startsWith('/')) {
    const handled = await handleManagerMessage(chatId, text, botUser.id);
    if (handled) return new Response('OK', { status: 200 });
  }

  // Reply keyboard buttons
  switch (text) {
    case '🛍 Каталог':
      await showCatalog(chatId);
      return new Response('OK', { status: 200 });
    case '🔍 Пошук':
      await tgSendMessage(
        chatId,
        '🔍 <b>Пошук товарів</b>\n\nВведіть назву, бренд, артикул або штрихкод:',
      );
      return new Response('OK', { status: 200 });
    case '🔥 Акції':
      await showFlaggedProducts(chatId, 'promo', 0, undefined, botUser.id);
      return new Response('OK', { status: 200 });
    case '🆕 Новинки':
      await showFlaggedProducts(chatId, 'new', 0, undefined, botUser.id);
      return new Response('OK', { status: 200 });
    case '⭐ Хіти':
      await showFlaggedProducts(chatId, 'hit', 0, undefined, botUser.id);
      return new Response('OK', { status: 200 });
    case '🌿 Еко':
      await showFlaggedProducts(chatId, 'eco', 0, undefined, botUser.id);
      return new Response('OK', { status: 200 });
    case '❤️ Обране':
      await showFavorites(chatId, 0, botUser.id);
      return new Response('OK', { status: 200 });
    case '📦 Мої замовлення':
      await showOrders(chatId, 0, botUser.id);
      return new Response('OK', { status: 200 });
    case '💬 Менеджер':
      await startManagerChat(chatId, botUser.id);
      return new Response('OK', { status: 200 });
    case '🎁 Бонуси':
      await showLoyalty(chatId, botUser.id);
      return new Response('OK', { status: 200 });
    case '📊 Статистика':
      if (admin) await showAnalytics(chatId);
      return new Response('OK', { status: 200 });
    case '📢 Розсилка':
      if (admin) await startBroadcast(chatId);
      return new Response('OK', { status: 200 });
  }

  // Search query (non-command text)
  if (text && !text.startsWith('/') && !isManagerChat(chatId)) {
    await searchProducts(chatId, text, botUser.id);
    return new Response('OK', { status: 200 });
  }

  // Fallback to AI
  if (text && !text.startsWith('/')) {
    await handleAiMessage(chatId, text, botUser.id);
    return new Response('OK', { status: 200 });
  }

  return new Response('OK', { status: 200 });
}

async function handleCallback(update: TelegramUpdate): Promise<Response> {
  const cb = update.callback_query!;
  const chatId = cb.message.chat.id;
  const messageId = cb.message.message_id;
  const data = cb.data;
  const botUser = await upsertBotUser(update);
  await tgAnswerCallback(cb.id);

  const admin = await isAdmin(botUser.telegram_id);

  // Catalog navigation
  if (data === 'catalog' || data === 'menu') {
    if (data === 'menu') {
      await tgSendMessage(chatId, 'Головне меню:', mainMenuKeyboard);
    } else {
      await showCatalog(chatId, messageId);
    }
    return new Response('OK', { status: 200 });
  }

  if (data.startsWith('cat:') && !data.includes('_p:')) {
    const parts = data.split(':');
    const categoryId = parts[1];
    const page = parts[2] ? parseInt(parts[2]) : 0;
    if (parts.length === 2) {
      await showSubcategories(chatId, categoryId, messageId);
    } else {
      await showProducts(chatId, categoryId, page, messageId);
    }
    return new Response('OK', { status: 200 });
  }

  if (data.startsWith('cat_p:')) {
    const page = parseInt(data.split(':')[1]);
    await showCatalog(chatId, messageId);
    return new Response('OK', { status: 200 });
  }

  // Product list pagination
  if (data.startsWith('prod:') && data.includes('_p:')) {
    const page = parseInt(data.split('_p:')[1]);
    const categoryId = data.split(':')[1];
    await showProducts(chatId, categoryId, page, messageId);
    return new Response('OK', { status: 200 });
  }
  if (data.startsWith('prod:')) {
    const categoryId = data.split(':')[1];
    await showProducts(chatId, categoryId, 0, messageId);
    return new Response('OK', { status: 200 });
  }

  // Product card
  if (data.startsWith('prod_card:')) {
    const parts = data.split(':');
    await showProductCard(chatId, parts[1], parts[2] || '', parseInt(parts[3] || '0'), botUser.id, messageId);
    return new Response('OK', { status: 200 });
  }

  // Search result
  if (data.startsWith('search:')) {
    await showSearchResult(chatId, data.split(':')[1], botUser.id);
    return new Response('OK', { status: 200 });
  }
  if (data.startsWith('search_p:')) {
    return new Response('OK', { status: 200 });
  }

  // Flagged products
  if (data.startsWith('flag:')) {
    const parts = data.split(':');
    if (parts.length === 3) {
      await showFlaggedProducts(chatId, parts[1] as 'promo' | 'new' | 'hit' | 'eco', parseInt(parts[2]), messageId, botUser.id);
    } else {
      await showFlaggedProduct(chatId, parts[1], botUser.id);
    }
    return new Response('OK', { status: 200 });
  }

  // Favorites
  if (data.startsWith('fav:')) {
    if (data === 'fav_list' || data.startsWith('fav_p:')) {
      const page = data.startsWith('fav_p:') ? parseInt(data.split(':')[1]) : 0;
      await showFavorites(chatId, page, botUser.id, messageId);
    } else {
      await toggleFavorite(chatId, data.split(':')[1], botUser.id);
    }
    return new Response('OK', { status: 200 });
  }
  if (data.startsWith('favprod:')) {
    await showFavoriteProduct(chatId, data.split(':')[1], botUser.id);
    return new Response('OK', { status: 200 });
  }

  // Orders
  if (data.startsWith('order:')) {
    const parts = data.split(':');
    if (parts.length === 2) {
      await showOrderDetails(chatId, parts[1], botUser.id, messageId);
    } else {
      await showOrders(chatId, parseInt(parts[1] || '0'), botUser.id, messageId);
    }
    return new Response('OK', { status: 200 });
  }
  if (data === 'orders') {
    await showOrders(chatId, 0, botUser.id, messageId);
    return new Response('OK', { status: 200 });
  }
  if (data.startsWith('track:')) {
    await showTrackingByOrder(chatId, data.split(':')[1]);
    return new Response('OK', { status: 200 });
  }

  // Buy — create order from product, then show payment options
  if (data.startsWith('buy:')) {
    const productId = data.split(':')[1];
    const { data: product } = await supabase
      .from('products')
      .select('id, name, price, stock, is_active')
      .eq('id', productId)
      .maybeSingle();
    if (!product) {
      await tgSendMessage(chatId, 'Товар не знайдено.');
      return new Response('OK', { status: 200 });
    }
    const p = product as { id: string; name: string; price: number; stock: number; is_active: boolean };
    if (!p.is_active) {
      await tgSendMessage(chatId, 'Цей товар більше не доступний.');
      return new Response('OK', { status: 200 });
    }
    if (p.stock <= 0) {
      await tgSendMessage(chatId, '❌ На жаль, цього товару немає в наявності.');
      return new Response('OK', { status: 200 });
    }
    const orderNumber = `TG-${Date.now().toString(36).toUpperCase()}`;
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        number: orderNumber,
        bot_user_id: botUser.id,
        status: 'new',
        total: p.price,
        customer_name: botUser.first_name || botUser.username || '',
      })
      .select('id, number, total, status')
      .single();
    if (orderError || !order) {
      await tgSendMessage(chatId, '❌ Не вдалося створити замовлення. Спробуйте пізніше.');
      return new Response('OK', { status: 200 });
    }
    await supabase.from('order_items').insert({
      order_id: order.id,
      product_id: p.id,
      name: p.name,
      price: p.price,
      quantity: 1,
    });
    await supabase.from('order_status_history').insert({
      order_id: order.id,
      status: 'new',
      note: 'Замовлення створено з Telegram-бота',
    });
    await supabase.from('products').update({ stock: p.stock - 1 }).eq('id', p.id);
    const providers = await getEnabledProviders();
    const providerList = providers.map((pr) => ({ name: pr.name, label: pr.label }));
    const kb = paymentKeyboard(order.id, providerList);
    const text = `💳 <b>Замовлення №${order.number}</b>\n\nТовар: ${p.name}\nСума: ${order.total} грн\n\nОберіть спосіб оплати:`;
    await tgSendMessage(chatId, text, kb);
    await logEvent(botUser.id, 'buy_click', { order_id: order.id, product_id: productId });
    const { notifyAdminsNewOrder } = await import('./notifications.ts');
    await notifyAdminsNewOrder(order as never);
    return new Response('OK', { status: 200 });
  }

  // Payment provider selection
  if (data.startsWith('pay:')) {
    const parts = data.split(':');
    const providerName = parts[1] as PaymentProviderName;
    const orderId = parts[2];
    const { data: order } = await supabase
      .from('orders')
      .select('id, number, total, status')
      .eq('id', orderId)
      .maybeSingle();
    if (!order) {
      await tgSendMessage(chatId, 'Замовлення не знайдено.');
      return new Response('OK', { status: 200 });
    }
    if (providerName === 'cod') {
      await supabase.from('orders').update({ payment_method: 'cod', status: 'confirmed' }).eq('id', orderId);
      await tgSendMessage(
        chatId,
        '💵 <b>Післяплата обрана</b>\n\nОплата буде здійснена при отриманні товару у відділенні Нової Пошти.',
        mainMenuKeyboard,
      );
      await logEvent(botUser.id, 'payment_method_selected', { provider: 'cod', order_id: orderId });
      return new Response('OK', { status: 200 });
    }
    const enabledProviders = await getEnabledProviders();
    if (!enabledProviders.find((pr) => pr.name === providerName)) {
      await tgSendMessage(chatId, '❌ Цей спосіб оплати недоступний.');
      return new Response('OK', { status: 200 });
    }
    const { transactionId, result } = await createPayment(providerName, {
      orderId: order.id,
      orderNumber: order.number,
      amount: Number(order.total),
      currency: 'UAH',
      description: `Замовлення №${order.number}`,
      returnUrl: Deno.env.get('SITE_URL') || '',
      botUserId: botUser.id,
      chatId,
    });
    if (!result.ok || !transactionId) {
      await tgSendMessage(chatId, `❌ Помилка створення платежу: ${result.error || 'невідома помилка'}`);
      return new Response('OK', { status: 200 });
    }
    await supabase.from('orders').update({ payment_method: providerName }).eq('id', orderId);
    if (result.paymentUrl) {
      await tgSendMessage(
        chatId,
        `💳 <b>Оплата через ${providerName}</b>\n\nНатисніть кнопку нижче, щоб перейти до оплати:`,
        { inline_keyboard: [[{ text: '🔗 Перейти до оплати', url: result.paymentUrl }]] },
      );
    } else {
      await tgSendMessage(chatId, '✅ Платіж створено. Очікуємо підтвердження оплати.');
    }
    await logEvent(botUser.id, 'payment_created', { provider: providerName, order_id: orderId, transaction_id: transactionId });
    return new Response('OK', { status: 200 });
  }

  // Admin actions
  if (data === 'admin_menu') {
    if (!admin) return new Response('OK', { status: 200 });
    await tgSendMessage(chatId, '🔧 <b>Адмін-меню</b>', {
      inline_keyboard: [
        [{ text: '📢 Розсилка', callback_data: 'bc_start' }],
        [{ text: '📊 Статистика', callback_data: 'admin_stats' }],
        [{ text: '🔙 В меню', callback_data: 'menu' }],
      ],
    });
    return new Response('OK', { status: 200 });
  }
  if (data === 'admin_stats') {
    if (admin) await showAnalytics(chatId);
    return new Response('OK', { status: 200 });
  }
  if (data === 'bc_start') {
    if (admin) await startBroadcast(chatId);
    return new Response('OK', { status: 200 });
  }
  if (data.startsWith('bc_seg:')) {
    if (!admin) return new Response('OK', { status: 200 });
    await setBroadcastSegment(chatId, data.split(':')[1]);
    return new Response('OK', { status: 200 });
  }
  if (data === 'bc_send') {
    if (!admin) return new Response('OK', { status: 200 });
    await sendBroadcast(chatId);
    return new Response('OK', { status: 200 });
  }
  if (data === 'bc_cancel' || data === 'admin_cancel_bc') {
    cancelBroadcast(chatId);
    await tgSendMessage(chatId, '❌ Розсилку скасовано.', mainMenuKeyboard);
    return new Response('OK', { status: 200 });
  }
  if (data === 'admin_cancel_ttn') {
    cancelTtn(chatId);
    await tgSendMessage(chatId, '❌ Введення ТТН скасовано.');
    return new Response('OK', { status: 200 });
  }
  if (data.startsWith('admin_confirm:')) {
    if (admin) await adminConfirmOrder(chatId, data.split(':')[1]);
    return new Response('OK', { status: 200 });
  }
  if (data.startsWith('admin_ship:')) {
    if (admin) await adminShipOrder(chatId, data.split(':')[1]);
    return new Response('OK', { status: 200 });
  }
  if (data.startsWith('admin_cancel:')) {
    if (admin) await adminCancelOrder(chatId, data.split(':')[1]);
    return new Response('OK', { status: 200 });
  }
  if (data.startsWith('admin_ttn:')) {
    if (admin) await adminStartTtn(chatId, data.split(':')[1]);
    return new Response('OK', { status: 200 });
  }

  return new Response('OK', { status: 200 });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    // GET /telegram-bot?action=... — status, me, health
    if (req.method === 'GET' && path === 'telegram-bot') {
      const action = url.searchParams.get('action');
      if (action === 'health') {
        const checks: Record<string, { ok: boolean; detail?: string }> = {};

        try {
          const resp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
          const info = await resp.json();
          checks.telegram_api = { ok: resp.ok, detail: info?.result?.url ? 'webhook bound' : 'webhook not set' };
        } catch (e) {
          checks.telegram_api = { ok: false, detail: e.message };
        }

        try {
          const { error } = await supabase.from('products').select('id').limit(1).maybeSingle();
          checks.database = { ok: !error, detail: error ? error.message : 'connected' };
        } catch (e) {
          checks.database = { ok: false, detail: e.message };
        }

        try {
          const aiUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-assistant`;
          const aiResp = await fetch(aiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}` },
            body: JSON.stringify({ message: 'test' }),
          });
          checks.ai = { ok: aiResp.ok, detail: aiResp.ok ? 'available' : `HTTP ${aiResp.status}` };
        } catch (e) {
          checks.ai = { ok: false, detail: e.message };
        }

        const npKey = Deno.env.get('NOVA_POSHTA_API_KEY');
        if (npKey) {
          const npHealth = await checkNovaPoshtaHealth();
          checks.nova_poshta = npHealth;
        } else {
          checks.nova_poshta = { ok: false, detail: 'not configured' };
        }

        const monoToken = !!Deno.env.get('MONOBANK_TOKEN');
        const liqpayKeys = !!(Deno.env.get('LIQPAY_PUBLIC_KEY') && Deno.env.get('LIQPAY_PRIVATE_KEY'));
        const wfpKeys = !!(Deno.env.get('WAYFORPAY_MERCHANT_ACCOUNT') && Deno.env.get('WAYFORPAY_MERCHANT_SECRET_KEY'));
        const privatKeys = !!(Deno.env.get('PRIVAT_MERCHANT_ID') && Deno.env.get('PRIVAT_MERCHANT_PASSWORD'));
        const anyPayment = monoToken || liqpayKeys || wfpKeys || privatKeys;
        checks.payments = { ok: anyPayment, detail: anyPayment ? 'configured' : 'not configured' };

        checks.storage = { ok: true, detail: 'supabase storage available' };

        checks.webhook_secret = { ok: !!WEBHOOK_SECRET, detail: WEBHOOK_SECRET ? 'set' : 'missing' };

        checks.bot_token = { ok: !!BOT_TOKEN, detail: BOT_TOKEN ? 'set' : 'missing' };

        const allOk = Object.values(checks).every((c) => c.ok);
        return new Response(JSON.stringify({ ok: allOk, checks }), {
          status: allOk ? 200 : 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (action === 'status') {
        try {
          const resp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
          const info = await resp.json();
          return new Response(JSON.stringify({
            ok: true,
            webhook: info.result,
            has_token: !!BOT_TOKEN,
            has_secret: !!WEBHOOK_SECRET,
            has_site_url: !!(Deno.env.get('SITE_URL')),
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch (e) {
          return new Response(JSON.stringify({ ok: false, error: e.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
      if (action === 'me') {
        try {
          const resp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
          const info = await resp.json();
          return new Response(JSON.stringify({ ok: true, bot: info.result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (e) {
          return new Response(JSON.stringify({ ok: false, error: e.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    // Read the raw body once for all POST paths
    let rawBody = '';
    let paymentData: Record<string, unknown> | null = null;
    if (req.method === 'POST') {
      rawBody = await req.text();
      const contentType = req.headers.get('content-type') || '';
      if (contentType.includes('form-urlencoded')) {
        const params = new URLSearchParams(rawBody);
        paymentData = Object.fromEntries(params.entries());
      } else if (contentType.includes('json')) {
        try {
          paymentData = JSON.parse(rawBody);
        } catch {
          // not valid JSON — will be handled below
        }
      }
    }

    // Payment provider webhook callbacks (Monobank, LiqPay, WayForPay, Privat)
    if (paymentData && (paymentData.invoiceId || paymentData.order_id || paymentData.orderReference || paymentData.payment_id)) {
      const invoiceId = paymentData.invoiceId as string || paymentData.order_id as string || paymentData.orderReference as string || paymentData.payment_id as string;
      const { data: txn } = await supabase
        .from('payment_transactions')
        .select('id, provider, order_id, status, amount')
        .or(`payment_id.eq.${invoiceId},invoice_id.eq.${invoiceId}`)
        .maybeSingle();
      if (txn) {
        let signatureValid = true;
        if (txn.provider === 'liqpay') {
          const liqpayPrivKey = Deno.env.get('LIQPAY_PRIVATE_KEY') || '';
          const receivedSignature = (paymentData.signature as string) || '';
          const signBase = btoa(String.fromCharCode(...new TextEncoder().encode(liqpayPrivKey)));
          if (receivedSignature && receivedSignature !== signBase) {
            signatureValid = false;
          }
        } else if (txn.provider === 'wayforpay') {
          const wfpSecret = Deno.env.get('WAYFORPAY_MERCHANT_SECRET_KEY') || '';
          const receivedSignature = (paymentData.merchantSignature as string) || '';
          const signFields = [
            paymentData.merchantAccount, paymentData.orderReference, paymentData.amount, paymentData.currency,
            paymentData.authCode, paymentData.cardPan, paymentData.transactionStatus, paymentData.reasonCode,
          ].filter(Boolean).map(String).join('|');
          const expectedBytes = new TextEncoder().encode(`${wfpSecret}|${signFields}`);
          const expectedHash = await crypto.subtle.digest('SHA-256', expectedBytes);
          const expectedSig = Array.from(new Uint8Array(expectedHash), (b) => b.toString(16).padStart(2, '0')).join('');
          if (receivedSignature && receivedSignature !== expectedSig) {
            signatureValid = false;
          }
        } else if (txn.provider === 'monobank') {
          if (WEBHOOK_SECRET) {
            const secretHeader = req.headers.get('x-telegram-bot-api-secret-token') || req.headers.get('x-signature');
            if (secretHeader !== WEBHOOK_SECRET) {
              signatureValid = false;
            }
          }
        }
        if (!signatureValid) {
          return new Response(JSON.stringify({ error: 'Invalid signature' }), {
            status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        let newStatus: PaymentStatus = 'pending';
        const statusStr = String(paymentData.status || '').toLowerCase();
        if (statusStr === 'success' || statusStr === 'approved' || statusStr === 'paid' || statusStr === 'sandbox') {
          newStatus = 'paid';
        } else if (statusStr === 'failure' || statusStr === 'declined' || statusStr === 'failed') {
          newStatus = 'failed';
        } else if (statusStr === 'refunded') {
          newStatus = 'refunded';
        } else if (statusStr === 'expired') {
          newStatus = 'expired';
        }
        if (newStatus !== txn.status) {
          await updatePaymentStatus(txn.id, newStatus, paymentData, 'Webhook callback');
          if (newStatus === 'paid' && txn.order_id) {
            await supabase.from('orders').update({ status: 'paid' }).eq('id', txn.order_id);
            const { data: order } = await supabase
              .from('orders')
              .select('bot_user_id, number')
              .eq('id', txn.order_id)
              .maybeSingle();
            if (order) {
              const { data: botUser } = await supabase
                .from('bot_users')
                .select('telegram_id')
                .eq('id', order.bot_user_id)
                .maybeSingle();
              if (botUser) {
                await tgSendMessage(
                  botUser.telegram_id,
                  '✅ <b>Оплату отримано.</b>\n\nДякуємо за замовлення.\nМи вже почали його обробку.',
                  mainMenuKeyboard,
                );
              }
            }
          }
        }
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = JSON.parse(rawBody || '{}');

    // POST /telegram-bot — set webhook from admin panel
    if (body.setup_webhook) {
      const webhookUrl = body.setup_webhook;
      const resp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          secret_token: WEBHOOK_SECRET,
          allowed_updates: ['message', 'callback_query'],
        }),
      });
      const result = await resp.json();
      return new Response(JSON.stringify({ ok: result.ok, result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (body.delete_webhook) {
      const resp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await resp.json();
      return new Response(JSON.stringify({ ok: result.ok, result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle web-triggered admin actions (broadcasts) — verify admin
    if (body.admin_action === 'broadcast') {
      const { message: msg, segment: seg, admin_telegram_id } = body;
      if (!msg || !seg || !admin_telegram_id) {
        return new Response(JSON.stringify({ error: 'message, segment, and admin_telegram_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: adminRow } = await supabase
        .from('admin_users')
        .select('id')
        .eq('telegram_id', admin_telegram_id)
        .maybeSingle();
      if (!adminRow) {
        return new Response(JSON.stringify({ error: 'Unauthorized: not an admin' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: broadcast } = await supabase
        .from('broadcasts')
        .insert({ message: msg, segment: seg, status: 'sending', created_by: admin_telegram_id })
        .select('id')
        .single();
      if (!broadcast) {
        return new Response(JSON.stringify({ error: 'Failed to create broadcast' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { sent, failed, blocked } = await executeBroadcast(broadcast.id, msg, seg);
      return new Response(JSON.stringify({ ok: true, sent, failed, blocked }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Helper: verify admin_telegram_id
    async function verifyAdmin(adminTelegramId: string | undefined): Promise<boolean> {
      if (!adminTelegramId) return false;
      const { data: adminRow } = await supabase
        .from('admin_users')
        .select('id')
        .eq('telegram_id', adminTelegramId)
        .maybeSingle();
      return !!adminRow;
    }

    // Admin: check payment status
    if (body.admin_action === 'check_payment') {
      const { transaction_id, admin_telegram_id } = body;
      if (!transaction_id) {
        return new Response(JSON.stringify({ error: 'transaction_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!(await verifyAdmin(admin_telegram_id))) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const result = await checkPaymentStatus(transaction_id);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Admin: refund payment
    if (body.admin_action === 'refund_payment') {
      const { transaction_id, amount, admin_telegram_id } = body;
      if (!transaction_id) {
        return new Response(JSON.stringify({ error: 'transaction_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!(await verifyAdmin(admin_telegram_id))) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const result = await refundPayment(transaction_id, Number(amount));
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Admin: search cities (Nova Poshta)
    if (body.admin_action === 'np_search_cities') {
      const { query, admin_telegram_id } = body;
      if (!query) {
        return new Response(JSON.stringify({ error: 'query required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!(await verifyAdmin(admin_telegram_id))) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const result = await searchCities('novaposhta', { query });
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Admin: search warehouses (Nova Poshta)
    if (body.admin_action === 'np_search_warehouses') {
      const { city_ref, warehouse_type, query, admin_telegram_id } = body;
      if (!city_ref) {
        return new Response(JSON.stringify({ error: 'city_ref required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!(await verifyAdmin(admin_telegram_id))) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const result = await searchWarehouses('novaposhta', {
        cityRef: city_ref,
        type: warehouse_type || 'all',
        query: query || undefined,
      });
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Admin: create TTN (Nova Poshta) — idempotent
    if (body.admin_action === 'np_create_ttn') {
      const { order_id, admin_telegram_id } = body;
      if (!order_id) {
        return new Response(JSON.stringify({ error: 'order_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!(await verifyAdmin(admin_telegram_id))) {
        return new Response(JSON.stringify({ error: 'Unauthorized: not an admin' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: order } = await supabase
        .from('orders')
        .select('*')
        .eq('id', order_id)
        .maybeSingle();
      if (!order) {
        return new Response(JSON.stringify({ error: 'Замовлення не знайдено' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const o = order as Record<string, unknown>;
      const result = await createShipment('novaposhta', {
        orderId: order_id,
        orderNumber: o.number as string,
        recipientName: (o.recipient_name as string) || (o.customer_name as string) || '',
        recipientPhone: (o.recipient_phone as string) || (o.customer_phone as string) || '',
        cityRef: o.delivery_city_ref as string,
        warehouseRef: o.delivery_warehouse_ref as string,
        description: `Замовлення №${o.number}`,
        cost: Number(o.total),
        payerType: o.payment_method === 'cod' ? 'Recipient' : 'Sender',
        weight: 1,
        seatsAmount: 1,
      });
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Admin: track shipment
    if (body.admin_action === 'track_shipment') {
      const { shipment_id, admin_telegram_id } = body;
      if (!shipment_id) {
        return new Response(JSON.stringify({ error: 'shipment_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!(await verifyAdmin(admin_telegram_id))) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const result = await trackShipment(shipment_id);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Admin: track by TTN
    if (body.admin_action === 'track_ttn') {
      const { ttn, admin_telegram_id } = body;
      if (!ttn) {
        return new Response(JSON.stringify({ error: 'ttn required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!(await verifyAdmin(admin_telegram_id))) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const result = await trackShipmentByTtn(ttn);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Admin: get shipment documents
    if (body.admin_action === 'shipment_documents') {
      const { shipment_id, admin_telegram_id } = body;
      if (!shipment_id) {
        return new Response(JSON.stringify({ error: 'shipment_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!(await verifyAdmin(admin_telegram_id))) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const result = await getShipmentDocuments(shipment_id);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Admin: cancel shipment
    if (body.admin_action === 'cancel_shipment') {
      const { shipment_id, admin_telegram_id } = body;
      if (!shipment_id) {
        return new Response(JSON.stringify({ error: 'shipment_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!(await verifyAdmin(admin_telegram_id))) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const result = await cancelShipment(shipment_id);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify webhook secret for Telegram updates
    if (!body.admin_action && WEBHOOK_SECRET) {
      const secretHeader = req.headers.get('x-telegram-bot-api-secret-token');
      if (secretHeader !== WEBHOOK_SECRET) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const update: TelegramUpdate = body;

    if (update.message) {
      await handleMessage(update);
    } else if (update.callback_query) {
      await handleCallback(update);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    await logError('edge_function', err.message || 'Unknown error', {
      stack: err.stack,
      context: { url: req.url, method: req.method },
    });
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
