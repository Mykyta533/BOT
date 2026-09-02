import { useEffect, useState } from 'react';
import {
  Package,
  Tags,
  Users,
  TrendingUp,
  ArrowRight,
  ShoppingBag,
  Send,
  Heart,
  Gift,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Stats {
  products: number;
  orders: number;
  users: number;
  revenue: number;
}

import type { Tab } from '@/App';

export function Dashboard({ onNavigate }: { onNavigate: (t: Tab) => void }) {
  const [stats, setStats] = useState<Stats>({ products: 0, orders: 0, users: 0, revenue: 0 });
  const [recentOrders, setRecentOrders] = useState<{ number: string; total: number; status: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [p, o, u, r, ro] = await Promise.all([
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        supabase.from('bot_users').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('total').neq('status', 'cancelled'),
        supabase.from('orders').select('number, total, status, created_at').order('created_at', { ascending: false }).limit(5),
      ]);
      const revenue = (r.data || []).reduce((sum: number, o: { total: number }) => sum + Number(o.total), 0);
      setStats({
        products: p.count || 0,
        orders: o.count || 0,
        users: u.count || 0,
        revenue,
      });
      setRecentOrders(ro.data || []);
      setLoading(false);
    })();
  }, []);

  const cards: { label: string; value: string | number; icon: typeof Tags; color: string; tab: Tab }[] = [
    { label: 'Товарів', value: stats.products, icon: Tags, color: 'from-blue-500 to-cyan-500', tab: 'catalog' },
    { label: 'Замовлень', value: stats.orders, icon: Package, color: 'from-rose-500 to-orange-500', tab: 'orders' },
    { label: 'Користувачів', value: stats.users, icon: Users, color: 'from-emerald-500 to-teal-500', tab: 'users' },
    { label: 'Дохід', value: `${stats.revenue} грн`, icon: TrendingUp, color: 'from-violet-500 to-purple-500', tab: 'orders' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Дашборд</h1>
      <p className="text-sm text-slate-500 mb-6">Огляд вашого Telegram-магазину</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.label}
              onClick={() => onNavigate(c.tab)}
              className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow text-left group"
            >
              <div className={`w-11 h-11 rounded-lg bg-gradient-to-br ${c.color} flex items-center justify-center mb-3`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-2xl font-bold text-slate-800">{c.value}</p>
              <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                {c.label}
                <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </p>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Package className="w-4 h-4" /> Останні замовлення
          </h2>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-slate-400">Поки немає замовлень</p>
          ) : (
            <div className="space-y-2">
              {recentOrders.map((o) => (
                <div key={o.number} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-700">№{o.number}</p>
                    <p className="text-xs text-slate-400">{new Date(o.created_at).toLocaleDateString('uk-UA')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-700">{o.total} грн</p>
                    <p className="text-xs text-slate-400">{o.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <ShoppingBag className="w-4 h-4" /> Швидкі дії
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => onNavigate('catalog')} className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors text-sm font-medium text-slate-700">
              <Tags className="w-4 h-4 text-blue-500" /> Каталог
            </button>
            <button onClick={() => onNavigate('orders')} className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors text-sm font-medium text-slate-700">
              <Package className="w-4 h-4 text-rose-500" /> Замовлення
            </button>
            <button onClick={() => onNavigate('broadcasts')} className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors text-sm font-medium text-slate-700">
              <Send className="w-4 h-4 text-amber-500" /> Розсилка
            </button>
            <button onClick={() => onNavigate('analytics')} className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors text-sm font-medium text-slate-700">
              <TrendingUp className="w-4 h-4 text-emerald-500" /> Аналітика
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
