'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Barcode,
  Boxes,
  Building2,
  Command,
  FileText,
  Package,
  PlusCircle,
  Search,
  Truck,
  Warehouse as WarehouseIcon,
  X,
} from 'lucide-react';
import { useStockoraStore } from '@/stores/useStockoraStore';

const APP_PAGES = [
  { label: 'Inventory Control Center', href: '/dashboard', category: 'Navigation' },
  { label: 'Master Inventory View', href: '/dashboard/inventory', category: 'Navigation' },
  { label: 'Products & Variants Catalog', href: '/dashboard/products', category: 'Navigation' },
  { label: 'Product Categories', href: '/dashboard/categories', category: 'Navigation' },
  { label: 'Multi-Warehouse Management', href: '/dashboard/warehouses', category: 'Navigation' },
  { label: 'Stock Movement Ledger', href: '/dashboard/movements', category: 'Navigation' },
  { label: 'Inter-Warehouse Stock Transfers', href: '/dashboard/transfers', category: 'Navigation' },
  { label: 'Inventory Adjustments', href: '/dashboard/adjustments', category: 'Navigation' },
  { label: 'Purchase Orders', href: '/dashboard/purchase-orders', category: 'Navigation' },
  { label: 'Supplier Directory', href: '/dashboard/suppliers', category: 'Navigation' },
  { label: 'Goods Receiving Workspace', href: '/dashboard/receiving', category: 'Navigation' },
  { label: 'Reorder Planning', href: '/dashboard/reorder', category: 'Navigation' },
  { label: 'Barcode & QR Label Generator', href: '/dashboard/barcodes', category: 'Navigation' },
  { label: 'Inventory Analytics', href: '/dashboard/analytics', category: 'Navigation' },
  { label: 'Operational Reports Center', href: '/dashboard/reports', category: 'Navigation' },
  { label: 'Operational Activity Log', href: '/dashboard/activity', category: 'Navigation' },
  { label: 'Team & Access Directory', href: '/dashboard/team', category: 'Navigation' },
  { label: 'Workspace Settings & Backup', href: '/dashboard/settings', category: 'Navigation' },
  { label: 'Help & Architecture Documentation', href: '/dashboard/help', category: 'Navigation' },
];

export function GlobalSearchModal() {
  const router = useRouter();
  const {
    globalSearchOpen,
    setGlobalSearchOpen,
    setQuickCreateModal,
    data,
  } = useStockoraStore();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setGlobalSearchOpen(!globalSearchOpen);
      } else if (e.key === 'Escape' && globalSearchOpen) {
        setGlobalSearchOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [globalSearchOpen, setGlobalSearchOpen]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();

    const commands = [
      {
        id: 'cmd-add-product',
        title: 'Add Product',
        subtitle: 'Create a new SKU in the product catalog',
        group: 'Quick Commands',
        icon: PlusCircle,
        action: () => {
          setGlobalSearchOpen(false);
          setQuickCreateModal('product');
        },
      },
      {
        id: 'cmd-create-po',
        title: 'Create Purchase Order',
        subtitle: 'Issue a new supplier purchase order',
        group: 'Quick Commands',
        icon: FileText,
        action: () => {
          setGlobalSearchOpen(false);
          setQuickCreateModal('po');
        },
      },
      {
        id: 'cmd-transfer',
        title: 'Transfer Stock',
        subtitle: 'Initiate an inter-warehouse stock transfer',
        group: 'Quick Commands',
        icon: Truck,
        action: () => {
          setGlobalSearchOpen(false);
          setQuickCreateModal('transfer');
        },
      },
      {
        id: 'cmd-receive',
        title: 'Receive Goods',
        subtitle: 'Post a Goods Receipt Note against an open PO',
        group: 'Quick Commands',
        icon: Boxes,
        action: () => {
          setGlobalSearchOpen(false);
          router.push('/dashboard/receiving');
        },
      },
      {
        id: 'cmd-inventory',
        title: 'Open Inventory',
        subtitle: 'Inspect master warehouse stock balances',
        group: 'Quick Commands',
        icon: Package,
        action: () => {
          setGlobalSearchOpen(false);
          router.push('/dashboard/inventory');
        },
      },
      {
        id: 'cmd-labels',
        title: 'Generate Labels',
        subtitle: 'Print CODE128 barcode and QR product labels',
        group: 'Quick Commands',
        icon: Barcode,
        action: () => {
          setGlobalSearchOpen(false);
          router.push('/dashboard/barcodes');
        },
      },
    ].filter(
      (c) => !q || c.title.toLowerCase().includes(q) || c.subtitle.toLowerCase().includes(q)
    );

    const matchingProducts = data.products
      .filter(
        (p) =>
          p.status !== 'ARCHIVED' &&
          (!q ||
            p.name.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q) ||
            p.brand.toLowerCase().includes(q))
      )
      .slice(0, 6)
      .map((p) => ({
        id: `prd-${p.id}`,
        title: `${p.sku} — ${p.name}`,
        subtitle: `Brand: ${p.brand} · Cost: $${p.movingAverageCost.toFixed(2)}`,
        group: 'Products & SKUs',
        icon: Package,
        action: () => {
          setGlobalSearchOpen(false);
          router.push(`/dashboard/products/${p.id}`);
        },
      }));

    const matchingWarehouses = data.warehouses
      .filter(
        (w) =>
          !q ||
          w.name.toLowerCase().includes(q) ||
          w.code.toLowerCase().includes(q) ||
          w.location.toLowerCase().includes(q)
      )
      .slice(0, 4)
      .map((w) => ({
        id: `wh-${w.id}`,
        title: `${w.name} (${w.code})`,
        subtitle: w.location,
        group: 'Warehouses',
        icon: WarehouseIcon,
        action: () => {
          setGlobalSearchOpen(false);
          router.push(`/dashboard/warehouses?id=${w.id}`);
        },
      }));

    const matchingSuppliers = data.suppliers
      .filter(
        (s) =>
          !q ||
          s.companyName.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          s.contactName.toLowerCase().includes(q)
      )
      .slice(0, 4)
      .map((s) => ({
        id: `sup-${s.id}`,
        title: `${s.companyName} (${s.code})`,
        subtitle: `${s.contactName} · ${s.location}`,
        group: 'Suppliers',
        icon: Building2,
        action: () => {
          setGlobalSearchOpen(false);
          router.push(`/dashboard/suppliers?q=${encodeURIComponent(s.companyName)}`);
        },
      }));

    const matchingPOs = data.purchaseOrders
      .filter((po) => !q || po.poNumber.toLowerCase().includes(q) || po.status.toLowerCase().includes(q))
      .slice(0, 4)
      .map((po) => ({
        id: `po-${po.id}`,
        title: po.poNumber,
        subtitle: `Status: ${po.status} · Total: $${po.totalAmount.toFixed(2)}`,
        group: 'Purchase Orders',
        icon: FileText,
        action: () => {
          setGlobalSearchOpen(false);
          router.push(`/dashboard/purchase-orders?q=${encodeURIComponent(po.poNumber)}`);
        },
      }));

    const matchingTransfers = data.stockTransfers
      .filter((t) => !q || t.transferNumber.toLowerCase().includes(q) || t.status.toLowerCase().includes(q))
      .slice(0, 4)
      .map((t) => ({
        id: `trf-${t.id}`,
        title: t.transferNumber,
        subtitle: `Status: ${t.status} · ${t.referenceNotes}`,
        group: 'Stock Transfers',
        icon: Truck,
        action: () => {
          setGlobalSearchOpen(false);
          router.push(`/dashboard/transfers?q=${encodeURIComponent(t.transferNumber)}`);
        },
      }));

    const matchingPages = APP_PAGES.filter(
      (page) => !q || page.label.toLowerCase().includes(q)
    )
      .slice(0, 6)
      .map((page) => ({
        id: `page-${page.href}`,
        title: page.label,
        subtitle: page.href,
        group: 'Application Pages',
        icon: ArrowRight,
        action: () => {
          setGlobalSearchOpen(false);
          router.push(page.href);
        },
      }));

    return [
      ...commands,
      ...matchingProducts,
      ...matchingWarehouses,
      ...matchingSuppliers,
      ...matchingPOs,
      ...matchingTransfers,
      ...matchingPages,
    ];
  }, [query, data, router, setGlobalSearchOpen, setQuickCreateModal]);

  if (!globalSearchOpen) return null;

  const safeIndex = results.length > 0 ? Math.min(selectedIndex, results.length - 1) : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/60 backdrop-blur-xs pt-16 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Global Search and Command Palette"
      onClick={() => setGlobalSearchOpen(false)}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200 dark:border-slate-700">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex((prev) => (prev + 1) % Math.max(1, results.length));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex((prev) =>
                  prev - 1 < 0 ? Math.max(0, results.length - 1) : prev - 1
                );
              } else if (e.key === 'Enter' && results[safeIndex]) {
                e.preventDefault();
                results[safeIndex].action();
              }
            }}
            placeholder="Search SKUs, products, warehouses, POs, transfers, or type a command..."
            className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
          />
          <button
            onClick={() => setGlobalSearchOpen(false)}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
            aria-label="Close Global Search"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[420px] overflow-y-auto p-2 divide-y divide-slate-100 dark:divide-slate-800">
          {results.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
              No matching records or commands found for &ldquo;{query}&rdquo;.
            </div>
          ) : (
            <div className="space-y-1">
              {results.map((item, idx) => {
                const Icon = item.icon;
                const active = idx === safeIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={item.action}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      active
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-400" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{item.title}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {item.subtitle}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 whitespace-nowrap shrink-0">
                      {item.group}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-[#111B2C] border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>·</span>
            <span>↵ Select</span>
            <span>·</span>
            <span>ESC Close</span>
          </div>
          <div className="flex items-center gap-1 font-mono">
            <Command className="w-3.5 h-3.5" />
            <span>K</span>
          </div>
        </div>
      </div>
    </div>
  );
}
