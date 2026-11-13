'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Download, Eye, RotateCcw, Search, ShieldCheck, X } from 'lucide-react';
import { useStockoraStore } from '@/stores/useStockoraStore';
import { downloadCsvFile } from '@/lib/export';
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import { MovementType, StockMovement } from '@/types/erp';

const MOVEMENT_TYPES: MovementType[] = [
  'OPENING_BALANCE',
  'PURCHASE_RECEIPT',
  'TRANSFER_OUT',
  'TRANSFER_IN',
  'POSITIVE_ADJUSTMENT',
  'NEGATIVE_ADJUSTMENT',
  'RESERVATION',
  'RESERVATION_RELEASE',
  'REVERSAL',
];

export default function StockMovementsLedgerPage() {
  const { data, settings, selectedWarehouseId, setSelectedWarehouseId, reverseMovement } =
    useStockoraStore();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | MovementType>('ALL');
  const [productFilter, setProductFilter] = useState('ALL');
  const [dateRange, setDateRange] = useState<'ALL' | '30d' | '90d' | '365d'>('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [inspectedMovement, setInspectedMovement] = useState<StockMovement | null>(null);
  const [reversalReason, setReversalReason] = useState('');

  const warehouseMap = useMemo(
    () => new Map(data.warehouses.map((w) => [w.id, w])),
    [data.warehouses]
  );

  const filteredMovements = useMemo(() => {
    const q = search.trim().toLowerCase();
    const nowMs = new Date('2026-11-13T23:59:59.000Z').getTime();
    const cutoffMs =
      dateRange === '30d'
        ? nowMs - 30 * 86400000
        : dateRange === '90d'
          ? nowMs - 90 * 86400000
          : dateRange === '365d'
            ? nowMs - 365 * 86400000
            : 0;

    return data.stockMovements
      .filter((m) => selectedWarehouseId === 'ALL' || m.warehouseId === selectedWarehouseId)
      .filter((m) => typeFilter === 'ALL' || m.movementType === typeFilter)
      .filter((m) => productFilter === 'ALL' || m.productId === productFilter)
      .filter((m) => !cutoffMs || new Date(m.timestamp).getTime() >= cutoffMs)
      .filter(
        (m) =>
          !q ||
          m.id.toLowerCase().includes(q) ||
          m.sku.toLowerCase().includes(q) ||
          m.productName.toLowerCase().includes(q) ||
          m.sourceReference.toLowerCase().includes(q) ||
          m.reason.toLowerCase().includes(q) ||
          m.actor.toLowerCase().includes(q)
      );
  }, [data.stockMovements, selectedWarehouseId, typeFilter, productFilter, dateRange, search]);

  const totalPages = Math.max(1, Math.ceil(filteredMovements.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedMovements = filteredMovements.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  const handleExportCsv = () => {
    downloadCsvFile(
      `stockora-movement-ledger-${new Date().toISOString().slice(0, 10)}.csv`,
      filteredMovements.map((m) => ({
        MovementID: m.id,
        Timestamp: m.timestamp,
        SKU: m.sku,
        Product: m.productName,
        Warehouse: warehouseMap.get(m.warehouseId)?.code ?? m.warehouseId,
        Type: m.movementType,
        Delta: m.quantityDelta,
        BeforeQty: m.beforeQuantity,
        AfterQty: m.afterQuantity,
        UnitCost: m.unitCostSnapshot.toFixed(2),
        SourceRef: m.sourceReference,
        Reason: m.reason,
        Actor: m.actor,
      })),
      [
        { key: 'MovementID', header: 'Movement ID' },
        { key: 'Timestamp', header: 'Date & Time' },
        { key: 'SKU', header: 'SKU' },
        { key: 'Product', header: 'Product' },
        { key: 'Warehouse', header: 'Warehouse' },
        { key: 'Type', header: 'Movement Type' },
        { key: 'Delta', header: 'Quantity Delta' },
        { key: 'BeforeQty', header: 'Before Qty' },
        { key: 'AfterQty', header: 'After Qty' },
        { key: 'UnitCost', header: 'Unit Cost' },
        { key: 'SourceRef', header: 'Source Reference' },
        { key: 'Reason', header: 'Reason' },
        { key: 'Actor', header: 'Actor' },
      ]
    );
    toast.success(`Exported ${filteredMovements.length} ledger movements to CSV.`);
  };

  const handlePostReversal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectedMovement) return;
    const res = reverseMovement(inspectedMovement.id, reversalReason);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Compensating reversal posted for ${inspectedMovement.sourceReference}.`);
    setInspectedMovement(null);
    setReversalReason('');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Stock Movement Ledger
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Immutable source-of-truth ledger for all stock transitions. Corrections use compensating REVERSAL entries.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-medium"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Ledger CSV</span>
        </button>
      </div>

      {/* Filters */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search movement ID, SKU, source document, reason, or actor..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#111B2C] text-xs"
          />
        </div>

        <select
          value={selectedWarehouseId}
          onChange={(e) => {
            setSelectedWarehouseId(e.target.value);
            setPage(1);
          }}
          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C] text-xs"
        >
          <option value="ALL">All Warehouses</option>
          {data.warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.code} · {w.name}
            </option>
          ))}
        </select>

        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value as 'ALL' | MovementType);
            setPage(1);
          }}
          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C] text-xs"
        >
          <option value="ALL">All Movement Types</option>
          {MOVEMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, ' ')}
            </option>
          ))}
        </select>

        <select
          value={productFilter}
          onChange={(e) => {
            setProductFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C] text-xs max-w-[200px]"
        >
          <option value="ALL">All Products</option>
          {data.products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.sku} — {p.name}
            </option>
          ))}
        </select>

        <select
          value={dateRange}
          onChange={(e) => {
            setDateRange(e.target.value as 'ALL' | '30d' | '90d' | '365d');
            setPage(1);
          }}
          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C] text-xs"
        >
          <option value="ALL">All Time</option>
          <option value="30d">Last 30 Days</option>
          <option value="90d">Last 90 Days</option>
          <option value="365d">Last 12 Months</option>
        </select>
      </div>

      {/* Ledger Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-[#111B2C]/60 text-slate-500">
                <th className="py-3 px-4">Movement ID</th>
                <th className="py-3 px-3">Date & Time</th>
                <th className="py-3 px-3">SKU & Product</th>
                <th className="py-3 px-3">Warehouse</th>
                <th className="py-3 px-3">Movement Type</th>
                <th className="py-3 px-3 text-right">Delta</th>
                <th className="py-3 px-3 text-right">Before → After</th>
                <th className="py-3 px-3">Source Ref</th>
                <th className="py-3 px-3">Reason</th>
                <th className="py-3 px-3">Actor</th>
                <th className="py-3 px-4 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedMovements.map((mov) => {
                const wh = warehouseMap.get(mov.warehouseId);
                const isPos = mov.quantityDelta > 0;
                return (
                  <tr
                    key={mov.id}
                    className={`hover:bg-slate-50 dark:hover:bg-[#1F3047]/50 ${
                      mov.reversedByMovementId ? 'opacity-60' : ''
                    }`}
                  >
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {mov.id.slice(0, 14)}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-500 whitespace-nowrap">
                      {formatDateTime(mov.timestamp)}
                    </td>
                    <td className="py-2.5 px-3">
                      <Link
                        href={`/dashboard/products/${mov.productId}`}
                        className="font-mono font-semibold text-[#2563EB] dark:text-[#60A5FA] hover:underline"
                      >
                        {mov.sku}
                      </Link>
                      <div className="text-[11px] text-slate-500 truncate max-w-[180px]">
                        {mov.productName}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap font-mono">
                      {wh ? wh.code : mov.warehouseId}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px]">
                      {mov.movementType.replace(/_/g, ' ')}
                      {mov.reversedByMovementId && (
                        <span className="ml-1 text-rose-500">(Reversed)</span>
                      )}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-mono tabular-nums font-bold ${
                        isPos ? 'text-[#059669]' : 'text-[#DC2626]'
                      }`}
                    >
                      {isPos ? `+${mov.quantityDelta}` : mov.quantityDelta}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {mov.beforeQuantity} → {mov.afterQuantity}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">
                      {mov.sourceReference}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 max-w-[200px] truncate">
                      {mov.reason}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{mov.actor}</td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setInspectedMovement(mov);
                          setReversalReason('');
                        }}
                        className="p-1.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-[#1F3047]"
                        title="Inspect or Reverse Movement"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing {paginatedMovements.length} of {filteredMovements.length} posted ledger entries
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="font-mono">
              Page {safePage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Movement Details & Reversal Modal */}
      {inspectedMovement && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
          onClick={() => setInspectedMovement(null)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#2563EB]" />
                <h2 className="text-sm font-semibold">
                  Ledger Transaction Record · {inspectedMovement.id}
                </h2>
              </div>
              <button onClick={() => setInspectedMovement(null)} className="p-1 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                <div className="py-2 flex justify-between">
                  <span className="text-slate-500">Product / SKU</span>
                  <span className="font-mono font-semibold">
                    {inspectedMovement.sku} — {inspectedMovement.productName}
                  </span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-500">Movement Type</span>
                  <span className="font-mono">{inspectedMovement.movementType}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-500">Quantity Transition</span>
                  <span className="font-mono tabular-nums font-bold">
                    {inspectedMovement.beforeQuantity} → {inspectedMovement.afterQuantity} (Delta:{' '}
                    {inspectedMovement.quantityDelta > 0
                      ? `+${inspectedMovement.quantityDelta}`
                      : inspectedMovement.quantityDelta}
                    )
                  </span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-500">Valuation Snapshot</span>
                  <span className="font-mono tabular-nums">
                    Unit: {formatCurrency(inspectedMovement.unitCostSnapshot, settings.defaultCurrency)} · Total:{' '}
                    {formatCurrency(inspectedMovement.totalValueSnapshot, settings.defaultCurrency)}
                  </span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-500">Source Reference</span>
                  <span className="font-mono">{inspectedMovement.sourceReference}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-500">Reason</span>
                  <span>{inspectedMovement.reason}</span>
                </div>
              </div>

              {!inspectedMovement.reversedByMovementId &&
              inspectedMovement.movementType !== 'REVERSAL' ? (
                <form
                  onSubmit={handlePostReversal}
                  className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-3"
                >
                  <div className="font-semibold text-slate-900 dark:text-white">
                    Post Compensating Reversal Entry
                  </div>
                  <p className="text-slate-500">
                    Posted ledger entries are immutable. To correct this transaction, enter an audit reason to post a compensating reversal movement ({-inspectedMovement.quantityDelta > 0 ? `+${-inspectedMovement.quantityDelta}` : -inspectedMovement.quantityDelta} units).
                  </p>
                  <input
                    required
                    value={reversalReason}
                    onChange={(e) => setReversalReason(e.target.value)}
                    placeholder="Reason for reversal (e.g., Data entry correction)"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setInspectedMovement(null)}
                      className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700"
                    >
                      Close
                    </button>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Post Reversal Entry</span>
                    </button>
                  </div>
                </form>
              ) : (
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#111B2C] text-slate-500">
                  {inspectedMovement.reversedByMovementId
                    ? `This movement was reversed by entry ${inspectedMovement.reversedByMovementId}.`
                    : `This entry is a compensating reversal of ${inspectedMovement.reversesMovementId}.`}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
