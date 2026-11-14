import { DISPLAY_NAME_MAX_LENGTH } from '../config.ts';

export type DisplayNameResult =
  | { ok: true; value: string | null }
  | { ok: false; error: string };

/** Trims a submitted display name, treats blank input as unset, and enforces the length limit. */
export function parseDisplayName(input: string): DisplayNameResult {
  let value = input.trim();
  if (value.length > DISPLAY_NAME_MAX_LENGTH) {
    return {
      ok: false,
      error: `Display name must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer`,
    };
  }
  return { ok: true, value: value || null };
}
