'use client';

import React, { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Activity as ActivityIcon,
  ArrowLeft,
  Barcode,
  Boxes,
  Building2,
  FileText,
  History,
  Package,
  Printer,
  SlidersHorizontal,
} from 'lucide-react';
import { useStockoraStore } from '@/stores/useStockoraStore';
import { deriveInventoryBalances } from '@/lib/inventory-engine';
import {
  formatCurrency,
  formatDateShort,
  formatDateTime,
  formatQuantity,
  getStockStatusColorClass,
  getStockStatusLabel,
} from '@/lib/formatters';
import { BarcodeDisplay } from '@/components/ui/BarcodeDisplay';
import { downloadBarcodeLabelsPdf } from '@/lib/pdf';

type TabKey =
  | 'overview'
  | 'warehouses'
  | 'movements'
  | 'purchasing'
  | 'suppliers'
  | 'barcodes'
  | 'activity';

export default function Product360DetailPage() {
  const params = useParams<{ id: string }>();
  const productId = params?.id ?? 'prd-001';
  const { data, settings, setQuickCreateModal } = useStockoraStore();

  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  const product = useMemo(
    () => data.products.find((p) => p.id === productId) ?? data.products[0],
    [data.products, productId]
  );

  const category = useMemo(
    () => data.categories.find((c) => c.id === product?.categoryId),
    [data.categories, product]
  );

  const productBalances = useMemo(() => {
    if (!product) return [];
    return deriveInventoryBalances(data).filter((b) => b.productId === product.id);
  }, [data, product]);

  const totals = useMemo(() => {
    return productBalances.reduce(
      (acc, b) => {
        acc.onHand += b.onHandQuantity;
        acc.reserved += b.reservedQuantity;
        acc.available += b.availableQuantity;
        acc.inTransit += b.inTransitInbound;
        acc.value += b.totalValue;
        return acc;
      },
      { onHand: 0, reserved: 0, available: 0, inTransit: 0, value: 0 }
    );
  }, [productBalances]);

  const productMovements = useMemo(
    () =>
      data.stockMovements.filter((m) => m.productId === product?.id),
    [data.stockMovements, product]
  );

  const relatedPOs = useMemo(
    () =>
      data.purchaseOrders.filter((po) =>
        po.lines.some((l) => l.productId === product?.id)
      ),
    [data.purchaseOrders, product]
  );

  const linkedSuppliers = useMemo(
    () =>
      data.supplierProducts
        .filter((sp) => sp.productId === product?.id)
        .map((sp) => ({
          ...sp,
          supplier: data.suppliers.find((s) => s.id === sp.supplierId),
        })),
    [data.supplierProducts, data.suppliers, product]
  );

  const productActivities = useMemo(() => {
    if (!product) return [];
    return data.activities.filter(
      (a) =>
        a.relatedDocumentId === product.id ||
        a.relatedDocumentNumber === product.sku ||
        a.description.includes(product.sku)
    );
  }, [data.activities, product]);

  const warehouseMap = useMemo(
    () => new Map(data.warehouses.map((w) => [w.id, w])),
    [data.warehouses]
  );

  if (!product) {
    return (
      <div className="p-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] text-center space-y-3">
        <p className="text-sm text-slate-500">Requested product record was not found.</p>
        <Link
          href="/dashboard/products"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2563EB] hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Product Catalog</span>
        </Link>
      </div>
    );
  }

  const latestPO = relatedPOs[0];

  return (
    <div className="space-y-6">
      {/* Top Back Link */}
      <div>
        <Link
          href="/dashboard/products"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Product Catalog</span>
        </Link>
      </div>

      {/* Product 360 Header Card */}
      <div className="p-6 rounded-xl border border-[#E2E8F0] dark:border-[#304158] bg-white dark:bg-[#172337] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-xl bg-[#EFF6FF] dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 flex items-center justify-center shrink-0">
            <Package className="w-8 h-8 text-[#2563EB] dark:text-[#60A5FA]" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-mono font-bold text-[#2563EB] dark:text-[#60A5FA]">
                {product.sku}
              </span>
              <span>·</span>
              <span>{category?.name ?? 'Industrial Component'}</span>
              <span>·</span>
              <span>Brand: {product.brand}</span>
              <span>·</span>
              <span>Status: {product.status}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              {product.name}
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-300 max-w-3xl">
              {product.description}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 shrink-0 border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-100 dark:border-slate-800">
          <div className="text-right">
            <div className="text-[11px] text-slate-500">Moving Average Cost</div>
            <div className="text-lg font-bold font-mono tabular-nums">
              {formatCurrency(product.movingAverageCost, settings.defaultCurrency)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-slate-500">Selling Price</div>
            <div className="text-lg font-bold font-mono tabular-nums text-[#059669] dark:text-emerald-400">
              {formatCurrency(product.sellingPrice, settings.defaultCurrency)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setQuickCreateModal('adjustment')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-medium"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Adjust Stock</span>
          </button>
        </div>
      </div>

      {/* 7-Tab Navigation Bar */}
      <div className="flex items-center gap-1 overflow-x-auto p-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337]">
        {(
          [
            { key: 'overview', label: '1. Overview', icon: Boxes },
            { key: 'warehouses', label: '2. Stock by Warehouse', icon: Package },
            { key: 'movements', label: `3. Stock Movements (${productMovements.length})`, icon: History },
            { key: 'purchasing', label: `4. Purchasing (${relatedPOs.length})`, icon: FileText },
            { key: 'suppliers', label: `5. Suppliers (${linkedSuppliers.length})`, icon: Building2 },
            { key: 'barcodes', label: '6. Barcode & Labels', icon: Barcode },
            { key: 'activity', label: '7. Activity', icon: ActivityIcon },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-[#2563EB] text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1F3047]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337]">
              <div className="text-xs text-slate-500">Total On-Hand</div>
              <div className="mt-1 text-xl font-bold font-mono tabular-nums">
                {formatQuantity(totals.onHand)} {product.unitOfMeasure}
              </div>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337]">
              <div className="text-xs text-slate-500">Reserved</div>
              <div className="mt-1 text-xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400">
                {formatQuantity(totals.reserved)} {product.unitOfMeasure}
              </div>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337]">
              <div className="text-xs text-slate-500">Available</div>
              <div className="mt-1 text-xl font-bold font-mono tabular-nums text-[#059669] dark:text-emerald-400">
                {formatQuantity(totals.available)} {product.unitOfMeasure}
              </div>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337]">
              <div className="text-xs text-slate-500">Reorder Point</div>
              <div className="mt-1 text-xl font-bold font-mono tabular-nums">
                {formatQuantity(product.reorderPoint)} {product.unitOfMeasure}
              </div>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337]">
              <div className="text-xs text-slate-500">Inventory Value</div>
              <div className="mt-1 text-xl font-bold font-mono tabular-nums text-[#2563EB] dark:text-[#60A5FA]">
                {formatCurrency(totals.value, settings.defaultCurrency)}
              </div>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337]">
              <div className="text-xs text-slate-500">Latest Purchase</div>
              <div className="mt-1 text-sm font-bold font-mono">
                {latestPO ? latestPO.poNumber : 'No PO yet'}
              </div>
              <div className="text-[11px] text-slate-400">
                {latestPO ? formatDateShort(latestPO.orderDate) : '—'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] space-y-3">
              <h2 className="text-sm font-semibold">Master Specification & Accounting</h2>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                <div className="py-2 flex justify-between">
                  <span className="text-slate-500">SKU Identifier</span>
                  <span className="font-mono font-semibold">{product.sku}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-500">Barcode (CODE128)</span>
                  <span className="font-mono">{product.barcode}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-500">Unit of Measure</span>
                  <span>{product.unitOfMeasure}</span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-500">Purchase Cost (Last)</span>
                  <span className="font-mono tabular-nums">
                    {formatCurrency(product.purchaseCost, settings.defaultCurrency)}
                  </span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-500">Moving Weighted Average Cost</span>
                  <span className="font-mono tabular-nums font-semibold">
                    {formatCurrency(product.movingAverageCost, settings.defaultCurrency)}
                  </span>
                </div>
                <div className="py-2 flex justify-between">
                  <span className="text-slate-500">Target Stock Level</span>
                  <span className="font-mono tabular-nums">{product.targetStock}</span>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] space-y-3">
              <h2 className="text-sm font-semibold">
                Configured Product Variants ({product.variants.length})
              </h2>
              {product.variants.length === 0 ? (
                <p className="text-xs text-slate-500 py-6">
                  This item is stocked as a single base SKU without child variants.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                        <th className="py-2 pr-2">Variant SKU</th>
                        <th className="py-2 px-2">Attributes</th>
                        <th className="py-2 px-2 text-right">Cost</th>
                        <th className="py-2 pl-2 text-right">Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {product.variants.map((v) => (
                        <tr key={v.id}>
                          <td className="py-2 pr-2 font-mono font-semibold text-[#2563EB] dark:text-[#60A5FA]">
                            {v.sku}
                          </td>
                          <td className="py-2 px-2 text-slate-600 dark:text-slate-300">
                            {[v.size, v.color, v.packaging].filter(Boolean).join(' · ')}
                          </td>
                          <td className="py-2 px-2 text-right font-mono tabular-nums">
                            {formatCurrency(v.unitCost)}
                          </td>
                          <td className="py-2 pl-2 text-right font-mono tabular-nums">
                            {formatCurrency(v.sellingPrice)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: STOCK BY WAREHOUSE */}
      {activeTab === 'warehouses' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Stock Balances Across Active Warehouses</h2>
            <span className="text-xs text-slate-500">
              Total Valuation: {formatCurrency(totals.value, settings.defaultCurrency)}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-[#111B2C]/60 text-slate-500">
                  <th className="py-3 px-4">Warehouse</th>
                  <th className="py-3 px-3 text-right">On-Hand Qty</th>
                  <th className="py-3 px-3 text-right">Reserved Qty</th>
                  <th className="py-3 px-3 text-right">Available Qty</th>
                  <th className="py-3 px-3 text-right">In-Transit In</th>
                  <th className="py-3 px-3 text-right">Reorder Point</th>
                  <th className="py-3 px-3">Stock Status</th>
                  <th className="py-3 px-4 text-right">Warehouse Valuation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {productBalances.map((b) => (
                  <tr key={b.warehouseId} className="hover:bg-slate-50 dark:hover:bg-[#1F3047]/50">
                    <td className="py-3 px-4 font-medium">
                      <span className="font-mono font-bold text-[#2563EB] dark:text-[#60A5FA]">
                        {b.warehouseCode}
                      </span>{' '}
                      · {b.warehouseName}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold">
                      {b.onHandQuantity}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-500">
                      {b.reservedQuantity}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-bold">
                      {b.availableQuantity}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-[#2563EB]">
                      {b.inTransitInbound}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-500">
                      {b.reorderPoint}
                    </td>
                    <td className={`py-3 px-3 ${getStockStatusColorClass(b.stockStatus)}`}>
                      {getStockStatusLabel(b.stockStatus)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                      {formatCurrency(b.totalValue, settings.defaultCurrency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: STOCK MOVEMENTS */}
      {activeTab === 'movements' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-sm font-semibold">
              Chronological Movement Ledger for {product.sku}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-[#111B2C]/60 text-slate-500">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-3">Warehouse</th>
                  <th className="py-3 px-3">Movement Type</th>
                  <th className="py-3 px-3 text-right">Quantity Delta</th>
                  <th className="py-3 px-3 text-right">Before → After</th>
                  <th className="py-3 px-3">Source Document</th>
                  <th className="py-3 px-3">Reason</th>
                  <th className="py-3 px-4">Actor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {productMovements.map((m) => {
                  const wh = warehouseMap.get(m.warehouseId);
                  return (
                    <tr key={m.id}>
                      <td className="py-2.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                        {formatDateTime(m.timestamp)}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {wh ? `${wh.code} · ${wh.name}` : m.warehouseId}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px]">
                        {m.movementType.replace(/_/g, ' ')}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono tabular-nums font-bold ${
                          m.quantityDelta > 0 ? 'text-[#059669]' : 'text-[#DC2626]'
                        }`}
                      >
                        {m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {m.beforeQuantity} → {m.afterQuantity}
                      </td>
                      <td className="py-2.5 px-3 font-mono">{m.sourceReference}</td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                        {m.reason}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500">{m.actor}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: PURCHASING */}
      {activeTab === 'purchasing' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-sm font-semibold">Related Purchase Orders</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-[#111B2C]/60 text-slate-500">
                  <th className="py-3 px-4">PO Number</th>
                  <th className="py-3 px-3">Order Date</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Ordered Qty</th>
                  <th className="py-3 px-3 text-right">Received Qty</th>
                  <th className="py-3 px-3 text-right">Pending Qty</th>
                  <th className="py-3 px-4 text-right">Unit Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {relatedPOs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      No purchase orders found for this SKU yet.
                    </td>
                  </tr>
                ) : (
                  relatedPOs.map((po) => {
                    const line = po.lines.find((l) => l.productId === product.id)!;
                    const pending = Math.max(0, line.quantityOrdered - line.quantityReceived);
                    return (
                      <tr key={po.id}>
                        <td className="py-2.5 px-4 font-mono font-semibold text-[#2563EB] dark:text-[#60A5FA]">
                          <Link href="/dashboard/purchase-orders">{po.poNumber}</Link>
                        </td>
                        <td className="py-2.5 px-3">{formatDateShort(po.orderDate)}</td>
                        <td className="py-2.5 px-3 font-medium">{po.status}</td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {line.quantityOrdered}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#059669]">
                          {line.quantityReceived}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-amber-600">
                          {pending}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                          {formatCurrency(line.unitCost, settings.defaultCurrency)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: SUPPLIERS */}
      {activeTab === 'suppliers' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-sm font-semibold">Approved Suppliers & Vendor SKUs</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-[#111B2C]/60 text-slate-500">
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3">Supplier Product Code</th>
                  <th className="py-3 px-3 text-right">Contract Unit Cost</th>
                  <th className="py-3 px-3 text-right">Lead Time</th>
                  <th className="py-3 px-4 text-right">Min Order Qty (MOQ)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {linkedSuppliers.map((sp) => (
                  <tr key={sp.id}>
                    <td className="py-3 px-4 font-medium">
                      {sp.supplier?.companyName ?? sp.supplierId}
                      <div className="text-[11px] text-slate-500">{sp.supplier?.location}</div>
                    </td>
                    <td className="py-3 px-3 font-medium">
                      {sp.isPreferred ? 'Preferred Vendor' : 'Alternative Vendor'}
                    </td>
                    <td className="py-3 px-3 font-mono">{sp.supplierSku}</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      {formatCurrency(sp.unitCost, settings.defaultCurrency)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      {sp.leadTimeDays} days
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {sp.minimumOrderQuantity} {product.unitOfMeasure}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: BARCODE & LABELS */}
      {activeTab === 'barcodes' && (
        <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold">
                Printable CODE128 Barcode & QR Identification Label
              </h2>
              <p className="text-xs text-slate-500">
                In-app warehouse identification label for {product.sku}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Label</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadBarcodeLabelsPdf([
                    {
                      sku: product.sku,
                      name: product.name,
                      barcode: product.barcode,
                      price: product.sellingPrice,
                      copies: 6,
                    },
                  ])
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-medium"
              >
                <span>Download PDF Sheet (6 Labels)</span>
              </button>
            </div>
          </div>

          <div className="p-6 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-[#111B2C] inline-block space-y-3">
            <div className="text-xs font-bold text-slate-900 dark:text-white">
              {product.name}
            </div>
            <div className="text-xs font-mono text-slate-500">
              SKU: {product.sku} · Price: {formatCurrency(product.sellingPrice)}
            </div>
            <BarcodeDisplay
              value={product.sku}
              qrPayload={JSON.stringify({ id: product.id, sku: product.sku })}
              mode="both"
            />
          </div>
        </div>
      )}

      {/* TAB 7: ACTIVITY */}
      {activeTab === 'activity' && (
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] space-y-4">
          <h2 className="text-sm font-semibold">Operational Activity Log for {product.sku}</h2>
          <div className="space-y-3">
            {productActivities.length === 0 && productMovements.length === 0 ? (
              <p className="text-xs text-slate-500">No recorded events yet.</p>
            ) : (
              productMovements.slice(0, 12).map((m) => (
                <div
                  key={m.id}
                  className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-medium">
                      {m.movementType.replace(/_/g, ' ')} ({m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta})
                    </div>
                    <div className="text-slate-500">{m.reason} · Ref: {m.sourceReference}</div>
                  </div>
                  <div className="text-right font-mono text-slate-400">
                    <div>{formatDateTime(m.timestamp)}</div>
                    <div>{m.actor}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
