import type { Handle, RemixNode } from 'remix/component';
import { css } from 'remix/component';

import { fontStack, neutrals } from '../../../../ui/theme.ts';

const tableWrapStyle = css({
  width: '100%',
  overflowX: 'auto',
});

const tableStyle = css({
  width: '100%',
  borderCollapse: 'collapse',
  fontFamily: fontStack,
});

const headerRowStyle = css({
  borderBottom: `1px solid ${neutrals.line}`,
});

const headerCellStyle = css({
  padding: '11px 14px',
  color: neutrals.softMuted,
  fontSize: '0.75rem',
  fontWeight: 700,
  letterSpacing: '0.05em',
  textAlign: 'left',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
  '&[data-align="right"]': { textAlign: 'right' },
});

const rowStyle = css({
  borderBottom: `1px solid ${neutrals.line}`,
  '&:last-child': { borderBottom: 'none' },
  '&:hover': { background: neutrals.rowHover },
});

const cellStyle = css({
  padding: '13px 14px',
  color: neutrals.muted,
  fontSize: '0.875rem',
  verticalAlign: 'middle',
  '&[data-align="right"]': { textAlign: 'right' },
});

const amountCellStyle = css({
  color: neutrals.ink,
  fontWeight: 700,
  whiteSpace: 'nowrap',
});

export interface TableProps {
  /** Accessible name announced for the table. */
  label: string;
  children: RemixNode;
}

/**
 * A labelled, scroll-wrapped data table composed through its parts: `Table.Header`,
 * `Table.HeadCell`, `Table.Body`, `Table.Row`, and `Table.Cell`. Each part owns its own
 * HTML semantics (`aria-label`, `scope="col"`, the overflow wrapper), so callers never
 * wire them by hand.
 */
export function Table(handle: Handle<TableProps>) {
  return () => (
    <div mix={tableWrapStyle}>
      <table aria-label={handle.props.label} mix={tableStyle}>
        {handle.props.children}
      </table>
    </div>
  );
}

export namespace Table {
  export interface HeaderProps {
    children: RemixNode;
  }

  /** The table's column header block; renders the header row, children are `HeadCell`s. */
  export function Header(handle: Handle<HeaderProps>) {
    return () => (
      <thead>
        <tr mix={headerRowStyle}>{handle.props.children}</tr>
      </thead>
    );
  }

  export interface HeadCellProps {
    align?: 'left' | 'right';
    children: RemixNode;
  }

  /** One column header cell; owns the `scope="col"` semantics screen readers rely on. */
  export function HeadCell(handle: Handle<HeadCellProps>) {
    return () => (
      <th scope="col" data-align={handle.props.align} mix={headerCellStyle}>
        {handle.props.children}
      </th>
    );
  }

  /** The table's data rows; children are `Row`s. */
  export function Body(handle: Handle<{ children: RemixNode }>) {
    return () => <tbody>{handle.props.children}</tbody>;
  }

  export interface RowProps {
    children: RemixNode;
  }

  /** One data row; children are `Cell`s. */
  export function Row(handle: Handle<RowProps>) {
    return () => <tr mix={rowStyle}>{handle.props.children}</tr>;
  }

  export interface CellProps {
    align?: 'left' | 'right';
    children: RemixNode;
  }

  /** One data cell. */
  export function Cell(handle: Handle<CellProps>) {
    return () => (
      <td data-align={handle.props.align} mix={cellStyle}>
        {handle.props.children}
      </td>
    );
  }

  /** A right-aligned cell for a money value: ink, bold, and never wrapping. */
  export function AmountCell(handle: Handle<{ children: RemixNode }>) {
    return () => (
      <td data-align="right" mix={[cellStyle, amountCellStyle]}>
        {handle.props.children}
      </td>
    );
  }
}
