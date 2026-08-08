/**
 * Formatting and display utilities.
 */

/**
 * Format bytes to a human-readable string (B, KB, MB, GB).
 */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Prettify and format SQL statements.
 */
export function formatSQL(sql: string): string {
  let formatted = '';
  let indent = 0;
  let parenDepth = 0;
  const n = sql.length;
  let i = 0;

  const newlineKeywords = new Set([
    'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET',
    'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN', 'JOIN', 'UNION',
    'VALUES', 'SET'
  ]);
  const keywords = new Set([
    'SELECT', 'DISTINCT', 'AS', 'AND', 'OR', 'IN', 'IS', 'NULL', 'NOT',
    'CREATE', 'TABLE', 'TEMP', 'INSERT', 'INTO', 'UPDATE', 'DELETE', 'ON',
    ...newlineKeywords
  ]);

  while (i < n) {
    const c = sql[i] as string;

    if (c === '-' && i + 1 < n && sql[i + 1] === '-') {
      let line = '';
      while (i < n && sql[i] !== '\n') {
        line += sql[i];
        i++;
      }
      formatted += line.trimEnd() + '\n' + '  '.repeat(indent);
      continue;
    }

    if (c === '/' && i + 1 < n && sql[i + 1] === '*') {
      let block = '';
      let depth = 1;
      block += '/*';
      i += 2;
      while (i < n && depth > 0) {
        if (sql[i] === '/' && i + 1 < n && sql[i + 1] === '*') {
          block += '/*';
          i += 2;
          depth++;
        } else if (sql[i] === '*' && i + 1 < n && sql[i + 1] === '/') {
          block += '*/';
          i += 2;
          depth--;
        } else {
          block += sql[i];
          i++;
        }
      }
      formatted += block.trim() + ' ';
      continue;
    }

    if (c === "'") {
      let str = "'";
      i++;
      while (i < n) {
        if (sql[i] === "'" && i + 1 < n && sql[i + 1] === "'") {
          str += "''";
          i += 2;
        } else if (sql[i] === "'") {
          str += "'";
          i++;
          break;
        } else {
          str += sql[i];
          i++;
        }
      }
      formatted += str + ' ';
      continue;
    }

    if (c === '"') {
      let ident = '"';
      i++;
      while (i < n) {
        if (sql[i] === '"' && i + 1 < n && sql[i + 1] === '"') {
          ident += '""';
          i += 2;
        } else if (sql[i] === '"') {
          ident += '"';
          i++;
          break;
        } else {
          ident += sql[i];
          i++;
        }
      }
      formatted += ident + ' ';
      continue;
    }

    if (/\s/.test(c)) {
      i++;
      continue;
    }

    if (c === '(') {
      parenDepth++;
      formatted = formatted.trimEnd() + '( ';
      i++;
      continue;
    }

    if (c === ')') {
      parenDepth = Math.max(0, parenDepth - 1);
      formatted = formatted.trimEnd() + ' ) ';
      i++;
      continue;
    }

    if (['=', '<', '>', '!'].includes(c)) {
      let op = c;
      i++;
      if (i < n && sql[i] === '=') {
        op += '=';
        i++;
      }
      formatted = formatted.trimEnd() + ' ' + op + ' ';
      continue;
    }

    if (c === ',') {
      if (parenDepth === 0) {
        formatted = formatted.trimEnd() + ',\n' + '  '.repeat(indent + 1);
      } else {
        formatted = formatted.trimEnd() + ', ';
      }
      i++;
      continue;
    }

    if (c === ';') {
      formatted = formatted.trimEnd() + ';\n\n';
      i++;
      continue;
    }

    if (/[a-zA-Z_]/.test(c)) {
      let word = '';
      while (i < n && /[a-zA-Z0-9_]/.test(sql[i] as string)) {
        word += sql[i];
        i++;
      }

      const nextWord = () => {
        let j = i;
        while (j < n && /\s/.test(sql[j] as string)) j++;
        let w = '';
        while (j < n && /[a-zA-Z0-9_]/.test(sql[j] as string)) {
          w += sql[j];
          j++;
        }
        return { w, end: j };
      };

      const checkDoubleWord = (first: string, second: string) => {
        if (word.toUpperCase() === first) {
          const next = nextWord();
          if (next.w.toUpperCase() === second) {
            word = first + ' ' + second;
            i = next.end;
            return true;
          }
        }
        return false;
      };

      checkDoubleWord('GROUP', 'BY') ||
      checkDoubleWord('ORDER', 'BY') ||
      checkDoubleWord('LEFT', 'JOIN') ||
      checkDoubleWord('RIGHT', 'JOIN') ||
      checkDoubleWord('INNER', 'JOIN') ||
      checkDoubleWord('OUTER', 'JOIN') ||
      checkDoubleWord('INSERT', 'INTO') ||
      checkDoubleWord('DELETE', 'FROM') ||
      checkDoubleWord('CREATE', 'TABLE') ||
      checkDoubleWord('CREATE', 'TEMP');

      const upper = word.toUpperCase();
      if (keywords.has(upper)) {
        if (newlineKeywords.has(upper)) {
          formatted = formatted.trimEnd() + '\n' + '  '.repeat(indent) + upper + ' ';
        } else if (upper === 'SELECT') {
          formatted = formatted.trimEnd() + (formatted ? '\n\n' : '') + '  '.repeat(indent) + upper + '\n' + '  '.repeat(indent + 1);
        } else {
          formatted += upper + ' ';
        }
      } else {
        formatted += word + ' ';
      }
      continue;
    }

    formatted += c;
    i++;
  }

  // Final cleanup and formatting replacements
  return formatted.trim().replace(/\n\s+\n/g, '\n') + '\n';
}

/**
 * Dispatch a custom event to show a toast notification.
 */
export function toast(message: string, type: 'success' | 'info' | 'error' = 'success') {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('querydrop:toast', { detail: { message, type } }));
  }
}
