'use client';

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  CheckCircle2,
  ClipboardCheck,
  FileDown,
  Printer,
  ShieldAlert,
} from 'lucide-react';
import { useStockoraStore } from '@/stores/useStockoraStore';
import { getWarehouseOnHandFromLedger } from '@/lib/inventory-engine';
import { downloadGoodsReceiptPdf } from '@/lib/pdf';
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import { GoodsReceipt } from '@/types/erp';

export default function GoodsReceivingWorkspacePage() {
  const { data, settings, receiveGoodsAgainstPO } = useStockoraStore();

  const receivablePOs = useMemo(
    () =>
      data.purchaseOrders.filter(
        (po) => po.status === 'ORDERED' || po.status === 'PARTIALLY_RECEIVED'
      ),
    [data.purchaseOrders]
  );

  const [selectedPoId, setSelectedPoId] = useState(receivablePOs[0]?.id ?? '');
  const selectedPO = useMemo(
    () => receivablePOs.find((p) => p.id === selectedPoId) ?? receivablePOs[0],
    [receivablePOs, selectedPoId]
  );

  const [warehouseId, setWarehouseId] = useState(
    selectedPO?.warehouseId ?? data.warehouses[0]?.id ?? 'wh-01'
  );
  const [notes, setNotes] = useState('Dock inspection verified; accepted units placed into bin locations.');
  const [lineInputs, setLineInputs] = useState<
    Record<string, { accepted: number; rejected: number; rejectionReason: string }>
  >({});

  const [previewGRN, setPreviewGRN] = useState<GoodsReceipt | null>(
    data.goodsReceipts[0] ?? null
  );

  const warehouseMap = useMemo(
    () => new Map(data.warehouses.map((w) => [w.id, w])),
    [data.warehouses]
  );

  const getLineEntry = (poLineId: string, defaultOutstanding: number) => {
    return (
      lineInputs[poLineId] ?? {
        accepted: defaultOutstanding,
        rejected: 0,
        rejectionReason: '',
      }
    );
  };

  const handleConfirmReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPO) {
      toast.error('Please select an open Purchase Order to receive.');
      return;
    }

    const linesPayload = selectedPO.lines.map((l) => {
      const outstanding = Math.max(0, l.quantityOrdered - l.quantityReceived);
      const entry = getLineEntry(l.id, outstanding);
      return {
        poLineId: l.id,
        acceptedQuantity: Number(entry.accepted),
        rejectedQuantity: Number(entry.rejected),
        rejectionReason: entry.rejectionReason || undefined,
      };
    });

    const res = receiveGoodsAgainstPO({
      poId: selectedPO.id,
      warehouseId: warehouseId || selectedPO.warehouseId,
      notes,
      lines: linesPayload,
    });

    if (!res.ok) {
      toast.error(res.error);
      return;
    }

    toast.success(
      `Goods Receipt posted for ${selectedPO.poNumber}. Accepted quantities added to warehouse stock.`
    );
    setLineInputs({});
    if (res.data?.goodsReceipts[0]) {
      setPreviewGRN(res.data.goodsReceipts[0]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Goods Receiving Workspace (GRN)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Inspect inbound PO deliveries, separate accepted vs rejected/damaged units, and post stock to warehouse balances
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Active Receiving Dock Form */}
        <form
          onSubmit={handleConfirmReceipt}
          className="lg:col-span-7 p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] space-y-4 text-xs"
        >
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <ClipboardCheck className="w-4 h-4 text-[#059669]" />
            <h2 className="text-sm font-semibold">
              1. Select Open Purchase Order & Receiving Warehouse
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium mb-1">
                Purchase Order (Ordered / Partially Received) *
              </label>
              <select
                value={selectedPO?.id ?? ''}
                onChange={(e) => {
                  setSelectedPoId(e.target.value);
                  const found = receivablePOs.find((p) => p.id === e.target.value);
                  if (found) setWarehouseId(found.warehouseId);
                  setLineInputs({});
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
              >
                {receivablePOs.map((po) => (
                  <option key={po.id} value={po.id}>
                    {po.poNumber} ({po.status}) — Total ${po.totalAmount.toFixed(2)}
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
          </div>

          {selectedPO ? (
            <div className="space-y-3 pt-2">
              <div className="font-semibold">
                2. Enter Accepted & Rejected Quantities (Preview Stock Impact)
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#111B2C] text-slate-500">
                      <th className="py-2.5 px-3">SKU / Product</th>
                      <th className="py-2.5 px-2 text-right">Ordered</th>
                      <th className="py-2.5 px-2 text-right">Outstanding</th>
                      <th className="py-2.5 px-2 text-right">Accepted Qty</th>
                      <th className="py-2.5 px-2 text-right">Rejected Qty</th>
                      <th className="py-2.5 px-3 text-right">Stock Impact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {selectedPO.lines.map((line) => {
                      const outstanding = Math.max(0, line.quantityOrdered - line.quantityReceived);
                      const entry = getLineEntry(line.id, outstanding);
                      const currentWhQty = getWarehouseOnHandFromLedger(
                        data.stockMovements,
                        line.productId,
                        warehouseId
                      );
                      return (
                        <tr key={line.id}>
                          <td className="py-2.5 px-3">
                            <div className="font-mono font-semibold text-[#2563EB] dark:text-[#60A5FA]">
                              {line.sku}
                            </div>
                            <div className="text-slate-500 truncate max-w-[150px]">
                              {line.productName}
                            </div>
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono tabular-nums">
                            {line.quantityOrdered}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono tabular-nums font-semibold text-amber-600">
                            {outstanding}
                          </td>
                          <td className="py-2.5 px-2 text-right">
                            <input
                              type="number"
                              min="0"
                              max={settings.allowOverReceipt ? undefined : outstanding}
                              value={entry.accepted}
                              onChange={(e) =>
                                setLineInputs((prev) => ({
                                  ...prev,
                                  [line.id]: {
                                    ...entry,
                                    accepted: Number(e.target.value),
                                  },
                                }))
                              }
                              className="w-16 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C] font-mono text-right"
                            />
                          </td>
                          <td className="py-2.5 px-2 text-right">
                            <input
                              type="number"
                              min="0"
                              value={entry.rejected}
                              onChange={(e) =>
                                setLineInputs((prev) => ({
                                  ...prev,
                                  [line.id]: {
                                    ...entry,
                                    rejected: Number(e.target.value),
                                  },
                                }))
                              }
                              className="w-16 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C] font-mono text-right"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                            {currentWhQty} →{' '}
                            <strong className="text-[#059669]">
                              {currentWhQty + Number(entry.accepted || 0)}
                            </strong>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="p-3 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900 flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Rejected or damaged quantities are documented on the Goods Receipt Note (GRN) for vendor claims and do <strong>not</strong> increase usable warehouse inventory.
                </span>
              </div>

              <div>
                <label className="block font-medium mb-1">Receiving & QA Inspection Notes</label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-lg bg-[#059669] hover:bg-emerald-700 text-white font-medium flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm Receipt, Post Stock & Generate GRN</span>
              </button>
            </div>
          ) : (
            <div className="py-8 text-center text-slate-500">
              All purchase orders have been received. Create a new PO to receive additional stock.
            </div>
          )}
        </form>

        {/* Right: Goods Receipt Note (GRN) Printable Preview & History */}
        <div className="lg:col-span-5 space-y-5">
          {previewGRN && (
            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] space-y-4 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
                <div>
                  <div className="text-[11px] font-mono text-[#059669] font-bold">
                    GOODS RECEIPT NOTE PREVIEW
                  </div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    {previewGRN.grnNumber} (PO: {previewGRN.poNumber})
                  </h2>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="p-1.5 rounded border border-slate-200 dark:border-slate-700"
                    title="Print GRN"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      downloadGoodsReceiptPdf(
                        previewGRN,
                        warehouseMap.get(previewGRN.warehouseId),
                        settings.businessName
                      )
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#2563EB] text-white font-medium"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>GRN PDF</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                <div>
                  Warehouse:{' '}
                  <strong className="text-slate-900 dark:text-white">
                    {warehouseMap.get(previewGRN.warehouseId)?.name}
                  </strong>
                </div>
                <div>
                  Received Date:{' '}
                  <strong className="text-slate-900 dark:text-white font-mono">
                    {formatDateTime(previewGRN.receivedDate)}
                  </strong>
                </div>
              </div>

              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                    <th className="py-1.5">SKU</th>
                    <th className="py-1.5 text-right">Accepted</th>
                    <th className="py-1.5 text-right">Rejected</th>
                    <th className="py-1.5 text-right">Unit Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {previewGRN.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="py-2 font-mono font-semibold">{l.sku}</td>
                      <td className="py-2 text-right font-mono text-[#059669] font-bold">
                        +{l.acceptedQuantity}
                      </td>
                      <td className="py-2 text-right font-mono text-rose-500">
                        {l.rejectedQuantity}
                      </td>
                      <td className="py-2 text-right font-mono">
                        {formatCurrency(l.unitCost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
                Notes: {previewGRN.notes}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-xs font-semibold">Recent Goods Receipt Notes</h3>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs max-h-64 overflow-y-auto">
              {data.goodsReceipts.map((grn) => (
                <button
                  key={grn.id}
                  type="button"
                  onClick={() => setPreviewGRN(grn)}
                  className="w-full p-3 text-left hover:bg-slate-50 dark:hover:bg-[#1F3047] flex items-center justify-between"
                >
                  <div>
                    <div className="font-mono font-semibold text-[#2563EB] dark:text-[#60A5FA]">
                      {grn.grnNumber} · {grn.poNumber}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {formatDateTime(grn.receivedDate)} · {grn.receivedBy}
                    </div>
                  </div>
                  <span className="font-mono font-bold text-[#059669]">
                    +{grn.lines.reduce((s, l) => s + l.acceptedQuantity, 0)} u
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
