'use client';

import React, { useMemo, useState } from 'react';
import { FileDown, Plus, Printer, Trash2 } from 'lucide-react';
import { useStockoraStore } from '@/stores/useStockoraStore';
import { BarcodeDisplay } from '@/components/ui/BarcodeDisplay';
import { downloadBarcodeLabelsPdf } from '@/lib/pdf';
import { formatCurrency } from '@/lib/formatters';

export default function BarcodeLabelGeneratorPage() {
  const { data, settings } = useStockoraStore();

  const [selectedProductId, setSelectedProductId] = useState(
    data.products[0]?.id ?? 'prd-001'
  );
  const [labelSize, setLabelSize] = useState<'standard' | 'compact' | 'shipping'>('standard');
  const [displayMode, setDisplayMode] = useState<'both' | 'barcode' | 'qr'>('both');
  const [showPrice, setShowPrice] = useState(true);
  const [copies, setCopies] = useState('4');

  const [batchItems, setBatchItems] = useState<
    Array<{ productId: string; copies: number }>
  >([
    { productId: data.products[0]?.id ?? 'prd-001', copies: 4 },
    { productId: data.products[1]?.id ?? 'prd-002', copies: 2 },
  ]);

  const currentProduct = useMemo(
    () => data.products.find((p) => p.id === selectedProductId) ?? data.products[0],
    [data.products, selectedProductId]
  );

  const handleAddToBatch = () => {
    if (!currentProduct) return;
    setBatchItems((prev) => [
      ...prev,
      { productId: currentProduct.id, copies: Math.max(1, Number(copies) || 1) },
    ]);
  };

  const handleDownloadBatchPdf = () => {
    const items = batchItems
      .map((b) => {
        const prod = data.products.find((p) => p.id === b.productId);
        if (!prod) return null;
        return {
          sku: prod.sku,
          name: prod.name,
          barcode: prod.barcode,
          price: prod.sellingPrice,
          copies: b.copies,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    downloadBarcodeLabelsPdf(items, labelSize);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Barcode & QR Label Studio
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Generate valid CODE128 SKU barcodes and compact QR identification labels for internal warehouse bin & product labeling
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] text-xs font-medium"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Label Sheet</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadBatchPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-medium"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Download Printable PDF</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Configuration & Batch Queue */}
        <div className="lg:col-span-5 space-y-5 no-print">
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] space-y-4 text-xs">
            <h2 className="text-sm font-semibold">Label Configuration</h2>

            <div>
              <label className="block font-medium mb-1">Select Product / SKU</label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
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
                <label className="block font-medium mb-1">Label Size Format</label>
                <select
                  value={labelSize}
                  onChange={(e) =>
                    setLabelSize(e.target.value as 'standard' | 'compact' | 'shipping')
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                >
                  <option value="standard">Standard Shelf (3.5&quot; × 1.5&quot;)</option>
                  <option value="compact">Compact Bin (2.25&quot; × 1.25&quot;)</option>
                  <option value="shipping">Case / Pallet (4&quot; × 2&quot;)</option>
                </select>
              </div>
              <div>
                <label className="block font-medium mb-1">Symbology Mode</label>
                <select
                  value={displayMode}
                  onChange={(e) =>
                    setDisplayMode(e.target.value as 'both' | 'barcode' | 'qr')
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                >
                  <option value="both">CODE128 Barcode + QR Code</option>
                  <option value="barcode">CODE128 Linear Barcode Only</option>
                  <option value="qr">QR Code Only</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 items-center">
              <div>
                <label className="block font-medium mb-1">Copies to Queue</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={copies}
                  onChange={(e) => setCopies(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C] font-mono"
                />
              </div>
              <label className="flex items-center gap-2 pt-5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPrice}
                  onChange={(e) => setShowPrice(e.target.checked)}
                />
                <span>Include Unit Price on Label</span>
              </label>
            </div>

            <button
              type="button"
              onClick={handleAddToBatch}
              className="w-full py-2 px-3 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white font-medium flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add SKU to Batch Print Sheet</span>
            </button>
          </div>

          {/* Batch Queue */}
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Batch Print Queue ({batchItems.length} SKUs)</h3>
              <button
                type="button"
                onClick={() => setBatchItems([])}
                className="text-rose-500 hover:underline"
              >
                Clear Queue
              </button>
            </div>
            <div className="space-y-2">
              {batchItems.map((item, idx) => {
                const prod = data.products.find((p) => p.id === item.productId);
                if (!prod) return null;
                return (
                  <div
                    key={`${item.productId}-${idx}`}
                    className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#111B2C] flex items-center justify-between"
                  >
                    <div>
                      <div className="font-mono font-semibold">{prod.sku}</div>
                      <div className="text-slate-500 truncate max-w-[200px]">{prod.name}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold">{item.copies}x</span>
                      <button
                        type="button"
                        onClick={() =>
                          setBatchItems((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="text-rose-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Live Printable Sheet Preview */}
        <div className="lg:col-span-7 p-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700 no-print">
            <div>
              <h2 className="text-sm font-semibold">Live Printable Label Sheet Preview</h2>
              <p className="text-xs text-slate-500">
                Internal STOCKORA identification codes (not external GS1 tracking identifiers)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {batchItems.map((item, idx) => {
              const prod = data.products.find((p) => p.id === item.productId);
              if (!prod) return null;
              return Array.from({ length: Math.min(6, item.copies) }).map((_, copyIdx) => (
                <div
                  key={`${item.productId}-${idx}-${copyIdx}`}
                  className="p-4 rounded-xl border border-slate-300 bg-white text-slate-900 space-y-2 shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs font-bold line-clamp-1">{prod.name}</div>
                    {showPrice && (
                      <span className="font-mono font-bold text-xs shrink-0">
                        {formatCurrency(prod.sellingPrice, settings.defaultCurrency)}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-slate-600">
                    SKU: <strong>{prod.sku}</strong> · UOM: {prod.unitOfMeasure}
                  </div>
                  <BarcodeDisplay
                    value={prod.sku}
                    qrPayload={`STOCKORA:SKU:${prod.sku}:ID:${prod.id}`}
                    mode={displayMode}
                    height={labelSize === 'compact' ? 32 : 44}
                    width={labelSize === 'compact' ? 1.3 : 1.5}
                  />
                </div>
              ));
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
