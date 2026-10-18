import { useRef, useState } from 'react';
import Icon from './Icons';
import { parcels } from './data/catalog';
import type { Parcel } from './data/catalog';
import type { Estimate } from './model/octMix';

export default function FichaDownload({ parcel, estimate }: { parcel: Parcel; estimate: Estimate | null }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const busy = useRef(false);
  async function download() {
    if (busy.current) return;
    busy.current = true;
    setStatus('loading');
    try {
      const [{ createParcelFicha, loadFichaFonts, saveParcelFicha }, { modelEvidence }] = await Promise.all([
        import('./reports/parcelFicha'), import('./data/evidence'),
      ]);
      const references = parcels.filter(p => p.yieldKind === 'observed'
        && p.municipality === parcel.municipality && p.id !== parcel.id);
      const support = modelEvidence.parcels[parcel.id];
      const review = support?.priorityReview
        ? support.climateSupportIncomplete
          ? 'Faltan cosechas conocidas que compartan los datos de lluvia de esta parcela.'
          : 'Solo tenemos una cosecha conocida de este municipio para comparar.'
        : null;
      const doc = createParcelFicha({ parcel, estimate,
        reference: references.length ? { count: references.length,
          mean: references.reduce((s, p) => s + p.yield, 0) / references.length } : null,
        review }, await loadFichaFonts());
      saveParcelFicha(doc, parcel.id);
      setStatus('ready');
    } catch {
      setStatus('error');
    } finally {
      busy.current = false;
    }
  }
  return <div className="ficha-download">
    <button className="ficha-button" disabled={status === 'loading'} onClick={download}>
      <Icon name="download" size={23} /><span>{status === 'loading' ? 'Preparando ficha…' : 'Descargar ficha'}<small>PDF · {parcel.id}</small></span>
      {status === 'ready' && <Icon name="check" size={20} />}
    </button>
    <p className={status === 'error' ? 'ficha-error' : 'sr-only'} role="status" aria-live="polite">
      {status === 'error' ? 'No pudimos preparar el PDF. Pulsa de nuevo para intentarlo.' : status === 'ready' ? `Ficha PDF de ${parcel.id} preparada.` : ''}
    </p>
  </div>;
}
