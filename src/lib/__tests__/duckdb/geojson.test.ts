/**
 * GeoJSON → NDJSON flattening.
 * Covers FeatureCollection, single Feature, and the "invalid" branches.
 */
import { describe, it, expect } from 'vitest';
import { geojsonToNdjson } from '../../duckdb/geojson';

describe('geojsonToNdjson', () => {
  it('flattens a FeatureCollection into NDJSON', async () => {
    const fc = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', id: 1, properties: { name: 'A', value: 10 }, geometry: { type: 'Point', coordinates: [0, 0] } },
        { type: 'Feature', id: 2, properties: { name: 'B', value: 20 }, geometry: { type: 'Point', coordinates: [1, 1] } },
      ],
    };
    const file = new File([JSON.stringify(fc)], 'test.geojson', { type: 'application/geo+json' });
    const out = await geojsonToNdjson(file);
    expect(out.name).toBe('test.jsonl');
    const text = await out.text();
    const lines = text.trim().split('\n');
    expect(lines).toHaveLength(2);
    const first = JSON.parse(lines[0]!);
    expect(first.name).toBe('A');
    expect(first.value).toBe(10);
    expect(first._geojson_geometry).toEqual({ type: 'Point', coordinates: [0, 0] });
    expect(first._geojson_type).toBe('Feature');
    expect(first._geojson_id).toBe(1);
  });

  it('wraps a single Feature into a one-row NDJSON', async () => {
    const feat = {
      type: 'Feature',
      id: 'x',
      properties: { foo: 'bar' },
      geometry: null,
    };
    const file = new File([JSON.stringify(feat)], 'one.geojson', { type: 'application/geo+json' });
    const out = await geojsonToNdjson(file);
    const text = await out.text();
    const lines = text.trim().split('\n');
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!).foo).toBe('bar');
  });

  it('throws on invalid JSON', async () => {
    const file = new File(['not json'], 'bad.geojson', { type: 'application/geo+json' });
    await expect(geojsonToNdjson(file)).rejects.toThrow(/Could not parse GeoJSON/);
  });

  it('throws on valid JSON that is not GeoJSON', async () => {
    const file = new File([JSON.stringify({ type: 'NotGeoJSON' })], 'bad.geojson', {
      type: 'application/geo+json',
    });
    await expect(geojsonToNdjson(file)).rejects.toThrow(/Could not extract features/);
  });

  it('handles empty FeatureCollection', async () => {
    const file = new File([JSON.stringify({ type: 'FeatureCollection', features: [] })], 'empty.geojson', {
      type: 'application/geo+json',
    });
    const out = await geojsonToNdjson(file);
    const text = await out.text();
    expect(text).toBe('');
  });
});
