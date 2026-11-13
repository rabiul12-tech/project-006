import {
  Activity,
  AdjustmentReason,
  GoodsReceipt,
  GoodsReceiptLine,
  InventoryBalance,
  Product,
  PurchaseOrder,
  PurchaseOrderStatus,
  StockAdjustment,
  StockMovement,
  StockoraData,
  StockReservation,
  StockStatus,
  StockTransfer,
} from '@/types/erp';
import {
  calculateInventoryValue,
  calculateMovingAverageCost,
  calculatePurchaseOrderLine,
  calculatePurchaseOrderTotals,
  calculateSuggestedReorderQuantity,
} from '@/lib/calculations';

export interface EngineResult<T = StockoraData> {
  ok: boolean;
  data?: T;
  error?: string;
  recordId?: string;
}

/**
 * Derive physical On-Hand quantity for a (productId, warehouseId) pair strictly from the movement ledger.
 * Note: RESERVATION and RESERVATION_RELEASE movements do not alter physical On-Hand stock;
 * they are tracked in reservations to compute Available = On-Hand - Reserved.
 */
export function getWarehouseOnHandFromLedger(
  movements: StockMovement[],
  productId: string,
  warehouseId: string
): number {
  let balance = 0;
  for (const m of movements) {
    if (m.productId === productId && m.warehouseId === warehouseId) {
      if (m.movementType !== 'RESERVATION' && m.movementType !== 'RESERVATION_RELEASE') {
        balance += m.quantityDelta;
      }
    }
  }
  return balance;
}

/**
 * Derive total physical On-Hand quantity across all warehouses for a product.
 */
export function getTotalProductOnHandFromLedger(
  movements: StockMovement[],
  productId: string
): number {
  let balance = 0;
  for (const m of movements) {
    if (m.productId === productId) {
      if (m.movementType !== 'RESERVATION' && m.movementType !== 'RESERVATION_RELEASE') {
        balance += m.quantityDelta;
      }
    }
  }
  return balance;
}

/**
 * Derive active reserved units for a (productId, warehouseId) pair.
 */
export function getReservedQuantity(
  reservations: StockReservation[],
  productId: string,
  warehouseId: string
): number {
  let total = 0;
  for (const r of reservations) {
    if (r.productId === productId && r.warehouseId === warehouseId && r.status === 'ACTIVE') {
      total += r.quantity;
    }
  }
  return total;
}

/**
 * Compute stock status from available quantity and reorder point.
 */
export function deriveStockStatus(availableQuantity: number, reorderPoint: number): StockStatus {
  if (availableQuantity <= 0) return 'OUT_OF_STOCK';
  if (availableQuantity <= reorderPoint) return 'LOW_STOCK';
  return 'IN_STOCK';
}

/**
 * Derive all warehouse-product inventory balances from the movement ledger, reservations, and transfers.
 * The movement ledger is the single source of truth for on-hand stock.
 */
export function deriveInventoryBalances(data: StockoraData): InventoryBalance[] {
  const categoryMap = new Map(data.categories.map((c) => [c.id, c.name]));
  const activeWarehouses = data.warehouses.filter((w) => w.status === 'ACTIVE');

  // Pre-aggregate on-hand by `${productId}::${warehouseId}`
  const onHandMap = new Map<string, number>();
  for (const m of data.stockMovements) {
    if (m.movementType === 'RESERVATION' || m.movementType === 'RESERVATION_RELEASE') continue;
    const key = `${m.productId}::${m.warehouseId}`;
    onHandMap.set(key, (onHandMap.get(key) ?? 0) + m.quantityDelta);
  }

  // Pre-aggregate active reservations
  const reservedMap = new Map<string, number>();
  for (const r of data.reservations) {
    if (r.status !== 'ACTIVE') continue;
    const key = `${r.productId}::${r.warehouseId}`;
    reservedMap.set(key, (reservedMap.get(key) ?? 0) + r.quantity);
  }

  // Pre-aggregate in-transit transfers (status === 'IN_TRANSIT')
  const inTransitInMap = new Map<string, number>();
  const inTransitOutMap = new Map<string, number>();
  for (const t of data.stockTransfers) {
    if (t.status !== 'IN_TRANSIT') continue;
    for (const line of t.lines) {
      const outKey = `${line.productId}::${t.sourceWarehouseId}`;
      const inKey = `${line.productId}::${t.destinationWarehouseId}`;
      inTransitOutMap.set(outKey, (inTransitOutMap.get(outKey) ?? 0) + line.quantity);
      inTransitInMap.set(inKey, (inTransitInMap.get(inKey) ?? 0) + line.quantity);
    }
  }

  // Warehouse-specific reorder rules override product default reorderPoint/targetStock
  const ruleMap = new Map<string, { reorderPoint: number; targetStock: number }>();
  for (const rule of data.reorderRules) {
    ruleMap.set(`${rule.productId}::${rule.warehouseId}`, {
      reorderPoint: rule.reorderPoint,
      targetStock: rule.targetStock,
    });
  }

  const balances: InventoryBalance[] = [];

  for (const product of data.products) {
    if (product.status === 'ARCHIVED') continue;
    const categoryName = categoryMap.get(product.categoryId) ?? 'Uncategorized';
    const unitCost = product.movingAverageCost || product.purchaseCost;

    for (const wh of activeWarehouses) {
      const key = `${product.id}::${wh.id}`;
      const onHandQuantity = onHandMap.get(key) ?? 0;
      const reservedQuantity = reservedMap.get(key) ?? 0;
      const availableQuantity = Math.max(0, onHandQuantity - reservedQuantity);
      const inTransitInbound = inTransitInMap.get(key) ?? 0;
      const inTransitOutbound = inTransitOutMap.get(key) ?? 0;

      const specificRule = ruleMap.get(key) ?? ruleMap.get(`${product.id}::ALL`);
      // Scale product reorder point across warehouses if no specific warehouse rule is set
      const warehouseReorderPoint = specificRule
        ? specificRule.reorderPoint
        : Math.max(5, Math.round(product.reorderPoint / Math.max(1, activeWarehouses.length)));
      const warehouseTargetStock = specificRule
        ? specificRule.targetStock
        : Math.max(15, Math.round(product.targetStock / Math.max(1, activeWarehouses.length)));

      const stockStatus = deriveStockStatus(availableQuantity, warehouseReorderPoint);
      const totalValue = calculateInventoryValue(onHandQuantity, unitCost);

      balances.push({
        productId: product.id,
        sku: product.sku,
        productName: product.name,
        categoryId: product.categoryId,
        categoryName,
        unitOfMeasure: product.unitOfMeasure,
        warehouseId: wh.id,
        warehouseName: wh.name,
        warehouseCode: wh.code,
        onHandQuantity,
        reservedQuantity,
        availableQuantity,
        inTransitInbound,
        inTransitOutbound,
        reorderPoint: warehouseReorderPoint,
        targetStock: warehouseTargetStock,
        stockStatus,
        unitCost,
        sellingPrice: product.sellingPrice,
        totalValue,
      });
    }
  }

  return balances;
}

/**
 * Calculate total in-transit units across the entire organization or for a specific product.
 */
export function getInTransitUnits(data: StockoraData, productId?: string): number {
  let units = 0;
  for (const t of data.stockTransfers) {
    if (t.status !== 'IN_TRANSIT') continue;
    for (const line of t.lines) {
      if (!productId || line.productId === productId) {
        units += line.quantity;
      }
    }
  }
  return units;
}

/**
 * Calculate confirmed incoming stock from ORDERED or PARTIALLY_RECEIVED purchase orders
 * plus inbound IN_TRANSIT transfers.
 */
export function getConfirmedIncomingStock(
  data: StockoraData,
  productId: string,
  warehouseId?: string
): number {
  let incoming = 0;
  for (const po of data.purchaseOrders) {
    if (po.status !== 'ORDERED' && po.status !== 'PARTIALLY_RECEIVED') continue;
    if (warehouseId && warehouseId !== 'ALL' && po.warehouseId !== warehouseId) continue;
    for (const line of po.lines) {
      if (line.productId === productId) {
        incoming += Math.max(0, line.quantityOrdered - line.quantityReceived);
      }
    }
  }

  for (const trf of data.stockTransfers) {
    if (trf.status !== 'IN_TRANSIT') continue;
    if (warehouseId && warehouseId !== 'ALL' && trf.destinationWarehouseId !== warehouseId) continue;
    for (const line of trf.lines) {
      if (line.productId === productId) {
        incoming += line.quantity;
      }
    }
  }

  return incoming;
}

/**
 * Generate Reorder Recommendations for products across warehouses or organization-wide.
 */
export function getReorderRecommendations(
  data: StockoraData,
  warehouseFilter = 'ALL',
  categoryFilter = 'ALL'
) {
  const balances = deriveInventoryBalances(data);
  const supplierMap = new Map(data.suppliers.map((s) => [s.id, s]));

  if (warehouseFilter !== 'ALL') {
    return balances
      .filter((b) => b.warehouseId === warehouseFilter)
      .filter((b) => categoryFilter === 'ALL' || b.categoryId === categoryFilter)
      .map((b) => {
        const product = data.products.find((p) => p.id === b.productId)!;
        const incoming = getConfirmedIncomingStock(data, b.productId, b.warehouseId);
        const suggestedQty = calculateSuggestedReorderQuantity({
          targetStock: b.targetStock,
          availableStock: b.availableQuantity,
          confirmedIncomingStock: incoming,
        });
        const supplier = supplierMap.get(product.preferredSupplierId);
        return {
          productId: b.productId,
          sku: b.sku,
          productName: b.productName,
          categoryId: b.categoryId,
          categoryName: b.categoryName,
          warehouseId: b.warehouseId,
          warehouseName: b.warehouseName,
          onHandQuantity: b.onHandQuantity,
          reservedQuantity: b.reservedQuantity,
          availableQuantity: b.availableQuantity,
          reorderPoint: b.reorderPoint,
          targetStock: b.targetStock,
          confirmedIncoming: incoming,
          suggestedReorderQuantity: suggestedQty,
          stockStatus: b.stockStatus,
          unitCost: b.unitCost,
          estimatedOrderCost: calculateInventoryValue(suggestedQty, b.unitCost),
          preferredSupplierId: product.preferredSupplierId,
          preferredSupplierName: supplier?.companyName ?? 'Unassigned Supplier',
        };
      })
      .filter((r) => r.stockStatus !== 'IN_STOCK' || r.suggestedReorderQuantity > 0);
  }

  // Aggregate by product across all active warehouses
  const productGroups = new Map<
    string,
    {
      onHand: number;
      reserved: number;
      available: number;
       sample: InventoryBalance;
    }
  >();

  for (const b of balances) {
    if (categoryFilter !== 'ALL' && b.categoryId !== categoryFilter) continue;
    const curr = productGroups.get(b.productId) ?? {
      onHand: 0,
      reserved: 0,
      available: 0,
      sample: b,
    };
    curr.onHand += b.onHandQuantity;
    curr.reserved += b.reservedQuantity;
    curr.available += b.availableQuantity;
    productGroups.set(b.productId, curr);
  }

  const recommendations = [];
  for (const [productId, agg] of productGroups.entries()) {
    const product = data.products.find((p) => p.id === productId);
    if (!product) continue;
    const incoming = getConfirmedIncomingStock(data, productId, 'ALL');
    const status = deriveStockStatus(agg.available, product.reorderPoint);
    const suggestedQty = calculateSuggestedReorderQuantity({
      targetStock: product.targetStock,
      availableStock: agg.available,
      confirmedIncomingStock: incoming,
    });
    const supplier = supplierMap.get(product.preferredSupplierId);

    if (status !== 'IN_STOCK' || suggestedQty > 0) {
      recommendations.push({
        productId: product.id,
        sku: product.sku,
        productName: product.name,
        categoryId: product.categoryId,
        categoryName: agg.sample.categoryName,
        warehouseId: 'ALL',
        warehouseName: 'All Warehouses',
        onHandQuantity: agg.onHand,
        reservedQuantity: agg.reserved,
        availableQuantity: agg.available,
        reorderPoint: product.reorderPoint,
        targetStock: product.targetStock,
        confirmedIncoming: incoming,
        suggestedReorderQuantity: suggestedQty,
        stockStatus: status,
        unitCost: product.movingAverageCost || product.purchaseCost,
        estimatedOrderCost: calculateInventoryValue(
          suggestedQty,
          product.movingAverageCost || product.purchaseCost
        ),
        preferredSupplierId: product.preferredSupplierId,
        preferredSupplierName: supplier?.companyName ?? 'Unassigned Supplier',
      });
    }
  }

  return recommendations;
}

/**
 * 1. POST OPENING STOCK
 */
export function postOpeningStock(
  data: StockoraData,
  input: {
    operationId: string;
    productId: string;
    warehouseId: string;
    quantity: number;
    unitCost: number;
    actor: string;
    timestamp?: string;
  }
): EngineResult {
  if (data.processedOperationIds.includes(input.operationId)) {
    return { ok: false, error: 'Duplicate operation ID detected.' };
  }
  if (input.quantity < 0) {
    return { ok: false, error: 'Opening stock quantity cannot be negative.' };
  }
  const product = data.products.find((p) => p.id === input.productId);
  if (!product) return { ok: false, error: 'Referenced product does not exist.' };
  const warehouse = data.warehouses.find((w) => w.id === input.warehouseId);
  if (!warehouse) return { ok: false, error: 'Referenced warehouse does not exist.' };

  const currentOnHand = getWarehouseOnHandFromLedger(
    data.stockMovements,
    input.productId,
    input.warehouseId
  );
  const totalProductOnHand = getTotalProductOnHandFromLedger(data.stockMovements, input.productId);
  const newAvgCost = calculateMovingAverageCost(
    totalProductOnHand,
    product.movingAverageCost || product.purchaseCost,
    input.quantity,
    input.unitCost
  );

  const now = input.timestamp ?? new Date().toISOString();
  const movementId = `mov-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const movement: StockMovement = {
    id: movementId,
    timestamp: now,
    productId: product.id,
    sku: product.sku,
    productName: product.name,
    warehouseId: warehouse.id,
    movementType: 'OPENING_BALANCE',
    quantityDelta: input.quantity,
    beforeQuantity: currentOnHand,
    afterQuantity: currentOnHand + input.quantity,
    unitCostSnapshot: input.unitCost,
    totalValueSnapshot: calculateInventoryValue(input.quantity, input.unitCost),
    sourceReference: `OPEN-${product.sku}`,
    sourceId: input.operationId,
    reason: 'Opening inventory balance initialization',
    actor: input.actor,
  };

  const updatedProducts = data.products.map((p) =>
    p.id === product.id ? { ...p, movingAverageCost: newAvgCost, updatedAt: now } : p
  );

  return {
    ok: true,
    recordId: movementId,
    data: {
      ...data,
      products: updatedProducts,
      stockMovements: [movement, ...data.stockMovements],
      processedOperationIds: [...data.processedOperationIds, input.operationId],
    },
  };
}

/**
 * 2. POST STOCK ADJUSTMENT (POSITIVE OR NEGATIVE)
 */
export function postStockAdjustment(
  data: StockoraData,
  input: {
    operationId: string;
    warehouseId: string;
    productId: string;
    adjustmentType: 'POSITIVE' | 'NEGATIVE';
    quantity: number;
    reason: AdjustmentReason;
    notes: string;
    actor: string;
    allowNegativeStock?: boolean;
    timestamp?: string;
  }
): EngineResult {
  if (data.processedOperationIds.includes(input.operationId)) {
    return { ok: false, error: 'This stock adjustment has already been posted.' };
  }
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    return { ok: false, error: 'Adjustment quantity must be a positive number.' };
  }

  const product = data.products.find((p) => p.id === input.productId);
  if (!product) return { ok: false, error: 'Product not found.' };
  const warehouse = data.warehouses.find((w) => w.id === input.warehouseId);
  if (!warehouse) return { ok: false, error: 'Warehouse not found.' };

  const currentOnHand = getWarehouseOnHandFromLedger(
    data.stockMovements,
    input.productId,
    input.warehouseId
  );
  const delta = input.adjustmentType === 'POSITIVE' ? input.quantity : -input.quantity;
  const afterQuantity = currentOnHand + delta;

  if (!input.allowNegativeStock && afterQuantity < 0) {
    return {
      ok: false,
      error: `Insufficient stock in ${warehouse.name}. Current on-hand is ${currentOnHand}, cannot reduce by ${input.quantity}.`,
    };
  }

  const now = input.timestamp ?? new Date().toISOString();
  const adjNumber = `ADJ-${new Date().getFullYear()}-${String(data.stockAdjustments.length + 1001).slice(-4)}`;
  const adjId = `adj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const movId = `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const unitCost = product.movingAverageCost || product.purchaseCost;

  const adjustment: StockAdjustment = {
    id: adjId,
    adjustmentNumber: adjNumber,
    warehouseId: warehouse.id,
    productId: product.id,
    sku: product.sku,
    productName: product.name,
    adjustmentType: input.adjustmentType,
    quantity: input.quantity,
    beforeQuantity: currentOnHand,
    afterQuantity,
    unitCostSnapshot: unitCost,
    reason: input.reason,
    notes: input.notes,
    actor: input.actor,
    createdAt: now,
  };

  const movement: StockMovement = {
    id: movId,
    timestamp: now,
    productId: product.id,
    sku: product.sku,
    productName: product.name,
    warehouseId: warehouse.id,
    movementType:
      input.adjustmentType === 'POSITIVE' ? 'POSITIVE_ADJUSTMENT' : 'NEGATIVE_ADJUSTMENT',
    quantityDelta: delta,
    beforeQuantity: currentOnHand,
    afterQuantity,
    unitCostSnapshot: unitCost,
    totalValueSnapshot: calculateInventoryValue(input.quantity, unitCost),
    sourceReference: adjNumber,
    sourceId: adjId,
    reason: `${input.reason}${input.notes ? ` — ${input.notes}` : ''}`,
    actor: input.actor,
  };

  const activity: Activity = {
    id: `act-${Date.now()}`,
    timestamp: now,
    eventType: 'ADJUSTMENT_POSTED',
    title: `Stock adjustment ${adjNumber} posted`,
    description: `${input.adjustmentType === 'POSITIVE' ? '+' : '-'}${input.quantity} ${product.unitOfMeasure} of ${product.sku} at ${warehouse.name} (${input.reason})`,
    actor: input.actor,
    relatedDocumentId: adjId,
    relatedDocumentNumber: adjNumber,
    relatedRoute: '/dashboard/adjustments',
  };

  return {
    ok: true,
    recordId: adjId,
    data: {
      ...data,
      stockAdjustments: [adjustment, ...data.stockAdjustments],
      stockMovements: [movement, ...data.stockMovements],
      activities: [activity, ...data.activities],
      processedOperationIds: [...data.processedOperationIds, input.operationId],
    },
  };
}

/**
 * 3. CREATE INTER-WAREHOUSE STOCK TRANSFER (DRAFT OR IMMEDIATE DISPATCH)
 */
export function createStockTransfer(
  data: StockoraData,
  input: {
    operationId: string;
    sourceWarehouseId: string;
    destinationWarehouseId: string;
    lines: Array<{ productId: string; quantity: number }>;
    referenceNotes: string;
    actor: string;
    dispatchImmediately?: boolean;
    timestamp?: string;
  }
): EngineResult {
  if (data.processedOperationIds.includes(input.operationId)) {
    return { ok: false, error: 'Duplicate transfer creation operation.' };
  }
  if (input.sourceWarehouseId === input.destinationWarehouseId) {
    return { ok: false, error: 'Source and destination warehouses cannot be identical.' };
  }
  const sourceWh = data.warehouses.find((w) => w.id === input.sourceWarehouseId);
  const destWh = data.warehouses.find((w) => w.id === input.destinationWarehouseId);
  if (!sourceWh || !destWh) {
    return { ok: false, error: 'Both source and destination warehouses must exist.' };
  }
  if (!input.lines.length) {
    return { ok: false, error: 'Transfer must include at least one product line.' };
  }

  for (const line of input.lines) {
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      return { ok: false, error: 'Transfer quantity must be greater than zero.' };
    }
    const product = data.products.find((p) => p.id === line.productId);
    if (!product) return { ok: false, error: 'Invalid product in transfer line.' };

    const onHand = getWarehouseOnHandFromLedger(
      data.stockMovements,
      line.productId,
      input.sourceWarehouseId
    );
    const reserved = getReservedQuantity(
      data.reservations,
      line.productId,
      input.sourceWarehouseId
    );
    const available = onHand - reserved;
    if (line.quantity > available) {
      return {
        ok: false,
        error: `Insufficient available stock for ${product.sku} in ${sourceWh.name} (Available: ${available}, Requested: ${line.quantity}).`,
      };
    }
  }

  const now = input.timestamp ?? new Date().toISOString();
  const transferId = `trf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const transferNumber = `TRF-${new Date().getFullYear()}-${String(data.stockTransfers.length + 1001).slice(-4)}`;

  const transferLines = input.lines.map((l, idx) => {
    const product = data.products.find((p) => p.id === l.productId)!;
    return {
      id: `trfl-${Date.now()}-${idx}`,
      transferId,
      productId: product.id,
      sku: product.sku,
      productName: product.name,
      quantity: l.quantity,
      unitCostSnapshot: product.movingAverageCost || product.purchaseCost,
    };
  });

  const transfer: StockTransfer = {
    id: transferId,
    transferNumber,
    sourceWarehouseId: sourceWh.id,
    destinationWarehouseId: destWh.id,
    status: 'DRAFT',
    transferDate: now,
    referenceNotes: input.referenceNotes,
    createdBy: input.actor,
    lines: transferLines,
    createdAt: now,
  };

  const activity: Activity = {
    id: `act-${Date.now()}`,
    timestamp: now,
    eventType: 'TRANSFER_CREATED',
    title: `Transfer ${transferNumber} created`,
    description: `${sourceWh.code} → ${destWh.code} (${transferLines.reduce((s, l) => s + l.quantity, 0)} units)`,
    actor: input.actor,
    relatedDocumentId: transferId,
    relatedDocumentNumber: transferNumber,
    relatedRoute: '/dashboard/transfers',
  };

  const draftState: StockoraData = {
    ...data,
    stockTransfers: [transfer, ...data.stockTransfers],
    activities: [activity, ...data.activities],
    processedOperationIds: [...data.processedOperationIds, input.operationId],
  };

  if (input.dispatchImmediately) {
    return dispatchStockTransfer(draftState, {
      operationId: `${input.operationId}-dispatch`,
      transferId,
      actor: input.actor,
      timestamp: now,
    });
  }

  return { ok: true, recordId: transferId, data: draftState };
}

/**
 * 4. DISPATCH STOCK TRANSFER (DRAFT -> IN_TRANSIT)
 * Reduces source warehouse on-hand stock and places units in transit.
 */
export function dispatchStockTransfer(
  data: StockoraData,
  input: {
    operationId: string;
    transferId: string;
    actor: string;
    timestamp?: string;
  }
): EngineResult {
  if (data.processedOperationIds.includes(input.operationId)) {
    return { ok: false, error: 'Duplicate dispatch operation rejected.' };
  }
  const transfer = data.stockTransfers.find((t) => t.id === input.transferId);
  if (!transfer) return { ok: false, error: 'Stock transfer not found.' };
  if (transfer.status !== 'DRAFT') {
    return {
      ok: false,
      error: `Cannot dispatch transfer with status ${transfer.status}. Only DRAFT transfers can be dispatched.`,
    };
  }

  const sourceWh = data.warehouses.find((w) => w.id === transfer.sourceWarehouseId);
  const destWh = data.warehouses.find((w) => w.id === transfer.destinationWarehouseId);
  if (!sourceWh || !destWh) return { ok: false, error: 'Warehouse reference missing.' };

  // Validate stock availability for every line before committing
  for (const line of transfer.lines) {
    const onHand = getWarehouseOnHandFromLedger(
      data.stockMovements,
      line.productId,
      transfer.sourceWarehouseId
    );
    const reserved = getReservedQuantity(
      data.reservations,
      line.productId,
      transfer.sourceWarehouseId
    );
    const available = onHand - reserved;
    if (line.quantity > available) {
      return {
        ok: false,
        error: `Insufficient available stock for ${line.sku} in ${sourceWh.name} (Available: ${available}, Required: ${line.quantity}).`,
      };
    }
  }

  const now = input.timestamp ?? new Date().toISOString();
  const newMovements: StockMovement[] = [];

  for (const line of transfer.lines) {
    const beforeQty = getWarehouseOnHandFromLedger(
      [...newMovements, ...data.stockMovements],
      line.productId,
      transfer.sourceWarehouseId
    );
    const afterQty = beforeQty - line.quantity;

    newMovements.push({
      id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: now,
      productId: line.productId,
      sku: line.sku,
      productName: line.productName,
      warehouseId: transfer.sourceWarehouseId,
      movementType: 'TRANSFER_OUT',
      quantityDelta: -line.quantity,
      beforeQuantity: beforeQty,
      afterQuantity: afterQty,
      unitCostSnapshot: line.unitCostSnapshot,
      totalValueSnapshot: calculateInventoryValue(line.quantity, line.unitCostSnapshot),
      sourceReference: transfer.transferNumber,
      sourceId: transfer.id,
      reason: `Dispatched to ${destWh.name} (${destWh.code})`,
      actor: input.actor,
    });
  }

  const updatedTransfers = data.stockTransfers.map((t) =>
    t.id === transfer.id ? { ...t, status: 'IN_TRANSIT' as const, dispatchedAt: now } : t
  );

  const activity: Activity = {
    id: `act-${Date.now()}-disp`,
    timestamp: now,
    eventType: 'TRANSFER_DISPATCHED',
    title: `Transfer ${transfer.transferNumber} dispatched`,
    description: `In transit from ${sourceWh.name} to ${destWh.name}`,
    actor: input.actor,
    relatedDocumentId: transfer.id,
    relatedDocumentNumber: transfer.transferNumber,
    relatedRoute: '/dashboard/transfers',
  };

  return {
    ok: true,
    recordId: transfer.id,
    data: {
      ...data,
      stockTransfers: updatedTransfers,
      stockMovements: [...newMovements, ...data.stockMovements],
      activities: [activity, ...data.activities],
      processedOperationIds: [...data.processedOperationIds, input.operationId],
    },
  };
}

/**
 * 5. RECEIVE STOCK TRANSFER (IN_TRANSIT -> COMPLETED)
 * Increases destination warehouse on-hand stock and clears in-transit balance.
 */
export function receiveStockTransfer(
  data: StockoraData,
  input: {
    operationId: string;
    transferId: string;
    actor: string;
    timestamp?: string;
  }
): EngineResult {
  if (data.processedOperationIds.includes(input.operationId)) {
    return { ok: false, error: 'Duplicate transfer receipt operation rejected.' };
  }
  const transfer = data.stockTransfers.find((t) => t.id === input.transferId);
  if (!transfer) return { ok: false, error: 'Stock transfer not found.' };
  if (transfer.status === 'COMPLETED') {
    return { ok: false, error: 'Transfer has already been completed and cannot be received twice.' };
  }
  if (transfer.status !== 'IN_TRANSIT') {
    return {
      ok: false,
      error: `Cannot receive transfer in status ${transfer.status}. Transfer must be IN_TRANSIT.`,
    };
  }

  const sourceWh = data.warehouses.find((w) => w.id === transfer.sourceWarehouseId);
  const destWh = data.warehouses.find((w) => w.id === transfer.destinationWarehouseId);
  if (!sourceWh || !destWh) return { ok: false, error: 'Warehouse reference missing.' };

  const now = input.timestamp ?? new Date().toISOString();
  const newMovements: StockMovement[] = [];

  for (const line of transfer.lines) {
    const beforeQty = getWarehouseOnHandFromLedger(
      [...newMovements, ...data.stockMovements],
      line.productId,
      transfer.destinationWarehouseId
    );
    const afterQty = beforeQty + line.quantity;

    newMovements.push({
      id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: now,
      productId: line.productId,
      sku: line.sku,
      productName: line.productName,
      warehouseId: transfer.destinationWarehouseId,
      movementType: 'TRANSFER_IN',
      quantityDelta: line.quantity,
      beforeQuantity: beforeQty,
      afterQuantity: afterQty,
      unitCostSnapshot: line.unitCostSnapshot,
      totalValueSnapshot: calculateInventoryValue(line.quantity, line.unitCostSnapshot),
      sourceReference: transfer.transferNumber,
      sourceId: transfer.id,
      reason: `Received from ${sourceWh.name} (${sourceWh.code})`,
      actor: input.actor,
    });
  }

  const updatedTransfers = data.stockTransfers.map((t) =>
    t.id === transfer.id ? { ...t, status: 'COMPLETED' as const, receivedAt: now } : t
  );

  const activity: Activity = {
    id: `act-${Date.now()}-rec`,
    timestamp: now,
    eventType: 'TRANSFER_RECEIVED',
    title: `Transfer ${transfer.transferNumber} received`,
    description: `Completed receipt at ${destWh.name}`,
    actor: input.actor,
    relatedDocumentId: transfer.id,
    relatedDocumentNumber: transfer.transferNumber,
    relatedRoute: '/dashboard/transfers',
  };

  return {
    ok: true,
    recordId: transfer.id,
    data: {
      ...data,
      stockTransfers: updatedTransfers,
      stockMovements: [...newMovements, ...data.stockMovements],
      activities: [activity, ...data.activities],
      processedOperationIds: [...data.processedOperationIds, input.operationId],
    },
  };
}

/**
 * 6. CANCEL STOCK TRANSFER
 * - If DRAFT: marks as CANCELLED without stock changes.
 * - If IN_TRANSIT: requires resolution reason and posts compensating REVERSAL movement returning stock to source warehouse.
 */
export function cancelStockTransfer(
  data: StockoraData,
  input: {
    operationId: string;
    transferId: string;
    resolutionReason: string;
    actor: string;
    timestamp?: string;
  }
): EngineResult {
  if (data.processedOperationIds.includes(input.operationId)) {
    return { ok: false, error: 'Duplicate cancellation operation.' };
  }
  const transfer = data.stockTransfers.find((t) => t.id === input.transferId);
  if (!transfer) return { ok: false, error: 'Stock transfer not found.' };
  if (transfer.status === 'COMPLETED' || transfer.status === 'CANCELLED') {
    return { ok: false, error: `Cannot cancel a transfer with status ${transfer.status}.` };
  }

  const now = input.timestamp ?? new Date().toISOString();
  const newMovements: StockMovement[] = [];

  if (transfer.status === 'IN_TRANSIT') {
    if (!input.resolutionReason.trim()) {
      return {
        ok: false,
        error: 'Cancelling an in-transit transfer requires an explicit return resolution reason.',
      };
    }
    for (const line of transfer.lines) {
      const beforeQty = getWarehouseOnHandFromLedger(
        [...newMovements, ...data.stockMovements],
        line.productId,
        transfer.sourceWarehouseId
      );
      const afterQty = beforeQty + line.quantity;

      newMovements.push({
        id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: now,
        productId: line.productId,
        sku: line.sku,
        productName: line.productName,
        warehouseId: transfer.sourceWarehouseId,
        movementType: 'REVERSAL',
        quantityDelta: line.quantity,
        beforeQuantity: beforeQty,
        afterQuantity: afterQty,
        unitCostSnapshot: line.unitCostSnapshot,
        totalValueSnapshot: calculateInventoryValue(line.quantity, line.unitCostSnapshot),
        sourceReference: transfer.transferNumber,
        sourceId: transfer.id,
        reason: `In-transit return resolution: ${input.resolutionReason}`,
        actor: input.actor,
      });
    }
  }

  const updatedTransfers = data.stockTransfers.map((t) =>
    t.id === transfer.id ? { ...t, status: 'CANCELLED' as const, cancelledAt: now } : t
  );

  const activity: Activity = {
    id: `act-${Date.now()}-canc`,
    timestamp: now,
    eventType: 'TRANSFER_CANCELLED',
    title: `Transfer ${transfer.transferNumber} cancelled`,
    description: input.resolutionReason || 'Draft transfer cancelled',
    actor: input.actor,
    relatedDocumentId: transfer.id,
    relatedDocumentNumber: transfer.transferNumber,
    relatedRoute: '/dashboard/transfers',
  };

  return {
    ok: true,
    recordId: transfer.id,
    data: {
      ...data,
      stockTransfers: updatedTransfers,
      stockMovements: [...newMovements, ...data.stockMovements],
      activities: [activity, ...data.activities],
      processedOperationIds: [...data.processedOperationIds, input.operationId],
    },
  };
}

/**
 * 7. CREATE PURCHASE ORDER
 * Creating a PO does NOT increase inventory.
 */
export function createPurchaseOrder(
  data: StockoraData,
  input: {
    operationId: string;
    supplierId: string;
    warehouseId: string;
    orderDate: string;
    expectedDeliveryDate: string;
    status: 'DRAFT' | 'ORDERED';
    shippingCharges?: number;
    notes: string;
    actor: string;
    lines: Array<{
      productId: string;
      quantityOrdered: number;
      unitCost: number;
      discountAmount?: number;
      taxRate?: number;
    }>;
  }
): EngineResult {
  if (data.processedOperationIds.includes(input.operationId)) {
    return { ok: false, error: 'Purchase order already created.' };
  }
  const supplier = data.suppliers.find((s) => s.id === input.supplierId);
  if (!supplier) return { ok: false, error: 'Selected supplier does not exist.' };
  const warehouse = data.warehouses.find((w) => w.id === input.warehouseId);
  if (!warehouse) return { ok: false, error: 'Selected warehouse does not exist.' };
  if (!input.lines.length) {
    return { ok: false, error: 'Purchase order must contain at least one line item.' };
  }

  const poId = `po-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const poNumber = `PO-${new Date().getFullYear()}-${String(data.purchaseOrders.length + 1001).slice(-4)}`;

  const poLines = input.lines.map((l, idx) => {
    const product = data.products.find((p) => p.id === l.productId);
    if (!product) throw new Error(`Product ${l.productId} not found.`);
    if (l.quantityOrdered <= 0) throw new Error(`Quantity for ${product.sku} must be positive.`);

    const lineMath = calculatePurchaseOrderLine({
      quantityOrdered: l.quantityOrdered,
      unitCost: l.unitCost,
      discountAmount: l.discountAmount ?? 0,
      taxRate: l.taxRate ?? 0,
    });

    return {
      id: `pol-${Date.now()}-${idx}`,
      poId,
      productId: product.id,
      sku: product.sku,
      productName: product.name,
      quantityOrdered: l.quantityOrdered,
      quantityReceived: 0,
      unitCost: l.unitCost,
      discountAmount: lineMath.discountAmount,
      taxRate: l.taxRate ?? 0,
      lineSubtotal: lineMath.lineSubtotal,
      lineTax: lineMath.lineTax,
      lineTotal: lineMath.lineTotal,
    };
  });

  const totals = calculatePurchaseOrderTotals(poLines, input.shippingCharges ?? 0);
  const now = new Date().toISOString();

  const newPO: PurchaseOrder = {
    id: poId,
    poNumber,
    supplierId: supplier.id,
    warehouseId: warehouse.id,
    orderDate: input.orderDate,
    expectedDeliveryDate: input.expectedDeliveryDate,
    status: input.status,
    lines: poLines,
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    taxTotal: totals.taxTotal,
    shippingCharges: totals.shippingCharges,
    totalAmount: totals.totalAmount,
    notes: input.notes,
    createdBy: input.actor,
    createdAt: now,
    updatedAt: now,
  };

  const activity: Activity = {
    id: `act-${Date.now()}-po`,
    timestamp: now,
    eventType: 'PO_CREATED',
    title: `Purchase Order ${poNumber} created`,
    description: `${supplier.companyName} — $${totals.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    actor: input.actor,
    relatedDocumentId: poId,
    relatedDocumentNumber: poNumber,
    relatedRoute: '/dashboard/purchase-orders',
  };

  return {
    ok: true,
    recordId: poId,
    data: {
      ...data,
      purchaseOrders: [newPO, ...data.purchaseOrders],
      activities: [activity, ...data.activities],
      processedOperationIds: [...data.processedOperationIds, input.operationId],
    },
  };
}

/**
 * 8. POST GOODS RECEIPT AGAINST PURCHASE ORDER
 * - Validates Ordered or Partially Received PO
 * - Prevents over-receipt unless allowOverReceipt is explicitly enabled
 * - Accepted quantities increase warehouse stock & update Moving Weighted Average Cost
 * - Rejected quantities are recorded on the GRN without increasing usable inventory
 * - Updates PO status to PARTIALLY_RECEIVED or RECEIVED
 */
export function postGoodsReceipt(
  data: StockoraData,
  input: {
    operationId: string;
    poId: string;
    warehouseId: string;
    receivedBy: string;
    notes: string;
    allowOverReceipt?: boolean;
    timestamp?: string;
    lines: Array<{
      poLineId: string;
      acceptedQuantity: number;
      rejectedQuantity: number;
      rejectionReason?: string;
    }>;
  }
): EngineResult {
  if (data.processedOperationIds.includes(input.operationId)) {
    return { ok: false, error: 'Duplicate goods receipt submission prevented.' };
  }

  const po = data.purchaseOrders.find((p) => p.id === input.poId);
  if (!po) return { ok: false, error: 'Purchase order not found.' };
  if (po.status !== 'ORDERED' && po.status !== 'PARTIALLY_RECEIVED') {
    return {
      ok: false,
      error: `Cannot receive goods for PO in ${po.status} status. PO must be ORDERED or PARTIALLY_RECEIVED.`,
    };
  }

  const warehouse = data.warehouses.find((w) => w.id === input.warehouseId);
  if (!warehouse) return { ok: false, error: 'Receiving warehouse not found.' };

  const activeLines = input.lines.filter(
    (l) => l.acceptedQuantity > 0 || l.rejectedQuantity > 0
  );
  if (!activeLines.length) {
    return { ok: false, error: 'Enter at least one accepted or rejected quantity to post receipt.' };
  }

  // Validate quantities against outstanding PO lines
  for (const inputLine of activeLines) {
    if (inputLine.acceptedQuantity < 0 || inputLine.rejectedQuantity < 0) {
      return { ok: false, error: 'Received quantities cannot be negative.' };
    }
    const poLine = po.lines.find((l) => l.id === inputLine.poLineId);
    if (!poLine) return { ok: false, error: 'Invalid purchase order line reference.' };

    const outstanding = Math.max(0, poLine.quantityOrdered - poLine.quantityReceived);
    const totalReceivingNow = inputLine.acceptedQuantity + inputLine.rejectedQuantity;
    if (!input.allowOverReceipt && totalReceivingNow > outstanding) {
      return {
        ok: false,
        error: `Over-receipt rejected for ${poLine.sku}: receiving ${totalReceivingNow} exceeds outstanding quantity of ${outstanding}.`,
      };
    }
  }

  const now = input.timestamp ?? new Date().toISOString();
  const receiptId = `grn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const grnNumber = `GRN-${new Date().getFullYear()}-${String(data.goodsReceipts.length + 1001).slice(-4)}`;

  const receiptLines: GoodsReceiptLine[] = [];
  const newMovements: StockMovement[] = [];
  const updatedProductsMap = new Map<string, Product>(data.products.map((p) => [p.id, p]));

  const updatedPoLines = po.lines.map((poLine) => {
    const recInput = activeLines.find((l) => l.poLineId === poLine.id);
    if (!recInput) return poLine;

    const totalReceivedLine = recInput.acceptedQuantity + recInput.rejectedQuantity;
    receiptLines.push({
      id: `grnl-${Date.now()}-${poLine.id}`,
      receiptId,
      poLineId: poLine.id,
      productId: poLine.productId,
      sku: poLine.sku,
      productName: poLine.productName,
      receivedQuantity: totalReceivedLine,
      acceptedQuantity: recInput.acceptedQuantity,
      rejectedQuantity: recInput.rejectedQuantity,
      unitCost: poLine.unitCost,
      rejectionReason: recInput.rejectionReason,
    });

    if (recInput.acceptedQuantity > 0) {
      const product = updatedProductsMap.get(poLine.productId)!;
      const currentWhOnHand = getWarehouseOnHandFromLedger(
        [...newMovements, ...data.stockMovements],
        poLine.productId,
        warehouse.id
      );
      const totalOrgOnHand = getTotalProductOnHandFromLedger(
        [...newMovements, ...data.stockMovements],
        poLine.productId
      );

      const newMovingAvg = calculateMovingAverageCost(
        totalOrgOnHand,
        product.movingAverageCost || product.purchaseCost,
        recInput.acceptedQuantity,
        poLine.unitCost
      );

      updatedProductsMap.set(product.id, {
        ...product,
        movingAverageCost: newMovingAvg,
        purchaseCost: poLine.unitCost,
        updatedAt: now,
      });

      newMovements.push({
        id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: now,
        productId: product.id,
        sku: product.sku,
        productName: product.name,
        warehouseId: warehouse.id,
        movementType: 'PURCHASE_RECEIPT',
        quantityDelta: recInput.acceptedQuantity,
        beforeQuantity: currentWhOnHand,
        afterQuantity: currentWhOnHand + recInput.acceptedQuantity,
        unitCostSnapshot: poLine.unitCost,
        totalValueSnapshot: calculateInventoryValue(recInput.acceptedQuantity, poLine.unitCost),
        sourceReference: `${grnNumber} (${po.poNumber})`,
        sourceId: receiptId,
        reason: `Goods receipt against ${po.poNumber}${recInput.rejectedQuantity > 0 ? ` (${recInput.rejectedQuantity} rejected)` : ''}`,
        actor: input.receivedBy,
      });
    }

    // Accepted quantities count toward fulfilled PO quantity
    return {
      ...poLine,
      quantityReceived: poLine.quantityReceived + recInput.acceptedQuantity,
    };
  });

  const allFulfilled = updatedPoLines.every((l) => l.quantityReceived >= l.quantityOrdered);
  const anyReceived = updatedPoLines.some((l) => l.quantityReceived > 0);
  const nextPoStatus: PurchaseOrderStatus = allFulfilled
    ? 'RECEIVED'
    : anyReceived
      ? 'PARTIALLY_RECEIVED'
      : po.status;

  const updatedPurchaseOrders = data.purchaseOrders.map((p) =>
    p.id === po.id
      ? {
          ...p,
          lines: updatedPoLines,
          status: nextPoStatus,
          updatedAt: now,
        }
      : p
  );

  const newReceipt: GoodsReceipt = {
    id: receiptId,
    grnNumber,
    poId: po.id,
    poNumber: po.poNumber,
    supplierId: po.supplierId,
    warehouseId: warehouse.id,
    receivedDate: now,
    receivedBy: input.receivedBy,
    notes: input.notes,
    lines: receiptLines,
    createdAt: now,
  };

  const totalAccepted = receiptLines.reduce((s, l) => s + l.acceptedQuantity, 0);
  const activity: Activity = {
    id: `act-${Date.now()}-grn`,
    timestamp: now,
    eventType: 'GOODS_RECEIVED',
    title: `Goods Receipt ${grnNumber} posted`,
    description: `Received ${totalAccepted} accepted units for ${po.poNumber} into ${warehouse.name}`,
    actor: input.receivedBy,
    relatedDocumentId: receiptId,
    relatedDocumentNumber: grnNumber,
    relatedRoute: '/dashboard/receiving',
  };

  return {
    ok: true,
    recordId: receiptId,
    data: {
      ...data,
      products: Array.from(updatedProductsMap.values()),
      purchaseOrders: updatedPurchaseOrders,
      goodsReceipts: [newReceipt, ...data.goodsReceipts],
      stockMovements: [...newMovements, ...data.stockMovements],
      activities: [activity, ...data.activities],
      processedOperationIds: [...data.processedOperationIds, input.operationId],
    },
  };
}

/**
 * 9. REVERSE A POSTED STOCK MOVEMENT (COMPENSATING ENTRY)
 * Posted movements are never destructively edited or deleted; corrections post a REVERSAL entry.
 */
export function reversePostedMovement(
  data: StockoraData,
  input: {
    operationId: string;
    movementId: string;
    reason: string;
    actor: string;
    allowNegativeStock?: boolean;
    timestamp?: string;
  }
): EngineResult {
  if (data.processedOperationIds.includes(input.operationId)) {
    return { ok: false, error: 'Duplicate reversal operation.' };
  }
  const target = data.stockMovements.find((m) => m.id === input.movementId);
  if (!target) return { ok: false, error: 'Original movement record not found.' };
  if (target.reversedByMovementId) {
    return { ok: false, error: 'This movement has already been reversed.' };
  }
  if (target.movementType === 'REVERSAL') {
    return { ok: false, error: 'Cannot reverse a reversal entry.' };
  }
  if (!input.reason.trim()) {
    return { ok: false, error: 'A reversal reason is required for audit traceability.' };
  }

  const currentOnHand = getWarehouseOnHandFromLedger(
    data.stockMovements,
    target.productId,
    target.warehouseId
  );
  const compensatingDelta = -target.quantityDelta;
  const afterQuantity = currentOnHand + compensatingDelta;

  if (!input.allowNegativeStock && afterQuantity < 0) {
    return {
      ok: false,
      error: `Reversal would cause negative stock (${afterQuantity}) for ${target.sku}.`,
    };
  }

  const now = input.timestamp ?? new Date().toISOString();
  const reversalId = `mov-rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const reversalMovement: StockMovement = {
    id: reversalId,
    timestamp: now,
    productId: target.productId,
    sku: target.sku,
    productName: target.productName,
    warehouseId: target.warehouseId,
    movementType: 'REVERSAL',
    quantityDelta: compensatingDelta,
    beforeQuantity: currentOnHand,
    afterQuantity,
    unitCostSnapshot: target.unitCostSnapshot,
    totalValueSnapshot: target.totalValueSnapshot,
    sourceReference: `REV-${target.sourceReference}`,
    sourceId: target.id,
    reason: `Compensating reversal of ${target.id}: ${input.reason}`,
    actor: input.actor,
    reversesMovementId: target.id,
  };

  const updatedMovements = [
    reversalMovement,
    ...data.stockMovements.map((m) =>
      m.id === target.id ? { ...m, reversedByMovementId: reversalId } : m
    ),
  ];

  const activity: Activity = {
    id: `act-${Date.now()}-rev`,
    timestamp: now,
    eventType: 'REVERSAL_POSTED',
    title: `Movement reversal posted for ${target.sku}`,
    description: `Reversed ${target.sourceReference} (${compensatingDelta > 0 ? '+' : ''}${compensatingDelta} units)`,
    actor: input.actor,
    relatedDocumentId: reversalId,
    relatedDocumentNumber: reversalMovement.sourceReference,
    relatedRoute: '/dashboard/movements',
  };

  return {
    ok: true,
    recordId: reversalId,
    data: {
      ...data,
      stockMovements: updatedMovements,
      activities: [activity, ...data.activities],
      processedOperationIds: [...data.processedOperationIds, input.operationId],
    },
  };
}

/**
 * 10. STOCK RESERVATION & RELEASE
 */
export function createStockReservation(
  data: StockoraData,
  input: {
    operationId: string;
    productId: string;
    warehouseId: string;
    quantity: number;
    referenceDocument: string;
    actor: string;
  }
): EngineResult {
  if (data.processedOperationIds.includes(input.operationId)) {
    return { ok: false, error: 'Duplicate reservation operation.' };
  }
  if (input.quantity <= 0) return { ok: false, error: 'Reservation quantity must be positive.' };
  const product = data.products.find((p) => p.id === input.productId);
  if (!product) return { ok: false, error: 'Product not found.' };

  const onHand = getWarehouseOnHandFromLedger(data.stockMovements, input.productId, input.warehouseId);
  const reserved = getReservedQuantity(data.reservations, input.productId, input.warehouseId);
  const available = onHand - reserved;
  if (input.quantity > available) {
    return {
      ok: false,
      error: `Cannot reserve ${input.quantity} units. Available stock is ${available}.`,
    };
  }

  const now = new Date().toISOString();
  const resId = `res-${Date.now()}`;
  const reservation: StockReservation = {
    id: resId,
    productId: product.id,
    sku: product.sku,
    warehouseId: input.warehouseId,
    quantity: input.quantity,
    referenceDocument: input.referenceDocument,
    status: 'ACTIVE',
    createdAt: now,
  };

  const movement: StockMovement = {
    id: `mov-${Date.now()}-res`,
    timestamp: now,
    productId: product.id,
    sku: product.sku,
    productName: product.name,
    warehouseId: input.warehouseId,
    movementType: 'RESERVATION',
    quantityDelta: -input.quantity,
    beforeQuantity: available,
    afterQuantity: available - input.quantity,
    unitCostSnapshot: product.movingAverageCost || product.purchaseCost,
    totalValueSnapshot: calculateInventoryValue(
      input.quantity,
      product.movingAverageCost || product.purchaseCost
    ),
    sourceReference: input.referenceDocument,
    sourceId: resId,
    reason: `Stock reserved for ${input.referenceDocument}`,
    actor: input.actor,
  };

  return {
    ok: true,
    recordId: resId,
    data: {
      ...data,
      reservations: [reservation, ...data.reservations],
      stockMovements: [movement, ...data.stockMovements],
      processedOperationIds: [...data.processedOperationIds, input.operationId],
    },
  };
}

export function releaseStockReservation(
  data: StockoraData,
  input: {
    operationId: string;
    reservationId: string;
    actor: string;
  }
): EngineResult {
  if (data.processedOperationIds.includes(input.operationId)) {
    return { ok: false, error: 'Duplicate reservation release.' };
  }
  const res = data.reservations.find((r) => r.id === input.reservationId);
  if (!res || res.status !== 'ACTIVE') {
    return { ok: false, error: 'Active reservation not found.' };
  }
  const product = data.products.find((p) => p.id === res.productId)!;
  const onHand = getWarehouseOnHandFromLedger(data.stockMovements, res.productId, res.warehouseId);
  const reserved = getReservedQuantity(data.reservations, res.productId, res.warehouseId);
  const available = onHand - reserved;
  const now = new Date().toISOString();

  const movement: StockMovement = {
    id: `mov-${Date.now()}-rel`,
    timestamp: now,
    productId: res.productId,
    sku: res.sku,
    productName: product?.name ?? res.sku,
    warehouseId: res.warehouseId,
    movementType: 'RESERVATION_RELEASE',
    quantityDelta: res.quantity,
    beforeQuantity: available,
    afterQuantity: available + res.quantity,
    unitCostSnapshot: product?.movingAverageCost ?? 0,
    totalValueSnapshot: 0,
    sourceReference: res.referenceDocument,
    sourceId: res.id,
    reason: `Reservation released for ${res.referenceDocument}`,
    actor: input.actor,
  };

  return {
    ok: true,
    recordId: res.id,
    data: {
      ...data,
      reservations: data.reservations.map((r) =>
        r.id === res.id ? { ...r, status: 'RELEASED' as const, releasedAt: now } : r
      ),
      stockMovements: [movement, ...data.stockMovements],
      processedOperationIds: [...data.processedOperationIds, input.operationId],
    },
  };
}

/**
 * 11. ARCHIVE WAREHOUSE GUARD
 * Prevents archiving an active warehouse if it still holds positive on-hand stock
 * or has unresolved IN_TRANSIT transfers.
 */
export function canArchiveWarehouse(
  data: StockoraData,
  warehouseId: string
): { allowed: boolean; reason?: string } {
  for (const product of data.products) {
    const qty = getWarehouseOnHandFromLedger(data.stockMovements, product.id, warehouseId);
    if (qty > 0) {
      return {
        allowed: false,
        reason: `Cannot archive warehouse: holds ${qty} units of ${product.sku} (${product.name}). Transfer or adjust stock to zero first.`,
      };
    }
  }

  const pendingTransfer = data.stockTransfers.find(
    (t) =>
      (t.sourceWarehouseId === warehouseId || t.destinationWarehouseId === warehouseId) &&
      (t.status === 'IN_TRANSIT' || t.status === 'DRAFT')
  );
  if (pendingTransfer) {
    return {
      allowed: false,
      reason: `Cannot archive warehouse: unresolved transfer ${pendingTransfer.transferNumber} (${pendingTransfer.status}).`,
    };
  }

  return { allowed: true };
}
