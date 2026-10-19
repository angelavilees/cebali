import { MODEL_ID, predictPrepared } from './octG5';
import type { Estimate, ModelBundle, PreparedInput } from './octG5';

export type RainSupport = {
  version: string;
  variable: string;
  municipalities: Record<string, { knownCount: number; minPct: number; maxPct: number }>;
};
export type RainRange = { min: number; max: number; knownCount: number };

// Los límites corresponden a la anomalía de lluvia de las conocidas del municipio.
// Se expresan en mm conservando H, la referencia histórica de la parcela elegida.
export function rainRange(input: PreparedInput, support: RainSupport): RainRange | null {
  const reference = support.municipalities[input.municipio];
  if (support.version !== MODEL_ID || support.variable !== 'PCT_OCT'
    || !reference || reference.knownCount < 2 || !Number.isFinite(input.H) || input.H <= 0
    || !Number.isFinite(reference.minPct) || !Number.isFinite(reference.maxPct)
    || reference.maxPct - reference.minPct < 1e-8) return null;
  const min = Math.max(0, input.H * (1 + reference.minPct / 100));
  const max = input.H * (1 + reference.maxPct / 100);
  if (!Number.isFinite(input.P) || !Number.isFinite(max) || max <= min
    || input.P < min - 1e-7 || input.P > max + 1e-7) return null;
  // Incluir el valor original exacto si solo difiere por redondeo del extremo.
  return { min: Math.min(min, input.P), max: Math.max(max, input.P), knownCount: reference.knownCount };
}

export function simulateRain(bundle: ModelBundle, input: PreparedInput,
  rain: number, support: RainSupport): Estimate {
  const range = rainRange(input, support);
  if (!range || !Number.isFinite(rain) || rain < range.min || rain > range.max) {
    throw new Error('Elige una lluvia dentro del rango disponible para esta parcela.');
  }
  // Una copia de la entrada: los parámetros, vecinos, K y consulta oficial no cambian.
  return predictPrepared(bundle, [{ ...input, P: rain }])[0];
}
