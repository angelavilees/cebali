// Diferencia entre las cifras visibles. No modifica entradas, estimaciones ni parámetros.
export function displayedDifference(value: number, reference: number, digits = 2) {
  return Number((Number(value.toFixed(digits)) - Number(reference.toFixed(digits))).toFixed(digits));
}
