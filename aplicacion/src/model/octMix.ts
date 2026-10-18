// Port literal del modelo OCT_MIX 1.4.0. No ajusta parámetros ni lee predicciones.
export type PreparedInput = {
  ID_POLIGONO: string; municipio: string; lon: number; lat: number;
  P: number; H: number; K: number | null;
};
export type KnownParcel = {
  ID_POLIGONO: string; municipio: string; lon: number; lat: number; y: number;
};
export type ModelBundle = {
  model: {
    type: string; version: string; recipe: string; known: KnownParcel[];
    J: { variable: 'P' | 'H' | 'DELTA' | 'PCT'; beta: number; mean: number;
      sd: number; group_mean_y: Record<string, number>; group_mean_z: Record<string, number> };
    municipal_means: Record<string, number>; global_y: number; global_z: number;
    correction: { beta: number; median: number; sd: number; n: number };
  };
  inputs: PreparedInput[];
};
export type FactorKey = 'rain' | 'neighbors' | 'crop';
export type Estimate = {
  id: string; yield: number; municipalBase: number;
  j: number; municipal: number; idw20: number; kCorrection: number; mix: number;
  kAvailable: boolean; municipalReferences: number; nearestKnownKm: number;
  rainOctober: number; rainReference: number; rainPct: number;
  contributions: Record<FactorKey, number>;
  neighbors: { id: string; distanceKm: number; weight: number; yield: number }[];
};
export type CalculationStage = 'inputs' | 'rain' | 'neighbors' | 'crop';
export type CalculationStep = { stage: CalculationStage; value: number | null };

function requireOk(ok: boolean, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

export function validateBundle(bundle: ModelBundle) {
  const { model: m, inputs } = bundle;
  requireOk(m.type === 'OCT_MIX_FINAL' && m.version === '1.4.0', 'Modelo incompatible.');
  requireOk(inputs.length === 59 && new Set(inputs.map(x => x.ID_POLIGONO)).size === 59,
    'Registro de parcelas inválido.');
  requireOk(m.known.length === 138 && new Set(m.known.map(x => x.ID_POLIGONO)).size === 138,
    'Referencias de entrenamiento inválidas.');
  const knownIds = new Set(m.known.map(x => x.ID_POLIGONO));
  requireOk(inputs.every(x => !knownIds.has(x.ID_POLIGONO)), 'Entradas mezcladas con entrenamiento.');
  requireOk(m.known.every(x => finite(x.y) && finite(x.lon) && finite(x.lat)
    && Math.abs(x.lon) <= 180 && Math.abs(x.lat) <= 90 && Boolean(x.municipio)),
  'Referencias no finitas.');
  const j = m.J, k = m.correction;
  requireOk(['P', 'H', 'DELTA', 'PCT'].includes(j.variable)
    && [j.beta, j.mean, j.sd, k.beta, k.median, k.sd, m.global_y, m.global_z].every(finite)
    && j.sd > 0 && k.sd > 0, 'Parámetros inválidos.');
}

export function validateInput(bundle: ModelBundle, row: PreparedInput) {
  const m = bundle.model;
  requireOk(!['y', 'truth', 'RENDIMIENTO_T_HA'].some(key => key in row),
    'Las entradas no deben incluir rendimientos conocidos.');
  const canonical = bundle.inputs.find(x => x.ID_POLIGONO === row.ID_POLIGONO);
  requireOk(Boolean(canonical), 'Selecciona una de las59 parcelas oficiales.');
  requireOk(typeof row.ID_POLIGONO === 'string' && typeof row.municipio === 'string'
    && row.municipio.length > 0, 'Identificador inválido.');
  requireOk([row.lon, row.lat, row.P, row.H].every(finite)
    && (row.K === null || finite(row.K)), 'Mediciones inválidas.');
  requireOk(Math.abs(row.lon) <= 180 && Math.abs(row.lat) <= 90 && row.P >= 0
    && row.H > 0 && finite(100 * (row.P - row.H) / row.H), 'Datos fuera del dominio.');
  requireOk(row.municipio === canonical!.municipio
    && Math.max(Math.abs(row.lon - canonical!.lon), Math.abs(row.lat - canonical!.lat)) <= 1e-8,
  'La ubicación no corresponde a esta parcela.');
  requireOk([m.municipal_means[row.municipio], m.J.group_mean_y[row.municipio],
    m.J.group_mean_z[row.municipio]].every(finite), 'Faltan referencias municipales.');
}

export function distanceKm(lon: number, lat: number, rlon: number, rlat: number) {
  const r = Math.PI / 180;
  const a = Math.sin((rlat - lat) * r / 2) ** 2 + Math.cos(lat * r)
    * Math.cos(rlat * r) * Math.sin((rlon - lon) * r / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}

// Cada next() realiza la parte que explica la pantalla, con idénticas ecuaciones a R.
export function* estimateSteps(bundle: ModelBundle, row: PreparedInput):
  Generator<CalculationStep, Estimate, void> {
  validateBundle(bundle);
  validateInput(bundle, row);
  const m = bundle.model, j = m.J, mu = row.municipio;
  yield { stage: 'inputs', value: null };
  const rainPct = 100 * (row.P - row.H) / row.H;
  const feature = { P: row.P, H: row.H, DELTA: row.P - row.H, PCT: rainPct }[j.variable];
  const z = (feature - j.mean) / j.sd;
  const predJ = j.group_mean_y[mu] + j.beta * (z - j.group_mean_z[mu]);
  const municipal = m.municipal_means[mu];
  yield { stage: 'rain', value: predJ };
  const nearby = m.known.map(p => ({
    id: p.ID_POLIGONO, distanceKm: distanceKm(row.lon, row.lat, p.lon, p.lat), yield: p.y,
  })).sort((a, b) => a.distanceKm - b.distanceKm || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).slice(0, 20);
  const rawWeights = nearby.map(p => 1 / Math.max(p.distanceKm * 1000, 1) ** 2);
  const denominator = rawWeights.reduce((s, w) => s + w, 0);
  const idw20 = nearby.reduce((s, p, i) => s + p.yield * rawWeights[i], 0) / denominator;
  const neighbors = nearby.map((p, i) => ({ ...p, weight: rawWeights[i] / denominator }));
  yield { stage: 'neighbors', value: idw20 };
  const k = m.correction;
  const kCorrection = row.K === null ? 0 : k.sd > 1e-12 ? k.beta * (row.K - k.median) / k.sd : 0;
  yield { stage: 'crop', value: row.K === null ? null : kCorrection };
  const mix = .5 * municipal + .5 * idw20 + kCorrection;
  const prediction = .5 * predJ + .5 * mix;
  requireOk(finite(prediction), 'No fue posible obtener una estimación válida.');
  // Descomposición exacta respecto a la base municipal, no importancia causal ni porcentajes.
  const municipalBase = .5 * j.group_mean_y[mu] + .5 * municipal;
  return {
    id: row.ID_POLIGONO, yield: prediction, j: predJ, municipal, idw20, kCorrection, mix,
    municipalBase, kAvailable: row.K !== null,
    municipalReferences: m.known.filter(p => p.municipio === mu).length,
    nearestKnownKm: neighbors[0].distanceKm, neighbors,
    rainOctober: row.P, rainReference: row.H, rainPct,
    contributions: { rain: .5 * (predJ - j.group_mean_y[mu]),
      neighbors: .25 * (idw20 - municipal), crop: .5 * kCorrection },
  };
}

export function predictPrepared(bundle: ModelBundle, rows: PreparedInput[]): Estimate[] {
  requireOk(rows.length > 0 && new Set(rows.map(x => x.ID_POLIGONO)).size === rows.length,
    'Entradas vacías o duplicadas.');
  return rows.map(row => {
    const steps = estimateSteps(bundle, row);
    let step = steps.next();
    while (!step.done) step = steps.next();
    return step.value;
  });
}

export function estimateParcel(bundle: ModelBundle, id: string) {
  const row = bundle.inputs.find(x => x.ID_POLIGONO === id);
  requireOk(Boolean(row), 'Selecciona una de las59 parcelas oficiales.');
  return estimateSteps(bundle, row!);
}
