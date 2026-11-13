'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { useStockoraStore } from '@/stores/useStockoraStore';
import { AdjustmentReason } from '@/types/erp';
import { getWarehouseOnHandFromLedger } from '@/lib/inventory-engine';

export function QuickActionModals() {
  const {
    quickCreateModal,
    setQuickCreateModal,
    data,
    addProduct,
    addSupplier,
    createPO,
    createTransfer,
    recordAdjustment,
    receiveGoodsAgainstPO,
  } = useStockoraStore();

  // Product Form State
  const [prodSku, setProdSku] = useState('');
  const [prodName, setProdName] = useState('');
  const [prodCategory, setProdCategory] = useState(data.categories[0]?.id ?? 'cat-01');
  const [prodBrand, setProdBrand] = useState('');
  const [prodUom, setProdUom] = useState('pcs');
  const [prodCost, setProdCost] = useState('45.00');
  const [prodPrice, setProdPrice] = useState('79.00');
  const [prodReorder, setProdReorder] = useState('25');
  const [prodTarget, setProdTarget] = useState('100');
  const [prodSupplier, setProdSupplier] = useState(data.suppliers[0]?.id ?? 'sup-01');
  const [prodInitWh, setProdInitWh] = useState(data.warehouses[0]?.id ?? 'wh-01');
  const [prodInitQty, setProdInitQty] = useState('20');

  // Supplier Form State
  const [supCode, setSupCode] = useState(`SUP-${150 + data.suppliers.length}`);
  const [supCompany, setSupCompany] = useState('');
  const [supContact, setSupContact] = useState('');
  const [supEmail, setSupEmail] = useState('');
  const [supPhone, setSupPhone] = useState('+1 (800) 555-0199');
  const [supLocation, setSupLocation] = useState('Chicago, IL');
  const [supTerms, setSupTerms] = useState('Net 30');

  // PO Form State
  const [poSupplierId, setPoSupplierId] = useState(data.suppliers[0]?.id ?? 'sup-01');
  const [poWarehouseId, setPoWarehouseId] = useState(data.warehouses[0]?.id ?? 'wh-01');
  const [poProductId, setPoProductId] = useState(data.products[0]?.id ?? 'prd-001');
  const [poQty, setPoQty] = useState('25');
  const [poCost, setPoCost] = useState(String(data.products[0]?.purchaseCost ?? 100));
  const [poNotes, setPoNotes] = useState('Urgent replenishment order');

  // Transfer Form State
  const [trfSource, setTrfSource] = useState(data.warehouses[0]?.id ?? 'wh-01');
  const [trfDest, setTrfDest] = useState(data.warehouses[1]?.id ?? 'wh-02');
  const [trfProduct, setTrfProduct] = useState(data.products[0]?.id ?? 'prd-001');
  const [trfQty, setTrfQty] = useState('5');
  const [trfDispatchNow, setTrfDispatchNow] = useState(true);
  const [trfNotes, setTrfNotes] = useState('Inter-warehouse stock balancing');

  // Adjustment Form State
  const [adjWh, setAdjWh] = useState(data.warehouses[0]?.id ?? 'wh-01');
  const [adjProduct, setAdjProduct] = useState(data.products[0]?.id ?? 'prd-001');
  const [adjType, setAdjType] = useState<'POSITIVE' | 'NEGATIVE'>('POSITIVE');
  const [adjQty, setAdjQty] = useState('5');
  const [adjReason, setAdjReason] = useState<AdjustmentReason>('Stock Count Correction');
  const [adjNotes, setAdjNotes] = useState('');

  // Quick Receive State
  const openPOs = data.purchaseOrders.filter(
    (p) => p.status === 'ORDERED' || p.status === 'PARTIALLY_RECEIVED'
  );
  const [recPoId, setRecPoId] = useState(openPOs[0]?.id ?? '');

  if (!quickCreateModal) return null;

  const close = () => setQuickCreateModal(null);

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const res = addProduct({
      sku: prodSku,
      barcode: `890425${String(Date.now()).slice(-6)}`,
      name: prodName,
      categoryId: prodCategory,
      brand: prodBrand || 'Stockora Pro',
      description: `${prodName} — industrial specification component.`,
      unitOfMeasure: prodUom,
      purchaseCost: Number(prodCost),
      sellingPrice: Number(prodPrice),
      preferredSupplierId: prodSupplier,
      status: 'ACTIVE',
      reorderPoint: Number(prodReorder),
      targetStock: Number(prodTarget),
      initialWarehouseId: prodInitWh,
      initialQuantity: Number(prodInitQty),
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Product ${prodSku.toUpperCase()} created successfully.`);
    setProdSku('');
    setProdName('');
    close();
  };

  const handleCreateSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supCompany.trim()) {
      toast.error('Company name is required.');
      return;
    }
    const res = addSupplier({
      code: supCode,
      companyName: supCompany,
      contactName: supContact || 'Purchasing Desk',
      email: supEmail || 'orders@supplier.example.com',
      phone: supPhone,
      location: supLocation,
      status: 'ACTIVE',
      preferredCategoryIds: [data.categories[0]?.id ?? 'cat-01'],
      paymentTerms: supTerms,
      rating: 4.8,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Supplier ${supCompany} added to directory.`);
    setSupCompany('');
    close();
  };

  const handleCreatePO = (e: React.FormEvent) => {
    e.preventDefault();
    const res = createPO({
      supplierId: poSupplierId,
      warehouseId: poWarehouseId,
      orderDate: new Date().toISOString(),
      expectedDeliveryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      status: 'ORDERED',
      shippingCharges: 75,
      notes: poNotes,
      lines: [
        {
          productId: poProductId,
          quantityOrdered: Number(poQty),
          unitCost: Number(poCost),
          discountAmount: 0,
          taxRate: 8.25,
        },
      ],
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success('Purchase Order created and issued.');
    close();
  };

  const handleCreateTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const res = createTransfer({
      sourceWarehouseId: trfSource,
      destinationWarehouseId: trfDest,
      lines: [{ productId: trfProduct, quantity: Number(trfQty) }],
      referenceNotes: trfNotes,
      dispatchImmediately: trfDispatchNow,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      trfDispatchNow
        ? 'Stock transfer created and dispatched into transit.'
        : 'Draft stock transfer created.'
    );
    close();
  };

  const handleCreateAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    const res = recordAdjustment({
      warehouseId: adjWh,
      productId: adjProduct,
      adjustmentType: adjType,
      quantity: Number(adjQty),
      reason: adjReason,
      notes: adjNotes || 'Quick adjustment via topbar',
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success('Inventory adjustment posted to movement ledger.');
    close();
  };

  const handleQuickReceive = (e: React.FormEvent) => {
    e.preventDefault();
    const targetPo = openPOs.find((p) => p.id === recPoId) ?? openPOs[0];
    if (!targetPo) {
      toast.error('No open purchase order selected.');
      return;
    }
    const lines = targetPo.lines
      .map((l) => ({
        poLineId: l.id,
        acceptedQuantity: Math.max(0, l.quantityOrdered - l.quantityReceived),
        rejectedQuantity: 0,
      }))
      .filter((l) => l.acceptedQuantity > 0);

    const res = receiveGoodsAgainstPO({
      poId: targetPo.id,
      warehouseId: targetPo.warehouseId,
      notes: 'Full remaining receipt via Quick Receive modal',
      lines,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Goods received for ${targetPo.poNumber} and added to warehouse stock.`);
    close();
  };

  const currentAdjBalance = getWarehouseOnHandFromLedger(
    data.stockMovements,
    adjProduct,
    adjWh
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      onClick={close}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {quickCreateModal === 'product' && 'Quick Create Product'}
            {quickCreateModal === 'supplier' && 'Quick Add Supplier'}
            {quickCreateModal === 'po' && 'Quick Create Purchase Order'}
            {quickCreateModal === 'transfer' && 'Quick Inter-Warehouse Transfer'}
            {quickCreateModal === 'adjustment' && 'Quick Inventory Adjustment'}
            {quickCreateModal === 'receive' && 'Quick Goods Receipt (GRN)'}
          </h2>
          <button
            onClick={close}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {quickCreateModal === 'product' && (
          <form onSubmit={handleCreateProduct} className="p-5 space-y-3.5 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  SKU Identifier *
                </label>
                <input
                  required
                  value={prodSku}
                  onChange={(e) => setProdSku(e.target.value)}
                  placeholder="e.g. SNS-VG-900"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C] font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Brand
                </label>
                <input
                  value={prodBrand}
                  onChange={(e) => setProdBrand(e.target.value)}
                  placeholder="Vanguard"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Product Name *
              </label>
              <input
                required
                value={prodName}
                onChange={(e) => setProdName(e.target.value)}
                placeholder="Optical Proximity Sensor M12"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={prodCategory}
                  onChange={(e) => setProdCategory(e.target.value)}
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
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Preferred Supplier
                </label>
                <select
                  value={prodSupplier}
                  onChange={(e) => setProdSupplier(e.target.value)}
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
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Unit Cost ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={prodCost}
                  onChange={(e) => setProdCost(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C] tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Selling Price ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={prodPrice}
                  onChange={(e) => setProdPrice(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C] tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Unit (UOM)
                </label>
                <input
                  value={prodUom}
                  onChange={(e) => setProdUom(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100 dark:border-slate-800">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Opening Stock Warehouse
                </label>
                <select
                  value={prodInitWh}
                  onChange={(e) => setProdInitWh(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                >
                  {data.warehouses
                    .filter((w) => w.status === 'ACTIVE')
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Opening Stock Qty
                </label>
                <input
                  type="number"
                  min="0"
                  value={prodInitQty}
                  onChange={(e) => setProdInitQty(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C] tabular-nums"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Reorder Point
                </label>
                <input
                  type="number"
                  min="0"
                  value={prodReorder}
                  onChange={(e) => setProdReorder(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C] tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Target Stock
                </label>
                <input
                  type="number"
                  min="1"
                  value={prodTarget}
                  onChange={(e) => setProdTarget(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C] tabular-nums"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={close}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-medium"
              >
                Create Product
              </button>
            </div>
          </form>
        )}

        {quickCreateModal === 'supplier' && (
          <form onSubmit={handleCreateSupplier} className="p-5 space-y-3.5 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Supplier Code *
                </label>
                <input
                  required
                  value={supCode}
                  onChange={(e) => setSupCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C] font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Payment Terms
                </label>
                <input
                  value={supTerms}
                  onChange={(e) => setSupTerms(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Company Name *
              </label>
              <input
                required
                value={supCompany}
                onChange={(e) => setSupCompany(e.target.value)}
                placeholder="Apex Industrial Components LLC"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Contact Name
                </label>
                <input
                  value={supContact}
                  onChange={(e) => setSupContact(e.target.value)}
                  placeholder="Jordan Hayes"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Business Email
                </label>
                <input
                  type="email"
                  value={supEmail}
                  onChange={(e) => setSupEmail(e.target.value)}
                  placeholder="orders@apex.example.com"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Phone
                </label>
                <input
                  value={supPhone}
                  onChange={(e) => setSupPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Location
                </label>
                <input
                  value={supLocation}
                  onChange={(e) => setSupLocation(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={close}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-medium"
              >
                Save Supplier
              </button>
            </div>
          </form>
        )}

        {quickCreateModal === 'po' && (
          <form onSubmit={handleCreatePO} className="p-5 space-y-3.5 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Supplier
                </label>
                <select
                  value={poSupplierId}
                  onChange={(e) => setPoSupplierId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                >
                  {data.suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.companyName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Destination Warehouse
                </label>
                <select
                  value={poWarehouseId}
                  onChange={(e) => setPoWarehouseId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                >
                  {data.warehouses
                    .filter((w) => w.status === 'ACTIVE')
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Product SKU
              </label>
              <select
                value={poProductId}
                onChange={(e) => {
                  setPoProductId(e.target.value);
                  const found = data.products.find((p) => p.id === e.target.value);
                  if (found) setPoCost(String(found.purchaseCost));
                }}
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
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Quantity Ordered
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={poQty}
                  onChange={(e) => setPoQty(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C] tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Unit Cost ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={poCost}
                  onChange={(e) => setPoCost(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C] tabular-nums"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Order Notes
              </label>
              <input
                value={poNotes}
                onChange={(e) => setPoNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={close}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-medium"
              >
                Issue Purchase Order
              </button>
            </div>
          </form>
        )}

        {quickCreateModal === 'transfer' && (
          <form onSubmit={handleCreateTransfer} className="p-5 space-y-3.5 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Source Warehouse
                </label>
                <select
                  value={trfSource}
                  onChange={(e) => setTrfSource(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                >
                  {data.warehouses
                    .filter((w) => w.status === 'ACTIVE')
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Destination Warehouse
                </label>
                <select
                  value={trfDest}
                  onChange={(e) => setTrfDest(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                >
                  {data.warehouses
                    .filter((w) => w.status === 'ACTIVE')
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Product
              </label>
              <select
                value={trfProduct}
                onChange={(e) => setTrfProduct(e.target.value)}
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
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Quantity to Transfer
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={trfQty}
                  onChange={(e) => setTrfQty(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C] tabular-nums"
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={trfDispatchNow}
                    onChange={(e) => setTrfDispatchNow(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span>Dispatch immediately (In Transit)</span>
                </label>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Reference Notes
              </label>
              <input
                value={trfNotes}
                onChange={(e) => setTrfNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={close}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-medium"
              >
                Create Transfer
              </button>
            </div>
          </form>
        )}

        {quickCreateModal === 'adjustment' && (
          <form onSubmit={handleCreateAdjustment} className="p-5 space-y-3.5 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Warehouse
                </label>
                <select
                  value={adjWh}
                  onChange={(e) => setAdjWh(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                >
                  {data.warehouses
                    .filter((w) => w.status === 'ACTIVE')
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Adjustment Type
                </label>
                <select
                  value={adjType}
                  onChange={(e) => setAdjType(e.target.value as 'POSITIVE' | 'NEGATIVE')}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                >
                  <option value="POSITIVE">Positive (+ Add Stock)</option>
                  <option value="NEGATIVE">Negative (- Remove Stock)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Product
              </label>
              <select
                value={adjProduct}
                onChange={(e) => setAdjProduct(e.target.value)}
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
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#111B2C] border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
              <span>Current On-Hand: <strong className="tabular-nums">{currentAdjBalance}</strong></span>
              <span>
                New Balance Preview:{' '}
                <strong className="tabular-nums">
                  {adjType === 'POSITIVE'
                    ? currentAdjBalance + Number(adjQty || 0)
                    : currentAdjBalance - Number(adjQty || 0)}
                </strong>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Quantity Delta
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={adjQty}
                  onChange={(e) => setAdjQty(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C] tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Reason
                </label>
                <select
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value as AdjustmentReason)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                >
                  <option value="Stock Count Correction">Stock Count Correction</option>
                  <option value="Damaged">Damaged</option>
                  <option value="Lost">Lost</option>
                  <option value="Found">Found</option>
                  <option value="Expired">Expired</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Audit Notes
              </label>
              <input
                value={adjNotes}
                onChange={(e) => setAdjNotes(e.target.value)}
                placeholder="Cycle count reference or inspection note"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={close}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-medium"
              >
                Confirm & Post Adjustment
              </button>
            </div>
          </form>
        )}

        {quickCreateModal === 'receive' && (
          <form onSubmit={handleQuickReceive} className="p-5 space-y-4 text-sm">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Select Open Purchase Order
              </label>
              <select
                value={recPoId}
                onChange={(e) => setRecPoId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
              >
                {openPOs.map((po) => (
                  <option key={po.id} value={po.id}>
                    {po.poNumber} ({po.status}) — Total ${po.totalAmount.toFixed(2)}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Posting this quick receipt will accept all outstanding quantities on the selected PO into its assigned warehouse and generate a Goods Receipt Note (GRN). For partial or damaged/rejected quantities, use the full Goods Receiving Workspace.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={close}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={openPOs.length === 0}
                className="px-4 py-2 rounded-lg bg-[#059669] hover:bg-emerald-700 text-white text-xs font-medium disabled:opacity-50"
              >
                Confirm Goods Receipt
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
