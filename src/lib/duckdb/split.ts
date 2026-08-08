/**
 * Split a SQL string into individual statements, respecting SQL syntax:
 * - Single-quoted strings with '' escape (SQL standard)
 * - Double-quoted identifiers
 * - Line comments (-- to EOL)
 * - Block comments (/* ... *​/)
 * - Dollar-quoted strings ($$...$$ or $tag$...$tag$) — DuckDB/PostgreSQL
 *
 * Semicolons inside any of the above are NOT statement boundaries.
 * Empty/whitespace-only chunks are dropped.
 */
export function splitStatements(sql: string): string[] {
  const stmts: string[] = [];
  let buf = '';
  let i = 0;
  const n = sql.length;

  let inSingle = false;
  let inDouble = false;
  let inLineComment = false;
  let blockCommentDepth = 0;
  let inDollar = false;
  let dollarTag = '';

  while (i < n) {
    const c = sql[i] as string;
    const next = i + 1 < n ? (sql[i + 1] as string) : '';

    if (inLineComment) {
      buf += c;
      if (c === '\n') inLineComment = false;
      i++;
      continue;
    }

    if (blockCommentDepth > 0) {
      if (c === '/' && next === '*') {
        buf += '/*';
        i += 2;
        blockCommentDepth++;
        continue;
      }
      if (c === '*' && next === '/') {
        buf += '*/';
        i += 2;
        blockCommentDepth--;
        continue;
      }
      buf += c;
      i++;
      continue;
    }

    if (inDollar) {
      if (c === '$' && sql.startsWith(dollarTag, i)) {
        buf += dollarTag;
        i += dollarTag.length;
        inDollar = false;
        dollarTag = '';
        continue;
      }
      buf += c;
      i++;
      continue;
    }

    if (inSingle) {
      buf += c;
      if (c === "'" && next === "'") {
        buf += next;
        i += 2;
        continue;
      }
      if (c === "'") inSingle = false;
      i++;
      continue;
    }

    if (inDouble) {
      if (c === '"' && next === '"') {
        buf += '""';
        i += 2;
        continue;
      }
      if (c === '"') inDouble = false;
      buf += c;
      i++;
      continue;
    }

    // Normal mode
    if (c === '-' && next === '-') {
      inLineComment = true;
      buf += '--';
      i += 2;
      continue;
    }

    if (c === '/' && next === '*') {
      blockCommentDepth = 1;
      buf += '/*';
      i += 2;
      continue;
    }

    if (c === "'") {
      inSingle = true;
      buf += c;
      i++;
      continue;
    }

    if (c === '"') {
      inDouble = true;
      buf += c;
      i++;
      continue;
    }

    if (c === '$') {
      const m = sql.slice(i).match(/^(\$([A-Za-z_][A-Za-z0-9_]*)?\$)/);
      if (m) {
        inDollar = true;
        dollarTag = m[1] as string;
        buf += dollarTag;
        i += dollarTag.length;
        continue;
      }
    }

    if (c === ';') {
      const trimmed = buf.trim();
      if (trimmed) stmts.push(trimmed);
      buf = '';
      i++;
      continue;
    }

    buf += c;
    i++;
  }

  const trimmed = buf.trim();
  if (trimmed) stmts.push(trimmed);

  return stmts;
}
