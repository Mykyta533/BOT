import { useEffect, useState } from 'react';
import { Send, Users, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Broadcast } from '@/lib/types';

const SEGMENTS = [
  { key: 'all', label: '👥 Всі користувачі' },
  { key: 'new', label: '🆕 Нові клієнти (30 днів)' },
  { key: 'loyal', label: '⭐ Постійні клієнти (3+ замовлень)' },
  { key: 'inactive', label: '😴 Без замовлень 30+ днів' },
];

export function BroadcastManager() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [message, setMessage] = useState('');
  const [segment, setSegment] = useState('all');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('broadcasts').select('*').order('created_at', { ascending: false });
      setBroadcasts((data || []) as Broadcast[]);
      setLoading(false);
    })();
  }, []);

  async function sendBroadcast() {
    if (!message.trim()) return;
    setSending(true);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-bot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          admin_action: 'broadcast',
          message,
          segment,
        }),
      });
      if (resp.ok) {
        setMessage('');
        const { data } = await supabase.from('broadcasts').select('*').order('created_at', { ascending: false });
        setBroadcasts((data || []) as Broadcast[]);
      }
    } catch {
      // Fallback
    }
    setSending(false);
  }

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500" /></div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-1">Розсилки</h1>
      <p className="text-sm text-slate-500 mb-6">Масові повідомлення користувачам бота</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Send className="w-4 h-4" /> Нова розсилка
          </h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Сегмент аудиторії</label>
              <select value={segment} onChange={(e) => setSegment(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-400">
                {SEGMENTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Текст повідомлення</label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} placeholder="Введіть текст розсилки..." className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-400" />
            </div>
            <button onClick={sendBroadcast} disabled={sending || !message.trim()} className="w-full px-4 py-2.5 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
              {sending ? 'Надсилання...' : 'Надіслати розсилку'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Users className="w-4 h-4" /> Історія розсилок
          </h2>
          {broadcasts.length === 0 ? (
            <p className="text-sm text-slate-400">Поки немає розсилок</p>
          ) : (
            <div className="space-y-3">
              {broadcasts.map((b) => (
                <div key={b.id} className="p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-500">{SEGMENTS.find((s) => s.key === b.segment)?.label || b.segment}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${b.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                      {b.status === 'completed' ? 'Завершено' : 'В процесі'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 mb-2 line-clamp-2">{b.message}</p>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="w-3 h-3" /> {b.sent_count}</span>
                    <span className="flex items-center gap-1 text-red-500"><XCircle className="w-3 h-3" /> {b.failed_count}</span>
                    <span className="text-slate-400">{new Date(b.created_at).toLocaleDateString('uk-UA')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
