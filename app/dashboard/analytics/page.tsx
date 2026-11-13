'use client';

import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useStockoraStore } from '@/stores/useStockoraStore';
import { deriveInventoryBalances } from '@/lib/inventory-engine';
import { formatCurrency, formatQuantity } from '@/lib/formatters';

const COLORS = ['#2563EB', '#059669', '#F59E0B', '#6366F1', '#EC4899', '#0EA5E9'];

export default function InventoryAnalyticsPage() {
  const { data, settings, selectedWarehouseId } = useStockoraStore();
  const [dateRange, setDateRange] = useState<'90d' | '180d' | '365d' | 'all'>('365d');

  const balances = useMemo(() => {
    const all = deriveInventoryBalances(data);
    return selectedWarehouseId === 'ALL'
      ? all
      : all.filter((b) => b.warehouseId === selectedWarehouseId);
  }, [data, selectedWarehouseId]);

  const kpis = useMemo(() => {
    const totalValuation = balances.reduce((s, b) => s + b.totalValue, 0);
    const totalUnits = balances.reduce((s, b) => s + b.onHandQuantity, 0);
    const outCount = balances.filter((b) => b.stockStatus === 'OUT_OF_STOCK').length;
    const lowCount = balances.filter((b) => b.stockStatus === 'LOW_STOCK').length;
    const outRate = balances.length
      ? ((outCount / balances.length) * 100).toFixed(1)
      : '0.0';
    const lowRate = balances.length
      ? ((lowCount / balances.length) * 100).toFixed(1)
      : '0.0';

    const outboundVal = data.stockMovements
      .filter((m) => m.quantityDelta < 0)
      .reduce((s, m) => s + Math.abs(m.quantityDelta) * m.unitCostSnapshot, 0);

    const turnoverRatio =
      totalValuation > 0 ? ((outboundVal * 4) / totalValuation).toFixed(2) : '0.00';

    return {
      totalValuation,
      totalUnits,
      outRate,
      lowRate,
      turnoverRatio,
    };
  }, [balances, data.stockMovements]);

  const warehouseChartData = useMemo(() => {
    return data.warehouses
      .filter((w) => w.status === 'ACTIVE')
      .map((wh) => {
        const whBals = deriveInventoryBalances(data).filter((b) => b.warehouseId === wh.id);
        return {
          code: wh.code,
          name: wh.name,
          units: whBals.reduce((s, b) => s + b.onHandQuantity, 0),
          valuation: Math.round(whBals.reduce((s, b) => s + b.totalValue, 0)),
        };
      });
  }, [data]);

  const adjustmentReasonsData = useMemo(() => {
    const map = new Map<string, number>();
    for (const adj of data.stockAdjustments) {
      map.set(adj.reason, (map.get(adj.reason) ?? 0) + adj.quantity);
    }
    return Array.from(map.entries()).map(([name, units]) => ({ name, units }));
  }, [data.stockAdjustments]);

  const supplierSpendData = useMemo(() => {
    const supMap = new Map(data.suppliers.map((s) => [s.id, s.companyName]));
    const spend = new Map<string, number>();
    for (const po of data.purchaseOrders) {
      if (po.status === 'CANCELLED') continue;
      const name = supMap.get(po.supplierId) ?? po.supplierId;
      spend.set(name, (spend.get(name) ?? 0) + po.totalAmount);
    }
    return Array.from(spend.entries())
      .map(([supplier, amount]) => ({
        supplier: supplier.split(' ')[0],
        fullName: supplier,
        amount: Math.round(amount),
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);
  }, [data.purchaseOrders, data.suppliers]);

  const movementTypeBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of data.stockMovements) {
      const label = m.movementType.replace(/_/g, ' ');
      counts.set(label, (counts.get(label) ?? 0) + Math.abs(m.quantityDelta));
    }
    return Array.from(counts.entries()).map(([type, units]) => ({ type, units }));
  }, [data.stockMovements]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Inventory & Supply Chain Analytics
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Derived directly from central ledger records, purchase orders, and Moving Weighted Average Cost valuation
          </p>
        </div>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value as '90d' | '180d' | '365d' | 'all')}
          className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] text-xs font-medium"
        >
          <option value="90d">Last 90 Days</option>
          <option value="180d">Last 6 Months</option>
          <option value="365d">Last 12 Months</option>
          <option value="all">All Recorded History</option>
        </select>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337]">
          <div className="text-xs text-slate-500">Total Inventory Capital</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-[#2563EB] dark:text-[#60A5FA]">
            {formatCurrency(kpis.totalValuation, settings.defaultCurrency)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {formatQuantity(kpis.totalUnits)} physical units on-hand
          </div>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337]">
          <div className="text-xs text-slate-500">Low-Stock Slot Rate</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
            {kpis.lowRate}%
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Warehouse-SKU slots at or below reorder point
          </div>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337]">
          <div className="text-xs text-slate-500">Out-of-Stock Slot Rate</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-rose-600">
            {kpis.outRate}%
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Depleted slots requiring replenishment
          </div>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337]">
          <div className="text-xs text-slate-500">Annualized Stock Turnover</div>
          <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-[#059669] dark:text-emerald-400">
            {kpis.turnoverRatio}x
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Annualized Outbound Movement Value ÷ Avg Valuation
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337]">
          <h2 className="text-sm font-semibold mb-1">Valuation by Warehouse Facility</h2>
          <p className="text-xs text-slate-500 mb-4">
            Comparison of capital value across active distribution hubs
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={warehouseChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94A3B8" strokeOpacity={0.2} />
                <XAxis dataKey="code" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
                <Tooltip
                  formatter={(v: unknown) => formatCurrency(Number(v), settings.defaultCurrency)}
                />
                <Bar dataKey="valuation" fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337]">
          <h2 className="text-sm font-semibold mb-1">Supplier Purchasing Distribution</h2>
          <p className="text-xs text-slate-500 mb-4">
            Top vendors ranked by cumulative Purchase Order value
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={supplierSpendData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#94A3B8" strokeOpacity={0.2} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="supplier" type="category" tick={{ fontSize: 11 }} width={85} />
                <Tooltip
                  formatter={(v: unknown) => formatCurrency(Number(v), settings.defaultCurrency)}
                />
                <Bar dataKey="amount" fill="#059669" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337]">
          <h2 className="text-sm font-semibold mb-1">Stock Adjustment Reasons Breakdown</h2>
          <p className="text-xs text-slate-500 mb-4">
            Units adjusted by operational cause (Damaged, Count Correction, Found, Lost)
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={adjustmentReasonsData}
                  dataKey="units"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                >
                  {adjustmentReasonsData.map((entry, idx) => (
                    <Cell key={entry.name} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337]">
          <h2 className="text-sm font-semibold mb-1">Gross Volume by Movement Type</h2>
          <p className="text-xs text-slate-500 mb-4">
            Cumulative unit volume processed across ledger transaction classes
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={movementTypeBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94A3B8" strokeOpacity={0.2} />
                <XAxis dataKey="type" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="units" fill="#6366F1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
