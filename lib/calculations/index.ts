import Decimal from 'decimal.js';
import { PurchaseOrderLine } from '@/types/erp';

// Configure Decimal for standard financial precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Moving Weighted Average Cost calculation:
 * New Average Cost = (Existing Quantity * Existing Average Cost + Received Quantity * Receipt Unit Cost) / (Existing Quantity + Received Quantity)
 *
 * Rules:
 * - If existingQuantity <= 0 and receivedQuantity > 0, new average cost is receiptUnitCost.
 * - If existingQuantity + receivedQuantity <= 0, preserve existingAverageCost or fallback to receiptUnitCost.
 * - Rounded to 2 decimal places for monetary consistency.
 */
export function calculateMovingAverageCost(
  existingQuantity: number,
  existingAverageCost: number,
  receivedQuantity: number,
  receiptUnitCost: number
): number {
  if (receivedQuantity <= 0) {
    return new Decimal(existingAverageCost).toDecimalPlaces(2).toNumber();
  }
  const safeExistingQty = Math.max(0, existingQuantity);
  if (safeExistingQty === 0) {
    return new Decimal(receiptUnitCost).toDecimalPlaces(2).toNumber();
  }

  const existingTotalVal = new Decimal(safeExistingQty).times(existingAverageCost);
  const incomingTotalVal = new Decimal(receivedQuantity).times(receiptUnitCost);
  const combinedQty = new Decimal(safeExistingQty).plus(receivedQuantity);

  if (combinedQty.lte(0)) {
    return new Decimal(receiptUnitCost).toDecimalPlaces(2).toNumber();
  }

  return existingTotalVal
    .plus(incomingTotalVal)
    .dividedBy(combinedQty)
    .toDecimalPlaces(2)
    .toNumber();
}

/**
 * Calculate line item financial totals using Decimal arithmetic.
 * Line Subtotal = Quantity * Unit Cost
 * Discounted Line = Max(0, Line Subtotal - Applicable Discount)
 * Tax = Discounted Line * (Tax Rate / 100)
 * Line Total = Discounted Line + Tax
 */
export function calculatePurchaseOrderLine(params: {
  quantityOrdered: number;
  unitCost: number;
  discountAmount?: number;
  taxRate?: number;
}): {
  lineSubtotal: number;
  discountAmount: number;
  lineTax: number;
  lineTotal: number;
} {
  const qty = new Decimal(Math.max(0, params.quantityOrdered));
  const cost = new Decimal(Math.max(0, params.unitCost));
  const subtotal = qty.times(cost).toDecimalPlaces(2);

  const rawDiscount = new Decimal(Math.max(0, params.discountAmount ?? 0)).toDecimalPlaces(2);
  const discount = Decimal.min(subtotal, rawDiscount);
  const taxableAmount = subtotal.minus(discount);

  const taxRate = new Decimal(Math.max(0, params.taxRate ?? 0));
  const lineTax = taxableAmount.times(taxRate).dividedBy(100).toDecimalPlaces(2);
  const lineTotal = taxableAmount.plus(lineTax).toDecimalPlaces(2);

  return {
    lineSubtotal: subtotal.toNumber(),
    discountAmount: discount.toNumber(),
    lineTax: lineTax.toNumber(),
    lineTotal: lineTotal.toNumber(),
  };
}

/**
 * Calculate complete Purchase Order header financial totals from lines and shipping charges.
 */
export function calculatePurchaseOrderTotals(
  lines: Array<Pick<PurchaseOrderLine, 'quantityOrdered' | 'unitCost' | 'discountAmount' | 'taxRate'>>,
  shippingCharges = 0
): {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  shippingCharges: number;
  totalAmount: number;
} {
  let subtotal = new Decimal(0);
  let discountTotal = new Decimal(0);
  let taxTotal = new Decimal(0);

  for (const line of lines) {
    const calc = calculatePurchaseOrderLine(line);
    subtotal = subtotal.plus(calc.lineSubtotal);
    discountTotal = discountTotal.plus(calc.discountAmount);
    taxTotal = taxTotal.plus(calc.lineTax);
  }

  const shipping = new Decimal(Math.max(0, shippingCharges)).toDecimalPlaces(2);
  const totalAmount = subtotal.minus(discountTotal).plus(taxTotal).plus(shipping).toDecimalPlaces(2);

  return {
    subtotal: subtotal.toDecimalPlaces(2).toNumber(),
    discountTotal: discountTotal.toDecimalPlaces(2).toNumber(),
    taxTotal: taxTotal.toDecimalPlaces(2).toNumber(),
    shippingCharges: shipping.toNumber(),
    totalAmount: totalAmount.toNumber(),
  };
}

/**
 * Calculate Inventory Valuation for a given quantity and unit cost using Decimal.
 */
export function calculateInventoryValue(quantity: number, unitCost: number): number {
  const safeQty = Math.max(0, quantity);
  return new Decimal(safeQty).times(Math.max(0, unitCost)).toDecimalPlaces(2).toNumber();
}

/**
 * Suggested Reorder Quantity Formula:
 * Maximum(0, Target Stock - Available Stock - Confirmed Incoming Stock)
 */
export function calculateSuggestedReorderQuantity(params: {
  targetStock: number;
  availableStock: number;
  confirmedIncomingStock: number;
}): number {
  const result = new Decimal(params.targetStock)
    .minus(params.availableStock)
    .minus(params.confirmedIncomingStock)
    .toNumber();
  return Math.max(0, Math.round(result));
}
