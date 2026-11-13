export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export type ProductStatus = 'ACTIVE' | 'ARCHIVED' | 'DRAFT';

export type WarehouseStatus = 'ACTIVE' | 'ARCHIVED';

export type SupplierStatus = 'ACTIVE' | 'ARCHIVED';

export type MovementType =
  | 'OPENING_BALANCE'
  | 'PURCHASE_RECEIPT'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'
  | 'POSITIVE_ADJUSTMENT'
  | 'NEGATIVE_ADJUSTMENT'
  | 'RESERVATION'
  | 'RESERVATION_RELEASE'
  | 'REVERSAL';

export type TransferStatus = 'DRAFT' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';

export type AdjustmentReason =
  | 'Damaged'
  | 'Lost'
  | 'Found'
  | 'Stock Count Correction'
  | 'Expired'
  | 'Other';

export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'ORDERED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CANCELLED';

export type ActivityEventType =
  | 'PRODUCT_CREATED'
  | 'PRODUCT_EDITED'
  | 'PRODUCT_ARCHIVED'
  | 'CATEGORY_CREATED'
  | 'CATEGORY_UPDATED'
  | 'WAREHOUSE_CREATED'
  | 'WAREHOUSE_UPDATED'
  | 'TRANSFER_CREATED'
  | 'TRANSFER_DISPATCHED'
  | 'TRANSFER_RECEIVED'
  | 'TRANSFER_CANCELLED'
  | 'PO_CREATED'
  | 'PO_UPDATED'
  | 'GOODS_RECEIVED'
  | 'ADJUSTMENT_POSTED'
  | 'REVERSAL_POSTED'
  | 'SUPPLIER_UPDATED'
  | 'SETTINGS_CHANGED';

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  barcode: string;
  name: string;
  size?: string;
  color?: string;
  packaging?: string;
  unitCost: number;
  sellingPrice: number;
  status: ProductStatus;
}

export interface Product {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  categoryId: string;
  brand: string;
  description: string;
  unitOfMeasure: string;
  sellingPrice: number;
  purchaseCost: number;
  movingAverageCost: number;
  preferredSupplierId: string;
  status: ProductStatus;
  reorderPoint: number;
  targetStock: number;
  imageUrl?: string;
  variants: ProductVariant[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  code: string;
  parentId?: string | null;
  description: string;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  location: string;
  manager: string;
  capacityDescription: string;
  maxCapacityUnits: number;
  status: WarehouseStatus;
  isDefault?: boolean;
  createdAt: string;
}

export interface SupplierProduct {
  id: string;
  supplierId: string;
  productId: string;
  supplierSku: string;
  unitCost: number;
  leadTimeDays: number;
  minimumOrderQuantity: number;
  isPreferred: boolean;
}

export interface Supplier {
  id: string;
  code: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  location: string;
  status: SupplierStatus;
  preferredCategoryIds: string[];
  paymentTerms: string;
  rating: number;
  createdAt: string;
}

export interface PurchaseOrderLine {
  id: string;
  poId: string;
  productId: string;
  sku: string;
  productName: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
  discountAmount: number;
  taxRate: number; // percentage e.g. 8.5
  lineSubtotal: number;
  lineTax: number;
  lineTotal: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  warehouseId: string;
  orderDate: string;
  expectedDeliveryDate: string;
  status: PurchaseOrderStatus;
  lines: PurchaseOrderLine[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  shippingCharges: number;
  totalAmount: number;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoodsReceiptLine {
  id: string;
  receiptId: string;
  poLineId: string;
  productId: string;
  sku: string;
  productName: string;
  receivedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  unitCost: number;
  rejectionReason?: string;
}

export interface GoodsReceipt {
  id: string;
  grnNumber: string;
  poId: string;
  poNumber: string;
  supplierId: string;
  warehouseId: string;
  receivedDate: string;
  receivedBy: string;
  notes: string;
  lines: GoodsReceiptLine[];
  isReversed?: boolean;
  createdAt: string;
}

export interface StockTransferLine {
  id: string;
  transferId: string;
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  unitCostSnapshot: number;
}

export interface StockTransfer {
  id: string;
  transferNumber: string;
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  status: TransferStatus;
  transferDate: string;
  dispatchedAt?: string;
  receivedAt?: string;
  cancelledAt?: string;
  referenceNotes: string;
  createdBy: string;
  lines: StockTransferLine[];
  createdAt: string;
}

export interface StockAdjustment {
  id: string;
  adjustmentNumber: string;
  warehouseId: string;
  productId: string;
  sku: string;
  productName: string;
  adjustmentType: 'POSITIVE' | 'NEGATIVE';
  quantity: number;
  beforeQuantity: number;
  afterQuantity: number;
  unitCostSnapshot: number;
  reason: AdjustmentReason;
  notes: string;
  actor: string;
  isReversed?: boolean;
  createdAt: string;
}

export interface StockMovement {
  id: string;
  timestamp: string;
  productId: string;
  sku: string;
  productName: string;
  warehouseId: string;
  movementType: MovementType;
  quantityDelta: number; // + or - for physical on-hand (or reservation delta for RESERVATION / RESERVATION_RELEASE)
  beforeQuantity: number;
  afterQuantity: number;
  unitCostSnapshot: number;
  totalValueSnapshot: number;
  sourceReference: string; // e.g., PO-2026-001, GRN-2026-001, TRF-2026-004, ADJ-2026-011
  sourceId: string;
  reason: string;
  actor: string;
  reversedByMovementId?: string;
  reversesMovementId?: string;
}

export interface StockReservation {
  id: string;
  productId: string;
  sku: string;
  warehouseId: string;
  quantity: number;
  referenceDocument: string;
  status: 'ACTIVE' | 'RELEASED';
  createdAt: string;
  releasedAt?: string;
}

export interface InventoryBalance {
  productId: string;
  sku: string;
  productName: string;
  categoryId: string;
  categoryName: string;
  unitOfMeasure: string;
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  onHandQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  inTransitInbound: number;
  inTransitOutbound: number;
  reorderPoint: number;
  targetStock: number;
  stockStatus: StockStatus;
  unitCost: number;
  sellingPrice: number;
  totalValue: number;
}

export interface ReorderRule {
  id: string;
  productId: string;
  warehouseId: string; // 'ALL' or specific warehouseId
  reorderPoint: number;
  targetStock: number;
  preferredSupplierId: string;
  autoFlag: boolean;
}

export interface Activity {
  id: string;
  timestamp: string;
  eventType: ActivityEventType;
  title: string;
  description: string;
  actor: string;
  relatedDocumentId?: string;
  relatedDocumentNumber?: string;
  relatedRoute?: string;
}

export interface SavedReport {
  id: string;
  name: string;
  reportType:
    | 'INVENTORY_BALANCE'
    | 'STOCK_MOVEMENT'
    | 'WAREHOUSE_INVENTORY'
    | 'LOW_STOCK'
    | 'REORDER'
    | 'PURCHASE_ORDER'
    | 'GOODS_RECEIVING'
    | 'SUPPLIER'
    | 'STOCK_ADJUSTMENT'
    | 'INVENTORY_VALUATION';
  warehouseFilter: string;
  categoryFilter: string;
  dateRange: string;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  email: string;
  department: string;
  warehouseScope: string;
  status: 'ACTIVE' | 'INACTIVE';
  lastActive: string;
}

export interface WorkspaceSettings {
  businessName: string;
  organizationTagline: string;
  companyLogoText: string;
  defaultCurrency: 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD';
  dateFormat: 'yyyy-MM-dd' | 'MM/dd/yyyy' | 'dd/MM/yyyy';
  numberFormat: 'en-US' | 'de-DE' | 'en-GB';
  defaultWarehouseId: string;
  unitsOfMeasure: string[];
  valuationMethod: 'MOVING_WEIGHTED_AVERAGE';
  defaultLowStockThreshold: number;
  poPrefix: string;
  transferPrefix: string;
  adjustmentPrefix: string;
  receiptPrefix: string;
  allowNegativeStock: boolean;
  allowOverReceipt: boolean;
  defaultTaxRate: number;
  notificationsEnabled: boolean;
  lowStockAlertsEnabled: boolean;
}

export interface StockoraData {
  version: string;
  products: Product[];
  categories: ProductCategory[];
  warehouses: Warehouse[];
  suppliers: Supplier[];
  supplierProducts: SupplierProduct[];
  purchaseOrders: PurchaseOrder[];
  goodsReceipts: GoodsReceipt[];
  stockTransfers: StockTransfer[];
  stockAdjustments: StockAdjustment[];
  stockMovements: StockMovement[];
  reservations: StockReservation[];
  reorderRules: ReorderRule[];
  activities: Activity[];
  savedReports: SavedReport[];
  teamMembers: TeamMember[];
  processedOperationIds: string[];
}
