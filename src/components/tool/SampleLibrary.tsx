/**
 * SampleLibrary — empty-state grid that lets users one-click load a curated
 * sample file (CSV/JSON/NDJSON). Fetches the file, wraps it in a `File`
 * object, and passes it to the existing onFile handler — reuses the full
 * file-load pipeline (Excel picker, GeoJSON conversion, etc.).
 */

import { useCallback, useMemo, useState } from 'react';
import { SAMPLES, type Sample } from '../../lib/samples';
import { Icon } from '../ui/Icon';
import { formatBytes } from '../../lib/format';

interface SampleLibraryProps {
  onFile: (file: File) => void | Promise<void>;
  disabled?: boolean;
  disabledReason?: string;
}

export function SampleLibrary({ onFile, disabled, disabledReason }: SampleLibraryProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalSize = useMemo(
    () => formatBytes(SAMPLES.reduce((sum, s) => sum + s.sizeBytes, 0)),
    [],
  );

  const loadSample = useCallback(
    async (sample: Sample) => {
      if (loading) return;
      setError(null);
      setLoading(sample.id);
      try {
        const res = await fetch(`/samples/${sample.filename}`);
        if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${sample.filename}`);
        const blob = await res.blob();
        const file = new File([blob], sample.filename, {
          type: blob.type || 'text/csv',
        });
        await onFile(file);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(null);
      }
    },
    [loading, onFile],
  );

  return (
    <div className="border border-border-subtle rounded-lg p-4 bg-bg-0">
      <div className="flex items-center justify-between mb-3 gap-2">
        <h3 className="text-sm font-semibold text-text-primary">Try a sample dataset</h3>
        <p className="text-[10px] mono text-text-tertiary shrink-0">
          {SAMPLES.length} files · {totalSize}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {SAMPLES.map((s) => (
          <SampleTile
            key={s.id}
            sample={s}
            loading={loading === s.id}
            disabled={disabled || loading !== null}
            onClick={() => void loadSample(s)}
          />
        ))}
      </div>
      {error && (
        <p className="text-[10px] mono text-accent-danger mt-2 border border-accent-danger/30 rounded p-2 bg-accent-danger/5">
          {error}
        </p>
      )}
      {disabled && disabledReason && (
        <p className="text-[10px] mono text-text-tertiary mt-2">{disabledReason}</p>
      )}
    </div>
  );
}

function SampleTile({
  sample,
  loading,
  disabled,
  onClick,
}: {
  sample: Sample;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'text-left p-3 rounded border border-border-subtle bg-bg-2',
        'hover:border-accent-brand hover:bg-bg-3 transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon name="file" size={12} className="text-accent-brand shrink-0" />
          <span className="text-xs mono font-semibold text-text-primary truncate">
            {sample.name}
          </span>
        </div>
        <span className="text-[10px] mono text-text-tertiary shrink-0">
          {formatBytes(sample.sizeBytes)}
        </span>
      </div>
      <p className="text-[10px] mono text-text-tertiary mb-1.5">{sample.description}</p>
      <p className="text-[10px] mono text-accent-brand/80 truncate" title={sample.queryHint}>
        {sample.queryHint}
      </p>
      {loading && (
        <p className="text-[10px] mono text-accent-brand mt-1">Loading…</p>
      )}
    </button>
  );
}
