import { useEffect, useState } from 'react';
import { Search, Gift, Package, Heart, User as UserIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { BotUser, LoyaltyAccount } from '@/lib/types';

interface UserWithStats extends BotUser {
  orderCount?: number;
  loyaltyBalance?: number;
  favCount?: number;
}

export function UsersView() {
  const [users, setUsers] = useState<UserWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      const { data: botUsers } = await supabase.from('bot_users').select('*').order('created_at', { ascending: false });
      if (!botUsers) { setLoading(false); return; }

      const enriched = await Promise.all(
        (botUsers as BotUser[]).map(async (u) => {
          const [o, l, f] = await Promise.all([
            supabase.from('orders').select('*', { count: 'exact', head: true }).eq('bot_user_id', u.id),
            supabase.from('loyalty_accounts').select('balance').eq('bot_user_id', u.id).maybeSingle(),
            supabase.from('favorites').select('*', { count: 'exact', head: true }).eq('bot_user_id', u.id),
          ]);
          return {
            ...u,
            orderCount: o.count || 0,
            loyaltyBalance: (l.data as LoyaltyAccount | null)?.balance || 0,
            favCount: f.count || 0,
          };
        })
      );
      setUsers(enriched);
      setLoading(false);
    })();
  }, []);

  const filtered = users.filter((u) =>
    !search ||
    (u.username || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.first_name || '').toLowerCase().includes(search.toLowerCase()) ||
    String(u.telegram_id).includes(search)
  );

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500" /></div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Користувачі</h1>
      <p className="text-sm text-slate-500 mb-6">{users.length} користувачів бота</p>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Пошук за ім'ям, username або Telegram ID..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase">
                <th className="px-4 py-3">Користувач</th>
                <th className="px-4 py-3">Telegram ID</th>
                <th className="px-4 py-3">Замовлень</th>
                <th className="px-4 py-3">Бонуси</th>
                <th className="px-4 py-3">Обране</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Реєстрація</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-rose-400 to-orange-400 flex items-center justify-center text-white text-sm font-semibold">
                        {(u.first_name || u.username || '?')[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700">{u.first_name || 'Без імені'} {u.last_name || ''}</p>
                        <p className="text-xs text-slate-400">@{u.username || '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 font-mono">{u.telegram_id}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-sm text-slate-600">
                      <Package className="w-3.5 h-3.5 text-slate-400" /> {u.orderCount}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-sm font-medium text-amber-600">
                      <Gift className="w-3.5 h-3.5" /> {u.loyaltyBalance}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-sm text-rose-500">
                      <Heart className="w-3.5 h-3.5" /> {u.favCount}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.is_admin ? (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-violet-100 text-violet-600 font-medium">Адмін</span>
                    ) : u.is_blocked ? (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-600 font-medium">Заблокований</span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-600 font-medium">Активний</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">{new Date(u.created_at).toLocaleDateString('uk-UA')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
