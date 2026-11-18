import { db, organizationGstRatePresets } from '../db.ts';
import type { OrganizationGstRatePreset } from '../db.ts';

/** Standard Indian service-tax slabs every Organization starts with, editable per Organization. */
export const GST_RATE_SEED = ['0', '5', '12', '18', '28'] as const;

export function defaultGstPresetRows(organizationId: string, now = Date.now()) {
  return GST_RATE_SEED.map((rate) => ({
    id: crypto.randomUUID(),
    organization_id: organizationId,
    rate,
    created_at: now,
    updated_at: now,
  }));
}

export interface PresetRateResult {
  ok: boolean;
  value?: string;
  message?: string;
}

const RATE_NUMERIC_PATTERN = /^-?\d+(?:\.\d+)?$/;

/**
 * Validates a GST rate as a non-negative decimal percentage up to 100 and returns a canonical
 * decimal string. No external source is consulted and no floating-point artifacts are stored.
 */
export function parseGstRate(raw: string): PresetRateResult {
  let value = raw.trim();
  if (!RATE_NUMERIC_PATTERN.test(value)) {
    return { ok: false, message: 'Enter a valid percentage such as 18 or 12.5.' };
  }
  let numeric = Number(value);
  if (numeric < 0 || numeric > 100) {
    return { ok: false, message: 'Enter a percentage from 0 to 100.' };
  }
  let decimals = value.split('.')[1] ?? '';
  if (decimals.length > 4) {
    return { ok: false, message: 'Enter a valid percentage such as 18 or 12.5.' };
  }
  return { ok: true, value: String(numeric) };
}

/** Ensures an Organization has its default presets. Call only from a mutation or initialization. */
export async function ensureGstPresets(
  organizationId: string,
): Promise<OrganizationGstRatePreset[]> {
  let existing = await findGstPresets(organizationId);
  if (existing.length > 0) return existing;

  await db.transaction(async (tx) => {
    for (let preset of defaultGstPresetRows(organizationId)) {
      await tx.create(organizationGstRatePresets, preset);
    }
  });
  return findGstPresets(organizationId);
}

export function findGstPresets(organizationId: string): Promise<OrganizationGstRatePreset[]> {
  return db.findMany(organizationGstRatePresets, {
    where: { organization_id: organizationId },
  });
}

export interface PresetMutation {
  ok: boolean;
  notFound?: boolean;
  message?: string;
}

function duplicateMessage(rate: string): string {
  return `A GST rate preset of ${rate}% already exists.`;
}

export async function addGstPreset(
  organizationId: string,
  rawRate: string,
): Promise<PresetMutation> {
  let parsed = parseGstRate(rawRate);
  if (!parsed.ok) return { ok: false, message: parsed.message };
  let rate = parsed.value!;

  let existing = await findGstPresets(organizationId);
  if (existing.some((preset) => preset.rate === rate)) {
    return { ok: false, message: duplicateMessage(rate) };
  }

  let now = Date.now();
  await db.create(organizationGstRatePresets, {
    id: crypto.randomUUID(),
    organization_id: organizationId,
    rate,
    created_at: now,
    updated_at: now,
  });
  return { ok: true };
}

export async function updateGstPreset(
  organizationId: string,
  presetId: string,
  rawRate: string,
): Promise<PresetMutation> {
  let current = await db.findOne(organizationGstRatePresets, {
    where: { id: presetId, organization_id: organizationId },
  });
  if (!current) return { ok: false, notFound: true };

  let parsed = parseGstRate(rawRate);
  if (!parsed.ok) return { ok: false, message: parsed.message };
  let rate = parsed.value!;

  let existing = await findGstPresets(organizationId);
  if (existing.some((preset) => preset.rate === rate && preset.id !== presetId)) {
    return { ok: false, message: duplicateMessage(rate) };
  }

  await db.update(organizationGstRatePresets, presetId, { rate, updated_at: Date.now() });
  return { ok: true };
}

export async function removeGstPreset(
  organizationId: string,
  presetId: string,
): Promise<{ found: boolean }> {
  let current = await db.findOne(organizationGstRatePresets, {
    where: { id: presetId, organization_id: organizationId },
  });
  if (!current) return { found: false };
  await db.delete(organizationGstRatePresets, presetId);
  return { found: true };
}
