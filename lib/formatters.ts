import { StockStatus } from '@/types/erp';

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CAD: 'CA$',
  AUD: 'A$',
};

export function formatCurrency(amount: number, currency = 'USD'): string {
  const sym = CURRENCY_SYMBOLS[currency] ?? '$';
  const safe = Number.isFinite(amount) ? amount : 0;
  return `${sym}${safe.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatQuantity(qty: number): string {
  const safe = Number.isFinite(qty) ? qty : 0;
  return safe.toLocaleString('en-US');
}

export function formatDateShort(iso: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export function formatDateTime(iso: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso.slice(0, 16).replace('T', ' ');
  }
}

export function getStockStatusLabel(status: StockStatus): string {
  switch (status) {
    case 'IN_STOCK':
      return 'In Stock';
    case 'LOW_STOCK':
      return 'Low Stock';
    case 'OUT_OF_STOCK':
      return 'Out of Stock';
  }
}

export function getStockStatusColorClass(status: StockStatus): string {
  switch (status) {
    case 'IN_STOCK':
      return 'text-[#059669] dark:text-emerald-400 font-medium';
    case 'LOW_STOCK':
      return 'text-[#D97706] dark:text-amber-400 font-medium';
    case 'OUT_OF_STOCK':
      return 'text-[#DC2626] dark:text-rose-400 font-semibold';
  }
}
