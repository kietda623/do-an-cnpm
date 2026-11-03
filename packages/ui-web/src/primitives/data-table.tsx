"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { cx } from "../lib/cx";
import { EmptyState, Skeleton, StatusMessage } from "./surface";
import { Button } from "./button";

export type DataTableColumn<T> = {
  key: string;
  header: ReactNode;
  render: (row: T, index: number) => ReactNode;
  align?: "left" | "center" | "right";
  width?: string;
  numeric?: boolean;
  className?: string;
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  caption: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  selectedKey?: string | null;
  dense?: boolean;
  footer?: ReactNode;
};

function TableShell({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className="mp-table-wrap">
      <table className="mp-table">
        <caption className="mp-visually-hidden">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  loading = false,
  error = null,
  onRetry,
  empty,
  onRowClick,
  selectedKey,
  dense = false,
  footer,
}: DataTableProps<T>) {
  if (error) {
    return (
      <StatusMessage tone="error" title="Không tải được dữ liệu">
        <p>{error}</p>
        {onRetry ? (
          <Button size="sm" variant="secondary" onClick={onRetry} className="mp-alert__action">
            Thử lại
          </Button>
        ) : null}
      </StatusMessage>
    );
  }

  if (loading) {
    return (
      <TableShell caption={caption}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                style={column.width ? { width: column.width } : undefined}
                className={column.className}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody aria-hidden="true">
          {Array.from({ length: 5 }, (_, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((column) => (
                <td key={column.key} className={column.className}>
                  <Skeleton className="mp-skeleton--cell" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </TableShell>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="mp-table-empty">
        {empty ?? (
          <EmptyState
            title="Chưa có dữ liệu"
            description="Khi có bản ghi mới, chúng sẽ xuất hiện ở đây."
          />
        )}
      </div>
    );
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, row: T) => {
    if (!onRowClick) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onRowClick(row);
    }
  };

  return (
    <>
      <TableShell caption={caption}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                style={column.width ? { width: column.width } : undefined}
                data-align={column.align ?? (column.numeric ? "right" : undefined)}
                className={column.className}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const key = rowKey(row);
            const selected = selectedKey === key;
            return (
              <tr
                key={key}
                className={cx(
                  dense && "mp-table__row--dense",
                  selected && "mp-table__row--selected",
                  onRowClick && "mp-table__row--clickable",
                )}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (event) => handleKeyDown(event, row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={column.className}
                    data-align={column.align ?? (column.numeric ? "right" : undefined)}
                    {...(column.numeric ? { "data-numeric": true } : {})}
                  >
                    {column.render(row, index)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </TableShell>
      {footer ? <div className="mp-table-footer">{footer}</div> : null}
    </>
  );
}
