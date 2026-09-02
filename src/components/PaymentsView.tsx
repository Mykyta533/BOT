import { useEffect, useState, useCallback } from 'react';
import {
  CreditCard,
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Filter,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-bot`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

interface Transaction {
  id: string;
  order_id: string | null;
  provider: string;
  payment_id: string | null;
  invoice_id: string | null;
  status: string;
  amount: number;
  currency: string;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
  refunded_at: string | null;
}

interface StatusHistoryEntry {
  id: string;
  status: string;
  note: string | null;
  created_at: string;
}

const STATUS_META: Record<string, { label: string; icon: typeof CheckCircle2; color: string }> = {
  pending: { label: 'Очікує', icon: Clock, color: 'text-amber-600 bg-amber-50' },
  paid: { label: 'Оплачено', icon: CheckCircle2, color: 'text-green-600 bg-green-50' },
  failed: { label: 'Помилка', icon: XCircle, color: 'text-red-600 bg-red-50' },
  refunded: { label: 'Повернуто', icon: RotateCcw, color: 'text-blue-600 bg-blue-50' },
  expired: { label: 'Минулий', icon: AlertCircle, color: 'text-slate-500 bg-slate-50' },
};

const PROVIDER_LABELS: Record<string, string> = {
  monobank: 'Monobank',
  liqpay: 'LiqPay',
  wayforpay: 'WayForPay',
  privat: 'PrivatBank',
  cod: 'Післяплата',
};

const PER_PAGE = 20;

export function PaymentsView() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<string>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, StatusHistoryEntry[]>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<Record<string, { ok: boolean; msg: string }>>({});

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('payment_transactions')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PER_PAGE, page * PER_PAGE + PER_PAGE - 1);
    if (filter !== 'all') {
      query = query.eq('status', filter);
    }
    const { data, count } = await query;
    setTransactions((data || []) as Transaction[]);
    setTotal(count || 0);
    setLoading(false);
  }, [page, filter]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  async function fetchHistory(txnId: string) {
    const { data } = await supabase
      .from('payment_status_history')
      .select('*')
      .eq('transaction_id', txnId)
      .order('created_at', { ascending: true });
    setHistory((prev) => ({ ...prev, [txnId]: (data || []) as StatusHistoryEntry[] }));
  }

  async function checkStatus(txn: Transaction) {
    setActionLoading(`check-${txn.id}`);
    try {
      const resp = await fetch(`${FN_URL}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({ admin_action: 'check_payment', transaction_id: txn.id }),
      });
      const data = await resp.json();
      if (data.ok) {
        setActionResult((prev) => ({ ...prev, [txn.id]: { ok: true, msg: `Статус: ${data.status}` } }));
        await fetchTransactions();
        await fetchHistory(txn.id);
      } else {
        setActionResult((prev) => ({ ...prev, [txn.id]: { ok: false, msg: data.error || 'Помилка' } }));
      }
    } catch {
      setActionResult((prev) => ({ ...prev, [txn.id]: { ok: false, msg: 'Мережева помилка' } }));
    }
    setActionLoading(null);
    setTimeout(() => setActionResult((prev) => { const c = { ...prev }; delete c[txn.id]; return c; }), 4000);
  }

  async function refund(txn: Transaction) {
    if (!confirm(`Повернути ${txn.amount} ${txn.currency} для транзакції ${txn.payment_id || txn.id.slice(0, 8)}?`)) return;
    setActionLoading(`refund-${txn.id}`);
    try {
      const resp = await fetch(`${FN_URL}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({ admin_action: 'refund_payment', transaction_id: txn.id, amount: txn.amount }),
      });
      const data = await resp.json();
      if (data.ok) {
        setActionResult((prev) => ({ ...prev, [txn.id]: { ok: true, msg: 'Повернення виконано' } }));
        await fetchTransactions();
        await fetchHistory(txn.id);
      } else {
        setActionResult((prev) => ({ ...prev, [txn.id]: { ok: false, msg: data.error || 'Помилка повернення' } }));
      }
    } catch {
      setActionResult((prev) => ({ ...prev, [txn.id]: { ok: false, msg: 'Мережева помилка' } }));
    }
    setActionLoading(null);
    setTimeout(() => setActionResult((prev) => { const c = { ...prev }; delete c[txn.id]; return c; }), 4000);
  }

  const totalPages = Math.ceil(total / PER_PAGE) || 1;
  const statusFilters = ['all', 'pending', 'paid', 'failed', 'refunded', 'expired'];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2 mb-1">
        <CreditCard className="w-6 h-6 text-rose-500" />
        Платежі
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Історія транзакцій, перевірка статусу та повернення коштів
      </p>

      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
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
      ) : transactions.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-slate-100">
          <p className="text-slate-400">Транзакцій поки немає</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="divide-y divide-slate-50">
              {transactions.map((txn) => {
                const meta = STATUS_META[txn.status] || STATUS_META.pending;
                const StatusIcon = meta.icon;
                const isExpanded = expanded === txn.id;
                const txnHistory = history[txn.id] || [];
                const result = actionResult[txn.id];
                return (
                  <div key={txn.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                          <StatusIcon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-slate-800">
                              {PROVIDER_LABELS[txn.provider] || txn.provider}
                            </span>
                            <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${meta.color}`}>
                              {meta.label}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {txn.amount} {txn.currency} · {new Date(txn.created_at).toLocaleString('uk-UA')}
                          </p>
                          {txn.payment_id && (
                            <p className="text-xs text-slate-400 mt-0.5">
                              ID: {txn.payment_id.slice(0, 20)}{txn.payment_id.length > 20 ? '…' : ''}
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
                        {txn.status === 'pending' && (
                          <button
                            onClick={() => checkStatus(txn)}
                            disabled={actionLoading === `check-${txn.id}`}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                          >
                            {actionLoading === `check-${txn.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                            Перевірити
                          </button>
                        )}
                        {txn.status === 'paid' && (
                          <button
                            onClick={() => refund(txn)}
                            disabled={actionLoading === `refund-${txn.id}`}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-red-200 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            {actionLoading === `refund-${txn.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                            Повернути
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (isExpanded) {
                              setExpanded(null);
                            } else {
                              setExpanded(txn.id);
                              if (!history[txn.id]) fetchHistory(txn.id);
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
                        <p className="text-xs font-semibold text-slate-500 mb-2">Історія статусів:</p>
                        {txnHistory.length === 0 ? (
                          <p className="text-xs text-slate-400">Завантаження…</p>
                        ) : (
                          <div className="space-y-1.5">
                            {txnHistory.map((h) => {
                              const hm = STATUS_META[h.status] || STATUS_META.pending;
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
