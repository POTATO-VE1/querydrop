import { describe, it, expect, vi } from 'vitest';
import { insertArrowFile } from '../../duckdb/arrow';
import type { AsyncDuckDBConnection } from '@duckdb/duckdb-wasm';

describe('insertArrowFile', () => {
  it('throws a friendly error when Arrow file parsing fails', async () => {
    const corruptFile = new File(['this is corrupt data'], 'corrupt.arrow', { type: 'application/octet-stream' });
    const mockConn = {
      insertArrowTable: vi.fn(),
    } as unknown as AsyncDuckDBConnection;

    await expect(insertArrowFile(mockConn, corruptFile, 'valid_table_name')).rejects.toThrow(
      /Failed to parse Arrow file.*Please ensure this is a valid Arrow IPC or Feather v2 file/
    );
  });

  it('rejects invalid table names', async () => {
    const mockConn = {
      insertArrowTable: vi.fn(),
    } as unknown as AsyncDuckDBConnection;
    const file = new File([new Uint8Array(0)], 'test.arrow');

    await expect(insertArrowFile(mockConn, file, 'invalid-table-name')).rejects.toThrow(
      /Invalid table name/
    );
  });
});
