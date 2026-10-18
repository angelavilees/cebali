import { useState } from 'react';
import type { Parcel } from './data/catalog';
import { fitZone, geography } from './data/parcelZones';
import imagery from './data/parcel-imagery.json';

type Backdrop = { file: string; box: number[] };
const backdrops = imagery.municipalities as Record<string, Backdrop>;

export default function ParcelHeader({ parcel }: { parcel: Parcel }) {
  const shape = geography.features[parcel.id];
  const backdrop = backdrops[`${parcel.state}::${parcel.municipality}`];
  const [loaded, setLoaded] = useState('');
  const [failed, setFailed] = useState('');
  const ready = loaded === backdrop.file && failed !== backdrop.file;
  const [x, y, width, height] = fitZone(shape.bbox, 2, 1.7);
  return <figure className="parcel-photo parcel-satellite" data-image-ready={ready} aria-label={`Imagen satelital real y límite oficial de ${parcel.id}, 27 de octubre de 2025`}>
    {failed !== backdrop.file && <img hidden key={`load-${backdrop.file}`} alt=""
      src={`${import.meta.env.BASE_URL}map-imagery/${backdrop.file}`}
      onLoad={() => setLoaded(backdrop.file)} onError={() => setFailed(backdrop.file)} />}
    <svg className="parcel-satellite-scene" viewBox={[x, y, width, height].join(' ')}
      role="img" aria-label={`Ubicación y contorno real de ${parcel.id}, norte arriba`}>
      {failed !== backdrop.file && <image className="satellite-raster"
        href={`${import.meta.env.BASE_URL}map-imagery/${backdrop.file}`}
        x={backdrop.box[0]} y={backdrop.box[1]} width={backdrop.box[2]} height={backdrop.box[3]}
        preserveAspectRatio="none" />}
      <path d={shape.path} fill={ready ? '#f5d94b24' : '#b6c56a'} stroke="#ffe765"
        strokeWidth="2" vectorEffect="non-scaling-stroke" fillRule="evenodd" strokeLinejoin="round" />
    </svg>
    <span className="parcel-satellite-kind">{ready ? 'Imagen satelital' : failed === backdrop.file ? 'Imagen no disponible' : 'Cargando satélite…'}</span>
    <span className="parcel-satellite-north" aria-label="Norte hacia arriba">↑ N</span>
    <figcaption className="parcel-satellite-credit">
      <span>{ready ? '27 oct 2025 · 10 m/píxel' : 'Contorno oficial'}</span>
      {ready && <a href="https://registry.opendata.aws/sentinel-2-l2a-cogs/" target="_blank" rel="noreferrer">Copernicus Sentinel‑2</a>}
    </figcaption>
  </figure>;
}
