import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const app = fileURLToPath(new URL('../', import.meta.url));
const root = path.dirname(app.slice(0, -1));
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'cebali-g5-'));
const read = async rel => JSON.parse(await fs.readFile(path.join(app, rel), 'utf8'));
let maximumError = 0, checks = 0;
function close(a, b, tolerance = 1e-12) {
  const delta = Math.abs(a - b);
  maximumError = Math.max(maximumError, delta);
  assert.ok(delta <= tolerance, `${a} != ${b}: ${delta}`);
  checks++;
}
try {
  const require = createRequire(import.meta.url);
  const sources = {};
  for (const [name, rel] of Object.entries({ octG5: 'src/model/octG5.ts', rainScenarios: 'src/model/rainScenarios.ts', parcelFicha: 'src/reports/parcelFicha.ts' })) {
    const source = await fs.readFile(path.join(app, rel), 'utf8');
    sources[name] = source;
    const code = ts.transpileModule(source, { compilerOptions: {
      target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext,
    } }).outputText.replaceAll("'./octG5'", "'./octG5.mjs'")
      .replace("from 'jspdf'", `from '${pathToFileURL(require.resolve('jspdf')).href}'`);
    await fs.writeFile(path.join(temp, `${name}.mjs`), code);
  }
  const { predictPrepared, estimateParcel, distanceKm } = await import(pathToFileURL(path.join(temp, 'octG5.mjs')));
  const { rainRange, simulateRain } = await import(pathToFileURL(path.join(temp, 'rainScenarios.mjs')));
  const { createParcelFicha } = await import(pathToFileURL(path.join(temp, 'parcelFicha.mjs')));
  const bundle = await read('src/model/oct-g5-runtime.json');
  const cases = await read('pruebas/referencias_R.json');
  const catalog = await read('src/data/parcels.json');
  const evidence = await read('src/data/model-oct-g5.json');
  const support = await read('src/model/rain-support.json');
  assert.equal(bundle.model.type, 'OCT_G5_FINAL');
  assert.equal(bundle.model.version, '1.5.0');
  assert.equal(bundle.model.recipe, '0.5J_G5_PICK+0.5MIX_CORR');
  let nCases = 0;
  for (const group of Object.values(cases)) {
    const actual = predictPrepared(bundle, group.inputs);
    for (let i = 0; i < actual.length; i++) {
      const a = actual[i], c = group.components[i];
      close(a.yield, group.predictions[i].RENDIMIENTO_T_HA);
      for (const [key, rkey] of Object.entries({j:'J',municipal:'MUN',idw20:'IDW20',kCorrection:'K_correction',mix:'MIX_CORR'})) close(a[key], c[rkey]);
      close(a.referenceBase + Object.values(a.contributions).reduce((s,v)=>s+v,0), a.yield);
      close(a.neighbors.reduce((s,p)=>s+p.weight,0),1);
      assert.equal(a.neighbors.length,20);
      assert.equal(a.kAvailable,c.K_available);
      nCases++;
    }
  }
  const RMaximumError = maximumError;
  const official = predictPrepared(bundle,bundle.inputs);
  assert.equal(catalog.length,197);
  assert.equal(catalog.filter(p=>p.yieldKind==='observed').length,138);
  for (const k of bundle.model.known) close(catalog.find(p=>p.id===k.ID_POLIGONO).yield,k.y);
  for (const a of official) {
    close(a.yield,catalog.find(p=>p.id===a.id).yield);
    const e=evidence.parcels[a.id];
    for (const key of ['j','municipal','idw20','kCorrection','mix','referenceBase']) close(a[key],e[key]);
    assert.equal(a.territorialReferences,e.territorialReferences);
  }
  const reversed=structuredClone(bundle);reversed.model.known.reverse();
  for (const a of predictPrepared(reversed,[...bundle.inputs].reverse())) close(a.yield,official.find(p=>p.id===a.id).yield);
  const first=bundle.inputs[0];
  assert.throws(()=>predictPrepared(bundle,[]));
  assert.throws(()=>predictPrepared(bundle,[first,first]));
  for (const change of [{ID_POLIGONO:'AGC_999'},{municipio:'Otro'},{lon:first.lon+.01},{lat:NaN},{H:0},{P:-1},{K:NaN},{K:Infinity},{truth:3},{y:3},{RENDIMIENTO_T_HA:3}]) assert.throws(()=>predictPrepared(bundle,[{...first,...change}]));
  assert.throws(()=>predictPrepared({...bundle,model:{...bundle.model,version:'otra'}},[first]));
  assert.throws(()=>predictPrepared({...bundle,model:{...bundle.model,group_map:{}}},[first]));
  close(distanceKm(0,0,0,0),0);
  close(distanceKm(0,0,180,0),Math.PI*6371.0088,1e-10);
  const stages=estimateParcel(bundle,first.ID_POLIGONO),phase=[];
  let step=stages.next();while(!step.done){phase.push(step.value.stage);step=stages.next();}
  assert.deepEqual(phase,['inputs','rain','neighbors','crop']);
  assert.ok(!/parcels\.json|model-oct-g5\.json/.test(sources.octG5));
  const original=JSON.stringify(bundle);let scenarios=0;const unsupported=[];
  for (const input of bundle.inputs) {
    const baseline=official.find(p=>p.id===input.ID_POLIGONO);
    const range=rainRange(input,support);
    if(!range){unsupported.push(input.ID_POLIGONO);continue;}
    for (const rain of [input.P,range.min,range.max,(range.min+range.max)/2]) {
      const a=simulateRain(bundle,input,rain,support);
      const expected=baseline.yield+.5*bundle.model.J.beta/bundle.model.J.sd*100/input.H*(rain-input.P);
      close(a.yield,expected);close(a.referenceBase,baseline.referenceBase);
      close(a.idw20,baseline.idw20);close(a.kCorrection,baseline.kCorrection);
      scenarios++;
    }
    for(const bad of [NaN,-1,range.max+.01]) assert.throws(()=>simulateRain(bundle,input,bad,support));
  }
  assert.deepEqual(unsupported,['AGC_120']);assert.equal(JSON.stringify(bundle),original);
  const fonts={regular:(await fs.readFile(path.join(app,'public/fonts/nunito-400.ttf'))).toString('base64'),bold:(await fs.readFile(path.join(app,'public/fonts/nunito-800.ttf'))).toString('base64')};
  for (const p of catalog) {
    const refs=catalog.filter(q=>q.yieldKind==='observed'&&q.municipality===p.municipality&&q.id!==p.id);
    const doc=createParcelFicha({parcel:p,estimate:official.find(e=>e.id===p.id)??null,reference:refs.length?{count:refs.length,mean:refs.reduce((s,r)=>s+r.yield,0)/refs.length}:null,review:null},fonts);
    assert.equal(doc.getNumberOfPages(),1,p.id);
  }
  const estimated=catalog.find(p=>p.yieldKind==='estimated');
  assert.throws(()=>createParcelFicha({parcel:estimated,estimate:null,reference:null,review:null},fonts));
  // Comparar métricas de la interfaz con el resultado del modelo de este mismo repositorio.
  const text=await fs.readFile(path.join(root,'modelo/resultados/validacion_metricas.csv'),'utf8');
  const lines=text.trim().split(/\r?\n/).map(l=>l.split(',').map(v=>v.replace(/^"|"$/g,'')));
  const rows=lines.slice(1).map(v=>Object.fromEntries(lines[0].map((k,i)=>[k,v[i]])));
  for(const [name,key] of [['represented','LOCAL_5x10'],['separated','ESPACIAL_5']]) {
    const r=rows.find(r=>r.escenario===key);close(evidence.contexts[name].rmse,Number(r.RMSE_media_repeticiones));close(evidence.contexts[name].mae,Number(r.MAE));
  }
  console.log(JSON.stringify({status:'PASS',model:'OCT_G5 1.5.0',R_cases:nCases,numeric_checks:checks,max_R_case_error:RMaximumError,max_absolute_error:maximumError,official_predictions:59,observed_unchanged:138,rain_scenarios:scenarios,single_page_PDF:197,engine_independent_of_catalog:true},null,2));
} finally { await fs.rm(temp,{recursive:true,force:true}); }
