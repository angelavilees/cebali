import Disclosure from "./components/ui/Disclosure";
import { useState } from "react";
import Icon from "./Icons";
import BarleyPlants from "./BarleyPlants";
import { parcels } from "./data/catalog";
import type { Parcel } from "./data/catalog";
import { parcelEvidence, modelEvidence } from "./data/evidence";
import type { Point } from "./data/evidence";

const fmt = (n: number, d = 1) =>
  n.toLocaleString("es-MX", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
const months = ["Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct"];
const monthDays = [0, 30, 61, 91, 122, 153, 183];
const labelDate = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
export function ModelCycle({
  parcel,
  discarded = false,
  illustration = true,
  animationKey = 0,
}: {
  parcel: Parcel;
  discarded?: boolean;
  illustration?: boolean;
  animationKey?: number;
}) {
  const data = parcelEvidence[parcel.id];
  const x = (day: number) => 35 + (day / 213) * 264;
  const y = (value: number) => 113 - value * 90;
  const path = (points: Point[]) =>
    points.map(([d, v], i) => `${i ? "L" : "M"}${x(d)} ${y(v)}`).join(" ");
  const px = x(data.peak.day),
    py = y(data.peak.value);
  const bx = Math.max(35, Math.min(220, px - 40)),
    by = Math.max(2, py - 44);
  return (
    <div className="model-cycle">
      <svg
        className="illustrated-cycle"
        viewBox={`0 0 330 ${illustration ? 216 : 142}`}
        role="img"
        aria-label={`Verdor de ${parcel.id} durante 2025. Mayor verdor observado el ${labelDate(data.peak.date)}. Los huecos indican días sin imágenes suficientes.`}
      >
        {[0, 1].map((v) => (
          <g key={v}>
            <line
              x1="32"
              x2="312"
              y1={y(v)}
              y2={y(v)}
              stroke="#e2e5d8"
              strokeDasharray="3 4"
            />
            <text x="7" y={y(v) + 4}>
              {v === 1 ? "Más" : "Poco"}
            </text>
          </g>
        ))}
        {data.segments
          .filter((s) => s.length > 1)
          .map((s, i) => (
            <path
              key={`shade-${i}`}
              d={`${path(s)}L${x(s[s.length - 1][0])} ${y(0)}L${x(s[0][0])} ${y(0)}Z`}
              fill="#51b7dc"
              opacity=".1"
            />
          ))}
        {discarded &&
          data.discarded.map(([d, v], i) => (
            <g key={`removed-${i}`} stroke="#b3b5bf" strokeWidth="1.5">
              <path d={`M${x(d) - 3} ${y(v) - 3}l6 6m-6 0 6-6`} />
            </g>
          ))}
        {data.observed.map(([d, v], i) => (
          <circle
            key={`obs-${i}`}
            cx={x(d)}
            cy={y(v)}
            r="2.4"
            fill="#63b67b"
            opacity=".8"
          />
        ))}
        {data.segments.map((s, i) => (
          <path
            key={`curve-${i}`}
            d={path(s)}
            stroke="#239fdb"
            strokeWidth="2.7"
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        <circle
          cx={px}
          cy={py}
          r="5"
          fill="#088fe0"
          stroke="white"
          strokeWidth="2"
        />
        <g>
          <rect
            x={bx}
            y={by}
            width="86"
            height="35"
            rx="10"
            fill="#eff9ff"
            stroke="#ccebf8"
          />
          <text
            x={bx + 43}
            y={by + 14}
            textAnchor="middle"
            className="cycle-month"
          >
            {labelDate(data.peak.date)}
          </text>
          <text
            x={bx + 43}
            y={by + 28}
            textAnchor="middle"
            className="cycle-value"
          >
            Más verde
          </text>
        </g>
        {illustration && (
          <>
            <text
              x="311"
              y="125"
              textAnchor="end"
              className="cycle-illustration"
            >
              Cebada ilustrada
            </text>
            <BarleyPlants key={`${parcel.id}:${animationKey}`} />
          </>
        )}
        {months.map((m, i) => (
          <text
            key={m}
            x={x(monthDays[i])}
            y={illustration ? 210 : 138}
            textAnchor="middle"
          >
            {m}
          </text>
        ))}
      </svg>
      <div className="evidence-legend">
        <span>
          <i className="legend-dot" />
          Imágenes del campo
        </span>
        <span>
          <i className="legend-line" />
          Cambio del verdor
        </span>
        {discarded && <span>× Descartados por nubes</span>}
      </div>
    </div>
  );
}

export function SatelliteDetails({ parcel }: { parcel: Parcel }) {
  const d = parcelEvidence[parcel.id];
  return (
    <Disclosure icon="leaf" title="¿Cuándo estuvo más verde?" className="satellite-details">
        <div className="green-peak"><Icon name="leaf" size={35} /><span>Mayor verdor observado<strong>{labelDate(d.peak.date)} de 2025</strong></span></div>
        <p className="evidence-copy">Las imágenes muestran cómo cambió el verdor. Si la línea tiene huecos, faltan imágenes claras de esos días.</p>
      </Disclosure>
  );
}

export function ClimatePanel({ parcel }: { parcel: Parcel }) {
  const d = parcelEvidence[parcel.id].climate;
  const [period, setPeriod] = useState(0);
  const periods = ["Abr–Jun", "Julio", "Ago–Sep"];
  const active = [[0, 1, 2], [3], [4, 5]][period];
  const rainMax = Math.max(100, Math.ceil(Math.max(...d.rain) / 100) * 100);
  const top = Math.ceil(Math.max(...d.tmax) / 5) * 5,
    bottom = Math.floor(Math.min(...d.tmin) / 5) * 5;
  const tx = (i: number) => 43 + i * 42;
  const ty = (v: number) =>
    187 - ((v - bottom) / Math.max(5, top - bottom)) * 54;
  const tempPath = (values: number[]) =>
    values.map((v, i) => `${i ? "L" : "M"}${tx(i)} ${ty(v)}`).join(" ");
  return (
    <section className="evidence-card climate-panel">
      <h2>
        <Icon name="drop" />
        La lluvia y el calor de este ciclo
      </h2>
      <p className="evidence-copy">
        Mira en qué meses llovió más y cómo cambió la temperatura.
      </p>
      <div
        className="rain-periods"
        role="group"
        aria-label="Periodos de lluvia observada"
      >
        {periods.map((p, i) => (
          <button
            key={p}
            aria-pressed={period === i}
            className={period === i ? "selected" : ""}
            onClick={() => setPeriod(i)}
          >
            <span>{p}</span>
            <strong>
              {fmt(d.rainPeriods[i], 0)}
              <small> mm</small>
            </strong>
          </button>
        ))}
      </div>
      <svg
        className="climate-chart"
        viewBox="0 0 330 217"
        role="img"
        aria-label={`Lluvia mensual y temperaturas mínimas y máximas medias mensuales de ${parcel.id}, abril a octubre de 2025`}
      >
        <text x="5" y="13" className="chart-subtitle">
          Lluvia · mm
        </text>
        {[0, rainMax / 2, rainMax].map((v) => (
          <g key={v}>
            <line
              x1="30"
              x2="314"
              y1={94 - (v / rainMax) * 65}
              y2={94 - (v / rainMax) * 65}
              stroke="#deedf0"
            />
            <text x="2" y={98 - (v / rainMax) * 65}>
              {fmt(v, 0)}
            </text>
          </g>
        ))}
        {d.rain.map((v, i) => (
          <g key={i}>
            <rect
              x={tx(i) - 12}
              y={94 - (v / rainMax) * 65}
              width="24"
              height={(v / rainMax) * 65}
              rx="5"
              fill={active.includes(i) ? "#1f9cdd" : "#b5dfec"}
            />
            <text x={tx(i)} y="109" textAnchor="middle">
              {months[i]}
            </text>
          </g>
        ))}
        <text x="5" y="127" className="chart-subtitle">
          Temperatura · °C
        </text>
        {[bottom, top].map((v) => (
          <g key={v}>
            <line x1="30" x2="314" y1={ty(v)} y2={ty(v)} stroke="#eee6d3" />
            <text x="4" y={ty(v) + 4}>
              {fmt(v, 0)}
            </text>
          </g>
        ))}
        <path
          d={tempPath(d.tmin)}
          fill="none"
          stroke="#59acc9"
          strokeWidth="2.5"
        />
        <path
          d={tempPath(d.tmax)}
          fill="none"
          stroke="#e5ad27"
          strokeWidth="2.5"
        />
        {d.tmin.map((v, i) => (
          <circle key={`min-${i}`} cx={tx(i)} cy={ty(v)} r="3" fill="#59acc9" />
        ))}
        {d.tmax.map((v, i) => (
          <circle key={`max-${i}`} cx={tx(i)} cy={ty(v)} r="3" fill="#e5ad27" />
        ))}
        {months.map((m, i) => (
          <text key={m} x={tx(i)} y="204" textAnchor="middle">
            {m}
          </text>
        ))}
      </svg>
      <div className="evidence-legend">
        <span>
          <i className="legend-line minimum" />
          Noches
        </span>
        <span>
          <i className="legend-line maximum" />
          Días
        </span>
      </div>
      <div className="heat-summary">
        <Icon name="sun" size={28} />
        <span>
          Calor de día · agosto–septiembre<strong>{fmt(d.tmaxAugSep)} °C</strong>
        </span>
      </div>
      <p className="evidence-source">
        Clima de la zona · ciclo 2025
      </p>
    </section>
  );
}

export function RainReference({ parcel }: { parcel: Parcel }) {
  const d = modelEvidence.rainByParcel[parcel.id];
  const max = Math.max(d.rainOctober, d.rainOctoberReference, 1);
  return (
    <section className="evidence-card rain-reference">
      <h2><Icon name="calendar" />¿Llovió más o menos en octubre?</h2>
      <p className="evidence-copy">Comparamos octubre de 2025 con los tres años anteriores.</p>
      <div className="reference-row">
        <span>Octubre · promedio de 2022 a 2024<strong>{fmt(d.rainOctoberReference, 0)} mm</strong></span>
        <div className="reference-track"><i style={{ width: `${d.rainOctoberReference / max * 100}%` }} /></div>
      </div>
      <div className="reference-row current">
        <span>Octubre 2025<strong>{fmt(d.rainOctober, 0)} mm</strong></span>
        <div className="reference-track"><i style={{ width: `${d.rainOctober / max * 100}%` }} /></div>
      </div>
      <p className="reference-difference"><strong>{fmt(Math.abs(d.rainOctoberPct), 1)}% {d.rainOctoberPct >= 0 ? "más" : "menos"}</strong> lluvia que en el promedio anterior.</p>
    </section>
  );
}

export function ModelSignals({ parcel }: { parcel: Parcel }) {
  const d = modelEvidence.parcels[parcel.id];
  if (!d?.priorityReview) return null;
  return (
    <section className="support-notice" aria-label="Nota sobre esta estimación">
      <Icon name="help" size={27} />
      <p><strong>Revisa esta cifra con tu técnico.</strong>{d.climateSupportIncomplete ? "Faltan cosechas conocidas que compartan los datos de lluvia de esta parcela." : "Hay una sola cosecha conocida en este municipio; también usamos referencias de su zona."} La cosecha real puede ser diferente.</p>
    </section>
  );
}

export function ModelStory({ parcel }: { parcel: Parcel }) {
  const estimated = parcel.yieldKind === "estimated";
  const info = modelEvidence.parcels[parcel.id];
  return (
    <section className="evidence-card model-story simple-story">
      <h2><Icon name="wheat" />¿Cómo lo calculamos?</h2>
      <div className="model-training"><Icon name="map" size={30} /><strong>Aprendemos de cosechas conocidas</strong></div>
      <div className="story-arrow" aria-hidden="true">↓</div>
      <div className="model-branches">
        <div><Icon name="drop" size={34} /><b>Miramos la lluvia</b><span>La lluvia de octubre y las cosechas conocidas de tu zona.</span></div>
        <div><Icon name="leaf" size={34} /><b>Miramos tu zona</b><span>{info && !info.kAvailable ? "Aquí usamos las cosechas cercanas. Faltan imágenes para comparar el cultivo." : "Las cosechas cercanas y las imágenes del cultivo, cuando hay datos."}</span></div>
      </div>
      <p className="equal-voices">Las dos cuentan por igual.</p>
      <div className="story-arrow" aria-hidden="true">↓</div>
      <div className="model-result"><Icon name="wheat" size={31} /><span>{estimated ? "Así estimamos tu cosecha" : "Así estimamos las parcelas sin cosecha conocida"}<strong>{estimated ? `${fmt(parcel.yield, 2)} t/ha` : "Una cifra orientativa"}</strong></span></div>
    </section>
  );
}

export function ParcelReading({ parcel }: { parcel: Parcel }) {
  const [view, setView] = useState<"harvest" | "rain" | "crop">("harvest");
  const references = parcels.filter(p => p.yieldKind === "observed" && p.municipality === parcel.municipality && p.id !== parcel.id);
  const average = references.length ? references.reduce((sum, p) => sum + p.yield, 0) / references.length : null;
  const delta = average === null ? null : parcel.yield - average;
  const max = Math.max(parcel.yield, average ?? 0, 1);
  const crop = parcelEvidence[parcel.id];
  const rain = modelEvidence.rainByParcel[parcel.id];
  const estimated = parcel.yieldKind === "estimated";
  const rows: { key: "harvest" | "rain" | "crop"; label: string; icon: "wheat" | "drop" | "leaf" }[] = [
    { key: "harvest", label: "Cosecha", icon: "wheat" },
    { key: "rain", label: "Lluvia", icon: "drop" },
    { key: "crop", label: "Cultivo", icon: "leaf" },
  ];
  return (
    <section className="evidence-card parcel-reading">
      <h2><Icon name="chart" />Qué nos dice esta parcela</h2>
      <div className="reading-tabs" role="group" aria-label="Información para interpretar la parcela">
        {rows.map(row => <button key={row.key} className={view === row.key ? "selected" : ""} aria-pressed={view === row.key} onClick={() => setView(row.key)}><Icon name={row.icon} size={23} />{row.label}</button>)}
      </div>
      {view === "harvest" && <div className="reading-content">
        <h3>Frente a las cosechas de tu municipio</h3>
        <div className="reading-yield-row"><span>{estimated ? "Tu estimación" : "Tu cosecha conocida"}<strong>{fmt(parcel.yield, 2)} t/ha</strong></span><div className="reading-yield-track"><i style={{ width: `${parcel.yield / max * 100}%` }} /></div></div>
        {average !== null && delta !== null ? <>
          <div className="reading-yield-row reference"><span>Cosechas conocidas<strong>{fmt(average, 2)} t/ha</strong></span><div className="reading-yield-track"><i style={{ width: `${average / max * 100}%` }} /></div></div>
          <p className="reading-interpretation">{delta === 0 ? "La cifra coincide con el promedio de las cosechas conocidas." : <>{estimated ? "Se esperan" : "Se registraron"} <strong>{fmt(Math.abs(delta), 2)} toneladas por hectárea {delta > 0 ? "más" : "menos"}</strong> que ese promedio.</>}</p>
          <div className="reading-action"><Icon name="help" size={23} /><p><strong>Para tu revisión</strong>{delta < 0 ? "Puedes empezar por las parcelas con menor cosecha prevista y revisar su lluvia y verdor con tu técnico." : "Antes de atribuir la diferencia al manejo, compara la lluvia y el verdor. Una cifra mayor no demuestra mejores prácticas."}</p></div>
          {references.length === 1 && <p className="evidence-source">Con una sola referencia, la comparación es limitada. No basta para juzgar el desempeño de tu parcela.</p>}
        </> : <p className="evidence-copy">No hay otras cosechas conocidas de este municipio para comparar. Podemos revisar la lluvia y las imágenes del cultivo.</p>}
      </div>}
      {view === "rain" && <div className="reading-content">
        <RainReference parcel={parcel} />
        {delta !== null && <p className="reading-interpretation">{delta < 0 && rain.rainOctoberPct > 0 ? "Aquí hubo más lluvia en octubre y, aun así, la cifra de cosecha queda por debajo de la referencia municipal. Más agua no garantiza más grano." : <>La lluvia de octubre fue {rain.rainOctoberPct >= 0 ? "mayor" : "menor"} que en la referencia de tres años. La cifra de cosecha queda {delta >= 0 ? "por encima" : "por debajo"} de las cosechas conocidas del municipio. Son dos comparaciones distintas.</>}</p>}
        <div className="reading-action"><Icon name="help" size={23} /><p><strong>Para tu revisión</strong>Contrasta esta diferencia de lluvia con las imágenes del cultivo y lo que observaste en campo. Estos datos no indican si faltó agua ni si hace falta regar.</p></div>
      </div>}
      {view === "crop" && <div className="reading-content">
        <div className="green-peak"><Icon name="leaf" size={34} /><span>Mayor verdor observado<strong>{labelDate(crop.peak.date)} de 2025</strong></span></div>
        <ModelCycle parcel={parcel} illustration={false} />
        <p className="reading-interpretation">Las imágenes muestran cuándo el campo estuvo más verde. La cifra de cosecha habla del grano por hectárea; <strong>son cosas distintas</strong>.</p>
        <div className="reading-action"><Icon name="help" size={23} /><p><strong>Para tu revisión</strong>¿Lo que muestra la curva coincide con lo que viste en tu parcela? Revísala con tu técnico al explicar las diferencias de cosecha. Los huecos de la línea indican días sin imágenes suficientes.</p></div>
      </div>}
    </section>
  );
}

export function ValidationPanel() {
  const [context, setContext] = useState<"represented" | "separated">(
    "represented",
  );
  const d = modelEvidence.contexts[context];
  const max = Math.ceil(
    Math.max(...d.scatter.map((p) => Math.max(p.truth, p.pred))),
  );
  const x = (v: number) => 33 + (v / max) * 258,
    y = (v: number) => 177 - (v / max) * 152;
  return (
    <Disclosure icon="check" title="¿Cómo lo hemos probado?" className="validation-panel">
        <p className="evidence-copy">
          Ocultamos cosechas que ya conocíamos, hicimos la estimación y luego comparamos las dos cifras.
        </p>
        <div className="segmented evidence-context">
          <button
            className={context === "represented" ? "selected" : ""}
            onClick={() => setContext("represented")}
            aria-pressed={context === "represented"}
          >
            Parcelas de la zona
          </button>
          <button
            className={context === "separated" ? "selected" : ""}
            onClick={() => setContext("separated")}
            aria-pressed={context === "separated"}
          >
            Zonas diferentes
          </button>
        </div>
        <svg
          className="validation-chart"
          viewBox="0 0 330 218"
          role="img"
          aria-label="Cosecha medida frente a cosecha estimada en las pruebas"
        >
          <text x="8" y="13">
            Estimado · t/ha
          </text>
          {Array.from({ length: max + 1 }, (_, i) => i)
            .filter((i) => i % 2 === 0 || i === max)
            .map((v) => (
              <g key={v}>
                <line x1="33" x2="291" y1={y(v)} y2={y(v)} stroke="#e5e9db" />
                <text x="12" y={y(v) + 4}>
                  {v}
                </text>
                <text x={x(v)} y="193" textAnchor="middle">
                  {v}
                </text>
              </g>
            ))}
          <path
            d={`M${x(0)} ${y(0)}L${x(max)} ${y(max)}`}
            stroke="#8caf9a"
            strokeDasharray="4 4"
          />
          {d.scatter.map((p) => (
            <circle
              key={p.id}
              cx={x(p.truth)}
              cy={y(p.pred)}
              r="3.2"
              fill={context === "represented" ? "#2aab71" : "#e3aa42"}
              opacity=".6"
            >
              <title>
                {p.id}: real {fmt(p.truth, 2)}, estimado {fmt(p.pred, 2)}
              </title>
            </circle>
          ))}
          <text x="166" y="214" textAnchor="middle">
            Cosecha real · t/ha
          </text>
        </svg>
        <p className="plain-test-result">En estas pruebas, la diferencia media fue de <strong>{fmt(d.mae, 1)} toneladas por hectárea.</strong></p>
        <p className="evidence-source">Cada punto compara una cosecha real con una estimación.</p>
      </Disclosure>
  );
}

export function CompareParcels({ parcel }: { parcel: Parcel }) {
  const options = parcels.filter((p) => p.id !== parcel.id);
  const [otherId, setOtherId] = useState(
    () =>
      (
        options.find((p) => p.municipality === parcel.municipality && p.yieldKind === "observed") ?? options.find((p) => p.state === parcel.state && p.yieldKind === "observed") ?? options[0]
      ).id,
  );
  const other = options.find((p) => p.id === otherId)!;
  const difference =
    Number(parcel.yield.toFixed(2)) - Number(other.yield.toFixed(2));
  return (
    <Disclosure icon="map" title="Comparar dos cosechas" className="compare-panel">
        <label className="comparison-picker">
          Elige la otra parcela
          <select
            aria-label="Parcela para comparar"
            value={otherId}
            onChange={(e) => setOtherId(e.target.value)}
          >
            {options.map((p) => (
              <option value={p.id} key={p.id}>
                {p.id} · {p.state} ·{" "}
                {p.yieldKind === "estimated" ? "estimado" : "conocido"}
              </option>
            ))}
          </select>
        </label>
        <div className="comparison-pair">
          {[parcel, other].map((p) => (
            <div className="comparison-tile" key={p.id}>
              <Icon name="wheat" size={26} />
              <strong>{p.id}</strong>
              <small>{p.state}</small>
              <span className={`comparison-kind ${p.yieldKind}`}>
                {p.yieldKind === "estimated" ? "Estimado" : "Conocido"}
              </span>
              <b>
                {fmt(p.yield, 2)} <small>t/ha</small>
              </b>
              <span>{fmt(p.area, 2)} ha</span>
              <span>{fmt(p.area * Number(p.yield.toFixed(2)))} t aprox.</span>
            </div>
          ))}
        </div>
        <p className="comparison-difference">
          Diferencia {parcel.id} − {other.id}:{" "}
          <strong>
            {difference > 0 ? "+" : ""}
            {fmt(difference, 2)} t/ha
          </strong>
        </p>
        <table className="comparison-context">
          <caption>Condiciones del ciclo 2025</caption>
          <thead>
            <tr>
              <th>Dato</th>
              <th>{parcel.id}</th>
              <th>{other.id}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Lluvia</td>
              <td>{fmt(parcel.rain, 0)} mm</td>
              <td>{fmt(other.rain, 0)} mm</td>
            </tr>
            <tr>
              <td>Temp. aprox.</td>
              <td>{fmt(parcel.temperature)} °C</td>
              <td>{fmt(other.temperature)} °C</td>
            </tr>
            <tr>
              <td>Verdor del cultivo</td>
              <td>{fmt(parcel.ndvi, 2)}</td>
              <td>{fmt(other.ndvi, 2)}</td>
            </tr>
          </tbody>
        </table>
      </Disclosure>
  );
}

export function TerrainFacts({ parcel }: { parcel: Parcel }) {
  const d = parcelEvidence[parcel.id].terrain;
  return (
    <div className="terrain-facts">
      <Icon name="terrain" size={30} />
      <span>
        Cómo es el terreno
        <strong>
          {fmt(d.elevation, 0)} m de elevación · {fmt(d.slope)}° de pendiente
        </strong>
      </span>
    </div>
  );
}

