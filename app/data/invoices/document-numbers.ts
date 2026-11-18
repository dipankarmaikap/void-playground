import { sql } from 'remix/data-table';
import type { Database } from 'remix/data-table';

/** The document types that share the per-Organization financial-year sequence table. */
export type DocumentSequenceType = 'invoice' | 'credit_note';

/** Document-specific numbering configuration; each issuance passes its own. */
export interface DocumentSequenceConfig {
  documentType: DocumentSequenceType;
  prefix: string;
  startingNumber: number;
}

/** Matches each document type's error wording, e.g. "credit-note sequence number". */
function documentTypeLabel(documentType: DocumentSequenceType): string {
  return documentType === 'invoice' ? 'invoice' : 'credit-note';
}

/**
 * Allocates the next `PREFIX/FY/NNNN` number from the per-Organization financial-year
 * sequence inside the caller's issue transaction. The upsert is safe under concurrent
 * issues, and a failed issue never consumes a number.
 */
export async function allocateDocumentNumber(
  transaction: Database,
  organizationId: string,
  financialYear: string,
  config: DocumentSequenceConfig,
  now: number,
): Promise<string> {
  let result = await transaction.exec(sql`
    INSERT INTO document_sequences (
      id, organization_id, document_type, financial_year, current_number, created_at, updated_at
    )
    VALUES (
      ${crypto.randomUUID()}, ${organizationId}, ${config.documentType}, ${financialYear},
      ${config.startingNumber}, ${now}, ${now}
    )
    ON CONFLICT (organization_id, document_type, financial_year)
    DO UPDATE SET
      current_number = MAX(document_sequences.current_number + 1, excluded.current_number),
      updated_at = excluded.updated_at
    RETURNING current_number
  `);
  let row = result.rows?.[0] as { current_number?: unknown } | undefined;
  let number = row?.current_number;
  if (typeof number !== 'number' || !Number.isSafeInteger(number) || number < 1) {
    throw new Error(
      `Unable to allocate a safe ${documentTypeLabel(config.documentType)} sequence number.`,
    );
  }
  return `${config.prefix}/${financialYear}/${String(number).padStart(4, '0')}`;
}
