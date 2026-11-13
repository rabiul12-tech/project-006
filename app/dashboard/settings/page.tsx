'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import {
  Download,
  RotateCcw,
  Save,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { useStockoraStore } from '@/stores/useStockoraStore';
import { exportStockoraBackupJson } from '@/lib/storage';

export default function WorkspaceSettingsPage() {
  const {
    data,
    settings,
    theme,
    setTheme,
    sidebarCollapsed,
    setSidebarCollapsed,
    updateSettings,
    restoreFromBackup,
    resetDemoData,
  } = useStockoraStore();

  const [businessName, setBusinessName] = useState(settings.businessName);
  const [companyLogoText, setCompanyLogoText] = useState(settings.companyLogoText);
  const [defaultCurrency, setDefaultCurrency] = useState(settings.defaultCurrency);
  const [defaultWarehouseId, setDefaultWarehouseId] = useState(settings.defaultWarehouseId);
  const [defaultLowStockThreshold, setDefaultLowStockThreshold] = useState(
    String(settings.defaultLowStockThreshold)
  );
  const [defaultTaxRate, setDefaultTaxRate] = useState(String(settings.defaultTaxRate));
  const [poPrefix, setPoPrefix] = useState(settings.poPrefix);
  const [transferPrefix, setTransferPrefix] = useState(settings.transferPrefix);
  const [allowNegativeStock, setAllowNegativeStock] = useState(settings.allowNegativeStock);
  const [allowOverReceipt, setAllowOverReceipt] = useState(settings.allowOverReceipt);

  const [restoreJsonText, setRestoreJsonText] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      businessName,
      companyLogoText,
      defaultCurrency,
      defaultWarehouseId,
      defaultLowStockThreshold: Number(defaultLowStockThreshold) || 25,
      defaultTaxRate: Number(defaultTaxRate) || 8.25,
      poPrefix,
      transferPrefix,
      allowNegativeStock,
      allowOverReceipt,
    });
    toast.success('Workspace configuration saved. Historical posted transactions preserved.');
  };

  const handleDownloadBackup = () => {
    const json = exportStockoraBackupJson(data, settings);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stockora-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Downloaded full STOCKORA JSON backup.');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const res = restoreFromBackup(reader.result);
        if (!res.ok) {
          toast.error(`Restore rejected: ${res.error}`);
        } else {
          toast.success('Workspace restored and validated from JSON backup!');
        }
      }
    };
    reader.readAsText(file);
  };

  const handlePasteRestore = () => {
    if (!restoreJsonText.trim()) {
      toast.error('Paste a valid JSON backup payload first.');
      return;
    }
    const res = restoreFromBackup(restoreJsonText);
    if (!res.ok) {
      toast.error(`Restore rejected: ${res.error}`);
    } else {
      toast.success('Workspace restored from JSON payload!');
      setRestoreJsonText('');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Workspace Settings & Persistence Administration
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Configure enterprise policies, inventory valuation method, JSON backup/restore, and deterministic seed reset
        </p>
      </div>

      <form
        onSubmit={handleSaveSettings}
        className="p-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] space-y-5 text-xs"
      >
        <h2 className="text-sm font-semibold pb-2 border-b border-slate-100 dark:border-slate-800">
          Organization & Accounting Configuration
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block font-medium mb-1">Business Name</label>
            <input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Brand Wordmark</label>
            <input
              value={companyLogoText}
              onChange={(e) => setCompanyLogoText(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Default Currency</label>
            <select
              value={defaultCurrency}
              onChange={(e) =>
                setDefaultCurrency(
                  e.target.value as 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD'
                )
              }
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="CAD">CAD (CA$)</option>
              <option value="AUD">AUD (A$)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block font-medium mb-1">Default Receiving Warehouse</label>
            <select
              value={defaultWarehouseId}
              onChange={(e) => setDefaultWarehouseId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
            >
              {data.warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} · {w.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-medium mb-1">Inventory Valuation Method</label>
            <input
              disabled
              value="Moving Weighted Average Cost (MWAC)"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Default Tax Rate (%)</label>
            <input
              type="number"
              step="0.01"
              value={defaultTaxRate}
              onChange={(e) => setDefaultTaxRate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C] font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block font-medium mb-1">Default Low-Stock Threshold</label>
            <input
              type="number"
              min="1"
              value={defaultLowStockThreshold}
              onChange={(e) => setDefaultLowStockThreshold(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C] font-mono"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Purchase Order Numbering Prefix</label>
            <input
              value={poPrefix}
              onChange={(e) => setPoPrefix(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C] font-mono"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Transfer Numbering Prefix</label>
            <input
              value={transferPrefix}
              onChange={(e) => setTransferPrefix(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C] font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={allowNegativeStock}
              onChange={(e) => setAllowNegativeStock(e.target.checked)}
              className="mt-0.5"
            />
            <div>
              <div className="font-semibold">Allow Negative Stock Balances</div>
              <div className="text-slate-500">
                Disabled by default. When disabled, adjustments and transfers cannot reduce warehouse stock below zero.
              </div>
            </div>
          </label>

          <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={allowOverReceipt}
              onChange={(e) => setAllowOverReceipt(e.target.checked)}
              className="mt-0.5"
            />
            <div>
              <div className="font-semibold">Allow Purchase Order Over-Receipt</div>
              <div className="text-slate-500">
                When enabled, Goods Receiving can accept quantities exceeding the original PO line ordered quantity.
              </div>
            </div>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-[#111B2C]">
            <span>Interface Theme Mode</span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`px-3 py-1 rounded ${
                  theme === 'light' ? 'bg-[#2563EB] text-white' : 'border border-slate-300'
                }`}
              >
                Light
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`px-3 py-1 rounded ${
                  theme === 'dark' ? 'bg-[#2563EB] text-white' : 'border border-slate-600'
                }`}
              >
                Dark
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-[#111B2C]">
            <span>Sidebar Layout Mode</span>
            <button
              type="button"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="px-3 py-1 rounded border border-slate-200 dark:border-slate-700"
            >
              {sidebarCollapsed ? 'Collapsed (Icon-Only)' : 'Expanded (Full)'}
            </button>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white font-medium"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Workspace Settings</span>
          </button>
        </div>
      </form>

      {/* JSON Backup, Validated Restore & Demo Reset */}
      <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] space-y-5 text-xs">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#059669]" />
            <h2 className="text-sm font-semibold">
              LocalStorage Backup, Schema-Validated Restore & Demo Reset
            </h2>
          </div>
          <button
            type="button"
            onClick={handleDownloadBackup}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#059669] hover:bg-emerald-700 text-white font-medium"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download JSON Backup</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block font-medium">Restore from JSON Backup File</label>
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleFileUpload}
              className="block w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#EFF6FF] file:text-[#2563EB] file:font-medium"
            />
            <p className="text-slate-500">
              Import validation rejects invalid foreign references, duplicate movement IDs, or inconsistent negative stock ledgers.
            </p>
          </div>

          <div className="space-y-2">
            <label className="block font-medium">Or Paste JSON Backup Payload</label>
            <div className="flex gap-2">
              <input
                value={restoreJsonText}
                onChange={(e) => setRestoreJsonText(e.target.value)}
                placeholder='{"version":"1.0.0","products":[...]}'
                className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#111B2C] font-mono"
              />
              <button
                type="button"
                onClick={handlePasteRestore}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-medium"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Restore</span>
              </button>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-rose-600">Reset to Deterministic Demo Dataset</div>
            <div className="text-slate-500">
              Re-initializes all 5 warehouses, products, POs, transfers, and movement ledger to clean initial demo state.
            </div>
          </div>
          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-rose-300 text-rose-600 font-medium"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Demo Workspace</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  resetDemoData();
                  setConfirmReset(false);
                  toast.success('Workspace reset to deterministic factory seed data.');
                }}
                className="px-3.5 py-2 rounded-lg bg-rose-600 text-white font-medium"
              >
                Confirm Reset Now
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
