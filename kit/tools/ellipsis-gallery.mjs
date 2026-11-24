// Portable gallery of actual native acceptance frames, not a before/after reel.
// Optional --patch-normal / --patch-max overlay pricing only; --chart-line adds a separate proof.
// node tools/ellipsis-gallery.mjs --normal REPORT_DIR --max REPORT_DIR --out FRESH_DIR
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=value=>JSON.stringify(value,null,2)+'\n';
const escaped=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const aspects=['9:16','1:1','16:9'];

function loadReport(input,{mode,types}){
  const file=path.resolve(input.endsWith('.json')?input:path.join(input,'report.json'));
  const bytes=fs.readFileSync(file),report=JSON.parse(bytes);
  const expected=types.flatMap(type=>aspects.map(aspect=>`${type}:${aspect}`)).sort();
  assert.equal(report.schema,'pure-kinetic.catalog-design-native.v1');
  assert.ok(report.passed&&report.sourceStable,`${mode}: requires passing, stable native receipt`);
  assert.equal(report.completed,report.total,`${mode}: incomplete receipt`);
  assert.equal(report.results.length,expected.length,`${mode}: incomplete candidate matrix`);
  assert.equal(report.total,expected.length);
  assert.equal(report.long,mode==='max',`${mode}: wrong copy fixture`);
  assert.ok(!report.baseline,`${mode}: cannot display a baseline as current proof`);
  assert.deepEqual(report.results.map(row=>`${row.type}:${row.aspect}`).sort(),expected,`${mode}: duplicated or missing variants`);
  assert.match(report.sourceReceipt?.aggregate??'',/^[a-f0-9]{64}$/);
  assert.equal(hash(JSON.stringify(report.sourceReceipt.files)),report.sourceReceipt.aggregate,`${mode}: source hash does not match its file receipt`);
  assert.equal(report.sourceAfter?.aggregate,report.sourceReceipt.aggregate);
  for(const row of report.results){
    assert.ok(row.passed&&row.reverseExact,`${mode}/${row.id}: incomplete checks`);
    assert.ok(row.image&&path.basename(row.image)===row.image,`${mode}/${row.id}: unsafe image path`);
    assert.ok(fs.statSync(path.join(path.dirname(file),row.image)).isFile(),`${mode}/${row.id}: missing native frame`);
  }
  return {file,bytes,report};
}

export function buildGallery({normal,max,patchNormal,patchMax,chartLine,out}){
  assert.ok(normal&&max&&out,'Expected --normal, --max and --out');
  out=path.resolve(out);
  assert.ok(!fs.existsSync(out),'Use a fresh output directory');
  const scopeFile=fileURLToPath(new URL('./ellipsis-scope.json',import.meta.url));
  const scope=JSON.parse(fs.readFileSync(scopeFile,'utf8'));
  const candidates=scope.components.filter(row=>row.policy!=='preserved').map(row=>row.type);
  const expected=candidates.flatMap(type=>aspects.map(aspect=>`${type}:${aspect}`)).sort();
  const reports={};
  for(const [mode,input]of Object.entries({normal,max}))reports[mode]=loadReport(input,{mode,types:candidates});
  const baseSourceHash=reports.normal.report.sourceReceipt.aggregate;
  assert.equal(reports.max.report.sourceReceipt.aggregate,baseSourceHash,'The two sets must use the same frozen source');
  assert.equal(reports.normal.report.look,reports.max.report.look,'The two sets must use the same look');
  assert.equal(Boolean(patchNormal),Boolean(patchMax),'Pricing patch requires both normal and max receipts');
  const patches={};
  if(patchNormal)for(const [mode,input]of Object.entries({normal:patchNormal,max:patchMax})){
    const patch=loadReport(input,{mode,types:['pricing']}),base=reports[mode].report;
    assert.equal(patch.report.font,base.font,`${mode}: patch font differs`);
    assert.equal(patch.report.look,base.look,`${mode}: patch look differs`);
    for(const row of patch.report.results)assert.deepEqual(row.scene,base.results.find(prior=>prior.type===row.type&&prior.aspect===row.aspect).scene,`${mode}/${row.id}: patch fixture differs`);
    const before=base.sourceReceipt.files,after=patch.report.sourceReceipt.files;
    assert.deepEqual(Object.keys(after).sort(),Object.keys(before).sort(),'Patch cannot add or remove source files');
    const changed=Object.keys(before).filter(file=>before[file]!==after[file]);
    assert.ok(changed.every(file=>file==='lib/components/scenes/data.mjs'),'Scoped pricing proof cannot certify unrelated source changes');
    patches[mode]={...patch,changed};
  }
  const patchSourceHash=patches.normal?.report.sourceReceipt.aggregate;
  if(patchSourceHash)assert.equal(patches.max.report.sourceReceipt.aggregate,patchSourceHash,'Pricing patch receipts must share a frozen source');
  const chart=chartLine?loadReport(chartLine,{mode:'max',types:['chart']}):null;
  if(chart)assert.ok(chart.report.results.every(row=>row.scene.kind==='line'),'Supplement must test chart=line');
  const manifest={schema:'pure-kinetic.ellipsis-gallery.v2',baseSourceHash,patchSourceHash:patchSourceHash??null,components:candidates,aspects,
    purpose:'Static native frames for normal and maximum supported copy; this is not a before/after comparison.',
    reports:{},patch:patchSourceHash?{type:'pricing',sourceHash:patchSourceHash,changedSourceFiles:patches.normal.changed,reports:{}}:null,records:[]};
  fs.mkdirSync(path.join(out,'reports'),{recursive:true});
  fs.copyFileSync(scopeFile,path.join(out,'ellipsis-scope.json'));
  for(const [mode,{file,bytes,report}]of Object.entries(reports)){
    fs.mkdirSync(path.join(out,mode));
    fs.writeFileSync(path.join(out,'reports',mode+'.json'),bytes);
    manifest.reports[mode]={path:`reports/${mode}.json`,sha256:hash(bytes),font:report.font,look:report.look,
      total:report.total,passed:report.passed,sourceStable:report.sourceStable,sourceHash:baseSourceHash,frameFraction:.8};
    for(const row of report.results){
      const image=fs.readFileSync(path.join(path.dirname(file),row.image)),destination=`${mode}/${row.image}`;
      fs.writeFileSync(path.join(out,destination),image);
      manifest.records.push({mode,type:row.type,family:row.family,aspect:row.aspect,image:destination,sha256:hash(image),sourceHash:baseSourceHash,report:`reports/${mode}.json`});
    }
  }
  for(const [mode,{file,bytes,report}]of Object.entries(patches)){
    const folder=`patch-${mode}`,receipt=`reports/pricing-${mode}.json`;
    fs.mkdirSync(path.join(out,folder));fs.writeFileSync(path.join(out,receipt),bytes);
    manifest.patch.reports[mode]={path:receipt,sha256:hash(bytes),font:report.font,look:report.look,total:report.total,sourceHash:patchSourceHash,passed:true,sourceStable:true};
    for(const row of report.results){
      const record=manifest.records.find(item=>item.mode===mode&&item.type===row.type&&item.aspect===row.aspect);
      const image=fs.readFileSync(path.join(path.dirname(file),row.image)),destination=`${folder}/${row.image}`;
      fs.writeFileSync(path.join(out,destination),image);
      record.baseImage={image:record.image,sha256:record.sha256,sourceHash:record.sourceHash,report:record.report};
      Object.assign(record,{image:destination,sha256:hash(image),sourceHash:patchSourceHash,report:receipt,patched:true});
    }
  }
  if(chart){
    fs.mkdirSync(path.join(out,'chart-line'));fs.writeFileSync(path.join(out,'chart-line/report.json'),chart.bytes);
    const frames=chart.report.results.map(row=>{
      const image=fs.readFileSync(path.join(path.dirname(chart.file),row.image));
      fs.writeFileSync(path.join(out,'chart-line',row.image),image);
      return {aspect:row.aspect,image:`chart-line/${row.image}`,sha256:hash(image),sourceHash:chart.report.sourceReceipt.aggregate};
    });
    manifest.chartLine={path:'chart-line/index.html',report:'chart-line/report.json',reportSha256:hash(chart.bytes),sourceHash:chart.report.sourceReceipt.aggregate,frames};
    fs.writeFileSync(path.join(out,'chart-line/index.html'),`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chart line — проверка подписей</title><style>body{margin:24px;background:#101419;color:#f3f5ef;font:16px/1.5 system-ui}a{color:#b9f24a}main{max-width:1200px;margin:auto}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px}figure{margin:0}img{display:block;max-width:100%;height:auto}code{overflow-wrap:anywhere}</style><main><a href="../index.html">← Каталог</a><h1>Chart: line</h1><p>Отдельная проверка двенадцати подписей в трёх форматах. Ни один кадр основной матрицы здесь не заменён.</p><p>Фактически проверенная версия: <code>${chart.report.sourceReceipt.aggregate}</code>. Отчёт охватывает только эту ветку графика.</p><p><a href="report.json">Нативный отчёт</a></p><div class="grid">${frames.map(row=>`<figure><figcaption>${row.aspect}</figcaption><a href="${escaped(path.basename(row.image))}"><img src="${escaped(path.basename(row.image))}" alt="Линейный график ${row.aspect}"></a></figure>`).join('')}</div></main></html>`);
  }
  fs.writeFileSync(path.join(out,'manifest.json'),json(manifest));
  const data=JSON.stringify(manifest).replace(/</g,'\\u003c');
  fs.writeFileSync(path.join(out,'index.html'),`<!doctype html>
<html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pure Kinetic — однострочные подписи</title>
<style>
:root{color-scheme:dark;font:15px/1.5 system-ui,sans-serif;background:#101419;color:#f3f5ef}*{box-sizing:border-box}body{margin:0}main{max-width:1500px;margin:auto;padding:32px 24px 48px}h1{font-size:clamp(26px,4vw,40px);line-height:1.12;margin:8px 0 16px;font-weight:650;letter-spacing:-.035em}p{margin:0 0 12px;color:#b9c1c9;max-width:840px}.eyebrow{font-size:12px;letter-spacing:.09em;color:#b9f24a;text-transform:uppercase}.controls{display:flex;align-items:end;flex-wrap:wrap;gap:16px;margin:28px 0 14px;padding:18px;background:#181f26;border:1px solid #303a44;border-radius:16px}.group{display:grid;gap:7px;min-width:0}.group-label{font-size:12px;color:#abb6c1}.segments{display:flex;flex-wrap:wrap;gap:6px}button,select{font:inherit;color:inherit;background:#222c35;border:1px solid #3d4955;border-radius:8px;min-height:40px;padding:8px 13px}button{cursor:pointer}button[aria-pressed=true]{background:#b9f24a;color:#111810;border-color:#b9f24a}select{width:min(100%,270px)}button:focus-visible,select:focus-visible,a:focus-visible{outline:3px solid #8ec7ff;outline-offset:3px}.filter{flex:1;min-width:190px}#count{color:#b9c1c9;font-size:13px;margin:0 0 18px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:18px;align-items:start}.card{min-width:0;margin:0;background:#181f26;border:1px solid #303a44;border-radius:14px;overflow:hidden}.card a{display:block;background:#080b0e}.card img{display:block;width:100%;height:auto;object-fit:contain}.card figcaption{padding:12px 14px}.name{display:block;font-size:15px;font-weight:600;overflow-wrap:anywhere}.meta{font-size:12px;color:#9daab7}footer{margin-top:30px;padding-top:20px;border-top:1px solid #303a44;color:#9daab7;font-size:13px}footer p{margin-bottom:8px}a{color:#b9f24a;text-underline-offset:3px}footer nav{display:flex;flex-wrap:wrap;gap:8px 18px}code{font-size:12px;overflow-wrap:anywhere}.empty{color:#b9c1c9}@media(max-width:550px){main{padding:24px 16px 32px}.controls{padding:14px;gap:14px}.group,.filter{width:100%}.filter select{width:100%;max-width:none}.grid{grid-template-columns:minmax(0,1fr)}h1{max-width:320px}}
</style>
<main><header><div class="eyebrow">Pure Kinetic · каталог компонентов</div><h1>Однострочные подписи</h1>
<p>Фиксированный размер шрифта и многоточие там, где подпись рассчитана на одну строку. Заголовки, сообщения и числовые значения сохраняют свои правила.</p>
<p>Обычный текст — ${escaped(reports.normal.report.font)}. Максимальный текст — ${escaped(reports.max.report.font)}. Наборы показывают компоненты при разной длине текста.</p></header>
<section class="controls" aria-label="Фильтры каталога"><div class="group"><span class="group-label">Формат</span><div class="segments" role="group" aria-label="Формат"><button type="button" data-aspect="9:16">9:16</button><button type="button" data-aspect="1:1">1:1</button><button type="button" data-aspect="16:9">16:9</button></div></div>
<div class="group"><span class="group-label">Текст</span><div class="segments" role="group" aria-label="Набор текста"><button type="button" data-mode="normal">Обычный</button><button type="button" data-mode="max">Максимальный</button></div></div>
<label class="group filter"><span class="group-label">Компонент</span><select id="component"><option value="all">Все компоненты</option></select></label></section>
<div id="count" role="status" aria-live="polite"></div><section class="grid" id="grid" aria-label="Кадры компонентов"></section>
<footer><p>Основная матрица: ${candidates.length} компонентов × 3 формата × 2 набора — ${expected.length*2} успешных проверок.${patchSourceHash?' После отдельного исправления pricing успешно повторены ещё 6 проверок; в галерее заменены только его 6 кадров.':''} Здесь показаны статические PNG из нативного HyperFrames; нажмите на кадр, чтобы открыть его отдельно.</p><p>Максимальные тестовые строки сгенерированы на пределе допустимой длины. Они могут заканчиваться посреди слова уже во входных данных.</p><p>Исходник основной матрицы: <code>${baseSourceHash}</code>${patchSourceHash?`<br>Исходник повторной проверки pricing: <code>${patchSourceHash}</code>`:''}</p><nav><a href="REVIEW.md">Область проверки</a><a href="reports/normal.json">Основная матрица: обычный текст</a><a href="reports/max.json">Основная матрица: максимальный текст</a>${patchSourceHash?'<a href="reports/pricing-normal.json">Pricing: обычный текст</a><a href="reports/pricing-max.json">Pricing: максимальный текст</a>':''}${chart?'<a href="chart-line/index.html">Отдельная проверка chart: line</a>':''}<a href="manifest.json">Файлы и SHA256</a><a href="ellipsis-scope.json">Правила всех 105 компонентов</a></nav></footer></main>
<script>
const manifest=${data},query=new URLSearchParams(location.search);
let aspect=manifest.aspects.includes(query.get('format'))?query.get('format'):'16:9',mode=['normal','max'].includes(query.get('mode'))?query.get('mode'):'normal';
const component=document.getElementById('component'),grid=document.getElementById('grid');
for(const type of manifest.components){const option=document.createElement('option');option.value=type;option.textContent=type;component.append(option)}
component.value=manifest.components.includes(query.get('component'))?query.get('component'):'all';
function render(){
  const rows=manifest.records.filter(row=>row.mode===mode&&row.aspect===aspect&&(component.value==='all'||row.type===component.value));
  grid.replaceChildren();
  for(const row of rows){
    const card=document.createElement('figure');card.className='card';const link=document.createElement('a');link.href=row.image;link.target='_blank';link.rel='noopener';link.setAttribute('aria-label','Открыть кадр '+row.type+' '+row.aspect);
    const img=document.createElement('img');img.src=row.image;img.alt=row.type+' · '+row.aspect+' · '+(mode==='normal'?'обычный':'максимальный')+' текст';img.loading='lazy';
    const label=document.createElement('figcaption'),name=document.createElement('span'),meta=document.createElement('span');name.className='name';name.textContent=row.type;meta.className='meta';meta.textContent=row.family+' · '+row.aspect+' · '+manifest.reports[mode].font+(row.patched?' · повторная проверка':'');
    label.append(name,meta);link.append(img);card.append(link,label);grid.append(card);
  }
  document.querySelectorAll('[data-aspect]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.aspect===aspect)));
  document.querySelectorAll('[data-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mode===mode)));
  document.getElementById('count').textContent='Компонентов: '+rows.length+' · '+aspect+' · '+(mode==='normal'?'обычный текст':'максимальный текст')+' · '+manifest.reports[mode].font;
  const url=new URL(location.href);url.searchParams.set('format',aspect);url.searchParams.set('mode',mode);if(component.value==='all')url.searchParams.delete('component');else url.searchParams.set('component',component.value);
  history.replaceState(null,'',url);
}
document.querySelectorAll('[data-aspect]').forEach(button=>button.addEventListener('click',()=>{aspect=button.dataset.aspect;render()}));
document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>{mode=button.dataset.mode;render()}));component.addEventListener('change',render);render();
</script></html>`);
  fs.writeFileSync(path.join(out,'REVIEW.md'),`# Однострочные подписи: нативная проверка\n\n`+
    `Исходник основной матрицы: \`${baseSourceHash}\`. Оба основных отчёта завершены, успешны и подтверждают неизменность исходника во время своих прогонов.\n\n`+
    `${candidates.length} типов × ${aspects.length} формата × 2 набора = ${expected.length*2} вариантов основной матрицы. Обычный текст использует ${reports.normal.report.font}; максимальный — ${reports.max.report.font}.\n\n`+
    (patchSourceHash?`Отдельное исправление pricing повторно проверено в 6 вариантах на исходнике \`${patchSourceHash}\`: [обычный текст](reports/pricing-normal.json), [максимальный текст](reports/pricing-max.json). В галерее заменены только эти 6 кадров; 264 остальных сохраняют источник основной матрицы. Полный повтор 270 вариантов на исправленном исходнике здесь не заявляется. Исходные PNG pricing и оба основных отчёта также сохранены. Каждая запись manifest.json указывает свой реальный sourceHash и отчёт; для заменённых кадров сохранён baseImage.\n\n`:'')+
    `Максимальные строки синтетически созданы на пределе допустимой длины и могут заканчиваться посреди слова уже во входном рецепте. Это особенность тестового входа; реальное CSS-многоточие показывается отдельно и не меняет исходную строку.\n\n`+
    `PNG взяты из отчётов без редактирования: кадр на 80% сцены, уменьшенный нативным инструментом до области 480 × 720 пикселей с сохранением пропорций. Проверка анализирует 20%, 45%, 60%, 80%, 93% сцены и семантическое состояние после обратного перехода. Галерея не заменяет просмотр всей анимации и не доказывает корректность произвольной длины текста.\n\n`+
    `Отчёты проверяют типографику, поверхности, видимые пересечения и соответствие явного однострочного поля его CSS/геометрии. Для объявленных движений камеры край кадра отделён от внутреннего обрезания родителем; последнее не разрешается. Основной текст, числа и печать сохраняют свои правила.\n\n`+
    (chart?`[Отдельные кадры и отчёт chart=line](chart-line/index.html) проверяют двенадцать подписей на исходнике \`${chart.report.sourceReceipt.aggregate}\`. Они не подменяют кадры chart=ring основной матрицы и не переименованы в проверку pricing-версии.\n\n`:'')+
    `Список всех 105 типов и исключений: [ellipsis-scope.json](ellipsis-scope.json). Основные отчёты: [обычный](reports/normal.json), [максимальный](reports/max.json). Контрольные суммы всех PNG и отчётов: [manifest.json](manifest.json).\n`);
  return {out,baseSourceHash,patchSourceHash:patchSourceHash??null,components:candidates.length,variants:manifest.records.length,patchedVariants:patchSourceHash?6:0};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),value=name=>args.includes('--'+name)?args[args.indexOf('--'+name)+1]:undefined;
  console.log(JSON.stringify(buildGallery({normal:value('normal'),max:value('max'),patchNormal:value('patch-normal'),patchMax:value('patch-max'),chartLine:value('chart-line'),out:value('out')})));
}
