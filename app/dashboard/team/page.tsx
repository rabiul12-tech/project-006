'use client';

import React from 'react';
import { Shield, Users } from 'lucide-react';
import { useStockoraStore } from '@/stores/useStockoraStore';

export default function TeamDirectoryPage() {
  const { data } = useStockoraStore();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Operations Team & Warehouse Assignments
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Demo operational actors referenced across purchase orders, goods receipts, stock transfers, and cycle count adjustments
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.teamMembers.map((member) => (
          <div
            key={member.id}
            className="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] space-y-3 text-xs"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#EFF6FF] dark:bg-blue-950/60 text-[#2563EB] dark:text-[#60A5FA] font-bold flex items-center justify-center text-sm">
                  {member.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    {member.name}
                  </div>
                  <div className="text-slate-500">{member.role}</div>
                </div>
              </div>
              <Users className="w-4 h-4 text-slate-400" />
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Department</span>
                <span className="font-medium">{member.department}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Facility Scope</span>
                <span className="font-mono">{member.warehouseScope}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Email</span>
                <span>{member.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Last Activity</span>
                <span className="text-[#059669] font-medium">{member.lastActive}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] flex items-center gap-3 text-xs text-slate-500">
        <Shield className="w-4 h-4 text-[#2563EB] shrink-0" />
        <span>
          This is a browser-local demo workspace with immediate access—no external authentication or credentials are required or stored.
        </span>
      </div>
    </div>
  );
}
