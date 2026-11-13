'use client';

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  ArrowLeftRight,
  ArrowRight,
  CheckCircle2,
  Clock,
  Plus,
  Send,
  Truck,
  X,
  XCircle,
} from 'lucide-react';
import { useStockoraStore } from '@/stores/useStockoraStore';
import {
  getReservedQuantity,
  getWarehouseOnHandFromLedger,
} from '@/lib/inventory-engine';
import { formatCurrency, formatDateTime, formatQuantity } from '@/lib/formatters';
import { StockTransfer, TransferStatus } from '@/types/erp';

export default function StockTransfersPage() {
  const {
    data,
    settings,
    createTransfer,
    dispatchTransfer,
    receiveTransfer,
    cancelTransfer,
  } = useStockoraStore();

  const [statusFilter, setStatusFilter] = useState<'ALL' | TransferStatus>('ALL');
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Create Transfer Form State
  const [createOpen, setCreateOpen] = useState(false);
  const [sourceWhId, setSourceWhId] = useState(data.warehouses[0]?.id ?? 'wh-01');
  const [destWhId, setDestWhId] = useState(data.warehouses[1]?.id ?? 'wh-02');
  const [productId, setProductId] = useState(data.products[0]?.id ?? 'prd-001');
  const [quantity, setQuantity] = useState('10');
  const [referenceNotes, setReferenceNotes] = useState('Regional stock rebalancing');
  const [dispatchImmediately, setDispatchImmediately] = useState(false);

  const warehouseMap = useMemo(
    () => new Map(data.warehouses.map((w) => [w.id, w])),
    [data.warehouses]
  );

  const sourceAvailableForForm = useMemo(() => {
    const onHand = getWarehouseOnHandFromLedger(data.stockMovements, productId, sourceWhId);
    const reserved = getReservedQuantity(data.reservations, productId, sourceWhId);
    return Math.max(0, onHand - reserved);
  }, [data.stockMovements, data.reservations, productId, sourceWhId]);

  const filteredTransfers = useMemo(() => {
    return data.stockTransfers.filter(
      (t) => statusFilter === 'ALL' || t.status === statusFilter
    );
  }, [data.stockTransfers, statusFilter]);

  const inTransitSummary = useMemo(() => {
    const active = data.stockTransfers.filter((t) => t.status === 'IN_TRANSIT');
    let units = 0;
    let value = 0;
    for (const t of active) {
      for (const l of t.lines) {
        units += l.quantity;
        value += l.quantity * l.unitCostSnapshot;
      }
    }
    return { shipments: active.length, units, value };
  }, [data.stockTransfers]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = createTransfer({
      sourceWarehouseId: sourceWhId,
      destinationWarehouseId: destWhId,
      lines: [{ productId, quantity: Number(quantity) }],
      referenceNotes,
      dispatchImmediately,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      dispatchImmediately
        ? 'Transfer created and dispatched into transit.'
        : 'Draft transfer created. Ready for dispatch.'
    );
    setCreateOpen(false);
  };

  const handleDispatch = (transferId: string) => {
    const res = dispatchTransfer(transferId);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success('Transfer dispatched. Source stock reduced and in-transit balance updated.');
  };

  const handleReceive = (transferId: string) => {
    const res = receiveTransfer(transferId);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success('Transfer received at destination warehouse and marked Completed.');
  };

  const handleCancel = (transfer: StockTransfer) => {
    const reason =
      transfer.status === 'IN_TRANSIT'
        ? cancelReason || 'Returned to source warehouse due to route cancellation'
        : 'Draft cancelled prior to dispatch';
    const res = cancelTransfer(transfer.id, reason);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      transfer.status === 'IN_TRANSIT'
        ? 'In-transit transfer cancelled and stock returned to source warehouse via REVERSAL.'
        : 'Draft transfer cancelled without stock impact.'
    );
    setSelectedTransfer(null);
    setCancelReason('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Inter-Warehouse Stock Transfers
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Create, dispatch, track in-transit inventory, and receive stock across distribution facilities
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-medium"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Stock Transfer</span>
        </button>
      </div>

      {/* In-Transit Accounting Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337]">
          <div className="text-xs text-slate-500">Active In-Transit Shipments</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-[#2563EB] dark:text-[#60A5FA]">
            {inTransitSummary.shipments} Transfers
          </div>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337]">
          <div className="text-xs text-slate-500">Units Currently In Transit</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums">
            {formatQuantity(inTransitSummary.units)} units
          </div>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337]">
          <div className="text-xs text-slate-500">In-Transit Capital Valuation</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-[#059669] dark:text-emerald-400">
            {formatCurrency(inTransitSummary.value, settings.defaultCurrency)}
          </div>
        </div>
      </div>

      {/* Status Segmented Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] w-fit text-xs">
        {(['ALL', 'DRAFT', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED'] as const).map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              statusFilter === st
                ? 'bg-[#2563EB] text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1F3047]'
            }`}
          >
            {st === 'ALL' ? 'All Transfers' : st.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Transfers Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-[#111B2C]/60 text-slate-500">
                <th className="py-3 px-4">Transfer #</th>
                <th className="py-3 px-3">Source → Destination</th>
                <th className="py-3 px-3">Product / SKU</th>
                <th className="py-3 px-3 text-right">Quantity</th>
                <th className="py-3 px-3 text-right">Transfer Value</th>
                <th className="py-3 px-3">Status & Timeline</th>
                <th className="py-3 px-4 text-right">Workflow Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredTransfers.map((trf) => {
                const src = warehouseMap.get(trf.sourceWarehouseId);
                const dst = warehouseMap.get(trf.destinationWarehouseId);
                const firstLine = trf.lines[0];
                const totalQty = trf.lines.reduce((s, l) => s + l.quantity, 0);
                const totalVal = trf.lines.reduce(
                  (s, l) => s + l.quantity * l.unitCostSnapshot,
                  0
                );

                return (
                  <tr key={trf.id} className="hover:bg-slate-50 dark:hover:bg-[#1F3047]/50">
                    <td className="py-3 px-4 font-mono font-bold text-[#2563EB] dark:text-[#60A5FA]">
                      {trf.transferNumber}
                      <div className="text-[11px] font-normal text-slate-400">
                        {formatDateTime(trf.transferDate)}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5 font-medium">
                        <span className="font-mono">{src?.code}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-mono text-[#2563EB] dark:text-[#60A5FA]">
                          {dst?.code}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {src?.name} → {dst?.name}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-mono font-semibold">{firstLine?.sku}</div>
                      <div className="text-slate-500 truncate max-w-[200px]">
                        {firstLine?.productName}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-bold">
                      {totalQty}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      {formatCurrency(totalVal, settings.defaultCurrency)}
                    </td>
                    <td className="py-3 px-3">
                      {trf.status === 'DRAFT' && (
                        <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 font-medium">
                          <Clock className="w-3.5 h-3.5" /> Draft (Awaiting Dispatch)
                        </span>
                      )}
                      {trf.status === 'IN_TRANSIT' && (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
                          <Truck className="w-3.5 h-3.5" /> In Transit
                        </span>
                      )}
                      {trf.status === 'COMPLETED' && (
                        <span className="inline-flex items-center gap-1 text-[#059669] dark:text-emerald-400 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                        </span>
                      )}
                      {trf.status === 'CANCELLED' && (
                        <span className="inline-flex items-center gap-1 text-rose-600 font-medium">
                          <XCircle className="w-3.5 h-3.5" /> Cancelled
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {trf.status === 'DRAFT' && (
                          <button
                            type="button"
                            onClick={() => handleDispatch(trf.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#2563EB] hover:bg-blue-700 text-white font-medium text-[11px]"
                          >
                            <Send className="w-3 h-3" />
                            <span>Dispatch</span>
                          </button>
                        )}
                        {trf.status === 'IN_TRANSIT' && (
                          <button
                            type="button"
                            onClick={() => handleReceive(trf.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#059669] hover:bg-emerald-700 text-white font-medium text-[11px]"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Receive at {dst?.code}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedTransfer(trf)}
                          className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-[#1F3047] text-[11px] font-medium"
                        >
                          Timeline
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

      {/* Create Transfer Modal */}
      {createOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
          onClick={() => setCreateOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-sm font-semibold">Create Inter-Warehouse Stock Transfer</h2>
              <button onClick={() => setCreateOpen(false)} className="p-1 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">1. Source Warehouse *</label>
                  <select
                    value={sourceWhId}
                    onChange={(e) => setSourceWhId(e.target.value)}
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
                  <label className="block font-medium mb-1">2. Destination Warehouse *</label>
                  <select
                    value={destWhId}
                    onChange={(e) => setDestWhId(e.target.value)}
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

              <div>
                <label className="block font-medium mb-1">3. Select Product SKU *</label>
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

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#111B2C] border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <span>Available Stock at Source Warehouse:</span>
                <strong className="font-mono tabular-nums text-sm text-[#2563EB] dark:text-[#60A5FA]">
                  {sourceAvailableForForm} units
                </strong>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">4. Quantity to Transfer *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C] font-mono tabular-nums"
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dispatchImmediately}
                      onChange={(e) => setDispatchImmediately(e.target.checked)}
                    />
                    <span>Dispatch immediately into transit</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1">Reference Notes</label>
                <input
                  value={referenceNotes}
                  onChange={(e) => setReferenceNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white font-medium"
                >
                  {dispatchImmediately ? 'Create & Dispatch Transfer' : 'Create Draft Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Timeline & Resolution Modal */}
      {selectedTransfer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
          onClick={() => setSelectedTransfer(null)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-[#2563EB]" />
                <h2 className="text-sm font-semibold">
                  Transfer Timeline · {selectedTransfer.transferNumber}
                </h2>
              </div>
              <button onClick={() => setSelectedTransfer(null)} className="p-1 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-[#111B2C]">
                  <span>1. Created ({selectedTransfer.createdBy})</span>
                  <span className="font-mono">{formatDateTime(selectedTransfer.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-[#111B2C]">
                  <span>2. Dispatched from Source (TRANSFER_OUT)</span>
                  <span className="font-mono">
                    {selectedTransfer.dispatchedAt
                      ? formatDateTime(selectedTransfer.dispatchedAt)
                      : 'Pending Dispatch'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-[#111B2C]">
                  <span>3. Received at Destination (TRANSFER_IN)</span>
                  <span className="font-mono">
                    {selectedTransfer.receivedAt
                      ? formatDateTime(selectedTransfer.receivedAt)
                      : selectedTransfer.status === 'CANCELLED'
                        ? 'Cancelled / Returned'
                        : 'Pending Receipt'}
                  </span>
                </div>
              </div>

              {(selectedTransfer.status === 'DRAFT' ||
                selectedTransfer.status === 'IN_TRANSIT') && (
                <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2.5">
                  <div className="font-semibold text-rose-600">
                    Cancel or Return Resolution Workflow
                  </div>
                  {selectedTransfer.status === 'IN_TRANSIT' && (
                    <input
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="Enter return resolution reason (returns stock to source warehouse)..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                    />
                  )}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleCancel(selectedTransfer)}
                      className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium"
                    >
                      {selectedTransfer.status === 'IN_TRANSIT'
                        ? 'Cancel & Return In-Transit Stock to Source'
                        : 'Cancel Draft Transfer'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
