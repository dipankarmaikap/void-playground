import { sql } from 'remix/data-table';
import type { Database } from 'remix/data-table';
import type { SqliteDatabase } from 'remix/data-table/sqlite';

import {
  creditNoteLines,
  creditNotes,
  invoiceLines,
  invoices,
  organizationInvoicingProfiles,
} from '../db.ts';
import type {
  CreditNote,
  CreditNoteLine,
  Invoice,
  InvoiceLine,
} from '../db.ts';
import type { InvoicePdfDocument, LineValueFields } from './documents.ts';
import {
  calculateLineAmountMinor,
  formatScaledDecimal,
  parseScaledDecimal,
  percentOfMinor,
  toExactMinorNumber,
  toExactSignedMinorNumber,
} from './calculation.ts';
import { indianFinancialYear } from './issuance.ts';
import { allocateDocumentNumber } from './document-numbers.ts';
import type {
  CreditNoteDraftInput,
} from './credit-note-form-values.ts';
import { isValidIsoDate } from './dates.ts';
import {
  DEFAULT_CREDIT_NOTE_PREFIX,
  DEFAULT_STARTING_NUMBER,
} from '../organization/invoicing.ts';

export interface CreditNoteDraftIssue {
  field: 'credit_date' | 'reason' | 'lines' | 'line_quantity';
  lineId?: string;
  message: string;
}

/** One reversal line: copied stable values plus its source-line identity and copied tax strings. */
export interface CreditNoteLineChanges extends LineValueFields {
  invoice_line_id: string;
  tax_treatment: string | null;
  foreign_tax_mode: string | null;
}

export interface CreditNoteDraftChanges {
  credit_date: string;
  reason: string;
  subtotal_minor: number;
  line_discount_total_minor: number;
  invoice_discount_minor: number;
  net_subtotal_minor: number;
  tax_total_minor: number;
  round_off_minor: number;
  total_minor: number;
  lines: CreditNoteLineChanges[];
}

export type CreditNoteDraftCalculation =
  | { ok: true; value: CreditNoteDraftChanges }
  | { ok: false; issues: CreditNoteDraftIssue[] };

export type SaveCreditNoteDraftResult =
  | { ok: true; creditNote: CreditNote }
  | { ok: false; kind: 'not_found' | 'not_issued' | 'no_remaining' | 'conflict' }
  | { ok: false; kind: 'invalid'; issues: CreditNoteDraftIssue[] };

export type IssueCreditNoteResult =
  | { ok: true; creditNote: CreditNote }
  | {
      ok: false;
      kind: 'not_found' | 'not_issued' | 'conflict' | 'over_limit' | 'invalid';
    };

/** The context the issue transaction hands to the issued-credit-note finalizer. */
export interface IssuedCreditNoteFinalizerContext {
  transaction: Database;
  /** Client-facing parent invoice snapshot; the private internal note is excluded. */
  invoice: InvoicePdfDocument;
  creditNote: CreditNote;
  lines: readonly CreditNoteLine[];
}

/** Runs inside the issue transaction to persist the immutable issued PDF artifact. */
export type IssuedCreditNoteFinalizer = (
  context: IssuedCreditNoteFinalizerContext,
) => Promise<void>;

export interface CreditNoteLineCapacity {
  quantity: string;
  amountMinor: number;
}

const ZERO = 0n;

function positiveDifference(total: bigint, used: bigint): bigint {
  return total > used ? total - used : ZERO;
}

function sum(values: readonly number[]): bigint {
  return values.reduce((total, value) => total + BigInt(value), ZERO);
}

function prorate(totalMinor: number, part: bigint, whole: bigint): bigint {
  if (totalMinor <= 0 || part <= ZERO || whole <= ZERO) return ZERO;
  let total = BigInt(totalMinor);
  return (total * part + whole / 2n) / whole;
}

function bounded(value: bigint, remaining: bigint): bigint {
  return value > remaining ? remaining : value;
}

function asExactMinor(value: bigint): number | null {
  return toExactMinorNumber(value);
}

function remainingLineAmount(
  source: InvoiceLine,
  issuedLines: readonly CreditNoteLine[],
  field: keyof Pick<
    CreditNoteLine,
    | 'amount_minor'
    | 'line_discount_minor'
    | 'allocated_invoice_discount_minor'
    | 'net_minor'
    | 'cgst_amount_minor'
    | 'sgst_amount_minor'
    | 'igst_amount_minor'
    | 'foreign_tax_amount_minor'
  >,
): bigint {
  let used = sum(
    issuedLines
      .filter((line) => line.invoice_line_id === source.id)
      .map((line) => line[field] as number),
  );
  return positiveDifference(BigInt(source[field]), used);
}

function remainingQuantity(source: InvoiceLine, issuedLines: readonly CreditNoteLine[]): bigint {
  let sourceQuantity = parseScaledDecimal(source.quantity);
  if (sourceQuantity == null) return ZERO;
  let issuedQuantity = issuedLines
    .filter((line) => line.invoice_line_id === source.id)
    .reduce((total, line) => total + (parseScaledDecimal(line.quantity) ?? ZERO), ZERO);
  return positiveDifference(sourceQuantity, issuedQuantity);
}

function partialLineTax(
  invoice: Invoice,
  source: InvoiceLine,
  netMinor: bigint,
): { cgst: bigint; sgst: bigint; igst: bigint; foreign: bigint } {
  let cgst = ZERO;
  let sgst = ZERO;
  let igst = ZERO;
  let foreign = ZERO;

  if (invoice.gst_mode === 'india_gst' && source.tax_treatment === 'taxable') {
    let rate = source.gst_rate ? parseScaledDecimal(source.gst_rate) : null;
    if (rate != null) {
      let lineTax = percentOfMinor(netMinor, rate);
      if (source.cgst_rate != null && source.sgst_rate != null) {
        cgst = (lineTax + 1n) / 2n;
        sgst = lineTax / 2n;
      } else if (source.igst_rate != null) {
        igst = lineTax;
      }
    }
  }

  if (invoice.gst_mode === 'foreign_manual' && source.foreign_tax_mode === 'percent') {
    let rate = source.foreign_tax_rate ? parseScaledDecimal(source.foreign_tax_rate) : null;
    if (rate != null) foreign = percentOfMinor(netMinor, rate);
  } else if (invoice.gst_mode === 'foreign_manual' && source.foreign_tax_mode === 'fixed') {
    foreign = prorate(source.foreign_tax_amount_minor, netMinor, BigInt(source.net_minor));
  }

  return { cgst, sgst, igst, foreign };
}

function buildCreditNoteLine(
  invoice: Invoice,
  source: InvoiceLine,
  quantity: bigint,
  issuedLines: readonly CreditNoteLine[],
  position: number,
): CreditNoteLineChanges | null {
  let sourceQuantity = parseScaledDecimal(source.quantity);
  let unitPrice = parseScaledDecimal(source.unit_price);
  if (sourceQuantity == null || unitPrice == null || quantity <= ZERO) return null;

  let previousQuantity = sourceQuantity - remainingQuantity(source, issuedLines);
  let availableQuantity = sourceQuantity - previousQuantity;
  if (quantity > availableQuantity) return null;
  let completesRemainingLine = quantity === availableQuantity;

  let amountRemaining = remainingLineAmount(source, issuedLines, 'amount_minor');
  let amount = completesRemainingLine
    ? amountRemaining
    : bounded(
        calculateLineAmountMinor(quantity, unitPrice, invoice.currency),
        amountRemaining,
      );
  let lineDiscountRemaining = remainingLineAmount(
    source,
    issuedLines,
    'line_discount_minor',
  );
  let lineDiscount = ZERO;
  if (completesRemainingLine) {
    lineDiscount = lineDiscountRemaining;
  } else if (source.discount_mode === 'percent' && source.discount_value) {
    let rate = parseScaledDecimal(source.discount_value);
    if (rate != null) lineDiscount = percentOfMinor(amount, rate);
  } else if (source.discount_mode === 'fixed') {
    lineDiscount = prorate(source.line_discount_minor, amount, BigInt(source.amount_minor));
  }
  lineDiscount = bounded(lineDiscount, lineDiscountRemaining);
  lineDiscount = bounded(lineDiscount, amount);

  let invoiceDiscountRemaining = remainingLineAmount(
    source,
    issuedLines,
    'allocated_invoice_discount_minor',
  );
  let originalBeforeInvoiceDiscount = BigInt(source.amount_minor - source.line_discount_minor);
  let creditedBeforeInvoiceDiscount = amount - lineDiscount;
  let invoiceDiscount = completesRemainingLine
    ? invoiceDiscountRemaining
    : prorate(
        source.allocated_invoice_discount_minor,
        creditedBeforeInvoiceDiscount,
        originalBeforeInvoiceDiscount,
      );
  invoiceDiscount = bounded(invoiceDiscount, invoiceDiscountRemaining);
  invoiceDiscount = bounded(invoiceDiscount, creditedBeforeInvoiceDiscount);

  let netRemaining = remainingLineAmount(source, issuedLines, 'net_minor');
  let net = completesRemainingLine
    ? netRemaining
    : positiveDifference(creditedBeforeInvoiceDiscount, invoiceDiscount);
  net = bounded(net, netRemaining);

  let cgstRemaining = remainingLineAmount(source, issuedLines, 'cgst_amount_minor');
  let sgstRemaining = remainingLineAmount(source, issuedLines, 'sgst_amount_minor');
  let igstRemaining = remainingLineAmount(source, issuedLines, 'igst_amount_minor');
  let foreignRemaining = remainingLineAmount(source, issuedLines, 'foreign_tax_amount_minor');
  let tax = completesRemainingLine
    ? {
        cgst: cgstRemaining,
        sgst: sgstRemaining,
        igst: igstRemaining,
        foreign: foreignRemaining,
      }
    : partialLineTax(invoice, source, net);
  tax = {
    cgst: bounded(tax.cgst, cgstRemaining),
    sgst: bounded(tax.sgst, sgstRemaining),
    igst: bounded(tax.igst, igstRemaining),
    foreign: bounded(tax.foreign, foreignRemaining),
  };

  let amounts = [
    amount,
    lineDiscount,
    invoiceDiscount,
    net,
    tax.cgst,
    tax.sgst,
    tax.igst,
    tax.foreign,
  ].map(asExactMinor);
  if (amounts.some((value) => value == null)) return null;

  return {
    invoice_line_id: source.id,
    position,
    description: source.description,
    sac: source.sac,
    quantity: formatScaledDecimal(quantity),
    unit_price: source.unit_price,
    amount_minor: amounts[0]!,
    discount_mode: source.discount_mode,
    discount_value: source.discount_value,
    line_discount_minor: amounts[1]!,
    allocated_invoice_discount_minor: amounts[2]!,
    net_minor: amounts[3]!,
    tax_treatment: source.tax_treatment,
    gst_rate: source.gst_rate,
    cgst_rate: source.cgst_rate,
    sgst_rate: source.sgst_rate,
    igst_rate: source.igst_rate,
    cgst_amount_minor: amounts[4]!,
    sgst_amount_minor: amounts[5]!,
    igst_amount_minor: amounts[6]!,
    foreign_tax_label: source.foreign_tax_label,
    foreign_tax_mode: source.foreign_tax_mode,
    foreign_tax_rate: source.foreign_tax_rate,
    foreign_tax_amount_minor: amounts[7]!,
  };
}

/** Calculates credited quantities and tax from the original frozen invoice lines. */
export function calculateCreditNoteDraft(
  invoice: Invoice,
  sourceLines: readonly InvoiceLine[],
  issuedCreditNotes: readonly CreditNote[],
  issuedLines: readonly CreditNoteLine[],
  input: CreditNoteDraftInput,
): CreditNoteDraftCalculation {
  let issues: CreditNoteDraftIssue[] = [];
  let push = (field: CreditNoteDraftIssue['field'], message: string, lineId?: string) =>
    issues.push({ field, lineId, message });

  let creditDate = input.credit_date.trim();
  if (!isValidIsoDate(creditDate)) {
    push('credit_date', 'Enter a valid credit note date.');
  } else if (creditDate < invoice.invoice_date) {
    push('credit_date', 'The credit note date cannot be earlier than the original invoice date.');
  }

  let reason = input.reason.trim();
  if (!reason) push('reason', 'Enter a reason for this credit note.');
  if (input.reason.length > 1000) {
    push('reason', 'Reason must be 1,000 characters or fewer.');
  }

  let sourceById = new Map(sourceLines.map((line) => [line.id, line]));
  let seen = new Set<string>();
  let quantities = new Map<string, bigint>();
  let lines: CreditNoteLineChanges[] = [];
  for (let requestedLine of input.lines) {
    let lineId = requestedLine.invoice_line_id;
    if (seen.has(lineId)) {
      push('line_quantity', 'Each original service line can be credited only once per draft.', lineId);
      continue;
    }
    seen.add(lineId);
    let source = sourceById.get(lineId);
    if (!source) {
      push('line_quantity', 'Choose a service line from the original invoice.', lineId);
      continue;
    }
    let rawQuantity = requestedLine.quantity.trim();
    if (!rawQuantity) continue;
    let quantity = parseScaledDecimal(rawQuantity);
    if (quantity == null) {
      push('line_quantity', 'Enter a positive quantity with at most 4 decimal places.', lineId);
      continue;
    }
    if (quantity === ZERO) continue;
    let maxQuantity = remainingQuantity(source, issuedLines);
    if (quantity > maxQuantity) {
      push(
        'line_quantity',
        `Quantity cannot exceed the remaining creditable quantity (${formatScaledDecimal(maxQuantity)}).`,
        lineId,
      );
      continue;
    }
    let line = buildCreditNoteLine(invoice, source, quantity, issuedLines, lines.length);
    if (!line) {
      push('line_quantity', 'This service line cannot be credited with the submitted quantity.', lineId);
      continue;
    }
    quantities.set(lineId, quantity);
    lines.push(line);
  }
  if (lines.length === 0) {
    push('lines', 'Credit at least one service line.');
  }

  if (issues.length > 0) return { ok: false, issues };

  let fullyCredited = sourceLines.every((source) => {
    let sourceQuantity = parseScaledDecimal(source.quantity);
    return (
      sourceQuantity != null &&
      remainingQuantity(source, issuedLines) === (quantities.get(source.id) ?? ZERO)
    );
  });
  let previousRoundOff = issuedCreditNotes.reduce(
    (total, note) => total + BigInt(note.round_off_minor),
    ZERO,
  );
  let roundOffMinor = fullyCredited
    ? BigInt(invoice.round_off_minor) - previousRoundOff
    : ZERO;

  let subtotalMinor = sum(lines.map((line) => line.amount_minor));
  let lineDiscountMinor = sum(lines.map((line) => line.line_discount_minor));
  let invoiceDiscountMinor = sum(lines.map((line) => line.allocated_invoice_discount_minor));
  let netSubtotalMinor = sum(lines.map((line) => line.net_minor));
  let taxTotalMinor = sum(
    lines.map(
      (line) =>
        line.cgst_amount_minor +
        line.sgst_amount_minor +
        line.igst_amount_minor +
        line.foreign_tax_amount_minor,
    ),
  );
  let totalMinor =
    netSubtotalMinor + (invoice.reverse_charge ? ZERO : taxTotalMinor) + roundOffMinor;
  let currentCreditTotal = issuedCreditNotes.reduce(
    (total, note) => total + BigInt(note.total_minor),
    totalMinor,
  );
  let exactAmounts = [
    subtotalMinor,
    lineDiscountMinor,
    invoiceDiscountMinor,
    netSubtotalMinor,
    taxTotalMinor,
    totalMinor,
  ].map(asExactMinor);
  let roundOffNumber = toExactSignedMinorNumber(roundOffMinor);
  if (
    exactAmounts.some((value) => value == null) ||
    roundOffNumber == null ||
    totalMinor <= ZERO
  ) {
    return {
      ok: false,
      issues: [{ field: 'lines', message: 'The credited total must be greater than zero and exactly representable.' }],
    };
  }
  if (currentCreditTotal > BigInt(invoice.total_minor)) {
    return {
      ok: false,
      issues: [{ field: 'lines', message: 'Cumulative credit notes cannot exceed the original invoice total.' }],
    };
  }

  return {
    ok: true,
    value: {
      credit_date: creditDate,
      reason,
      subtotal_minor: exactAmounts[0]!,
      line_discount_total_minor: exactAmounts[1]!,
      invoice_discount_minor: exactAmounts[2]!,
      net_subtotal_minor: exactAmounts[3]!,
      tax_total_minor: exactAmounts[4]!,
      round_off_minor: roundOffNumber,
      total_minor: exactAmounts[5]!,
      lines,
    },
  };
}

function getCreditNoteHeaderValues(changes: CreditNoteDraftChanges) {
  let { lines: _lines, ...header } = changes;
  return header;
}

function creditNoteLineRow(
  organizationId: string,
  creditNoteId: string,
  invoiceId: string,
  line: CreditNoteLineChanges,
  now: number,
): CreditNoteLine {
  return {
    id: crypto.randomUUID(),
    organization_id: organizationId,
    credit_note_id: creditNoteId,
    invoice_id: invoiceId,
    ...line,
    created_at: now,
    updated_at: now,
  };
}

async function issuedCreditData(
  transaction: Database,
  organizationId: string,
  invoiceId: string,
): Promise<{ notes: CreditNote[]; lines: CreditNoteLine[] }> {
  let notes = await transaction.findMany(creditNotes, {
    where: { organization_id: organizationId, invoice_id: invoiceId, status: 'issued' },
  });
  let noteIds = new Set(notes.map((note) => note.id));
  let lines = await transaction.findMany(creditNoteLines, {
    where: { organization_id: organizationId, invoice_id: invoiceId },
  });
  return { notes, lines: lines.filter((line) => noteIds.has(line.credit_note_id)) };
}

async function createCreditNoteDraftIn(
  transaction: Database,
  organizationId: string,
  invoice: Invoice,
  input: CreditNoteDraftInput,
): Promise<SaveCreditNoteDraftResult> {
  let [sourceLines, issued] = await Promise.all([
    transaction.findMany(invoiceLines, {
      where: { organization_id: organizationId, invoice_id: invoice.id },
      orderBy: [['position', 'asc']],
    }),
    issuedCreditData(transaction, organizationId, invoice.id),
  ]);
  let creditedAlready = issued.notes.reduce(
    (total, note) => total + BigInt(note.total_minor),
    ZERO,
  );
  if (creditedAlready >= BigInt(invoice.total_minor)) {
    return { ok: false, kind: 'no_remaining' };
  }
  let calculated = calculateCreditNoteDraft(invoice, sourceLines, issued.notes, issued.lines, input);
  if (!calculated.ok) return { ok: false, kind: 'invalid', issues: calculated.issues };

  let id = crypto.randomUUID();
  let now = Date.now();
  let note: CreditNote = {
    id,
    organization_id: organizationId,
    invoice_id: invoice.id,
    status: 'draft',
    credit_note_number: null,
    issued_at: null,
    invoice_discount_mode: invoice.invoice_discount_mode,
    ...getCreditNoteHeaderValues(calculated.value),
    created_at: now,
    updated_at: now,
  };
  await transaction.create(creditNotes, note);
  for (let line of calculated.value.lines) {
    await transaction.create(
      creditNoteLines,
      creditNoteLineRow(organizationId, id, invoice.id, line, now),
    );
  }
  return { ok: true, creditNote: note };
}

/** Creates a linked Draft Credit Note without allocating a number or changing the invoice. */
export async function createCreditNoteDraft(
  db: SqliteDatabase,
  organizationId: string,
  invoiceId: string,
  input: CreditNoteDraftInput,
): Promise<SaveCreditNoteDraftResult> {
  return db.transaction(async (transaction) => {
    let invoice = await transaction.findOne(invoices, {
      where: { id: invoiceId, organization_id: organizationId, document_type: 'invoice' },
    });
    if (!invoice) return { ok: false, kind: 'not_found' } as const;
    if (invoice.status !== 'issued') return { ok: false, kind: 'not_issued' } as const;
    return createCreditNoteDraftIn(transaction, organizationId, invoice, input);
  });
}

/** Reads a Credit Note only when both its invoice and Organization match the request. */
export function findCreditNote(
  db: SqliteDatabase,
  organizationId: string,
  invoiceId: string,
  creditNoteId: string,
): Promise<CreditNote | null> {
  return db.findOne(creditNotes, {
    where: {
      id: creditNoteId,
      organization_id: organizationId,
      invoice_id: invoiceId,
    },
  });
}

/** Reads the lines for one Credit Note within its Organization and parent invoice. */
export function findCreditNoteLines(
  db: SqliteDatabase,
  organizationId: string,
  invoiceId: string,
  creditNoteId: string,
): Promise<CreditNoteLine[]> {
  return db.findMany(creditNoteLines, {
    where: {
      organization_id: organizationId,
      invoice_id: invoiceId,
      credit_note_id: creditNoteId,
    },
    orderBy: [['position', 'asc']],
  });
}

/** Updates only a Draft; current issued notes are reloaded before credit limits are recalculated. */
export async function updateCreditNoteDraft(
  db: SqliteDatabase,
  organizationId: string,
  invoiceId: string,
  creditNoteId: string,
  input: CreditNoteDraftInput,
): Promise<SaveCreditNoteDraftResult> {
  return db.transaction(async (transaction) => {
    let note = await transaction.findOne(creditNotes, {
      where: {
        id: creditNoteId,
        organization_id: organizationId,
        invoice_id: invoiceId,
      },
    });
    if (!note) return { ok: false, kind: 'not_found' } as const;
    if (note.status !== 'draft') return { ok: false, kind: 'conflict' } as const;
    let invoice = await transaction.findOne(invoices, {
      where: { id: invoiceId, organization_id: organizationId, document_type: 'invoice' },
    });
    if (!invoice) return { ok: false, kind: 'not_found' } as const;
    if (invoice.status !== 'issued') return { ok: false, kind: 'not_issued' } as const;

    let [sourceLines, issued] = await Promise.all([
      transaction.findMany(invoiceLines, {
        where: { organization_id: organizationId, invoice_id: invoiceId },
        orderBy: [['position', 'asc']],
      }),
      issuedCreditData(transaction, organizationId, invoiceId),
    ]);
    let calculated = calculateCreditNoteDraft(
      invoice,
      sourceLines,
      issued.notes,
      issued.lines,
      input,
    );
    if (!calculated.ok) return { ok: false, kind: 'invalid', issues: calculated.issues } as const;

    let now = Date.now();
    let updated = await transaction.updateMany(
      creditNotes,
      {
        ...getCreditNoteHeaderValues(calculated.value),
        invoice_discount_mode: invoice.invoice_discount_mode,
        updated_at: now,
      },
      {
        where: {
          id: creditNoteId,
          organization_id: organizationId,
          invoice_id: invoiceId,
          status: 'draft',
        },
        limit: 1,
      },
    );
    if (updated.affectedRows === 0) return { ok: false, kind: 'conflict' } as const;
    await transaction.deleteMany(creditNoteLines, {
      where: {
        organization_id: organizationId,
        invoice_id: invoiceId,
        credit_note_id: creditNoteId,
      },
    });
    for (let line of calculated.value.lines) {
      await transaction.create(
        creditNoteLines,
        creditNoteLineRow(organizationId, creditNoteId, invoiceId, line, now),
      );
    }
    let saved = await transaction.findOne(creditNotes, {
      where: {
        id: creditNoteId,
        organization_id: organizationId,
        invoice_id: invoiceId,
      },
    });
    if (!saved) return { ok: false, kind: 'not_found' } as const;
    return { ok: true, creditNote: saved } as const;
  });
}

/** Discards only an Organization-scoped Draft; issued Credit Notes are immutable. */
export async function discardCreditNoteDraft(
  db: SqliteDatabase,
  organizationId: string,
  invoiceId: string,
  creditNoteId: string,
): Promise<boolean> {
  let result = await db.deleteMany(creditNotes, {
    where: {
      id: creditNoteId,
      organization_id: organizationId,
      invoice_id: invoiceId,
      status: 'draft',
    },
    limit: 1,
  });
  return result.affectedRows > 0;
}

function creditNoteLineMatches(
  saved: CreditNoteLine,
  calculated: CreditNoteLineChanges,
): boolean {
  return (
    saved.invoice_line_id === calculated.invoice_line_id &&
    saved.position === calculated.position &&
    saved.description === calculated.description &&
    saved.sac === calculated.sac &&
    saved.quantity === calculated.quantity &&
    saved.unit_price === calculated.unit_price &&
    saved.amount_minor === calculated.amount_minor &&
    saved.discount_mode === calculated.discount_mode &&
    saved.discount_value === calculated.discount_value &&
    saved.line_discount_minor === calculated.line_discount_minor &&
    saved.allocated_invoice_discount_minor === calculated.allocated_invoice_discount_minor &&
    saved.net_minor === calculated.net_minor &&
    saved.tax_treatment === calculated.tax_treatment &&
    saved.gst_rate === calculated.gst_rate &&
    saved.cgst_rate === calculated.cgst_rate &&
    saved.sgst_rate === calculated.sgst_rate &&
    saved.igst_rate === calculated.igst_rate &&
    saved.cgst_amount_minor === calculated.cgst_amount_minor &&
    saved.sgst_amount_minor === calculated.sgst_amount_minor &&
    saved.igst_amount_minor === calculated.igst_amount_minor &&
    saved.foreign_tax_label === calculated.foreign_tax_label &&
    saved.foreign_tax_mode === calculated.foreign_tax_mode &&
    saved.foreign_tax_rate === calculated.foreign_tax_rate &&
    saved.foreign_tax_amount_minor === calculated.foreign_tax_amount_minor
  );
}

/** Issues a Draft atomically with its FY number and exact stored PDF bytes. */
export async function issueCreditNoteDraft(
  db: SqliteDatabase,
  organizationId: string,
  invoiceId: string,
  creditNoteId: string,
  finalizeIssuedCreditNote: IssuedCreditNoteFinalizer,
): Promise<IssueCreditNoteResult> {
  return db.transaction(async (transaction) => {
    let creditNote = await transaction.findOne(creditNotes, {
      where: {
        id: creditNoteId,
        organization_id: organizationId,
        invoice_id: invoiceId,
      },
    });
    if (!creditNote) return { ok: false, kind: 'not_found' } as const;
    if (creditNote.status !== 'draft') return { ok: false, kind: 'conflict' } as const;

    let invoice = await transaction.findOne(invoices, {
      where: { id: invoiceId, organization_id: organizationId, document_type: 'invoice' },
    });
    if (!invoice) return { ok: false, kind: 'not_found' } as const;
    if (invoice.status !== 'issued') return { ok: false, kind: 'not_issued' } as const;

    let [sourceLines, issued, savedLines] = await Promise.all([
      transaction.findMany(invoiceLines, {
        where: { organization_id: organizationId, invoice_id: invoiceId },
        orderBy: [['position', 'asc']],
      }),
      issuedCreditData(transaction, organizationId, invoiceId),
      transaction.findMany(creditNoteLines, {
        where: {
          organization_id: organizationId,
          invoice_id: invoiceId,
          credit_note_id: creditNoteId,
        },
        orderBy: [['position', 'asc']],
      }),
    ]);
    let recalculated = calculateCreditNoteDraft(
      invoice,
      sourceLines,
      issued.notes,
      issued.lines,
      {
        credit_date: creditNote.credit_date,
        reason: creditNote.reason,
        lines: savedLines.map((line) => ({
          invoice_line_id: line.invoice_line_id,
          quantity: line.quantity,
        })),
      },
    );
    if (!recalculated.ok || savedLines.length !== recalculated.value.lines.length) {
      return { ok: false, kind: 'over_limit' } as const;
    }
    let expected = recalculated.value;
    let matches =
      expected.credit_date === creditNote.credit_date &&
      expected.reason === creditNote.reason &&
      expected.subtotal_minor === creditNote.subtotal_minor &&
      expected.line_discount_total_minor === creditNote.line_discount_total_minor &&
      expected.invoice_discount_minor === creditNote.invoice_discount_minor &&
      expected.net_subtotal_minor === creditNote.net_subtotal_minor &&
      expected.tax_total_minor === creditNote.tax_total_minor &&
      expected.round_off_minor === creditNote.round_off_minor &&
      expected.total_minor === creditNote.total_minor &&
      expected.lines.every((line, index) => {
        let saved = savedLines[index];
        return saved != null && creditNoteLineMatches(saved, line);
      });
    if (!matches) return { ok: false, kind: 'conflict' } as const;

    let creditedAlready = issued.notes.reduce(
      (total, note) => total + BigInt(note.total_minor),
      ZERO,
    );
    if (
      BigInt(creditNote.total_minor) > BigInt(invoice.total_minor) - creditedAlready ||
      creditNote.total_minor <= 0
    ) {
      return { ok: false, kind: 'over_limit' } as const;
    }

    let { prefix, startingNumber } = await creditNoteSequenceSettings(
      transaction,
      organizationId,
    );
    let now = Date.now();
    let number = await allocateDocumentNumber(
      transaction,
      organizationId,
      indianFinancialYear(creditNote.credit_date),
      { documentType: 'credit_note', prefix, startingNumber },
      now,
    );
    let update = await transaction.updateMany(
      creditNotes,
      {
        status: 'issued',
        credit_note_number: number,
        issued_at: now,
        updated_at: now,
      },
      {
        where: {
          id: creditNoteId,
          organization_id: organizationId,
          invoice_id: invoiceId,
          status: 'draft',
        },
        limit: 1,
      },
    );
    if (update.affectedRows === 0) return { ok: false, kind: 'conflict' } as const;

    let issuedCreditNote = await transaction.findOne(creditNotes, {
      where: {
        id: creditNoteId,
        organization_id: organizationId,
        invoice_id: invoiceId,
      },
    });
    if (!issuedCreditNote) throw new Error('Issued credit note could not be reloaded.');
    let { internal_note: _internalNote, ...invoiceDocument } = invoice;
    await finalizeIssuedCreditNote({
      transaction,
      invoice: invoiceDocument,
      creditNote: issuedCreditNote,
      lines: savedLines,
    });
    return { ok: true, creditNote: issuedCreditNote } as const;
  });
}

/** All Credit Notes linked to one parent invoice, ordered by creation time. */
export function findInvoiceCreditNotes(
  db: SqliteDatabase,
  organizationId: string,
  invoiceId: string,
): Promise<CreditNote[]> {
  return db.findMany(creditNotes, {
    where: { organization_id: organizationId, invoice_id: invoiceId },
    orderBy: [
      ['created_at', 'asc'],
      ['id', 'asc'],
    ],
  });
}

/** Remaining face value available to new Credit Note Drafts, excluding unissued Drafts. */
export async function remainingCreditableValue(
  db: SqliteDatabase,
  organizationId: string,
  invoiceId: string,
  originalTotalMinor: number,
): Promise<number> {
  let notes = await db.findMany(creditNotes, {
    where: { organization_id: organizationId, invoice_id: invoiceId, status: 'issued' },
  });
  let credited = notes.reduce((total, note) => total + BigInt(note.total_minor), ZERO);
  let remaining = positiveDifference(BigInt(originalTotalMinor), credited);
  return Number(remaining);
}

/** Remaining quantity and credited face value per original line after issued Credit Notes. */
export async function remainingCreditNoteLineCapacity(
  db: SqliteDatabase,
  organizationId: string,
  invoice: Invoice,
  sourceLines: readonly InvoiceLine[],
): Promise<Map<string, CreditNoteLineCapacity>> {
  let issued = await issuedCreditData(db, organizationId, invoice.id);
  return new Map(
    sourceLines.map((source) => {
      let usedLines = issued.lines.filter((line) => line.invoice_line_id === source.id);
      let sourceTax =
        BigInt(source.cgst_amount_minor) +
        BigInt(source.sgst_amount_minor) +
        BigInt(source.igst_amount_minor) +
        BigInt(source.foreign_tax_amount_minor);
      let sourceTotal =
        BigInt(source.net_minor) + (invoice.reverse_charge ? ZERO : sourceTax);
      let creditedTotal = usedLines.reduce((total, line) => {
        let tax =
          BigInt(line.cgst_amount_minor) +
          BigInt(line.sgst_amount_minor) +
          BigInt(line.igst_amount_minor) +
          BigInt(line.foreign_tax_amount_minor);
        return total + BigInt(line.net_minor) + (invoice.reverse_charge ? ZERO : tax);
      }, ZERO);
      let remainingAmount = Number(positiveDifference(sourceTotal, creditedTotal));
      return [
        source.id,
        {
          quantity: formatScaledDecimal(remainingQuantity(source, issued.lines)),
          amountMinor: remainingAmount,
        },
      ];
    }),
  );
}

/** Sums issued credits per invoice for read-time derived balances and statuses. */
export async function activeInvoiceCreditNoteTotals(
  db: SqliteDatabase,
  organizationId: string,
): Promise<Map<string, number>> {
  let notes = await db.findMany(creditNotes, {
    where: { organization_id: organizationId, status: 'issued' },
  });
  let totals = new Map<string, number>();
  for (let note of notes) {
    totals.set(
      note.invoice_id,
      (totals.get(note.invoice_id) ?? 0) + note.total_minor,
    );
  }
  return totals;
}

/** Credit-note numbers (or `Draft`) per invoice, for the Organization-scoped invoice directory. */
export async function invoiceCreditNoteLabels(
  db: SqliteDatabase,
  organizationId: string,
): Promise<Map<string, string[]>> {
  let notes = await db.findMany(creditNotes, {
    where: { organization_id: organizationId },
    orderBy: [
      ['created_at', 'asc'],
      ['id', 'asc'],
    ],
  });
  let labels = new Map<string, string[]>();
  for (let note of notes) {
    let invoiceLabels = labels.get(note.invoice_id) ?? [];
    invoiceLabels.push(note.status === 'issued' ? (note.credit_note_number ?? 'Issued') : 'Draft');
    labels.set(note.invoice_id, invoiceLabels);
  }
  return labels;
}

/** Reads stored issued Credit Note PDF bytes without regenerating an artifact. */
export async function findIssuedCreditNotePdfBytes(
  db: SqliteDatabase,
  organizationId: string,
  invoiceId: string,
  creditNoteId: string,
): Promise<Uint8Array | null> {
  let result = await db.exec(sql`
    SELECT artifact.data
    FROM credit_note_pdf_artifacts AS artifact
    JOIN credit_notes AS note
      ON note.organization_id = artifact.organization_id
      AND note.id = artifact.credit_note_id
      AND note.invoice_id = artifact.invoice_id
    WHERE artifact.organization_id = ${organizationId}
      AND artifact.invoice_id = ${invoiceId}
      AND note.invoice_id = ${invoiceId}
      AND note.id = ${creditNoteId}
      AND note.status = 'issued'
  `);
  let bytes = result.rows?.[0]?.data;
  return bytes instanceof Uint8Array ? bytes : null;
}

/** Resolves the Organization's credit-note prefix and numbering floor, including first-use defaults. */
export async function creditNoteSequenceSettings(
  transaction: Database,
  organizationId: string,
): Promise<{ prefix: string; startingNumber: number }> {
  let profile = await transaction.find(organizationInvoicingProfiles, organizationId);
  return {
    prefix: profile?.credit_note_prefix ?? DEFAULT_CREDIT_NOTE_PREFIX,
    startingNumber: profile?.credit_note_starting_number ?? DEFAULT_STARTING_NUMBER,
  };
}
