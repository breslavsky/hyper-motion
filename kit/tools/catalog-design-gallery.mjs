// Portable before/after gallery from actual native acceptance screenshots.
// node tools/catalog-design-gallery.mjs <before-report-dir> <after-report-dir> <output-dir>
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {sharp} from './migration-browser.mjs';

const [beforeDir,afterDir,output]=process.argv.slice(2,5).map(p=>path.resolve(p));
if(!output)throw new Error('Expected before, after and output directories');
const before=JSON.parse(fs.readFileSync(path.join(beforeDir,'report.json'))),after=JSON.parse(fs.readFileSync(path.join(afterDir,'report.json')));
if(!before.passed||!after.passed||!after.sourceStable)throw new Error('Gallery requires complete, passing native receipts');
assert.equal(before.font,after.font,'Comparison must use the same brand font');
assert.equal(before.look,after.look,'Comparison must use the same presentation look');
fs.mkdirSync(output,{recursive:true});
const records=after.results.map(row=>{
  const old=before.results.find(r=>r.type===row.type&&r.aspect===row.aspect);
  if(!old?.image||!row.image)throw new Error(`Missing comparison: ${row.id}`);
  assert.deepEqual(old.scene,row.scene,`Comparison copy differs for ${row.id}`);
  for(const [kind,directory,entry]of [['before',beforeDir,old],['after',afterDir,row]]){
    const dest=path.join(output,kind);fs.mkdirSync(dest,{recursive:true});fs.copyFileSync(path.join(directory,entry.image),path.join(dest,row.id+'.png'));
  }
  return {id:row.id,type:row.type,family:row.family,aspect:row.aspect};
});
fs.writeFileSync(path.join(output,'comparison.json'),JSON.stringify({before:before.sourceReceipt.aggregate,after:after.sourceReceipt.aggregate,records},null,2)+'\n');
fs.copyFileSync(path.join(afterDir,'report.json'),path.join(output,'native-report.json'));

// Contact sheets retain readable type at 360px per scene. Batches of twelve
// avoid one enormous sheet hiding a weak card among a hundred small tiles.
for(const aspect of ['9:16','1:1','16:9']){
  const rows=records.filter(r=>r.aspect===aspect),format=aspect.replace(':','x');
  for(let start=0;start<rows.length;start+=12){
    const batch=rows.slice(start,start+12),cellW=380,sceneH=aspect==='9:16'?660:aspect==='1:1'?360:210,cellH=sceneH+60,tiles=[];
    for(const [i,row]of batch.entries()){
      const png=await sharp(path.join(output,'after',row.id+'.png')).resize({width:360,height:sceneH,fit:'inside'}).toBuffer();
      const meta=await sharp(png).metadata(),x=(i%4)*cellW,y=Math.floor(i/4)*cellH;
      const title=Buffer.from(`<svg width="380" height="40"><text x="10" y="26" fill="#e9edf1" font-family="sans-serif" font-size="17">${row.type}</text></svg>`);
      tiles.push({input:title,left:x,top:y},{input:png,left:x+Math.round((cellW-meta.width)/2),top:y+45+Math.round((sceneH-meta.height)/2)});
    }
    await sharp({create:{width:cellW*4,height:cellH*Math.ceil(batch.length/4),channels:3,background:'#0b1118'}}).composite(tiles).jpeg({quality:90}).toFile(path.join(output,`${format}-sheet-${String(start/12+1).padStart(2,'0')}.jpg`));
  }
}
const data=JSON.stringify(records).replaceAll('<','\\u003c');
const surfaces=process.argv.includes('--surfaces');
const heading=surfaces?'Pure Kinetic · карточки, поля и бейджи':'Pure Kinetic · единая система';
const motionLink=fs.existsSync(path.join(output,'motion','index.html'))?' <a href="motion/index.html">Сравнить в движении →</a>':'';
const intro=surfaces?'Общие отступы, интервалы и вложенные скругления.'+motionLink:'<a href="motion.html">Посмотреть ролики со звуком →</a>';
fs.writeFileSync(path.join(output,'index.html'),`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${heading}</title>
<style>:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#0b1118;color:#f3f5f7}*{box-sizing:border-box}body{margin:0;padding:32px}header{max-width:1440px;margin:auto}h1{font-size:32px;line-height:1.2;letter-spacing:-.02em;margin:0 0 12px}p{color:#aab5c2;line-height:1.5;margin:0 0 24px}nav{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:24px}button,input,select,a.action{font:500 14px/20px system-ui;border:1px solid #334354;border-radius:6px;padding:8px 12px;color:inherit;background:#182330}button{cursor:pointer}button[aria-pressed=true]{background:#c9f45e;color:#101820;border-color:#c9f45e}input{min-width:220px;flex:1}select{max-width:240px}main{max-width:1440px;margin:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px}.card{padding:0;overflow:hidden;text-align:left;background:#111b25}.card img{display:block;width:100%;height:260px;object-fit:contain;background:#080c12}.card span{display:block;padding:12px 16px}.card small{color:#97a7b7;display:block;margin-top:4px;font-weight:400}footer{max-width:1440px;margin:24px auto;color:#97a7b7;font-size:14px}a{color:#c9f45e}dialog{width:min(1500px,96vw);max-height:96vh;background:#101820;color:#f3f5f7;border:1px solid #405063;border-radius:12px;padding:20px}dialog::backdrop{background:#000c}.dialogbar{display:flex;justify-content:space-between;gap:16px;align-items:center;margin-bottom:16px}.dialogbar h2{margin:0;font-size:20px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}.pair figure{margin:0;min-width:0}.pair figcaption{font-size:14px;color:#aab5c2;margin-bottom:8px}.pair img{width:100%;height:min(72vh,900px);object-fit:contain;background:#05090f}.step{display:flex;gap:8px}.hidden{display:none}@media(max-width:600px){body{padding:18px}h1{font-size:26px}.card img{height:220px}dialog{padding:12px}.pair{gap:16px;grid-template-columns:1fr}.pair img{height:auto;max-height:60vh}.dialogbar{flex-wrap:wrap}.dialogbar h2{font-size:16px}}
</style><header><h1>${heading}</h1><p>105 компонентов. Одинаковые тексты, шрифт и цвета в сравнении. Откройте карточку, чтобы увидеть до и после. ${intro}</p><nav aria-label="Формат"><button data-aspect="9:16">9:16</button><button data-aspect="1:1">1:1</button><button data-aspect="16:9">16:9</button><input id="search" placeholder="Найти компонент" aria-label="Поиск компонента"><select id="family" aria-label="Семейство"><option value="">Все семейства</option></select></nav></header><main id="grid"></main><footer><span id="count"></span> · <a href="REVIEW.md">Отчёт о проверке</a> · <a href="comparison.json">Исходные версии</a></footer><dialog id="detail"><div class="dialogbar"><h2 id="name"></h2><select id="detail-format" aria-label="Формат сравнения"><option>9:16</option><option>1:1</option><option>16:9</option></select><div class="step"><button id="prev" aria-label="Предыдущий компонент">←</button><button id="next" aria-label="Следующий компонент">→</button><button id="close">Закрыть</button></div></div><div class="pair"><figure><figcaption>ДО</figcaption><img id="before" alt="До изменений"></figure><figure><figcaption>ПОСЛЕ</figcaption><img id="after" alt="После изменений"></figure></div></dialog>
<script>const records=${data};let aspect=new URLSearchParams(location.search).get('format')||'16:9',shown=[],selected=null;const grid=document.getElementById('grid'),detail=document.getElementById('detail'),search=document.getElementById('search'),family=document.getElementById('family');for(const name of [...new Set(records.map(r=>r.family))]){const o=document.createElement('option');o.value=name;o.textContent=name;family.append(o)}function open(row){selected=row;document.getElementById('detail-format').value=row.aspect;document.getElementById('name').textContent=row.type+' · '+row.aspect;for(const kind of ['before','after'])document.getElementById(kind).src=kind+'/'+row.id+'.png';if(!detail.open)detail.showModal()}function render(){shown=records.filter(r=>r.aspect===aspect&&(!family.value||r.family===family.value)&&r.type.includes(search.value.toLowerCase().trim()));grid.replaceChildren();for(const row of shown){const b=document.createElement('button');b.className='card';b.setAttribute('aria-label',row.type+' — сравнить');const image=document.createElement('img');image.src='after/'+row.id+'.png';image.loading='lazy';image.alt=row.type;const label=document.createElement('span');label.textContent=row.type;const small=document.createElement('small');small.textContent=row.family;label.append(small);b.append(image,label);b.onclick=()=>open(row);grid.append(b)}document.querySelectorAll('[data-aspect]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.aspect===aspect));document.getElementById('count').textContent='Компонентов: '+shown.length+' · '+aspect}document.querySelectorAll('[data-aspect]').forEach(b=>b.onclick=()=>{aspect=b.dataset.aspect;render();if(detail.open)open(records.find(r=>r.type===selected.type&&r.aspect===aspect))});document.getElementById('detail-format').onchange=e=>{aspect=e.target.value;render();open(records.find(r=>r.type===selected.type&&r.aspect===aspect))};search.oninput=render;family.onchange=render;document.getElementById('close').onclick=()=>detail.close();function step(n){const i=shown.findIndex(r=>r.id===selected.id);open(shown[(i+n+shown.length)%shown.length])}document.getElementById('prev').onclick=()=>step(-1);document.getElementById('next').onclick=()=>step(1);document.addEventListener('keydown',e=>{if(detail.open&&e.key==='ArrowRight')step(1);if(detail.open&&e.key==='ArrowLeft')step(-1)});render();const initial=records.find(r=>r.aspect===aspect&&r.type===new URLSearchParams(location.search).get('component'));if(initial)open(initial);</script></html>`);
console.log(JSON.stringify({output,components:new Set(records.map(r=>r.type)).size,comparisons:records.length}));
