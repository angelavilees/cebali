// Regenerar los gráficos desde la reproducción del modelo incluida en el repositorio.
import fs from 'node:fs/promises';

const app = new URL('../', import.meta.url);
const model = new URL('../modelo/resultados/', app);
async function table(file) {
  const text = await fs.readFile(new URL(file, model), 'utf8');
  // Estas tablas de salida usan identificadores y números, sin comas dentro de campos.
  const rows = text.trim().split(/\r?\n/).map(line => line.split(',').map(v => v.replace(/^"|"$/g, '')));
  return rows.slice(1).map(row => Object.fromEntries(rows[0].map((key, i) => [key, row[i]])));
}
const path = new URL('src/data/model-oct-g5.json', app);
const evidence = JSON.parse(await fs.readFile(path, 'utf8'));
if (evidence.model !== 'OCT_G5' || evidence.version !== '1.5.0') throw new Error('Versión incompatible.');
const metrics = await table('validacion_metricas.csv');
const oof = await table('validacion_oof.csv');
for (const [name, scenario] of [['represented', 'LOCAL_5x10'], ['separated', 'ESPACIAL_5']]) {
  const context = evidence.contexts[name];
  const score = metrics.find(row => row.escenario === scenario);
  const points = oof.filter(row => row.escenario === scenario
    && (name === 'separated' || row.repeticion === context.scatterRepeat));
  if (!score || points.length !== 138 || new Set(points.map(p => p.ID_POLIGONO)).size !== 138) {
    throw new Error(`Validación incompleta: ${name}`);
  }
  context.rmse = Number(score.RMSE_media_repeticiones);
  context.mae = Number(score.MAE);
  context.scatter = points.map(p => ({id: p.ID_POLIGONO, truth: Number(p.real), pred: Number(p.prediccion)}));
}
await fs.writeFile(path, JSON.stringify(evidence) + '\n');
console.log('PASS: gráficos y métricas sincronizados con la reproducción G5 del repositorio.');
