'use client';

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Archive, Edit3, FolderTree, Plus, Search, X } from 'lucide-react';
import { useStockoraStore } from '@/stores/useStockoraStore';
import { deriveInventoryBalances } from '@/lib/inventory-engine';
import { formatCurrency, formatQuantity } from '@/lib/formatters';
import { ProductCategory } from '@/types/erp';

export default function CategoriesPage() {
  const { data, settings, addCategory, updateCategory, archiveCategory } = useStockoraStore();

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<ProductCategory | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState('');

  const balances = useMemo(() => deriveInventoryBalances(data), [data]);

  const categoryStats = useMemo(() => {
    const stats = new Map<string, { productCount: number; units: number; value: number }>();
    for (const c of data.categories) {
      const prods = data.products.filter((p) => p.categoryId === c.id && p.status === 'ACTIVE');
      const catBalances = balances.filter((b) => b.categoryId === c.id);
      const units = catBalances.reduce((s, b) => s + b.onHandQuantity, 0);
      const value = catBalances.reduce((s, b) => s + b.totalValue, 0);
      stats.set(c.id, { productCount: prods.length, units, value });
    }
    return stats;
  }, [data.categories, data.products, balances]);

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.categories.filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
    );
  }, [data.categories, search]);

  const handleOpenCreate = () => {
    setEditingCat(null);
    setName('');
    setCode('');
    setDescription('');
    setParentId('');
    setModalOpen(true);
  };

  const handleOpenEdit = (cat: ProductCategory) => {
    setEditingCat(cat);
    setName(cat.name);
    setCode(cat.code);
    setDescription(cat.description);
    setParentId(cat.parentId ?? '');
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      toast.error('Category name and code are required.');
      return;
    }
    if (editingCat) {
      updateCategory(editingCat.id, {
        name,
        code: code.toUpperCase(),
        description,
        parentId: parentId || null,
      });
      toast.success(`Category ${name} updated.`);
    } else {
      addCategory({
        name,
        code,
        description,
        parentId: parentId || null,
      });
      toast.success(`Category ${name} created.`);
    }
    setModalOpen(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Product Categories
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Organize SKUs into hierarchical taxonomy groups with live valuation rollups
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-medium"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Create Category</span>
        </button>
      </div>

      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337]">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search category name, code, or description..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#111B2C] text-xs"
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-[#111B2C]/60 text-slate-500">
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-3">Category Name</th>
                <th className="py-3 px-3">Description</th>
                <th className="py-3 px-3 text-right">Active SKUs</th>
                <th className="py-3 px-3 text-right">On-Hand Units</th>
                <th className="py-3 px-3 text-right">Inventory Valuation</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredCategories.map((cat) => {
                const st = categoryStats.get(cat.id) ?? { productCount: 0, units: 0, value: 0 };
                const parent = data.categories.find((p) => p.id === cat.parentId);
                return (
                  <tr key={cat.id} className="hover:bg-slate-50 dark:hover:bg-[#1F3047]/50">
                    <td className="py-3 px-4 font-mono font-bold text-[#2563EB] dark:text-[#60A5FA]">
                      {cat.code}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white">
                      <div className="flex items-center gap-1.5">
                        <FolderTree className="w-3.5 h-3.5 text-slate-400" />
                        <span>{cat.name}</span>
                      </div>
                      {parent && (
                        <div className="text-[11px] text-slate-400 font-normal">
                          Parent: {parent.name}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                      {cat.description}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-medium">
                      {st.productCount}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      {formatQuantity(st.units)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold">
                      {formatCurrency(st.value, settings.defaultCurrency)}
                    </td>
                    <td className="py-3 px-3 font-medium">
                      {cat.status === 'ACTIVE' ? (
                        <span className="text-[#059669]">Active</span>
                      ) : (
                        <span className="text-slate-400">Archived</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(cat)}
                          className="p-1.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-[#1F3047]"
                          title="Edit Category"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {cat.status === 'ACTIVE' && (
                          <button
                            type="button"
                            onClick={() => {
                              archiveCategory(cat.id);
                              toast.success(
                                `Archived category ${cat.name}. Historical products preserved.`
                              );
                            }}
                            className="p-1.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-[#1F3047] text-rose-600"
                            title="Archive Category"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-sm font-semibold">
                {editingCat ? `Edit Category · ${editingCat.code}` : 'Create Product Category'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="p-1 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium mb-1">Code *</label>
                  <input
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="AUTO"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C] font-mono"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block font-medium mb-1">Category Name *</label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Industrial Automation"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium mb-1">Parent Category (Optional)</label>
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                >
                  <option value="">None (Top-Level Category)</option>
                  {data.categories
                    .filter((c) => c.id !== editingCat?.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block font-medium mb-1">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white font-medium"
                >
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
