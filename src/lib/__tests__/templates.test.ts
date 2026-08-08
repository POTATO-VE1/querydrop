/**
 * SQL templates — substitute <table> with the active table name.
 * Must:
 *  - leave SQL unchanged if no table provided
 *  - quote the table name if it's not a safe SQL identifier
 *  - leave <col> and other placeholders intact
 *  - replace ALL occurrences of <table>
 */
import { describe, it, expect } from 'vitest';
import { TEMPLATES, TEMPLATE_CATEGORIES, substituteTable } from '../templates';

describe('substituteTable', () => {
  it('returns SQL unchanged when no tableName given', () => {
    expect(substituteTable('SELECT * FROM <table>', undefined)).toBe('SELECT * FROM <table>');
  });

  it('replaces <table> with a simple identifier (no quoting)', () => {
    expect(substituteTable('SELECT * FROM <table> LIMIT 10', 'iris')).toBe(
      'SELECT * FROM "iris" LIMIT 10'.replace('"iris"', 'iris'),
    );
    const out = substituteTable('SELECT * FROM <table> LIMIT 10', 'iris');
    expect(out).toBe('SELECT * FROM iris LIMIT 10');
  });

  it('quotes table names with spaces, dashes, or reserved words', () => {
    expect(substituteTable('SELECT * FROM <table>', 'my table')).toBe('SELECT * FROM "my table"');
    expect(substituteTable('SELECT * FROM <table>', 'order-data')).toBe('SELECT * FROM "order-data"');
    expect(substituteTable('SELECT * FROM <table>', 'select')).toBe('SELECT * FROM "select"');
  });

  it('escapes embedded double-quotes in quoted mode', () => {
    expect(substituteTable('SELECT * FROM <table>', 'weird"name')).toBe('SELECT * FROM "weird""name"');
  });

  it('replaces ALL occurrences of <table>', () => {
    const out = substituteTable('SELECT * FROM <table> UNION ALL SELECT * FROM <table>', 't');
    expect(out).toBe('SELECT * FROM t UNION ALL SELECT * FROM t');
  });

  it('leaves <col> and other placeholders intact', () => {
    const out = substituteTable('SELECT <col>, COUNT(*) FROM <table> GROUP BY <col>', 't');
    expect(out).toBe('SELECT <col>, COUNT(*) FROM t GROUP BY <col>');
  });

  it('rejects table names starting with a digit (must be quoted)', () => {
    // 123abc is not a safe identifier (starts with digit) — must be quoted
    const out = substituteTable('SELECT * FROM <table>', '123abc');
    expect(out).toBe('SELECT * FROM "123abc"');
  });
});

describe('TEMPLATES catalog', () => {
  it('has at least one template in every category', () => {
    for (const cat of TEMPLATE_CATEGORIES) {
      const has = TEMPLATES.some((t) => t.category === cat);
      expect(has, `category ${cat} should have at least one template`).toBe(true);
    }
  });

  it('every template has a unique id', () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every template has all required fields populated', () => {
    for (const t of TEMPLATES) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.sql).toBeTruthy();
      expect(TEMPLATE_CATEGORIES).toContain(t.category);
    }
  });
});
