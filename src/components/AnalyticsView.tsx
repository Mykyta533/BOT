import { useEffect, useState } from 'react';
import { Users, TrendingUp, MousePointerClick, Send, Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export function AnalyticsView() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalOrders: 0,
    tgOrders: 0,
    conversion: 0,
    topButtons: [] as { type: string; count: number }[],
    broadcasts: [] as { id: string; sent: number; failed: number }[],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [u, au, o, to, tb, bc] = await Promise.all([
        supabase.from('bot_users').select('*', { count: 'exact', head: true }),
        supabase.from('bot_users').select('*', { count: 'exact', head: true }).gte('last_activity', new Date(Date.now() - 7 * 86400000).toISOString()),
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('*', { count: 'exact', head: true }).not('bot_user_id', 'is', null),
        supabase.from('analytics_events').select('event_type').like('event_type', 'menu_%').limit(5000),
        supabase.from('broadcasts').select('id, sent_count, failed_count').eq('status', 'completed').limit(10),
      ]);

      const buttonCounts: Record<string, number> = {};
      for (const e of tb.data || []) {
        buttonCounts[e.event_type] = (buttonCounts[e.event_type] || 0) + 1;
      }
      const topButtons = Object.entries(buttonCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([type, count]) => ({ type, count }));

      const broadcasts = (bc.data || []).map((b: { id: string; sent_count: number; failed_count: number }) => ({
        id: b.id,
        sent: b.sent_count,
        failed: b.failed_count,
      }));

      const totalUsers = u.count || 0;
      const tgOrders = to.count || 0;
      setStats({
        totalUsers,
        activeUsers: au.count || 0,
        totalOrders: o.count || 0,
        tgOrders,
        conversion: totalUsers ? Math.round((tgOrders / totalUsers) * 100) : 0,
        topButtons,
        broadcasts,
      });
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500" /></div>;
  }

  const cards = [
    { label: 'Всього користувачів', value: stats.totalUsers, icon: Users, color: 'from-blue-500 to-cyan-500' },
    { label: 'Активних (7 днів)', value: stats.activeUsers, icon: TrendingUp, color: 'from-emerald-500 to-teal-500' },
    { label: 'Замовлень через TG', value: stats.tgOrders, icon: Package, color: 'from-rose-500 to-orange-500' },
    { label: 'Конверсія', value: `${stats.conversion}%`, icon: MousePointerClick, color: 'from-violet-500 to-purple-500' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Аналітика</h1>
      <p className="text-sm text-slate-500 mb-6">Статистика Telegram-бота</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
              <div className={`w-11 h-11 rounded-lg bg-gradient-to-br ${c.color} flex items-center justify-center mb-3`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-2xl font-bold text-slate-800">{c.value}</p>
              <p className="text-sm text-slate-500">{c.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <MousePointerClick className="w-4 h-4" /> Топ кнопок за натисканнями
          </h2>
          {stats.topButtons.length === 0 ? (
            <p className="text-sm text-slate-400">Немає даних</p>
          ) : (
            <div className="space-y-2">
              {stats.topButtons.map((b, i) => {
                const max = stats.topButtons[0]?.count || 1;
                return (
                  <div key={b.type} className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 w-4">{i + 1}</span>
                    <span className="text-sm text-slate-600 w-32">{b.type.replace('menu_', '')}</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-rose-400 to-orange-400 rounded-full" style={{ width: `${(b.count / max) * 100}%` }} />
                    </div>
                    <span className="text-sm font-semibold text-slate-700 w-10 text-right">{b.count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Send className="w-4 h-4" /> Ефективність розсилок
          </h2>
          {stats.broadcasts.length === 0 ? (
            <p className="text-sm text-slate-400">Немає завершених розсилок</p>
          ) : (
            <div className="space-y-3">
              {stats.broadcasts.map((b) => {
                const total = b.sent + b.failed;
                const rate = total ? Math.round((b.sent / total) * 100) : 0;
                return (
                  <div key={b.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <span className="text-sm text-slate-600 font-mono">#{b.id.slice(0, 8)}</span>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-green-600">{b.sent} відправлено</span>
                      <span className="text-red-500">{b.failed} невдало</span>
                      <span className="font-semibold text-slate-700">{rate}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
