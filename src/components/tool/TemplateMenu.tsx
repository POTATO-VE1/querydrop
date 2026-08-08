/**
 * TemplateMenu — dropdown button rendered above SqlEditor.
 * Click → categorized list of curated SQL templates → onInsert(sql) at cursor.
 * Resolves `<table>` placeholder at click time to the active file's table name.
 */

import { useEffect, useRef, useState } from 'react';
import {
  TEMPLATES,
  TEMPLATE_CATEGORIES,
  substituteTable,
  type Template,
} from '../../lib/templates';
import { Icon } from '../ui/Icon';

interface TemplateMenuProps {
  activeTable: string | undefined;
  onInsert: (sql: string) => void;
}

export function TemplateMenu({ activeTable, onInsert }: TemplateMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        const first = containerRef.current?.querySelector('[role="menuitem"]') as HTMLElement | null;
        first?.focus();
      }, 50);
    }
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    const menuEl = containerRef.current?.querySelector('#template-menu');
    if (!menuEl) return;
    const items = Array.from(menuEl.querySelectorAll('[role="menuitem"]')) as HTMLElement[];
    if (items.length === 0) return;
    const activeIndex = items.indexOf(document.activeElement as HTMLElement);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = (activeIndex + 1) % items.length;
      items[nextIndex]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = (activeIndex - 1 + items.length) % items.length;
      items[prevIndex]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1]?.focus();
    }
  };

  const handleClick = (t: Template) => {
    onInsert(substituteTable(t.sql, activeTable));
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={[
          'px-2.5 py-1 rounded text-[11px] mono font-semibold border transition-colors',
          'border-border-subtle bg-bg-2 text-text-secondary',
          'hover:text-accent-brand hover:border-accent-brand',
          open ? 'text-accent-brand border-accent-brand' : '',
        ].join(' ')}
        title="Insert a query template"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls="template-menu"
      >
        <Icon name="template" size={11} className="inline mr-1 -mt-0.5" />
        Templates
        <Icon name="chevron-down" size={10} className="inline ml-1 -mt-0.5" />
      </button>
      {open && (
        <div
          id="template-menu"
          role="menu"
          onKeyDown={handleKeyDown}
          className="absolute right-0 top-full mt-1 z-50 w-80 max-h-[28rem] overflow-y-auto rounded-md border border-border-subtle bg-bg-0 "
        >
          {TEMPLATE_CATEGORIES.map((cat) => {
            const items = TEMPLATES.filter((t) => t.category === cat);
            if (items.length === 0) return null;
            return (
              <div key={cat} className="border-b border-border-subtle last:border-b-0">
                <div className="px-3 py-1.5 text-[10px] mono uppercase tracking-wider text-text-tertiary bg-bg-1 sticky top-0">
                  {cat}
                </div>
                {items.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="menuitem"
                    onClick={() => handleClick(t)}
                    className="w-full text-left px-3 py-2 hover:bg-bg-2 border-l-2 border-transparent hover:border-accent-brand transition-colors"
                  >
                    <div className="text-xs mono font-semibold text-text-primary">{t.name}</div>
                    <div className="text-[10px] mono text-text-tertiary mt-0.5 leading-snug">
                      {t.description}
                    </div>
                  </button>
                ))}
              </div>
            );
          })}
          <div className="px-3 py-1.5 text-[10px] mono text-text-tertiary border-t border-border-subtle bg-bg-1">
            {activeTable ? (
              <>
                Active table: <span className="text-accent-brand">{activeTable}</span>
              </>
            ) : (
              'No active table — load a file first; placeholders stay in SQL'
            )}
          </div>
        </div>
      )}
    </div>
  );
}
