import { useEffect, useState, useCallback } from 'react';
import {
  Truck,
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Package,
  MapPin,
  FileText,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Search,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-bot`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

interface Shipment {
  id: string;
  order_id: string | null;
  provider: string;
  ttn: string | null;
  ref: string | null;
  status: string;
  cost: number | null;
  last_checked_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
  provider_status_code: string | null;
  provider_status_text: string | null;
}

interface ShipmentHistoryEntry {
  id: string;
  status: string;
  note: string | null;
  created_at: string;
}

interface OrderInfo {
  number: string;
  total: number;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_city_name: string | null;
  delivery_warehouse_name: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  status: string;
}

const STATUS_META: Record<string, { label: string; icon: typeof CheckCircle2; color: string }> = {
  created: { label: 'Створено', icon: Package, color: 'text-blue-600 bg-blue-50' },
  in_transit: { label: 'У дорозі', icon: Truck, color: 'text-amber-600 bg-amber-50' },
  arrived: { label: 'У відділенні', icon: MapPin, color: 'text-indigo-600 bg-indigo-50' },
  delivered: { label: 'Доставлено', icon: CheckCircle2, color: 'text-green-600 bg-green-50' },
  refused: { label: 'Відмова', icon: XCircle, color: 'text-red-600 bg-red-50' },
  cancelled: { label: 'Скасовано', icon: AlertCircle, color: 'text-slate-500 bg-slate-50' },
  error: { label: 'Помилка', icon: AlertCircle, color: 'text-red-600 bg-red-50' },
};

const PER_PAGE = 15;

export function ShipmentsView() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [orders, setOrders] = useState<Record<string, OrderInfo>>({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, ShipmentHistoryEntry[]>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [ttnSearch, setTtnSearch] = useState('');
  const [ttnResult, setTtnResult] = useState<{ ok: boolean; status?: string; statusText?: string; error?: string } | null>(null);
  const [ttnSearching, setTtnSearching] = useState(false);

  const fetchShipments = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('shipments')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PER_PAGE, page * PER_PAGE + PER_PAGE - 1);
    if (filter !== 'all') {
      query = query.eq('status', filter);
    }
    const { data, count } = await query;
    setShipments((data || []) as Shipment[]);
    setTotal(count || 0);

    if (data && data.length > 0) {
      const orderIds = data.map((s) => s.order_id).filter(Boolean) as string[];
      if (orderIds.length > 0) {
        const { data: orderData } = await supabase
          .from('orders')
          .select('id, number, total, customer_name, customer_phone, delivery_city_name, delivery_warehouse_name, recipient_name, recipient_phone, status')
          .in('id', orderIds);
        const orderMap: Record<string, OrderInfo> = {};
        for (const o of orderData || []) {
          orderMap[o.id] = o as OrderInfo;
        }
        setOrders(orderMap);
      }
    }
    setLoading(false);
  }, [page, filter]);

  useEffect(() => { fetchShipments(); }, [fetchShipments]);

  async function fetchHistory(shipmentId: string) {
    const { data } = await supabase
      .from('shipment_status_history')
      .select('*')
      .eq('shipment_id', shipmentId)
      .order('created_at', { ascending: true });
    setHistory((prev) => ({ ...prev, [shipmentId]: (data || []) as ShipmentHistoryEntry[] }));
  }

  async function callAdmin(action: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const resp = await fetch(FN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({ admin_action: action, ...payload }),
    });
    return resp.json();
  }

  async function trackShipmentAction(shipment: Shipment) {
    setActionLoading(`track-${shipment.id}`);
    try {
      const data = await callAdmin('track_shipment', { shipment_id: shipment.id });
      if (data.ok) {
        setActionResult((prev) => ({ ...prev, [shipment.id]: { ok: true, msg: `Статус: ${data.status}` } }));
        await fetchShipments();
        await fetchHistory(shipment.id);
      } else {
        setActionResult((prev) => ({ ...prev, [shipment.id]: { ok: false, msg: (data.error as string) || 'Помилка' } }));
      }
    } catch {
      setActionResult((prev) => ({ ...prev, [shipment.id]: { ok: false, msg: 'Мережева помилка' } }));
    }
    setActionLoading(null);
    setTimeout(() => setActionResult((prev) => { const c = { ...prev }; delete c[shipment.id]; return c; }), 4000);
  }

  async function createTtn(orderId: string) {
    setActionLoading(`ttn-${orderId}`);
    try {
      const data = await callAdmin('np_create_ttn', { order_id: orderId });
      if (data.ok) {
        setActionResult((prev) => ({ ...prev, [`order-${orderId}`]: { ok: true, msg: `TTN створено: ${data.ttn || ''}` } }));
        await fetchShipments();
      } else {
        setActionResult((prev) => ({ ...prev, [`order-${orderId}`]: { ok: false, msg: (data.error as string) || 'Помилка створення TTN' } }));
      }
    } catch {
      setActionResult((prev) => ({ ...prev, [`order-${orderId}`]: { ok: false, msg: 'Мережева помилка' } }));
    }
    setActionLoading(null);
    setTimeout(() => setActionResult((prev) => { const c = { ...prev }; delete c[`order-${orderId}`]; return c; }), 5000);
  }

  async function cancelShipmentAction(shipment: Shipment) {
    if (!confirm(`Скасувати накладну ${shipment.ttn}?`)) return;
    setActionLoading(`cancel-${shipment.id}`);
    try {
      const data = await callAdmin('cancel_shipment', { shipment_id: shipment.id });
      if (data.ok) {
        setActionResult((prev) => ({ ...prev, [shipment.id]: { ok: true, msg: 'Накладну скасовано' } }));
        await fetchShipments();
        await fetchHistory(shipment.id);
      } else {
        setActionResult((prev) => ({ ...prev, [shipment.id]: { ok: false, msg: (data.error as string) || 'Помилка' } }));
      }
    } catch {
      setActionResult((prev) => ({ ...prev, [shipment.id]: { ok: false, msg: 'Мережева помилка' } }));
    }
    setActionLoading(null);
    setTimeout(() => setActionResult((prev) => { const c = { ...prev }; delete c[shipment.id]; return c; }), 4000);
  }

  async function getDocuments(shipment: Shipment) {
    setActionLoading(`docs-${shipment.id}`);
    try {
      const data = await callAdmin('shipment_documents', { shipment_id: shipment.id });
      if (data.ok && (data.documents as Array<{ url: string }>)?.[0]?.url) {
        window.open((data.documents as Array<{ url: string }>)[0].url, '_blank');
      } else {
        setActionResult((prev) => ({ ...prev, [shipment.id]: { ok: false, msg: 'Документи недоступні' } }));
      }
    } catch {
      setActionResult((prev) => ({ ...prev, [shipment.id]: { ok: false, msg: 'Мережева помилка' } }));
    }
    setActionLoading(null);
    setTimeout(() => setActionResult((prev) => { const c = { ...prev }; delete c[shipment.id]; return c; }), 4000);
  }

  async function searchByTtn() {
    if (!ttnSearch.trim()) return;
    setTtnSearching(true);
    setTtnResult(null);
    try {
      const data = await callAdmin('track_ttn', { ttn: ttnSearch.trim() });
      setTtnResult(data as { ok: boolean; status?: string; statusText?: string; error?: string });
    } catch {
      setTtnResult({ ok: false, error: 'Мережева помилка' });
    }
    setTtnSearching(false);
  }

  const totalPages = Math.ceil(total / PER_PAGE) || 1;
  const statusFilters = ['all', 'created', 'in_transit', 'arrived', 'delivered', 'refused', 'cancelled', 'error'];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2 mb-1">
        <Truck className="w-6 h-6 text-rose-500" />
        Доставка
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Відправлення, створення ТТН, відстеження та документи Нової пошти
      </p>

      {/* TTN Search */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-6">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input
            type="text"
            value={ttnSearch}
            onChange={(e) => setTtnSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchByTtn()}
            placeholder="Введіть ТТН для відстеження..."
            className="flex-1 text-sm outline-none bg-transparent text-slate-700"
          />
          <button
            onClick={searchByTtn}
            disabled={ttnSearching}
            className="flex items-center gap-1 px-3 py-1.5 bg-rose-500 text-white rounded-lg text-xs font-medium hover:bg-rose-600 disabled:opacity-50"
          >
            {ttnSearching ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Перевірити
          </button>
        </div>
        {ttnResult && (
          <div className={`mt-3 text-sm ${ttnResult.ok ? 'text-green-600' : 'text-red-600'}`}>
            {ttnResult.ok
              ? `Статус: ${ttnResult.statusText || ttnResult.status || 'невідомий'}`
              : ttnResult.error || 'Помилка відстеження'}
          </div>
        )}
      </div>

      {/* Status filters */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        {statusFilters.map((s) => (
          <button
            key={s}
            onClick={() => { setFilter(s); setPage(0); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              filter === s ? 'bg-rose-500 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {s === 'all' ? `Усі (${total})` : STATUS_META[s]?.label || s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
        </div>
      ) : shipments.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-slate-100">
          <Truck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400">Відправлень поки немає</p>
          <p className="text-xs text-slate-400 mt-1">Створіть ТТН зі сторінки Замовлень</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="divide-y divide-slate-50">
              {shipments.map((shipment) => {
                const meta = STATUS_META[shipment.status] || STATUS_META.created;
                const StatusIcon = meta.icon;
                const isExpanded = expanded === shipment.id;
                const hist = history[shipment.id] || [];
                const order = shipment.order_id ? orders[shipment.order_id] : null;
                const result = actionResult[shipment.id];
                return (
                  <div key={shipment.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                          <StatusIcon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-slate-800">
                              {shipment.ttn || 'TTN відсутня'}
                            </span>
                            <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${meta.color}`}>
                              {meta.label}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {shipment.provider} · {new Date(shipment.created_at).toLocaleString('uk-UA')}
                            {shipment.cost ? ` · ${shipment.cost} грн` : ''}
                          </p>
                          {order && (
                            <p className="text-xs text-slate-400 mt-0.5">
                              Замовлення №{order.number} · {order.customer_name || '—'} · {order.delivery_city_name || '—'}
                            </p>
                          )}
                          {shipment.last_checked_at && (
                            <p className="text-xs text-slate-300 mt-0.5">
                              Перевірено: {new Date(shipment.last_checked_at).toLocaleString('uk-UA')}
                            </p>
                          )}
                          {result && (
                            <p className={`text-xs mt-1 ${result.ok ? 'text-green-600' : 'text-red-600'}`}>
                              {result.msg}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {shipment.status !== 'delivered' && shipment.status !== 'cancelled' && (
                          <button
                            onClick={() => trackShipmentAction(shipment)}
                            disabled={actionLoading === `track-${shipment.id}`}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                          >
                            {actionLoading === `track-${shipment.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                            Відстежити
                          </button>
                        )}
                        {shipment.status !== 'cancelled' && shipment.status !== 'delivered' && (
                          <button
                            onClick={() => cancelShipmentAction(shipment)}
                            disabled={actionLoading === `cancel-${shipment.id}`}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-red-200 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            Скасувати
                          </button>
                        )}
                        {shipment.ttn && (
                          <button
                            onClick={() => getDocuments(shipment)}
                            disabled={actionLoading === `docs-${shipment.id}`}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                          >
                            {actionLoading === `docs-${shipment.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (isExpanded) {
                              setExpanded(null);
                            } else {
                              setExpanded(shipment.id);
                              if (!history[shipment.id]) fetchHistory(shipment.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-600"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 ml-12 pl-3 border-l-2 border-slate-100">
                        {order && (
                          <div className="mb-3 text-xs text-slate-500 space-y-0.5">
                            <p><span className="font-medium">Отримувач:</span> {order.recipient_name || order.customer_name || '—'}</p>
                            <p><span className="font-medium">Телефон:</span> {order.recipient_phone || order.customer_phone || '—'}</p>
                            <p><span className="font-medium">Місто:</span> {order.delivery_city_name || '—'}</p>
                            <p><span className="font-medium">Відділення:</span> {order.delivery_warehouse_name || '—'}</p>
                          </div>
                        )}
                        <p className="text-xs font-semibold text-slate-500 mb-2">Історія статусів:</p>
                        {hist.length === 0 ? (
                          <p className="text-xs text-slate-400">Завантаження…</p>
                        ) : (
                          <div className="space-y-1.5">
                            {hist.map((h) => {
                              const hm = STATUS_META[h.status] || STATUS_META.created;
                              return (
                                <div key={h.id} className="flex items-start gap-2 text-xs">
                                  <span className={`px-1.5 py-0.5 rounded ${hm.color} font-medium flex-shrink-0`}>
                                    {hm.label}
                                  </span>
                                  <span className="text-slate-400">
                                    {new Date(h.created_at).toLocaleString('uk-UA')}
                                    {h.note ? ` · ${h.note}` : ''}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
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
