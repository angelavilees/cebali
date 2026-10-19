import Disclosure from "./components/ui/Disclosure";
import Button from "./components/ui/Button";
import {
  lazy,
  Suspense,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import Icon from "./Icons";
import Stat from "./components/ui/Stat";
import EvidenceBoundary from "./EvidenceBoundary";
import PredictionExperience, { EstimateBreakdown } from "./PredictionExperience";
import FichaDownload from './FichaDownload';
import PredictionFinder from './PredictionFinder';
import ChoiceSelect from './components/ui/ChoiceSelect';
import Welcome from './Welcome';
import { parcels, states, totalArea } from "./data/catalog";
import type { Parcel, StateName } from "./data/catalog";
import type { Estimate } from './model/octG5';
import type { ReviewView } from './PredictionReview';

// Datos y visualizaciones se cargan al abrir el detalle, sin retrasar Inicio.
const loadPanels = () =>
  import("./EvidencePanels").then(async (module) => {
    const { loadEvidence } = await import("./data/evidence");
    await loadEvidence();
    return module;
  });
const ModelCycle = lazy(() =>
  loadPanels().then((module) => ({ default: module.ModelCycle })),
);
const SatelliteDetails = lazy(() =>
  loadPanels().then((module) => ({ default: module.SatelliteDetails })),
);
const ClimatePanel = lazy(() =>
  loadPanels().then((module) => ({ default: module.ClimatePanel })),
);

const ParcelReading = lazy(() =>
  loadPanels().then((module) => ({ default: module.ParcelReading })),
);
const ModelSignals = lazy(() =>
  loadPanels().then((module) => ({ default: module.ModelSignals })),
);
const ModelStory = lazy(() =>
  loadPanels().then((module) => ({ default: module.ModelStory })),
);
const ValidationPanel = lazy(() =>
  loadPanels().then((module) => ({ default: module.ValidationPanel })),
);
const CompareParcels = lazy(() =>
  loadPanels().then((module) => ({ default: module.CompareParcels })),
);
const TerrainFacts = lazy(() =>
  loadPanels().then((module) => ({ default: module.TerrainFacts })),
);
const ParcelHeader = lazy(() => import('./ParcelHeader'));
const RainExplorer = lazy(() => import('./RainExplorer'));
const PredictionReview = lazy(() => import('./PredictionReview'));
const ModelVersion = lazy(async () => {
  const { MODEL_ID } = await import('./model/octG5');
  return { default: () => <p className="model-version">Modelo {MODEL_ID}</p> };
});
const ParcelMap = lazy(() => import('./ParcelMap'));

type Screen = "home" | "parcels" | "predictions" | "detail" | "prediction";
const format = (n: number, digits = 1) =>
  n.toLocaleString("es-MX", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

// Recorte ilustrado de bienvenida; el visor y las fichas usan imágenes satelitales.
function Art({ crop }: { crop: [number, number, number, number] }) {
  return <svg className="art" viewBox={crop.join(" ")} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <image href={`${import.meta.env.BASE_URL}design-reference.png`} width="1024" height="1536" />
  </svg>;
}
function Curve({
  month = 3,
  values,
}: {
  month?: number;
  values: (number | null)[];
}) {
  const x = (i: number) => 35 + i * 44;
  const y = (value: number) => 175 - value * 150;
  const path = values
    .map((value, i) => value === null ? "" : `${i > 0 && values[i - 1] !== null ? "L" : "M"}${x(i)} ${y(value)}`)
    .join(" ");
  const current = values[month];
  return (
    <svg
      className="curve"
      viewBox="0 0 330 214"
      role="img"
      aria-label="Verdor observado por mes, de abril a octubre de 2025"
    >
      {[0, 0.2, 0.4, 0.6, 0.8, 1].map((n) => (
        <g key={n}>
          <line
            x1="32"
            x2="313"
            y1={y(n)}
            y2={y(n)}
            stroke="#e2e5d8"
            strokeDasharray="3 4"
          />
          <text x="6" y={y(n) + 4}>
            {n.toFixed(1)}
          </text>
        </g>
      ))}
      <path
        d={path}
        stroke="#149b51"
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {current !== null && (
        <>
          <line
            x1={x(month)}
            x2={x(month)}
            y1="23"
            y2="180"
            stroke="#189ae6"
            strokeDasharray="4 4"
          />
          <circle
            cx={x(month)}
            cy={y(current)}
            r="6"
            fill="#069ee8"
            stroke="white"
            strokeWidth="3"
          />
        </>
      )}
      {["Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct"].map((label, i) => (
        <text key={label} x={x(i)} y="199" textAnchor="middle">
          {label}
        </text>
      ))}
    </svg>
  );
}

export default function MobileApp() {
  const [welcoming, setWelcoming] = useState(() => {
    if (new URLSearchParams(window.location.search).has('screen')) return false;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    try { return sessionStorage.getItem('cebali:welcome:v1') !== 'seen'; }
    catch { return true; }
  });
  const predictionToolsName = useId();
  const reviewPanel = useRef<HTMLDetailsElement>(null);
  const restoringReview = useRef(false);
  const [estimates, setEstimates] = useState<Record<string, Estimate>>({});
  const [reviewView, setReviewView] = useState<ReviewView>({scope: 'municipality', showAll: false});
  const [reviewOrigin, setReviewOrigin] = useState<{parcel: Parcel; screen: Screen; state: StateName | 'Todas'; view: ReviewView} | null>(null);
  const [screen, setScreen] = useState<Screen>(() => {
    const initial = new URLSearchParams(window.location.search).get("screen");
    return ["parcels", "predictions", "detail", "prediction"].includes(
      initial || "",
    )
      ? (initial as Screen)
      : "home";
  });
  const [parcel, setParcel] = useState(() =>
    new URLSearchParams(window.location.search).get("screen") === "predictions"
      ? parcels.find((p) => p.yieldKind === "estimated")!
      : parcels[0],
  );
  const [predictionId, setPredictionId] = useState(
    parcels.find((p) => p.yieldKind === "estimated")!.id,
  );
  const [predictionView, setPredictionView] = useState<
    "result" | "explanation"
  >("result");
  const [growthAnimation, setGrowthAnimation] = useState(0);
  const replayGrowth = () => setGrowthAnimation((value) => value + 1);
  const [stateFilter, setStateFilter] = useState<StateName | "Todas">("Todas");
  const [predictionState, setPredictionState] = useState<StateName | "Todas">(
    "Todas",
  );
  const predictions = parcels.filter((p) => p.yieldKind === "estimated");
  const shownPredictions = predictions.filter(
    (p) => predictionState === "Todas" || p.state === predictionState,
  );
  function selectPrediction(selected: Parcel) {
    if (selected.yieldKind !== 'estimated') return;
    if (predictionState !== 'Todas' && predictionState !== selected.state) setPredictionState(selected.state);
    setPredictionId(selected.id);
    setParcel(selected);
    setPredictionView('result');
    reviewPanel.current?.removeAttribute('open');
    scroll.current?.scrollTo({ top: 0 });
    heading.current?.focus({ preventScroll: true });
  }
  function reviewPrediction(selected: Parcel, estimate: Estimate) {
    if (selected.id === parcel.id) { openReview(); return; }
    if (!reviewOrigin) setReviewOrigin({parcel, screen, state: predictionState, view: reviewView});
    setEstimates(previous => ({...previous, [selected.id]: estimate}));
    selectPrediction(selected);
  }
  function returnToReview() {
    if (!reviewOrigin) return;
    restoringReview.current = true;
    setParcel(reviewOrigin.parcel);
    setPredictionId(reviewOrigin.parcel.id);
    setPredictionState(reviewOrigin.state);
    setScreen(reviewOrigin.screen);
    setPredictionView('result');
    setReviewView(reviewOrigin.view);
    setReviewOrigin(null);
  }
  function openReview() {
    const panel = reviewPanel.current;
    if (!panel) return;
    panel.open = true;
    const summary = panel.querySelector('summary');
    summary?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    summary?.focus({ preventScroll: true });
  }
  const predictionsActive =
    screen === "predictions" ||
    (screen === "prediction" && parcel.yieldKind === "estimated");
  const scrollPositions = useRef<Record<string, number>>({});
  const filtered = parcels.filter(
    (p) => stateFilter === "Todas" || p.state === stateFilter,
  );
  const scrollKey =
    screen === "predictions"
      ? `predictions:${predictionState}`
      : `${stateFilter}:map`;
  function filterPredictions(state: StateName | "Todas") {
    if (state === predictionState) return;
    setReviewOrigin(null);
    const first = predictions.find(
      (p) => state === "Todas" || p.state === state,
    )!;
    setPredictionState(state);
    setPredictionId(first.id);
    setParcel(first);
    setPredictionView("result");
  }
  function filterState(state: StateName | "Todas") {
    if (state === stateFilter) return;
    const matches = parcels.filter(
      (p) => state === "Todas" || p.state === state,
    );
    scrollPositions.current[`${state}:map`] = 0;
    setStateFilter(state);
    setParcel(matches[0]);
  }
  const [month, setMonth] = useState(3);
  const [tab, setTab] = useState<"summary" | "history">("summary");
  const [help, setHelp] = useState<"model" | "units" | "vegetation" | null>(
    null,
  );
  const history = useRef<Screen[]>([]);
  const dialog = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const helpOrigin = useRef<HTMLElement | null>(null);
  const scroll = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    scroll.current?.scrollTo({
      top: screen === "parcels" ? (scrollPositions.current[scrollKey] ?? 0) : 0,
    });
  }, [screen, scrollKey]);
  useLayoutEffect(() => {
    if (screen === "predictions" || screen === "prediction")
      scroll.current?.scrollTo({ top: 0 });
  }, [screen, predictionView, parcel.id]);
  useLayoutEffect(() => {
    if (restoringReview.current && reviewPanel.current) {
      restoringReview.current = false;
      reviewPanel.current.open = true;
      const summary = reviewPanel.current.querySelector('summary');
      summary?.scrollIntoView({block: 'start'});
      summary?.focus({preventScroll: true});
    }
  }, [parcel.id, screen]);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [screen, welcoming]);
  useEffect(() => {
    if (!help) {
      helpOrigin.current?.focus({ preventScroll: true });
      return;
    }
    const sheet = dialog.current;
    sheet?.querySelector<HTMLButtonElement>("button")?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setHelp(null);
      if (event.key === "Tab" && sheet) {
        const items = Array.from(
          sheet.querySelectorAll<HTMLElement>(
            'button, summary, a[href], input, [tabindex="0"]',
          ),
        ).filter(
          (el) =>
            el.getClientRects().length > 0 && !el.hasAttribute("disabled"),
        );
        const first = items[0],
          last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        }
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [help]);

  function openHelp(topic: NonNullable<typeof help> = "model") {
    if (!help)
      helpOrigin.current = document.activeElement as HTMLElement | null;
    setHelp(topic);
  }
  function go(next: Screen, fromMenu = false) {
    if (screen === next) return;
    if (next === "predictions")
      setParcel(
        shownPredictions.find((p) => p.id === predictionId) ??
          shownPredictions[0],
      );
    if (next === "predictions" || next === "prediction")
      setPredictionView("result");
    if (fromMenu) { history.current = []; setReviewOrigin(null); }
    else history.current.push(screen);
    setScreen(next);
  }
  function back() {
    if (reviewOrigin) { returnToReview(); return; }
    setScreen(
      history.current.pop() ??
        (screen === "prediction"
          ? "detail"
          : screen === "detail"
            ? "parcels"
            : "home"),
    );
  }
  function open(p: Parcel) {
    setParcel(p);
    setTab("summary");
    go("detail");
  }
  const title =
    screen === "home"
      ? "Cebali"
      : screen === "parcels"
        ? "Mis parcelas"
        : screen === "predictions"
          ? "Predicciones"
          : screen === "detail"
            ? parcel.id
            : "Tu rendimiento";
  const monthNames = [
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
  ];

  return (
    <div className={`mobile-app screen-${screen}`}>
      <div className="app-shell" inert={help !== null || welcoming}>
        <div className="status-bar" aria-hidden="true">
          <span>9:41</span>
          <span className="status-right">
            <svg viewBox="0 0 40 18" width="32" height="14">
              <path
                d="M1 16V12h4v4M8 16V8h4v8M15 16V4h4v12M22 16V1h4v15"
                fill="currentColor"
              />
              <path
                d="M29 7q5-5 10 0M31 10q3-3 6 0"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
              />
              <circle cx="34" cy="14" r="1.5" />
            </svg>
            <span className="battery" />
          </span>
        </div>
        <header className="app-header">
          {screen === "home" ? (
            <span className="brand-mark">
              <Icon name="leaf" size={34} />
            </span>
          ) : (
            <button className="icon-button back" onClick={back}>
              <Icon name="back" size={19} />
              <span>Volver</span>
            </button>
          )}
          <h1 ref={heading} tabIndex={-1}>
            {title}
            <small className="header-demo">
              {screen === "predictions"
                ? "Estimaciones del ciclo 2025"
                : "Catálogo oficial · 2025"}
            </small>
          </h1>
          <button
            className="icon-button"
            aria-label="Abrir ayuda"
            onClick={() => openHelp()}
          >
            <Icon name="help" size={23} />
          </button>
        </header>
        {screen === "parcels" && (
          <div className="map-heading catalog-heading">
            <div
              className="state-filters"
              role="group"
              aria-label="Filtrar parcelas por estado"
            >
              {(["Todas", ...states] as (StateName | "Todas")[]).map(
                (state) => (
                  <button
                    key={state}
                    className={stateFilter === state ? "selected" : ""}
                    aria-pressed={stateFilter === state}
                    onClick={() => filterState(state)}
                  >
                    {state}
                  </button>
                ),
              )}
            </div>
            <p className="catalog-count" aria-live="polite">
              {filtered.length} parcelas · {stateFilter}
            </p>

          </div>
        )}
        {screen === "predictions" && (
          <div className="predictions-toolbar predictions-selectors">
            <ChoiceSelect label="Estado" title="¿Qué estado quieres consultar?" ariaLabel="Filtrar predicciones por estado"
              value={predictionState} onChange={value => filterPredictions(value as StateName | 'Todas')}
              options={['Todas', ...states].map(state => ({ value: state, label: state,
                description: `${predictions.filter(p => state === 'Todas' || p.state === state).length} parcelas para estimar` }))} />
            <div className="prediction-field">
              <span>Parcela</span>
              <PredictionFinder items={shownPredictions} selected={parcel} onSelect={selected => { setReviewOrigin(null); selectPrediction(selected); }} />
            </div>
          </div>
        )}
        <div
          className={`screen-content ${screen === "parcels" ? "sector-content" : ""}`}
          ref={scroll}
          onScroll={(event) => {
            if (screen === "parcels")
              scrollPositions.current[scrollKey] =
                event.currentTarget.scrollTop;
          }}
        >
          <EvidenceBoundary>
            <Suspense
              fallback={
                <section className="evidence-loading" role="status">
                  <Icon name="leaf" size={34} />
                  <strong>Preparando los gráficos del ciclo…</strong>
                </section>
              }
            >
              <div className="motion-surface" key={screen}>
              {screen === "home" && (
                <>
                  <section className="home-hero">
                    <Art crop={[22, 97, 322, 150]} />
                    <div className="hero-copy">
                      <h2>¡Hola!</h2>
                      <p>
                        Elige tu parcela.
                        <br />
                        Conoce su rendimiento.
                      </p>
                    </div>
                  </section>
                  <div className="home-body">
                    <section className="conditions">
                      <div className="card-heading">
                        Tu campo, de un vistazo
                      </div>
                      <div className="conditions-grid">
                        <Stat
                          icon="leaf"
                          title="Parcelas"
                          value={String(parcels.length)}
                          color="mint"
                        />
                        <Stat
                          icon="terrain"
                          title="Hectáreas"
                          value={format(totalArea, 0)}
                          color="blue"
                        />
                      </div>
                    </section>
                    <Button
                      className="home-predictions"
                      onClick={() => go("predictions")}
                    >
                      <span className="home-predictions-icon">
                        <Icon name="leaf" size={29} />
                      </span>
                      <span>
                        <strong>Ver predicciones</strong>
                        <small>
                          {predictions.length} parcelas · ciclo 2025
                        </small>
                      </span>
                      <Icon name="chevron" size={22} />
                    </Button>
                    <div className="section-heading">
                      <h2>Explora tus parcelas</h2>
                      <button onClick={() => { setStateFilter("Todas"); go("parcels"); }}>
                        Ver todas <Icon name="chevron" size={15} />
                      </button>
                    </div>
                    <ParcelMap compact items={parcels} selected={parcel.id} onSelect={setParcel}
                      onOpen={open} />
                    <div className="first-time">
                      <button
                        className="learning-row"
                        onClick={() => openHelp()}
                      >
                        <span className="learning-icon mint">
                          <Icon name="help" />
                        </span>
                        <span>
                          ¿Primera vez?<small>Te lo explicamos fácil</small>
                        </span>
                        <Icon name="chevron" size={18} />
                      </button>
                    </div>
                  </div>
                </>
              )}
              {screen === "parcels" && (
                <ParcelMap items={filtered} selected={parcel.id} onSelect={setParcel} onOpen={open} />
              )}

              {screen === "detail" && (
                <div className="detail-body">
                  {tab === "summary" && (
                    <ParcelHeader parcel={parcel} />
                  )}
                  <p className="parcel-identity">
                    {parcel.name} · {parcel.state}
                    <br />
                    {parcel.municipality} · {format(parcel.area, 2)} hectáreas
                  </p>
                  <div className="detail-tabs">
                    <button
                      aria-pressed={tab === "summary"}
                      className={tab === "summary" ? "active" : ""}
                      onClick={() => setTab("summary")}
                    >
                      <Icon name="leaf" />
                      Datos
                    </button>
                    <button
                      aria-pressed={tab === "history"}
                      className={tab === "history" ? "active" : ""}
                      onClick={() => setTab("history")}
                    >
                      <Icon name="chart" />
                      Historia
                    </button>
                  </div>
                  {tab === "summary" ? (
                    <>
                      <h2>Datos de tu parcela</h2>
                      <div className="stats-grid">
                        <Stat
                          icon="leaf"
                          title="Vegetación verde"
                          value={format(parcel.ndvi, 2)}
                          color="mint"
                          caption="Resumen del ciclo"
                        />
                        <Stat
                          icon="drop"
                          title="Lluvia del ciclo"
                          value={`${format(parcel.rain, 0)} mm`}
                          color="blue"
                          caption="Abril–octubre"
                        />
                        <Stat
                          icon="sun"
                          title="Temperatura"
                          value={`${format(parcel.temperature, 1)} °C`}
                          color="cream"
                          caption="Media aproximada"
                        />
                        <Stat
                          icon="terrain"
                          title="Superficie"
                          value={`${format(parcel.area, 2)} ha`}
                          color="peach"
                          caption="Hectáreas"
                        />
                      </div>
                      <TerrainFacts parcel={parcel} />
                      <button
                        className="model-link"
                        onClick={() => openHelp("vegetation")}
                      >
                        <Icon name="help" size={22} /> ¿Qué significa
                        vegetación? <Icon name="chevron" size={17} />
                      </button>
                    </>
                  ) : (
                    <section className="history-chart">
                      <div className="chart-heading-actions">
                        <h2>Cómo cambió el verdor</h2>
                        <button
                          className="growth-replay"
                          aria-label="Repetir crecimiento de la cebada ilustrada"
                          onClick={replayGrowth}
                        >
                          <Icon name="leaf" size={17} />
                          Animar
                        </button>
                      </div>
                      <ModelCycle
                        parcel={parcel}
                        animationKey={growthAnimation}
                      />
                      <SatelliteDetails key={parcel.id} parcel={parcel} />
                      <Disclosure icon="calendar" title="Resumen mensual observado" className="monthly-observations">
                          <p className="chart-explanation">
                            Aquí puedes recorrer los meses y ver cómo cambió el verdor.
                          </p>
                          <Curve month={month} values={parcel.history} />
                          <div className="month-controls">
                            <button
                              aria-label="Mes anterior"
                              disabled={month === 0}
                              onClick={() =>
                                setMonth((m) => Math.max(0, m - 1))
                              }
                            >
                              <Icon name="back" size={22} />
                            </button>
                            <strong aria-live="polite">
                              {monthNames[month]}
                              <small>2025</small>
                            </strong>
                            <button
                              aria-label="Mes siguiente"
                              disabled={month === 6}
                              onClick={() =>
                                setMonth((m) => Math.min(6, m + 1))
                              }
                            >
                              <Icon name="chevron" size={22} />
                            </button>
                          </div>
                          <p className="chart-hint">
                            {parcel.history[month] === null
                              ? "Sin observaciones ese mes"
                              : `${parcel.historyCount[month]} imágenes disponibles este mes`}
                          </p>
                        </Disclosure>
                    </section>
                  )}
                </div>
              )}
              {(screen === "predictions" || screen === "prediction") && (
                <PredictionExperience key={parcel.id} parcel={parcel} initialEstimate={estimates[parcel.id]}
                  onReady={estimate => setEstimates(previous => ({...previous, [estimate.id]: estimate}))}>
                  {(estimate) => {
                    const resultParcel = estimate ? { ...parcel, yield: estimate.yield } : parcel;
                    return (<div className="prediction-body visual-prediction">
                      {reviewOrigin && <button className="model-link" onClick={returnToReview}><Icon name="back" size={18} />Volver a la lista de revisión</button>}
                      <div
                        className="segmented prediction-tabs"
                        role="group"
                        aria-label="Contenido de la predicción"
                      >
                        <button
                          className={predictionView === "result" ? "selected" : ""}
                          aria-pressed={predictionView === "result"}
                          onClick={() => setPredictionView("result")}
                        >
                          Resultado
                        </button>
                        <button
                          className={
                            predictionView === "explanation" ? "selected" : ""
                          }
                          aria-pressed={predictionView === "explanation"}
                          onClick={() => setPredictionView("explanation")}
                        >
                          {resultParcel.yieldKind === 'estimated' ? 'Explicación' : 'Origen del dato'}
                        </button>
                      </div>
                      {predictionView === "result" ? (
                        <>
                          <section className="harvest-hero">
                            <span className="harvest-kicker"><Icon name="wheat" size={23} />{resultParcel.yieldKind === "estimated" ? "Tu cosecha estimada" : "Tu cosecha conocida"}</span>
                            <p className="harvest-location">{resultParcel.id} · {resultParcel.municipality}, {resultParcel.state}</p>
                            <strong className="harvest-yield">{format(resultParcel.yield, 2)}<small>toneladas por hectárea</small></strong>
                            <div className="harvest-total"><Icon name="map" size={26} /><span>En toda tu parcela, aprox.<strong>{format(resultParcel.area * resultParcel.yield, 1)} toneladas</strong><small>{format(resultParcel.area, 2)} hectáreas</small></span></div>
                            <p>{resultParcel.yieldKind === "estimated" ? "Ciclo 2025 · La cosecha real puede ser diferente." : "Cosecha oficial del ciclo 2025."}</p>
                          </section>
                          <ModelSignals parcel={resultParcel} />
                          <button className="model-link" onClick={() => setPredictionView("explanation")}><Icon name="help" size={22} />{resultParcel.yieldKind === 'estimated' ? '¿Cómo llegamos a esta cifra?' : '¿De dónde sale este dato?'}<Icon name="chevron" size={17} /></button>
                          <FichaDownload key={`ficha-${resultParcel.id}`} parcel={resultParcel} estimate={estimate} />
                          <ParcelReading key={`reading-${resultParcel.id}`} parcel={resultParcel} onReview={estimate ? openReview : undefined} />
                          <section className="cycle-visual">
                            <div className="cycle-title">
                              <span>
                                Así se vio tu cultivo{" "}
                                <small>Abril–octubre de 2025</small>
                              </span>
                              <button
                                className="growth-replay"
                                aria-label="Repetir crecimiento de la cebada ilustrada"
                                onClick={replayGrowth}
                              >
                                <Icon name="leaf" size={17} />
                                Animar
                              </button>
                              <button
                                className="icon-button"
                                aria-label="Entender la vegetación observada"
                                onClick={() => openHelp("vegetation")}
                              >
                                <Icon name="help" size={19} />
                              </button>
                            </div>
                            <ModelCycle
                              parcel={resultParcel}
                              animationKey={growthAnimation}
                            />
                          </section>
                          <section className="prediction-tools" aria-label="Herramientas para explorar tu parcela">
                            <h2>Explora tu parcela</h2>
                            {estimate && <PredictionReview key={`review-${resultParcel.id}`} parcel={resultParcel} items={predictions} onSelect={reviewPrediction} view={reviewView} onViewChange={setReviewView} accordionName={predictionToolsName} panelRef={reviewPanel} />}
                            <Disclosure name={predictionToolsName} key={`climate-${resultParcel.id}`} icon="sun" title="Ver condiciones climáticas"><ClimatePanel parcel={resultParcel} /></Disclosure>
                            <SatelliteDetails
                              key={`satellite-${resultParcel.id}`}
                              parcel={resultParcel}
                              accordionName={predictionToolsName}
                            />
                            <CompareParcels
                              key={`compare-${resultParcel.id}`}
                              parcel={resultParcel}
                              accordionName={predictionToolsName}
                            />
                            {estimate && <Suspense fallback={null}><RainExplorer key={`rain-${resultParcel.id}`} parcel={resultParcel} estimate={estimate} accordionName={predictionToolsName} /></Suspense>}
                          </section>
                        </>
                      ) : (
                        <div className="prediction-explanation">
                          <div className="explanation-result">
                            <Icon name="wheat" size={32} />
                            <span>
                              {resultParcel.id}
                              <strong>{format(resultParcel.yield, 2)} t/ha</strong>
                              <small>
                                {resultParcel.yieldKind === "estimated"
                                  ? "Rendimiento estimado"
                                  : "Rendimiento conocido"}
                              </small>
                            </span>
                          </div>
                          {resultParcel.yieldKind === 'estimated' ? <ModelStory parcel={resultParcel} /> : <>
                            <section className="evidence-card official-source">
                              <h2><Icon name="check" />Dato del catálogo oficial</h2>
                              <p>El rendimiento de <strong>{resultParcel.id}</strong> fue proporcionado en el catálogo oficial del ciclo 2025. <strong>Cebali no calculó esta cifra.</strong></p>
                              <p>La producción total se obtiene multiplicando ese rendimiento por las {format(resultParcel.area, 2)} hectáreas de la parcela.</p>
                            </section>
                            <Disclosure icon="help" title="Cómo estimamos las otras parcelas"><ModelStory parcel={resultParcel} /><ValidationPanel /></Disclosure>
                          </>}
                          <FichaDownload key={`ficha-${resultParcel.id}`} parcel={resultParcel} estimate={estimate} />
                          {estimate && <EstimateBreakdown estimate={estimate} parcel={resultParcel} />}
                          <ModelSignals parcel={resultParcel} />
                          {estimate && <ValidationPanel />}
                        </div>
                      )}
                    </div>);
                  }}
                </PredictionExperience>
              )}
              </div>
            </Suspense>
          </EvidenceBoundary>
        </div>
        {screen === "detail" && (
          <div className="action-dock">
            <Button onClick={() => go("prediction")}>
              Ver rendimiento <Icon name="chart" size={22} />
            </Button>
          </div>
        )}
        <nav className="bottom-nav" aria-label="Navegación principal">
          <button
            className={screen === "home" ? "active" : ""}
            aria-current={screen === "home" ? "page" : undefined}
            onClick={() => go("home", true)}
          >
            <Icon name="home" size={26} />
            <span>Inicio</span>
          </button>
          <button
            className={screen !== "home" && !predictionsActive ? "active" : ""}
            aria-current={
              screen !== "home" && !predictionsActive ? "page" : undefined
            }
            onClick={() => {
              if (!filtered.some(p => p.id === parcel.id)) setStateFilter(parcel.state);
              go("parcels", true);
            }}
          >
            <Icon name="map" size={26} />
            <span>Parcelas</span>
          </button>
          <button
            className={predictionsActive ? "active" : ""}
            aria-current={predictionsActive ? "page" : undefined}
            onClick={() => go("predictions", true)}
          >
            <Icon name="chart" size={26} />
            <span>Predicciones</span>
          </button>
          <button onClick={() => openHelp()}>
            <Icon name="help" size={26} />
            <span>Ayuda</span>
          </button>
        </nav>
        <div className="home-indicator" aria-hidden="true" />
      </div>
      {welcoming && <Welcome onDone={() => setWelcoming(false)} />}
      {help && (
        <div className="modal-shade" onClick={() => setHelp(null)}>
          <section
            ref={dialog}
            className="help-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="icon-button close-help"
              aria-label="Cerrar ayuda"
              onClick={() => setHelp(null)}
            >
              <Icon name="close" />
            </button>
            <span className="help-plant">
              <Icon
                name={
                  help === "vegetation"
                    ? "leaf"
                    : help === "units"
                      ? "terrain"
                      : "help"
                }
                size={43}
              />
            </span>
            <h2 id="help-title">
              {help === "units"
                ? "¿Qué significa t/ha?"
                : help === "vegetation"
                  ? "¿Qué es la vegetación verde?"
                  : "Te lo explicamos fácil"}
            </h2>
            {help === "units" ? (
              <>
                <p>
                  <strong>t/ha significa toneladas por hectárea.</strong> Es la
                  cantidad de grano por cada hectárea de terreno, ya sea medida o estimada.
                </p>
                <div className="plain-example">
                  <strong>{format(parcel.yield, 2)} t/ha</strong>
                  <Icon name="chevron" />
                  <span>
                    {format(parcel.yield, 2)} toneladas
                    <br />
                    en una hectárea
                  </span>
                </div>
                <p>
                  Para estimar toda la producción, multiplicamos esa cantidad
                  por el tamaño de tu parcela.
                </p>
              </>
            ) : help === "vegetation" ? (
              <>
                <p>
                  Las imágenes tomadas desde el espacio ayudan a ver cuándo
                  el campo estuvo más verde.
                </p>
                <div className="plain-example">
                  <Icon name="leaf" size={36} />
                  <span>
                    La línea sube cuando
                    <br />
                    <strong>el campo se ve más verde.</strong>
                  </span>
                </div>
                <p>
                  El verdor no mide la altura de la cebada ni la humedad del
                  suelo. Tampoco asegura una cosecha mayor.
                </p>
              </>
            ) : (
              <>
                <p>
                  Aprendemos de cosechas conocidas de la zona. Observamos la
                  lluvia y las imágenes del cultivo para calcular una cifra
                  orientativa para tu parcela.
                </p>
                <div className="model-help-steps">
                  <span>
                    Lluvia y zona
                    <br />
                    <Icon name="map" />
                  </span>
                  <Icon name="chevron" />
                  <span>
                    Dos estimaciones
                    <br />
                    <Icon name="leaf" />
                  </span>
                  <Icon name="chevron" />
                  <span>
                    Resultado
                    <br />
                    <Icon name="chart" />
                  </span>
                </div>
                <p>
                  Juntamos dos referencias: la lluvia y las cosechas de la
                  zona, y las cosechas del municipio y cercanas con las imágenes del
                  cultivo. Las dos cuentan por igual. La cifra final puede
                  ser distinta de lo que realmente se coseche.
                </p>
              </>
            )}
            <div className="help-links">
              {help !== "units" && (
                <button onClick={() => openHelp("units")}>
                  ¿Qué significa t/ha? <Icon name="chevron" size={18} />
                </button>
              )}
              {help !== "vegetation" && (
                <button onClick={() => openHelp("vegetation")}>
                  ¿Qué significa vegetación? <Icon name="chevron" size={18} />
                </button>
              )}
              {help !== "model" && (
                <button onClick={() => openHelp()}>
                  ¿Cómo funciona? <Icon name="chevron" size={18} />
                </button>
              )}
            </div>
            <div className="help-notice">
              <strong>Información del ciclo 2025.</strong>
              <p>
                Donde conocemos la cosecha mostramos el dato oficial. En las
                demás parcelas mostramos una estimación. No son datos de hoy.
              </p>
            </div>
            <Suspense fallback={null}><ModelVersion /></Suspense>
            <Button onClick={() => setHelp(null)}>
              Listo <Icon name="check" size={20} />
            </Button>
          </section>
        </div>
      )}
    </div>
  );
}
