'use client';

import React, { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

interface BarcodeDisplayProps {
  value: string;
  mode?: 'barcode' | 'qr' | 'both';
  qrPayload?: string;
  height?: number;
  width?: number;
  showText?: boolean;
}

export function BarcodeDisplay({
  value,
  mode = 'both',
  qrPayload,
  height = 48,
  width = 1.6,
  showText = true,
}: BarcodeDisplayProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const safeValue = (value || 'STK-0000').replace(/[^A-Za-z0-9\-._]/g, '');

  useEffect(() => {
    if ((mode === 'barcode' || mode === 'both') && svgRef.current && safeValue) {
      try {
        JsBarcode(svgRef.current, safeValue, {
          format: 'CODE128',
          lineColor: '#172033',
          background: '#FFFFFF',
          width,
          height,
          displayValue: showText,
          fontSize: 12,
          margin: 6,
        });
      } catch {
        // Fallback handled gracefully
      }
    }
  }, [safeValue, mode, height, width, showText]);

  useEffect(() => {
    let active = true;
    if (mode === 'qr' || mode === 'both') {
      const textToEncode = qrPayload || `STOCKORA:SKU:${safeValue}`;
      QRCode.toDataURL(textToEncode, {
        width: 112,
        margin: 1,
        color: { dark: '#172033', light: '#FFFFFF' },
      })
        .then((url) => {
          if (active) setQrDataUrl(url);
        })
        .catch(() => {
          // ignore
        });
    }
    return () => {
      active = false;
    };
  }, [safeValue, qrPayload, mode]);

  return (
    <div className="inline-flex flex-wrap items-center gap-4 bg-white p-3 rounded-lg border border-slate-200 text-slate-900">
      {(mode === 'barcode' || mode === 'both') && (
        <div className="flex flex-col items-center">
          <svg ref={svgRef} aria-label={`CODE128 Barcode for ${safeValue}`} />
        </div>
      )}
      {(mode === 'qr' || mode === 'both') && qrDataUrl && (
        <div className="flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            alt={`QR Code for ${safeValue}`}
            className="w-20 h-20 object-contain"
            referrerPolicy="no-referrer"
          />
          <span className="text-[10px] font-mono text-slate-500 mt-0.5">QR REF</span>
        </div>
      )}
    </div>
  );
}
