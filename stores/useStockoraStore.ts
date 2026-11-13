'use client';

import { create } from 'zustand';
import {
  AdjustmentReason,
  Product,
  ProductCategory,
  PurchaseOrderStatus,
  SavedReport,
  StockoraData,
  Supplier,
  Warehouse,
  WorkspaceSettings,
} from '@/types/erp';
import { DEFAULT_WORKSPACE_SETTINGS, generateDeterministicSeedData } from '@/lib/seed';
import {
  loadStockoraFromStorage,
  restoreStockoraBackupJson,
  saveStockoraToStorage,
   STORAGE_KEYS,
} from '@/lib/storage';
import {
  canArchiveWarehouse,
  cancelStockTransfer,
  createPurchaseOrder,
  createStockReservation,
  createStockTransfer,
  dispatchStockTransfer,
  EngineResult,
  postGoodsReceipt,
  postOpeningStock,
  postStockAdjustment,
  receiveStockTransfer,
  releaseStockReservation,
  reversePostedMovement,
} from '@/lib/inventory-engine';

interface StockoraStoreState {
  hydrated: boolean;
  data: StockoraData;
  settings: WorkspaceSettings;
  selectedWarehouseId: string; // 'ALL' or specific warehouseId
  theme: 'light' | 'dark';
  sidebarCollapsed: boolean;
  globalSearchOpen: boolean;
  quickCreateModal:
    | null
    | 'product'
    | 'supplier'
    | 'po'
    | 'receive'
    | 'transfer'
    | 'adjustment';

  // Initialization & UI actions
  hydrate: () => void;
  setSelectedWarehouseId: (warehouseId: string) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setGlobalSearchOpen: (open: boolean) => void;
  setQuickCreateModal: (
    modal: null | 'product' | 'supplier' | 'po' | 'receive' | 'transfer' | 'adjustment'
  ) => void;

  // Catalog & Entity actions
  addProduct: (
    input: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'movingAverageCost' | 'variants'> & {
      initialWarehouseId?: string;
      initialQuantity?: number;
      variants?: Product['variants'];
    }
  ) => EngineResult;
  updateProduct: (productId: string, patch: Partial<Product>) => EngineResult;
  archiveProduct: (productId: string) => EngineResult;

  addCategory: (input: { name: string; code: string; description: string; parentId?: string | null }) => EngineResult;
  updateCategory: (categoryId: string, patch: Partial<ProductCategory>) => EngineResult;
  archiveCategory: (categoryId: string) => EngineResult;

  addWarehouse: (input: Omit<Warehouse, 'id' | 'createdAt'>) => EngineResult;
  updateWarehouse: (warehouseId: string, patch: Partial<Warehouse>) => EngineResult;
  archiveWarehouse: (warehouseId: string) => EngineResult;

  addSupplier: (input: Omit<Supplier, 'id' | 'createdAt'>) => EngineResult;
  updateSupplier: (supplierId: string, patch: Partial<Supplier>) => EngineResult;
  archiveSupplier: (supplierId: string) => EngineResult;

  // Transaction Engine actions
  recordAdjustment: (input: {
    warehouseId: string;
    productId: string;
    adjustmentType: 'POSITIVE' | 'NEGATIVE';
    quantity: number;
    reason: AdjustmentReason;
    notes: string;
  }) => EngineResult;

  createTransfer: (input: {
    sourceWarehouseId: string;
    destinationWarehouseId: string;
    lines: Array<{ productId: string; quantity: number }>;
    referenceNotes: string;
    dispatchImmediately?: boolean;
  }) => EngineResult;
  dispatchTransfer: (transferId: string) => EngineResult;
  receiveTransfer: (transferId: string) => EngineResult;
  cancelTransfer: (transferId: string, resolutionReason: string) => EngineResult;

  createPO: (input: {
    supplierId: string;
    warehouseId: string;
    orderDate: string;
    expectedDeliveryDate: string;
    status: 'DRAFT' | 'ORDERED';
    shippingCharges?: number;
    notes: string;
    lines: Array<{
      productId: string;
      quantityOrdered: number;
      unitCost: number;
      discountAmount?: number;
      taxRate?: number;
    }>;
  }) => EngineResult;
  updatePOStatus: (poId: string, status: PurchaseOrderStatus) => EngineResult;
  duplicatePO: (poId: string) => EngineResult;

  receiveGoodsAgainstPO: (input: {
    poId: string;
    warehouseId: string;
    notes: string;
    lines: Array<{
      poLineId: string;
      acceptedQuantity: number;
      rejectedQuantity: number;
      rejectionReason?: string;
    }>;
  }) => EngineResult;

  reverseMovement: (movementId: string, reason: string) => EngineResult;
  createReservation: (input: {
    productId: string;
    warehouseId: string;
    quantity: number;
    referenceDocument: string;
  }) => EngineResult;
  releaseReservation: (reservationId: string) => EngineResult;

  // Settings, Reports & Persistence
  saveReportConfig: (report: Omit<SavedReport, 'id' | 'createdAt'>) => void;
  deleteSavedReport: (reportId: string) => void;
  updateSettings: (patch: Partial<WorkspaceSettings>) => void;
  restoreFromBackup: (jsonString: string) => { ok: boolean; error?: string };
  resetDemoData: () => void;
}

export const useStockoraStore = create<StockoraStoreState>((set, get) => ({
  hydrated: false,
  data: generateDeterministicSeedData(),
  settings: DEFAULT_WORKSPACE_SETTINGS,
  selectedWarehouseId: 'ALL',
  theme: 'light',
  sidebarCollapsed: false,
  globalSearchOpen: false,
  quickCreateModal: null,

  hydrate: () => {
    if (get().hydrated) return;
    const loaded = loadStockoraFromStorage();
    let initialTheme: 'light' | 'dark' = 'light';
    let initialCollapsed = false;

    if (typeof window !== 'undefined') {
      try {
        const uiRaw = window.localStorage.getItem(STORAGE_KEYS.UI);
        if (uiRaw) {
          const parsedUi = JSON.parse(uiRaw);
          if (parsedUi.theme === 'dark' || parsedUi.theme === 'light') {
            initialTheme = parsedUi.theme;
          }
          if (typeof parsedUi.sidebarCollapsed === 'boolean') {
            initialCollapsed = parsedUi.sidebarCollapsed;
          }
        }
      } catch {
        // ignore
      }
      document.documentElement.classList.toggle('dark', initialTheme === 'dark');
    }

    set({
      hydrated: true,
      data: loaded.data,
      settings: loaded.settings,
      theme: initialTheme,
      sidebarCollapsed: initialCollapsed,
    });
  },

  setSelectedWarehouseId: (warehouseId) => set({ selectedWarehouseId: warehouseId }),

  setTheme: (theme) => {
    if (typeof window !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark');
      try {
        window.localStorage.setItem(
          STORAGE_KEYS.UI,
          JSON.stringify({ theme, sidebarCollapsed: get().sidebarCollapsed })
        );
      } catch {
        // ignore
      }
    }
    set({ theme });
  },

  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(next);
  },

  setSidebarCollapsed: (collapsed) => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(
          STORAGE_KEYS.UI,
          JSON.stringify({ theme: get().theme, sidebarCollapsed: collapsed })
        );
      } catch {
        // ignore
      }
    }
    set({ sidebarCollapsed: collapsed });
  },

  setGlobalSearchOpen: (open) => set({ globalSearchOpen: open }),
  setQuickCreateModal: (modal) => set({ quickCreateModal: modal }),

  addProduct: (input) => {
    const state = get();
    const cleanSku = input.sku.trim().toUpperCase();
    if (!cleanSku) return { ok: false, error: 'SKU is required.' };

    const duplicate = state.data.products.find(
      (p) => p.status !== 'ARCHIVED' && p.sku.toUpperCase() === cleanSku
    );
    if (duplicate) {
      return {
        ok: false,
        error: `Active SKU "${cleanSku}" already exists on product "${duplicate.name}". Duplicate active SKUs are prohibited.`,
      };
    }

    const now = new Date().toISOString();
    const productId = `prd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newProduct: Product = {
      id: productId,
      sku: cleanSku,
      barcode: input.barcode || `890425${String(Date.now()).slice(-6)}`,
      name: input.name.trim(),
      categoryId: input.categoryId,
      brand: input.brand.trim() || 'Stockora Industrial',
      description: input.description.trim(),
      unitOfMeasure: input.unitOfMeasure || 'pcs',
      sellingPrice: Number(input.sellingPrice),
      purchaseCost: Number(input.purchaseCost),
      movingAverageCost: Number(input.purchaseCost),
      preferredSupplierId: input.preferredSupplierId,
      status: input.status || 'ACTIVE',
      reorderPoint: Number(input.reorderPoint) || 20,
      targetStock: Number(input.targetStock) || 80,
      variants: input.variants ?? [],
      createdAt: now,
      updatedAt: now,
    };

    let nextData: StockoraData = {
      ...state.data,
      products: [newProduct, ...state.data.products],
      activities: [
        {
          id: `act-${Date.now()}`,
          timestamp: now,
          eventType: 'PRODUCT_CREATED',
          title: `Product ${newProduct.sku} created`,
          description: `${newProduct.name} added to catalog`,
          actor: 'Alex Morgan',
          relatedDocumentId: productId,
          relatedDocumentNumber: newProduct.sku,
          relatedRoute: `/dashboard/products/${productId}`,
        },
        ...state.data.activities,
      ],
    };

    if (input.initialWarehouseId && input.initialQuantity && input.initialQuantity > 0) {
      const openRes = postOpeningStock(nextData, {
        operationId: `open-${productId}-${Date.now()}`,
        productId,
        warehouseId: input.initialWarehouseId,
        quantity: Number(input.initialQuantity),
        unitCost: Number(input.purchaseCost),
        actor: 'Alex Morgan',
        timestamp: now,
      });
      if (openRes.ok && openRes.data) {
        nextData = openRes.data;
      }
    }

    saveStockoraToStorage(nextData);
    set({ data: nextData });
    return { ok: true, recordId: productId, data: nextData };
  },

  updateProduct: (productId, patch) => {
    const state = get();
    const existing = state.data.products.find((p) => p.id === productId);
    if (!existing) return { ok: false, error: 'Product not found.' };

    if (patch.sku) {
      const normalizedSku = patch.sku.trim().toUpperCase();
      const conflict = state.data.products.find(
        (p) => p.id !== productId && p.status !== 'ARCHIVED' && p.sku.toUpperCase() === normalizedSku
      );
      if (conflict) {
        return { ok: false, error: `SKU "${normalizedSku}" is already used by ${conflict.name}.` };
      }
      patch.sku = normalizedSku;
    }

    const now = new Date().toISOString();
    const nextData: StockoraData = {
      ...state.data,
      products: state.data.products.map((p) =>
        p.id === productId ? { ...p, ...patch, updatedAt: now } : p
      ),
      activities: [
        {
          id: `act-${Date.now()}`,
          timestamp: now,
          eventType: 'PRODUCT_EDITED',
          title: `Product ${existing.sku} updated`,
          description: `Catalog metadata updated for ${existing.name}`,
          actor: 'Alex Morgan',
          relatedDocumentId: productId,
          relatedDocumentNumber: existing.sku,
          relatedRoute: `/dashboard/products/${productId}`,
        },
        ...state.data.activities,
      ],
    };

    saveStockoraToStorage(nextData);
    set({ data: nextData });
    return { ok: true, recordId: productId, data: nextData };
  },

  archiveProduct: (productId) => {
    return get().updateProduct(productId, { status: 'ARCHIVED' });
  },

  addCategory: (input) => {
    const state = get();
    const now = new Date().toISOString();
    const catId = `cat-${Date.now()}`;
    const newCat: ProductCategory = {
      id: catId,
      name: input.name.trim(),
      code: input.code.trim().toUpperCase(),
      description: input.description.trim(),
      parentId: input.parentId ?? null,
      status: 'ACTIVE',
      createdAt: now,
    };
    const nextData: StockoraData = {
      ...state.data,
      categories: [...state.data.categories, newCat],
      activities: [
        {
          id: `act-${Date.now()}`,
          timestamp: now,
          eventType: 'CATEGORY_CREATED',
          title: `Category ${newCat.name} created`,
          description: `Code: ${newCat.code}`,
          actor: 'Alex Morgan',
          relatedRoute: '/dashboard/categories',
        },
        ...state.data.activities,
      ],
    };
    saveStockoraToStorage(nextData);
    set({ data: nextData });
    return { ok: true, recordId: catId, data: nextData };
  },

  updateCategory: (categoryId, patch) => {
    const state = get();
    const nextData: StockoraData = {
      ...state.data,
      categories: state.data.categories.map((c) =>
        c.id === categoryId ? { ...c, ...patch } : c
      ),
    };
    saveStockoraToStorage(nextData);
    set({ data: nextData });
    return { ok: true, recordId: categoryId, data: nextData };
  },

  archiveCategory: (categoryId) => {
    return get().updateCategory(categoryId, { status: 'ARCHIVED' });
  },

  addWarehouse: (input) => {
    const state = get();
    const code = input.code.trim().toUpperCase();
    if (state.data.warehouses.some((w) => w.code.toUpperCase() === code)) {
      return { ok: false, error: `Warehouse code ${code} already exists.` };
    }
    const now = new Date().toISOString();
    const whId = `wh-${Date.now()}`;
    const newWh: Warehouse = {
      ...input,
      id: whId,
      code,
      createdAt: now,
    };
    const nextData: StockoraData = {
      ...state.data,
      warehouses: [...state.data.warehouses, newWh],
      activities: [
        {
          id: `act-${Date.now()}`,
          timestamp: now,
          eventType: 'WAREHOUSE_CREATED',
          title: `Warehouse ${newWh.name} (${newWh.code}) created`,
          description: newWh.location,
          actor: 'Alex Morgan',
          relatedRoute: '/dashboard/warehouses',
        },
        ...state.data.activities,
      ],
    };
    saveStockoraToStorage(nextData);
    set({ data: nextData });
    return { ok: true, recordId: whId, data: nextData };
  },

  updateWarehouse: (warehouseId, patch) => {
    const state = get();
    const nextData: StockoraData = {
      ...state.data,
      warehouses: state.data.warehouses.map((w) =>
        w.id === warehouseId ? { ...w, ...patch } : w
      ),
    };
    saveStockoraToStorage(nextData);
    set({ data: nextData });
    return { ok: true, recordId: warehouseId, data: nextData };
  },

  archiveWarehouse: (warehouseId) => {
    const state = get();
    const check = canArchiveWarehouse(state.data, warehouseId);
    if (!check.allowed) {
      return { ok: false, error: check.reason };
    }
    return get().updateWarehouse(warehouseId, { status: 'ARCHIVED' });
  },

  addSupplier: (input) => {
    const state = get();
    const now = new Date().toISOString();
    const supId = `sup-${Date.now()}`;
    const newSup: Supplier = {
      ...input,
      id: supId,
      createdAt: now,
    };
    const nextData: StockoraData = {
      ...state.data,
      suppliers: [newSup, ...state.data.suppliers],
      activities: [
        {
          id: `act-${Date.now()}`,
          timestamp: now,
          eventType: 'SUPPLIER_UPDATED',
          title: `Supplier ${newSup.companyName} added`,
          description: `${newSup.code} · ${newSup.location}`,
          actor: 'Alex Morgan',
          relatedRoute: '/dashboard/suppliers',
        },
        ...state.data.activities,
      ],
    };
    saveStockoraToStorage(nextData);
    set({ data: nextData });
    return { ok: true, recordId: supId, data: nextData };
  },

  updateSupplier: (supplierId, patch) => {
    const state = get();
    const nextData: StockoraData = {
      ...state.data,
      suppliers: state.data.suppliers.map((s) =>
        s.id === supplierId ? { ...s, ...patch } : s
      ),
    };
    saveStockoraToStorage(nextData);
    set({ data: nextData });
    return { ok: true, recordId: supplierId, data: nextData };
  },

  archiveSupplier: (supplierId) => {
    return get().updateSupplier(supplierId, { status: 'ARCHIVED' });
  },

  recordAdjustment: (input) => {
    const state = get();
    const res = postStockAdjustment(state.data, {
      ...input,
      operationId: `adj-op-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      actor: 'Alex Morgan',
      allowNegativeStock: state.settings.allowNegativeStock,
    });
    if (res.ok && res.data) {
      saveStockoraToStorage(res.data);
      set({ data: res.data });
    }
    return res;
  },

  createTransfer: (input) => {
    const state = get();
    const res = createStockTransfer(state.data, {
      ...input,
      operationId: `trf-op-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      actor: 'Alex Morgan',
    });
    if (res.ok && res.data) {
      saveStockoraToStorage(res.data);
      set({ data: res.data });
    }
    return res;
  },

  dispatchTransfer: (transferId) => {
    const state = get();
    const res = dispatchStockTransfer(state.data, {
      operationId: `trf-disp-${transferId}`,
      transferId,
      actor: 'Alex Morgan',
    });
    if (res.ok && res.data) {
      saveStockoraToStorage(res.data);
      set({ data: res.data });
    }
    return res;
  },

  receiveTransfer: (transferId) => {
    const state = get();
    const res = receiveStockTransfer(state.data, {
      operationId: `trf-rec-${transferId}`,
      transferId,
      actor: 'Alex Morgan',
    });
    if (res.ok && res.data) {
      saveStockoraToStorage(res.data);
      set({ data: res.data });
    }
    return res;
  },

  cancelTransfer: (transferId, resolutionReason) => {
    const state = get();
    const res = cancelStockTransfer(state.data, {
      operationId: `trf-canc-${transferId}`,
      transferId,
      resolutionReason,
      actor: 'Alex Morgan',
    });
    if (res.ok && res.data) {
      saveStockoraToStorage(res.data);
      set({ data: res.data });
    }
    return res;
  },

  createPO: (input) => {
    const state = get();
    const res = createPurchaseOrder(state.data, {
      ...input,
      operationId: `po-op-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      actor: 'Alex Morgan',
    });
    if (res.ok && res.data) {
      saveStockoraToStorage(res.data);
      set({ data: res.data });
    }
    return res;
  },

  updatePOStatus: (poId, status) => {
    const state = get();
    const po = state.data.purchaseOrders.find((p) => p.id === poId);
    if (!po) return { ok: false, error: 'PO not found.' };
    if (status === 'CANCELLED' && (po.status === 'RECEIVED' || po.status === 'PARTIALLY_RECEIVED')) {
      return {
        ok: false,
        error: 'Cannot cancel a purchase order that already has received goods.',
      };
    }
    const now = new Date().toISOString();
    const nextData: StockoraData = {
      ...state.data,
      purchaseOrders: state.data.purchaseOrders.map((p) =>
        p.id === poId ? { ...p, status, updatedAt: now } : p
      ),
      activities: [
        {
          id: `act-${Date.now()}`,
          timestamp: now,
          eventType: 'PO_UPDATED',
          title: `Purchase Order ${po.poNumber} status changed to ${status}`,
          description: `Updated by Alex Morgan`,
          actor: 'Alex Morgan',
          relatedDocumentId: po.id,
          relatedDocumentNumber: po.poNumber,
          relatedRoute: '/dashboard/purchase-orders',
        },
        ...state.data.activities,
      ],
    };
    saveStockoraToStorage(nextData);
    set({ data: nextData });
    return { ok: true, recordId: poId, data: nextData };
  },

  duplicatePO: (poId) => {
    const state = get();
    const source = state.data.purchaseOrders.find((p) => p.id === poId);
    if (!source) return { ok: false, error: 'Source PO not found.' };

    return get().createPO({
      supplierId: source.supplierId,
      warehouseId: source.warehouseId,
      orderDate: new Date().toISOString(),
      expectedDeliveryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      status: 'DRAFT',
      shippingCharges: source.shippingCharges,
      notes: `Duplicated from ${source.poNumber}`,
      lines: source.lines.map((l) => ({
        productId: l.productId,
        quantityOrdered: l.quantityOrdered,
        unitCost: l.unitCost,
        discountAmount: l.discountAmount,
        taxRate: l.taxRate,
      })),
    });
  },

  receiveGoodsAgainstPO: (input) => {
    const state = get();
    const res = postGoodsReceipt(state.data, {
      ...input,
      operationId: `grn-op-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      receivedBy: 'Alex Morgan',
      allowOverReceipt: state.settings.allowOverReceipt,
    });
    if (res.ok && res.data) {
      saveStockoraToStorage(res.data);
      set({ data: res.data });
    }
    return res;
  },

  reverseMovement: (movementId, reason) => {
    const state = get();
    const res = reversePostedMovement(state.data, {
      operationId: `rev-op-${movementId}`,
      movementId,
      reason,
      actor: 'Alex Morgan',
      allowNegativeStock: state.settings.allowNegativeStock,
    });
    if (res.ok && res.data) {
      saveStockoraToStorage(res.data);
      set({ data: res.data });
    }
    return res;
  },

  createReservation: (input) => {
    const state = get();
    const res = createStockReservation(state.data, {
      ...input,
      operationId: `res-op-${Date.now()}`,
      actor: 'Alex Morgan',
    });
    if (res.ok && res.data) {
      saveStockoraToStorage(res.data);
      set({ data: res.data });
    }
    return res;
  },

  releaseReservation: (reservationId) => {
    const state = get();
    const res = releaseStockReservation(state.data, {
      operationId: `rel-op-${reservationId}`,
      reservationId,
      actor: 'Alex Morgan',
    });
    if (res.ok && res.data) {
      saveStockoraToStorage(res.data);
      set({ data: res.data });
    }
    return res;
  },

  saveReportConfig: (report) => {
    const state = get();
    const newReport: SavedReport = {
      ...report,
      id: `rep-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    const nextData: StockoraData = {
      ...state.data,
      savedReports: [newReport, ...state.data.savedReports],
    };
    saveStockoraToStorage(nextData);
    set({ data: nextData });
  },

  deleteSavedReport: (reportId) => {
    const state = get();
    const nextData: StockoraData = {
      ...state.data,
      savedReports: state.data.savedReports.filter((r) => r.id !== reportId),
    };
    saveStockoraToStorage(nextData);
    set({ data: nextData });
  },

  updateSettings: (patch) => {
    const state = get();
    const nextSettings = { ...state.settings, ...patch };
    const now = new Date().toISOString();
    const nextData: StockoraData = {
      ...state.data,
      activities: [
        {
          id: `act-${Date.now()}`,
          timestamp: now,
          eventType: 'SETTINGS_CHANGED',
          title: 'Workspace settings updated',
          description: `Configuration updated by Alex Morgan`,
          actor: 'Alex Morgan',
          relatedRoute: '/dashboard/settings',
        },
        ...state.data.activities,
      ],
    };
    saveStockoraToStorage(nextData, nextSettings);
    set({ settings: nextSettings, data: nextData });
  },

  restoreFromBackup: (jsonString) => {
    const res = restoreStockoraBackupJson(jsonString);
    if (res.ok && res.data && res.settings) {
      set({ data: res.data, settings: res.settings });
      return { ok: true };
    }
    return { ok: false, error: res.error };
  },

  resetDemoData: () => {
    const freshData = generateDeterministicSeedData();
    const freshSettings = DEFAULT_WORKSPACE_SETTINGS;
    saveStockoraToStorage(freshData, freshSettings);
    set({
      data: freshData,
      settings: freshSettings,
      selectedWarehouseId: 'ALL',
    });
  },
}));
