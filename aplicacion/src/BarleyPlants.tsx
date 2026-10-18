import { useId } from "react";
import type { CSSProperties } from "react";

const styleVars = (vars: Record<string, string>) => vars as CSSProperties;

function Blade({
  side,
  width,
  height,
  anchor = 0,
  delay,
  gold,
  paint,
}: {
  side: -1 | 1;
  width: number;
  height: number;
  anchor?: number;
  delay: number;
  gold?: boolean;
  paint: string;
}) {
  return (
    <g transform={`translate(0 ${anchor})`}>
      <g
        className={`barley-leaf ${side < 0 ? "left" : "right"}`}
        style={styleVars({ "--leaf-delay": `${delay}s` })}
      >
        <path
          d={`M0 0C${side * width * 0.22} ${-height * 0.4} ${side * width * 0.62} ${-height * 0.82} ${side * width} ${-height}C${side * width * 0.85} ${-height * 0.33} ${side * width * 0.4} ${-height * 0.03} 0 0Z`}
          fill={`url(#${paint})`}
        />
        <path
          d={`M0-1Q${side * width * 0.38} ${-height * 0.36} ${side * width * 0.88} ${-height * 0.91}`}
          stroke={gold ? "#ffe49a" : "#9cce50"}
          strokeWidth=".6"
          fill="none"
          opacity=".7"
        />
      </g>
    </g>
  );
}

function Ear({
  x,
  y,
  angle,
  delay,
  paint,
}: {
  x: number;
  y: number;
  angle: number;
  delay: number;
  paint: string;
}) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <g
        className="barley-ear"
        style={styleVars({ "--ear-delay": `${delay}s` })}
      >
        <path
          d="M0 2V-25"
          stroke="#d2910b"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
        {Array.from({ length: 6 }, (_, row) =>
          [-1, 1].map((side) => (
            <g key={`${row}-${side}`} transform={`translate(0 ${-row * 3.3})`}>
              <g
                className="barley-grain"
                style={styleVars({
                  "--grain-delay": `${delay + 0.08 + row * 0.035}s`,
                })}
              >
                <path
                  d={`M0 1C${side * 4} 0 ${side * 6} -3 ${side * 4} -6C${side * 0.5} -5 0 -2 0 1Z`}
                  fill={`url(#${paint})`}
                />
                <path
                  d={`M${side * 3.8}-5.4L${side * 6.2}-12`}
                  stroke="#e4ab16"
                  strokeWidth=".65"
                  strokeLinecap="round"
                />
                <path
                  d={`M${side * 1.5}-1.5L${side * 3.5}-4.6`}
                  stroke="#ffe58b"
                  strokeWidth=".65"
                  strokeLinecap="round"
                />
              </g>
            </g>
          )),
        )}
        <path
          d="M0-24v-7"
          stroke="#e5aa18"
          strokeWidth=".7"
          strokeLinecap="round"
        />
      </g>
    </g>
  );
}

function Shoot({
  stage,
  paint,
}: {
  stage: number;
  paint: { green: string; dark: string; gold: string };
}) {
  const mature = stage >= 4;
  const height = [23, 31, 37, 48, 45, 47][stage];
  const leaves = mature
    ? [
        { side: -1 as const, width: 12, height: 18, anchor: -3 },
        { side: 1 as const, width: 14, height: 21, anchor: -1 },
        { side: -1 as const, width: 9, height: 18, anchor: -14 },
      ]
    : [
        {
          side: -1 as const,
          width: 8 + stage * 3,
          height: 17 + stage * 5,
          anchor: -1,
        },
        {
          side: 1 as const,
          width: 8 + stage * 3.1,
          height: 20 + stage * 5,
          anchor: 0,
        },
        { side: -1 as const, width: 3 + stage, height, anchor: -1 },
        ...(stage > 0
          ? [
              {
                side: 1 as const,
                width: 4 + stage * 2,
                height: height - 1,
                anchor: -2,
              },
            ]
          : []),
        ...(stage > 1
          ? [
              {
                side: -1 as const,
                width: 9 + stage,
                height: 19 + stage * 3,
                anchor: -10,
              },
              {
                side: 1 as const,
                width: 8 + stage,
                height: 15 + stage * 3,
                anchor: -13,
              },
            ]
          : []),
        ...(stage === 3
          ? [
              { side: -1 as const, width: 12, height: 26, anchor: -16 },
              { side: 1 as const, width: 10, height: 27, anchor: -18 },
            ]
          : []),
      ];
  return (
    <g className="barley-growth">
      <path
        className="barley-stem"
        d={`M0 0Q${mature ? 1 : -1} ${-height * 0.45} 0 ${mature ? -24 : -height * 0.86}`}
        pathLength="1"
        stroke={mature ? "#d9a011" : "#148133"}
        strokeWidth={stage < 2 ? 1.8 : 2.4}
        fill="none"
        strokeLinecap="round"
      />
      {mature && (
        <>
          <path
            className="barley-stem secondary"
            d="M0 0Q-6-12-9-20"
            pathLength="1"
            stroke="#dca819"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            className="barley-stem secondary"
            d="M0 0Q6-10 9-17"
            pathLength="1"
            stroke="#dca819"
            strokeWidth="1.5"
            fill="none"
          />
        </>
      )}
      {leaves.map((leaf, i) => (
        <Blade
          key={i}
          {...leaf}
          delay={0.22 + i * 0.09}
          gold={mature}
          paint={mature ? paint.gold : i % 3 === 0 ? paint.dark : paint.green}
        />
      ))}
      {mature && (
        <>
          <Ear x={0} y={-20} angle={-2} delay={0.62} paint={paint.gold} />
          <Ear x={-9} y={-17} angle={-13} delay={0.77} paint={paint.gold} />
          {stage === 5 && (
            <Ear x={9} y={-14} angle={14} delay={0.85} paint={paint.gold} />
          )}
        </>
      )}
    </g>
  );
}

export default function BarleyPlants() {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const paint = {
    green: `${id}-green`,
    dark: `${id}-dark`,
    gold: `${id}-gold`,
  };
  const positions = [24, 67, 111, 158, 206, 253];
  return (
    <svg
      x="32"
      y="128"
      width="281"
      height="67"
      viewBox="0 0 281 67"
      className="barley-strip"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={paint.green} x1="0" x2="1">
          <stop stopColor="#078b34" />
          <stop offset=".45" stopColor="#40b743" />
          <stop offset="1" stopColor="#78c547" />
        </linearGradient>
        <linearGradient id={paint.dark} x1="0" x2="1">
          <stop stopColor="#046e2f" />
          <stop offset=".55" stopColor="#1b9b37" />
          <stop offset="1" stopColor="#57b33f" />
        </linearGradient>
        <linearGradient id={paint.gold} x1="0" x2="1">
          <stop stopColor="#d59208" />
          <stop offset=".45" stopColor="#f2b319" />
          <stop offset="1" stopColor="#ffd352" />
        </linearGradient>
        <linearGradient id={`${id}-soil`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#a8753c" />
          <stop offset=".5" stopColor="#916032" />
          <stop offset="1" stopColor="#754720" />
        </linearGradient>
      </defs>
      <path
        d="M0 52Q15 50 32 52T71 52T115 52T161 52T205 52T246 52T281 52V67H0Z"
        fill={`url(#${id}-soil)`}
      />
      <path
        d="M0 52Q17 50 33 52T74 52T115 52T163 52T206 52T249 52T281 52"
        stroke="#c49554"
        strokeWidth="1.5"
        fill="none"
      />
      {[12, 39, 83, 98, 135, 175, 189, 228, 268].map((x, i) => (
        <ellipse
          key={x}
          cx={x}
          cy={57 + (i % 3) * 3}
          rx={i % 2 ? 1.8 : 2.5}
          ry="1"
          fill={i % 2 ? "#5e3c21" : "#b17d43"}
          opacity=".65"
        />
      ))}
      {positions.map((x, stage) => (
        <g
          key={stage}
          className="barley-object"
          data-stage={stage + 1}
          transform={`translate(${x} 54)`}
          style={styleVars({ "--plant-delay": `${stage * 0.14}s` })}
        >
          <ellipse
            cx="0"
            cy="1"
            rx={stage < 2 ? 4 : 7}
            ry="1.8"
            fill="#583b1b"
            opacity=".3"
          />
          <Shoot stage={stage} paint={paint} />
        </g>
      ))}
    </svg>
  );
}
