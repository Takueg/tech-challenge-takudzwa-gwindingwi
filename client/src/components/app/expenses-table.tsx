import { useEffect, useMemo, useState } from "react";
import { CategoryTile } from "@/components/app/category-tile";
import { Panel } from "@/components/app/panel";
import { EmptyState, ErrorState } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUserId } from "@/context/current-user";
import {
  ALL_CATEGORIES,
  ALL_GROUPS,
  CATEGORIES,
  DEFAULT_SORT,
  filterRows,
  nextSort,
  paginate,
  rowsToCsv,
  sortRows,
  toRows,
  type ExpenseRow,
  type ExpenseSort,
  type SortKey,
  type TableExpense,
} from "@/lib/expense-table";
import { formatCents, formatClock, formatIsoDate, formatShortDate } from "@/lib/format";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";

const SKELETON_WIDTHS = ["62%", "48%", "70%", "55%", "66%", "44%", "58%", "68%", "50%", "60%"];
const toOptions = (values: string[]) => values.map((value) => ({ value, label: value }));
const CATEGORY_OPTIONS = toOptions([ALL_CATEGORIES, ...CATEGORIES]);

function downloadCsv(rows: ExpenseRow[], fileName: string) {
  const url = URL.createObjectURL(new Blob([`﻿${rowsToCsv(rows)}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function SortHeader({
  label,
  column,
  sort,
  onSort,
  right,
}: {
  label: string;
  column: SortKey;
  sort: ExpenseSort;
  onSort: (key: SortKey) => void;
  right?: boolean;
}) {
  const on = sort.key === column;
  const ascending = sort.direction === "asc";
  const state = on ? (ascending ? "ascending" : "descending") : "none";
  return (
    <span role="columnheader" aria-sort={state} className={right ? "text-right" : undefined}>
      <button
        type="button"
        className={cn("app-sort", on && "is-sorted")}
        onClick={() => onSort(column)}
        aria-label={`Sort by ${label.toLowerCase()}${on ? `, currently ${state}` : ""}`}
      >
        {label}
        <Icon name={on ? (ascending ? "expand_less" : "expand_more") : "unfold_more"} size={16} />
      </button>
    </span>
  );
}

function ShareCell({ row }: { row: ExpenseRow }) {
  const label = row.mine ? "You Lent" : row.involved ? "You Borrowed" : "Not Involved";
  const amount = row.mine
    ? `+${formatCents(row.shareCents)}`
    : row.involved
      ? formatCents(row.shareCents)
      : formatCents(0);
  return (
    <span role="cell" className="flex flex-col items-end gap-0.5">
      <span className="[font:400_12px/16px_var(--font-poppins)] text-muted-foreground">{label}</span>
      <span
        className={cn(
          "[font:600_15px/20px_var(--font-poppins)]",
          !row.mine && row.involved ? "text-accent-ink" : "text-strong"
        )}
      >
        {amount}
      </span>
    </span>
  );
}

function TableSkeleton({ grid, showGroup, showActions, rows }: { grid: string; showGroup?: boolean; showActions?: boolean; rows: number }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-[18px]">
      <span className="sr-only">Loading expenses…</span>
      <div aria-hidden="true" className="flex flex-wrap gap-3">
        <Skeleton height={41} radius={18} className="flex-[2_1_240px]" />
        {showGroup && <Skeleton height={41} radius={18} className="flex-[1_1_170px]" />}
        <Skeleton height={41} radius={18} className="flex-[1_1_170px]" />
      </div>
      <div aria-hidden="true" className="-mx-3 overflow-hidden">
        <div className="flex min-w-[780px] flex-col gap-1 px-3">
          <div className={cn(grid, "px-3 pt-1 pb-3")}>
            <Skeleton line width={64} height={10} />
            <Skeleton line width={40} height={10} />
            {showGroup && <Skeleton line width={48} height={10} />}
            <Skeleton line width={52} height={10} />
            <span className="flex justify-end">
              <Skeleton line width={56} height={10} />
            </span>
            <span className="flex justify-end">
              <Skeleton line width={68} height={10} />
            </span>
            {showActions && <span />}
          </div>
          {SKELETON_WIDTHS.slice(0, rows).map((width) => (
            <div key={width} className={cn(grid, "min-h-[77px] p-3")}>
              <span className="flex min-w-0 items-center gap-3.5">
                <Skeleton width={57} height={53} radius={22} />
                <span className="flex min-w-0 flex-1 flex-col gap-2">
                  <Skeleton line width={width} />
                  <Skeleton line width={64} height={10} />
                </span>
              </span>
              <span className="flex flex-col gap-2">
                <Skeleton line width={52} />
                <Skeleton line width={40} height={10} />
              </span>
              {showGroup && <Skeleton line width="70%" />}
              <Skeleton line width="60%" />
              <span className="flex justify-end">
                <Skeleton line width={72} />
              </span>
              <span className="flex flex-col items-end gap-2">
                <Skeleton line width={56} height={10} />
                <Skeleton line width={72} />
              </span>
              {showActions && (
                <span className="flex justify-end gap-2.5">
                  <Skeleton round width={32} height={32} />
                  <Skeleton round width={32} height={32} />
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
      <div aria-hidden="true" className="flex min-h-11 items-center justify-between">
        <Skeleton line width={96} height={12} />
      </div>
    </div>
  );
}

export function ExpensesTable({
  heading,
  expenses,
  showGroup,
  showActions,
  readOnly,
  loading,
  error,
  onRetry,
  onEdit,
  onDelete,
  onAdd,
  exportFileName,
  newId,
}: {
  heading: string;
  expenses: TableExpense[];
  showGroup?: boolean;
  showActions?: boolean;
  readOnly?: boolean;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  onEdit?: (expenseId: string) => void;
  onDelete?: (expenseId: string) => void;
  onAdd?: () => void;
  exportFileName: string;
  newId?: string | null;
}) {
  const currentUserId = useCurrentUserId();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState(ALL_GROUPS);
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [sort, setSort] = useState<ExpenseSort>(DEFAULT_SORT);
  const [requestedPage, setPage] = useState(1);

  const groupNames = useMemo(() => [...new Set(expenses.map((e) => e.groupName))], [expenses]);
  const activeGroup = groupNames.includes(group) ? group : ALL_GROUPS;
  const filters = { query, group: showGroup ? activeGroup : ALL_GROUPS, category };
  const hasFilters = Boolean(query.trim()) || filters.group !== ALL_GROUPS || category !== ALL_CATEGORIES;

  const sorted = sortRows(filterRows(toRows(expenses, currentUserId), filters), sort);
  const { rows, page, pageCount } = paginate(sorted, requestedPage);

  function clearFilters() {
    setQuery("");
    setGroup(ALL_GROUPS);
    setCategory(ALL_CATEGORIES);
    setPage(1);
  }

  // A row that was just added has to be on screen to be highlighted.
  useEffect(() => {
    if (!newId) return;
    clearFilters();
    setSort(DEFAULT_SORT);
  }, [newId]);

  function exportCsv() {
    if (sorted.length === 0) {
      notify.error({
        title: "Nothing To Export",
        body: expenses.length
          ? "No expenses match your search and filters. Clear them and try again."
          : "There are no expenses here yet.",
      });
      return;
    }
    const fileName = `${exportFileName}-${formatIsoDate(new Date())}.csv`;
    try {
      downloadCsv(sorted, fileName);
      notify.success({
        title: "Export Ready",
        body: `${sorted.length} ${sorted.length === 1 ? "expense" : "expenses"} saved as ${fileName}${hasFilters ? " (filters applied)." : "."}`,
      });
    } catch (cause) {
      console.error("CSV export failed", cause);
      notify.error({
        title: "Export Failed",
        body: "Your browser blocked the download. Allow downloads for this site and try again.",
      });
    }
  }

  const grid = cn("app-xt", showGroup && showActions ? "app-xt--ga" : showGroup ? "app-xt--g" : showActions && "app-xt--a");
  const onSort = (key: SortKey) => {
    setSort((current) => nextSort(current, key));
    setPage(1);
  };

  return (
    <Panel
      className="w-full"
      title={
        <span className="flex items-center gap-2.5">
          {heading}
          {loading ? (
            <Skeleton width={40} height={26} radius={13} />
          ) : (
            !error && (
              <span
                aria-label={
                  hasFilters
                    ? `${sorted.length} of ${expenses.length} expenses match`
                    : `${expenses.length} expenses in total`
                }
                className="inline-flex h-[26px] items-center rounded-[13px] bg-primary px-2.5 [font:600_13px/1_var(--font-poppins)] text-on-primary"
              >
                {hasFilters ? `${sorted.length} of ${expenses.length}` : expenses.length}
              </span>
            )
          )}
        </span>
      }
      actions={
        <Button variant="outline" onClick={exportCsv} disabled={loading}>
          <Icon name="download" size={20} />
          Export CSV
        </Button>
      }
    >
      {loading ? (
        <TableSkeleton grid={grid} showGroup={showGroup} showActions={showActions} rows={10} />
      ) : error ? (
        <ErrorState title="We Couldn’t Load These Expenses" onRetry={() => onRetry?.()} />
      ) : expenses.length === 0 ? (
        <EmptyState
          icon="receipt_long"
          title="No Expenses Yet"
          body="Add the first one and we’ll work out who owes what."
          action={onAdd && !readOnly ? <Button onClick={onAdd}>Add Expense</Button> : undefined}
        />
      ) : (
        <div className="flex flex-col gap-[18px]">
          <div role="search" aria-label="Search and filter expenses" className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-[2_1_240px]">
              <label className="swl-search">
                <input
                  type="search"
                  className="swl-search__input"
                  placeholder={showGroup ? "Search expenses, groups, people" : "Search expenses or people"}
                  aria-label={showGroup ? "Search expenses, groups, people" : "Search expenses or people"}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                />
              </label>
            </div>
            {showGroup && (
              <div className="min-w-0 flex-[1_1_170px]">
                <Select
                  inPanel
                  aria-label="Filter by group"
                  options={toOptions([ALL_GROUPS, ...groupNames])}
                  value={activeGroup}
                  onValueChange={(value) => {
                    setGroup(value);
                    setPage(1);
                  }}
                />
              </div>
            )}
            <div className="min-w-0 flex-[1_1_170px]">
              <Select
                inPanel
                aria-label="Filter by category"
                options={CATEGORY_OPTIONS}
                value={category}
                onValueChange={(value) => {
                  setCategory(value);
                  setPage(1);
                }}
              />
            </div>
            {hasFilters && (
              <Button variant="text" onClick={clearFilters}>
                <Icon name="close" size={16} />
                Clear
              </Button>
            )}
          </div>

          {rows.length === 0 ? (
            <EmptyState
              icon="search"
              title={query.trim() ? `No Expenses Match “${query.trim()}”` : "No Expenses Match These Filters"}
              body="Try another word, or widen the filters."
              action={
                <Button variant="secondary" onClick={clearFilters}>
                  Clear Search &amp; Filters
                </Button>
              }
            />
          ) : (
            <div className="flex flex-col gap-[18px]">
              <div className="-mx-3 overflow-x-auto">
                <div role="table" aria-label="Expenses" aria-rowcount={sorted.length + 1} className="min-w-[780px] px-3">
                  <div role="rowgroup">
                    <div
                      role="row"
                      className={cn(grid, "px-3 pb-2 [font:600_14px/20px_var(--font-poppins)] text-muted-foreground")}
                    >
                      <SortHeader label="Expense" column="title" sort={sort} onSort={onSort} />
                      <SortHeader label="Date" column="date" sort={sort} onSort={onSort} />
                      {showGroup && <SortHeader label="Group" column="group" sort={sort} onSort={onSort} />}
                      <SortHeader label="Paid By" column="payer" sort={sort} onSort={onSort} />
                      <SortHeader label="Amount" column="amount" sort={sort} onSort={onSort} right />
                      <SortHeader label="Your Share" column="share" sort={sort} onSort={onSort} right />
                      {showActions && (
                        <span role="columnheader">
                          <span className="sr-only">Actions</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div role="rowgroup">
                    {rows.map((row) => {
                      const fresh = row.id === newId;
                      return (
                        <div role="row" key={row.id} className={cn(grid, "app-tr", fresh && "app-tr--new")}>
                          <span role="cell" className="flex min-w-0 items-center gap-3.5">
                            <CategoryTile category={row.category} />
                            <span className="flex min-w-0 flex-col gap-[3px]">
                              <span className="swl-row__title">{row.description}</span>
                              <span className="[font:400_12px/18px_var(--font-poppins)] text-muted-foreground">
                                {row.category}
                              </span>
                            </span>
                          </span>
                          <span role="cell" className="flex flex-col gap-0.5">
                            <span className="swl-row__time text-[13px]">
                              {fresh ? "Today" : formatShortDate(row.createdAt)}
                            </span>
                            <span className="[font:400_12px/16px_var(--font-poppins)] text-muted-foreground">
                              {fresh ? "Just now" : formatClock(row.createdAt)}
                            </span>
                          </span>
                          {showGroup && (
                            <span role="cell" className="truncate [font:400_14px/20px_var(--font-poppins)]">
                              {row.groupName}
                            </span>
                          )}
                          <span role="cell" className="[font:400_14px/20px_var(--font-poppins)]">
                            {row.mine ? "You" : row.paidByUserName}
                          </span>
                          <span role="cell" className="text-right [font:500_15px/20px_var(--font-poppins)] text-strong">
                            {formatCents(row.amountCents)}
                          </span>
                          <ShareCell row={row} />
                          {showActions && (
                            <span role="cell" className="flex justify-end gap-0.5">
                              {row.mine && (
                                <>
                                  <Button
                                    variant="icon"
                                    aria-label={`Edit ${row.description}`}
                                    title="Edit"
                                    disabled={readOnly}
                                    onClick={() => onEdit?.(row.id)}
                                  >
                                    <Icon name="edit" size={20} />
                                  </Button>
                                  <Button
                                    variant="icon"
                                    aria-label={`Delete ${row.description}`}
                                    title="Delete"
                                    disabled={readOnly}
                                    onClick={() => onDelete?.(row.id)}
                                  >
                                    <Icon name="delete" size={20} />
                                  </Button>
                                </>
                              )}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p role="status" aria-live="polite" className="m-0 [font:400_13px/18px_var(--font-poppins)] text-muted-foreground">
                  Page {page} of {pageCount}
                </p>
                {pageCount > 1 && (
                  <nav aria-label="Expense pages" className="flex items-center gap-1">
                    <Button variant="icon" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                      <Icon name="chevron_left" size={18} />
                    </Button>
                    {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={cn("app-page", n === page && "is-current")}
                        aria-current={n === page ? "page" : undefined}
                        aria-label={`Page ${n}`}
                        onClick={() => setPage(n)}
                      >
                        {n}
                      </button>
                    ))}
                    <Button variant="icon" aria-label="Next page" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>
                      <Icon name="chevron_right" size={18} />
                    </Button>
                  </nav>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
