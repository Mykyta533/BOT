import { useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2, X, Tag, Package } from 'lucide-react';
import { supabase, STORAGE_URL } from '@/lib/supabase';
import type { Product, Category } from '@/lib/types';

export function CatalogManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    const [p, c] = await Promise.all([
      supabase.from('products').select('*').order('created_at', { ascending: false }),
      supabase.from('categories').select('*').order('name'),
    ]);
    setProducts((p.data || []) as Product[]);
    setCategories((c.data || []) as Category[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = products.filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.brand || '').toLowerCase().includes(search.toLowerCase())
  );

  const catName = (id: string) => categories.find((c) => c.id === id)?.name || '—';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Каталог товарів</h1>
          <p className="text-sm text-slate-500">{products.length} товарів</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Додати товар
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Пошук за назвою або брендом..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500" /></div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase">
                  <th className="px-4 py-3">Товар</th>
                  <th className="px-4 py-3">Категорія</th>
                  <th className="px-4 py-3">Ціна</th>
                  <th className="px-4 py-3">Залишок</th>
                  <th className="px-4 py-3">Прапорці</th>
                  <th className="px-4 py-3 text-right">Дії</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.image_path ? (
                          <img src={`${STORAGE_URL}/${p.image_path}`} alt="" className="w-10 h-10 rounded-lg object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                            <Package className="w-4 h-4 text-slate-400" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-slate-700">{p.name}</p>
                          <p className="text-xs text-slate-400">{p.brand || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{catName(p.category_id)}</td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold text-slate-700">{p.price} грн</span>
                      {p.old_price && <span className="text-xs text-slate-400 line-through ml-1">{p.old_price}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-medium ${p.stock > 0 ? 'text-slate-700' : 'text-red-500'}`}>{p.stock}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {p.is_new && <span className="px-1.5 py-0.5 text-xs rounded bg-blue-100 text-blue-600">new</span>}
                        {p.is_hit && <span className="px-1.5 py-0.5 text-xs rounded bg-amber-100 text-amber-600">hit</span>}
                        {p.is_eco && <span className="px-1.5 py-0.5 text-xs rounded bg-green-100 text-green-600">eco</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => { setEditing(p); setShowForm(true); }} className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={async () => { await supabase.from('products').delete().eq('id', p.id); load(); }} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <ProductForm
          product={editing}
          categories={categories}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}

function ProductForm({ product, categories, onClose, onSaved }: {
  product: Product | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: product?.name || '',
    brand: product?.brand || '',
    description: product?.description || '',
    price: product?.price || 0,
    old_price: product?.old_price || '',
    stock: product?.stock || 0,
    rating: product?.rating || 0,
    country: product?.country || '',
    volume: product?.volume || '',
    sku: product?.sku || '',
    barcode: product?.barcode || '',
    category_id: product?.category_id || '',
    is_new: product?.is_new || false,
    is_hit: product?.is_hit || false,
    is_eco: product?.is_eco || false,
    is_active: product?.is_active ?? true,
    image_path: product?.image_path || '',
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const data: Record<string, unknown> = {
      ...form,
      old_price: form.old_price === '' ? null : Number(form.old_price),
      price: Number(form.price),
      stock: Number(form.stock),
      rating: Number(form.rating),
    };
    if (product) {
      await supabase.from('products').update(data).eq('id', product.id);
    } else {
      await supabase.from('products').insert(data);
    }
    setSaving(false);
    onSaved();
  }

  const field = (label: string, key: string, type = 'text') => (
    <div>
      <label className="text-xs font-medium text-slate-500 mb-1 block">{label}</label>
      <input
        type={type}
        value={String(form[key as keyof typeof form] ?? '')}
        onChange={(e) => setForm({ ...form, [key]: type === 'number' ? Number(e.target.value) : e.target.value })}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
      />
    </div>
  );

  const check = (label: string, key: string) => (
    <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
      <input type="checkbox" checked={form[key as keyof typeof form] as boolean} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} className="rounded" />
      {label}
    </label>
  );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-slate-800">{product ? 'Редагувати товар' : 'Новий товар'}</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {field('Назва', 'name')}
            {field('Бренд', 'brand')}
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Опис</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-400" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            {field('Ціна', 'price', 'number')}
            {field('Стара ціна', 'old_price', 'number')}
            {field('Залишок', 'stock', 'number')}
          </div>
          <div className="grid grid-cols-3 gap-4">
            {field('Рейтинг', 'rating', 'number')}
            {field('Країна', 'country')}
            {field('Об\'єм', 'volume')}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {field('Артикул (SKU)', 'sku')}
            {field('Штрихкод', 'barcode')}
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Категорія</label>
            <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-400">
              <option value="">Без категорії</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            {field('Шлях до фото (Storage)', 'image_path')}
          </div>
          <div className="flex flex-wrap gap-4 pt-2">
            {check('🆕 Новинка', 'is_new')}
            {check('⭐ Хіт', 'is_hit')}
            {check('🌿 Еко', 'is_eco')}
            {check('Активний', 'is_active')}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Скасувати</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors text-sm font-medium disabled:opacity-50">
            {saving ? 'Збереження...' : 'Зберегти'}
          </button>
        </div>
      </div>
    </div>
  );
}
