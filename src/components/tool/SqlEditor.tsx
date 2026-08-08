/**
 * SqlEditor — CodeMirror 6 React wrapper.
 * Terminal-style theme, PostgreSQL dialect (closest to DuckDB), schema-aware autocomplete
 * (tables, table.column pairs, bare columns with type info), Cmd/Ctrl+Enter to run.
 */

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { Compartment, EditorState, Prec } from '@codemirror/state';
import type { Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection, dropCursor, placeholder } from '@codemirror/view';
import type { ViewUpdate } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { PostgreSQL, sql } from '@codemirror/lang-sql';
import { HighlightStyle, syntaxHighlighting, indentOnInput, bracketMatching, foldGutter, foldKeymap } from '@codemirror/language';
import { autocompletion, completionKeymap } from '@codemirror/autocomplete';
import type { Completion, CompletionContext, CompletionSource } from '@codemirror/autocomplete';
import { tags as t } from '@lezer/highlight';

const TERMINAL_HIGHLIGHT = HighlightStyle.define([
  { tag: t.keyword, color: '#4a9eff', fontWeight: '600' },
  { tag: [t.string, t.special(t.string)], color: '#4ade80' },
  { tag: t.number, color: '#fbbf24' },
  { tag: t.bool, color: '#fbbf24' },
  { tag: t.null, color: '#fbbf24' },
  { tag: t.comment, color: '#6b6b7a', fontStyle: 'italic' },
  { tag: t.variableName, color: '#e8e8ec' },
  { tag: [t.standard(t.variableName), t.self], color: '#4a9eff' },
  { tag: t.typeName, color: '#4a9eff' },
  { tag: t.propertyName, color: '#e8e8ec' },
  { tag: t.operator, color: '#a0a0ad' },
  { tag: t.bracket, color: '#a0a0ad' },
  { tag: t.punctuation, color: '#a0a0ad' },
  { tag: t.invalid, color: '#f87171' },
]);

const TERMINAL_THEME: Extension = EditorView.theme(
  {
    '&': {
      fontSize: '16px',
      fontFamily:
        '"JetBrains Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
      backgroundColor: '#0d0d11',
      color: '#e8e8ec',
      height: '100%',
    },
    '@media (min-width: 640px)': {
      '&': { fontSize: '13px' },
    },
    '.cm-scroller': { fontFamily: 'inherit' },
    '.cm-content': { caretColor: '#4a9eff', padding: '12px 0' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#4a9eff', borderLeftWidth: '2px' },
    '.cm-activeLine': { backgroundColor: 'rgba(74, 158, 255, 0.06)' },
    '.cm-activeLineGutter': { backgroundColor: 'rgba(74, 158, 255, 0.06)', color: '#a0a0ad' },
    '.cm-gutters': {
      backgroundColor: '#0d0d11',
      border: 'none',
      borderRight: '1px solid #2a2a35',
      color: '#6b6b7a',
    },
    '.cm-selectionBackground, ::selection': { backgroundColor: 'rgba(232, 232, 236, 0.18) !important' },
    '.cm-tooltip-autocomplete': {
      border: '1px solid #2a2a35',
      borderRadius: '0',
      backgroundColor: '#1c1c25',
    },
    '.cm-tooltip-autocomplete > ul > li': { padding: '4px 8px' },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
      backgroundColor: '#25252f',
      color: '#e8e8ec',
    },
    '.cm-placeholder': { color: '#6b6b7a' },
    '&.cm-focused': { outline: 'none' },
  },
  { dark: true },
);

function tableNameCompletion(tables: string[], tableColumns: TableColumns[]): CompletionSource {
  return (context: CompletionContext) => {
    const word = context.matchBefore(/[\w.]*/);
    if (!word || (word.from === word.to && !context.explicit)) return null;
    if (!tables.length && !tableColumns.length) return null;

    const options: Completion[] = [];
    const seenBare = new Set<string>();

    for (const t of tables) {
      options.push({ label: t, type: 'class', boost: 3 });
    }

    for (const tc of tableColumns) {
      for (const col of tc.columns) {
        options.push({
          label: `${tc.tableName}.${col.name}`,
          type: 'property',
          detail: col.type,
          boost: 1.5,
        });
      }
    }

    for (const tc of tableColumns) {
      for (const col of tc.columns) {
        if (tables.includes(col.name) || seenBare.has(col.name)) continue;
        seenBare.add(col.name);
        options.push({
          label: col.name,
          type: 'property',
          detail: `${col.type} · ${tc.tableName}`,
          boost: 1,
        });
      }
    }

    return { from: word.from, options };
  };
}

export interface TableColumns {
  tableName: string;
  columns: Array<{ name: string; type: string }>;
}

interface SqlEditorProps {
  value: string;
  onChange: (val: string) => void;
  onRun: () => void;
  tables: string[];
  tableColumns?: TableColumns[];
  placeholderText?: string;
  minHeight?: string;
}

export interface SqlEditorHandle {
  insertText: (text: string) => void;
  setValue?: (val: string) => void;
}

export const SqlEditor = forwardRef<SqlEditorHandle, SqlEditorProps>(function SqlEditor(
  { value, onChange, onRun, tables, tableColumns = [], placeholderText, minHeight = '120px' },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onRunRef = useRef(onRun);
  const onChangeRef = useRef(onChange);
  const tableCompartment = useMemo(() => new Compartment(), []);

  useEffect(() => {
    onRunRef.current = onRun;
  }, [onRun]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        history(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        bracketMatching(),
        foldGutter(),
        sql({ dialect: PostgreSQL, upperCaseKeywords: true }),
        syntaxHighlighting(TERMINAL_HIGHLIGHT),
        autocompletion(),
        EditorView.lineWrapping,
        placeholder(placeholderText ?? 'SELECT * FROM your_table LIMIT 100'),
        Prec.highest(
          keymap.of([
            {
              key: 'Mod-Enter',
              run: () => {
                onRunRef.current();
                return true;
              },
            },
          ]),
        ),
        keymap.of([...defaultKeymap, ...historyKeymap, ...completionKeymap, ...foldKeymap, indentWithTab]),
        TERMINAL_THEME,
        tableCompartment.of(PostgreSQL.language.data.of({ autocomplete: tableNameCompletion(tables, tableColumns) })),
        EditorView.updateListener.of((u: ViewUpdate) => {
          if (u.docChanged) onChangeRef.current(u.state.doc.toString());
        }),
      ],
    });

    const view = new EditorView({ state, parent: container });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: tableCompartment.reconfigure(PostgreSQL.language.data.of({ autocomplete: tableNameCompletion(tables, tableColumns) })) });
  }, [tables, tableColumns, tableCompartment]);

  useImperativeHandle(
    ref,
    () => ({
      insertText: (text: string) => {
        const view = viewRef.current;
        if (!view) return;
        const sel = view.state.selection.main;
        const from = sel.from;
        const to = sel.to;
        const docLen = view.state.doc.length;
        const insertAt = Math.min(from, docLen);
        const replaceTo = Math.min(to, docLen);
        const needsNewlineBefore = insertAt > 0 && view.state.doc.sliceString(insertAt - 1, insertAt) !== '\n';
        const prefix = needsNewlineBefore ? '\n' : '';
        const fullText = prefix + text;
        view.dispatch({
          changes: { from: insertAt, to: replaceTo, insert: fullText },
          selection: { anchor: insertAt + fullText.length },
        });
        view.focus();
      },
      setValue: (val: string) => {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: val }
        });
      },
    }),
    [],
  );

  return (
    <div
      ref={containerRef}
      className="h-full overflow-hidden rounded-md border border-border-subtle bg-bg-0"
      style={{ minHeight }}
    />
  );
});
