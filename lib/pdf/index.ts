import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { GoodsReceipt, PurchaseOrder, Supplier, Warehouse } from '@/types/erp';

/**
 * Generate a printable Enterprise Purchase Order PDF document.
 */
export function downloadPurchaseOrderPdf(
  po: PurchaseOrder,
  supplier?: Supplier,
  warehouse?: Warehouse,
  businessName = 'Stockora Global Logistics Inc.'
): void {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.setTextColor(23, 32, 51);
  doc.text('PURCHASE ORDER', 14, 22);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(businessName, 14, 29);
  doc.text('Every Product. Every Movement. Under Control.', 14, 34);

  doc.setFontSize(10);
  doc.setTextColor(23, 32, 51);
  doc.text(`PO Number: ${po.poNumber}`, 140, 22);
  doc.text(`Status: ${po.status}`, 140, 28);
  doc.text(`Order Date: ${po.orderDate.slice(0, 10)}`, 140, 34);
  doc.text(`Expected: ${po.expectedDeliveryDate.slice(0, 10)}`, 140, 40);

  doc.setDrawColor(226, 232, 240);
  doc.line(14, 45, 196, 45);

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('VENDOR / SUPPLIER', 14, 53);
  doc.text('SHIP TO WAREHOUSE', 110, 53);

  doc.setFontSize(10);
  doc.setTextColor(23, 32, 51);
  doc.text(supplier?.companyName ?? po.supplierId, 14, 59);
  doc.setFontSize(9);
  doc.text(supplier?.contactName ?? '', 14, 64);
  doc.text(supplier?.location ?? '', 14, 69);

  doc.setFontSize(10);
  doc.text(warehouse ? `${warehouse.name} (${warehouse.code})` : po.warehouseId, 110, 59);
  doc.setFontSize(9);
  doc.text(warehouse?.location ?? '', 110, 64);

  autoTable(doc, {
    startY: 78,
    head: [['SKU', 'Product Description', 'Qty Ordered', 'Received', 'Unit Cost', 'Discount', 'Tax', 'Line Total']],
    body: po.lines.map((l) => [
      l.sku,
      l.productName,
      String(l.quantityOrdered),
      String(l.quantityReceived),
      `$${l.unitCost.toFixed(2)}`,
      `$${l.discountAmount.toFixed(2)}`,
      `$${l.lineTax.toFixed(2)}`,
      `$${l.lineTotal.toFixed(2)}`,
    ]),
    styles: { fontSize: 8.5, cellPadding: 3 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255 },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 130;

  doc.setFontSize(9.5);
  doc.text(`Subtotal: $${po.subtotal.toFixed(2)}`, 140, finalY + 10);
  doc.text(`Discount: -$${po.discountTotal.toFixed(2)}`, 140, finalY + 16);
  doc.text(`Tax: $${po.taxTotal.toFixed(2)}`, 140, finalY + 22);
  doc.text(`Shipping: $${po.shippingCharges.toFixed(2)}`, 140, finalY + 28);
  doc.setFontSize(11);
  doc.text(`Total: $${po.totalAmount.toFixed(2)}`, 140, finalY + 36);

  doc.save(`${po.poNumber}.pdf`);
}

/**
 * Generate a printable Goods Receipt Note (GRN) PDF document.
 */
export function downloadGoodsReceiptPdf(
  grn: GoodsReceipt,
  warehouse?: Warehouse,
  businessName = 'Stockora Global Logistics Inc.'
): void {
  const doc = new jsPDF();

  doc.setFontSize(17);
  doc.setTextColor(23, 32, 51);
  doc.text('GOODS RECEIPT NOTE (GRN)', 14, 22);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(businessName, 14, 29);

  doc.setTextColor(23, 32, 51);
  doc.text(`GRN Number: ${grn.grnNumber}`, 135, 22);
  doc.text(`PO Reference: ${grn.poNumber}`, 135, 28);
  doc.text(`Received Date: ${grn.receivedDate.slice(0, 10)}`, 135, 34);
  doc.text(`Inspector: ${grn.receivedBy}`, 135, 40);
  doc.text(
    `Warehouse: ${warehouse ? `${warehouse.name} (${warehouse.code})` : grn.warehouseId}`,
    14,
    40
  );

  autoTable(doc, {
    startY: 48,
    head: [['SKU', 'Product', 'Total Delivered', 'Accepted Qty', 'Rejected Qty', 'Unit Cost', 'Notes']],
    body: grn.lines.map((l) => [
      l.sku,
      l.productName,
      String(l.receivedQuantity),
      String(l.acceptedQuantity),
      String(l.rejectedQuantity),
      `$${l.unitCost.toFixed(2)}`,
      l.rejectionReason || 'Passed QA',
    ]),
    styles: { fontSize: 8.5, cellPadding: 3 },
    headStyles: { fillColor: [5, 150, 105], textColor: 255 },
  });

  doc.save(`${grn.grnNumber}.pdf`);
}

/**
 * Generate Printable Barcode / QR Labels Sheet PDF
 */
export function downloadBarcodeLabelsPdf(
  items: Array<{
    sku: string;
    name: string;
    barcode: string;
    price: number;
    copies: number;
  }>,
  labelSize: 'standard' | 'compact' | 'shipping' = 'standard'
): void {
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.setTextColor(23, 32, 51);
  doc.text(`STOCKORA BARCODE & QR LABEL SHEET (${labelSize.toUpperCase()})`, 14, 16);

  let x = 14;
  let y = 24;
  const cardWidth = labelSize === 'compact' ? 58 : 88;
  const cardHeight = labelSize === 'compact' ? 32 : 42;

  for (const item of items) {
    const count = Math.max(1, Math.min(30, item.copies));
    for (let c = 0; c < count; c++) {
      if (y + cardHeight > 275) {
        doc.addPage();
        x = 14;
        y = 20;
      }

      doc.setDrawColor(180, 190, 205);
      doc.rect(x, y, cardWidth, cardHeight);

      doc.setFontSize(8.5);
      doc.setTextColor(23, 32, 51);
      doc.text(item.name.slice(0, 32), x + 4, y + 7);

      doc.setFontSize(10);
      doc.text(`SKU: ${item.sku}`, x + 4, y + 14);

      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`CODE128: ${item.barcode}`, x + 4, y + 21);
      doc.text(`Price: $${item.price.toFixed(2)}`, x + 4, y + 27);

      x += cardWidth + 6;
      if (x + cardWidth > 198) {
        x = 14;
        y += cardHeight + 6;
      }
    }
  }

  doc.save(`stockora-labels-${new Date().toISOString().slice(0, 10)}.pdf`);
}
