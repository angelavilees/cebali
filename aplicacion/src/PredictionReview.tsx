import { useState } from 'react';
import type { RefObject } from 'react';
import Disclosure from './components/ui/Disclosure';
import Icon from './Icons';
import runtime from './model/oct-g5-runtime.json';
import { predictPrepared } from './model/octG5';
import type { Estimate, ModelBundle } from './model/octG5';
import type { Parcel } from './data/catalog';

const fmt = (value: number, digits = 2) => value.toLocaleString('es-MX', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export type ReviewView = { scope: 'municipality' | 'state'; showAll: boolean };
export default function PredictionReview({ parcel, items, onSelect, accordionName, panelRef, view, onViewChange }: {
  parcel: Parcel; items: Parcel[]; onSelect: (parcel: Parcel, estimate: Estimate) => void;
  view: ReviewView; onViewChange: (view: ReviewView) => void;
  accordionName: string; panelRef: RefObject<HTMLDetailsElement | null>;
}) {
  const { scope, showAll } = view;
  const [estimates] = useState(() => new Map(predictPrepared(runtime as unknown as ModelBundle, runtime.inputs).map(p => [p.id, p])));
  const rows = items.filter(p => p.yieldKind === 'estimated' && (scope === 'municipality' ? p.municipality === parcel.municipality : p.state === parcel.state))
    .map(p => ({ ...p, yield: estimates.get(p.id)!.yield })).sort((a, b) => a.yield - b.yield || a.id.localeCompare(b.id));
  const visible = showAll ? rows : rows.slice(0, 5);
  return <Disclosure ref={panelRef} name={accordionName} icon="chart" title="Organizar la revisión" className="prediction-review">
    <p className="evidence-copy">De menor a mayor rendimiento estimado. Elige una parcela para revisar su lluvia y verdor.</p>
    <div className="segmented review-scope" role="group" aria-label="Dónde organizar la revisión">
      <button aria-pressed={scope === 'municipality'} className={scope === 'municipality' ? 'selected' : ''} onClick={() => onViewChange({scope: 'municipality', showAll: false})}>Municipio</button>
      <button aria-pressed={scope === 'state'} className={scope === 'state' ? 'selected' : ''} onClick={() => onViewChange({scope: 'state', showAll: false})}>Estado</button>
    </div>
    <p className="review-location">{scope === 'municipality' ? parcel.municipality : parcel.state} · {rows.length} {rows.length === 1 ? 'estimación' : 'estimaciones'}</p>
    <ol className="review-list" aria-label="Parcelas ordenadas por rendimiento estimado">
      {visible.map(p => <li key={p.id}><button aria-label={`Revisar ${p.id}, ${fmt(p.yield)} toneladas por hectárea`} aria-current={p.id === parcel.id ? 'true' : undefined} onClick={() => onSelect(p, estimates.get(p.id)!)}>
        <span><strong>{p.id}</strong><small>{p.municipality}</small></span>
        <span className="review-numbers"><strong>{fmt(p.yield)} t/ha</strong><small>{fmt(p.area * p.yield, 1)} t en {fmt(p.area)} ha</small></span><Icon name="chevron" size={17} />
      </button></li>)}
    </ol>
    {rows.length > 5 && <button className="model-link" onClick={() => onViewChange({...view, showAll: !showAll})}>{showAll ? 'Mostrar menos' : `Ver las ${rows.length} parcelas`}<Icon name="chevron" size={18} /></button>}
    <p className="evidence-copy">Un rendimiento menor no indica por sí solo un problema del cultivo. Compara también las condiciones de cada parcela.</p>
  </Disclosure>;
}
