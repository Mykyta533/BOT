import { useEffect, useState } from 'react';
import { Package, ChevronRight, X, Truck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Order, OrderItem, OrderStatusHistory } from '@/lib/types';
import { STATUS_LABELS as SL, STATUS_COLORS as SC } from '@/lib/types';

export function OrdersManager() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Order | null>(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      setOrders((data || []) as Order[]);
      setLoading(false);
    })();
  }, []);

  const filtered = filter === 'all' ? orders : orders.filter((o) => o.status === filter);

  async function updateStatus(orderId: string, status: string) {
    await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', orderId);
    await supabase.from('order_status_history').insert({ order_id: orderId, status });
    const { data } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle();
    if (data) {
      setOrders((prev) => prev.map((o) => (o.id === orderId ? (data as Order) : o)));
      setSelected(data as Order);
    }
  }

  async function addTtn(orderId: string, ttn: string) {
    await supabase.from('orders').update({ ttn, status: 'shipped', updated_at: new Date().toISOString() }).eq('id', orderId);
    await supabase.from('order_status_history').insert({ order_id: orderId, status: 'shipped', note: `ТТН: ${ttn}` });
    const { data } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle();
    if (data) {
      setOrders((prev) => prev.map((o) => (o.id === orderId ? (data as Order) : o)));
      setSelected(data as Order);
    }
  }

  const statuses = ['all', 'new', 'confirmed', 'paid', 'shipped', 'delivered', 'cancelled'];

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500" /></div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Замовлення</h1>
      <p className="text-sm text-slate-500 mb-6">{orders.length} замовлень</p>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              filter === s ? 'bg-rose-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {s === 'all' ? 'Всі' : SL[s] || s}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase">
                <th className="px-4 py-3">Номер</th>
                <th className="px-4 py-3">Клієнт</th>
                <th className="px-4 py-3">Сума</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Дата</th>
                <th className="px-4 py-3 text-right">Деталі</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-slate-700">№{o.number}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{o.customer_name || '—'}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-700">{o.total} грн</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full font-medium ${SC[o.status] || 'bg-slate-100 text-slate-600'}`}>
                      {SL[o.status] || o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">{new Date(o.created_at).toLocaleDateString('uk-UA')}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setSelected(o)} className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <OrderDetail
          order={selected}
          onClose={() => setSelected(null)}
          onUpdateStatus={updateStatus}
          onAddTtn={addTtn}
        />
      )}
    </div>
  );
}

function OrderDetail({ order, onClose, onUpdateStatus, onAddTtn }: {
  order: Order;
  onClose: () => void;
  onUpdateStatus: (id: string, status: string) => void;
  onAddTtn: (id: string, ttn: string) => void;
}) {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [history, setHistory] = useState<OrderStatusHistory[]>([]);
  const [ttnInput, setTtnInput] = useState('');

  useEffect(() => {
    (async () => {
      const [i, h] = await Promise.all([
        supabase.from('order_items').select('*').eq('order_id', order.id),
        supabase.from('order_status_history').select('*').eq('order_id', order.id).order('created_at', { ascending: true }),
      ]);
      setItems((i.data || []) as OrderItem[]);
      setHistory((h.data || []) as OrderStatusHistory[]);
    })();
  }, [order.id]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-slate-800">Замовлення №{order.number}</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-slate-400">Статус:</span> <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SC[order.status]}`}>{SL[order.status]}</span></div>
            <div><span className="text-slate-400">Сума:</span> <span className="font-semibold text-slate-700">{order.total} грн</span></div>
            <div><span className="text-slate-400">Клієнт:</span> <span className="text-slate-700">{order.customer_name || '—'}</span></div>
            <div><span className="text-slate-400">Телефон:</span> <span className="text-slate-700">{order.customer_phone || '—'}</span></div>
            <div><span className="text-slate-400">Доставка:</span> <span className="text-slate-700">{order.delivery_method || '—'}</span></div>
            <div><span className="text-slate-400">Оплата:</span> <span className="text-slate-700">{order.payment_method || '—'}</span></div>
            <div className="col-span-2"><span className="text-slate-400">Адреса:</span> <span className="text-slate-700">{order.address || '—'}</span></div>
            {order.ttn && <div className="col-span-2"><span className="text-slate-400">ТТН:</span> <span className="text-slate-700 font-mono">{order.ttn}</span></div>}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Товари</h3>
            <div className="space-y-1">
              {items.map((it) => (
                <div key={it.id} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg text-sm">
                  <span className="text-slate-700">{it.name} ×{it.quantity}</span>
                  <span className="font-semibold text-slate-700">{it.price * it.quantity} грн</span>
                </div>
              ))}
              {items.length === 0 && <p className="text-sm text-slate-400">Немає товарів</p>}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Історія статусів</h3>
            <div className="space-y-1">
              {history.map((h) => (
                <div key={h.id} className="text-sm text-slate-500 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                  {new Date(h.created_at).toLocaleString('uk-UA')} — <span className="font-medium text-slate-700">{SL[h.status] || h.status}</span>
                  {h.note && <span className="text-slate-400">({h.note})</span>}
                </div>
              ))}
              {history.length === 0 && <p className="text-sm text-slate-400">Немає історії</p>}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              <button onClick={() => onUpdateStatus(order.id, 'confirmed')} className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-sm hover:bg-emerald-600 transition-colors">✅ Підтвердити</button>
              <button onClick={() => onUpdateStatus(order.id, 'paid')} className="px-3 py-1.5 bg-cyan-500 text-white rounded-lg text-sm hover:bg-cyan-600 transition-colors">💳 Оплачено</button>
              <button onClick={() => onUpdateStatus(order.id, 'shipped')} className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600 transition-colors">📦 Відправлено</button>
              <button onClick={() => onUpdateStatus(order.id, 'delivered')} className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 transition-colors">📬 Доставлено</button>
              <button onClick={() => onUpdateStatus(order.id, 'cancelled')} className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition-colors">❌ Скасувати</button>
            </div>
            <div className="flex gap-2">
              <input value={ttnInput} onChange={(e) => setTtnInput(e.target.value)} placeholder="Номер ТТН..." className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-400" />
              <button onClick={() => { if (ttnInput) { onAddTtn(order.id, ttnInput); setTtnInput(''); } }} className="px-3 py-2 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-800 transition-colors flex items-center gap-1">
                <Truck className="w-4 h-4" /> Додати
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
