/** Joins the non-blank parts of an address with ", ", skipping blank or whitespace-only parts. */
export function joinAddressParts(parts: Array<string | null | undefined>): string {
  return parts
    .filter((part): part is string => Boolean(part?.trim()))
    .join(', ');
}
