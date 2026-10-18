import { useId, useLayoutEffect, useRef, useState } from 'react';
import Icon from './Icons';
import type { Parcel } from './data/catalog';
import { fitZone, geography, scaleDistance } from './data/parcelZones';
import type { Box } from './data/parcelZones';
import imagery from './data/parcel-imagery.json';

type Backdrop = { file: string; box: number[] };
const backdrops = imagery.municipalities as Record<string, Backdrop>;

const fmt = (n: number) => n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ParcelMap({ items, selected, onSelect, onOpen, compact = false }: {
  items: Parcel[]; selected: string; onSelect: (p: Parcel) => void;
  onOpen: (p: Parcel) => void; compact?: boolean;
}) {
  const uid = useId().replaceAll(':', '');
  const stage = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const scaleBar = useRef<HTMLElement>(null);
  const scaleLabel = useRef<HTMLSpanElement>(null);
  const camera = useRef<Box | null>(null);
  const previousMunicipality = useRef('');
  const marker = useRef<SVGGElement>(null);
  const labelBubble = useRef<SVGGElement>(null);
  const labelLine = useRef<SVGPathElement>(null);
  const labelDot = useRef<SVGCircleElement>(null);
  const finder = useRef<HTMLDialogElement>(null);
  const finderInput = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [loadedImage, setLoadedImage] = useState('');
  const [failedImage, setFailedImage] = useState('');
  const [aspect, setAspect] = useState(1.2);
  const [zoomId, setZoomId] = useState<string | null>(null);
  const current = items.find(p => p.id === selected) ?? items[0];
  const allZones = geography.zones.filter(z => items.some(p => z.ids.includes(p.id)));
  const zone = allZones.find(z => z.ids.includes(current.id)) ?? allZones[0];
  const zones = allZones.filter(z => z.state === zone.state && z.municipality === zone.municipality);
  const index = zones.findIndex(z => z.id === zone.id);
  const visible = items.filter(p => zone.ids.includes(p.id));
  const municipalities = allZones.filter((z, i, all) => all.findIndex(q =>
    q.state === z.state && q.municipality === z.municipality) === i);
  const shape = geography.features[current.id];
  const [anchorX, anchorY] = shape.anchor;
  const zoomed = zoomId === current.id;
  const box = fitZone(zoomed ? shape.bbox : zone.bbox, aspect, zoomed ? 1.8 : 1.28);
  const [x, y, w, h] = box;
  const municipalityKey = `${zone.state}::${zone.municipality}`;
  const backdrop = backdrops[municipalityKey];
  const imageReady = loadedImage === municipalityKey && failedImage !== municipalityKey;
  const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[ _-]/g, '');
  const matches = items.filter(p => normalize(`${p.id} ${p.name} ${p.municipality} ${p.state}`).includes(normalize(query)));

  useLayoutEffect(() => {
    const element = stage.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width && height) setAspect(width / height);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const element = svg.current;
    if (!element) return;
    const target: Box = [x, y, w, h];
    const from = camera.current ?? target;
    const changeMunicipality = previousMunicipality.current !== municipalityKey;
    previousMunicipality.current = municipalityKey;
    const paint = (value: Box) => {
      element.setAttribute('viewBox', value.join(' '));
      camera.current = value;
      const metres = scaleDistance(value[2]);
      if (scaleBar.current) scaleBar.current.style.width = `${metres / value[2] * element.clientWidth}px`;
      if (scaleLabel.current) scaleLabel.current.textContent = metres >= 1000 ? `${metres / 1000} km` : `${metres} m`;
      // La etiqueta conserva su tamaño en pantalla durante todo el movimiento de cámara.
      const unit = value[2] / 360;
      const lx = Math.min(value[0] + value[2] - 51 * unit, Math.max(value[0] + 51 * unit, anchorX));
      const ly = Math.max(value[1] + 30 * unit, anchorY - 28 * unit);
      labelBubble.current?.setAttribute('transform', `translate(${lx} ${ly}) scale(${unit})`);
      labelLine.current?.setAttribute('d', `M${lx} ${ly}L${anchorX} ${anchorY}`);
      labelLine.current?.setAttribute('stroke-width', String(2 * unit));
      labelDot.current?.setAttribute('r', String(3 * unit));
      if (marker.current) marker.current.style.opacity = anchorX >= value[0] && anchorX <= value[0] + value[2]
        && anchorY >= value[1] && anchorY <= value[1] + value[3] ? '1' : '0';
    };
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (changeMunicipality || preference.matches || from.every((v, i) => Math.abs(v - target[i]) < 1e-7)) {
      paint(target);
      return;
    }
    let frame: number;
    let start: number | null = null;
    const animate = (time: number) => {
      if (start === null) start = time;
      const t = Math.min(1, (time - start) / 580);
      const ease = t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
      paint(from.map((v, i) => v + (target[i] - v) * ease) as Box);
      if (t < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    const stopForPreference = () => { if (preference.matches) { cancelAnimationFrame(frame); paint(target); } };
    preference.addEventListener('change', stopForPreference);
    return () => { cancelAnimationFrame(frame); preference.removeEventListener('change', stopForPreference); };
  }, [x, y, w, h, municipalityKey, anchorX, anchorY]);

  function selectZone(id: string) {
    const next = allZones.find(z => z.id === id);
    const p = items.find(p => next?.ids.includes(p.id));
    if (p) { setZoomId(null); onSelect(p); }
  }
  function changeMunicipality(key: string) {
    const next = allZones.find(z => `${z.state}::${z.municipality}` === key);
    if (next) selectZone(next.id);
  }

  return <section className={`sector-map ${compact ? 'sector-compact' : ''}`} aria-label="Explorar parcelas por zonas reales">
    <div className={`sector-selectors ${compact ? 'two-selectors' : 'with-finder'}`}>
      {compact && <label><span>Estado</span><select value={zone.state} aria-label="Estado del visor de Inicio"
        onChange={e => {
          const first = allZones.find(z => z.state === e.target.value);
          if (first) selectZone(first.id);
        }}>
        {[...new Set(allZones.map(z => z.state))].map(s => <option key={s}>{s}</option>)}
      </select></label>}
      <label><span>Municipio</span><select value={municipalityKey} aria-label={compact ? 'Municipio del visor de Inicio' : 'Municipio de las parcelas'}
        onChange={e => changeMunicipality(e.target.value)}>
        {municipalities.filter(z => !compact || z.state === zone.state).map(z => (
          <option key={`${z.state}::${z.municipality}`} value={`${z.state}::${z.municipality}`}>
            {z.municipality}{!compact && new Set(items.map(p => p.state)).size > 1 ? ` · ${z.state}` : ''}
          </option>
        ))}
      </select></label>
      {!compact && <button className="sector-find-trigger" onClick={() => {
        setQuery(''); finder.current?.showModal(); finderInput.current?.focus();
      }}><Icon name="list" size={18} />Buscar parcela</button>}
    </div>
    <div className={`sector-stage ${imageReady ? 'has-imagery' : ''}`} ref={stage}>
      {backdrop && failedImage !== municipalityKey && <img hidden key={`preload-${municipalityKey}`} alt=""
        src={`${import.meta.env.BASE_URL}map-imagery/${backdrop.file}`}
        onLoad={() => setLoadedImage(municipalityKey)} onError={() => setFailedImage(municipalityKey)} />}
      <svg key={municipalityKey} className="sector-scene" ref={svg} viewBox="0 0 1 1"
        preserveAspectRatio="xMidYMid meet" aria-label={`Contornos oficiales de ${zone.municipality}, zona ${index + 1}`}>
        <defs>
          <pattern id={`${uid}-rows`} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(-22)">
            <path d="M0 1h12M0 7h12" stroke="#e4e9bf" strokeWidth="1.3" opacity=".2" />
          </pattern>
        </defs>
        {backdrop && failedImage !== municipalityKey && <image className="satellite-raster"
          key={municipalityKey} x={backdrop.box[0]} y={backdrop.box[1]} width={backdrop.box[2]} height={backdrop.box[3]}
          href={`${import.meta.env.BASE_URL}map-imagery/${backdrop.file}`}
          preserveAspectRatio="none" aria-hidden="true" pointerEvents="none" />}
        {Object.values(geography.features).filter(s => s.state === zone.state && s.municipality === zone.municipality).map(s => {
          const active = zone.ids.includes(s.id);
          const chosen = s.id === current.id;
          return <g key={s.id} className={`sector-field ${active ? 'in-zone' : 'context'} ${chosen ? 'is-selected' : ''}`}
            role={active ? 'button' : undefined} tabIndex={active && (!zoomed || chosen) ? 0 : undefined}
            aria-label={active ? `Elegir ${s.id}` : undefined} aria-pressed={active ? chosen : undefined}
            aria-hidden={active ? undefined : true}
            onClick={active ? () => onSelect(items.find(p => p.id === s.id)!) : undefined}
            onKeyDown={active ? e => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(items.find(p => p.id === s.id)!); }
            } : undefined}>
            <title>{s.id}</title>
            <path d={s.path} className="sector-shape" fillRule="evenodd" vectorEffect="non-scaling-stroke" />
            {!imageReady && <path d={s.path} fill={`url(#${uid}-rows)`} fillRule="evenodd" pointerEvents="none" />}
            {active && <path d={s.path} className="sector-hit" vectorEffect="non-scaling-stroke" />}
          </g>;
        })}
        <g ref={marker} className="sector-label" aria-hidden="true" pointerEvents="none">
          <path ref={labelLine} stroke="#fffdf1" />
          <g ref={labelBubble}>
            <rect x="-47" y="-21" width="94" height="25" rx="8" fill="#fffef4" />
            <text y="-4" textAnchor="middle" fontSize="13" fontWeight="900" fill="#254c36">{current.id}</text>
          </g>
          <circle ref={labelDot} cx={anchorX} cy={anchorY} fill="#fffef4" />
        </g>
      </svg>
      <span className="sector-north" aria-label="Norte hacia arriba">↑<b>N</b></span>
      <span className="sector-source">{imageReady ? 'Satélite · 27 oct 2025' : failedImage === municipalityKey ? 'Contornos · imagen no disponible' : 'Cargando imagen satelital…'}</span>
      <div className="sector-scale" aria-label="Escala del encuadre"><i ref={scaleBar} /><span ref={scaleLabel} /></div>
      <button className="sector-zoom" aria-label={zoomed ? 'Ver toda la zona' : 'Acercar parcela seleccionada'}
        onClick={() => setZoomId(zoomed ? null : current.id)}><Icon name={zoomed ? 'minus' : 'plus'} size={20} /></button>
    </div>
    <div className="sector-navigation">
      <button disabled={index === 0} aria-label="Zona anterior" onClick={() => selectZone(zones[index - 1].id)}><Icon name="back" size={21} /></button>
      <span role="status" aria-live="polite" aria-atomic="true"><strong>Zona {index + 1} de {zones.length}</strong><span>{zone.ids.length} {zone.ids.length === 1 ? 'parcela' : 'parcelas'}</span></span>
      <button disabled={index === zones.length - 1} aria-label="Zona siguiente" onClick={() => selectZone(zones[index + 1].id)}><Icon name="chevron" size={21} /></button>
    </div>
    <div className="sector-selected">
      <label><span>Parcela · {fmt(current.area)} ha</span><select value={current.id}
        aria-label={compact ? 'Parcela de la zona de Inicio' : 'Parcela de esta zona'}
        onChange={e => onSelect(items.find(p => p.id === e.target.value)!)}>
        {visible.map(p => <option key={p.id} value={p.id}>{p.id}</option>)}
      </select></label>
      <button onClick={() => onOpen(current)}>{compact ? 'Explorar' : 'Ver parcela'}<Icon name="chevron" size={17} /></button>
    </div>
    <p className="sector-caption">{imageReady ? <><a href="https://registry.opendata.aws/sentinel-2-l2a-cogs/" target="_blank" rel="noreferrer">Copernicus Sentinel‑2 · Earth Search</a> · 10 m/píxel</> : 'Contornos oficiales del SHP'}</p>
    {!compact && <dialog ref={finder} className="sector-finder" aria-labelledby={`${uid}-finder-title`}
      onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); finder.current?.close(); } }}>
      <header><div><h2 id={`${uid}-finder-title`}>Encuentra tu parcela</h2><p>Elígela para verla en el mapa</p></div>
        <button aria-label="Cerrar búsqueda de parcelas" onClick={() => finder.current?.close()}><Icon name="close" size={23} /></button>
      </header>
      <label className="sector-finder-input"><span>Identificador o municipio</span>
        <input ref={finderInput} type="search" value={query} placeholder="Ej. AGC_042 o Singuilucan"
          onChange={e => setQuery(e.target.value)} />
      </label>
      <p className="sector-finder-count" role="status">{matches.length} {matches.length === 1 ? 'parcela' : 'parcelas'}</p>
      <div className="sector-finder-results">
        {!matches.length && <p className="sector-finder-empty">No encontramos esa parcela. Prueba con otro ID o municipio.</p>}
        {matches.map(p => <button key={p.id} aria-label={`Ubicar ${p.id} en el mapa`} aria-pressed={p.id === current.id}
          onClick={() => { setZoomId(null); onSelect(p); finder.current?.close(); }}>
          <Icon name="pin" size={22} /><span><strong>{p.id}</strong><small>{p.municipality} · {p.state}</small></span>
          <span className="sector-finder-area">{fmt(p.area)} ha<Icon name="chevron" size={16} /></span>
        </button>)}
      </div>
    </dialog>}
  </section>;
}
