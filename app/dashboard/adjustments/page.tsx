'use client';

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Download, Plus, SlidersHorizontal } from 'lucide-react';
import { useStockoraStore } from '@/stores/useStockoraStore';
import { getWarehouseOnHandFromLedger } from '@/lib/inventory-engine';
import { downloadCsvFile } from '@/lib/export';
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import { AdjustmentReason } from '@/types/erp';

const REASONS: AdjustmentReason[] = [
  'Stock Count Correction',
  'Damaged',
  'Lost',
  'Found',
  'Expired',
  'Other',
];

export default function StockAdjustmentsPage() {
  const { data, settings, recordAdjustment } = useStockoraStore();

  const [warehouseId, setWarehouseId] = useState(data.warehouses[0]?.id ?? 'wh-01');
  const [productId, setProductId] = useState(data.products[0]?.id ?? 'prd-001');
  const [adjustmentType, setAdjustmentType] = useState<'POSITIVE' | 'NEGATIVE'>('NEGATIVE');
  const [quantity, setQuantity] = useState('2');
  const [reason, setReason] = useState<AdjustmentReason>('Damaged');
  const [notes, setNotes] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const currentOnHand = useMemo(
    () => getWarehouseOnHandFromLedger(data.stockMovements, productId, warehouseId),
    [data.stockMovements, productId, warehouseId]
  );

  const previewAfter =
    adjustmentType === 'POSITIVE'
      ? currentOnHand + Number(quantity || 0)
      : currentOnHand - Number(quantity || 0);

  const warehouseMap = useMemo(
    () => new Map(data.warehouses.map((w) => [w.id, w])),
    [data.warehouses]
  );

  const handlePostAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmed) {
      toast.error('Please check the confirmation box before posting the stock adjustment.');
      return;
    }
    const res = recordAdjustment({
      warehouseId,
      productId,
      adjustmentType,
      quantity: Number(quantity),
      reason,
      notes,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success('Inventory adjustment posted to the immutable movement ledger.');
    setNotes('');
    setConfirmed(false);
  };

  const handleExportCsv = () => {
    downloadCsvFile(
      `stockora-adjustments-${new Date().toISOString().slice(0, 10)}.csv`,
      data.stockAdjustments.map((a) => ({
        AdjustmentNumber: a.adjustmentNumber,
        Date: a.createdAt,
        Warehouse: warehouseMap.get(a.warehouseId)?.code ?? a.warehouseId,
        SKU: a.sku,
        Product: a.productName,
        Type: a.adjustmentType,
        Quantity: a.quantity,
        Before: a.beforeQuantity,
        After: a.afterQuantity,
        Reason: a.reason,
        Notes: a.notes,
        Actor: a.actor,
      })),
      [
        { key: 'AdjustmentNumber', header: 'Adjustment #' },
        { key: 'Date', header: 'Timestamp' },
        { key: 'Warehouse', header: 'Warehouse' },
        { key: 'SKU', header: 'SKU' },
        { key: 'Product', header: 'Product' },
        { key: 'Type', header: 'Type' },
        { key: 'Quantity', header: 'Qty' },
        { key: 'Before', header: 'Before Qty' },
        { key: 'After', header: 'After Qty' },
        { key: 'Reason', header: 'Reason' },
        { key: 'Notes', header: 'Notes' },
        { key: 'Actor', header: 'Actor' },
      ]
    );
    toast.success('Exported stock adjustments history to CSV.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Inventory Adjustments
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Record cycle count corrections, damaged goods, and shrinkage with negative-stock protection
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] text-xs font-medium"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Adjustments CSV</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Create Adjustment Workspace */}
        <form
          onSubmit={handlePostAdjustment}
          className="lg:col-span-5 p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] space-y-4 text-xs h-fit"
        >
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <SlidersHorizontal className="w-4 h-4 text-[#2563EB]" />
            <h2 className="text-sm font-semibold">Create Stock Adjustment</h2>
          </div>

          <div>
            <label className="block font-medium mb-1">Select Warehouse *</label>
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
            <label className="block font-medium mb-1">Select Product SKU *</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">Adjustment Direction</label>
              <select
                value={adjustmentType}
                onChange={(e) => setAdjustmentType(e.target.value as 'POSITIVE' | 'NEGATIVE')}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
              >
                <option value="POSITIVE">Positive (+ Add Stock)</option>
                <option value="NEGATIVE">Negative (- Deduct Stock)</option>
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Adjustment Quantity *</label>
              <input
                type="number"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C] font-mono tabular-nums"
              />
            </div>
          </div>

          {/* Live Balance Preview Card */}
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-[#111B2C] border border-slate-200 dark:border-slate-700 grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-[11px] text-slate-500">Current Qty</div>
              <div className="text-base font-bold font-mono tabular-nums mt-0.5">
                {currentOnHand}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">Delta</div>
              <div
                className={`text-base font-bold font-mono tabular-nums mt-0.5 ${
                  adjustmentType === 'POSITIVE' ? 'text-[#059669]' : 'text-[#DC2626]'
                }`}
              >
                {adjustmentType === 'POSITIVE' ? `+${quantity || 0}` : `-${quantity || 0}`}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">New Balance</div>
              <div
                className={`text-base font-bold font-mono tabular-nums mt-0.5 ${
                  previewAfter < 0 ? 'text-rose-600' : 'text-[#2563EB] dark:text-[#60A5FA]'
                }`}
              >
                {previewAfter}
              </div>
            </div>
          </div>

          <div>
            <label className="block font-medium mb-1">Adjustment Reason *</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as AdjustmentReason)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
            >
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium mb-1">Audit Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Document cycle count batch ID, inspection ticket, or damage report..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
            />
          </div>

          <label className="flex items-start gap-2 cursor-pointer p-2.5 rounded-lg bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-[11px] text-slate-700 dark:text-slate-200">
              I confirm this inventory adjustment is accurate and understand it will be permanently recorded in the movement ledger.
            </span>
          </label>

          <button
            type="submit"
            disabled={!confirmed || (!settings.allowNegativeStock && previewAfter < 0)}
            className="w-full py-2.5 px-4 rounded-lg bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 text-white font-medium flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Confirm & Post Adjustment</span>
          </button>
        </form>

        {/* Right: Adjustment History Table */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Posted Adjustment History</h2>
            <span className="text-xs text-slate-500">
              {data.stockAdjustments.length} adjustments recorded
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-[#111B2C]/60 text-slate-500">
                  <th className="py-3 px-4">Adjustment #</th>
                  <th className="py-3 px-3">SKU & Product</th>
                  <th className="py-3 px-3">Warehouse</th>
                  <th className="py-3 px-3 text-right">Delta</th>
                  <th className="py-3 px-3 text-right">Before → After</th>
                  <th className="py-3 px-3">Reason & Notes</th>
                  <th className="py-3 px-4">Actor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.stockAdjustments.map((adj) => {
                  const wh = warehouseMap.get(adj.warehouseId);
                  return (
                    <tr key={adj.id} className="hover:bg-slate-50 dark:hover:bg-[#1F3047]/50">
                      <td className="py-2.5 px-4 font-mono font-semibold text-[#2563EB] dark:text-[#60A5FA]">
                        {adj.adjustmentNumber}
                        <div className="text-[11px] font-normal text-slate-400">
                          {formatDateTime(adj.createdAt)}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-mono font-semibold">{adj.sku}</div>
                        <div className="text-slate-500 truncate max-w-[160px]">
                          {adj.productName}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono">{wh?.code ?? adj.warehouseId}</td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono tabular-nums font-bold ${
                          adj.adjustmentType === 'POSITIVE' ? 'text-[#059669]' : 'text-[#DC2626]'
                        }`}
                      >
                        {adj.adjustmentType === 'POSITIVE' ? `+${adj.quantity}` : `-${adj.quantity}`}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {adj.beforeQuantity} → {adj.afterQuantity}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium">{adj.reason}</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[180px]">
                          {adj.notes}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-slate-500">{adj.actor}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
