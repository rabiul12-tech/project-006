'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { FileText, TrendingUp } from 'lucide-react';
import { useStockoraStore } from '@/stores/useStockoraStore';
import { getReorderRecommendations } from '@/lib/inventory-engine';
import {
  formatCurrency,
  getStockStatusColorClass,
  getStockStatusLabel,
} from '@/lib/formatters';

export default function ReorderPlanningPage() {
  const { data, settings, selectedWarehouseId, setSelectedWarehouseId, createPO } =
    useStockoraStore();

  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [selectedSkus, setSelectedSkus] = useState<string[]>([]);

  const recommendations = useMemo(
    () => getReorderRecommendations(data, selectedWarehouseId, categoryFilter),
    [data, selectedWarehouseId, categoryFilter]
  );

  const handleCreateDraftPOFromSelected = () => {
    const chosen = recommendations.filter(
      (r) => selectedSkus.includes(r.productId) && r.suggestedReorderQuantity > 0
    );
    if (chosen.length === 0) {
      toast.error('Select at least one recommendation with a positive suggested reorder quantity.');
      return;
    }

    const firstSupplierId = chosen[0].preferredSupplierId || data.suppliers[0]?.id || 'sup-01';
    const destWhId =
      selectedWarehouseId !== 'ALL'
        ? selectedWarehouseId
        : settings.defaultWarehouseId || data.warehouses[0]?.id || 'wh-01';

    const res = createPO({
      supplierId: firstSupplierId,
      warehouseId: destWhId,
      orderDate: new Date().toISOString(),
      expectedDeliveryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      status: 'DRAFT',
      shippingCharges: 85,
      notes: `Auto-generated Draft PO from Reorder Planner (${chosen.length} SKUs)`,
      lines: chosen.map((item) => ({
        productId: item.productId,
        quantityOrdered: item.suggestedReorderQuantity,
        unitCost: item.unitCost,
        discountAmount: 0,
        taxRate: settings.defaultTaxRate,
      })),
    });

    if (!res.ok) {
      toast.error(res.error);
      return;
    }

    toast.success(
      `Draft Purchase Order created for ${chosen.length} recommended SKU(s). Review in Purchase Orders.`
    );
    setSelectedSkus([]);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Reorder Planning & Threshold Engine
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Formula: Suggested Reorder Quantity = Max(0, Target Stock − Available Stock − Confirmed Incoming Stock)
          </p>
        </div>
        <button
          type="button"
          onClick={handleCreateDraftPOFromSelected}
          disabled={selectedSkus.length === 0}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-medium"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Create Draft PO from Selected ({selectedSkus.length})</span>
        </button>
      </div>

      {/* Filters */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
          >
            <option value="ALL">All Warehouses (Consolidated)</option>
            {data.warehouses
              .filter((w) => w.status === 'ACTIVE')
              .map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} · {w.name}
                </option>
              ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
          >
            <option value="ALL">All Categories</option>
            {data.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="text-slate-500">
          Showing <strong>{recommendations.length}</strong> products requiring replenishment attention
        </div>
      </div>

      {/* Reorder Recommendations Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-[#111B2C]/60 text-slate-500">
                <th className="py-3 px-4 w-8">
                  <input
                    type="checkbox"
                    aria-label="Select all recommendations"
                    checked={
                      recommendations.length > 0 &&
                      recommendations.every((r) => selectedSkus.includes(r.productId))
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedSkus(recommendations.map((r) => r.productId));
                      } else {
                        setSelectedSkus([]);
                      }
                    }}
                  />
                </th>
                <th className="py-3 px-3">SKU & Product</th>
                <th className="py-3 px-3">Preferred Supplier</th>
                <th className="py-3 px-3">Stock Status</th>
                <th className="py-3 px-3 text-right">Available</th>
                <th className="py-3 px-3 text-right">Reorder Pt</th>
                <th className="py-3 px-3 text-right">Target Stock</th>
                <th className="py-3 px-3 text-right">On-Order / Incoming</th>
                <th className="py-3 px-3 text-right">Suggested Reorder</th>
                <th className="py-3 px-4 text-right">Est. PO Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {recommendations.map((rec) => (
                <tr
                  key={`${rec.productId}-${rec.warehouseId}`}
                  className="hover:bg-slate-50 dark:hover:bg-[#1F3047]/50"
                >
                  <td className="py-3 px-4">
                    <input
                      type="checkbox"
                      checked={selectedSkus.includes(rec.productId)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedSkus((prev) => [...prev, rec.productId]);
                        } else {
                          setSelectedSkus((prev) => prev.filter((id) => id !== rec.productId));
                        }
                      }}
                    />
                  </td>
                  <td className="py-3 px-3">
                    <Link
                      href={`/dashboard/products/${rec.productId}`}
                      className="font-mono font-semibold text-[#2563EB] dark:text-[#60A5FA] hover:underline"
                    >
                      {rec.sku}
                    </Link>
                    <div className="text-slate-600 dark:text-slate-300 truncate max-w-[200px]">
                      {rec.productName}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                    {rec.preferredSupplierName}
                  </td>
                  <td className={`py-3 px-3 ${getStockStatusColorClass(rec.stockStatus)}`}>
                    {getStockStatusLabel(rec.stockStatus)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold">
                    {rec.availableQuantity}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-500">
                    {rec.reorderPoint}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-500">
                    {rec.targetStock}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-[#059669]">
                    {rec.confirmedIncoming}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-[#2563EB] dark:text-[#60A5FA]">
                    +{rec.suggestedReorderQuantity}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                    {formatCurrency(rec.estimatedOrderCost, settings.defaultCurrency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
