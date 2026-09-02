import { useEffect, useState, useCallback } from 'react';
import { Settings, Save, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface BotSetting {
  id: string;
  key: string;
  value: string;
  label: string;
  description: string;
  updated_at: string;
}

export function BotSettingsPanel() {
  const [settings, setSettings] = useState<BotSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('bot_settings')
      .select('*')
      .order('label', { ascending: true });
    const rows = (data || []) as BotSetting[];
    setSettings(rows);
    setDrafts(Object.fromEntries(rows.map((s) => [s.key, s.value])));
    setLoading(false);
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  async function saveSetting(key: string) {
    setSaving(key);
    const newValue = drafts[key];
    if (newValue === undefined) return;
    await supabase
      .from('bot_settings')
      .update({ value: newValue, updated_at: new Date().toISOString() })
      .eq('key', key);
    setSettings((prev) => prev.map((s) => s.key === key ? { ...s, value: newValue } : s));
    setSaving(null);
    setSavedKey(key);
    setTimeout(() => setSavedKey(null), 2000);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
      </div>
    );
  }

  const isNumeric = (key: string) => key === 'min_order_amount' || key === 'free_delivery_threshold';

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2 mb-1">
        <Settings className="w-6 h-6 text-rose-500" />
        Налаштування бота
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Змінюйте текст привітання, контакти, години роботи та інші параметри без переписування коду
      </p>

      <div className="space-y-4">
        {settings.map((s) => (
          <div key={s.id} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-start justify-between mb-3">
              <div>
                <label className="text-sm font-semibold text-slate-800">{s.label}</label>
                <p className="text-xs text-slate-400 mt-0.5">{s.description}</p>
              </div>
              {savedKey === s.key && (
                <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                  <CheckCircle2 className="w-4 h-4" /> Збережено
                </span>
              )}
            </div>
            {isNumeric(s.key) ? (
              <input
                type="number"
                value={drafts[s.key] ?? ''}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [s.key]: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-400"
              />
            ) : s.value.length > 60 || s.key === 'welcome_text' || s.key === 'maintenance_message' || s.key === 'contacts' || s.key === 'working_hours' ? (
              <textarea
                value={drafts[s.key] ?? ''}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [s.key]: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-400 resize-none"
              />
            ) : (
              <input
                type="text"
                value={drafts[s.key] ?? ''}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [s.key]: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-400"
              />
            )}
            <div className="flex justify-end mt-3">
              <button
                onClick={() => saveSetting(s.key)}
                disabled={saving === s.key || drafts[s.key] === s.value}
                className="flex items-center gap-2 px-4 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {saving === s.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Зберегти
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
