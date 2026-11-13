'use client';

import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Bookmark, Download, Printer, Trash2 } from 'lucide-react';
import { useStockoraStore } from '@/stores/useStockoraStore';
import {
  deriveInventoryBalances,
  getReorderRecommendations,
} from '@/lib/inventory-engine';
import { downloadCsvFile } from '@/lib/export';
import { formatCurrency, formatDateShort, getStockStatusLabel } from '@/lib/formatters';
import { SavedReport } from '@/types/erp';

const REPORT_TYPES: Array<{
  id: SavedReport['reportType'];
  title: string;
  desc: string;
}> = [
  { id: 'INVENTORY_BALANCE', title: 'Inventory Balance Report', desc: 'Complete SKU-by-warehouse on-hand, reserved, and available quantities' },
  { id: 'INVENTORY_VALUATION', title: 'Inventory Valuation Report', desc: 'Moving Weighted Average Cost valuation reconciled by SKU and facility' },
  { id: 'WAREHOUSE_INVENTORY', title: 'Warehouse Inventory Summary', desc: 'Aggregated stock units, SKU count, and capital value by warehouse' },
  { id: 'LOW_STOCK', title: 'Low Stock & Depletion Report', desc: 'Items currently below reorder threshold or out of stock' },
  { id: 'REORDER', title: 'Reorder Recommendations Report', desc: 'Suggested replenishment quantities factoring confirmed incoming stock' },
  { id: 'STOCK_MOVEMENT', title: 'Stock Movement Ledger Report', desc: 'Chronological transaction history with before/after balances' },
  { id: 'PURCHASE_ORDER', title: 'Purchase Order Status Report', desc: 'Vendor purchase orders with ordered, received, and outstanding quantities' },
  { id: 'GOODS_RECEIVING', title: 'Goods Receiving (GRN) Report', desc: 'Posted receiving documents with accepted and rejected QA quantities' },
  { id: 'SUPPLIER', title: 'Supplier Performance Report', desc: 'Vendor directory, payment terms, ratings, and linked SKU counts' },
  { id: 'STOCK_ADJUSTMENT', title: 'Stock Adjustment Audit Report', desc: 'Cycle count corrections, damaged inventory, and shrinkage logs' },
];

export default function OperationalReportsCenterPage() {
  const {
    data,
    settings,
    selectedWarehouseId,
    setSelectedWarehouseId,
    saveReportConfig,
    deleteSavedReport,
  } = useStockoraStore();

  const [activeReport, setActiveReport] =
    useState<SavedReport['reportType']>('INVENTORY_BALANCE');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [customReportName, setCustomReportName] = useState('');

  const allBalances = useMemo(() => deriveInventoryBalances(data), [data]);

  const reportRows = useMemo(() => {
    const filteredBalances = allBalances
      .filter((b) => selectedWarehouseId === 'ALL' || b.warehouseId === selectedWarehouseId)
      .filter((b) => categoryFilter === 'ALL' || b.categoryId === categoryFilter);

    switch (activeReport) {
      case 'INVENTORY_BALANCE':
      case 'INVENTORY_VALUATION':
        return filteredBalances.map((b) => ({
          Col1: b.sku,
          Col2: b.productName,
          Col3: `${b.warehouseCode} · ${b.warehouseName}`,
          Col4: `${b.onHandQuantity} on-hand / ${b.availableQuantity} avail`,
          Col5: formatCurrency(b.unitCost, settings.defaultCurrency),
          Col6: formatCurrency(b.totalValue, settings.defaultCurrency),
        }));
      case 'WAREHOUSE_INVENTORY':
        return data.warehouses.map((w) => {
          const whBals = allBalances.filter((b) => b.warehouseId === w.id);
          const units = whBals.reduce((s, b) => s + b.onHandQuantity, 0);
          const val = whBals.reduce((s, b) => s + b.totalValue, 0);
          return {
            Col1: w.code,
            Col2: w.name,
            Col3: w.manager,
            Col4: `${whBals.filter((b) => b.onHandQuantity > 0).length} Stocked SKUs`,
            Col5: `${units.toLocaleString()} units`,
            Col6: formatCurrency(val, settings.defaultCurrency),
          };
        });
      case 'LOW_STOCK':
        return filteredBalances
          .filter((b) => b.stockStatus !== 'IN_STOCK')
          .map((b) => ({
            Col1: b.sku,
            Col2: b.productName,
            Col3: b.warehouseCode,
            Col4: `Available: ${b.availableQuantity} (Reorder ≤ ${b.reorderPoint})`,
            Col5: getStockStatusLabel(b.stockStatus),
            Col6: formatCurrency(b.totalValue, settings.defaultCurrency),
          }));
      case 'REORDER':
        return getReorderRecommendations(data, selectedWarehouseId, categoryFilter).map((r) => ({
          Col1: r.sku,
          Col2: r.productName,
          Col3: r.preferredSupplierName,
          Col4: `Avail: ${r.availableQuantity} / Incoming: ${r.confirmedIncoming}`,
          Col5: `Suggested: +${r.suggestedReorderQuantity}`,
          Col6: formatCurrency(r.estimatedOrderCost, settings.defaultCurrency),
        }));
      case 'STOCK_MOVEMENT':
        return data.stockMovements
          .filter((m) => selectedWarehouseId === 'ALL' || m.warehouseId === selectedWarehouseId)
          .slice(0, 60)
          .map((m) => ({
            Col1: m.sku,
            Col2: m.movementType,
            Col3: m.sourceReference,
            Col4: `${m.beforeQuantity} → ${m.afterQuantity} (${m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta})`,
            Col5: m.actor,
            Col6: formatDateShort(m.timestamp),
          }));
      case 'PURCHASE_ORDER':
        return data.purchaseOrders.map((po) => ({
          Col1: po.poNumber,
          Col2: data.suppliers.find((s) => s.id === po.supplierId)?.companyName ?? po.supplierId,
          Col3: po.status,
          Col4: `${po.lines.reduce((s, l) => s + l.quantityOrdered, 0)} ordered / ${po.lines.reduce((s, l) => s + l.quantityReceived, 0)} rec`,
          Col5: formatDateShort(po.orderDate),
          Col6: formatCurrency(po.totalAmount, settings.defaultCurrency),
        }));
      case 'GOODS_RECEIVING':
        return data.goodsReceipts.map((g) => ({
          Col1: g.grnNumber,
          Col2: g.poNumber,
          Col3: g.receivedBy,
          Col4: `Accepted: +${g.lines.reduce((s, l) => s + l.acceptedQuantity, 0)}`,
          Col5: `Rejected: ${g.lines.reduce((s, l) => s + l.rejectedQuantity, 0)}`,
          Col6: formatDateShort(g.receivedDate),
        }));
      case 'SUPPLIER':
        return data.suppliers.map((s) => ({
          Col1: s.code,
          Col2: s.companyName,
          Col3: s.contactName,
          Col4: s.location,
          Col5: s.paymentTerms,
          Col6: `★ ${s.rating}`,
        }));
      case 'STOCK_ADJUSTMENT':
        return data.stockAdjustments.map((a) => ({
          Col1: a.adjustmentNumber,
          Col2: `${a.sku} — ${a.productName}`,
          Col3: a.reason,
          Col4: `${a.adjustmentType === 'POSITIVE' ? '+' : '-'}${a.quantity}`,
          Col5: `${a.beforeQuantity} → ${a.afterQuantity}`,
          Col6: formatDateShort(a.createdAt),
        }));
    }
  }, [activeReport, allBalances, selectedWarehouseId, categoryFilter, data, settings.defaultCurrency]);

  const handleExportReportCsv = () => {
    downloadCsvFile(
      `stockora-report-${activeReport.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`,
      reportRows,
      [
        { key: 'Col1', header: 'Identifier / Code' },
        { key: 'Col2', header: 'Primary Name / Type' },
        { key: 'Col3', header: 'Context / Reference' },
        { key: 'Col4', header: 'Quantities / Metrics' },
        { key: 'Col5', header: 'Unit / Secondary' },
        { key: 'Col6', header: 'Valuation / Date' },
      ]
    );
    toast.success(`Exported ${activeReport} report to CSV.`);
  };

  const handleSavePreset = () => {
    const title =
      customReportName.trim() ||
      `${REPORT_TYPES.find((r) => r.id === activeReport)?.title} (${selectedWarehouseId})`;
    saveReportConfig({
      name: title,
      reportType: activeReport,
      warehouseFilter: selectedWarehouseId,
      categoryFilter,
      dateRange: 'all',
    });
    setCustomReportName('');
    toast.success(`Saved report configuration "${title}".`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Operational Reporting Center
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Generate, filter, save, print, and export 10 enterprise operational and financial reports
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] text-xs font-medium"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
          <button
            type="button"
            onClick={handleExportReportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-medium"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Sidebar: 10 Report Types + Saved Presets */}
        <div className="lg:col-span-4 space-y-5 no-print">
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] space-y-1.5">
            <div className="text-xs font-semibold text-slate-500 px-2 pb-1">
              Standard Enterprise Reports (10)
            </div>
            {REPORT_TYPES.map((rep) => (
              <button
                key={rep.id}
                type="button"
                onClick={() => setActiveReport(rep.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                  activeReport === rep.id
                    ? 'bg-[#EFF6FF] dark:bg-blue-950/70 text-[#2563EB] dark:text-[#60A5FA] font-semibold'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#1F3047]'
                }`}
              >
                <div>{rep.title}</div>
                <div className="text-[11px] text-slate-400 font-normal truncate">
                  {rep.desc}
                </div>
              </button>
            ))}
          </div>

          {/* Saved Report Configurations */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] space-y-3 text-xs">
            <div className="font-semibold flex items-center gap-1.5">
              <Bookmark className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Saved Report Configurations</span>
            </div>
            <div className="flex gap-2">
              <input
                value={customReportName}
                onChange={(e) => setCustomReportName(e.target.value)}
                placeholder="Name current filter preset..."
                className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#111B2C]"
              />
              <button
                type="button"
                onClick={handleSavePreset}
                className="px-3 py-1.5 rounded-lg bg-[#2563EB] text-white font-medium"
              >
                Save
              </button>
            </div>
            <div className="space-y-1.5">
              {data.savedReports.map((sr) => (
                <div
                  key={sr.id}
                  className="p-2 rounded-lg bg-slate-50 dark:bg-[#111B2C] flex items-center justify-between"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActiveReport(sr.reportType);
                      setSelectedWarehouseId(sr.warehouseFilter);
                      setCategoryFilter(sr.categoryFilter);
                    }}
                    className="text-left font-medium hover:text-[#2563EB] truncate"
                  >
                    {sr.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteSavedReport(sr.id)}
                    className="text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Report Output Table */}
        <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {REPORT_TYPES.find((r) => r.id === activeReport)?.title}
              </h2>
              <p className="text-xs text-slate-500">
                Generated {new Date().toLocaleDateString()} · {reportRows.length} rows
              </p>
            </div>
            <div className="flex items-center gap-2 no-print text-xs">
              <select
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#111B2C]"
              >
                <option value="ALL">All Warehouses</option>
                {data.warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} · {w.name}
                  </option>
                ))}
              </select>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#111B2C]"
              >
                <option value="ALL">All Categories</option>
                {data.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-[#111B2C]/60 text-slate-500">
                  <th className="py-2.5 px-4">Code / ID</th>
                  <th className="py-2.5 px-3">Primary Description</th>
                  <th className="py-2.5 px-3">Facility / Reference</th>
                  <th className="py-2.5 px-3">Quantity / Balance</th>
                  <th className="py-2.5 px-3">Secondary Metric</th>
                  <th className="py-2.5 px-4 text-right">Value / Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {reportRows.slice(0, 50).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-[#1F3047]/50">
                    <td className="py-2.5 px-4 font-mono font-semibold text-[#2563EB] dark:text-[#60A5FA]">
                      {row.Col1}
                    </td>
                    <td className="py-2.5 px-3 font-medium">{row.Col2}</td>
                    <td className="py-2.5 px-3 text-slate-500">{row.Col3}</td>
                    <td className="py-2.5 px-3 font-mono tabular-nums">{row.Col4}</td>
                    <td className="py-2.5 px-3 font-mono tabular-nums">{row.Col5}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold">
                      {row.Col6}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
