'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  Barcode,
  BarChart3,
  Bell,
  Boxes,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileSpreadsheet,
  FileText,
  FolderTree,
  HelpCircle,
  History,
  LayoutDashboard,
  Menu,
  Moon,
  Package,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Sun,
  TrendingUp,
  Users,
  Warehouse,
  X,
} from 'lucide-react';
import { useStockoraStore } from '@/stores/useStockoraStore';
import { deriveInventoryBalances } from '@/lib/inventory-engine';
import { GlobalSearchModal } from './GlobalSearchModal';
import { QuickActionModals } from './QuickActionModals';

const NAV_SECTIONS = [
  {
    group: 'Overview',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Inventory', href: '/dashboard/inventory', icon: Boxes },
      { label: 'Products', href: '/dashboard/products', icon: Package },
      { label: 'Categories', href: '/dashboard/categories', icon: FolderTree },
    ],
  },
  {
    group: 'Warehouse',
    items: [
      { label: 'Warehouses', href: '/dashboard/warehouses', icon: Warehouse },
      { label: 'Stock Movements', href: '/dashboard/movements', icon: History },
      { label: 'Stock Transfers', href: '/dashboard/transfers', icon: ArrowLeftRight },
      { label: 'Stock Adjustments', href: '/dashboard/adjustments', icon: SlidersHorizontal },
    ],
  },
  {
    group: 'Purchasing',
    items: [
      { label: 'Purchase Orders', href: '/dashboard/purchase-orders', icon: FileText },
      { label: 'Suppliers', href: '/dashboard/suppliers', icon: Building2 },
      { label: 'Goods Receiving', href: '/dashboard/receiving', icon: ClipboardCheck },
    ],
  },
  {
    group: 'Operations',
    items: [
      { label: 'Reorder Planning', href: '/dashboard/reorder', icon: TrendingUp },
      { label: 'Barcode Labels', href: '/dashboard/barcodes', icon: Barcode },
      { label: 'Activity', href: '/dashboard/activity', icon: Activity },
    ],
  },
  {
    group: 'Insights',
    items: [
      { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
      { label: 'Reports', href: '/dashboard/reports', icon: FileSpreadsheet },
    ],
  },
  {
    group: 'System',
    items: [
      { label: 'Team', href: '/dashboard/team', icon: Users },
      { label: 'Settings', href: '/dashboard/settings', icon: Settings },
      { label: 'Help', href: '/dashboard/help', icon: HelpCircle },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    hydrated,
    hydrate,
    data,
    settings,
    selectedWarehouseId,
    setSelectedWarehouseId,
    theme,
    toggleTheme,
    sidebarCollapsed,
    setSidebarCollapsed,
    setGlobalSearchOpen,
    setQuickCreateModal,
  } = useStockoraStore();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const alerts = useMemo(() => {
    const balances = deriveInventoryBalances(data);
    const outOfStock = balances.filter((b) => b.stockStatus === 'OUT_OF_STOCK');
    const lowStock = balances.filter((b) => b.stockStatus === 'LOW_STOCK');
    const inTransit = data.stockTransfers.filter((t) => t.status === 'IN_TRANSIT');
    return {
      outCount: outOfStock.length,
      lowCount: lowStock.length,
      inTransitCount: inTransit.length,
      topItems: [...outOfStock.slice(0, 3), ...lowStock.slice(0, 3)],
    };
  }, [data]);

  const breadcrumbSegments = useMemo(() => {
    const parts = pathname.split('/').filter(Boolean);
    return parts.map((part, idx) => ({
      label: part
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      href: '/' + parts.slice(0, idx + 1).join('/'),
    }));
  }, [pathname]);

  const isNavItemActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <div className="min-h-screen flex bg-[#F7F9FC] dark:bg-[#0B1220] text-[#172033] dark:text-[#F8FAFC]">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 border-r border-[#E2E8F0] dark:border-[#304158] bg-white dark:bg-[#111B2C] transition-all duration-150 no-print ${
          sidebarCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        {/* Top Brand & Workspace Selector */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-[#E2E8F0] dark:border-[#304158]">
          <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center text-white font-bold text-sm shrink-0">
              S
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <div className="text-sm font-bold tracking-tight text-slate-900 dark:text-white truncate">
                  {settings.companyLogoText || 'STOCKORA'}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {settings.businessName}
                </div>
              </div>
            )}
          </Link>
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-4" aria-label="Main Sidebar Navigation">
          {NAV_SECTIONS.map((sec) => (
            <div key={sec.group}>
              {!sidebarCollapsed && (
                <div className="px-2.5 mb-1.5 text-[11px] font-semibold tracking-wider text-slate-400 dark:text-slate-500">
                  {sec.group}
                </div>
              )}
              <div className="space-y-0.5">
                {sec.items.map((item) => {
                  const Icon = item.icon;
                  const active = isNavItemActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={sidebarCollapsed ? item.label : undefined}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-[#EFF6FF] dark:bg-blue-950/70 text-[#2563EB] dark:text-[#60A5FA]'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1F3047] hover:text-slate-900 dark:hover:text-white'
                      } ${sidebarCollapsed ? 'justify-center' : ''}`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom Demo User & Collapse Toggle */}
        <div className="p-3 border-t border-[#E2E8F0] dark:border-[#304158] space-y-2">
          {!sidebarCollapsed && (
            <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-[#172337]">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                  Alex Morgan
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  VP Supply Chain · Demo
                </div>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                aria-label="Toggle color theme"
                className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center gap-2 py-1.5 px-2 rounded-lg text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1F3047]"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span>Collapse Sidebar</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden bg-slate-950/60 backdrop-blur-xs"
          onClick={() => setMobileMenuOpen(false)}
        >
          <aside
            className="w-72 h-full bg-white dark:bg-[#111B2C] border-r border-slate-200 dark:border-slate-700 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center text-white font-bold text-sm">
                  S
                </div>
                <span className="font-bold text-sm">STOCKORA ERP</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-slate-500"
                aria-label="Close navigation menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-4">
              {NAV_SECTIONS.map((sec) => (
                <div key={sec.group}>
                  <div className="px-2.5 mb-1 text-[11px] font-semibold text-slate-400">
                    {sec.group}
                  </div>
                  <div className="space-y-0.5">
                    {sec.items.map((item) => {
                      const Icon = item.icon;
                      const active = isNavItemActive(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium ${
                            active
                              ? 'bg-[#EFF6FF] dark:bg-blue-950/70 text-[#2563EB] dark:text-[#60A5FA]'
                              : 'text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 sticky top-0 z-30 bg-white/95 dark:bg-[#111B2C]/95 backdrop-blur-xs border-b border-[#E2E8F0] dark:border-[#304158] px-4 lg:px-6 flex items-center justify-between gap-4 no-print">
          {/* Left: Mobile Menu + Breadcrumbs */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
              aria-label="Open mobile menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 truncate">
              <Link href="/dashboard" className="hover:text-slate-900 dark:hover:text-white font-medium">
                Stockora
              </Link>
              {breadcrumbSegments.map((seg, i) => (
                <React.Fragment key={seg.href}>
                  <span aria-hidden="true">/</span>
                  <Link
                    href={seg.href}
                    className={`truncate ${
                      i === breadcrumbSegments.length - 1
                        ? 'text-slate-900 dark:text-slate-100 font-semibold'
                        : 'hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {seg.label}
                  </Link>
                </React.Fragment>
              ))}
            </nav>
          </div>

          {/* Right: Global Search, Warehouse Filter, Quick Create, Alerts, Theme */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Global Search Trigger */}
            <button
              type="button"
              onClick={() => setGlobalSearchOpen(true)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#172337] text-xs text-slate-500 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
            >
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Search SKU, PO, transfer...</span>
              <kbd className="hidden md:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-white dark:bg-[#111B2C] rounded border border-slate-200 dark:border-slate-700">
                ⌘K
              </kbd>
            </button>

            {/* Global Warehouse Context Selector */}
            <div className="hidden md:flex items-center">
              <select
                aria-label="Active Warehouse Filter"
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none"
              >
                <option value="ALL">All Warehouses (Global)</option>
                {data.warehouses
                  .filter((w) => w.status === 'ACTIVE')
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.code} · {w.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Quick Create Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setQuickMenuOpen(!quickMenuOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Quick Create</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {quickMenuOpen && (
                <div
                  className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] shadow-xl py-1.5 z-40 text-xs"
                  onMouseLeave={() => setQuickMenuOpen(false)}
                >
                  {[
                    { id: 'product' as const, label: 'Add Product' },
                    { id: 'supplier' as const, label: 'Add Supplier' },
                    { id: 'po' as const, label: 'Create Purchase Order' },
                    { id: 'receive' as const, label: 'Receive Stock (GRN)' },
                    { id: 'transfer' as const, label: 'Transfer Stock' },
                    { id: 'adjustment' as const, label: 'Adjust Inventory' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setQuickMenuOpen(false);
                        setQuickCreateModal(item.id);
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-100 dark:hover:bg-[#1F3047] text-slate-700 dark:text-slate-200 font-medium"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Notification Center */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#172337]"
                aria-label="Open notifications"
              >
                <Bell className="w-4 h-4" />
                {(alerts.outCount > 0 || alerts.lowCount > 0) && (
                  <span className="absolute -top-1 -right-1 px-1 min-w-[16px] h-4 rounded-full bg-[#DC2626] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {alerts.outCount + alerts.lowCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div
                  className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#172337] shadow-xl p-3 z-40 text-xs"
                  onMouseLeave={() => setNotifOpen(false)}
                >
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-700">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      Operational Alerts
                    </span>
                    <Link
                      href="/dashboard/reorder"
                      onClick={() => setNotifOpen(false)}
                      className="text-[#2563EB] dark:text-[#60A5FA] hover:underline"
                    >
                      Reorder Planner →
                    </Link>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#111B2C] flex items-center justify-between">
                      <span>Out-of-Stock Warehouse Slots</span>
                      <strong className="text-[#DC2626] tabular-nums">{alerts.outCount}</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#111B2C] flex items-center justify-between">
                      <span>Low-Stock Threshold Alerts</span>
                      <strong className="text-[#D97706] tabular-nums">{alerts.lowCount}</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#111B2C] flex items-center justify-between">
                      <span>Active In-Transit Shipments</span>
                      <strong className="text-[#2563EB] tabular-nums">{alerts.inTransitCount}</strong>
                    </div>
                    {alerts.topItems.map((b) => (
                      <Link
                        key={`${b.productId}-${b.warehouseId}`}
                        href={`/dashboard/products/${b.productId}`}
                        onClick={() => setNotifOpen(false)}
                        className="flex items-start gap-2 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1F3047]"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            {b.sku} · {b.warehouseCode}
                          </div>
                          <div className="text-slate-500 dark:text-slate-400">
                            Available: {b.availableQuantity} (Reorder ≤ {b.reorderPoint})
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle Light or Dark mode"
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#172337]"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 lg:p-6 max-w-[1600px] w-full mx-auto">
          {!hydrated ? (
            <div className="space-y-4 py-6">
              <div className="h-8 w-64 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className="h-28 rounded-xl bg-white dark:bg-[#172337] border border-slate-200 dark:border-slate-800 animate-pulse"
                  />
                ))}
              </div>
              <div className="h-96 rounded-xl bg-white dark:bg-[#172337] border border-slate-200 dark:border-slate-800 animate-pulse" />
            </div>
          ) : (
            children
          )}
        </main>
      </div>

      <GlobalSearchModal />
      <QuickActionModals />
    </div>
  );
}
