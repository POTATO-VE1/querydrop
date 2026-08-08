/**
 * Client-side Arrow/Feather ingestion for DuckDB-WASM.
 *
 * DuckDB-WASM does NOT have a `read_arrow` SQL function. Instead, we use
 * `apache-arrow` (already a dependency) to parse the IPC stream, then
 * `conn.insertArrowTable` to inject the table into DuckDB so that it behaves
 * like any other registered table for querying.
 */

import * as arrow from 'apache-arrow';
import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';

/**
 * Read an Arrow IPC / Feather v2 file and insert it as a DuckDB table.
 * After insertion the table is fully queryable via SQL as `tableName`.
 */
export async function insertArrowFile(
  conn: AsyncDuckDBConnection,
  file: File,
  tableName: string,
): Promise<void> {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tableName)) {
    throw new Error(`Invalid table name: ${JSON.stringify(tableName)}`);
  }
  let table: arrow.Table;
  try {
    const buf = new Uint8Array(await file.arrayBuffer());
    table = arrow.tableFromIPC(buf);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse Arrow file: ${msg}. Please ensure this is a valid Arrow IPC or Feather v2 file.`);
  }
  await conn.insertArrowTable(table as any, { name: tableName, create: true });
}
