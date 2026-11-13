import { z } from 'zod';
import { StockoraData, WorkspaceSettings } from '@/types/erp';
import { DEFAULT_WORKSPACE_SETTINGS, generateDeterministicSeedData } from '@/lib/seed';

export const STORAGE_KEYS = {
  VERSION: 'stockora:version',
  DATA: 'stockora:data',
  SETTINGS: 'stockora:settings',
  UI: 'stockora:ui',
} as const;

export const CURRENT_SCHEMA_VERSION = '1.0.0';

/**
 * Zod validation schema for JSON backup/restore & LocalStorage integrity checks.
 * Rejects invalid foreign references, negative stock balances, and duplicate movement IDs.
 */
const StockMovementSchema = z.object({
  id: z.string().min(1),
  timestamp: z.string().min(1),
  productId: z.string().min(1),
  sku: z.string().min(1),
  productName: z.string().min(1),
  warehouseId: z.string().min(1),
  movementType: z.enum([
    'OPENING_BALANCE',
    'PURCHASE_RECEIPT',
    'TRANSFER_OUT',
    'TRANSFER_IN',
    'POSITIVE_ADJUSTMENT',
    'NEGATIVE_ADJUSTMENT',
    'RESERVATION',
    'RESERVATION_RELEASE',
    'REVERSAL',
  ]),
  quantityDelta: z.number(),
  beforeQuantity: z.number(),
  afterQuantity: z.number(),
  unitCostSnapshot: z.number().nonnegative(),
  totalValueSnapshot: z.number().nonnegative(),
  sourceReference: z.string(),
  sourceId: z.string(),
  reason: z.string(),
  actor: z.string(),
  reversedByMovementId: z.string().optional(),
  reversesMovementId: z.string().optional(),
});

const BackupPayloadSchema = z.object({
  version: z.string(),
  products: z.array(
    z.object({
      id: z.string().min(1),
      sku: z.string().min(1),
      name: z.string().min(1),
      categoryId: z.string().min(1),
      purchaseCost: z.number().nonnegative(),
      sellingPrice: z.number().nonnegative(),
    }).passthrough()
  ),
  categories: z.array(z.object({ id: z.string().min(1), name: z.string().min(1) }).passthrough()),
  warehouses: z.array(z.object({ id: z.string().min(1), name: z.string().min(1), code: z.string().min(1) }).passthrough()),
  suppliers: z.array(z.object({ id: z.string().min(1), companyName: z.string().min(1) }).passthrough()),
  purchaseOrders: z.array(z.object({ id: z.string().min(1), poNumber: z.string().min(1) }).passthrough()),
  goodsReceipts: z.array(z.object({ id: z.string().min(1), grnNumber: z.string().min(1) }).passthrough()),
  stockTransfers: z.array(z.object({ id: z.string().min(1), transferNumber: z.string().min(1) }).passthrough()),
  stockAdjustments: z.array(z.object({ id: z.string().min(1), adjustmentNumber: z.string().min(1) }).passthrough()),
  stockMovements: z.array(StockMovementSchema),
}).passthrough();

export function validateStockoraDataset(raw: unknown): {
  valid: boolean;
  data?: StockoraData;
  error?: string;
} {
  const parsed = BackupPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      valid: false,
      error: `Schema validation failed: ${parsed.error.issues[0]?.message ?? 'Invalid structure'}`,
    };
  }

  const candidate = parsed.data as unknown as StockoraData;
  const productIds = new Set(candidate.products.map((p) => p.id));
  const warehouseIds = new Set(candidate.warehouses.map((w) => w.id));
  const seenMovementIds = new Set<string>();

  for (const mov of candidate.stockMovements) {
    if (seenMovementIds.has(mov.id)) {
      return { valid: false, error: `Duplicate movement transaction ID detected: ${mov.id}` };
    }
    seenMovementIds.add(mov.id);

    if (!productIds.has(mov.productId)) {
      return {
        valid: false,
        error: `Movement ${mov.id} references non-existent product ID ${mov.productId}`,
      };
    }
    if (!warehouseIds.has(mov.warehouseId)) {
      return {
        valid: false,
        error: `Movement ${mov.id} references non-existent warehouse ID ${mov.warehouseId}`,
      };
    }
  }

  // Verify ledger balances are not negative
  const balances = new Map<string, number>();
  for (const mov of candidate.stockMovements) {
    if (mov.movementType === 'RESERVATION' || mov.movementType === 'RESERVATION_RELEASE') continue;
    const key = `${mov.productId}::${mov.warehouseId}`;
    balances.set(key, (balances.get(key) ?? 0) + mov.quantityDelta);
  }
  for (const [key, qty] of balances.entries()) {
    if (qty < 0) {
      return {
        valid: false,
        error: `Inconsistent stock ledger: negative balance (${qty}) detected for ${key}`,
      };
    }
  }

  return { valid: true, data: candidate };
}

/**
 * Load dataset from LocalStorage with automatic corruption recovery & deterministic seed fallback.
 */
export function loadStockoraFromStorage(): {
  data: StockoraData;
  settings: WorkspaceSettings;
  recoveredFromCorruption: boolean;
} {
  if (typeof window === 'undefined') {
    return {
      data: generateDeterministicSeedData(),
      settings: DEFAULT_WORKSPACE_SETTINGS,
      recoveredFromCorruption: false,
    };
  }

  try {
    const rawData = window.localStorage.getItem(STORAGE_KEYS.DATA);
    const rawSettings = window.localStorage.getItem(STORAGE_KEYS.SETTINGS);

    let settings = DEFAULT_WORKSPACE_SETTINGS;
    if (rawSettings) {
      try {
        settings = { ...DEFAULT_WORKSPACE_SETTINGS, ...JSON.parse(rawSettings) };
      } catch {
        settings = DEFAULT_WORKSPACE_SETTINGS;
      }
    }

    if (!rawData) {
      const seed = generateDeterministicSeedData();
      saveStockoraToStorage(seed, settings);
      return { data: seed, settings, recoveredFromCorruption: false };
    }

    const parsedJson = JSON.parse(rawData);
    const validation = validateStockoraDataset(parsedJson);
    if (!validation.valid || !validation.data) {
      // Corrupt data recovery -> re-initialize deterministic seed
      const seed = generateDeterministicSeedData();
      saveStockoraToStorage(seed, settings);
      return { data: seed, settings, recoveredFromCorruption: true };
    }

    return { data: validation.data, settings, recoveredFromCorruption: false };
  } catch {
    const seed = generateDeterministicSeedData();
    return {
      data: seed,
      settings: DEFAULT_WORKSPACE_SETTINGS,
      recoveredFromCorruption: true,
    };
  }
}

export function saveStockoraToStorage(
  data: StockoraData,
  settings?: WorkspaceSettings
): { ok: boolean; error?: string } {
  if (typeof window === 'undefined') return { ok: true };
  try {
    window.localStorage.setItem(STORAGE_KEYS.VERSION, CURRENT_SCHEMA_VERSION);
    window.localStorage.setItem(STORAGE_KEYS.DATA, JSON.stringify(data));
    if (settings) {
      window.localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'LocalStorage quota exceeded or unavailable.',
    };
  }
}

export function exportStockoraBackupJson(
  data: StockoraData,
  settings: WorkspaceSettings
): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      schemaVersion: CURRENT_SCHEMA_VERSION,
      settings,
      data,
    },
    null,
    2
  );
}

export function restoreStockoraBackupJson(jsonString: string): {
  ok: boolean;
  data?: StockoraData;
  settings?: WorkspaceSettings;
  error?: string;
} {
  try {
    const parsed = JSON.parse(jsonString);
    const candidateData = parsed.data ? parsed.data : parsed;
    const validation = validateStockoraDataset(candidateData);
    if (!validation.valid || !validation.data) {
      return { ok: false, error: validation.error ?? 'Invalid backup file.' };
    }
    const nextSettings: WorkspaceSettings = parsed.settings
      ? { ...DEFAULT_WORKSPACE_SETTINGS, ...parsed.settings }
      : DEFAULT_WORKSPACE_SETTINGS;

    saveStockoraToStorage(validation.data, nextSettings);
    return { ok: true, data: validation.data, settings: nextSettings };
  } catch {
    return { ok: false, error: 'Malformed JSON file. Could not parse backup payload.' };
  }
}
