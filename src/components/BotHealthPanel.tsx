import { useEffect, useState, useCallback } from 'react';
import {
  Activity,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Database,
  Bot,
  Brain,
  Truck,
  CreditCard,
  HardDrive,
  Key,
  Link2,
} from 'lucide-react';

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-bot`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

interface HealthCheck {
  ok: boolean;
  detail?: string;
}

interface HealthStatus {
  ok: boolean;
  checks: Record<string, HealthCheck>;
}

const CHECK_META: Record<string, { label: string; icon: typeof Database }> = {
  telegram_api: { label: 'Telegram API', icon: Bot },
  database: { label: 'База даних', icon: Database },
  ai: { label: 'AI-асистент', icon: Brain },
  nova_poshta: { label: 'Нова Пошта', icon: Truck },
  payments: { label: 'Платежі', icon: CreditCard },
  storage: { label: 'Storage', icon: HardDrive },
  webhook_secret: { label: 'Webhook Secret', icon: Key },
  bot_token: { label: 'Bot Token', icon: Link2 },
};

export function BotHealthPanel() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHealth = useCallback(async () => {
    setRefreshing(true);
    try {
      const resp = await fetch(`${FN_URL}?action=health`, {
        headers: { Authorization: `Bearer ${ANON_KEY}` },
      });
      const data = await resp.json();
      setHealth(data);
    } catch {
      setHealth({ ok: false, checks: {} });
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
      </div>
    );
  }

  const allOk = health?.ok ?? false;
  const checkEntries = Object.entries(health?.checks || {});

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Activity className="w-6 h-6 text-rose-500" />
            Стан системи
          </h1>
          <p className="text-sm text-slate-500 mt-1">Перевірка всіх інтеграцій в реальному часі</p>
        </div>
        <button
          onClick={fetchHealth}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium text-slate-700 disabled:opacity-50"
        >
          {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Оновити
        </button>
      </div>

      <div className={`rounded-xl p-5 mb-6 ${allOk ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
        <div className="flex items-center gap-3">
          {allOk ? (
            <CheckCircle2 className="w-7 h-7 text-green-500" />
          ) : (
            <XCircle className="w-7 h-7 text-red-500" />
          )}
          <div>
            <p className={`text-lg font-semibold ${allOk ? 'text-green-700' : 'text-red-700'}`}>
              {allOk ? 'Усі системи працюють' : 'Є проблеми з інтеграціями'}
            </p>
            <p className={`text-sm ${allOk ? 'text-green-600' : 'text-red-600'}`}>
              {checkEntries.filter(([, c]) => c.ok).length} з {checkEntries.length} перевірок пройдено
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {checkEntries.map(([key, check]) => {
          const meta = CHECK_META[key] || { label: key, icon: Activity };
          const Icon = meta.icon;
          return (
            <div
              key={key}
              className={`bg-white rounded-xl p-5 shadow-sm border transition-colors ${
                check.ok ? 'border-slate-100' : 'border-red-200 bg-red-50/30'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  check.ok ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  <Icon className={`w-5 h-5 ${check.ok ? 'text-green-600' : 'text-red-500'}`} />
                </div>
                {check.ok ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-400" />
                )}
              </div>
              <p className="text-sm font-semibold text-slate-800">{meta.label}</p>
              <p className="text-xs text-slate-500 mt-1">{check.detail || (check.ok ? 'Працює' : 'Недоступно')}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
