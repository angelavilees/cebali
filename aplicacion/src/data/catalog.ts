import rows from "./parcels.json";

export type StateName = "Hidalgo" | "Puebla" | "Tlaxcala";
export type Parcel = {
  id: string;
  name: string;
  state: StateName;
  municipality: string;
  area: number;
  yield: number;
  yieldKind: "estimated" | "observed";
  ndvi: number;
  rain: number;
  temperature: number;
  color: "green" | "yellow" | "coral";
  history: (number | null)[];
  historyCount: (number | null)[];
};

export const parcels = rows as Parcel[];
export const states: StateName[] = ["Hidalgo", "Puebla", "Tlaxcala"];
export const homeParcels = states.map((state) =>
  parcels.find((p) => p.state === state)!,
);
export const totalArea = parcels.reduce((sum, p) => sum + p.area, 0);
