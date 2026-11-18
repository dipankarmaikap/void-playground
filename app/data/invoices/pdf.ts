/**
 * Deterministic, self-contained English invoice PDF rendering (PDF 1.4, Helvetica core fonts,
 * uncompressed text streams). Content streams stay uncompressed so stored issued artifacts remain
 * byte-stable and inspectable, and tests can assert on plain text. The private `internal_note` is
 * excluded structurally: the render input omits it from the invoice row.
 */

import { inflateSync } from 'node:zlib';

import type { CreditNote, CreditNoteLine, InvoiceLine } from '../db.ts';
import type { InvoicePdfDocument } from './documents.ts';
import { joinAddressParts } from '../address.ts';
import { countryName } from '../client-billing.ts';
import { clientTaxTypeLabel } from '../client-tax.ts';
import { formatMoney, formatMoneySigned } from './calculation.ts';
import { groupedInvoiceTaxes, invoiceLineGstComponents } from './tax.ts';
import { totalAmountInWords } from './amount-words.ts';
import { PAYMENT_TERM_LABELS } from '../organization/invoicing.ts';
import type { InvoicingProfileView } from '../organization/invoicing.ts';

/** The seller particulars a PDF needs, taken from the issue snapshot or the current profile. */
export interface InvoicePdfSeller {
  legalName: string;
  addressLine1: string | null;
  addressLocality: string | null;
  addressRegion: string | null;
  addressPostalCode: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  pan: string | null;
  gstRegistered: boolean;
  gstin: string | null;
  gstStateCode: string | null;
  gstStateName: string | null;
  logoDataUrl: string | null;
  signatureDataUrl: string | null;
  signatoryName: string | null;
  signatoryDesignation: string | null;
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const RIGHT = PAGE_WIDTH - MARGIN;
const TOP = PAGE_HEIGHT - MARGIN;
const BOTTOM_LIMIT = MARGIN + 24;

/** Approximate Helvetica advance widths (units/1000 em) for the characters invoices use. */
const HELVETICA_WIDTHS: Record<string, number> = {
  ' ': 278, '!': 278, "'": 191, '(': 333, ')': 333, '+': 584, ',': 278, '-': 333, '.': 278,
  '/': 278, ':': 278, ';': 278, '?': 556, '@': 1015, '%': 889, '&': 667, '*': 389, '#': 556,
  '0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556, '8': 556,
  '9': 556,
  A: 722, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500, K: 667,
  L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722, V: 667,
  W: 944, X: 667, Y: 667, Z: 611,
  a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222, k: 500,
  l: 222, m: 833, n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278, u: 556, v: 500,
  w: 722, x: 500, y: 500, z: 500,
};

/** WinAnsi byte encodings for the common typographic characters outside Latin-1. */
const WINANSI_BYTES: Record<string, number> = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88,
  '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94,
  '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c,
  'ž': 0x9e, 'Ÿ': 0x9f,
};

function encodeLatin1(value: string): Uint8Array {
  return Uint8Array.from(Buffer.from(value, 'latin1'));
}

/** Maps one character to its WinAnsi-representable text, or a fallback. */
function toWinAnsiText(value: string): string {
  let out = '';
  for (const char of value) {
    let code = char.codePointAt(0) ?? 0;
    if (char === '\\') {
      out += '\\\\';
    } else if (char === '(' || char === ')') {
      out += `\\${char}`;
    } else if (char === '₹') {
      out += 'Rs.';
    } else if (WINANSI_BYTES[char] != null) {
      // Re-encode as the Latin-1 character whose byte the PDF font will interpret via WinAnsi.
      out += String.fromCharCode(WINANSI_BYTES[char]!);
    } else if (code < 0x7f || (code >= 0xa0 && code <= 0xff)) {
      out += char;
    } else {
      out += '?';
    }
  }
  return out;
}

function charWidth(char: string, size: number, bold: boolean): number {
  let width = HELVETICA_WIDTHS[char] ?? 556;
  return (width / 1000) * size * (bold ? 1.08 : 1);
}

function textWidth(value: string, size: number, bold = false): number {
  let total = 0;
  for (const char of value) total += charWidth(char, size, bold);
  return total;
}

function wrapText(value: string, size: number, maxWidth: number, bold = false): string[] {
  let lines: string[] = [];
  for (let paragraph of value.split('\n')) {
    let current = '';
    for (let word of paragraph.split(/\s+/).filter(Boolean)) {
      let candidate = current ? `${current} ${word}` : word;
      if (current && textWidth(candidate, size, bold) > maxWidth) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
      while (current.length > 1 && textWidth(current, size, bold) > maxWidth) {
        let cut = current.length - 1;
        while (cut > 1 && textWidth(current.slice(0, cut), size, bold) > maxWidth) cut -= 1;
        lines.push(current.slice(0, cut));
        current = current.slice(cut);
      }
    }
    lines.push(current);
  }
  return lines.length > 0 ? lines : [''];
}

interface DecodedImage {
  width: number;
  height: number;
  components: 1 | 3;
  /** Decoded RGB pixels for PNG images, or the original JPEG bytes for DCTDecode passthrough. */
  data: Uint8Array;
  jpeg: boolean;
}

function dataUrlBytes(dataUrl: string): { mime: string; bytes: Uint8Array } | null {
  let match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim());
  if (!match) return null;
  try {
    return { mime: match[1]!, bytes: Uint8Array.from(Buffer.from(match[2]!, 'base64')) };
  } catch {
    return null;
  }
}

function composite(channel: number, alpha: number): number {
  return Math.round((channel * alpha + 255 * (255 - alpha)) / 255);
}

function unfilterPng(raw: Uint8Array, width: number, height: number, channels: number): Uint8Array {
  let stride = width * channels;
  let out = new Uint8Array(height * stride);
  let position = 0;
  for (let row = 0; row < height; row += 1) {
    let filter = raw[position]!;
    let lineStart = row * stride;
    position += 1;
    for (let column = 0; column < stride; column += 1) {
      let value = raw[position]!;
      position += 1;
      let left = column >= channels ? out[lineStart + column - channels]! : 0;
      let up = row > 0 ? out[lineStart - stride + column]! : 0;
      let upperLeft =
        row > 0 && column >= channels ? out[lineStart - stride + column - channels]! : 0;
      if (filter === 1) {
        value = (value + left) & 0xff;
      } else if (filter === 2) {
        value = (value + up) & 0xff;
      } else if (filter === 3) {
        value = (value + ((left + up) >> 1)) & 0xff;
      } else if (filter === 4) {
        let prediction = left + up - upperLeft;
        let distanceLeft = Math.abs(prediction - left);
        let distanceUp = Math.abs(prediction - up);
        let distanceUpperLeft = Math.abs(prediction - upperLeft);
        let predictor =
          distanceLeft <= distanceUp && distanceLeft <= distanceUpperLeft
            ? left
            : distanceUp <= distanceUpperLeft
              ? up
              : upperLeft;
        value = (value + predictor) & 0xff;
      }
      out[lineStart + column] = value;
    }
  }
  return out;
}

/** Decodes an 8-bit, non-interlaced PNG into white-composited RGB pixels. */
function decodePng(bytes: Uint8Array): DecodedImage | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 8 || signature.some((byte, index) => bytes[index] !== byte)) return null;

  let view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = -1;
  let compressed: number[] = [];
  while (offset + 8 <= bytes.length) {
    let length = view.getUint32(offset);
    let type = String.fromCharCode(
      bytes[offset + 4]!, bytes[offset + 5]!, bytes[offset + 6]!, bytes[offset + 7]!,
    );
    let dataStart = offset + 8;
    let dataEnd = dataStart + length;
    if (dataEnd + 4 > bytes.length) return null;
    if (type === 'IHDR') {
      width = view.getUint32(dataStart);
      height = view.getUint32(dataStart + 4);
      let bitDepth = bytes[dataStart + 8]!;
      colorType = bytes[dataStart + 9]!;
      let interlace = bytes[dataStart + 12]!;
      if (bitDepth !== 8 || interlace !== 0 || ![0, 2, 4, 6].includes(colorType)) return null;
    } else if (type === 'IDAT') {
      for (let index = dataStart; index < dataEnd; index += 1) compressed.push(bytes[index]!);
    } else if (type === 'IEND') {
      break;
    }
    offset = dataEnd + 4;
  }
  if (width === 0 || height === 0 || colorType < 0 || compressed.length === 0) return null;

  let raw: Uint8Array;
  try {
    raw = inflateSync(Uint8Array.from(compressed));
  } catch {
    return null;
  }

  let channels = colorType === 2 ? 3 : colorType === 6 ? 4 : colorType === 4 ? 2 : 1;
  let stride = width * channels;
  if (raw.length < height * (stride + 1)) return null;

  let unfiltered = unfilterPng(raw, width, height, channels);
  let out = new Uint8Array(width * height * 3);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    let source = pixel * channels;
    let target = pixel * 3;
    if (colorType === 2) {
      out[target] = unfiltered[source]!;
      out[target + 1] = unfiltered[source + 1]!;
      out[target + 2] = unfiltered[source + 2]!;
    } else {
      let gray = unfiltered[source]!;
      let alpha = channels >= 2 ? unfiltered[source + 1]! : 255;
      out[target] = composite(gray, alpha);
      out[target + 1] = composite(gray, alpha);
      out[target + 2] = composite(gray, alpha);
    }
  }
  return { width, height, components: 3, data: out, jpeg: false };
}

/** Reads JPEG dimensions and component count for direct DCTDecode embedding. */
function decodeJpeg(bytes: Uint8Array): DecodedImage | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    let marker = bytes[offset + 1]!;
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2;
      continue;
    }
    let length = (bytes[offset + 2]! << 8) | bytes[offset + 3]!;
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      if (offset + 9 > bytes.length) return null;
      let decodedHeight = (bytes[offset + 5]! << 8) | bytes[offset + 6]!;
      let decodedWidth = (bytes[offset + 7]! << 8) | bytes[offset + 8]!;
      let components = bytes[offset + 9]!;
      if (decodedWidth === 0 || decodedHeight === 0 || (components !== 1 && components !== 3)) {
        return null;
      }
      return {
        width: decodedWidth,
        height: decodedHeight,
        components: components === 1 ? 1 : 3,
        data: bytes,
        jpeg: true,
      };
    }
    offset += 2 + length;
  }
  return null;
}

function decodeImage(dataUrl: string): DecodedImage | null {
  let parts = dataUrlBytes(dataUrl);
  if (!parts) return null;
  if (parts.mime === 'image/png') return decodePng(parts.bytes);
  if (parts.mime === 'image/jpeg') return decodeJpeg(parts.bytes);
  return null;
}

function concatBytes(chunks: readonly Uint8Array[]): Uint8Array {
  let total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  let out = new Uint8Array(total);
  let offset = 0;
  for (let chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/** Serializes one assembled PDF document with an exact xref table. */
class PdfFile {
  private bodies: Array<Uint8Array | null> = [];

  reserve(): number {
    this.bodies.push(null);
    return this.bodies.length;
  }

  setObject(objectNumber: number, body: string): void {
    this.bodies[objectNumber - 1] = encodeLatin1(body);
  }

  setStreamObject(objectNumber: number, dictEntries: string, stream: string | Uint8Array): void {
    let bytes = typeof stream === 'string' ? encodeLatin1(stream) : stream;
    let head = encodeLatin1(`<< ${dictEntries} /Length ${bytes.byteLength} >>\nstream\n`);
    this.bodies[objectNumber - 1] =
      concatBytes([head, bytes, encodeLatin1('\nendstream')]);
  }

  serialize(): Uint8Array {
    if (this.bodies.some((body) => body == null)) {
      throw new Error('PDF object bodies were not fully populated.');
    }
    let bodies = this.bodies as Uint8Array[];
    let chunks: Uint8Array[] = [];
    let offsets: number[] = [];
    let offset = 0;
    let append = (bytes: Uint8Array) => {
      chunks.push(bytes);
      offset += bytes.byteLength;
    };
    append(encodeLatin1('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'));
    for (let index = 0; index < bodies.length; index += 1) {
      offsets.push(offset);
      append(encodeLatin1(`${index + 1} 0 obj\n`));
      append(bodies[index]!);
      append(encodeLatin1('\nendobj\n'));
    }
    let xrefOffset = offset;
    let xref = ['xref', `0 ${bodies.length + 1}`, '0000000000 65535 f '];
    for (let objectOffset of offsets) {
      xref.push(`${objectOffset.toString().padStart(10, '0')} 00000 n `);
    }
    append(encodeLatin1(`${xref.join('\n')}\n`));
    append(encodeLatin1(
      `trailer\n<< /Size ${bodies.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
    ));
    return concatBytes(chunks);
  }
}

interface ImagePlacement {
  name: string;
  objectNumber: number;
  width: number;
  height: number;
}

/** Registers validated PNG/JPEG data URLs as image XObjects; undrawable images are skipped. */
class PdfImageRegistry {
  private placements = new Map<string, ImagePlacement>();
  private nextName = 1;
  private registered: ImagePlacement[] = [];

  constructor(private file: PdfFile) {}

  decode(dataUrl: string): ImagePlacement | null {
    let placement = this.placements.get(dataUrl);
    if (placement) return placement;
    let decoded = decodeImage(dataUrl);
    if (!decoded) return null;
    let objectNumber: number;
    if (decoded.jpeg) {
      objectNumber = this.reserveImage();
      this.file.setStreamObject(
        objectNumber,
        `/Type /XObject /Subtype /Image /Width ${decoded.width} /Height ${decoded.height} ` +
          `/ColorSpace ${decoded.components === 1 ? '/DeviceGray' : '/DeviceRGB'} ` +
          '/BitsPerComponent 8 /Filter /DCTDecode',
        decoded.data,
      );
    } else {
      objectNumber = this.reserveImage();
      this.file.setStreamObject(
        objectNumber,
        `/Type /XObject /Subtype /Image /Width ${decoded.width} /Height ${decoded.height} ` +
          '/ColorSpace /DeviceRGB /BitsPerComponent 8',
        decoded.data,
      );
    }
    placement = {
      name: `Im${this.nextName}`,
      objectNumber,
      width: decoded.width,
      height: decoded.height,
    };
    this.nextName += 1;
    this.placements.set(dataUrl, placement);
    this.registered.push(placement);
    return placement;
  }

  private reserveImage(): number {
    return this.file.reserve();
  }

  /** Draws the image fit inside `maxWidth × maxHeight` at the current cursor's baseline box. */
  drawOps(placement: ImagePlacement, x: number, y: number, maxWidth: number, maxHeight: number): string {
    let scale = Math.min(maxWidth / placement.width, maxHeight / placement.height);
    let width = placement.width * scale;
    let height = placement.height * scale;
    return `q ${(width).toFixed(2)} 0 0 ${(height).toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /${placement.name} Do Q`;
  }

  resourceEntries(): string {
    if (this.registered.length === 0) return '';
    return (
      '/XObject << ' +
      this.registered.map((image) => `/${image.name} ${image.objectNumber} 0 R`).join(' ') +
      ' >> '
    );
  }
}

interface CanvasOptions {
  file: PdfFile;
  images: PdfImageRegistry;
  watermark: boolean;
}

/** A simple flow-layout content writer with automatic page breaks. */
class PdfCanvas {
  private ops: string[] = [];
  private completedPageContents: string[] = [];
  y = TOP;

  constructor(private options: CanvasOptions) {
    if (options.watermark) this.drawWatermark();
  }

  text(
    value: string,
    options: {
      x?: number;
      size?: number;
      bold?: boolean;
      gray?: number;
      alignRight?: number;
    },
  ): void {
    let size = options.size ?? 9;
    let bold = options.bold ?? false;
    let x = options.alignRight != null ? options.alignRight - textWidth(value, size, bold) : options.x ?? MARGIN;
    this.ops.push(
      `BT /${bold ? 'F2' : 'F1'} ${size} Tf ${(options.gray ?? 0).toFixed(3)} g ` +
        `1 0 0 1 ${x.toFixed(2)} ${this.y.toFixed(2)} Tm (${toWinAnsiText(value)}) Tj ET`,
    );
  }

  wrapped(
    value: string,
    options: {
      x: number;
      size?: number;
      bold?: boolean;
      gray?: number;
      width: number;
      lineHeight?: number;
    },
  ): void {
    let size = options.size ?? 9;
    let lineHeight = options.lineHeight ?? size * 1.3;
    for (let line of wrapText(value, size, options.width, options.bold)) {
      this.text(line, { x: options.x, size, bold: options.bold, gray: options.gray });
      this.y -= lineHeight;
    }
  }

  wrappedRightAligned(
    value: string,
    options: { alignRight: number; size?: number; gray?: number; width: number; lineHeight?: number },
  ): void {
    let size = options.size ?? 9;
    let lineHeight = options.lineHeight ?? size * 1.3;
    for (let line of wrapText(value, size, options.width)) {
      this.text(line, { alignRight: options.alignRight, size, gray: options.gray });
      this.y -= lineHeight;
    }
  }

  rule(fromX: number, toX: number): void {
    this.ops.push(
      `0.5 w ${fromX.toFixed(2)} ${(this.y + 3).toFixed(2)} m ${toX.toFixed(2)} ${(this.y + 3).toFixed(2)} l S`,
    );
  }

  /** Draws an image fit inside `maxWidth × maxHeight` with its bottom edge at `yBottom`. */
  drawImage(
    placement: ImagePlacement,
    x: number,
    yBottom: number,
    maxWidth: number,
    maxHeight: number,
  ): number {
    let scale = Math.min(maxWidth / placement.width, maxHeight / placement.height);
    let width = placement.width * scale;
    let height = placement.height * scale;
    this.ops.push(
      `q ${width.toFixed(2)} 0 0 ${height.toFixed(2)} ${x.toFixed(2)} ${yBottom.toFixed(2)} cm /${placement.name} Do Q`,
    );
    return height;
  }

  ensure(height: number): void {
    if (this.y - height < BOTTOM_LIMIT) this.newPage();
  }

  newPage(): void {
    this.completedPageContents.push(this.ops.join('\n'));
    this.ops = [];
    this.y = TOP;
    if (this.options.watermark) this.drawWatermark();
  }

  finish(): string[] {
    let hasContent = this.ops.length > 0;
    if (hasContent || this.completedPageContents.length === 0) {
      this.completedPageContents.push(this.ops.join('\n'));
      this.ops = [];
    }
    return this.completedPageContents;
  }

  private drawWatermark(): void {
    this.ops.push(
      'q 0.88 g 1 w ' +
        `BT /F2 92 Tf 0.7071 0.7071 -0.7071 0.7071 170 ${(PAGE_HEIGHT / 2 - 30).toFixed(2)} Tm ` +
        '(DRAFT) Tj ET Q',
    );
  }
}

interface LayoutContext {
  canvas: PdfCanvas;
  invoice: InvoicePdfDocument;
  seller: InvoicePdfSeller;
  lines: readonly InvoiceLine[];
  images: PdfImageRegistry;
  creditNoteDetails?: CreditNotePdfDetails;
}

interface CreditNotePdfDetails {
  creditNote: CreditNote;
  originalInvoiceNumber: string;
  originalInvoiceDate: string;
}

function sellerAddressLines(seller: InvoicePdfSeller): string[] {
  let lines: string[] = [];
  let address = joinAddressParts([
    seller.addressLine1,
    seller.addressLocality,
    seller.addressRegion,
    seller.addressPostalCode,
  ]);
  if (address) lines.push(address);
  let country = countryName(seller.country);
  if (country) lines.push(country);
  let contact = [seller.email, seller.phone]
    .filter((part): part is string => Boolean(part))
    .join(' · ');
  if (contact) lines.push(contact);
  return lines;
}

function placeOfSupplyText(invoice: InvoicePdfDocument): string {
  if (invoice.gst_mode !== 'india_gst') return '';
  if (invoice.supply_type === 'domestic') {
    return invoice.place_of_supply_state_name ?? invoice.place_of_supply_state_code ?? '';
  }
  return countryName(invoice.place_of_supply_country) || '';
}

function drawPageHeader(context: LayoutContext): void {
  let { canvas, invoice, seller, images, creditNoteDetails } = context;
  let metaRows: Array<[string, string]> = [];
  if (creditNoteDetails) {
    metaRows.push([
      'Credit note no:',
      invoice.status === 'draft' ? 'DRAFT' : invoice.invoice_number ?? '',
    ]);
    metaRows.push(['Credit note date:', invoice.invoice_date]);
    metaRows.push(['Currency:', invoice.currency]);
  } else {
    metaRows.push([
      'Invoice no:',
      invoice.status === 'draft' ? 'DRAFT' : invoice.invoice_number ?? '',
    ]);
    metaRows.push(['Invoice date:', invoice.invoice_date]);
    metaRows.push(['Due date:', invoice.due_date]);
    metaRows.push(['Currency:', invoice.currency]);
  }

  let metaX = 350;
  let metaValueX = RIGHT;

  if (seller.logoDataUrl) {
    let placement = images.decode(seller.logoDataUrl);
    if (placement) {
      let height = canvas.drawImage(placement, MARGIN, canvas.y - 52, 110, 52);
      canvas.y -= height + 8;
    }
  }
  canvas.ensure(72);
  canvas.text(seller.legalName, { x: MARGIN, size: 12, bold: true });
  canvas.y -= 14;
  for (let line of sellerAddressLines(seller).slice(0, 4)) {
    canvas.text(line, { x: MARGIN, size: 8.5, gray: 0.25 });
    canvas.y -= 11;
  }
  if (seller.pan) {
    canvas.text(`PAN: ${seller.pan}`, { x: MARGIN, size: 8.5, gray: 0.25 });
    canvas.y -= 11;
  }
  if (seller.gstRegistered && seller.gstin) {
    canvas.text(
      `GSTIN: ${seller.gstin} · GST State/UT: ${seller.gstStateName ?? seller.gstStateCode ?? ''}`,
      { x: MARGIN, size: 8.5, gray: 0.25 },
    );
    canvas.y -= 11;
  }

  canvas.text(creditNoteDetails ? 'CREDIT NOTE' : 'TAX INVOICE', {
    alignRight: metaValueX,
    size: 13,
    bold: true,
  });
  let metaY = canvas.y - 22;
  canvas.y = metaY;
  for (let [label, value] of metaRows) {
    canvas.text(`${label} ${value}`, { x: metaX, size: 9, bold: true });
    canvas.y -= 13;
  }
  let placeOfSupply = placeOfSupplyText(invoice);
  if (placeOfSupply) {
    canvas.text(`Place of Supply: ${placeOfSupply}`, { x: metaX, size: 9, bold: true });
    canvas.y -= 13;
  }
  canvas.y -= 8;
  canvas.rule(MARGIN, RIGHT);
  canvas.y -= 16;
}

function drawRecipientBlock(context: LayoutContext): void {
  let { canvas, invoice } = context;
  canvas.ensure(96);
  canvas.text('Bill To', { x: MARGIN, size: 9, bold: true, gray: 0.35 });
  canvas.y -= 13;
  canvas.text(invoice.recipient_legal_name, { x: MARGIN, size: 10.5, bold: true });
  canvas.y -= 13;
  let address = joinAddressParts([
    invoice.recipient_billing_line1,
    invoice.recipient_billing_locality,
    invoice.recipient_billing_region,
    invoice.recipient_billing_postal_code,
  ]);
  if (address) {
    canvas.wrapped(address, { x: MARGIN, size: 9, width: 240, lineHeight: 11.5 });
  }
  let country = countryName(invoice.recipient_billing_country);
  if (country) {
    canvas.text(country, { x: MARGIN, size: 9 });
    canvas.y -= 11.5;
  }
  if (invoice.recipient_tax_value) {
    canvas.text(
      `${clientTaxTypeLabel(invoice.recipient_tax_type)} ${invoice.recipient_tax_value}`,
      { x: MARGIN, size: 9 },
    );
    canvas.y -= 11.5;
  }
  if (invoice.recipient_tax_state_name) {
    canvas.text(`GST State/UT: ${invoice.recipient_tax_state_name}`, { x: MARGIN, size: 9 });
    canvas.y -= 11.5;
  }
  canvas.y -= 6;
}

function drawCreditNoteDetails(context: LayoutContext): void {
  let details = context.creditNoteDetails;
  if (!details) return;

  let { canvas } = context;
  canvas.ensure(72);
  canvas.text(`Original invoice no: ${details.originalInvoiceNumber}`, {
    x: MARGIN,
    size: 9,
    bold: true,
  });
  canvas.y -= 13;
  canvas.text(`Original invoice date: ${details.originalInvoiceDate}`, {
    x: MARGIN,
    size: 9,
    bold: true,
  });
  canvas.y -= 13;
  canvas.text('Reason:', { x: MARGIN, size: 9, bold: true });
  canvas.y -= 12;
  canvas.wrapped(details.creditNote.reason, {
    x: MARGIN,
    size: 9,
    width: 500,
    lineHeight: 12,
  });
  canvas.y -= 7;
}

const LINE_COLUMNS = {
  descriptionX: MARGIN,
  descriptionWidth: 185,
  qtyRight: 262,
  unitPriceRight: 330,
  amountRight: 388,
  discountRight: 442,
  netRight: 492,
  taxX: 502,
  taxWidth: 53,
} as const;

function lineTaxText(line: InvoiceLine, currency: string): string {
  let parts = [
    ...invoiceLineGstComponents(line, currency),
    line.foreign_tax_mode && line.foreign_tax_label
      ? `${line.foreign_tax_label}${line.foreign_tax_mode === 'percent' ? ` @ ${line.foreign_tax_rate}%` : ''} ${formatMoney(BigInt(line.foreign_tax_amount_minor), currency)}`
      : null,
  ].filter((part): part is string => Boolean(part));
  if (parts.length === 0 && line.tax_treatment) {
    parts.push(`${line.tax_treatment.replace('_', '-')}: 0%`);
  }
  return parts.join(' · ') || '—';
}

function drawLinesTable(context: LayoutContext): void {
  let { canvas, invoice, lines } = context;
  let currency = invoice.currency;
  let money = (minor: number) => formatMoney(BigInt(minor), currency).replace(` ${currency}`, '');
  let columns = LINE_COLUMNS;

  canvas.ensure(40);
  canvas.text('Description', { x: columns.descriptionX, size: 8.5, bold: true, gray: 0.2 });
  canvas.text('Qty', { alignRight: columns.qtyRight, size: 8.5, bold: true, gray: 0.2 });
  canvas.text('Unit price', { alignRight: columns.unitPriceRight, size: 8.5, bold: true, gray: 0.2 });
  canvas.text('Amount', { alignRight: columns.amountRight, size: 8.5, bold: true, gray: 0.2 });
  canvas.text('Discount', { alignRight: columns.discountRight, size: 8.5, bold: true, gray: 0.2 });
  canvas.text('Net', { alignRight: columns.netRight, size: 8.5, bold: true, gray: 0.2 });
  canvas.text('Tax', { x: columns.taxX, size: 8.5, bold: true, gray: 0.2 });
  canvas.y -= 6;
  canvas.rule(MARGIN, RIGHT);
  canvas.y -= 10;

  for (let line of lines) {
    let descriptionLines = wrapText(line.description, 8.5, columns.descriptionWidth);
    let subLines = line.sac ? [`SAC ${line.sac}`] : [];
    let taxLines = wrapText(lineTaxText(line, currency), 7.5, columns.taxWidth);
    let rowLines = Math.max(descriptionLines.length + subLines.length, taxLines.length, 1);
    let rowHeight = rowLines * 10.5 + 6;
    canvas.ensure(rowHeight);

    let rowTop = canvas.y;
    let descriptionBottom = canvas.y;
    for (let text of descriptionLines) {
      canvas.text(text, { x: columns.descriptionX, size: 8.5 });
      descriptionBottom -= 10.5;
    }
    for (let text of subLines) {
      canvas.text(text, { x: columns.descriptionX + 10, size: 7.5, gray: 0.4 });
      descriptionBottom -= 10.5;
    }
    let taxBottom = rowTop;
    for (let text of taxLines) {
      canvas.text(text, { x: columns.taxX, size: 7.5 });
      taxBottom -= 10.5;
    }
    canvas.text(line.quantity, { alignRight: columns.qtyRight, size: 8.5 });
    canvas.text(line.unit_price, { alignRight: columns.unitPriceRight, size: 8.5 });
    canvas.text(money(line.amount_minor), { alignRight: columns.amountRight, size: 8.5 });
    if (line.line_discount_minor > 0) {
      let prefix = line.discount_mode === 'percent' ? `${line.discount_value}% · ` : '';
      for (let text of wrapText(`${prefix}${money(line.line_discount_minor)}`, 7.5, 52)) {
        canvas.text(text, { alignRight: columns.discountRight, size: 7.5 });
      }
    } else {
      canvas.text('—', { alignRight: columns.discountRight, size: 8.5, gray: 0.55 });
    }
    canvas.text(money(line.net_minor), { alignRight: columns.netRight, size: 8.5 });
    canvas.y = Math.min(descriptionBottom, taxBottom) - 4;
  }
  canvas.y -= 6;
}

function drawTotals(context: LayoutContext): void {
  let { canvas, invoice, lines, creditNoteDetails } = context;
  let currency = invoice.currency;
  let money = (minor: number | bigint) => formatMoney(BigInt(minor), currency);

  let rows: Array<[string, string]> = [
    ['Subtotal', money(invoice.subtotal_minor)],
    ['Line discounts', money(invoice.line_discount_total_minor)],
  ];
  if (invoice.invoice_discount_mode) {
    rows.push([
      `Invoice discount (${invoice.invoice_discount_mode})`,
      `-${money(invoice.invoice_discount_minor)}`,
    ]);
  }
  rows.push(['Net taxable subtotal', money(invoice.net_subtotal_minor)]);

  let grouped = groupedInvoiceTaxes(lines, currency);
  for (let tax of grouped) {
    rows.push([
      `${tax.label}${invoice.reverse_charge ? ' (payable by recipient)' : ''}`,
      tax.formattedAmount,
    ]);
  }
  if (creditNoteDetails) {
    rows.push(['Total tax', money(invoice.tax_total_minor)]);
  } else if (
    grouped.length === 0 &&
    (invoice.gst_mode === 'india_gst' || invoice.gst_mode === 'foreign_manual')
  ) {
    rows.push(['Total tax', money(invoice.tax_total_minor)]);
  }
  rows.push(['Round-off', formatMoneySigned(BigInt(invoice.round_off_minor), currency)]);

  canvas.ensure(rows.length * 14 + 60);
  for (let [label, value] of rows) {
    canvas.text(label, { x: 350, size: 9 });
    canvas.text(value, { alignRight: RIGHT - 15, size: 9 });
    canvas.y -= 14;
  }
  canvas.text('Total', { x: 350, size: 11, bold: true });
  canvas.text(money(invoice.total_minor), { alignRight: RIGHT - 15, size: 11, bold: true });
  canvas.y -= 18;

  let words = totalAmountInWords(BigInt(invoice.total_minor), currency);
  canvas.ensure(30);
  canvas.text('Total in words:', { x: 350, size: 8.5, gray: 0.3 });
  canvas.y -= 10.5;
  canvas.wrapped(words, { x: 350, size: 8.5, width: 205, lineHeight: 10.5 });
  canvas.y -= 10;
}

function drawNotesAndDeclarations(context: LayoutContext): void {
  let { canvas, invoice } = context;
  if (context.creditNoteDetails) return;
  let termLabel =
    PAYMENT_TERM_LABELS[invoice.payment_term as keyof typeof PAYMENT_TERM_LABELS] ??
    invoice.payment_term;

  let sections: Array<[string, string]> = [];
  sections.push([
    'Payment terms',
    invoice.custom_payment_terms ? `${termLabel} — ${invoice.custom_payment_terms}` : termLabel,
  ]);
  if (invoice.payment_instructions) {
    sections.push(['Payment instructions', invoice.payment_instructions]);
  }
  if (invoice.customer_notes) {
    sections.push(['Notes', invoice.customer_notes]);
  }
  if (invoice.supply_type === 'export_lut') {
    sections.push(['Export declaration', 'Export under LUT/Bond without payment of IGST.']);
  } else if (invoice.supply_type === 'export_igst') {
    sections.push(['Export declaration', 'Export with IGST.']);
  }
  if (invoice.export_reference) {
    sections.push(['Export reference', invoice.export_reference]);
  }
  if (invoice.reverse_charge) {
    sections.push([
      'Reverse charge declaration',
      'GST shown on this invoice is payable by the recipient under reverse charge and is excluded from the amount collected by the supplier.',
    ]);
  }

  for (let [heading, body] of sections) {
    canvas.ensure(32);
    canvas.text(heading, { x: MARGIN, size: 9, bold: true, gray: 0.3 });
    canvas.y -= 11.5;
    canvas.wrapped(body, { x: MARGIN, size: 8.5, width: 480, lineHeight: 11 });
    canvas.y -= 4;
  }
}

function drawSignatureBlock(context: LayoutContext): void {
  let { canvas, seller, images } = context;
  canvas.y -= 16;
  let placement = seller.signatureDataUrl ? images.decode(seller.signatureDataUrl) : null;
  canvas.ensure(placement ? 84 : 48);
  canvas.text(`For ${seller.legalName}`, { x: 380, size: 9 });
  canvas.y -= 12;
  if (placement) {
    let height = canvas.drawImage(placement, 440, canvas.y - 44, 110, 44);
    canvas.y -= height + 8;
  } else {
    canvas.y -= 22;
  }
  canvas.rule(440, RIGHT);
  canvas.y -= 12;
  if (seller.signatoryName) {
    canvas.text(`Authorized signatory: ${seller.signatoryName}`, { x: 380, size: 8.5, bold: true });
    canvas.y -= 11;
  }
  if (seller.signatoryDesignation) {
    canvas.text(seller.signatoryDesignation, { x: 380, size: 8.5, gray: 0.3 });
    canvas.y -= 11;
  }
}

/** Builds the seller snapshot for an issued invoice from its stored issue-time columns. */
export function sellerFromInvoiceSnapshot(invoice: InvoicePdfDocument): InvoicePdfSeller {
  return {
    legalName: invoice.seller_legal_name ?? '',
    addressLine1: invoice.seller_address_line1,
    addressLocality: invoice.seller_address_locality,
    addressRegion: invoice.seller_address_region,
    addressPostalCode: invoice.seller_address_postal_code,
    country: invoice.seller_country,
    email: invoice.seller_email,
    phone: invoice.seller_phone,
    pan: invoice.seller_pan,
    gstRegistered: invoice.seller_gst_registered,
    gstin: invoice.seller_gstin,
    gstStateCode: invoice.seller_gst_state_code,
    gstStateName: invoice.seller_gst_state_name,
    logoDataUrl: invoice.seller_logo_data_url,
    signatureDataUrl: invoice.seller_signature_data_url,
    signatoryName: invoice.seller_signatory_name,
    signatoryDesignation: invoice.seller_signatory_designation,
  };
}

/** Builds the seller details for a Draft preview from the Organization's current profile. */
export function sellerFromInvoicingProfile(profile: InvoicingProfileView): InvoicePdfSeller {
  return {
    legalName: profile.legalName,
    addressLine1: profile.address_line1,
    addressLocality: profile.address_locality,
    addressRegion: profile.address_region,
    addressPostalCode: profile.address_postal_code,
    country: profile.address_country,
    email: profile.billing_email,
    phone: profile.billing_phone,
    pan: profile.pan,
    gstRegistered: profile.gst_registered,
    gstin: profile.gstin,
    gstStateCode: profile.gst_state_code,
    gstStateName: profile.gst_state_name,
    logoDataUrl: profile.logo_data_url,
    signatureDataUrl: profile.signature_data_url,
    signatoryName: profile.signatory_name,
    signatoryDesignation: profile.signatory_designation,
  };
}

interface RenderPdfInput {
  invoice: InvoicePdfDocument;
  lines: readonly InvoiceLine[];
  seller: InvoicePdfSeller;
  watermark: boolean;
  creditNoteDetails?: CreditNotePdfDetails;
}

function renderPdf(input: RenderPdfInput): Uint8Array {
  let file = new PdfFile();
  let catalogObject = file.reserve();
  let pagesObject = file.reserve();
  let fontRegular = file.reserve();
  let fontBold = file.reserve();
  file.setObject(
    fontRegular,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  );
  file.setObject(
    fontBold,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  );

  let images = new PdfImageRegistry(file);
  let canvas = new PdfCanvas({ file, images, watermark: input.watermark });
  let context: LayoutContext = {
    canvas,
    invoice: input.invoice,
    seller: input.seller,
    lines: input.lines,
    images,
    creditNoteDetails: input.creditNoteDetails,
  };
  drawPageHeader(context);
  drawRecipientBlock(context);
  drawCreditNoteDetails(context);
  drawLinesTable(context);
  drawTotals(context);
  drawNotesAndDeclarations(context);
  drawSignatureBlock(context);

  let pageContentObjects: number[] = [];
  for (let content of canvas.finish()) {
    let contentObject = file.reserve();
    file.setStreamObject(contentObject, '', content);
    pageContentObjects.push(contentObject);
  }

  let resources = `<< /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> ${images.resourceEntries()}/ProcSet [/PDF /Text /ImageC] >>`;
  let resourceObject = file.reserve();
  file.setObject(resourceObject, resources);

  let pageObjectNumbers = pageContentObjects.map((contentObject) => {
    let pageObject = file.reserve();
    file.setObject(
      pageObject,
      `<< /Type /Page /Parent ${pagesObject} 0 R /MediaBox [0 0 ${PAGE_WIDTH.toFixed(2)} ${PAGE_HEIGHT.toFixed(2)}] ` +
        `/Resources ${resourceObject} 0 R /Contents ${contentObject} 0 R >>`,
    );
    return pageObject;
  });
  file.setObject(
    pagesObject,
    `<< /Type /Pages /Count ${pageObjectNumbers.length} /Kids [${pageObjectNumbers.map((number) => `${number} 0 R`).join(' ')}] >>`,
  );
  file.setObject(catalogObject, `<< /Type /Catalog /Pages ${pagesObject} 0 R >>`);

  return file.serialize();
}

/** Renders a complete invoice PDF as raw bytes. */
export function renderInvoicePdf(input: {
  invoice: InvoicePdfDocument;
  lines: readonly InvoiceLine[];
  seller: InvoicePdfSeller;
  watermark: boolean;
}): Uint8Array {
  return renderPdf(input);
}

/** Renders a Credit Note PDF from the original invoice's frozen snapshots and credited lines. */
export function renderCreditNotePdf(input: {
  invoice: InvoicePdfDocument;
  creditNote: CreditNote;
  lines: readonly CreditNoteLine[];
  seller: InvoicePdfSeller;
  watermark: boolean;
}): Uint8Array {
  let document: InvoicePdfDocument = {
    ...input.invoice,
    status: input.creditNote.status,
    invoice_number: input.creditNote.credit_note_number,
    invoice_date: input.creditNote.credit_date,
    due_date: input.creditNote.credit_date,
    subtotal_minor: input.creditNote.subtotal_minor,
    line_discount_total_minor: input.creditNote.line_discount_total_minor,
    invoice_discount_mode: input.creditNote.invoice_discount_mode,
    invoice_discount_value: null,
    invoice_discount_minor: input.creditNote.invoice_discount_minor,
    net_subtotal_minor: input.creditNote.net_subtotal_minor,
    tax_total_minor: input.creditNote.tax_total_minor,
    round_off_minor: input.creditNote.round_off_minor,
    total_minor: input.creditNote.total_minor,
  };
  return renderPdf({
    invoice: document,
    lines: input.lines,
    seller: input.seller,
    watermark: input.watermark,
    creditNoteDetails: {
      creditNote: input.creditNote,
      originalInvoiceNumber: input.invoice.invoice_number ?? '',
      originalInvoiceDate: input.invoice.invoice_date,
    },
  });
}
