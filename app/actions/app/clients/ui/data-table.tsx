import type { Handle, RemixNode } from 'remix/component';
import { css } from 'remix/component';

import { fontStack, neutrals } from '../../../../ui/theme.ts';

export const tableWrapStyle = css({
  width: '100%',
  overflowX: 'auto',
});

export const tableStyle = css({
  width: '100%',
  borderCollapse: 'collapse',
  fontFamily: fontStack,
});

export const headerRowStyle = css({
  borderBottom: `1px solid ${neutrals.line}`,
});

export const headerCellStyle = css({
  padding: '11px 14px',
  color: neutrals.softMuted,
  fontSize: '0.75rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textAlign: 'left',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
  '&[data-align="right"]': { textAlign: 'right' },
});

export const rowStyle = css({
  borderBottom: `1px solid ${neutrals.line}`,
  '&:last-child': { borderBottom: 'none' },
  '&:hover': { background: neutrals.canvas },
});

export const cellStyle = css({
  padding: '11px 14px',
  color: neutrals.muted,
  fontSize: '0.875rem',
  verticalAlign: 'middle',
  '&[data-align="right"]': { textAlign: 'right' },
});

export const amountCellStyle = css({
  color: neutrals.ink,
  fontWeight: 700,
  whiteSpace: 'nowrap',
});

export interface DataTableColumn {
  key: string;
  label: string;
  align?: 'left' | 'right';
}

export interface DataTableRow {
  key: string;
  cells: readonly RemixNode[];
}

export interface DataTableProps {
  /** Accessible name announced for the table. */
  label: string;
  columns: readonly DataTableColumn[];
  rows: readonly DataTableRow[];
}

/** A labelled data table with a scroll wrapper so wide tables never overflow the page. */
export function DataTable(handle: Handle<DataTableProps>) {
  return () => {
    let { label, columns, rows } = handle.props;
    return (
      <div mix={tableWrapStyle}>
        <table aria-label={label} mix={tableStyle}>
          <thead>
            <tr mix={headerRowStyle}>
              {columns.map((column) => (
                <th key={column.key} scope="col" data-align={column.align} mix={headerCellStyle}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} mix={rowStyle}>
                {row.cells.map((cell, index) => (
                  <td key={columns[index]?.key ?? index} data-align={columns[index]?.align} mix={cellStyle}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };
}
