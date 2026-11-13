'use client';

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Archive,
  Building2,
  Edit3,
  Eye,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Star,
  X,
} from 'lucide-react';
import { useStockoraStore } from '@/stores/useStockoraStore';
import { formatCurrency, formatDateShort } from '@/lib/formatters';
import { Supplier } from '@/types/erp';

export default function SuppliersDirectoryPage() {
  const { data, settings, addSupplier, updateSupplier, archiveSupplier } = useStockoraStore();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'ARCHIVED'>('ACTIVE');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const [code, setCode] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Net 30');

  const filteredSuppliers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.suppliers
      .filter((s) => statusFilter === 'ALL' || s.status === statusFilter)
      .filter(
        (s) =>
          !q ||
          s.companyName.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          s.contactName.toLowerCase().includes(q) ||
          s.location.toLowerCase().includes(q)
      );
  }, [data.suppliers, statusFilter, search]);

  const openCreateModal = () => {
    setEditingSupplier(null);
    setCode(`SUP-${130 + data.suppliers.length}`);
    setCompanyName('');
    setContactName('');
    setEmail('');
    setPhone('+1 (800) 555-0188');
    setLocation('');
    setPaymentTerms('Net 30');
    setModalOpen(true);
  };

  const openEditModal = (sup: Supplier) => {
    setEditingSupplier(sup);
    setCode(sup.code);
    setCompanyName(sup.companyName);
    setContactName(sup.contactName);
    setEmail(sup.email);
    setPhone(sup.phone);
    setLocation(sup.location);
    setPaymentTerms(sup.paymentTerms);
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSupplier) {
      updateSupplier(editingSupplier.id, {
        code: code.toUpperCase(),
        companyName,
        contactName,
        email,
        phone,
        location,
        paymentTerms,
      });
      toast.success(`Updated supplier ${companyName}.`);
    } else {
      addSupplier({
        code: code.toUpperCase(),
        companyName,
        contactName,
        email,
        phone,
        location,
        status: 'ACTIVE',
        preferredCategoryIds: [data.categories[0]?.id ?? 'cat-01'],
        paymentTerms,
        rating: 4.8,
      });
      toast.success(`Added supplier ${companyName}.`);
    }
    setModalOpen(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Supplier Directory & Vendor Relations
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage approved manufacturing vendors, lead times, linked SKUs, and purchase history
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-medium"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Supplier</span>
        </button>
      </div>

      {/* Filters */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company name, supplier code, contact, or location..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#111B2C] text-xs"
          />
        </div>
        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#111B2C] text-xs">
          {(['ACTIVE', 'ARCHIVED', 'ALL'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded-md font-medium ${
                statusFilter === st
                  ? 'bg-white dark:bg-[#172337] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500'
              }`}
            >
              {st === 'ALL' ? 'All' : st === 'ACTIVE' ? 'Active' : 'Archived'}
            </button>
          ))}
        </div>
      </div>

      {/* Supplier Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-[#111B2C]/60 text-slate-500">
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-3">Company & Contact</th>
                <th className="py-3 px-3">Email & Phone</th>
                <th className="py-3 px-3">Location</th>
                <th className="py-3 px-3">Terms / Rating</th>
                <th className="py-3 px-3 text-right">Linked SKUs</th>
                <th className="py-3 px-3 text-right">Open POs</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredSuppliers.map((sup) => {
                const linkedSkus = data.products.filter(
                  (p) => p.preferredSupplierId === sup.id
                ).length;
                const openPOs = data.purchaseOrders.filter(
                  (po) =>
                    po.supplierId === sup.id &&
                    (po.status === 'ORDERED' || po.status === 'PARTIALLY_RECEIVED')
                ).length;

                return (
                  <tr key={sup.id} className="hover:bg-slate-50 dark:hover:bg-[#1F3047]/50">
                    <td className="py-3 px-4 font-mono font-bold text-[#2563EB] dark:text-[#60A5FA]">
                      {sup.code}
                    </td>
                    <td className="py-3 px-3">
                      <button
                        type="button"
                        onClick={() => setSelectedSupplier(sup)}
                        className="font-semibold text-slate-900 dark:text-white hover:text-[#2563EB] text-left"
                      >
                        {sup.companyName}
                      </button>
                      <div className="text-[11px] text-slate-500">{sup.contactName}</div>
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                      <div>{sup.email}</div>
                      <div className="text-[11px] text-slate-400">{sup.phone}</div>
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                      {sup.location}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-medium">{sup.paymentTerms}</span>
                      <span className="ml-2 text-amber-500 font-mono">★ {sup.rating}</span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-medium">
                      {linkedSkus}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-[#2563EB] dark:text-[#60A5FA]">
                      {openPOs}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setSelectedSupplier(sup)}
                          className="p-1.5 rounded border border-slate-200 dark:border-slate-700"
                          title="Inspect Supplier"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(sup)}
                          className="p-1.5 rounded border border-slate-200 dark:border-slate-700"
                          title="Edit Supplier"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {sup.status === 'ACTIVE' && (
                          <button
                            type="button"
                            onClick={() => {
                              archiveSupplier(sup.id);
                              toast.success(`Supplier ${sup.companyName} archived.`);
                            }}
                            className="p-1.5 rounded border border-slate-200 dark:border-slate-700 text-rose-600"
                            title="Archive Supplier"
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

      {/* Supplier Details Drawer */}
      {selectedSupplier && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-xs"
          onClick={() => setSelectedSupplier(null)}
        >
          <div
            className="w-full max-w-md h-full bg-white dark:bg-[#172337] border-l border-slate-200 dark:border-slate-700 p-6 overflow-y-auto space-y-5 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono font-bold text-[#2563EB] dark:text-[#60A5FA]">
                  {selectedSupplier.code}
                </div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                  {selectedSupplier.companyName}
                </h2>
              </div>
              <button onClick={() => setSelectedSupplier(null)} className="p-1 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              <div className="py-2 flex justify-between">
                <span className="text-slate-500">Primary Contact</span>
                <span className="font-medium">{selectedSupplier.contactName}</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-slate-500">Email</span>
                <span>{selectedSupplier.email}</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-slate-500">Phone</span>
                <span>{selectedSupplier.phone}</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-slate-500">Location</span>
                <span>{selectedSupplier.location}</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-slate-500">Payment Terms</span>
                <span className="font-semibold">{selectedSupplier.paymentTerms}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-semibold">Supplied Catalog SKUs</div>
              {data.products
                .filter((p) => p.preferredSupplierId === selectedSupplier.id)
                .map((p) => (
                  <div
                    key={p.id}
                    className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#111B2C] flex items-center justify-between"
                  >
                    <div>
                      <div className="font-mono font-semibold text-[#2563EB] dark:text-[#60A5FA]">
                        {p.sku}
                      </div>
                      <div className="text-slate-500">{p.name}</div>
                    </div>
                    <span className="font-mono">
                      {formatCurrency(p.purchaseCost, settings.defaultCurrency)}
                    </span>
                  </div>
                ))}
            </div>

            <div className="space-y-2">
              <div className="font-semibold">Purchase Order History</div>
              {data.purchaseOrders
                .filter((po) => po.supplierId === selectedSupplier.id)
                .map((po) => (
                  <div
                    key={po.id}
                    className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-mono font-semibold">{po.poNumber}</div>
                      <div className="text-slate-500">
                        {formatDateShort(po.orderDate)} · {po.status}
                      </div>
                    </div>
                    <span className="font-mono font-bold">
                      {formatCurrency(po.totalAmount, settings.defaultCurrency)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
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
                {editingSupplier ? `Edit Supplier · ${editingSupplier.code}` : 'Add Supplier'}
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
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C] font-mono"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block font-medium mb-1">Company Name *</label>
                  <input
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Contact Person *</label>
                  <input
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Payment Terms</label>
                  <input
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Business Email *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Phone</label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium mb-1">Location</label>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white font-medium"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
