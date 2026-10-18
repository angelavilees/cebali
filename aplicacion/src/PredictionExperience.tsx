import Button from "./components/ui/Button";
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Icon from './Icons';
import type { IconName } from './Icons';
import BarleyPlants from './BarleyPlants';
import type { Parcel } from './data/catalog';
import type { CalculationStage, Estimate, FactorKey, ModelBundle } from './model/octG5';

const fmt = (n: number, digits = 2) => n.toLocaleString('es-MX', {
  minimumFractionDigits: digits, maximumFractionDigits: digits,
});
const steps: { key: CalculationStage; icon: IconName; title: string; copy: string }[] = [
  { key: 'inputs', icon: 'map', title: 'Revisamos tu parcela', copy: 'Usamos sus mediciones preparadas del ciclo 2025.' },
  { key: 'rain', icon: 'drop', title: 'Comparamos la lluvia', copy: 'Relacionamos la lluvia de octubre con las cosechas conocidas de tu zona.' },
  { key: 'neighbors', icon: 'pin', title: 'Miramos cosechas cercanas', copy: 'Las parcelas más próximas tienen más peso en esta parte del cálculo.' },
  { key: 'crop', icon: 'leaf', title: 'Revisamos la señal del cultivo', copy: 'Cuando hay datos, ajustamos la cifra con las imágenes de tu parcela y su entorno.' },
];
type RunState = { status: 'idle' } | { status: 'running'; step: number; cropMissing?: boolean }
  | { status: 'ready'; estimate: Estimate } | { status: 'error' };

export default function PredictionExperience({ parcel, children }: {
  parcel: Parcel; children: (estimate: Estimate | null) => ReactNode;
}) {
  const [run, setRun] = useState<RunState>({ status: 'idle' });
  const controller = useRef<AbortController | null>(null);
  const releasePause = useRef<(() => void) | null>(null);
  const fast = useRef(false);
  const resultTitle = useRef<HTMLHeadingElement>(null);
  useEffect(() => () => { controller.current?.abort(); releasePause.current?.(); }, []);
  useEffect(() => {
    if (run.status === 'ready') resultTitle.current?.focus({ preventScroll: true });
  }, [run.status]);

  async function start() {
    if (controller.current && !controller.current.signal.aborted) return;
    const active = new AbortController();
    controller.current = active;
    fast.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setRun({ status: 'running', step: -1 });
    const pause = () => new Promise<void>(resolve => {
      const finish = () => { clearTimeout(timer); releasePause.current = null; resolve(); };
      const timer = window.setTimeout(finish, fast.current ? 0 : 650);
      releasePause.current = finish;
    });
    try {
      const [engine, data] = await Promise.all([
        import('./model/octG5'), import('./model/oct-g5-runtime.json'),
      ]);
      if (active.signal.aborted) return;
      const calculation = engine.estimateParcel(data.default as unknown as ModelBundle, parcel.id);
      let step = calculation.next();
      while (!step.done) {
        const stage = step.value.stage;
        setRun({ status: 'running', step: steps.findIndex(s => s.key === stage),
          cropMissing: stage === 'crop' && step.value.value === null });
        await pause();
        if (active.signal.aborted) return;
        step = calculation.next();
      }
      setRun({ status: 'ready', estimate: step.value });
    } catch {
      if (!active.signal.aborted) setRun({ status: 'error' });
    } finally {
      if (controller.current === active) controller.current = null;
    }
  }
  function cancel() {
    controller.current?.abort(); releasePause.current?.();
    controller.current = null;
    setRun({ status: 'idle' });
  }
  function skip() { fast.current = true; releasePause.current?.(); }

  if (parcel.yieldKind === 'observed') return children(null);
  if (run.status === 'ready') return <>
    <div className="estimate-ready">
      <span><Icon name="check" size={19} /><h2 ref={resultTitle} tabIndex={-1}>Estimación lista</h2></span>
      <button onClick={start}>Volver a calcular</button>
    </div>
    {children(run.estimate)}
  </>;
  const loading = run.status === 'running';
  const current = loading && run.step >= 0 ? steps[run.step] : null;
  return <section className={`estimate-start ${loading ? 'is-running' : ''}`} aria-busy={loading}>
    <div className="estimate-kicker">TU PARCELA · CICLO 2025</div>
    <strong className="estimate-parcel">{parcel.id}</strong>
    <p className="estimate-location">{parcel.municipality} · {parcel.state}</p>
    <div className="estimate-scene" aria-hidden="true">
      <span className="estimate-cloud cloud-one" /><span className="estimate-cloud cloud-two" />
      <div className="estimate-orbit"><Icon name={current?.icon ?? 'wheat'} size={46} /></div>
      <BarleyPlants />
    </div>
    <div className="estimate-current" role="status" aria-live="polite" aria-atomic="true">
      <div className="estimate-step-copy" key={loading ? current?.key ?? 'preparing' : run.status}>
      <h2>{loading ? current?.title ?? 'Preparando el cálculo' : run.status === 'error' ? 'No pudimos calcular la estimación' : '¿Cuánto grano esperamos?'}</h2>
      <p>{loading ? run.cropMissing ? 'Aquí faltan datos para comparar el cultivo con su entorno. No aplicamos ese ajuste.' : current?.copy ?? 'Cargamos el modelo y los datos de esta parcela.' : run.status === 'error' ? 'Vuelve a intentarlo. No mostraremos un resultado sin comprobar el cálculo.' : 'Juntamos la lluvia, las cosechas conocidas y la señal del cultivo para estimar su rendimiento.'}</p>
      </div>
    </div>
    {loading ? <>
      <ol className="estimate-checklist" aria-label="Pasos del cálculo">
        {steps.map((s, index) => <li key={s.key} className={index < run.step ? 'done' : index === run.step ? 'current' : ''} aria-current={index === run.step ? 'step' : undefined}>
          <span><Icon name={index < run.step ? 'check' : s.icon} size={19} /></span>{s.title}
        </li>)}
      </ol>
      <div className="estimate-loading-actions"><button onClick={cancel}>Cancelar</button><button onClick={skip}>Ver resultado<Icon name="chevron" size={16} /></button></div>
    </> : <>
      <Button className="estimate-submit" onClick={start}><Icon name="wheat" size={25} />{run.status === 'error' ? 'Intentar de nuevo' : 'Estimar rendimiento'}<Icon name="chevron" size={20} /></Button>
    </>}
  </section>;
}

const factors: { key: FactorKey; icon: IconName; title: string }[] = [
  { key: 'rain', icon: 'drop', title: 'Lluvia de octubre' },
  { key: 'neighbors', icon: 'pin', title: 'Cosechas cercanas' },
  { key: 'crop', icon: 'leaf', title: 'Señal del cultivo' },
];
function adjustmentText(value: number) {
  return Math.abs(value) < .005 ? 'Menos de 0.01 t/ha' : `${value < 0 ? '−' : '+'}${fmt(Math.abs(value))} t/ha`;
}

export function EstimateBreakdown({ estimate: e, parcel }: { estimate: Estimate; parcel: Parcel }) {
  const ranked = factors.filter(f => f.key !== 'crop' || e.kAvailable)
    .sort((a, b) => Math.abs(e.contributions[b.key]) - Math.abs(e.contributions[a.key]));
  const largest = ranked[0];
  const largestValue = e.contributions[largest.key];
  const max = Math.max(.005, ...Object.values(e.contributions).map(Math.abs));
  const delta = e.yield - e.referenceBase;
  return <section className="evidence-card estimate-breakdown">
    <h2><Icon name="chart" />¿Qué movió esta estimación?</h2>
    <p className="evidence-copy">Combinamos las cosechas de tu zona y de {parcel.municipality}, y ajustamos con los datos de tu parcela.</p>
    <div className="estimate-baseline"><span>Base de comparación<small>{e.territorialReferences === e.municipalReferences ? `${e.territorialReferences} cosechas conocidas` : `${e.territorialReferences} cosechas en la zona · ${e.municipalReferences} en el municipio`}</small></span><strong>{fmt(e.referenceBase)}<small>t/ha</small></strong></div>
    <p className="adjustment-axis"><span>↓ Baja la cifra</span><span>Sube la cifra ↑</span></p>
    <div className="adjustment-bars">
      {factors.map(f => {
        const value = e.contributions[f.key];
        const missing = f.key === 'crop' && !e.kAvailable;
        return <div className={`adjustment-row ${missing ? 'unavailable' : ''}`} key={f.key}>
          <div className="adjustment-label"><span><Icon name={f.icon} size={18} />{f.title}</span><strong>{missing ? 'Sin ajuste' : adjustmentText(value)}</strong></div>
          <div className="adjustment-track" aria-hidden="true"><i style={{ left: value < 0 ? `${50 - Math.abs(value) / max * 48}%` : '50%', width: `${Math.abs(value) / max * 48}%` }} className={value < 0 ? 'negative' : 'positive'} /></div>
          {missing && <small>Faltan datos para comparar el cultivo con su entorno.</small>}
        </div>;
      })}
    </div>
    <div className="estimate-takeaway"><Icon name={largest.icon} size={28} /><p><strong>{Math.abs(largestValue) < .005 ? 'Los ajustes fueron pequeños' : `${largest.title}: el mayor ajuste`}</strong>{Math.abs(largestValue) < .005 ? 'La estimación queda muy cerca de la base de comparación.' : `Fue el ajuste que más ${largestValue > 0 ? 'subió' : 'bajó'} la cifra respecto a esa referencia.`}</p></div>
    <p className="reading-interpretation">Con todos los ajustes, la estimación queda en <strong>{fmt(e.yield)} t/ha</strong>{Math.abs(delta) < .005 ? ', muy cerca de la base de comparación.' : `: ${fmt(Math.abs(delta))} ${delta > 0 ? 'más' : 'menos'} que esa referencia.`}</p>
  </section>;
}
