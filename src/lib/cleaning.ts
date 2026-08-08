/**
 * Data Cleaning — pure SQL generators for common cleanup ops. Each function
 * returns a single SQL statement (or a multi-statement string for ops that
 * need a separate UPDATE per column). All column/table names are escaped via
 * `quoteIdent` to handle spaces, dashes, and reserved words safely.
 *
 * Ops mutate the table in place — destructive ops (dropDuplicates, dropEmptyRows)
 * use CREATE OR REPLACE TABLE to preserve the table name so existing queries
 * don't break. The user is expected to be working in a copy-paste workflow
 * where the table is loaded fresh per session.
 */

export type CleanOp = 'trim' | 'emptyToNull' | 'dropEmptyRows' | 'dropDuplicates';

export const CLEAN_OP_LABELS: Record<CleanOp, { title: string; hint: string }> = {
  trim: {
    title: 'Trim whitespace',
    hint: 'Strip leading/trailing whitespace from string columns. Safe on nulls (TRIM returns null on null).',
  },
  emptyToNull: {
    title: 'Empty string → NULL',
    hint: 'Convert empty strings (including whitespace-only) to NULL. Useful for "real" null detection.',
  },
  dropEmptyRows: {
    title: 'Drop empty rows',
    hint: 'Delete rows where ALL selected columns are empty or null. Leaves rows with at least one real value.',
  },
  dropDuplicates: {
    title: 'Drop duplicate rows',
    hint: 'Keep only distinct rows. Rebuilds the table in place via CREATE OR REPLACE TABLE.',
  },
};

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/** Generate TRIM UPDATEs. Warning: only string-typed columns should be passed;
 *  calling TRIM on non-string columns will cause a DuckDB type error. */
function trimSql(table: string, cols: string[]): string {
  if (cols.length === 0) return '';
  const set = cols.map((c) => `${quoteIdent(c)} = TRIM(${quoteIdent(c)})`).join(', ');
  return `UPDATE ${quoteIdent(table)} SET ${set};`;
}

/** Generate empty-string-to-NULL UPDATEs. Warning: only string-typed columns
 *  should be passed; COALESCE/TRIM on non-string columns may behave unexpectedly. */
function emptyToNullSql(table: string, cols: string[]): string {
  if (cols.length === 0) return '';
  return cols
    .map(
      (c) =>
        `UPDATE ${quoteIdent(table)} SET ${quoteIdent(c)} = NULL WHERE TRIM(COALESCE(${quoteIdent(c)}, '')) = '';`,
    )
    .join('\n');
}

/** Generate a CREATE OR REPLACE that drops rows where all cols are empty/null.
 *  Warning: only string-typed columns should be passed; the COALESCE('') check
 *  is meaningless for numeric or boolean columns. */
function dropEmptyRowsSql(table: string, cols: string[]): string {
  if (cols.length === 0) {
    return '';
  }
  const t = quoteIdent(table);
  const checks = cols.map((c) => `COALESCE(${quoteIdent(c)}, '') = ''`).join(' AND ');
  return `CREATE OR REPLACE TABLE ${t} AS SELECT * FROM ${t} WHERE NOT (${checks});`;
}

function dropDuplicatesSql(table: string): string {
  const t = quoteIdent(table);
  return `CREATE OR REPLACE TABLE ${t} AS SELECT DISTINCT * FROM ${t};`;
}

export interface CleanArgs {
  table: string;
  ops: Set<CleanOp>;
  cols: string[];
}

export function generateCleanSQL({ table, ops, cols }: CleanArgs): string {
  if (!table) return '-- Pick a table to start';
  const stmts: string[] = [];
  if (ops.has('trim')) stmts.push(trimSql(table, cols));
  if (ops.has('emptyToNull')) stmts.push(emptyToNullSql(table, cols));
  if (ops.has('dropEmptyRows')) stmts.push(dropEmptyRowsSql(table, cols));
  if (ops.has('dropDuplicates')) stmts.push(dropDuplicatesSql(table));
  return stmts.filter(Boolean).join('\n').trim() || '-- Select at least one operation';
}
