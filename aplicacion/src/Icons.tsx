export type IconName =
  | "home"
  | "map"
  | "chart"
  | "help"
  | "back"
  | "chevron"
  | "bell"
  | "sun"
  | "drop"
  | "wheat"
  | "leaf"
  | "pin"
  | "list"
  | "close"
  | "check"
  | "terrain"
  | "calendar"
  | "plus"
  | "minus"
  | "download"
  | "target";
const paths: Record<IconName, string[]> = {
  home: ["m3 10 9-7 9 7", "M5 9v12h5v-7h4v7h5V9"],
  map: ["m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Z", "M9 3v16M15 5v16"],
  chart: ["M5 20V10M12 20V4M19 20v-7"],
  help: [
    "M9 8a3 3 0 0 1 6 0c0 2-3 2-3 5",
    "M12 17h.01",
    "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  ],
  back: ["m14 5-7 7 7 7"],
  chevron: ["m9 5 7 7-7 7"],
  bell: ["M5 17h14l-2-3V9a5 5 0 0 0-10 0v5Z", "M10 20h4M12 2v2"],
  sun: [
    "M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0",
    "M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2",
  ],
  drop: [
    "M12 2S5 11 5 15a7 7 0 0 0 14 0c0-4-7-13-7-13Z",
    "M8 15a4 4 0 0 0 3 4",
  ],
  leaf: [
    "M12 21V11",
    "M12 15C3 15 2 8 3 4c7 0 10 4 9 11Z",
    "M12 11c0-7 5-9 9-9 1 6-2 10-9 10",
  ],
  wheat: [
    "M7 22 17 2",
    "M10 16C5 16 4 13 5 10c4 0 6 2 5 6Z",
    "M12 12C7 12 6 9 7 6c4 0 6 2 5 6Z",
    "M11 16c0-4 4-5 7-4 0 4-3 6-7 4Z",
    "M13 11c0-4 4-5 7-4 0 4-3 6-7 4Z",
    "M16 6c-2-2-2-4 0-6 3 2 3 4 0 6Z",
  ],
  pin: [
    "M19 10c0 5-7 12-7 12S5 15 5 10a7 7 0 0 1 14 0Z",
    "M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  ],
  list: ["M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"],
  close: ["m6 6 12 12M6 18 18 6"],
  check: ["m5 12 4 4L19 6"],
  terrain: ["m2 20 7-13 5 8 3-5 5 10Z"],
  calendar: ["M5 5h14v16H5Z", "M8 2v6M16 2v6M5 10h14"],
  plus: ["M12 5v14M5 12h14"],
  minus: ["M5 12h14"],
  download: ["M12 3v12m-5-5 5 5 5-5", "M4 16v5h16v-5"],
  target: [
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
    "M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    "M12 1v3M12 20v3M1 12h3M20 12h3",
  ],
};
export default function Icon({
  name,
  size = 24,
}: {
  name: IconName;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.1}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name].map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
