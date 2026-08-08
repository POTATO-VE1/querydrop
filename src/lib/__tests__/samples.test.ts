/**
 * Sample library manifest.
 */
import { describe, it, expect } from 'vitest';
import { SAMPLES, getSampleByFilename } from '../samples';

describe('SAMPLES catalog', () => {
  it('has at least 3 samples', () => {
    expect(SAMPLES.length).toBeGreaterThanOrEqual(3);
  });

  it('every sample has a unique id', () => {
    const ids = SAMPLES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every sample has a unique filename', () => {
    const filenames = SAMPLES.map((s) => s.filename);
    expect(new Set(filenames).size).toBe(filenames.length);
  });

  it('every sample has all fields populated', () => {
    for (const s of SAMPLES) {
      expect(s.id).toBeTruthy();
      expect(s.name).toBeTruthy();
      expect(s.description).toBeTruthy();
      expect(s.filename).toBeTruthy();
      expect(s.sizeBytes).toBeGreaterThan(0);
      expect(['csv', 'tsv', 'json', 'ndjson', 'excel', 'parquet', 'feather', 'arrow', 'geojson']).toContain(s.format);
      expect(s.queryHint).toBeTruthy();
    }
  });
});

describe('getSampleByFilename', () => {
  it('finds a sample by filename', () => {
    const s = getSampleByFilename('iris.csv');
    expect(s?.id).toBe('iris');
  });

  it('returns undefined for unknown filename', () => {
    expect(getSampleByFilename('does-not-exist.csv')).toBeUndefined();
  });
});
