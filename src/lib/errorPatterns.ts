/**
 * Error Pattern DB — curated, developer-written explanations for the most
 * common DuckDB / SQL error messages. When a query fails, we match the raw
 * error against these patterns and render a "Why this happened" + fix panel
 * instead of dumping the user a bare stack trace.
 *
 * Design rules:
 *  - `match` regex must be anchored loosely (case-insensitive, allow leading
 *    whitespace) so it catches the real DuckDB error format
 *  - `fix` should be a concrete code snippet or step list, not hand-waving
 *  - Patterns are tried in order; first match wins. Put MOST specific first
 *  - Title uses the error's own language (Binder/Catalog/Parser) so users
 *    learn the vocabulary
 */

export interface ErrorPattern {
  id: string;
  match: RegExp;
  title: string;
  explanation: string;
  fix: string;
  docHint?: string;
}

export const ERROR_PATTERNS: ErrorPattern[] = [
  {
    id: 'table-missing',
    match: /Catalog Error: Table with name "?([^"]+?)"? does not exist/i,
    title: 'Table or file not loaded',
    explanation:
      'You referenced a table name that DuckDB has never heard of. Either the file is not loaded, the table name is misspelled, or you need to register the file first.',
    fix: 'Load your file (CSV/Parquet/JSON/etc.) in the dropzone above. Tables are named after the filename without extension. Check the Schema panel for the exact table name currently in scope.',
  },
  {
    id: 'table-typo-suggestion',
    match: /Did you mean "([^"]+)"\?/i,
    title: 'Typo in table name',
    explanation: 'DuckDB found a table that almost matches the name you typed.',
    fix: 'Replace the misspelled name with the suggested one (or use the autocomplete in the SQL editor).',
  },
  {
    id: 'column-not-found',
    match: /Binder Error: Referenced column "([^"]+)" not found in FROM clause/i,
    title: 'Column not found in FROM',
    explanation:
      'The column you referenced does not exist on any of the tables in your FROM clause. Common causes: typo, wrong table alias, or you forgot to JOIN the table that has this column.',
    fix: 'Check the spelling. If using an alias, write `<alias>.<column>`. If the column lives in another table, add a JOIN that brings it in. The column autocomplete in the editor shows all available columns.',
  },
  {
    id: 'column-ambiguous',
    match: /Binder Error: Ambiguous reference to column "([^"]+)"/i,
    title: 'Ambiguous column',
    explanation:
      'This column name exists in more than one table in your query, so DuckDB cannot guess which one you mean.',
    fix: 'Qualify the column with a table or alias name, e.g. `orders.user_id` instead of `user_id`.',
  },
  {
    id: 'cannot-find-function',
    match: /Catalog Error: Scalar Function with name "([\w]+)" does not exist/i,
    title: 'Unknown function',
    explanation:
      'You used a function name DuckDB does not know. Could be a typo, a function from a different SQL dialect, or a function that lives in a different namespace.',
    fix: 'Check the spelling. DuckDB function names are case-insensitive but must match exactly. See the DuckDB function list for what is supported. If you came from PostgreSQL/MySQL/SQL Server, you may need a DuckDB-native equivalent.',
  },
  {
    id: 'cannot-find-column-in-table',
    match: /Binder Error: Cannot find column "([^"]+)" in table "([^"]+)"/i,
    title: 'Column not on that table',
    explanation:
      'You qualified a column with a table (or alias) but the column does not exist on that specific table.',
    fix: 'Check the Schema panel for the columns on that table. The column might be on a different joined table.',
  },
  {
    id: 'syntax-error',
    match: /Parser Error: syntax error at or near "([\w]+)"/i,
    title: 'SQL syntax error',
    explanation:
      'DuckDB hit a token it did not expect at the marked position. This is almost always a typo, missing comma, missing semicolon, unbalanced paren, or reserved word used as identifier without quoting.',
    fix: 'Look at the position reported in the error message. Common fixes:\n  • Add a missing comma between SELECT items\n  • Close an unclosed paren `(`\n  • Quote a reserved word with double quotes: `"order"` instead of `order`\n  • Check that string literals use single quotes `\'...\'` not double',
  },
  {
    id: 'expected-end',
    match: /Parser Error: Expected end of statement/i,
    title: 'Extra characters at end of statement',
    explanation:
      'DuckDB finished parsing a valid statement and then found more characters it could not interpret. Usually a stray comma, semicolon inside a string, or copy-pasted text.',
    fix: 'Look at the end of the statement. Remove trailing commas, extra semicolons inside string literals, or any copy-paste artifacts.',
  },
  {
    id: 'type-mismatch',
    match: /Type Error: Type (\w+) does not fit in (\w+)/i,
    title: 'Type does not fit',
    explanation:
      'You tried to put a value of one type into a smaller or incompatible type. Most often: assigning a BIGINT into an INT8, or a wide string into a fixed-size field.',
    fix: 'Use a wider type (e.g. `INT64` instead of `INT8`) or cast explicitly: `CAST(col AS BIGINT)`.',
  },
  {
    id: 'conversion-string',
    match: /Conversion Error: Could not convert string "([^"]*)" to (\w+)/i,
    title: 'String → number/date conversion failed',
    explanation:
      'DuckDB expected a numeric or date value in a column but found a string that does not parse. Often a data quality issue: stray non-numeric chars, dates in the wrong format, or trailing whitespace.',
    fix: 'Inspect the bad rows: `SELECT * FROM t WHERE TRY_CAST(col AS INT) IS NULL AND col IS NOT NULL LIMIT 100`. Then either clean the source data or use `TRY_CAST` (returns NULL on failure) instead of `CAST` (errors out).',
  },
  {
    id: 'conversion-fail',
    match: /Conversion Error: Could not convert /i,
    title: 'Conversion failed',
    explanation:
      'DuckDB tried to convert a value to a target type and the source value was incompatible.',
    fix: 'Use `TRY_CAST` to get NULL instead of an error, or filter the bad rows with `WHERE col IS NOT NULL AND TRY_CAST(col AS TYPE) IS NOT NULL`.',
  },
  {
    id: 'aggregate-outside',
    match: /Binder Error: Aggregate function ([\w()]+) found outside aggregate/i,
    title: 'Aggregate used incorrectly',
    explanation:
      'You used an aggregate (SUM, COUNT, AVG, MIN, MAX) at a level of nesting where it is not allowed. Common cause: mixing an aggregate with non-aggregated columns in SELECT without a GROUP BY.',
    fix: 'Either:\n  • Add a GROUP BY listing every non-aggregated column\n  • Use a window function: `SUM(x) OVER (PARTITION BY ...)` keeps the row grain\n  • Wrap the value in a subquery / CTE to control the aggregation level',
  },
  {
    id: 'window-aggregate-mix',
    match: /Binder Error: Cannot mix aggregate and non-aggregate/i,
    title: 'Mixing aggregate and row-level values',
    explanation:
      'A SELECT mixes an aggregate (SUM, COUNT...) with a non-aggregated column, but there is no GROUP BY that disambiguates the level.',
    fix: 'Add GROUP BY for the non-aggregated columns, or wrap the aggregate in a window function (SUM(x) OVER (...)) to keep row grain.',
  },
  {
    id: 'division-by-zero',
    match: /Runtime Error: Division by zero/i,
    title: 'Division by zero',
    explanation:
      'You divided by an expression that evaluated to zero (or a near-zero numeric).',
    fix: 'Guard the division: `numerator / NULLIF(denominator, 0)`. NULLIF returns NULL on match, so the result becomes NULL instead of erroring.',
  },
  {
    id: 'oom',
    match: /Out of Memory Error/i,
    title: 'Out of memory',
    explanation:
      'DuckDB ran out of browser memory. The query (or its intermediate result) was larger than the available heap.',
    fix: 'Try:\n  • Add a LIMIT or pre-aggregate: `SELECT ... GROUP BY ... LIMIT 10000`\n  • Drop columns you do not need: `SELECT a, b FROM t` instead of `SELECT *`\n  • Filter early: `WHERE date >= ...` before heavy joins\n  • Split the work into smaller queries and UNION ALL the results',
  },
  {
    id: 'io-file-missing',
    match: /IO Error: No such file or directory/i,
    title: 'File not found',
    explanation:
      'DuckDB tried to read a file that does not exist at the given path.',
    fix: 'Check the path. DuckDB-WASM only sees files that are explicitly registered via `registerFileBuffer` — local filesystem paths from `read_csv(\'/path/...\')` will not work in the browser.',
  },
  {
    id: 'io-http',
    match: /IO Error.*HTTP/i,
    title: 'HTTP fetch failed',
    explanation: 'A network file read failed. The server may be down, rate-limiting, or blocking CORS.',
    fix: 'Try again, or download the file and upload it directly to QueryDrop instead.',
  },
  {
    id: 'not-a-date',
    match: /Catalog Error: .+ is not a date/i,
    title: 'Column is not a date',
    explanation:
      'You called a date function (DATE_TRUNC, DATE_PART, EXTRACT) on a column that is stored as VARCHAR or another non-date type.',
    fix: 'Cast first: `DATE_TRUNC(\'day\', CAST(col AS DATE))` or `DATE_TRUNC(\'day\', TRY_CAST(col AS TIMESTAMP))` if the column has mixed formats.',
  },
  {
    id: 'timeout',
    match: /Query timeout/i,
    title: 'Query took too long',
    explanation: 'The query exceeded QueryDrop\'s safety timeout (default 30s).',
    fix: 'Add LIMIT, pre-aggregate with GROUP BY, or filter early with WHERE. If the query is genuinely large, break it into chunks.',
  },
];

export interface ErrorMatch {
  pattern: ErrorPattern;
  captures: string[];
}

export function matchErrorPattern(message: string): ErrorMatch | null {
  for (const pattern of ERROR_PATTERNS) {
    const m = pattern.match.exec(message);
    if (m) {
      return { pattern, captures: m.slice(1) };
    }
  }
  return null;
}
