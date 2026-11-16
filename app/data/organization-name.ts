export type OrganizationNameResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

/** Trims a submitted Organization name and rejects blank input. */
export function parseOrganizationName(input: string): OrganizationNameResult {
  let value = input.trim();
  if (!value) return { ok: false, error: 'Organization name is required' };
  return { ok: true, value };
}
