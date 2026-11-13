# STOCKORA ERP — Premium Inventory & Warehouse Management System

> **Every Product. Every Movement. Under Control.**  
> Project 006 · Enterprise Browser-Local Inventory, Multi-Warehouse, Purchasing, Receiving & Stock Movement Ledger Application.

---

## 1. Executive Overview

**STOCKORA ERP** is a comprehensive, browser-local Inventory and Warehouse Management application engineered with Next.js App Router, React 19, TypeScript, Tailwind CSS, Zustand, Recharts, Decimal.js, JsBarcode, QRCode, and jsPDF.

### Core Capabilities

1. **Centralized Inventory Transaction Engine (`lib/inventory-engine/index.ts`)**:
   - All warehouse balances (`onHand`, `reserved`, `available`, `inTransitInbound`, `inTransitOutbound`, `stockStatus`, and `totalValue`) are derived from the immutable **Stock Movement Ledger**, active reservations, and in-transit transfers.
   - Supports 9 transaction types: `OPENING_BALANCE`, `PURCHASE_RECEIPT`, `TRANSFER_OUT`, `TRANSFER_IN`, `POSITIVE_ADJUSTMENT`, `NEGATIVE_ADJUSTMENT`, `RESERVATION`, `RESERVATION_RELEASE`, and `REVERSAL`.
   - Enforces idempotency via `processedOperationIds` so no receipt, dispatch, or adjustment can be applied twice.
   - Posted ledger transactions are never destructively edited or deleted; corrections post compensating `REVERSAL` entries.

2. **Moving Weighted Average Cost Valuation (`lib/calculations/index.ts`)**:
   - Powered by `decimal.js`:
     $$\text{New Average Cost} = \frac{(\text{Existing Qty} \times \text{Existing Avg Cost}) + (\text{Accepted Receipt Qty} \times \text{Receipt Unit Cost})}{\text{Existing Qty} + \text{Accepted Receipt Qty}}$$
   - Each movement stores a point-in-time `unitCostSnapshot` and `totalValueSnapshot` so catalog price updates never retroactively corrupt historical movement valuations.

3. **Inter-Warehouse Stock Transfers with In-Transit Accounting (`/dashboard/transfers`)**:
   - Full lifecycle: `DRAFT` → `IN_TRANSIT` → `COMPLETED` (or `CANCELLED`).
   - Dispatched transfers deduct source warehouse on-hand stock (`TRANSFER_OUT`) and track units in In-Transit inventory until received (`TRANSFER_IN`) at the destination facility.
   - Cancelling an `IN_TRANSIT` transfer executes an explicit return resolution workflow that posts a compensating `REVERSAL` back to the source warehouse.

4. **Purchase Orders & Goods Receiving Workspace (`/dashboard/purchase-orders` & `/dashboard/receiving`)**:
   - Creating a Purchase Order (`DRAFT` or `ORDERED`) never increases stock prematurely.
   - Goods Receiving (GRN) supports partial receipts, separates **Accepted Quantities** from **Rejected/Damaged Quantities** (rejected units do not increase usable inventory), updates PO fulfillment status (`PARTIALLY_RECEIVED` / `RECEIVED`), and exports printable GRN PDFs.

5. **Reorder Planning & Barcode / QR Studio (`/dashboard/reorder` & `/dashboard/barcodes`)**:
   - Evaluates $\text{Suggested Reorder Qty} = \max(0, \text{Target Stock} - \text{Available Stock} - \text{Confirmed Incoming Stock})$ and generates Draft Purchase Orders in one click.
   - Generates valid client-side `CODE128` barcodes and QR labels with printable sheet preview and PDF export.

---

## 2. Portfolio Demo vs Production ERP

**STOCKORA ERP** is a **browser-local portfolio demonstration** designed to showcase enterprise UX design, domain modeling, and transactional state management entirely inside the browser without external infrastructure.

- **Local Browser Persistence**: All business records are persisted in `window.localStorage` under versioned keys (`stockora:version`, `stockora:data`, `stockora:settings`, `stockora:ui`) with Zod schema validation, JSON backup/restore, and automatic corruption recovery.
- **No Multi-User Concurrency or Database Locking**: Because `LocalStorage` is isolated to a single browser profile, it cannot provide ACID database transaction isolation across multiple concurrent users, row-level locking, or cross-device cloud synchronization.
- **No External Integrations**: Supplier records, barcode/QR identifiers, and PDF documents are self-contained inside the application and do not transmit data to external supplier APIs, shipping carriers, or GS1 registries.
