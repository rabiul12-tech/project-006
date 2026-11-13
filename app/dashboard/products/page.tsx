'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Archive,
  Edit3,
  Eye,
  Grid,
  List,
  Package,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { useStockoraStore } from '@/stores/useStockoraStore';
import { deriveInventoryBalances } from '@/lib/inventory-engine';
import {
  formatCurrency,
  formatQuantity,
  getStockStatusColorClass,
  getStockStatusLabel,
} from '@/lib/formatters';
import { Product, ProductVariant } from '@/types/erp';
import { BarcodeDisplay } from '@/components/ui/BarcodeDisplay';

export default function ProductsCatalogPage() {
  const { data, settings, addProduct, updateProduct, archiveProduct } = useStockoraStore();

  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'ARCHIVED'>('ACTIVE');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 16;

  // Product Drawer & Edit/Create Modal
  const [drawerProduct, setDrawerProduct] = useState<Product | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form fields
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState(data.categories[0]?.id ?? 'cat-01');
  const [brand, setBrand] = useState('');
  const [description, setDescription] = useState('');
  const [unitOfMeasure, setUnitOfMeasure] = useState('pcs');
  const [purchaseCost, setPurchaseCost] = useState('50.00');
  const [sellingPrice, setSellingPrice] = useState('85.00');
  const [preferredSupplierId, setPreferredSupplierId] = useState(data.suppliers[0]?.id ?? 'sup-01');
  const [reorderPoint, setReorderPoint] = useState('25');
  const [targetStock, setTargetStock] = useState('100');
  const [initWhId, setInitWhId] = useState(data.warehouses[0]?.id ?? 'wh-01');
  const [initQty, setInitQty] = useState('25');
  const [variants, setVariants] = useState<ProductVariant[]>([]);

  const allBalances = useMemo(() => deriveInventoryBalances(data), [data]);

  const productStockSummary = useMemo(() => {
    const map = new Map<
      string,
      { onHand: number; reserved: number; available: number; value: number }
    >();
    for (const b of allBalances) {
      const curr = map.get(b.productId) ?? { onHand: 0, reserved: 0, available: 0, value: 0 };
      curr.onHand += b.onHandQuantity;
      curr.reserved += b.reservedQuantity;
      curr.available += b.availableQuantity;
      curr.value += b.totalValue;
      map.set(b.productId, curr);
    }
    return map;
  }, [allBalances]);

  const categoryMap = useMemo(
    () => new Map(data.categories.map((c) => [c.id, c.name])),
    [data.categories]
  );
  const supplierMap = useMemo(
    () => new Map(data.suppliers.map((s) => [s.id, s.companyName])),
    [data.suppliers]
  );

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.products
      .filter((p) => statusFilter === 'ALL' || p.status === statusFilter)
      .filter((p) => categoryFilter === 'ALL' || p.categoryId === categoryFilter)
      .filter(
        (p) =>
          !q ||
          p.sku.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.barcode.toLowerCase().includes(q)
      );
  }, [data.products, statusFilter, categoryFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedProducts = filteredProducts.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  const openCreateModal = () => {
    setEditingProduct(null);
    setSku('');
    setBarcode(`890425${String(Date.now()).slice(-6)}`);
    setName('');
    setCategoryId(data.categories[0]?.id ?? 'cat-01');
    setBrand('KronoTech');
    setDescription('');
    setUnitOfMeasure('pcs');
    setPurchaseCost('65.00');
    setSellingPrice('110.00');
    setPreferredSupplierId(data.suppliers[0]?.id ?? 'sup-01');
    setReorderPoint('25');
    setTargetStock('90');
    setInitQty('20');
    setVariants([]);
    setModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setSku(product.sku);
    setBarcode(product.barcode);
    setName(product.name);
    setCategoryId(product.categoryId);
    setBrand(product.brand);
    setDescription(product.description);
    setUnitOfMeasure(product.unitOfMeasure);
    setPurchaseCost(String(product.purchaseCost));
    setSellingPrice(String(product.sellingPrice));
    setPreferredSupplierId(product.preferredSupplierId);
    setReorderPoint(String(product.reorderPoint));
    setTargetStock(String(product.targetStock));
    setVariants(product.variants ?? []);
    setModalOpen(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct) {
      const res = updateProduct(editingProduct.id, {
        sku,
        barcode,
        name,
        categoryId,
        brand,
        description,
        unitOfMeasure,
        purchaseCost: Number(purchaseCost),
        sellingPrice: Number(sellingPrice),
        preferredSupplierId,
        reorderPoint: Number(reorderPoint),
        targetStock: Number(targetStock),
        variants,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Updated product ${sku.toUpperCase()} without altering historical ledger records.`);
      setModalOpen(false);
    } else {
      const res = addProduct({
        sku,
        barcode,
        name,
        categoryId,
        brand,
        description: description || `${name} — industrial specification component.`,
        unitOfMeasure,
        purchaseCost: Number(purchaseCost),
        sellingPrice: Number(sellingPrice),
        preferredSupplierId,
        status: 'ACTIVE',
        reorderPoint: Number(reorderPoint),
        targetStock: Number(targetStock),
        initialWarehouseId: initWhId,
        initialQuantity: Number(initQty),
        variants,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Product ${sku.toUpperCase()} created.`);
      setModalOpen(false);
    }
  };

  const handleAddVariantRow = () => {
    const idx = variants.length + 1;
    setVariants([
      ...variants,
      {
        id: `var-new-${Date.now()}-${idx}`,
        productId: editingProduct?.id ?? 'pending',
        sku: `${sku || 'SKU'}-V${idx}`,
        barcode: `${barcode || '890425'}${idx}`,
        name: `${name || 'Variant'} Option ${idx}`,
        size: 'Standard',
        color: 'Gray',
        packaging: 'Single Box',
        unitCost: Number(purchaseCost) || 50,
        sellingPrice: Number(sellingPrice) || 85,
        status: 'ACTIVE',
      },
    ]);
  };

  const handleBulkArchive = () => {
    if (!selectedIds.length) return;
    selectedIds.forEach((id) => archiveProduct(id));
    toast.success(`Archived ${selectedIds.length} selected products.`);
    setSelectedIds([]);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Product & Variant Catalog
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage master SKUs, stocked variants, moving average costs, and supplier links
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 rounded-lg bg-slate-100 dark:bg-[#111B2C] border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-[#172337] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500'
              }`}
              aria-label="List view"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-[#172337] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500'
              }`}
              aria-label="Grid view"
            >
              <Grid className="w-4 h-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Product</span>
          </button>
        </div>
      </div>

      {/* Filters & Bulk Actions Bar */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search SKU, product name, barcode, or brand..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#111B2C] text-xs focus:outline-none"
            />
          </div>

          <select
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
            {(['ACTIVE', 'ARCHIVED', 'ALL'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => {
                  setStatusFilter(st);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-md font-medium ${
                  statusFilter === st
                    ? 'bg-white dark:bg-[#172337] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                {st === 'ALL' ? 'All' : st === 'ACTIVE' ? 'Active' : 'Archived'}
              </button>
            ))}
          </div>
        </div>

        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              {selectedIds.length} selected
            </span>
            <button
              type="button"
              onClick={handleBulkArchive}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Archive Selected</span>
            </button>
          </div>
        )}
      </div>

      {/* List View or Grid View */}
      {viewMode === 'list' ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-[#111B2C]/60 text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4 w-8">
                    <input
                      type="checkbox"
                      aria-label="Select all products on page"
                      checked={
                        paginatedProducts.length > 0 &&
                        paginatedProducts.every((p) => selectedIds.includes(p.id))
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(paginatedProducts.map((p) => p.id));
                        } else {
                          setSelectedIds([]);
                        }
                      }}
                    />
                  </th>
                  <th className="py-3 px-3 font-semibold">SKU & Barcode</th>
                  <th className="py-3 px-3 font-semibold">Product Name</th>
                  <th className="py-3 px-3 font-semibold">Category</th>
                  <th className="py-3 px-3 font-semibold">Preferred Supplier</th>
                  <th className="py-3 px-3 font-semibold text-right">Available</th>
                  <th className="py-3 px-3 font-semibold text-right">Avg Cost</th>
                  <th className="py-3 px-3 font-semibold text-right">Selling Price</th>
                  <th className="py-3 px-3 font-semibold">Variants</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedProducts.map((product) => {
                  const summary = productStockSummary.get(product.id) ?? {
                    onHand: 0,
                    reserved: 0,
                    available: 0,
                    value: 0,
                  };
                  const status =
                    summary.available <= 0
                      ? 'OUT_OF_STOCK'
                      : summary.available <= product.reorderPoint
                        ? 'LOW_STOCK'
                        : 'IN_STOCK';
                  return (
                    <tr
                      key={product.id}
                      className="hover:bg-slate-50 dark:hover:bg-[#1F3047]/50 transition-colors"
                    >
                      <td className="py-2.5 px-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(product.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds((prev) => [...prev, product.id]);
                            } else {
                              setSelectedIds((prev) => prev.filter((id) => id !== product.id));
                            }
                          }}
                        />
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <Link
                          href={`/dashboard/products/${product.id}`}
                          className="font-mono font-semibold text-[#2563EB] dark:text-[#60A5FA] hover:underline"
                        >
                          {product.sku}
                        </Link>
                        <div className="text-[11px] font-mono text-slate-400">
                          {product.barcode}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <Link
                          href={`/dashboard/products/${product.id}`}
                          className="font-medium text-slate-900 dark:text-slate-100 hover:text-[#2563EB]"
                        >
                          {product.name}
                        </Link>
                        <div className="text-[11px] text-slate-500">
                          {product.brand} · {product.unitOfMeasure}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                        {categoryMap.get(product.categoryId) ?? 'Uncategorized'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 truncate max-w-[160px]">
                        {supplierMap.get(product.preferredSupplierId) ?? '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        <span className="font-bold">{formatQuantity(summary.available)}</span>
                        <span className={`ml-1.5 text-[11px] ${getStockStatusColorClass(status)}`}>
                          ({getStockStatusLabel(status)})
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {formatCurrency(product.movingAverageCost, settings.defaultCurrency)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-medium">
                        {formatCurrency(product.sellingPrice, settings.defaultCurrency)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-500">
                        {product.variants.length > 0 ? `${product.variants.length} SKUs` : 'Base'}
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setDrawerProduct(product)}
                            className="p-1.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-[#1F3047]"
                            title="Quick Drawer Preview"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(product)}
                            className="p-1.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-[#1F3047]"
                            title="Edit Product"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <Link
                            href={`/dashboard/products/${product.id}`}
                            className="px-2 py-1 rounded bg-[#EFF6FF] dark:bg-blue-950/60 text-[#2563EB] dark:text-[#60A5FA] font-medium text-[11px]"
                          >
                            360° View
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing {paginatedProducts.length} of {filteredProducts.length} products
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
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {paginatedProducts.map((product) => {
            const summary = productStockSummary.get(product.id) ?? {
              onHand: 0,
              reserved: 0,
              available: 0,
              value: 0,
            };
            return (
              <div
                key={product.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-[#2563EB] dark:text-[#60A5FA]">
                      {product.sku}
                    </span>
                    <span className="text-slate-400 font-mono text-[11px]">{product.brand}</span>
                  </div>
                  <Link
                    href={`/dashboard/products/${product.id}`}
                    className="block text-sm font-semibold text-slate-900 dark:text-white hover:text-[#2563EB] line-clamp-2"
                  >
                    {product.name}
                  </Link>
                  <div className="text-xs text-slate-500">
                    {categoryMap.get(product.categoryId)}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Available Stock:</span>
                    <span className="font-mono font-bold tabular-nums">
                      {summary.available} {product.unitOfMeasure}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Avg Cost / Price:</span>
                    <span className="font-mono tabular-nums">
                      {formatCurrency(product.movingAverageCost)} / {formatCurrency(product.sellingPrice)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(product)}
                      className="text-xs text-slate-600 dark:text-slate-300 hover:underline"
                    >
                      Edit
                    </button>
                    <Link
                      href={`/dashboard/products/${product.id}`}
                      className="text-xs font-semibold text-[#2563EB] dark:text-[#60A5FA] hover:underline"
                    >
                      Open 360° View →
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Product Details Slide-Out Drawer */}
      {drawerProduct && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-xs"
          onClick={() => setDrawerProduct(null)}
        >
          <div
            className="w-full max-w-md h-full bg-white dark:bg-[#172337] border-l border-slate-200 dark:border-slate-700 p-6 overflow-y-auto space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs font-mono font-bold text-[#2563EB] dark:text-[#60A5FA]">
                  {drawerProduct.sku}
                </div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                  {drawerProduct.name}
                </h2>
              </div>
              <button
                onClick={() => setDrawerProduct(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {drawerProduct.description}
            </p>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              <div className="py-2 flex justify-between">
                <span className="text-slate-500">Category</span>
                <span className="font-medium">{categoryMap.get(drawerProduct.categoryId)}</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-slate-500">Brand / UOM</span>
                <span className="font-medium">
                  {drawerProduct.brand} · {drawerProduct.unitOfMeasure}
                </span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-slate-500">Moving Average Cost</span>
                <span className="font-mono font-semibold">
                  {formatCurrency(drawerProduct.movingAverageCost, settings.defaultCurrency)}
                </span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-slate-500">Selling Price</span>
                <span className="font-mono font-semibold">
                  {formatCurrency(drawerProduct.sellingPrice, settings.defaultCurrency)}
                </span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-slate-500">Reorder Point / Target</span>
                <span className="font-mono">
                  {drawerProduct.reorderPoint} / {drawerProduct.targetStock}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold">CODE128 & QR Identification</div>
              <BarcodeDisplay value={drawerProduct.sku} mode="both" height={38} />
            </div>

            <div className="flex items-center gap-2 pt-3">
              <Link
                href={`/dashboard/products/${drawerProduct.id}`}
                className="flex-1 text-center py-2 px-3 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-medium"
              >
                Launch Full Product 360° Workspace
              </Link>
              <button
                type="button"
                onClick={() => {
                  const target = drawerProduct;
                  setDrawerProduct(null);
                  openEditModal(target);
                }}
                className="py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium"
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Product Modal with Variants Support */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                {editingProduct ? `Edit Product · ${editingProduct.sku}` : 'Create New Product & Variants'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="p-1 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium mb-1">SKU (Unique) *</label>
                  <input
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="PLC-KR-950"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C] font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Barcode (CODE128)</label>
                  <input
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C] font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Brand</label>
                  <input
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-medium mb-1">Product Name *</label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Unit of Measure</label>
                  <select
                    value={unitOfMeasure}
                    onChange={(e) => setUnitOfMeasure(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                  >
                    {settings.unitsOfMeasure.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Category</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                  >
                    {data.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Preferred Supplier</label>
                  <select
                    value={preferredSupplierId}
                    onChange={(e) => setPreferredSupplierId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                  >
                    {data.suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.companyName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1">Technical Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-medium mb-1">Purchase Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={purchaseCost}
                    onChange={(e) => setPurchaseCost(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C] font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Selling Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C] font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Reorder Point</label>
                  <input
                    type="number"
                    min="0"
                    value={reorderPoint}
                    onChange={(e) => setReorderPoint(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C] font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Target Stock</label>
                  <input
                    type="number"
                    min="1"
                    value={targetStock}
                    onChange={(e) => setTargetStock(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C] font-mono tabular-nums"
                  />
                </div>
              </div>

              {!editingProduct && (
                <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-slate-50 dark:bg-[#111B2C] border border-slate-200 dark:border-slate-700">
                  <div>
                    <label className="block font-medium mb-1">Opening Stock Warehouse</label>
                    <select
                      value={initWhId}
                      onChange={(e) => setInitWhId(e.target.value)}
                      className="w-full px-3 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337]"
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
                    <label className="block font-medium mb-1">Opening Stock Quantity</label>
                    <input
                      type="number"
                      min="0"
                      value={initQty}
                      onChange={(e) => setInitQty(e.target.value)}
                      className="w-full px-3 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] font-mono tabular-nums"
                    />
                  </div>
                </div>
              )}

              {/* Variants Section */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">
                    Product Variants (Size / Color / Packaging)
                  </span>
                  <button
                    type="button"
                    onClick={handleAddVariantRow}
                    className="text-[#2563EB] dark:text-[#60A5FA] font-medium hover:underline"
                  >
                    + Add Variant SKU
                  </button>
                </div>
                {variants.map((v, idx) => (
                  <div
                    key={v.id}
                    className="grid grid-cols-5 gap-2 items-center bg-slate-50 dark:bg-[#111B2C] p-2 rounded-lg"
                  >
                    <input
                      value={v.sku}
                      onChange={(e) =>
                        setVariants((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, sku: e.target.value } : item))
                        )
                      }
                      placeholder="Variant SKU"
                      className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] font-mono"
                    />
                    <input
                      value={v.size || ''}
                      onChange={(e) =>
                        setVariants((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, size: e.target.value } : item))
                        )
                      }
                      placeholder="Size"
                      className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337]"
                    />
                    <input
                      value={v.color || ''}
                      onChange={(e) =>
                        setVariants((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, color: e.target.value } : item))
                        )
                      }
                      placeholder="Color"
                      className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337]"
                    />
                    <input
                      value={v.packaging || ''}
                      onChange={(e) =>
                        setVariants((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, packaging: e.target.value } : item
                          )
                        )
                      }
                      placeholder="Packaging"
                      className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337]"
                    />
                    <button
                      type="button"
                      onClick={() => setVariants((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-rose-600 text-right pr-2 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white font-medium"
                >
                  {editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
