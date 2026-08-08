import { useEffect, useMemo, useRef, useState } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import type { QueryResult } from '../../lib/duckdb/types';
import { Icon } from '../ui/Icon';

interface ChartViewProps {
  result: QueryResult;
  maxRows?: number;
}

const NEON_STROKE = [
  '#00f0ff',
  '#ff2e9a',
  '#00ff88',
  '#ffb800',
  '#b040ff',
  '#ff6b35',
  '#4dc3ff',
  '#ff85a1',
] as const;

const HEIGHT = 280;

function isNumeric(typeName: string): boolean {
  const t = typeName.toUpperCase();
  return /INT|DOUBLE|FLOAT|DECIMAL|NUMERIC|REAL/.test(t);
}

export function ChartView({ result, maxRows = 1000 }: ChartViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');

  const xCol = result.columns[0];
  const numericCols = useMemo(
    () => result.columns.filter((col, i) => i !== 0 && isNumeric(result.columnTypes[i])),
    [result],
  );

  const truncated = result.rowCount > maxRows;
  const rows = useMemo(
    () => (truncated ? result.rows.slice(0, maxRows) : result.rows),
    [result.rows, truncated, maxRows],
  );

  useEffect(() => {
    if (!containerRef.current) return;
    if (numericCols.length === 0) return;

    const xValues = rows.map((r) => {
      const v = r[xCol];
      if (v === null || v === undefined) return '';
      if (typeof v === 'number') return v;
      return String(v);
    });

    const data: uPlot.AlignedData = [
      xValues as uPlot.AlignedData[0],
      ...numericCols.map((c) => rows.map((r) => {
        const v = r[c];
        if (v === null || v === undefined) return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      })),
    ];

    const showPoints = rows.length <= 50;
    const seriesCount = numericCols.length;

    const opts: uPlot.Options = {
      width: containerRef.current.clientWidth,
      height: HEIGHT,
      cursor: {
        drag: { x: true, y: false },
        focus: { prox: 16 },
      },
      legend: { show: seriesCount > 0 },
      scales: { x: { time: false } },
      axes: [
        {
          stroke: '#6a6a80',
          grid: { stroke: 'rgba(255,255,255,0.05)', width: 1 },
          ticks: { stroke: '#3a3a4a', width: 1 },
          font: '11px JetBrains Mono, monospace',
        },
        {
          stroke: '#6a6a80',
          grid: { stroke: 'rgba(255,255,255,0.05)', width: 1 },
          ticks: { stroke: '#3a3a4a', width: 1 },
          font: '11px JetBrains Mono, monospace',
          size: 60,
        },
      ],
      series: [
        { label: xCol },
        ...numericCols.map((c, i) => {
          const stroke = NEON_STROKE[i % NEON_STROKE.length];
          const barsBuilder = uPlot.paths?.bars;
          if (chartType === 'bar' && barsBuilder) {
            return {
              label: c,
              stroke,
              fill: `${stroke}33`,
              width: 1,
              paths: barsBuilder({ size: [0.7, 100, 1] }),
              points: { show: false },
            };
          }
          return {
            label: c,
            stroke,
            width: 1.5,
            points: { show: showPoints, size: 5, stroke, fill: '#0a0a0f' },
          };
        }),
      ],

    };

    plotRef.current = new uPlot(opts, data, containerRef.current);

    const ro = new ResizeObserver(() => {
      if (plotRef.current && containerRef.current) {
        plotRef.current.setSize({ width: containerRef.current.clientWidth, height: HEIGHT });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      plotRef.current?.destroy();
      plotRef.current = null;
    };
  }, [rows, numericCols, xCol, chartType]);

  if (numericCols.length === 0) {
    return (
      <div className="border-t border-border-subtle px-4 py-4 text-xs mono text-text-tertiary flex items-center gap-1.5">
        <Icon name="chart" size={12} />
        No numeric columns to chart
      </div>
    );
  }

  return (
    <div className="border-t border-border-subtle px-4 py-3 bg-bg-0/30">
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <div className="flex items-center gap-2 text-text-tertiary">
          <Icon name="chart" size={12} className="text-accent-brand" />
          <span className="text-[10px] mono uppercase tracking-wider">
            Chart · {numericCols.length} series · {rows.length.toLocaleString()}{' '}
            {rows.length === 1 ? 'point' : 'points'}
          </span>
          {truncated && (
            <span className="text-[10px] mono text-accent-warn">
              (first {maxRows.toLocaleString()} of {result.rowCount.toLocaleString()})
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5 bg-bg-1 border border-border-subtle rounded-md p-0.5">
          <button
            type="button"
            onClick={() => setChartType('line')}
            className={`px-2 py-0.5 text-[10px] mono rounded ${
              chartType === 'line'
                ? 'bg-accent-brand/15 text-accent-brand'
                : 'text-text-tertiary hover:text-text-primary'
            }`}
          >
            Line
          </button>
          <button
            type="button"
            onClick={() => setChartType('bar')}
            className={`px-2 py-0.5 text-[10px] mono rounded ${
              chartType === 'bar'
                ? 'bg-accent-brand/15 text-accent-brand'
                : 'text-text-tertiary hover:text-text-primary'
            }`}
          >
            Bar
          </button>
        </div>
      </div>
      <div ref={containerRef} className="w-full" style={{ minHeight: `${HEIGHT}px` }} />
    </div>
  );
}
