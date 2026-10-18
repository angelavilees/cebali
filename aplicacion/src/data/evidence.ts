import modelRows from "./model-oct-g5.json";

export type Point = [number, number];
export type ParcelEvidence = {
  observed: Point[];
  discarded: Point[];
  segments: Point[][];
  peak: { date: string; day: number; value: number };
  ndvi: { mean: number; amplitude: number; aucPerDay: number };
  quality: {
    observations: number;
    interpolated: number;
    validDays: number;
    coverage: number;
    discarded: number;
  };
  climate: {
    rain: number[];
    tmin: number[];
    tmax: number[];
    rainPeriods: number[];
    tmaxAugSep: number;
    referenceYears: number[];
    referenceMean: number;
    rainDifference: number;
  };
  terrain: { elevation: number; slope: number };
};
export type ValidationContext = {
  rmse: number;
  mae: number;
  scatter: { id: string; truth: number; pred: number }[];
  scatterRepeat: string;
  bank: string;
  repeats: number;
  weighted: boolean;
};
export type FinalParcelEvidence = {
  j: number;
  municipal: number;
  idw20: number;
  kCorrection: number;
  mix: number;
  kAvailable: boolean;
  referenceBase: number;
  territorialGroup: string;
  territorialReferences: number;
  rainAdjustment: number;
  rainOctober: number;
  rainOctoberReference: number;
  rainOctoberPct: number;
  planetContrast: number | null;
  municipalReferences: number;
  nearestKnownKm: number;
  priorityReview: boolean;
  climateSupportIncomplete: boolean;
  municipalSupportLimited: boolean;
};
export const parcelEvidence: Record<string, ParcelEvidence> = {};
let loading: Promise<void> | undefined;
export function loadEvidence(): Promise<void> {
  loading ??= Promise.all([
    import("./evidence-hidalgo.json"),
    import("./evidence-puebla.json"),
    import("./evidence-tlaxcala.json"),
  ]).then((groups) => {
    for (const group of groups) Object.assign(parcelEvidence, group.default);
  });
  return loading;
}
export const modelEvidence = modelRows as unknown as {
  model: string;
  version: string;
  recipe: string;
  nTrain: number;
  nPredictions: number;
  contexts: { represented: ValidationContext; separated: ValidationContext };
  parcels: Record<string, FinalParcelEvidence>;
  rainByParcel: Record<string, { rainOctober: number; rainOctoberReference: number; rainOctoberPct: number }>;
};
