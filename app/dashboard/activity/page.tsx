'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Activity as ActivityIcon, ArrowUpRight, Search } from 'lucide-react';
import { useStockoraStore } from '@/stores/useStockoraStore';
import { formatDateTime } from '@/lib/formatters';
import { ActivityEventType } from '@/types/erp';

const EVENT_TYPES: ActivityEventType[] = [
  'PRODUCT_CREATED',
  'PRODUCT_EDITED',
  'WAREHOUSE_CREATED',
  'TRANSFER_CREATED',
  'TRANSFER_DISPATCHED',
  'TRANSFER_RECEIVED',
  'PO_CREATED',
  'GOODS_RECEIVED',
  'ADJUSTMENT_POSTED',
  'REVERSAL_POSTED',
  'SUPPLIER_UPDATED',
  'SETTINGS_CHANGED',
];

export default function OperationalActivityLogPage() {
  const { data } = useStockoraStore();
  const [search, setSearch] = useState('');
  const [eventFilter, setEventFilter] = useState<'ALL' | ActivityEventType>('ALL');

  const filteredActivities = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.activities
      .filter((a) => eventFilter === 'ALL' || a.eventType === eventFilter)
      .filter(
        (a) =>
          !q ||
          a.title.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.actor.toLowerCase().includes(q) ||
          (a.relatedDocumentNumber?.toLowerCase().includes(q) ?? false)
      );
  }, [data.activities, eventFilter, search]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Operational Activity Timeline
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Browser-local operational event log across catalog updates, transfers, POs, goods receiving, and adjustments
        </p>
      </div>

      {/* Filters */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] flex flex-wrap items-center gap-3 text-xs">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search event title, document reference, or actor..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#111B2C]"
          />
        </div>

        <select
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value as 'ALL' | ActivityEventType)}
          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
        >
          <option value="ALL">All Event Types</option>
          {EVENT_TYPES.map((ev) => (
            <option key={ev} value={ev}>
              {ev.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>

      {/* Timeline List */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] divide-y divide-slate-100 dark:divide-slate-800">
        {filteredActivities.map((act) => (
          <div
            key={act.id}
            className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50 dark:hover:bg-[#1F3047]/50 text-xs"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] dark:bg-blue-950/60 flex items-center justify-center shrink-0 mt-0.5">
                <ActivityIcon className="w-4 h-4 text-[#2563EB] dark:text-[#60A5FA]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {act.title}
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">
                    {act.eventType}
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                  {act.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 shrink-0 text-right">
              <div>
                <div className="font-mono text-slate-500">{formatDateTime(act.timestamp)}</div>
                <div className="text-[11px] text-slate-400">Actor: {act.actor}</div>
              </div>
              {act.relatedRoute && (
                <Link
                  href={act.relatedRoute}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-[#111B2C] text-[#2563EB] dark:text-[#60A5FA] font-medium"
                >
                  <span>Open</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
