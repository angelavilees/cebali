import { useId, useRef, useState } from 'react';
import Icon from './Icons';
import type { Parcel } from './data/catalog';

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

export default function PredictionFinder({ items, selected, onSelect }: {
  items: Parcel[]; selected: Parcel; onSelect: (parcel: Parcel) => void;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const matches = items.filter(p => normalize(`${p.id} ${p.municipality} ${p.state}`).includes(normalize(query)));
  function open() {
    setQuery('');
    dialog.current?.showModal();
    input.current?.focus();
  }
  return <>
    <button className="prediction-finder-trigger" aria-label={`Buscar parcela para estimar: ${selected.id}, ${selected.municipality}`} onClick={open}>
      <span><strong>{selected.id}</strong><small>{selected.municipality}</small></span><Icon name="search" size={20} />
    </button>
    <dialog ref={dialog} className="sector-finder prediction-finder" aria-labelledby={`${id}-title`}
      onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); dialog.current?.close(); } }}>
      <header><div><h2 id={`${id}-title`}>Elige qué parcela estimar</h2><p>Busca por identificador o municipio</p></div>
        <button aria-label="Cerrar búsqueda de predicciones" onClick={() => dialog.current?.close()}><Icon name="close" size={23} /></button>
      </header>
      <label className="sector-finder-input"><span>Identificador o municipio</span>
        <input ref={input} type="search" value={query} placeholder="Ej. AGC_120 o Chignahuapan" onChange={event => setQuery(event.target.value)} />
      </label>
      <p className="sector-finder-count" role="status">{matches.length} {matches.length === 1 ? 'parcela' : 'parcelas'} para estimar</p>
      <div className="sector-finder-results">
        {!matches.length && <p className="sector-finder-empty">No encontramos esa parcela en este filtro. Prueba otro identificador, municipio o estado.</p>}
        {matches.map(p => <button key={p.id} aria-label={`Estimar ${p.id}, ${p.municipality}`} aria-pressed={p.id === selected.id}
          onClick={() => { dialog.current?.close(); onSelect(p); }}>
          <Icon name="pin" size={22} /><span><strong>{p.id}</strong><small>{p.municipality} · {p.state}</small></span><Icon name="chevron" size={18} />
        </button>)}
      </div>
    </dialog>
  </>;
}
