import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface AiRequest {
  message: string;
  bot_user_id?: string;
}

const SYSTEM_PROMPT = `Ти — AI-консультант інтернет-магазину косметики та побутової хімії. Суворі правила:

1. ВІДПОВІДАЙ ЛИШЕ на теми, пов'язані з магазином: товари, ціни, акції, доставка, оплата, замовлення.
2. НИКОЛИ не вигадуй характеристики товарів, яких немає в наданому контексті. Якщо інформації недостатньо — чесно скажи: "У мене немає точної інформації про цей товар. Зверніться до менеджера."
3. РЕКОМЕНДУЙ товари ТІЛЬКИ з наданого списку. Не згадуй товари, яких немає в каталозі.
4. Якщо запит не стосується магазину — ввічливо поясни, що ти допомагаєш лише з вибором товарів та замовленнями.
5. Відповідай українською мовою, коротко та по суті.`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { message } = (await req.json()) as AiRequest;
    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: products } = await supabase
      .from('products')
      .select('id, name, brand, price, old_price, description, category_id, is_active, is_hit, is_new, is_eco, stock, rating, sku, country, volume')
      .eq('is_active', true)
      .or(`name.ilike.%${message}%,brand.ilike.%${message}%,description.ilike.%${message}%,sku.ilike.%${message}%`)
      .limit(5);

    const matchedProducts = products || [];

    const catalogContext = matchedProducts.length > 0
      ? matchedProducts.map((p: Record<string, unknown>) => {
          const name = p.name as string;
          const brand = p.brand as string | null;
          const price = p.price as number;
          const oldPrice = p.old_price as number | null;
          const desc = p.description as string | null;
          const stock = p.stock as number;
          const rating = p.rating as number;
          const country = p.country as string | null;
          const volume = p.volume as string | null;
          const isHit = p.is_hit as boolean;
          const isNew = p.is_new as boolean;
          const isEco = p.is_eco as boolean;
          const parts = [
            `Товар: ${name}`,
            brand ? `Бренд: ${brand}` : '',
            `Ціна: ${price} грн`,
            oldPrice ? `Стара ціна: ${oldPrice} грн (знижка)` : '',
            `Залишок: ${stock} шт`,
            `Рейтинг: ${rating}`,
            country ? `Країна: ${country}` : '',
            volume ? `Об'єм: ${volume}` : '',
            isHit ? 'Хіт продажів' : '',
            isNew ? 'Новинка' : '',
            isEco ? 'Еко-товар' : '',
            desc ? `Опис: ${desc}` : '',
          ].filter(Boolean);
          return parts.join(', ');
        }).join('\n')
      : '';

    let reply: string;
    if (matchedProducts.length > 0) {
      reply = `Я знайшов для вас такі товари:\n\n${matchedProducts.map((p: { name: string; brand: string | null; price: number }) => `• ${p.name}${p.brand ? ` (${p.brand})` : ''} — ${p.price} грн`).join('\n')}\n\nМожете переглянути їх картки нижче. Щось ще цікавить?`;
    } else {
      reply = `Я не знайшов точних збігів за запитом «${message}» у нашому каталозі.\n\nСпробуйте:\n— вказати назву або бренд товару\n— перейти в розділ «Каталог» для перегляду всіх товарів\n— звернутися до менеджера через кнопку «Менеджер»`;
    }

    return new Response(
      JSON.stringify({
        reply,
        products: matchedProducts,
        system_prompt: SYSTEM_PROMPT,
        catalog_context: catalogContext,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
