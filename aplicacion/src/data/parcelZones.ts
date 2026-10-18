import raw from './parcel-zones.json';
export type Box = [number, number, number, number];
export type ParcelShape = {
  id: string; state: string; municipality: string; path: string;
  bbox: Box; center: [number, number]; anchor: [number, number];
};
export type ParcelZone = { id: string; state: string; municipality: string; ids: string[]; bbox: Box };
export const geography = raw as unknown as {
  source: string; crs: string; units: string; northUp: boolean;
  features: Record<string, ParcelShape>; zones: ParcelZone[];
};
// Una sola transformacion por encuadre, sin deformar ni separar los poligonos.
export function fitZone(box: Box, aspect: number, padding = 1.28): Box {
  const width = Math.max(80, box[2] - box[0]);
  const height = Math.max(80, box[3] - box[1]);
  const w = Math.max(width, height * aspect) * padding;
  const h = w / aspect;
  return [(box[0] + box[2] - w) / 2, (box[1] + box[3] - h) / 2, w, h];
}
export function scaleDistance(width: number) {
  const desired = width / 4;
  const power = 10 ** Math.floor(Math.log10(desired));
  return [5, 2, 1].map(n => n * power).find(n => n <= desired) ?? power / 2;
}
