import { useEffect, useState, useCallback } from 'react';
import {
  Bot,
  Link2,
  Unlink,
  CheckCircle2,
  XCircle,
  Loader2,
  Copy,
  Globe,
  Shield,
  Key,
} from 'lucide-react';

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-bot`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

interface WebhookInfo {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_date: number;
  last_error_message: string;
}

interface BotInfo {
  id: number;
  username: string;
  first_name: string;
  can_join_groups: boolean;
}

interface SetupStatus {
  ok: boolean;
  webhook?: WebhookInfo;
  has_token?: boolean;
  has_secret?: boolean;
  has_site_url?: boolean;
  bot?: BotInfo;
  error?: string;
}

export function TelegramSetup() {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const [statusResp, meResp] = await Promise.all([
        fetch(`${FN_URL}?action=status`, {
          headers: { Authorization: `Bearer ${ANON_KEY}` },
        }),
        fetch(`${FN_URL}?action=me`, {
          headers: { Authorization: `Bearer ${ANON_KEY}` },
        }),
      ]);
      const statusData = await statusResp.json();
      const meData = await meResp.json();
      setStatus({
        ...statusData,
        bot: meData.bot,
      });
    } catch {
      setStatus({ ok: false, error: 'Не вдалося отримати статус' });
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  async function setupWebhook() {
    setActionLoading(true);
    try {
      const resp = await fetch(FN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({ setup_webhook: FN_URL }),
      });
      await resp.json();
      await fetchStatus();
    } catch {
      // ignore
    }
    setActionLoading(false);
  }

  async function deleteWebhook() {
    setActionLoading(true);
    try {
      await fetch(FN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({ delete_webhook: true }),
      });
      await fetchStatus();
    } catch {
      // ignore
    }
    setActionLoading(false);
  }

  function copyWebhookUrl() {
    navigator.clipboard.writeText(FN_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
      </div>
    );
  }

  const webhookActive = status?.webhook?.url === FN_URL;
  const secretsOk = status?.has_token && status?.has_secret;
  const siteUrlOk = status?.has_site_url;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Налаштування Telegram</h1>
      <p className="text-sm text-slate-500 mb-6">Підготовка бота до роботи</p>

      {/* Bot info */}
      {status?.bot && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center">
              <Bot className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">@{status.bot.username}</h2>
              <p className="text-sm text-slate-500">{status.bot.first_name} (ID: {status.bot.id})</p>
            </div>
          </div>
        </div>
      )}

      {/* Secrets checklist */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <Key className="w-4 h-4" /> Секрети Supabase
        </h3>
        <div className="space-y-3">
          <SecretRow label="TELEGRAM_BOT_TOKEN" ok={!!status?.has_token} hint="Токен бота від @BotFather" />
          <SecretRow label="TELEGRAM_WEBHOOK_SECRET" ok={!!status?.has_secret} hint="Секрет для перевірки webhook-запитів" />
          <SecretRow label="SITE_URL" ok={!!siteUrlOk} hint="URL сайту для кнопки «Відкрити на сайті»" />
        </div>
        {!secretsOk && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
            <strong>Увага:</strong> Необхідні секрети відсутні. Створіть бота через @BotFather,
            отримайте токен, згенеруйте секрет webhook і додайте їх у налаштування секретів проєкту.
          </div>
        )}
        {secretsOk && !siteUrlOk && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
            <strong>SITE_URL</strong> не налаштовано — кнопка «Відкрити на сайті» в картці товару не буде працювати.
            Додайте URL вашого сайту в секрети.
          </div>
        )}
      </div>

      {/* Webhook status */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <Link2 className="w-4 h-4" /> Webhook
        </h3>

        <div className="mb-4">
          <label className="text-xs font-medium text-slate-500 mb-1 block">URL webhook-функції</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 font-mono break-all">
              {FN_URL}
            </code>
            <button onClick={copyWebhookUrl} className="p-2 text-slate-400 hover:text-slate-600 transition-colors" title="Копіювати">
              {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          {webhookActive ? (
            <span className="flex items-center gap-2 text-sm font-medium text-green-600">
              <CheckCircle2 className="w-5 h-5" /> Webhook активний
            </span>
          ) : (
            <span className="flex items-center gap-2 text-sm font-medium text-slate-400">
              <XCircle className="w-5 h-5" /> Webhook не налаштований
            </span>
          )}
        </div>

        {status?.webhook?.pending_update_count ? (status.webhook.pending_update_count > 0) : false && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
            У черзі {status?.webhook?.pending_update_count ?? 0} непрочитаних оновлень.
          </div>
        )}

        {status?.webhook?.last_error_message && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <strong>Помилка:</strong> {status.webhook.last_error_message}
            {status.webhook.last_error_date && (
              <span className="block text-xs mt-1">
                {new Date(status.webhook.last_error_date * 1000).toLocaleString('uk-UA')}
              </span>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={setupWebhook}
            disabled={actionLoading || !secretsOk}
            className="flex items-center gap-2 px-4 py-2.5 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors text-sm font-medium disabled:opacity-50"
          >
            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            Прив'язати webhook
          </button>
          <button
            onClick={deleteWebhook}
            disabled={actionLoading}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium disabled:opacity-50"
          >
            <Unlink className="w-4 h-4" />
            Відв'язати
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <Shield className="w-4 h-4" /> Інструкція з налаштування
        </h3>
        <ol className="space-y-3 text-sm text-slate-600">
          <Step n={1}>
            Відкрийте <strong>@BotFather</strong> у Telegram і відправте команду <code className="px-1.5 py-0.5 bg-slate-100 rounded text-xs">/newbot</code>
          </Step>
          <Step n={2}>
            Введіть ім'я бота (наприклад, «Beauty Shop Bot») та username (повинен закінчуватись на <code className="px-1.5 py-0.5 bg-slate-100 rounded text-xs">bot</code>)
          </Step>
          <Step n={3}>
            Скопіюйте <strong>BOT_TOKEN</strong>, який BotFather надішле у відповідь
          </Step>
          <Step n={4}>
            Згенеруйте випадковий рядок для <strong>TELEGRAM_WEBHOOK_SECRET</strong> — це секрет для перевірки webhook-запитів
          </Step>
          <Step n={5}>
            Додайте обидва секрети (та <strong>SITE_URL</strong> вашого сайту) у налаштування секретів проєкту
          </Step>
          <Step n={6}>
            Натисніть <strong>«Прив'язати webhook»</strong> вище — бот автоматично зареєструється з Telegram
          </Step>
          <Step n={7}>
            Відкрийте бота у Telegram і відправте <code className="px-1.5 py-0.5 bg-slate-100 rounded text-xs">/start</code> — має з'явитися меню з кнопками
          </Step>
        </ol>
      </div>
    </div>
  );
}

function SecretRow({ label, ok, hint }: { label: string; ok: boolean; hint: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
      <div>
        <p className="text-sm font-medium text-slate-700 font-mono">{label}</p>
        <p className="text-xs text-slate-400">{hint}</p>
      </div>
      {ok ? (
        <CheckCircle2 className="w-5 h-5 text-green-500" />
      ) : (
        <XCircle className="w-5 h-5 text-red-400" />
      )}
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-rose-100 text-rose-600 text-xs font-bold flex items-center justify-center">
        {n}
      </span>
      <span className="pt-0.5">{children}</span>
    </li>
  );
}
