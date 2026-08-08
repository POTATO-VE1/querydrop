/**
 * Query Templates — curated, shipped SQL recipes the user can one-click insert.
 * Different from Stage 11 snippets (user-saved) and Stage 8 history (recent runs):
 * templates are developer-written, categorized, and resolve `<table>` at insert
 * time to whatever the user has loaded. Placeholders like `<col>` are left
 * intact for the user to fill in via the editor's column autocomplete.
 */

export type TemplateCategory =
  | 'Exploration'
  | 'Aggregation'
  | 'Filters'
  | 'Window'
  | 'Time Series';

export interface Template {
  id: string;
  category: TemplateCategory;
  name: string;
  description: string;
  sql: string;
}

export const TEMPLATES: Template[] = [
  {
    id: 'peek',
    category: 'Exploration',
    name: 'Peek at data',
    description: 'First 100 rows of the active table',
    sql: 'SELECT * FROM <table> LIMIT 100',
  },
  {
    id: 'count',
    category: 'Exploration',
    name: 'Row count',
    description: 'How many rows?',
    sql: 'SELECT COUNT(*) AS row_count FROM <table>',
  },
  {
    id: 'describe',
    category: 'Exploration',
    name: 'Describe schema',
    description: 'Column names and types',
    sql: 'DESCRIBE <table>',
  },
  {
    id: 'sample',
    category: 'Exploration',
    name: 'Random sample',
    description: '10% sample using reservoir-style TABLESAMPLE',
    sql: 'SELECT * FROM <table> USING SAMPLE 10%',
  },
  {
    id: 'group-count',
    category: 'Aggregation',
    name: 'Group by count',
    description: 'Replace <col> with a categorical column',
    sql: 'SELECT <col>, COUNT(*) AS n FROM <table> GROUP BY <col> ORDER BY n DESC LIMIT 20',
  },
  {
    id: 'topn',
    category: 'Aggregation',
    name: 'Top N rows',
    description: 'Replace <col> with a numeric column',
    sql: 'SELECT * FROM <table> ORDER BY <col> DESC LIMIT 10',
  },
  {
    id: 'summary',
    category: 'Aggregation',
    name: 'Numeric summary',
    description: 'count/avg/min/max/stddev of one numeric column',
    sql: 'SELECT COUNT(<col>) AS n, AVG(<col>) AS avg, MIN(<col>) AS min, MAX(<col>) AS max, STDDEV(<col>) AS stddev FROM <table>',
  },
  {
    id: 'nulls',
    category: 'Filters',
    name: 'Null counts',
    description: 'Replace <col> with a column name',
    sql: 'SELECT COUNT(*) FILTER (WHERE <col> IS NULL) AS nulls, COUNT(*) AS total, ROUND(100.0 * COUNT(*) FILTER (WHERE <col> IS NULL) / COUNT(*), 2) AS null_pct FROM <table>',
  },
  {
    id: 'distinct',
    category: 'Filters',
    name: 'Distinct values',
    description: 'Replace <col> with a categorical column',
    sql: 'SELECT <col>, COUNT(*) AS n FROM <table> GROUP BY <col> ORDER BY n DESC',
  },
  {
    id: 'rownum',
    category: 'Window',
    name: 'Row number',
    description: 'Adds ROW_NUMBER() to every row',
    sql: 'SELECT *, ROW_NUMBER() OVER () AS rn FROM <table> LIMIT 100',
  },
  {
    id: 'rank',
    category: 'Window',
    name: 'Rank within group',
    description: 'Replace <group_col> and <col>',
    sql: 'SELECT *, RANK() OVER (PARTITION BY <group_col> ORDER BY <col> DESC) AS rk FROM <table>',
  },
  {
    id: 'running-total',
    category: 'Window',
    name: 'Running total',
    description: 'Replace <col> with a numeric column',
    sql: 'SELECT *, SUM(<col>) OVER (ORDER BY <order_col>) AS running_total FROM <table>',
  },
  {
    id: 'daily',
    category: 'Time Series',
    name: 'Daily count',
    description: 'Replace <col> with a timestamp/date column',
    sql: "SELECT DATE_TRUNC('day', <col>) AS day, COUNT(*) AS n FROM <table> GROUP BY 1 ORDER BY 1",
  },
  {
    id: 'monthly-trend',
    category: 'Time Series',
    name: 'Monthly trend',
    description: 'Replace <col> with a timestamp and <val> with a numeric',
    sql: "SELECT DATE_TRUNC('month', <col>) AS month, SUM(<val>) AS total FROM <table> GROUP BY 1 ORDER BY 1",
  },
];

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  'Exploration',
  'Aggregation',
  'Filters',
  'Window',
  'Time Series',
];

const SQL_RESERVED_WORDS = new Set([
  'select', 'from', 'where', 'order', 'group', 'having', 'limit', 'offset',
  'union', 'intersect', 'except', 'join', 'inner', 'left', 'right', 'full',
  'outer', 'cross', 'on', 'using', 'as', 'and', 'or', 'not', 'in', 'is',
  'null', 'true', 'false', 'case', 'when', 'then', 'else', 'end', 'with',
  'recursive', 'distinct', 'all', 'any', 'between', 'exists', 'like', 'ilike',
  'create', 'table', 'insert', 'update', 'delete', 'drop', 'alter', 'into',
  'values', 'set', 'primary', 'key', 'foreign', 'references', 'if', 'cascade',
  'restrict', 'check', 'unique', 'index', 'view', 'by', 'asc', 'desc', 'cast',
  'column', 'constraint', 'default',
  // Additional reserved words (L-14)
  'over', 'partition', 'window', 'rows', 'range', 'groups', 'filter', 'sample',
  'describe', 'show', 'explain', 'vacuum', 'analyze', 'truncate', 'trigger',
  'procedure', 'function', 'returns', 'replace', 'add', 'collate', 'schema',
  'database', 'user', 'role', 'grant', 'revoke', 'commit', 'rollback',
  'transaction', 'begin', 'savepoint', 'current_date', 'current_time',
  'current_timestamp', 'current_user', 'session_user', 'system_user', 'some',
  'natural', 'lateral', 'exclude', 'following', 'preceding', 'unbounded',
  'ties', 'peer', 'nulls', 'first', 'last', 'row', 'array', 'struct', 'map',
  'interval', 'fetch', 'only', 'both', 'leading', 'trailing', 'similar',
  'collation'
]);

export function substituteTable(sql: string, tableName: string | undefined): string {
  if (!tableName) return sql;
  const needsQuoting =
    !/^[A-Za-z_][A-Za-z0-9_]*$/.test(tableName) ||
    SQL_RESERVED_WORDS.has(tableName.toLowerCase());
  if (needsQuoting) {
    const quoted = `"${tableName.replace(/"/g, '""')}"`;
    return sql.replace(/<table>/g, quoted);
  }
  return sql.replace(/<table>/g, tableName);
}
