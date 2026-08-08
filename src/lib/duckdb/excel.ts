/**
 * Excel helpers — client-side parsing via SheetJS (xlsx).
 *
 * DuckDB-WASM does NOT include the `excel` extension by default, so we use
 * SheetJS to convert .xlsx/.xls files to CSV on the client before handing
 * them to DuckDB. The file is NEVER uploaded — conversion is in-browser.
 *
 * Bundle note: SheetJS is ~430KB. We dynamic-import it so the cost is only
 * paid when the user actually drops an Excel file (the rest of QueryPad
 * stays at ~258KB initial).
 */

export interface ExcelSheetInfo {
  /** Sheet name (as it appears in the workbook). */
  name: string;
  /** Estimated row count from the sheet's `!ref` range (0 if empty). */
  rowCount: number;
}

const arrayBufferCache = new WeakMap<File, ArrayBuffer>();

async function getFileArrayBuffer(file: File): Promise<ArrayBuffer> {
  let buf = arrayBufferCache.get(file);
  if (!buf) {
    buf = await file.arrayBuffer();
    arrayBufferCache.set(file, buf);
  }
  return buf;
}

/**
 * Enumerate the sheets in an Excel workbook without reading cell content.
 * Uses SheetJS's `sheetStubs: true` to skip cell values for speed on large
 * files; only the dimension ref is read so we can report row counts.
 */
export async function parseExcelSheets(file: File): Promise<{ sheets: ExcelSheetInfo[] }> {
  const XLSX = await import('xlsx');
  const buf = await getFileArrayBuffer(file);
  const workbook = XLSX.read(buf, { sheetStubs: true, dense: true });
  const sheets: ExcelSheetInfo[] = workbook.SheetNames.map((name) => {
    const ws = workbook.Sheets[name];
    let rowCount = 0;
    if (ws && typeof ws['!ref'] === 'string') {
      const match = ws['!ref'].match(/^[A-Z]+\d+:([A-Z]+)(\d+)$/);
      if (match) {
        const rawRows = parseInt(match[2] as string, 10);
        rowCount = Math.max(0, rawRows - 1);
      }
    }
    return { name, rowCount };
  });
  return { sheets };
}

/**
 * Convert a specific sheet of an Excel workbook to a CSV File, ready to
 * be registered with DuckDB as a regular CSV. The new File's name encodes
 * the original filename + sheet name so the chip stays informative.
 */
export async function excelSheetToCsv(file: File, sheetName: string): Promise<File> {
  const XLSX = await import('xlsx');
  const buf = await getFileArrayBuffer(file);
  const workbook = XLSX.read(buf, { type: 'array' });
  const ws = workbook.Sheets[sheetName];
  if (!ws) {
    throw new Error(`Sheet "${sheetName}" not found in ${file.name}`);
  }
  const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false });
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const newName = `${baseName}__${sheetName.replace(/[^a-zA-Z0-9_.-]/g, '_')}.csv`;
  return new File([csv], newName, { type: 'text/csv' });
}

