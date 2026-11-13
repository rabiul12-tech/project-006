'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowUpDown,
  Columns,
  Download,
  Eye,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useStockoraStore } from '@/stores/useStockoraStore';
import { deriveInventoryBalances } from '@/lib/inventory-engine';
import { downloadCsvFile } from '@/lib/export';
import {
  formatCurrency,
  formatQuantity,
  getStockStatusColorClass,
  getStockStatusLabel,
} from '@/lib/formatters';
import { AdjustmentReason, InventoryBalance, StockStatus } from '@/types/erp';

type SortField =
  | 'sku'
  | 'productName'
  | 'warehouseCode'
  | 'onHandQuantity'
  | 'availableQuantity'
  | 'unitCost'
  | 'totalValue';

export default function MasterInventoryPage() {
  const { data, settings, selectedWarehouseId, setSelectedWarehouseId, recordAdjustment } =
    useStockoraStore();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | StockStatus>('ALL');
  const [hideZeroRows, setHideZeroRows] = useState(false);
  const [sortField, setSortField] = useState<SortField>('sku');
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Column visibility state
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [visibleCols, setVisibleCols] = useState({
    category: true,
    reserved: true,
    inTransit: true,
    reorderPoint: true,
    unitCost: true,
  });

  // Quick Adjustment Drawer/Modal State
  const [adjustTarget, setAdjustTarget] = useState<InventoryBalance | null>(null);
  const [adjType, setAdjType] = useState<'POSITIVE' | 'NEGATIVE'>('POSITIVE');
  const [adjQty, setAdjQty] = useState('5');
  const [adjReason, setAdjReason] = useState<AdjustmentReason>('Stock Count Correction');
  const [adjNotes, setAdjNotes] = useState('');

  const allBalances = useMemo(() => deriveInventoryBalances(data), [data]);

  const filteredBalances = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allBalances
      .filter((b) => selectedWarehouseId === 'ALL' || b.warehouseId === selectedWarehouseId)
      .filter((b) => categoryFilter === 'ALL' || b.categoryId === categoryFilter)
      .filter((b) => statusFilter === 'ALL' || b.stockStatus === statusFilter)
      .filter((b) => !hideZeroRows || b.onHandQuantity > 0 || b.inTransitInbound > 0)
      .filter(
        (b) =>
          !q ||
          b.sku.toLowerCase().includes(q) ||
          b.productName.toLowerCase().includes(q) ||
          b.categoryName.toLowerCase().includes(q) ||
          b.warehouseCode.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const valA = a[sortField];
        const valB = b[sortField];
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortAsc ? valA - valB : valB - valA;
        }
        return sortAsc
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
  }, [
    allBalances,
    selectedWarehouseId,
    categoryFilter,
    statusFilter,
    hideZeroRows,
    search,
    sortField,
    sortAsc,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredBalances.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedRows = filteredBalances.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  const summaryTotals = useMemo(() => {
    return filteredBalances.reduce(
      (acc, b) => {
        acc.onHand += b.onHandQuantity;
        acc.reserved += b.reservedQuantity;
        acc.available += b.availableQuantity;
        acc.value += b.totalValue;
        return acc;
      },
      { onHand: 0, reserved: 0, available: 0, value: 0 }
    );
  }, [filteredBalances]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleExportCsv = () => {
    downloadCsvFile(
      `stockora-inventory-${new Date().toISOString().slice(0, 10)}.csv`,
      filteredBalances.map((b) => ({
        SKU: b.sku,
        Product: b.productName,
        Category: b.categoryName,
        Warehouse: `${b.warehouseCode} - ${b.warehouseName}`,
        OnHand: b.onHandQuantity,
        Reserved: b.reservedQuantity,
        Available: b.availableQuantity,
        InTransitInbound: b.inTransitInbound,
        ReorderPoint: b.reorderPoint,
        Status: getStockStatusLabel(b.stockStatus),
        UnitCost: b.unitCost.toFixed(2),
        TotalValue: b.totalValue.toFixed(2),
      })),
      [
        { key: 'SKU', header: 'SKU' },
        { key: 'Product', header: 'Product Name' },
        { key: 'Category', header: 'Category' },
        { key: 'Warehouse', header: 'Warehouse' },
        { key: 'OnHand', header: 'On-Hand Qty' },
        { key: 'Reserved', header: 'Reserved Qty' },
        { key: 'Available', header: 'Available Qty' },
        { key: 'InTransitInbound', header: 'In-Transit In' },
        { key: 'ReorderPoint', header: 'Reorder Point' },
        { key: 'Status', header: 'Stock Status' },
        { key: 'UnitCost', header: 'Unit Cost' },
        { key: 'TotalValue', header: 'Total Valuation' },
      ]
    );
    toast.success(`Exported ${filteredBalances.length} inventory records to CSV.`);
  };

  const handleQuickAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTarget) return;
    const res = recordAdjustment({
      warehouseId: adjustTarget.warehouseId,
      productId: adjustTarget.productId,
      adjustmentType: adjType,
      quantity: Number(adjQty),
      reason: adjReason,
      notes: adjNotes || 'Adjusted from Master Inventory View',
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Adjusted ${adjustTarget.sku} at ${adjustTarget.warehouseCode}.`);
    setAdjustTarget(null);
    setAdjNotes('');
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Master Inventory View
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Derived warehouse-by-warehouse stock balances, reservations, thresholds, and Moving Weighted Average valuation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowColumnsMenu(!showColumnsMenu)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] text-xs font-medium"
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Columns</span>
            </button>
            {showColumnsMenu && (
              <div
                className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] shadow-xl p-3 z-20 space-y-2 text-xs"
                onMouseLeave={() => setShowColumnsMenu(false)}
              >
                <div className="font-semibold text-slate-900 dark:text-white pb-1 border-b border-slate-100 dark:border-slate-700">
                  Toggle Columns
                </div>
                {(
                  [
                    ['category', 'Category'],
                    ['reserved', 'Reserved Qty'],
                    ['inTransit', 'In-Transit Qty'],
                    ['reorderPoint', 'Reorder Point'],
                    ['unitCost', 'Unit Cost'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleCols[key]}
                      onChange={(e) =>
                        setVisibleCols((prev) => ({ ...prev, [key]: e.target.checked }))
                      }
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337]">
          <div className="text-xs text-slate-500 dark:text-slate-400">Filtered On-Hand Units</div>
          <div className="mt-1 text-lg font-bold font-mono tabular-nums">
            {formatQuantity(summaryTotals.onHand)}
          </div>
        </div>
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337]">
          <div className="text-xs text-slate-500 dark:text-slate-400">Reserved Allocation</div>
          <div className="mt-1 text-lg font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
            {formatQuantity(summaryTotals.reserved)}
          </div>
        </div>
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337]">
          <div className="text-xs text-slate-500 dark:text-slate-400">Net Available Stock</div>
          <div className="mt-1 text-lg font-bold font-mono tabular-nums text-[#059669] dark:text-emerald-400">
            {formatQuantity(summaryTotals.available)}
          </div>
        </div>
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337]">
          <div className="text-xs text-slate-500 dark:text-slate-400">Filtered Valuation</div>
          <div className="mt-1 text-lg font-bold font-mono tabular-nums text-[#2563EB] dark:text-[#60A5FA]">
            {formatCurrency(summaryTotals.value, settings.defaultCurrency)}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
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
            placeholder="Filter by SKU, product name, category, or warehouse..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#111B2C] text-xs focus:outline-none"
          />
        </div>

        <select
          aria-label="Filter by Warehouse"
          value={selectedWarehouseId}
          onChange={(e) => {
            setSelectedWarehouseId(e.target.value);
            setPage(1);
          }}
          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C] text-xs"
        >
          <option value="ALL">All Warehouses</option>
          {data.warehouses
            .filter((w) => w.status === 'ACTIVE')
            .map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} · {w.name}
              </option>
            ))}
        </select>

        <select
          aria-label="Filter by Category"
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C] text-xs"
        >
          <option value="ALL">All Categories</option>
          {data.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#111B2C] text-xs">
          {(
            [
              ['ALL', 'All Status'],
              ['IN_STOCK', 'In Stock'],
              ['LOW_STOCK', 'Low Stock'],
              ['OUT_OF_STOCK', 'Out of Stock'],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => {
                setStatusFilter(val);
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap ${
                statusFilter === val
                  ? 'bg-white dark:bg-[#172337] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={hideZeroRows}
            onChange={(e) => {
              setHideZeroRows(e.target.checked);
              setPage(1);
            }}
          />
          <span>Hide 0 balance rows</span>
        </label>
      </div>

      {/* Master Inventory Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-[#111B2C]/60 text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4 font-semibold">
                  <button
                    type="button"
                    onClick={() => handleSort('sku')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                  >
                    <span>SKU</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3 font-semibold">
                  <button
                    type="button"
                    onClick={() => handleSort('productName')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                  >
                    <span>Product</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                {visibleCols.category && <th className="py-3 px-3 font-semibold">Category</th>}
                <th className="py-3 px-3 font-semibold">
                  <button
                    type="button"
                    onClick={() => handleSort('warehouseCode')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                  >
                    <span>Warehouse</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3 font-semibold text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('onHandQuantity')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                  >
                    <span>On-Hand</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                {visibleCols.reserved && (
                  <th className="py-3 px-3 font-semibold text-right">Reserved</th>
                )}
                <th className="py-3 px-3 font-semibold text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('availableQuantity')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                  >
                    <span>Available</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                {visibleCols.inTransit && (
                  <th className="py-3 px-3 font-semibold text-right">In-Transit</th>
                )}
                {visibleCols.reorderPoint && (
                  <th className="py-3 px-3 font-semibold text-right">Reorder Pt</th>
                )}
                <th className="py-3 px-3 font-semibold">Status</th>
                {visibleCols.unitCost && (
                  <th className="py-3 px-3 font-semibold text-right">
                    <button
                      type="button"
                      onClick={() => handleSort('unitCost')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                    >
                      <span>Unit Cost</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                )}
                <th className="py-3 px-3 font-semibold text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('totalValue')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                  >
                    <span>Total Value</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-500">
                    No inventory records match your current filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row) => (
                  <tr
                    key={`${row.productId}-${row.warehouseId}`}
                    className="hover:bg-slate-50 dark:hover:bg-[#1F3047]/50 transition-colors"
                  >
                    <td className="py-2.5 px-4 font-mono font-semibold text-[#2563EB] dark:text-[#60A5FA] whitespace-nowrap">
                      <Link href={`/dashboard/products/${row.productId}`} className="hover:underline">
                        {row.sku}
                      </Link>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-slate-100 max-w-[220px] truncate">
                      {row.productName}
                    </td>
                    {visibleCols.category && (
                      <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 truncate max-w-[160px]">
                        {row.categoryName}
                      </td>
                    )}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="font-mono font-medium">{row.warehouseCode}</span>
                      <span className="text-slate-400 mx-1">·</span>
                      <span className="text-slate-600 dark:text-slate-300">{row.warehouseName}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold">
                      {row.onHandQuantity} {row.unitOfMeasure}
                    </td>
                    {visibleCols.reserved && (
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-500">
                        {row.reservedQuantity}
                      </td>
                    )}
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                      {row.availableQuantity}
                    </td>
                    {visibleCols.inTransit && (
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#2563EB] dark:text-[#60A5FA]">
                        {row.inTransitInbound > 0 ? `+${row.inTransitInbound}` : '0'}
                      </td>
                    )}
                    {visibleCols.reorderPoint && (
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-500">
                        {row.reorderPoint}
                      </td>
                    )}
                    <td className={`py-2.5 px-3 whitespace-nowrap ${getStockStatusColorClass(row.stockStatus)}`}>
                      {getStockStatusLabel(row.stockStatus)}
                    </td>
                    {visibleCols.unitCost && (
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {formatCurrency(row.unitCost, settings.defaultCurrency)}
                      </td>
                    )}
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold">
                      {formatCurrency(row.totalValue, settings.defaultCurrency)}
                    </td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setAdjustTarget(row);
                            setAdjType('POSITIVE');
                            setAdjQty('5');
                          }}
                          className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-[#1F3047] text-[11px] font-medium inline-flex items-center gap-1"
                          title="Quick Stock Adjustment"
                        >
                          <SlidersHorizontal className="w-3 h-3" />
                          <span>Adjust</span>
                        </button>
                        <Link
                          href={`/dashboard/products/${row.productId}`}
                          className="p-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-[#1F3047] text-slate-600 dark:text-slate-300"
                          title="Open Product 360° View"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <div>
            Showing{' '}
            <strong className="font-mono text-slate-900 dark:text-white">
              {filteredBalances.length === 0 ? 0 : (safePage - 1) * pageSize + 1}
            </strong>{' '}
            to{' '}
            <strong className="font-mono text-slate-900 dark:text-white">
              {Math.min(safePage * pageSize, filteredBalances.length)}
            </strong>{' '}
            of{' '}
            <strong className="font-mono text-slate-900 dark:text-white">
              {filteredBalances.length}
            </strong>{' '}
            warehouse-product balances
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-[#1F3047]"
            >
              Previous
            </button>
            <span className="px-2 font-mono">
              Page {safePage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-[#1F3047]"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Quick Adjustment Modal */}
      {adjustTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
          onClick={() => setAdjustTarget(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Adjust Stock · {adjustTarget.sku}
                </h2>
                <p className="text-xs text-slate-500">
                  {adjustTarget.warehouseCode} · {adjustTarget.warehouseName}
                </p>
              </div>
              <button
                onClick={() => setAdjustTarget(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleQuickAdjustSubmit} className="p-5 space-y-3.5 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#111B2C] border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <span>
                  Current On-Hand:{' '}
                  <strong className="font-mono tabular-nums">{adjustTarget.onHandQuantity}</strong>
                </span>
                <span>
                  Preview After:{' '}
                  <strong className="font-mono tabular-nums text-[#2563EB] dark:text-[#60A5FA]">
                    {adjType === 'POSITIVE'
                      ? adjustTarget.onHandQuantity + Number(adjQty || 0)
                      : adjustTarget.onHandQuantity - Number(adjQty || 0)}
                  </strong>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Adjustment Type</label>
                  <select
                    value={adjType}
                    onChange={(e) => setAdjType(e.target.value as 'POSITIVE' | 'NEGATIVE')}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                  >
                    <option value="POSITIVE">Positive (+ Add)</option>
                    <option value="NEGATIVE">Negative (- Deduct)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={adjQty}
                    onChange={(e) => setAdjQty(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C] font-mono tabular-nums"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium mb-1">Reason</label>
                <select
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value as AdjustmentReason)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                >
                  <option value="Stock Count Correction">Stock Count Correction</option>
                  <option value="Damaged">Damaged</option>
                  <option value="Found">Found</option>
                  <option value="Lost">Lost</option>
                  <option value="Expired">Expired</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block font-medium mb-1">Audit Notes</label>
                <input
                  value={adjNotes}
                  onChange={(e) => setAdjNotes(e.target.value)}
                  placeholder="Optional reference note"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustTarget(null)}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white font-medium"
                >
                  Post Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
