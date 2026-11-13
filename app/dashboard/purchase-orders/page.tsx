'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Copy,
  FileDown,
  FileText,
  Plus,
  Printer,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useStockoraStore } from '@/stores/useStockoraStore';
import { calculatePurchaseOrderTotals } from '@/lib/calculations';
import { downloadPurchaseOrderPdf } from '@/lib/pdf';
import { formatCurrency, formatDateShort } from '@/lib/formatters';
import { PurchaseOrder, PurchaseOrderStatus } from '@/types/erp';

export default function PurchaseOrdersPage() {
  const { data, settings, createPO, updatePOStatus, duplicatePO } = useStockoraStore();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | PurchaseOrderStatus>('ALL');
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Multi-line PO Builder State
  const [supplierId, setSupplierId] = useState(data.suppliers[0]?.id ?? 'sup-01');
  const [warehouseId, setWarehouseId] = useState(data.warehouses[0]?.id ?? 'wh-01');
  const [expectedDays, setExpectedDays] = useState('7');
  const [shippingCharges, setShippingCharges] = useState('95.00');
  const [poStatus, setPoStatus] = useState<'DRAFT' | 'ORDERED'>('ORDERED');
  const [notes, setNotes] = useState('Standard vendor replenishment order');
  const [lines, setLines] = useState<
    Array<{
      productId: string;
      quantityOrdered: number;
      unitCost: number;
      discountAmount: number;
      taxRate: number;
    }>
  >([
    {
      productId: data.products[0]?.id ?? 'prd-001',
      quantityOrdered: 25,
      unitCost: data.products[0]?.purchaseCost ?? 100,
      discountAmount: 0,
      taxRate: settings.defaultTaxRate,
    },
  ]);

  const supplierMap = useMemo(
    () => new Map(data.suppliers.map((s) => [s.id, s])),
    [data.suppliers]
  );
  const warehouseMap = useMemo(
    () => new Map(data.warehouses.map((w) => [w.id, w])),
    [data.warehouses]
  );

  const filteredPOs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.purchaseOrders
      .filter((po) => statusFilter === 'ALL' || po.status === statusFilter)
      .filter((po) => {
        if (!q) return true;
        const supName = supplierMap.get(po.supplierId)?.companyName.toLowerCase() ?? '';
        return (
          po.poNumber.toLowerCase().includes(q) ||
          supName.includes(q) ||
          po.lines.some((l) => l.sku.toLowerCase().includes(q))
        );
      });
  }, [data.purchaseOrders, statusFilter, search, supplierMap]);

  const draftTotals = useMemo(
    () => calculatePurchaseOrderTotals(lines, Number(shippingCharges || 0)),
    [lines, shippingCharges]
  );

  const handleAddLine = () => {
    const nextProd = data.products[lines.length % data.products.length];
    setLines([
      ...lines,
      {
        productId: nextProd.id,
        quantityOrdered: 10,
        unitCost: nextProd.purchaseCost,
        discountAmount: 0,
        taxRate: settings.defaultTaxRate,
      },
    ]);
  };

  const handleCreatePO = (e: React.FormEvent) => {
    e.preventDefault();
    const res = createPO({
      supplierId,
      warehouseId,
      orderDate: new Date().toISOString(),
      expectedDeliveryDate: new Date(
        Date.now() + Number(expectedDays || 7) * 86400000
      ).toISOString(),
      status: poStatus,
      shippingCharges: Number(shippingCharges || 0),
      notes,
      lines,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      `Purchase Order created (${poStatus}). Stock will increase only when Goods Receiving is posted.`
    );
    setCreateOpen(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Purchase Order Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Decimal-accurate procurement orders, line-level discounts & taxes, and fulfillment tracking
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/receiving"
            className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] text-xs font-medium"
          >
            Go to Goods Receiving →
          </Link>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Purchase Order</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search PO number, supplier name, or SKU..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#111B2C] text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#111B2C] text-xs">
          {(
            ['ALL', 'DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'] as const
          ).map((st) => (
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
              {st === 'ALL' ? 'All' : st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* PO Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-[#111B2C]/60 text-slate-500">
                <th className="py-3 px-4">PO Number</th>
                <th className="py-3 px-3">Supplier</th>
                <th className="py-3 px-3">Destination Hub</th>
                <th className="py-3 px-3">Order / Expected</th>
                <th className="py-3 px-3 text-right">Ordered Qty</th>
                <th className="py-3 px-3 text-right">Received / Outstanding</th>
                <th className="py-3 px-3 text-right">Total Amount</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredPOs.map((po) => {
                const sup = supplierMap.get(po.supplierId);
                const wh = warehouseMap.get(po.warehouseId);
                const orderedQty = po.lines.reduce((s, l) => s + l.quantityOrdered, 0);
                const receivedQty = po.lines.reduce((s, l) => s + l.quantityReceived, 0);
                const outstandingQty = Math.max(0, orderedQty - receivedQty);

                return (
                  <tr key={po.id} className="hover:bg-slate-50 dark:hover:bg-[#1F3047]/50">
                    <td className="py-3 px-4 font-mono font-bold text-[#2563EB] dark:text-[#60A5FA]">
                      <button
                        type="button"
                        onClick={() => setSelectedPO(po)}
                        className="hover:underline"
                      >
                        {po.poNumber}
                      </button>
                    </td>
                    <td className="py-3 px-3 font-medium">
                      {sup?.companyName ?? po.supplierId}
                      <div className="text-[11px] text-slate-500">{sup?.code}</div>
                    </td>
                    <td className="py-3 px-3 font-mono">{wh?.code ?? po.warehouseId}</td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div>{formatDateShort(po.orderDate)}</div>
                      <div className="text-[11px] text-slate-400">
                        Due {formatDateShort(po.expectedDeliveryDate)}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold">
                      {orderedQty}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      <span className="text-[#059669] font-semibold">{receivedQty}</span>
                      <span className="text-slate-400 mx-1">/</span>
                      <span className="text-amber-600">{outstandingQty}</span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-bold">
                      {formatCurrency(po.totalAmount, settings.defaultCurrency)}
                    </td>
                    <td className="py-3 px-3 font-medium">
                      {po.status.replace('_', ' ')}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {po.status === 'DRAFT' && (
                          <button
                            type="button"
                            onClick={() => {
                              updatePOStatus(po.id, 'ORDERED');
                              toast.success(`${po.poNumber} marked as ORDERED.`);
                            }}
                            className="px-2 py-1 rounded bg-[#2563EB] text-white text-[11px] font-medium"
                          >
                            Issue PO
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedPO(po)}
                          className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-[11px] font-medium"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            downloadPurchaseOrderPdf(
                              po,
                              sup,
                              wh,
                              settings.businessName
                            )
                          }
                          className="p-1 rounded border border-slate-200 dark:border-slate-700"
                          title="Download PO PDF"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            duplicatePO(po.id);
                            toast.success(`Duplicated ${po.poNumber} as a new Draft PO.`);
                          }}
                          className="p-1 rounded border border-slate-200 dark:border-slate-700"
                          title="Duplicate PO"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Multi-Line PO Modal */}
      {createOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
          onClick={() => setCreateOpen(false)}
        >
          <div
            className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-base font-semibold">Create Purchase Order</h2>
              <button onClick={() => setCreateOpen(false)} className="p-1 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreatePO} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-medium mb-1">Supplier *</label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                  >
                    {data.suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.companyName} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Receiving Warehouse *</label>
                  <select
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                  >
                    {data.warehouses
                      .filter((w) => w.status === 'ACTIVE')
                      .map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.code} · {w.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Initial Status</label>
                  <select
                    value={poStatus}
                    onChange={(e) => setPoStatus(e.target.value as 'DRAFT' | 'ORDERED')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                  >
                    <option value="ORDERED">Ordered (Ready to Receive)</option>
                    <option value="DRAFT">Draft</option>
                  </select>
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Purchase Order Line Items</span>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="text-[#2563EB] dark:text-[#60A5FA] font-medium hover:underline"
                  >
                    + Add Line Item
                  </button>
                </div>

                {lines.map((line, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-2 items-center bg-slate-50 dark:bg-[#111B2C] p-2.5 rounded-lg"
                  >
                    <div className="col-span-5">
                      <label className="block text-[10px] text-slate-400">Product SKU</label>
                      <select
                        value={line.productId}
                        onChange={(e) => {
                          const p = data.products.find((pr) => pr.id === e.target.value);
                          setLines((prev) =>
                            prev.map((item, i) =>
                              i === idx
                                ? {
                                    ...item,
                                    productId: e.target.value,
                                    unitCost: p?.purchaseCost ?? item.unitCost,
                                  }
                                : item
                            )
                          );
                        }}
                        className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337]"
                      >
                        {data.products
                          .filter((p) => p.status === 'ACTIVE')
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.sku} — {p.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] text-slate-400">Qty</label>
                      <input
                        type="number"
                        min="1"
                        value={line.quantityOrdered}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, quantityOrdered: Number(e.target.value) } : item
                            )
                          )
                        }
                        className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] font-mono"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] text-slate-400">Unit Cost ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.unitCost}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, unitCost: Number(e.target.value) } : item
                            )
                          )
                        }
                        className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] font-mono"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] text-slate-400">Discount ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.discountAmount}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((item, i) =>
                              i === idx
                                ? { ...item, discountAmount: Number(e.target.value) }
                                : item
                            )
                          )
                        }
                        className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] font-mono"
                      />
                    </div>
                    <div className="col-span-1 flex justify-end pt-4">
                      {lines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-rose-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium mb-1">Lead Time (Days)</label>
                  <input
                    type="number"
                    min="1"
                    value={expectedDays}
                    onChange={(e) => setExpectedDays(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C] font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Shipping / Freight ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={shippingCharges}
                    onChange={(e) => setShippingCharges(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C] font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Notes</label>
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                  />
                </div>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 dark:bg-[#111B2C] border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4">
                <div className="space-x-4 font-mono">
                  <span>Subtotal: {formatCurrency(draftTotals.subtotal)}</span>
                  <span>Discount: -{formatCurrency(draftTotals.discountTotal)}</span>
                  <span>Tax: {formatCurrency(draftTotals.taxTotal)}</span>
                  <span>Shipping: {formatCurrency(draftTotals.shippingCharges)}</span>
                </div>
                <div className="text-sm font-bold font-mono text-[#2563EB] dark:text-[#60A5FA]">
                  PO Total: {formatCurrency(draftTotals.totalAmount, settings.defaultCurrency)}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white font-medium"
                >
                  Save Purchase Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PO Detail View Modal */}
      {selectedPO && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
          onClick={() => setSelectedPO(null)}
        >
          <div
            className="w-full max-w-2xl rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#2563EB]" />
                <h2 className="text-sm font-semibold">
                  Purchase Order · {selectedPO.poNumber} ({selectedPO.status})
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 text-xs inline-flex items-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>
                <button
                  type="button"
                  onClick={() =>
                    downloadPurchaseOrderPdf(
                      selectedPO,
                      supplierMap.get(selectedPO.supplierId),
                      warehouseMap.get(selectedPO.warehouseId),
                      settings.businessName
                    )
                  }
                  className="px-2.5 py-1 rounded bg-[#2563EB] text-white text-xs inline-flex items-center gap-1"
                >
                  <FileDown className="w-3.5 h-3.5" /> PDF
                </button>
                <button onClick={() => setSelectedPO(null)} className="p-1 text-slate-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-slate-400">Supplier</div>
                  <div className="font-semibold text-sm">
                    {supplierMap.get(selectedPO.supplierId)?.companyName}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Destination Warehouse</div>
                  <div className="font-semibold text-sm">
                    {warehouseMap.get(selectedPO.warehouseId)?.name}
                  </div>
                </div>
              </div>

              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                    <th className="py-2">SKU</th>
                    <th className="py-2">Product</th>
                    <th className="py-2 text-right">Ordered</th>
                    <th className="py-2 text-right">Received</th>
                    <th className="py-2 text-right">Unit Cost</th>
                    <th className="py-2 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {selectedPO.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="py-2 font-mono font-semibold">{l.sku}</td>
                      <td className="py-2">{l.productName}</td>
                      <td className="py-2 text-right font-mono">{l.quantityOrdered}</td>
                      <td className="py-2 text-right font-mono text-[#059669]">
                        {l.quantityReceived}
                      </td>
                      <td className="py-2 text-right font-mono">
                        {formatCurrency(l.unitCost)}
                      </td>
                      <td className="py-2 text-right font-mono font-semibold">
                        {formatCurrency(l.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700">
                <div>
                  {(selectedPO.status === 'DRAFT' || selectedPO.status === 'ORDERED') && (
                    <button
                      type="button"
                      onClick={() => {
                        const res = updatePOStatus(selectedPO.id, 'CANCELLED');
                        if (!res.ok) toast.error(res.error);
                        else {
                          toast.success(`${selectedPO.poNumber} cancelled.`);
                          setSelectedPO(null);
                        }
                      }}
                      className="text-rose-600 font-medium hover:underline"
                    >
                      Cancel Purchase Order
                    </button>
                  )}
                </div>
                <div className="text-right font-mono space-y-0.5">
                  <div>Subtotal: {formatCurrency(selectedPO.subtotal)}</div>
                  <div>Tax: {formatCurrency(selectedPO.taxTotal)}</div>
                  <div className="text-sm font-bold text-[#2563EB] dark:text-[#60A5FA]">
                    Total: {formatCurrency(selectedPO.totalAmount)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
