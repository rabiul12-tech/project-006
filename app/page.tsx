'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowLeftRight,
  Barcode,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  FileSpreadsheet,
  History,
  Layers,
  ShieldCheck,
  Warehouse,
} from 'lucide-react';
import { useStockoraStore } from '@/stores/useStockoraStore';
import { deriveInventoryBalances, getInTransitUnits } from '@/lib/inventory-engine';
import { formatCurrency, formatQuantity } from '@/lib/formatters';

export default function HomePage() {
  const { hydrate, data, settings } = useStockoraStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const balances = deriveInventoryBalances(data);
  const totalValuation = balances.reduce((s, b) => s + b.totalValue, 0);
  const totalUnits = balances.reduce((s, b) => s + b.onHandQuantity, 0);
  const inTransitUnits = getInTransitUnits(data);
  const activeSkus = data.products.filter((p) => p.status === 'ACTIVE').length;

  return (
    <div className="min-h-screen bg-[#F7F9FC] dark:bg-[#0B1220] text-[#172033] dark:text-[#F8FAFC] flex flex-col">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="flex items-center justify-between gap-8 px-6 lg:px-12 py-4 bg-white dark:bg-[#111B2C] border-b border-[#E2E8F0] dark:border-[#304158]">
        <Link
          href="/dashboard"
          className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
        >
          STOCKORA ERP
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
          <Link href="/dashboard" className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
            Control Center
          </Link>
          <Link href="/dashboard/inventory" className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
            Inventory
          </Link>
          <Link href="/dashboard/transfers" className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
            Transfers
          </Link>
          <Link href="/dashboard/receiving" className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
            Receiving
          </Link>
          <Link href="/dashboard/movements" className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0">
            Ledger
          </Link>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/dashboard"
            className="px-4 py-2 text-xs font-medium text-white bg-[#2563EB] hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Launch Workspace
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 lg:px-12 py-12 lg:py-16 space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Enterprise Inventory & Multi-Warehouse Operations · Browser-Local Persistence
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
              Every Product. Every Movement. Under Control.
            </h1>
            <p className="text-base text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
              STOCKORA ERP unifies multi-warehouse inventory balances, immutable stock movement ledgers, inter-warehouse transfers with in-transit tracking, purchase orders, goods receiving (GRN), and moving weighted average cost valuation.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-sm font-medium transition-colors whitespace-nowrap"
              >
                <span>Open Control Center</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/dashboard/inventory"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] hover:bg-slate-50 dark:hover:bg-[#1F3047] text-slate-800 dark:text-slate-200 text-sm font-medium transition-colors whitespace-nowrap"
              >
                <span>Inspect Master Inventory</span>
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] p-6 flex flex-col justify-between space-y-5">
            <div>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Live Workspace Snapshot · {settings.businessName}
              </div>
              <div className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                Central Inventory Transaction Engine
              </div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Total Inventory Valuation</span>
                <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                  {formatCurrency(totalValuation, settings.defaultCurrency)}
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Physical On-Hand Units</span>
                <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                  {formatQuantity(totalUnits)} units
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Active SKUs & Warehouses</span>
                <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                  {activeSkus} SKUs · {data.warehouses.filter((w) => w.status === 'ACTIVE').length} Hubs
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">In-Transit Transfer Units</span>
                <span className="font-mono font-semibold tabular-nums text-[#2563EB] dark:text-[#60A5FA]">
                  {formatQuantity(inTransitUnits)} units
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Posted Ledger Movements</span>
                <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                  {formatQuantity(data.stockMovements.length)} entries
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Valuation: Moving Weighted Average</span>
              <Link href="/dashboard/help" className="text-[#2563EB] dark:text-[#60A5FA] hover:underline">
                Architecture Guide →
              </Link>
            </div>
          </div>
        </div>

        {/* Direct Deep-Links into Signature Operational Workflows */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Core Operational Modules
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              19 Integrated Enterprise Screens
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                title: '01. Inventory Control & Master View',
                desc: 'Real-time on-hand, reserved, available, and in-transit stock derived from the central ledger.',
                href: '/dashboard/inventory',
                icon: Boxes,
              },
              {
                title: '02. Product 360° Workspace',
                desc: 'Complete 7-tab SKU inspection: warehouse balances, movement ledger, POs, suppliers, and CODE128/QR labels.',
                href: '/dashboard/products/prd-001',
                icon: Layers,
              },
              {
                title: '03. Inter-Warehouse Stock Transfers',
                desc: 'Draft, dispatch, and receive transfers across 5 distribution hubs with strict in-transit accounting.',
                href: '/dashboard/transfers',
                icon: ArrowLeftRight,
              },
              {
                title: '04. Purchase Orders & Goods Receiving',
                desc: 'Decimal-accurate POs, partial receiving, accepted vs rejected QA quantities, and printable GRN PDFs.',
                href: '/dashboard/receiving',
                icon: ClipboardCheck,
              },
              {
                title: '05. Immutable Stock Movement Ledger',
                desc: 'Full chronological transaction trail with before/after quantities and compensating reversal support.',
                href: '/dashboard/movements',
                icon: History,
              },
              {
                title: '06. Reorder Planning & Label Studio',
                desc: 'Automated reorder formula recommendations, one-click draft PO generation, and printable barcode sheets.',
                href: '/dashboard/reorder',
                icon: Barcode,
              },
            ].map((mod) => {
              const Icon = mod.icon;
              return (
                <Link
                  key={mod.href}
                  href={mod.href}
                  className="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] hover:border-[#2563EB] dark:hover:border-[#60A5FA] transition-colors flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">
                        {mod.title}
                      </span>
                      <Icon className="w-4 h-4 text-[#2563EB] dark:text-[#60A5FA] shrink-0" />
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {mod.desc}
                    </p>
                  </div>
                  <div className="text-xs font-medium text-[#2563EB] dark:text-[#60A5FA] flex items-center gap-1">
                    <span>Open Module</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
