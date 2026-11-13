'use client';

import React from 'react';
import { BookOpen, CheckCircle2, HelpCircle, ShieldAlert } from 'lucide-react';

const GUIDE_SECTIONS = [
  {
    title: '01. Getting Started & Architecture Overview',
    body: 'STOCKORA ERP is a browser-local Inventory and Multi-Warehouse Management platform. All warehouse balances are derived from the central Stock Movement Ledger. No UI component mutates stock counters directly; every operation passes through validated business functions in the Inventory Transaction Engine.',
  },
  {
    title: '02. Adding Products, SKUs & Variants',
    body: 'Navigate to Products or use Quick Create → Add Product. Every active product requires a unique SKU. Products may optionally include size, color, and packaging variants with distinct variant SKUs. Catalog edits update descriptive metadata without overwriting historical posted ledger transactions.',
  },
  {
    title: '03. Managing Multi-Warehouse Facilities',
    body: 'STOCKORA supports multiple distribution hubs (EWR-01, ORD-02, DFW-03, SEA-04, ATL-05). An active warehouse cannot be archived while it still holds positive on-hand stock or has unresolved Draft/In-Transit transfers.',
  },
  {
    title: '04. Purchase Orders & Goods Receiving (GRN)',
    body: 'Creating a Purchase Order (Draft or Ordered) never increases inventory automatically. Stock increases only when a Goods Receipt Note (GRN) is posted in the Goods Receiving Workspace. Partial receiving is supported, and rejected/damaged quantities are recorded on the GRN without increasing usable stock.',
  },
  {
    title: '05. Inter-Warehouse Stock Transfers & In-Transit Accounting',
    body: 'Transfers follow a strict lifecycle: Draft → In Transit → Completed (or Cancelled). Dispatched transfers immediately deduct source warehouse on-hand stock (TRANSFER_OUT) and track units in In-Transit inventory so stock is never double-counted. Receiving the transfer posts TRANSFER_IN at the destination warehouse. Cancelling an in-transit transfer executes an explicit return resolution workflow posting a compensating REVERSAL back to the source warehouse.',
  },
  {
    title: '06. Stock Adjustments & Immutable Ledger Reversals',
    body: 'Cycle count discrepancies, damaged units, and shrinkage are posted via Inventory Adjustments. Negative stock is prevented unless explicitly enabled in Settings. Posted movement ledger entries cannot be destructively edited or deleted; corrections post a compensating REVERSAL entry.',
  },
  {
    title: '07. Inventory Valuation (Moving Weighted Average Cost)',
    body: 'STOCKORA implements Moving Weighted Average Cost (MWAC) using decimal.js: New Average Cost = (Existing Quantity × Existing Average Cost + Accepted Receipt Quantity × Receipt Unit Cost) ÷ (Existing Quantity + Accepted Receipt Quantity). Each movement stores a valuation snapshot at posting time.',
  },
  {
    title: '08. Barcode (CODE128) & QR Label Generation',
    body: 'The Barcode & QR Label Studio generates valid CODE128 linear barcodes and QR identification labels for internal warehouse bin and SKU scanning. Labels are designed for internal STOCKORA operations and are not registered GS1 identifiers.',
  },
  {
    title: '09. LocalStorage Persistence, Backup & Limitations',
    body: 'All state is persisted under versioned keys (stockora:version, stockora:data, stockora:settings, stockora:ui). Because LocalStorage is single-browser storage, it does not provide multi-user database locking, cross-device cloud sync, or server-grade transaction isolation. Use Settings → Download JSON Backup to export snapshots.',
  },
];

const FAQS = [
  {
    q: 'Why didn’t my stock increase when I created a Purchase Order?',
    a: 'In real ERP workflows, placing a Purchase Order only records a vendor commitment (Confirmed Incoming Stock). Physical On-Hand stock increases only when the shipment arrives and you post a Goods Receipt Note (GRN) in the Goods Receiving Workspace.',
  },
  {
    q: 'How is Available Stock calculated?',
    a: 'Available Stock = Physical On-Hand Stock − Active Reserved Stock. In-Transit Stock is tracked separately until received at the destination warehouse.',
  },
  {
    q: 'How is the Suggested Reorder Quantity calculated?',
    a: 'Suggested Reorder Quantity = Maximum(0, Target Stock − Available Stock − Confirmed Incoming Stock), where Confirmed Incoming Stock includes outstanding quantities on Ordered/Partially Received POs plus inbound In-Transit transfers.',
  },
  {
    q: 'Can I delete a mistaken Stock Movement?',
    a: 'No. To preserve audit integrity, posted movements are immutable. Open the movement in the Stock Movement Ledger and click "Post Reversal Entry" to record a compensating REVERSAL transaction.',
  },
];

export default function HelpDocumentationPage() {
  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Help & Enterprise Architecture Documentation
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Operational workflows, inventory transaction rules, valuation formulas, and browser-local storage specifications
        </p>
      </div>

      {/* Portfolio Demo vs Production ERP Disclosure Banner */}
      <div className="p-5 rounded-xl border border-amber-300/80 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20 space-y-2 text-xs">
        <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-300 text-sm">
          <ShieldAlert className="w-4 h-4" />
          <span>Portfolio Demo vs. Production Multi-User ERP</span>
        </div>
        <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
          STOCKORA ERP maintains strict transactional consistency within your local browser session using a centralized pure-function Inventory Transaction Engine and versioned LocalStorage persistence. Because it runs 100% client-side with zero external databases or servers, it does not provide multi-user row-level locking, cross-device cloud synchronization, external carrier APIs, or statutory tax/accounting compliance.
        </p>
      </div>

      {/* Guide Chapters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {GUIDE_SECTIONS.map((sec) => (
          <div
            key={sec.title}
            className="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] space-y-2"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <BookOpen className="w-4 h-4 text-[#2563EB] dark:text-[#60A5FA] shrink-0" />
              <span>{sec.title}</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {sec.body}
            </p>
          </div>
        ))}
      </div>

      {/* FAQ Section */}
      <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] space-y-4">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-[#2563EB]" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Frequently Asked Questions
          </h2>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {FAQS.map((faq) => (
            <div key={faq.q} className="py-3.5 space-y-1 text-xs">
              <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#059669] shrink-0" />
                <span>{faq.q}</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 pl-5 leading-relaxed">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
