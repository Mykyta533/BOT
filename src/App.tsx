import { useState } from 'react';
import {
  ShoppingBag,
  Package,
  Send,
  BarChart3,
  Tags,
  Users,
  LayoutDashboard,
  Bot,
  Activity,
  Settings,
  ScrollText,
  CreditCard,
  Truck,
} from 'lucide-react';
import { Dashboard } from '@/components/Dashboard';
import { CatalogManager } from '@/components/CatalogManager';
import { OrdersManager } from '@/components/OrdersManager';
import { BroadcastManager } from '@/components/BroadcastManager';
import { AnalyticsView } from '@/components/AnalyticsView';
import { UsersView } from '@/components/UsersView';
import { TelegramSetup } from '@/components/TelegramSetup';
import { BotHealthPanel } from '@/components/BotHealthPanel';
import { BotSettingsPanel } from '@/components/BotSettingsPanel';
import { ActivityLog } from '@/components/ActivityLog';
import { PaymentsView } from '@/components/PaymentsView';
import { ShipmentsView } from '@/components/ShipmentsView';

export type Tab = 'dashboard' | 'catalog' | 'orders' | 'broadcasts' | 'analytics' | 'users' | 'telegram' | 'health' | 'settings' | 'activity' | 'payments' | 'shipments';

const NAV_ITEMS: { id: Tab; label: string; icon: typeof ShoppingBag }[] = [
  { id: 'dashboard', label: 'Дашборд', icon: LayoutDashboard },
  { id: 'catalog', label: 'Каталог', icon: Tags },
  { id: 'orders', label: 'Замовлення', icon: Package },
  { id: 'payments', label: 'Платежі', icon: CreditCard },
  { id: 'shipments', label: 'Доставка', icon: Truck },
  { id: 'broadcasts', label: 'Розсилки', icon: Send },
  { id: 'analytics', label: 'Аналітика', icon: BarChart3 },
  { id: 'users', label: 'Користувачі', icon: Users },
  { id: 'health', label: 'Стан системи', icon: Activity },
  { id: 'settings', label: 'Налаштування', icon: Settings },
  { id: 'activity', label: 'Журнал', icon: ScrollText },
  { id: 'telegram', label: 'Telegram', icon: Bot },
];

function App() {
  const [tab, setTab] = useState<Tab>('dashboard');

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col fixed inset-y-0 left-0 z-20">
        <div className="px-6 py-5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold leading-tight">BeautyBot</h1>
              <p className="text-xs text-slate-400">Адмін-панель</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-rose-500 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="px-6 py-4 border-t border-slate-800 text-xs text-slate-500">
          Telegram Shop Bot v1.0
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-64 p-8">
        <div className="max-w-7xl mx-auto">
          {tab === 'dashboard' && <Dashboard onNavigate={setTab} />}
          {tab === 'catalog' && <CatalogManager />}
          {tab === 'orders' && <OrdersManager />}
          {tab === 'payments' && <PaymentsView />}
          {tab === 'shipments' && <ShipmentsView />}
          {tab === 'broadcasts' && <BroadcastManager />}
          {tab === 'analytics' && <AnalyticsView />}
          {tab === 'users' && <UsersView />}
          {tab === 'telegram' && <TelegramSetup />}
          {tab === 'health' && <BotHealthPanel />}
          {tab === 'settings' && <BotSettingsPanel />}
          {tab === 'activity' && <ActivityLog />}
        </div>
      </main>
    </div>
  );
}

export default App;
