/**
 * GeoJSON → NDJSON helper for DuckDB-WASM ingestion.
 *
 * DuckDB-WASM can read JSON/NDJSON natively, but not GeoJSON. When the user
 * drops a `.geojson` file we flatten the `features` array into one
 * newline-delimited JSON (NDJSON) row per feature. Each row becomes a record
 * with the top-level GeoJSON properties plus a `geometry` key, making the
 * result queryable with standard DuckDB SQL.
 */

/**
 * Convert a GeoJSON file to an NDJSON `File`, suitable for registration
 * with DuckDB as `format: 'ndjson'`.
 */
export async function geojsonToNdjson(file: File): Promise<File> {
  let text: string | null = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Could not parse GeoJSON: file is not valid JSON`);
  }
  text = null; // free memory reference

  const features = extractFeatures(parsed);
  if (!Array.isArray(features)) {
    throw new Error(`Could not extract features: expected a GeoJSON FeatureCollection or Feature`);
  }

  const parts: string[] = [];
  for (const feat of features) {
    parts.push(JSON.stringify({
      ...((feat as { properties?: Record<string, unknown> }).properties ?? {}),
      _geojson_id: (feat as { id?: string | number }).id,
      _geojson_geometry: (feat as { geometry?: unknown }).geometry,
      _geojson_type: (feat as { type?: string }).type || 'Feature',
    }));
    parts.push('\n');
  }

  const baseName = file.name.replace(/\.[^.]+$/, '');
  return new File(parts, `${baseName}.jsonl`, { type: 'application/x-ndjson' });
}

function extractFeatures(parsed: unknown): unknown[] | null {
  if (typeof parsed !== 'object' || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;

  if (obj.type === 'FeatureCollection' && Array.isArray(obj.features)) {
    return obj.features;
  }
  if (obj.type === 'Feature') {
    return [obj];
  }
  return null;
}
