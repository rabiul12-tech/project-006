'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Archive,
  ArrowLeftRight,
  Building,
  Edit3,
  MapPin,
  Plus,
  User,
  Warehouse as WarehouseIcon,
  X,
} from 'lucide-react';
import { useStockoraStore } from '@/stores/useStockoraStore';
import { deriveInventoryBalances } from '@/lib/inventory-engine';
import {
  formatCurrency,
  formatDateTime,
  formatQuantity,
  getStockStatusColorClass,
  getStockStatusLabel,
} from '@/lib/formatters';
import { Warehouse } from '@/types/erp';

export default function WarehousesManagementPage() {
  const { data, settings, addWarehouse, updateWarehouse, archiveWarehouse } = useStockoraStore();

  const [selectedWhId, setSelectedWhId] = useState<string>(data.warehouses[0]?.id ?? 'wh-01');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWh, setEditingWh] = useState<Warehouse | null>(null);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [location, setLocation] = useState('');
  const [manager, setManager] = useState('');
  const [capacityDescription, setCapacityDescription] = useState('');
  const [maxCapacityUnits, setMaxCapacityUnits] = useState('20000');

  const allBalances = useMemo(() => deriveInventoryBalances(data), [data]);

  const warehouseMetrics = useMemo(() => {
    const map = new Map<
      string,
      {
        productCount: number;
        totalUnits: number;
        stockValue: number;
        lowStockCount: number;
      }
    >();

    for (const wh of data.warehouses) {
      const whBalances = allBalances.filter((b) => b.warehouseId === wh.id);
      const stocked = whBalances.filter((b) => b.onHandQuantity > 0);
      const totalUnits = whBalances.reduce((s, b) => s + b.onHandQuantity, 0);
      const stockValue = whBalances.reduce((s, b) => s + b.totalValue, 0);
      const lowStockCount = whBalances.filter(
        (b) => b.stockStatus === 'LOW_STOCK' || b.stockStatus === 'OUT_OF_STOCK'
      ).length;
      map.set(wh.id, {
        productCount: stocked.length,
        totalUnits,
        stockValue,
        lowStockCount,
      });
    }
    return map;
  }, [data.warehouses, allBalances]);

  const selectedWh = useMemo(
    () => data.warehouses.find((w) => w.id === selectedWhId) ?? data.warehouses[0],
    [data.warehouses, selectedWhId]
  );

  const selectedWhBalances = useMemo(
    () => allBalances.filter((b) => b.warehouseId === selectedWh?.id),
    [allBalances, selectedWh]
  );

  const selectedWhMovements = useMemo(
    () => data.stockMovements.filter((m) => m.warehouseId === selectedWh?.id).slice(0, 10),
    [data.stockMovements, selectedWh]
  );

  const incomingTransfers = useMemo(
    () =>
      data.stockTransfers.filter(
        (t) => t.destinationWarehouseId === selectedWh?.id && t.status !== 'CANCELLED'
      ),
    [data.stockTransfers, selectedWh]
  );

  const outgoingTransfers = useMemo(
    () =>
      data.stockTransfers.filter(
        (t) => t.sourceWarehouseId === selectedWh?.id && t.status !== 'CANCELLED'
      ),
    [data.stockTransfers, selectedWh]
  );

  const openCreateModal = () => {
    setEditingWh(null);
    setName('');
    setCode(`HUB-0${data.warehouses.length + 1}`);
    setLocation('');
    setManager('');
    setCapacityDescription('60,000 sq ft · High-Density Selective Racking');
    setMaxCapacityUnits('20000');
    setModalOpen(true);
  };

  const openEditModal = (wh: Warehouse) => {
    setEditingWh(wh);
    setName(wh.name);
    setCode(wh.code);
    setLocation(wh.location);
    setManager(wh.manager);
    setCapacityDescription(wh.capacityDescription);
    setMaxCapacityUnits(String(wh.maxCapacityUnits));
    setModalOpen(true);
  };

  const handleSaveWarehouse = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingWh) {
      updateWarehouse(editingWh.id, {
        name,
        code: code.toUpperCase(),
        location,
        manager,
        capacityDescription,
        maxCapacityUnits: Number(maxCapacityUnits),
      });
      toast.success(`Updated warehouse ${name}.`);
      setModalOpen(false);
    } else {
      const res = addWarehouse({
        name,
        code: code.toUpperCase(),
        location,
        manager,
        capacityDescription,
        maxCapacityUnits: Number(maxCapacityUnits),
        status: 'ACTIVE',
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Created warehouse ${name} (${code.toUpperCase()}).`);
      setModalOpen(false);
    }
  };

  const handleArchiveWarehouse = (wh: Warehouse) => {
    const res = archiveWarehouse(wh.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`Warehouse ${wh.name} archived.`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Multi-Warehouse Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Inspect distribution hubs, capacity utilization, warehouse stock balances, and active transfers
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-medium"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Warehouse Facility</span>
        </button>
      </div>

      {/* Warehouse Facility Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {data.warehouses.map((wh) => {
          const stats = warehouseMetrics.get(wh.id) ?? {
            productCount: 0,
            totalUnits: 0,
            stockValue: 0,
            lowStockCount: 0,
          };
          const selected = selectedWh?.id === wh.id;
          const utilPct = Math.min(
            100,
            Math.round((stats.totalUnits / Math.max(1, wh.maxCapacityUnits)) * 100)
          );
          return (
            <div
              key={wh.id}
              onClick={() => setSelectedWhId(wh.id)}
              className={`cursor-pointer p-4 rounded-xl border transition-colors flex flex-col justify-between gap-3 ${
                selected
                  ? 'border-[#2563EB] dark:border-[#60A5FA] bg-[#EFF6FF]/40 dark:bg-blue-950/30'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-bold text-[#2563EB] dark:text-[#60A5FA]">
                    {wh.code}
                  </span>
                  <span className="text-[11px] text-slate-500">{wh.status}</span>
                </div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white mt-1 line-clamp-1">
                  {wh.name}
                </h2>
                <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1 truncate">
                  <User className="w-3 h-3 shrink-0" />
                  <span>{wh.manager}</span>
                </div>
              </div>

              <div className="space-y-1.5 text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex justify-between">
                  <span className="text-slate-500">Stock Value</span>
                  <span className="font-mono font-semibold tabular-nums">
                    {formatCurrency(stats.stockValue, settings.defaultCurrency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Units / SKUs</span>
                  <span className="font-mono tabular-nums">
                    {formatQuantity(stats.totalUnits)} u · {stats.productCount} SKUs
                  </span>
                </div>
                <div className="pt-1">
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                    <span>Capacity Utilization</span>
                    <span className="font-mono">{utilPct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-[#2563EB]"
                      style={{ width: `${utilPct}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Warehouse Deep Inspection Workspace */}
      {selectedWh && (
        <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-700">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <WarehouseIcon className="w-4 h-4 text-[#2563EB]" />
                <span className="font-mono font-bold text-[#2563EB] dark:text-[#60A5FA]">
                  {selectedWh.code}
                </span>
                <span>·</span>
                <span>Manager: {selectedWh.manager}</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                {selectedWh.name} — Facility Detail View
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                <span>{selectedWh.location} · {selectedWh.capacityDescription}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openEditModal(selectedWh)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Facility</span>
              </button>
              <button
                type="button"
                onClick={() => handleArchiveWarehouse(selectedWh)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 text-xs font-medium"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Archive Warehouse</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Warehouse Inventory Balances */}
            <div className="lg:col-span-7 space-y-3">
              <h3 className="text-sm font-semibold">
                Facility Inventory Balances (Top Stocked & Low-Stock SKUs)
              </h3>
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#111B2C] text-slate-500">
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3">Product</th>
                      <th className="py-2.5 px-3 text-right">On-Hand</th>
                      <th className="py-2.5 px-3 text-right">Available</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {selectedWhBalances.slice(0, 12).map((b) => (
                      <tr key={b.productId}>
                        <td className="py-2 px-3 font-mono font-semibold text-[#2563EB] dark:text-[#60A5FA]">
                          <Link href={`/dashboard/products/${b.productId}`}>{b.sku}</Link>
                        </td>
                        <td className="py-2 px-3 truncate max-w-[180px]">{b.productName}</td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">
                          {b.onHandQuantity}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums font-bold">
                          {b.availableQuantity}
                        </td>
                        <td className={`py-2 px-3 ${getStockStatusColorClass(b.stockStatus)}`}>
                          {getStockStatusLabel(b.stockStatus)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">
                          {formatCurrency(b.totalValue, settings.defaultCurrency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Incoming / Outgoing Transfers & Recent Movements */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-[#111B2C]/60 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="flex items-center gap-1.5">
                    <ArrowLeftRight className="w-3.5 h-3.5 text-[#2563EB]" />
                    <span>Inbound & Outbound Transfers</span>
                  </span>
                  <Link href="/dashboard/transfers" className="text-[#2563EB] hover:underline">
                    Manage →
                  </Link>
                </div>
                <div className="text-xs space-y-1.5">
                  <div>
                    Incoming Shipments: <strong className="font-mono">{incomingTransfers.length}</strong>
                    {' · '}
                    Outgoing Shipments: <strong className="font-mono">{outgoingTransfers.length}</strong>
                  </div>
                  {[...incomingTransfers.slice(0, 2), ...outgoingTransfers.slice(0, 2)].map((t) => (
                    <div
                      key={t.id}
                      className="p-2 rounded bg-white dark:bg-[#172337] border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                    >
                      <span className="font-mono font-medium">{t.transferNumber}</span>
                      <span className="text-slate-500">{t.status}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold">Recent Movements at {selectedWh.code}</h3>
                <div className="space-y-1.5">
                  {selectedWhMovements.slice(0, 5).map((m) => (
                    <div
                      key={m.id}
                      className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-mono font-semibold">{m.sku}</span>
                        <span className="text-slate-500 ml-2">
                          {m.movementType.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="font-mono tabular-nums font-bold">
                        {m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta} (→ {m.afterQuantity})
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-sm font-semibold">
                {editingWh ? `Edit Facility · ${editingWh.code}` : 'Create Warehouse Facility'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="p-1 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveWarehouse} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium mb-1">Code *</label>
                  <input
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C] font-mono"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block font-medium mb-1">Warehouse Name *</label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium mb-1">Facility Address / Location *</label>
                <input
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Facility Manager *</label>
                  <input
                    required
                    value={manager}
                    onChange={(e) => setManager(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Max Capacity (Units)</label>
                  <input
                    type="number"
                    min="100"
                    value={maxCapacityUnits}
                    onChange={(e) => setMaxCapacityUnits(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C] font-mono tabular-nums"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium mb-1">Capacity Specification</label>
                <input
                  value={capacityDescription}
                  onChange={(e) => setCapacityDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111B2C]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white font-medium"
                >
                  Save Facility
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
