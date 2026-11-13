import { describe, expect, it } from 'vitest';
import {
  calculateInventoryValue,
  calculateMovingAverageCost,
  calculatePurchaseOrderLine,
  calculatePurchaseOrderTotals,
  calculateSuggestedReorderQuantity,
} from '../lib/calculations';
import {
  canArchiveWarehouse,
  cancelStockTransfer,
  createPurchaseOrder,
  createStockReservation,
  createStockTransfer,
  deriveInventoryBalances,
  deriveStockStatus,
  dispatchStockTransfer,
  getConfirmedIncomingStock,
  getInTransitUnits,
  getReorderRecommendations,
  getWarehouseOnHandFromLedger,
  postGoodsReceipt,
  postOpeningStock,
  postStockAdjustment,
  receiveStockTransfer,
  releaseStockReservation,
  reversePostedMovement,
} from '../lib/inventory-engine';
import { generateDeterministicSeedData, DEFAULT_WORKSPACE_SETTINGS } from '../lib/seed';
import {
  exportStockoraBackupJson,
  restoreStockoraBackupJson,
  validateStockoraDataset,
} from '../lib/storage';
import { generateCsvContent } from '../lib/export';

describe('STOCKORA ERP — Comprehensive Automated Verification Suite', () => {
  it('1-5. deterministic seed initializes valid products, unique SKUs, categories, warehouses, and suppliers', () => {
    const seed = generateDeterministicSeedData();
    expect(seed.warehouses.length).toBe(5);
    expect(seed.categories.length).toBe(15);
    expect(seed.suppliers.length).toBe(30);
    expect(seed.products.length).toBeGreaterThanOrEqual(45);

    const skus = seed.products.map((p) => p.sku);
    const uniqueSkus = new Set(skus);
    expect(uniqueSkus.size).toBe(skus.length);
  });

  it('6-7. warehouse archiving rules block archiving when positive stock or pending transfers exist', () => {
    const seed = generateDeterministicSeedData();
    const checkActive = canArchiveWarehouse(seed, 'wh-01');
    expect(checkActive.allowed).toBe(false);
    expect(checkActive.reason).toContain('Cannot archive warehouse');

    // Empty new warehouse can be archived
    const withEmptyWh = {
      ...seed,
      warehouses: [
        ...seed.warehouses,
        {
          id: 'wh-empty',
          name: 'Empty Test Hub',
          code: 'EMP-99',
          location: 'Test',
          manager: 'Tester',
          capacityDescription: 'Test',
          maxCapacityUnits: 1000,
          status: 'ACTIVE' as const,
          createdAt: new Date().toISOString(),
        },
      ],
    };
    const checkEmpty = canArchiveWarehouse(withEmptyWh, 'wh-empty');
    expect(checkEmpty.allowed).toBe(true);
  });

  it('8-11. opening stock, positive adjustment, negative adjustment, and negative stock prevention', () => {
    const seed = generateDeterministicSeedData();
    const product = seed.products[0];

    const openRes = postOpeningStock(seed, {
      operationId: 'test-open-1',
      productId: product.id,
      warehouseId: 'wh-01',
      quantity: 25,
      unitCost: 400,
      actor: 'Tester',
    });
    expect(openRes.ok).toBe(true);

    const beforeAdj = getWarehouseOnHandFromLedger(
      openRes.data!.stockMovements,
      product.id,
      'wh-01'
    );

    const posAdj = postStockAdjustment(openRes.data!, {
      operationId: 'test-adj-pos',
      warehouseId: 'wh-01',
      productId: product.id,
      adjustmentType: 'POSITIVE',
      quantity: 10,
      reason: 'Found',
      notes: 'Found in bin',
      actor: 'Tester',
    });
    expect(posAdj.ok).toBe(true);
    const afterPos = getWarehouseOnHandFromLedger(
      posAdj.data!.stockMovements,
      product.id,
      'wh-01'
    );
    expect(afterPos).toBe(beforeAdj + 10);

    const negAdj = postStockAdjustment(posAdj.data!, {
      operationId: 'test-adj-neg',
      warehouseId: 'wh-01',
      productId: product.id,
      adjustmentType: 'NEGATIVE',
      quantity: 5,
      reason: 'Damaged',
      notes: 'Damaged unit',
      actor: 'Tester',
    });
    expect(negAdj.ok).toBe(true);
    const afterNeg = getWarehouseOnHandFromLedger(
      negAdj.data!.stockMovements,
      product.id,
      'wh-01'
    );
    expect(afterNeg).toBe(afterPos - 5);

    // Negative stock prevention
    const excessiveNeg = postStockAdjustment(negAdj.data!, {
      operationId: 'test-adj-excessive',
      warehouseId: 'wh-01',
      productId: product.id,
      adjustmentType: 'NEGATIVE',
      quantity: afterNeg + 500,
      reason: 'Lost',
      notes: 'Should fail',
      actor: 'Tester',
      allowNegativeStock: false,
    });
    expect(excessiveNeg.ok).toBe(false);
    expect(excessiveNeg.error).toContain('Insufficient stock');
  });

  it('12-21. stock transfer lifecycle: 120 + 30 = 150 units reconciliation, in-transit tracking, duplicate & same-warehouse guards', () => {
    const base = generateDeterministicSeedData();
    // Create clean test product with 120 units in Warehouse A (wh-01) and 30 units in Warehouse B (wh-02)
    const testProdId = 'prd-transfer-test';
    const state0 = {
      ...base,
      stockTransfers: [],
      products: [
        ...base.products,
        {
          id: testProdId,
          sku: 'TRF-TEST-150',
          barcode: '890425999999',
          name: 'Transfer Reconciliation Test Sensor',
          categoryId: 'cat-01',
          brand: 'Stockora',
          description: 'Test',
          unitOfMeasure: 'pcs',
          sellingPrice: 100,
          purchaseCost: 50,
          movingAverageCost: 50,
          preferredSupplierId: 'sup-01',
          status: 'ACTIVE' as const,
          reorderPoint: 10,
          targetStock: 100,
          variants: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    };

    const s1 = postOpeningStock(state0, {
      operationId: 'open-whA-120',
      productId: testProdId,
      warehouseId: 'wh-01',
      quantity: 120,
      unitCost: 50,
      actor: 'Tester',
    }).data!;

    const s2 = postOpeningStock(s1, {
      operationId: 'open-whB-30',
      productId: testProdId,
      warehouseId: 'wh-02',
      quantity: 30,
      unitCost: 50,
      actor: 'Tester',
    }).data!;

    // Initial check: Wh A = 120, Wh B = 30, In Transit = 0
    expect(getWarehouseOnHandFromLedger(s2.stockMovements, testProdId, 'wh-01')).toBe(120);
    expect(getWarehouseOnHandFromLedger(s2.stockMovements, testProdId, 'wh-02')).toBe(30);
    expect(getInTransitUnits(s2, testProdId)).toBe(0);

    // Reject same-warehouse transfer
    const sameWh = createStockTransfer(s2, {
      operationId: 'trf-same',
      sourceWarehouseId: 'wh-01',
      destinationWarehouseId: 'wh-01',
      lines: [{ productId: testProdId, quantity: 10 }],
      referenceNotes: 'Invalid',
      actor: 'Tester',
    });
    expect(sameWh.ok).toBe(false);

    // Reject insufficient stock transfer
    const insuff = createStockTransfer(s2, {
      operationId: 'trf-insuff',
      sourceWarehouseId: 'wh-01',
      destinationWarehouseId: 'wh-02',
      lines: [{ productId: testProdId, quantity: 500 }],
      referenceNotes: 'Too many',
      actor: 'Tester',
    });
    expect(insuff.ok).toBe(false);

    // Create Draft transfer of 50 units
    const created = createStockTransfer(s2, {
      operationId: 'trf-create-50',
      sourceWarehouseId: 'wh-01',
      destinationWarehouseId: 'wh-02',
      lines: [{ productId: testProdId, quantity: 50 }],
      referenceNotes: 'Move 50 units',
      actor: 'Tester',
      dispatchImmediately: false,
    });
    expect(created.ok).toBe(true);
    const trfId = created.recordId!;

    // Dispatch 50 units: Wh A = 70, Wh B = 30, In Transit = 50 (Total = 150)
    const dispatched = dispatchStockTransfer(created.data!, {
      operationId: 'trf-disp-50',
      transferId: trfId,
      actor: 'Tester',
    });
    expect(dispatched.ok).toBe(true);
    expect(getWarehouseOnHandFromLedger(dispatched.data!.stockMovements, testProdId, 'wh-01')).toBe(70);
    expect(getWarehouseOnHandFromLedger(dispatched.data!.stockMovements, testProdId, 'wh-02')).toBe(30);
    expect(getInTransitUnits(dispatched.data!, testProdId)).toBe(50);

    // Prevent duplicate dispatch
    const dupDisp = dispatchStockTransfer(dispatched.data!, {
      operationId: 'trf-disp-dup',
      transferId: trfId,
      actor: 'Tester',
    });
    expect(dupDisp.ok).toBe(false);

    // Receive transfer: Wh A = 70, Wh B = 80, In Transit = 0 (Total = 150)
    const received = receiveStockTransfer(dispatched.data!, {
      operationId: 'trf-rec-50',
      transferId: trfId,
      actor: 'Tester',
    });
    expect(received.ok).toBe(true);
    expect(getWarehouseOnHandFromLedger(received.data!.stockMovements, testProdId, 'wh-01')).toBe(70);
    expect(getWarehouseOnHandFromLedger(received.data!.stockMovements, testProdId, 'wh-02')).toBe(80);
    expect(getInTransitUnits(received.data!, testProdId)).toBe(0);

    // Prevent duplicate receipt
    const dupRec = receiveStockTransfer(received.data!, {
      operationId: 'trf-rec-dup',
      transferId: trfId,
      actor: 'Tester',
    });
    expect(dupRec.ok).toBe(false);
  });

  it('22-27. purchase order creation, decimal calculations, partial & full goods receiving, and over-receipt rejection', () => {
    const seed = generateDeterministicSeedData();
    const prod = seed.products[0];
    const beforeOnHand = getWarehouseOnHandFromLedger(seed.stockMovements, prod.id, 'wh-01');

    const poRes = createPurchaseOrder(seed, {
      operationId: 'po-test-1',
      supplierId: 'sup-01',
      warehouseId: 'wh-01',
      orderDate: new Date().toISOString(),
      expectedDeliveryDate: new Date().toISOString(),
      status: 'ORDERED',
      shippingCharges: 50,
      notes: 'Test PO',
      actor: 'Tester',
      lines: [
        {
          productId: prod.id,
          quantityOrdered: 20,
          unitCost: 100,
          discountAmount: 100,
          taxRate: 10,
        },
      ],
    });
    expect(poRes.ok).toBe(true);
    const createdPO = poRes.data!.purchaseOrders[0];
    // Subtotal = 2000, Discount = 100 -> Taxable = 1900, Tax (10%) = 190, Shipping = 50 -> Total = 2140
    expect(createdPO.totalAmount).toBe(2140);

    // Creating a PO must not increase stock
    const afterPoOnHand = getWarehouseOnHandFromLedger(
      poRes.data!.stockMovements,
      prod.id,
      'wh-01'
    );
    expect(afterPoOnHand).toBe(beforeOnHand);

    // Partial receiving: accept 8, reject 2 (rejected does not increase usable stock)
    const grn1 = postGoodsReceipt(poRes.data!, {
      operationId: 'grn-test-partial',
      poId: createdPO.id,
      warehouseId: 'wh-01',
      receivedBy: 'Tester',
      notes: 'Partial delivery',
      lines: [
        {
          poLineId: createdPO.lines[0].id,
          acceptedQuantity: 8,
          rejectedQuantity: 2,
          rejectionReason: 'Dented housing',
        },
      ],
    });
    expect(grn1.ok).toBe(true);
    expect(getWarehouseOnHandFromLedger(grn1.data!.stockMovements, prod.id, 'wh-01')).toBe(
      beforeOnHand + 8
    );
    const updatedPO1 = grn1.data!.purchaseOrders.find((p) => p.id === createdPO.id)!;
    expect(updatedPO1.status).toBe('PARTIALLY_RECEIVED');

    // Reject over-quantity receipt
    const overRec = postGoodsReceipt(grn1.data!, {
      operationId: 'grn-test-over',
      poId: createdPO.id,
      warehouseId: 'wh-01',
      receivedBy: 'Tester',
      notes: 'Over receipt',
      allowOverReceipt: false,
      lines: [
        {
          poLineId: createdPO.lines[0].id,
          acceptedQuantity: 50,
          rejectedQuantity: 0,
        },
      ],
    });
    expect(overRec.ok).toBe(false);
    expect(overRec.error).toContain('Over-receipt rejected');

    // Receive remaining 12 units -> status becomes RECEIVED
    const grn2 = postGoodsReceipt(grn1.data!, {
      operationId: 'grn-test-full',
      poId: createdPO.id,
      warehouseId: 'wh-01',
      receivedBy: 'Tester',
      notes: 'Final delivery',
      lines: [
        {
          poLineId: createdPO.lines[0].id,
          acceptedQuantity: 12,
          rejectedQuantity: 0,
        },
      ],
    });
    expect(grn2.ok).toBe(true);
    const updatedPO2 = grn2.data!.purchaseOrders.find((p) => p.id === createdPO.id)!;
    expect(updatedPO2.status).toBe('RECEIVED');
  });

  it('29-33. Moving Weighted Average Cost, inventory valuation, reorder formula, and stock status derivation', () => {
    // (100 * $10.00 + 50 * $16.00) / 150 = $1800 / 150 = $12.00
    const mwac = calculateMovingAverageCost(100, 10, 50, 16);
    expect(mwac).toBe(12);

    // Zero initial quantity -> receipt cost becomes average cost
    expect(calculateMovingAverageCost(0, 0, 25, 44.5)).toBe(44.5);

    // Valuation
    expect(calculateInventoryValue(40, 12.5)).toBe(500);

    // Reorder Formula: Max(0, Target 100 - Available 20 - Incoming 30) = 50
    expect(
      calculateSuggestedReorderQuantity({
        targetStock: 100,
        availableStock: 20,
        confirmedIncomingStock: 30,
      })
    ).toBe(50);

    // Stock status derivation
    expect(deriveStockStatus(0, 20)).toBe('OUT_OF_STOCK');
    expect(deriveStockStatus(15, 20)).toBe('LOW_STOCK');
    expect(deriveStockStatus(45, 20)).toBe('IN_STOCK');
  });

  it('36-47. CSV export, JSON backup/restore validation, invalid backup rejection, and compensating reversal preservation', () => {
    const seed = generateDeterministicSeedData();

    const csv = generateCsvContent(
      [{ sku: 'PLC-100', name: 'Controller, Modular', qty: 10 }],
      [
        { key: 'sku', header: 'SKU' },
        { key: 'name', header: 'Product Name' },
        { key: 'qty', header: 'Quantity' },
      ]
    );
    expect(csv).toContain('"Controller, Modular"');

    // JSON Backup & Restore
    const backupStr = exportStockoraBackupJson(seed, DEFAULT_WORKSPACE_SETTINGS);
    const restored = restoreStockoraBackupJson(backupStr);
    expect(restored.ok).toBe(true);
    expect(restored.data?.products.length).toBe(seed.products.length);

    // Reject invalid backup with missing foreign product reference
    const invalidCheck = validateStockoraDataset({
      ...seed,
      stockMovements: [
        {
          ...seed.stockMovements[0],
          id: 'mov-bad-ref',
          productId: 'non-existent-product-id',
        },
      ],
    });
    expect(invalidCheck.valid).toBe(false);
    expect(invalidCheck.error).toContain('non-existent product ID');

    // Compensating reversal preserves original movement history
    const targetMov = seed.stockMovements.find((m) => m.movementType === 'POSITIVE_ADJUSTMENT')!;
    const revRes = reversePostedMovement(seed, {
      operationId: 'rev-test-1',
      movementId: targetMov.id,
      reason: 'Audit correction',
      actor: 'Tester',
    });
    expect(revRes.ok).toBe(true);
    expect(revRes.data!.stockMovements.length).toBe(seed.stockMovements.length + 1);
    expect(revRes.data!.stockMovements[0].movementType).toBe('REVERSAL');
  });
});
