import { useId, useState } from 'react';
import type { CSSProperties } from 'react';
import Icon from './Icons';
import { revealDisclosure } from './components/ui/revealDisclosure';
import runtime from './model/oct-g5-runtime.json';
import support from './model/rain-support.json';
import { rainRange, simulateRain } from './model/rainScenarios';
import { MODEL_ID } from './model/octG5';
import { displayedDifference } from './model/presentation';
import type { Estimate, ModelBundle } from './model/octG5';
import type { Parcel } from './data/catalog';

const bundle = runtime as unknown as ModelBundle;
const fmt = (value: number, digits = 2) => value.toLocaleString('es-MX', {
  minimumFractionDigits: digits, maximumFractionDigits: digits,
});

export default function RainExplorer({ parcel, estimate, accordionName }: { parcel: Parcel; estimate: Estimate; accordionName?: string }) {
  const id = useId();
  const [selectedRain, setSelectedRain] = useState<number | null>(null);
  const input = bundle.inputs.find(row => row.ID_POLIGONO === parcel.id);
  if (!input || estimate.modelId !== MODEL_ID || estimate.id !== parcel.id) return null;
  const range = rainRange(input, support);
  const rain = selectedRain ?? input.P;
  const scenario = range ? simulateRain(bundle, input, rain, support) : null;
  const changed = Math.abs(rain - input.P) > 1e-8;
  const difference = displayedDifference(scenario?.yield ?? estimate.yield, estimate.yield);
  const rainDifference = rain - input.P;
  const position = range ? (rain - range.min) / (range.max - range.min) * 100 : 0;
  const chartMax = Math.ceil(Math.max(estimate.yield, scenario?.yield ?? 0,
    ...bundle.model.known.map(row => row.y)));
  const deltaText = Math.abs(difference) < .005
    ? changed ? 'Cambio menor a 0.01 t/ha' : 'Mismo resultado'
    : `${difference > 0 ? '+' : '−'}${fmt(Math.abs(difference))} t/ha en el cálculo`;

  return <details className="rain-explorer" name={accordionName} onToggle={event => revealDisclosure(event.currentTarget)}>
    <summary>
      <span className="rain-summary-icon"><Icon name="drop" size={25} /></span>
      <span><strong>Explora tu estimación</strong><span>¿Y si hubiera llovido diferente?</span></span>
      <Icon name="chevron" size={21} />
    </summary>
    <div className="rain-explorer-body">
      <span className="rain-scenario-badge"><Icon name="sun" size={17} />Escenario hipotético</span>
      {!range || !scenario ? <div className="rain-unavailable">
        <Icon name="pin" size={31} />
        <h3>Aquí faltan referencias</h3>
        <p>No tenemos suficientes datos de lluvia en este municipio para explorar cambios. Tu estimación original sigue disponible.</p>
      </div> : <>
        <p className="rain-intro" id={`${id}-context`}>Cambia solo la lluvia de octubre. Conservamos las cosechas cercanas y los demás datos de tu parcela.</p>
        <div className="rain-control">
          <div className="rain-control-label">
            <label htmlFor={`${id}-rain`}>Lluvia de octubre</label>
            <output htmlFor={`${id}-rain`}>{fmt(rain, 1)}<span> mm</span></output>
          </div>
          <div className="rain-weather" aria-hidden="true">
            <svg viewBox="0 0 240 63" fill="none">
              <circle cx="194" cy="22" r="12" fill="#ffcf5a" />
              <path d="M170 22h-5m40 0h5M194 3v-4m0 46v-5m-14-4-4 4m28-31 4-4" stroke="#f5bb38" strokeWidth="3" strokeLinecap="round" />
              <path d="M81 32c-15 0-16-19-3-22 1-14 23-16 29-3 12-5 25 2 25 12 14-1 17 13 3 13H81Z" fill="white" />
              {[78, 91, 104, 117, 130].map((x, i) => <path key={x} className="rain-falling-drop"
                style={{ animationDelay: `${i * -.24}s`, opacity: .45 + position / 200 }}
                d={`M${x} 40l-3 7`} stroke="#239fda" strokeWidth="3" strokeLinecap="round" />)}
              <path d="M0 60c36-13 65-6 95-1 38-14 87-12 145-1v5H0Z" fill="#c5e8b4" />
            </svg>
          </div>
          <input id={`${id}-rain`} className="rain-range" type="range" min={range.min}
            max={range.max} step="any" value={rain} aria-describedby={`${id}-context`}
            aria-valuetext={`${fmt(rain, 1)} milímetros de lluvia en octubre`}
            onChange={event => setSelectedRain(Number(event.currentTarget.value))}
            style={{ '--rain-position': `${position}%` } as CSSProperties} />
          <div className="rain-range-labels"><span>{fmt(range.min, 1)} mm</span><span>{fmt(range.max, 1)} mm</span></div>
          <div className="rain-presets" role="group" aria-label="Escenarios de lluvia">
            <button type="button" onClick={() => setSelectedRain(range.min)}
              disabled={input.P - range.min < 1e-7} aria-pressed={changed && Math.abs(rain - range.min) < 1e-7}>
              <Icon name="minus" size={16} />Menos
            </button>
            <button type="button" onClick={() => setSelectedRain(null)} aria-pressed={!changed}>Original</button>
            <button type="button" onClick={() => setSelectedRain(range.max)}
              disabled={range.max - input.P < 1e-7} aria-pressed={changed && Math.abs(rain - range.max) < 1e-7}>
              Más<Icon name="plus" size={16} />
            </button>
          </div>
        </div>
        <div className="rain-comparison" aria-label="Comparación del rendimiento original y el escenario">
          {[{ key: 'original', label: 'Original', value: estimate.yield },
            { key: 'scenario', label: 'Escenario', value: scenario.yield }].map(item => (
            <div key={item.key} className={`rain-result ${item.key}`}>
              <span>{item.label}</span><strong>{fmt(item.value)}</strong><span>t/ha</span>
              <div className="rain-bar-well" aria-hidden="true"><div className="rain-yield-bar"
                style={{ height: `${Math.max(0, item.value) / chartMax * 100}%` }}><Icon name="wheat" size={22} /></div></div>
            </div>
          ))}
        </div>
        <div className={`rain-change ${changed ? 'has-change' : ''}`} role="status" aria-live="polite" aria-atomic="true">
          <Icon name={changed ? 'chart' : 'check'} size={22} />
          <span><strong>{deltaText}</strong>{changed
            ? `${fmt(Math.abs(rainDifference), 1)} mm ${rainDifference > 0 ? 'más' : 'menos'} que los datos originales.`
            : 'Mueve la lluvia para comparar.'}</span>
        </div>
        <p className="rain-scope">Así responde el modelo al cambiar solo la lluvia. No es una previsión de otra cosecha.</p>
        <button className="rain-reset" type="button" disabled={!changed} onClick={() => setSelectedRain(null)}>
          <Icon name="back" size={18} />Restablecer datos originales
        </button>
      </>}
    </div>
  </details>;
}
