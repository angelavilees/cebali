import { useId, useRef, useState } from 'react';
import Icon from '../../Icons';

type Option = { value: string; label: string; description?: string };
const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Selector compartido: opciones legibles, búsqueda en listas largas y foco nativo del diálogo. */
export default function ChoiceSelect({ label, ariaLabel = label, title, value, options, onChange }: {
  label: string; ariaLabel?: string; title: string; value: string; options: Option[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  const sheet = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find(option => option.value === value);
  const searchable = options.length > 7;
  const matches = options.filter(option => normalize(`${option.label} ${option.description ?? ''}`).includes(normalize(query)));
  function open() {
    setQuery('');
    sheet.current?.showModal();
    setExpanded(true);
    if (searchable) search.current?.focus();
    else list.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
  }
  return <div className="choice-field">
    <span id={`${id}-label`} className="choice-label">{label}</span>
    <button type="button" className="choice-trigger" aria-label={`${ariaLabel}: ${selected?.label ?? value}`}
      aria-haspopup="dialog" aria-expanded={expanded} aria-controls={`${id}-dialog`} onClick={open}>
      <span>{selected?.label ?? value}</span><Icon name="chevron" size={16} />
    </button>
    <dialog id={`${id}-dialog`} ref={sheet} className="choice-sheet" aria-labelledby={`${id}-title`}
      onClose={() => setExpanded(false)}
      onClick={event => { if (event.target === event.currentTarget) sheet.current?.close(); }}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); sheet.current?.close(); }
      }}>
      <div className="choice-sheet-body">
        <header><div><span className="choice-eyebrow">TU CAMPO</span><h2 id={`${id}-title`}>{title}</h2></div>
          <button type="button" className="icon-button" aria-label={`Cerrar: ${title}`} onClick={() => sheet.current?.close()}><Icon name="close" size={22} /></button>
        </header>
        {searchable && <label className="choice-search"><Icon name="search" size={19} />
          <input ref={search} type="search" aria-label={`Buscar: ${ariaLabel.toLowerCase()}`} placeholder="Escribe para encontrar…" value={query} onChange={event => setQuery(event.target.value)} />
        </label>}
        <div ref={list} className="choice-options" aria-label={`Opciones de ${label.toLowerCase()}`}
          onKeyDown={event => {
            if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
            const buttons = Array.from(list.current?.querySelectorAll<HTMLButtonElement>('button') ?? []);
            if (!buttons.length) return;
            event.preventDefault();
            const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
              : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
            buttons[next].focus();
          }}>
          {matches.map(option => <button type="button" key={option.value} aria-pressed={option.value === value}
            onClick={() => { sheet.current?.close(); onChange(option.value); }}>
            <span><strong>{option.label}</strong>{option.description && <small>{option.description}</small>}</span>
            <span className="choice-check" aria-hidden="true">{option.value === value && <Icon name="check" size={18} />}</span>
          </button>)}
          {!matches.length && <p className="choice-empty" role="status">No encontramos coincidencias. Prueba otro nombre o identificador.</p>}
        </div>
      </div>
    </dialog>
  </div>;
}
