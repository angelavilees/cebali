import { jsPDF } from 'jspdf';
import type { Parcel } from '../data/catalog';
import type { Estimate } from '../model/octMix';

export type FichaData = {
  parcel: Parcel;
  estimate: Estimate | null;
  reference: { mean: number; count: number } | null;
  review: string | null;
};
export type FichaFonts = { regular: string; bold: string };
const number = (n: number, digits = 2) => n.toLocaleString('es-MX', {
  minimumFractionDigits: digits, maximumFractionDigits: digits,
});
const colors = {
  ink: '#111633', green: '#087D43', pale: '#EAF5DF', blue: '#E4F4FC',
  cream: '#FFFDF6', muted: '#51665F', line: '#DEE5D6', amber: '#FFF2CB', coral: '#FBE6DC',
};

// Recibe el resultado ejecutado, nunca sustituye la estimación por la tabla guardada.
export function createParcelFicha(data: FichaData, fonts: FichaFonts) {
  const { parcel: p, estimate: e, reference, review } = data;
  const estimated = p.yieldKind === 'estimated';
  if (estimated && (!e || e.id !== p.id || !Number.isFinite(e.yield))) {
    throw new Error('Primero calcula esta parcela.');
  }
  const value = estimated ? e!.yield : p.yield;
  if (![value, p.area, p.ndvi, p.rain, p.temperature].every(Number.isFinite)
      || value < 0 || p.area <= 0) throw new Error('Datos de ficha inválidos.');

  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.addFileToVFS('Nunito-Regular.ttf', fonts.regular);
  doc.addFont('Nunito-Regular.ttf', 'Nunito', 'normal');
  doc.addFileToVFS('Nunito-Bold.ttf', fonts.bold);
  doc.addFont('Nunito-Bold.ttf', 'Nunito', 'bold');
  doc.setProperties({ title: `Cebali - ${p.id} - ciclo 2025`, author: 'Cebali',
    subject: estimated ? 'Ficha de rendimiento estimado' : 'Ficha de cosecha conocida' });
  const text = (s: string, x: number, y: number, size = 10, bold = false, color = colors.ink) => {
    doc.setFont('Nunito', bold ? 'bold' : 'normal');
    doc.setFontSize(size); doc.setTextColor(color); doc.text(s, x, y);
  };
  const paragraph = (s: string, x: number, y: number, width: number, size = 9, color = colors.muted) => {
    doc.setFont('Nunito', 'normal'); doc.setFontSize(size); doc.setTextColor(color);
    const lines = doc.splitTextToSize(s, width) as string[];
    doc.text(lines, x, y, { lineHeightFactor: 1.25 });
    return lines.length * size * .3528 * 1.25;
  };
  const box = (x: number, y: number, w: number, h: number, fill: string) => {
    doc.setFillColor(fill); doc.roundedRect(x, y, w, h, 4, 4, 'F');
  };
  doc.setFillColor(colors.cream); doc.rect(0, 0, 210, 297, 'F');
  text('Cebali', 16, 20, 23, true, colors.green);
  text('TU FICHA DE PARCELA', 126, 17, 9, true, colors.green);
  text('Ciclo 2025 | Abril a octubre', 126, 23, 9, false, colors.muted);
  text(p.id, 16, 35, 20, true);
  const locationHeight = paragraph(`${p.municipality}, ${p.state}`, 16, 41, 177, 10);
  let y = 45 + locationHeight;

  box(16, y, 178, 32, colors.pale);
  text(estimated ? 'Cosecha estimada' : 'Cosecha conocida', 22, y + 7, 10, true, colors.green);
  text(number(value), 22, y + 22, 30, true, colors.green);
  text('toneladas por hectárea', 69, y + 21, 10, false, colors.green);
  text(`Aprox. ${number(value * p.area, 1)} toneladas en toda la parcela`, 22, y + 28, 10, true);
  text(`${number(p.area)} ha`, 164, y + 8, 10, true, colors.green);
  y += 38;

  if (review) {
    doc.setFont('Nunito', 'normal'); doc.setFontSize(9);
    const h = (doc.splitTextToSize(review, 164) as string[]).length * 4 + 13;
    box(16, y, 178, h, colors.amber);
    text('Revisa esta cifra con tu técnico', 22, y + 6, 10, true);
    paragraph(review, 22, y + 12, 164, 9);
    y += h + 5;
  }

  if (estimated && e) {
    text('¿Qué movió la estimación?', 16, y + 4, 13, true);
    text(`Referencia municipal: ${number(e.municipalBase)} t/ha`, 16, y + 10, 9, false, colors.muted);
    const rows = [
      { label: 'Lluvia de octubre', value: e.contributions.rain, missing: false },
      { label: 'Cosechas cercanas', value: e.contributions.neighbors, missing: false },
      { label: 'Señal del cultivo', value: e.contributions.crop, missing: !e.kAvailable },
    ];
    const max = Math.max(.005, ...rows.map(r => Math.abs(r.value)));
    rows.forEach((row, i) => {
      const ry = y + 18 + i * 8;
      text(row.label, 16, ry, 10);
      doc.setDrawColor(colors.line); doc.setLineWidth(.6); doc.line(83, ry - 1, 153, ry - 1);
      doc.setLineWidth(.3); doc.line(118, ry - 4, 118, ry + 1);
      const width = Math.abs(row.value) / max * 33;
      if (!row.missing && width > .01) {
        doc.setFillColor(row.value < 0 ? '#D87F42' : colors.green);
        doc.roundedRect(row.value < 0 ? 118 - width : 118, ry - 2.4, width, 2.8, .8, .8, 'F');
      }
      const label = row.missing ? 'Sin ajuste' : Math.abs(row.value) < .005
        ? '< 0.01 t/ha' : `${row.value >= 0 ? '+' : '-'}${number(Math.abs(row.value))} t/ha`;
      text(label, 158, ry, 9, true, row.missing ? colors.muted : colors.ink);
    });
    const top = rows.filter(r => !r.missing).sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0];
    const explanation = Math.abs(top.value) < .005 ? 'Los ajustes fueron pequeños respecto a la referencia municipal.'
      : `${top.label} fue el mayor ajuste: ${top.value >= 0 ? 'subió' : 'bajó'} la cifra respecto a la referencia municipal.`;
    const extra = !e.kAvailable ? ' Faltan datos para comparar el cultivo con su entorno.' : '';
    const h = paragraph(explanation + extra, 16, y + 43, 178, 9);
    y += 44 + h;
  } else {
    y += paragraph('Este rendimiento es el dato oficial de cosecha conocida. No es una estimación del modelo.', 16, y + 3, 178, 10) + 8;
  }

  text('Datos del ciclo', 16, y + 3, 13, true);
  const facts = [
    ['Vegetación verde', number(p.ndvi), 'NDVI del ciclo', colors.pale],
    ['Lluvia acumulada', `${number(p.rain, 0)} mm`, 'Abril a octubre', colors.blue],
    ['Temperatura media', `${number(p.temperature, 1)} °C`, 'Media aproximada', colors.amber],
  ];
  facts.forEach(([title, val, caption, color], i) => {
    const x = 16 + i * 61;
    box(x, y + 7, 56, 23, color);
    text(title, x + 4, y + 13, 8, true);
    text(val, x + 4, y + 21, 16, true);
    text(caption, x + 4, y + 27, 7, false, colors.muted);
  });
  y += 38;

  text('Así cambió el verdor por mes', 16, y, 13, true);
  const chartTop = y + 6, chartBottom = chartTop + 21;
  const px = (i: number) => 31 + i * 25;
  const py = (v: number) => chartBottom - v * 21;
  for (const tick of [0, .5, 1]) {
    doc.setDrawColor(colors.line); doc.setLineWidth(.2);
    doc.line(29, py(tick), 187, py(tick));
    text(number(tick, 1), 17, py(tick) + 1, 7, false, colors.muted);
  }
  p.history.forEach((v, i) => {
    if (v === null) return;
    const previous = p.history[i - 1];
    doc.setDrawColor(colors.green); doc.setLineWidth(.8);
    if (i > 0 && previous !== null) doc.line(px(i - 1), py(previous), px(i), py(v));
    doc.setFillColor(colors.green); doc.circle(px(i), py(v), 1.1, 'F');
  });
  ['Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct'].forEach((m, i) => text(m, px(i) - 3, chartBottom + 5, 8, false, colors.muted));
  y = chartBottom + 10;

  const delta = reference ? value - reference.mean : null;
  let reading = reference && delta !== null
    ? `${estimated ? 'Se esperan' : 'Se registraron'} ${number(Math.abs(delta))} t/ha ${delta >= 0 ? 'más' : 'menos'} que la referencia de ${reference.count} ${reference.count === 1 ? 'cosecha conocida' : 'cosechas conocidas'} del municipio (${number(reference.mean)} t/ha).`
    : 'No hay otras cosechas conocidas de este municipio para comparar.';
  reading += reference?.count === 1 ? ' Una sola referencia limita la comparación.' : '';
  const action = delta !== null && delta < -.005
    ? 'Empieza por las parcelas con menor cosecha prevista y revisa su lluvia y verdor con tu técnico.'
    : 'Compara la lluvia y el verdor con lo que viste en campo. La diferencia de rendimiento no demuestra mejores prácticas.';
  // La altura se mide antes de pintar para mantener toda la ficha en una página.
  doc.setFont('Nunito', 'normal');
  doc.setFontSize(9);
  const h1 = (doc.splitTextToSize(reading, 164) as string[]).length * 9 * .3528 * 1.25;
  const h2 = (doc.splitTextToSize(action, 164) as string[]).length * 9 * .3528 * 1.25;
  const cardHeight = 17 + h1 + h2;
  box(16, y, 178, cardHeight, colors.blue);
  text('Para revisar tu cosecha', 22, y + 7, 11, true);
  paragraph(reading, 22, y + 13, 164, 9);
  paragraph(action, 22, y + 15 + h1, 164, 9);
  y += cardHeight;
  if (y > 275) throw new Error(`La ficha de ${p.id} supera una página (${y}).`);
  text(estimated ? 'Estimación del ciclo 2025. La cosecha real puede ser diferente.' : 'Fuente: cosecha conocida del catálogo oficial del reto.', 16, 282, 8, false, colors.muted);
  text('Cebali | cebali.pages.dev', 16, 288, 8, true, colors.green);
  text('1 / 1', 185, 288, 8, false, colors.muted);
  return doc;
}

export function saveParcelFicha(doc: jsPDF, id: string) {
  // El marco de escritorio es del mismo origen. Iniciar allí la descarga evita
  // que navegadores integrados la pierdan al originarse dentro del iframe.
  let owner = document;
  try {
    if (window.parent !== window && window.parent.location.origin === window.location.origin) {
      owner = window.parent.document;
    }
  } catch { /* Si se incrusta en otro sitio, descargar desde nuestra propia vista. */ }
  const url = URL.createObjectURL(doc.output('blob'));
  const link = owner.createElement('a');
  link.href = url;
  link.download = `Cebali_${id}_2025.pdf`;
  owner.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

let fontsPromise: Promise<FichaFonts> | undefined;
export function loadFichaFonts() {
  fontsPromise ??= Promise.all(['nunito-400.ttf', 'nunito-800.ttf'].map(async name => {
    const response = await fetch(`${import.meta.env.BASE_URL}fonts/${name}`);
    if (!response.ok) throw new Error('No se pudo cargar la tipografía.');
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(binary);
  })).then(([regular, bold]) => ({ regular, bold })).catch(error => {
    fontsPromise = undefined; throw error;
  });
  return fontsPromise;
}
