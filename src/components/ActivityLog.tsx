import { useEffect, useState, useCallback } from 'react';
import { ScrollText, Loader2, Filter } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface ActivityLogEntry {
  id: string;
  bot_user_id: string | null;
  event_type: string;
  event_data: Record<string, unknown>;
  created_at: string;
}

const EVENT_LABELS: Record<string, string> = {
  start: 'Запуск бота',
  product_view: 'Перегляд товару',
  order_created: 'Замовлення створено',
  order_view: 'Перегляд замовлення',
  admin_status_change: 'Зміна статусу (адмін)',
  broadcast_sent: 'Розсилка відправлена',
  search: 'Пошук товару',
  ai_message: 'AI-повідомлення',
  favorite_add: 'Додано в обране',
  favorite_remove: 'Видалено з обраного',
  support_request: 'Звернення до менеджера',
};

const EVENT_COLORS: Record<string, string> = {
  start: 'bg-blue-100 text-blue-700',
  product_view: 'bg-slate-100 text-slate-700',
  order_created: 'bg-rose-100 text-rose-700',
  order_view: 'bg-slate-100 text-slate-700',
  admin_status_change: 'bg-amber-100 text-amber-700',
  broadcast_sent: 'bg-orange-100 text-orange-700',
  search: 'bg-cyan-100 text-cyan-700',
  ai_message: 'bg-violet-100 text-violet-700',
  favorite_add: 'bg-pink-100 text-pink-700',
  favorite_remove: 'bg-pink-50 text-pink-600',
  support_request: 'bg-red-100 text-red-700',
};

const PER_PAGE = 25;

export function ActivityLog() {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<string>('all');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('activity_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PER_PAGE, page * PER_PAGE + PER_PAGE - 1);
    if (filter !== 'all') {
      query = query.eq('event_type', filter);
    }
    const { data, count } = await query;
    setLogs((data || []) as ActivityLogEntry[]);
    setTotal(count || 0);
    setLoading(false);
  }, [page, filter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const totalPages = Math.ceil(total / PER_PAGE) || 1;
  const eventTypes = Object.keys(EVENT_LABELS);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2 mb-1">
        <ScrollText className="w-6 h-6 text-rose-500" />
        Журнал дій
      </h1>
      <p className="text-sm text-slate-500 mb-6">Історія ключових подій бота та адмін-панелі</p>

      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <button
          onClick={() => { setFilter('all'); setPage(0); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
            filter === 'all' ? 'bg-rose-500 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Усі ({total})
        </button>
        {eventTypes.map((t) => (
          <button
            key={t}
            onClick={() => { setFilter(t); setPage(0); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              filter === t ? 'bg-rose-500 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {EVENT_LABELS[t]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-slate-100">
          <p className="text-slate-400">Журнал порожній</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="divide-y divide-slate-50">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-4 p-4 hover:bg-slate-50/50 transition-colors">
                  <div className={`px-2.5 py-1 rounded-md text-xs font-medium ${EVENT_COLORS[log.event_type] || 'bg-slate-100 text-slate-700'}`}>
                    {EVENT_LABELS[log.event_type] || log.event_type}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 truncate">
                      {log.event_data && Object.keys(log.event_data).length > 0
                        ? JSON.stringify(log.event_data)
                        : '—'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(log.created_at).toLocaleString('uk-UA')}
                      {log.bot_user_id ? ` · Користувач: ${log.bot_user_id.slice(0, 8)}…` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-slate-500">
                Сторінка {page + 1} з {totalPages} · Всього: {total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Попередня
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Наступна
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
