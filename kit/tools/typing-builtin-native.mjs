// Per-key native geometry proof for the built-in typing fields. The full phrase
// is the reference; browser Range rectangles are mapped through an affine frame
// so authored camera moves and the receipt's rotation do not look like reflow.
// Paint uses effective CSS visibility/opacity and text alpha. For scrolling
// inputs, the latest glyph and caret must also stay inside the clipping viewport;
// preceding glyphs retain their immutable coordinates in the scrolling flow.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createNativeBrowser,SOURCE,sourceHashes} from './migration-browser.mjs';
import {maximumScene} from './quality-layout.mjs';

const prompt='Первые слова остаются на месте, пока длинное продолжение строки печатается.';
const field=(id,selector,text,index=0)=>({id,selector,text,index});
export const fixtures=[
  {id:'title',scene:{type:'title',text:'Главная мысль',sub:'Первые слова стоят на своих местах',beats:4},fields:s=>[field('title.sub','.center > [data-design-role="label"]',s.sub)]},
  {id:'prompt',scene:{type:'prompt',text:prompt,placeholder:'Введите запрос',beats:5},fields:s=>[field('prompt.text','.chat-text > span:first-child',s.text)]},
  {id:'macro-fallback',scene:{type:'ui-macro',typeText:prompt,beats:5},fields:s=>[field('prompt.text','.chat-text > span:first-child',s.typeText)]},
  {id:'macro-target',scene:{type:'ui-macro',typeText:'Запрос готовится к отправке',target:{x:.08,y:.4,w:.84,h:.13},beats:5},fields:s=>[{...field('ui-macro.typeText','[data-typing-id="ui-macro.typeText"]',s.typeText),scrolling:true}]},
  {id:'macro-max',scene:{...maximumScene('ui-macro'),target:{x:.3,y:.42,w:.4,h:.09}},fields:s=>[{...field('ui-macro.typeText','[data-typing-id="ui-macro.typeText"]',s.typeText),scrolling:true,requireScroll:true}]},
  {id:'morph',scene:{type:'morph',states:['search','button','search'],label:'Дальше',text:'Набираем запрос без скачков',beats:6},fields:s=>[0,2].map((slot,index)=>({...field(`morph.search.${slot}`,'.cam > div > div > [data-design-role="body"]',s.text,index),centerY:true}))},
  // The catalog maximum fixture cycles through ten states without search, so
  // keep its maximum query in an explicit repeated-search branch regression.
  {id:'morph-maximum',scene:{...maximumScene('morph'),states:['search','button','search']},fields:s=>[0,2].map((slot,index)=>({...field(`morph.search.${slot}`,'.cam > div > div > [data-design-role="body"]',s.text,index),centerY:true}))},
  {id:'ticket',scene:{type:'ticket',title:'Готовый результат',rows:[['Задача','Первые слова на месте'],['Результат','Ровная строка без скачков']],stamp:'Готово',beats:5},fields:s=>s.rows.map((row,i)=>field(`ticket.rows.${i}`,'.ticket [data-design-role="body"]',row[1],i))},
  {id:'ticket-dense',scene:{type:'ticket',title:'Подробная квитанция',rows:[['Первый пункт','Первые слова стоят ровно'],['Второй пункт','Текст не меняет положение'],['Третий пункт','Сохраняем размер и отступ'],['Итог','Каждая строка на месте']],stamp:'Готово',beats:6},fields:s=>s.rows.map((row,i)=>field(`ticket.rows.${i}`,'.ticket [data-design-role="body"]',row[1],i))},
];

function clocks(entry,p){
  const s=entry.scene,fields=entry.fields(s),dur=p.ldur;
  if(s.type==='title')return fields.map(f=>({...f,from:0,span:.5,floor:true}));
  if(s.type==='ticket'){
    const at=p.marks?.[0]??dur*.66,span=Math.max(.3,at-.55);
    return fields.map((f,i)=>({...f,from:.45+i*span/fields.length,span:Math.max(.1,span/fields.length-.05)}));
  }
  if(s.type==='morph'){
    const marks=p.marks??s.states.map((_,i)=>i*dur/s.states.length);
    return fields.map(f=>{const i=Number(f.id.split('.').at(-1)),end=marks[i+1]??dur;return {...f,from:marks[i]+.1,span:Math.max(.2,(end-marks[i])*.6)};});
  }
  const target=s.type==='ui-macro'&&Boolean(s.target||s.image),from=target?.55:.25;
  const typeEnd=target?Math.max(.6,(p.clickAt??dur*.74)-.45):Math.max(.5,(p.clickAt??dur*.74)-.5);
  return fields.map(f=>({...f,from,span:typeEnd-from}));
}
function timesFor(fields,duration){
  const times=new Set([0,duration*.98]);
  const add=t=>{if(t>=0&&t<duration)times.add(+t.toFixed(8));};
  for(const f of fields){
    for(let i=1;i<=f.text.length;i++){
      const t=f.from+(i-(f.floor?0:.5))/f.text.length*f.span;add(t-.0001);add(t+.0001);
    }
    add(f.from+f.span+.025);
  }
  return [...times].sort((a,b)=>a-b);
}

function readFields(specs){
  const root=window.__pkScenes.s1.sceneRoot;
  const active=node=>{let a=1;for(let p=node;p&&p!==root.parentElement;p=p.parentElement){const s=getComputedStyle(p);if(s.display==='none'||s.visibility==='hidden')return 0;a*=Number(s.opacity);}return a;};
  const colorAlpha=node=>{const c=getComputedStyle(node).color,m=/^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)$/.exec(c)??/\/\s*([\d.]+)\s*\)$/.exec(c);return m?Number(m[1]):1;};
  return specs.map(spec=>{
    const host=root.querySelector(`[data-typing-id="${spec.id}"]`)??root.querySelectorAll(spec.selector)[spec.index];
    if(!host)throw new Error(`No typing field ${spec.id}: ${spec.selector}[${spec.index}]`);
    const viewport=host.closest('[data-typing-viewport]');
    const scrolling=host.dataset.typingScroll===spec.id&&viewport?.dataset.typingViewport===spec.id;
    if(spec.scrolling&&!scrolling)throw new Error(`Missing matching scrolling input viewport for ${spec.id}`);
    const anchor=scrolling?host:host.parentElement,position=anchor.style.position;
    if(getComputedStyle(anchor).position==='static')anchor.style.position='relative';
    // Search text is vertically centered in the spring-resized morph surface.
    // Measure from that authored center, so changing shape height is not reflow.
    const probes=[[0,0],[100,0],[0,100]].map(([x,y])=>{const n=document.createElement('i');n.style.cssText=`position:absolute;left:${x}px;top:${spec.centerY?`calc(50% + ${y}px)`:`${y}px`};width:0;height:0;transform:none;visibility:hidden;pointer-events:none`;anchor.append(n);return n;});
    const [o,x,y]=probes.map(n=>n.getBoundingClientRect());
    const a=(x.x-o.x)/100,b=(x.y-o.y)/100,c=(y.x-o.x)/100,d=(y.y-o.y)/100,det=a*d-b*c;
    const rect=r=>{
      const A=Math.abs(a),B=Math.abs(b),C=Math.abs(c),D=Math.abs(d),q=A*D-B*C;
      const w=(r.width*D-r.height*C)/q,h=(r.height*A-r.width*B)/q;
      const gx=r.x-Math.min(0,a*w,c*h,a*w+c*h)-o.x,gy=r.y-Math.min(0,b*w,d*h,b*w+d*h)-o.y;
      return {x:(d*gx-c*gy)/det,y:(a*gy-b*gx)/det,w,h};
    };
    const glyphs=[],paint=[];
    const walk=node=>{
      if(node.nodeType===Node.TEXT_NODE){
        if(active(node.parentElement)*colorAlpha(node.parentElement)<.001)return;
        for(let start=0;start<node.length;){const unit=String.fromCodePoint(node.nodeValue.codePointAt(start)),r=document.createRange();r.setStart(node,start);r.setEnd(node,start+unit.length);const box=r.getBoundingClientRect();glyphs.push({unit,...rect(box)});paint.push({unit,box});start+=unit.length;}
      }else if(node.dataset?.emoji){
        if(active(node)<.001)return;
        for(const unit of [...node.dataset.emoji]){const box=node.getBoundingClientRect();glyphs.push({unit,...rect(box)});paint.push({unit,box});}
      }else if(!node.matches?.('svg,[data-typing-caret],[data-typing-ignore]'))for(const child of node.childNodes)walk(child);
    };
    walk(host);
    let input=null;
    if(scrolling){
      const box=viewport.getBoundingClientRect(),caret=host.querySelector('[data-typing-caret]');
      const contains=r=>r.left>=box.left-.75&&r.right<=box.right+.75&&r.top>=box.top-.75&&r.bottom<=box.bottom+.75;
      const last=paint.findLast(g=>!/^\s+$/u.test(g.unit)),style=getComputedStyle(viewport);
      input={active:active(viewport)>=.001,clips:/hidden|clip/.test(style.overflowX),
        latestGlyphContained:!last||contains(last.box),caretContained:Boolean(caret)&&active(caret)>=.001&&contains(caret.getBoundingClientRect()),
        scrollX:new DOMMatrixReadOnly(getComputedStyle(host).transform).m41};
    }
    for(const n of probes)n.remove();anchor.style.position=position;
    return {id:spec.id,text:glyphs.map(g=>g.unit).join(''),glyphs,input};
  });
}

export function inputViewportFindings(input){
  if(!input?.active)return [];
  return [!input.clips&&'input-viewport-does-not-clip',!input.latestGlyphContained&&'latest-input-glyph-clipped',
    !input.caretContained&&'input-caret-clipped'].filter(Boolean);
}

export async function run({out,source=SOURCE,ids,aspects=['9:16','1:1','16:9'],font='Geist',compare}={}){
  assert.ok(!fs.existsSync(out),'Use a fresh output directory');fs.mkdirSync(out,{recursive:true});
  const chosen=ids?fixtures.filter(f=>ids.includes(f.id)):fixtures,api=createRequire(import.meta.url)(path.join(source,'lib/film.cjs'));
  const film=(scene,aspect)=>({aspect,style:'noir',pace:'normal',grain:false,sparks:false,brand:{name:'Каталог',font,tokens:{background:'#101820',foreground:'#f6f6ef',accent:'#b9f24a'}},music:{bpm:108,track:'none'},scenes:[scene]});
  for(const f of chosen)assert.deepEqual(api.problems(film(f.scene,aspects[0])),[],f.id);
  const browser=await createNativeBrowser({source}),page=await browser.newPage(),report={schema:'pure-kinetic.typing-builtin-native.v2',harnessSha256:createHash('sha256').update(fs.readFileSync(fileURLToPath(import.meta.url))).digest('hex'),sourceReceipt:page.sourceHashes,total:chosen.length*aspects.length,
    measurementScope:{paint:'Effective CSS display, visibility, opacity and text alpha.',geometry:'Per-key glyph coordinates in the authored affine frame; morph uses the spring-resized surface center and scrolling inputs use their immutable flow.',inputViewport:'Every active input sample requires horizontal clipping and complete latest-glyph/caret containment in the measured viewport; arbitrary occluding elements are not simulated.'},results:[]};
  const before=compare?JSON.parse(fs.readFileSync(compare,'utf8')):null;
  const write=()=>{report.completed=report.results.length;report.failed=report.results.filter(r=>!r.passed).length;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');};
  try{
    for(const aspect of aspects)for(const entry of chosen){
      const row={id:`${entry.id}-${aspect.replace(':','x')}`,type:entry.scene.type,aspect,font,errors:[]};
      try{
        const {plan}=await page.play(film(entry.scene,aspect)),p=plan.scenes[0],fields=clocks(entry,p),times=timesFor(fields,p.ldur),samples=[];
        row.audioEvents=plan.audioEvents;
        const beforeRow=before?.results.find(result=>result.id===row.id);
        if(beforeRow){assert.deepEqual(row.audioEvents,beforeRow.audioEvents,'Typing migration must preserve compiled sound events');row.audioUnchanged=true;}
        for(const time of times){await page.shoot(p.start+time/p.speed);samples.push({time,fields:await page.evaluate(readFields,fields)});}
        const findings=[],viewportFindings=[];let maxDrift=0,largestJump=null,viewportSamples=0,maxScroll=0;
        for(const spec of fields){
          const candidates=samples.map(s=>({time:s.time,...s.fields.find(f=>f.id===spec.id)}));
          const reference=candidates.findLast(s=>s.text===spec.text);assert.ok(reference,`${spec.id}: complete supplied copy was never visible`);
          for(let t=1;t<candidates.length;t++){
            const a=candidates[t-1],b=candidates[t];
            for(let i=0;i<Math.min(a.glyphs.length,b.glyphs.length);i++){
              if(/\s/u.test(a.glyphs[i].unit)||a.glyphs[i].unit!==b.glyphs[i].unit)continue;
              const dx=b.glyphs[i].x-a.glyphs[i].x,dy=b.glyphs[i].y-a.glyphs[i].y,delta=Math.max(Math.abs(dx),Math.abs(dy));
              if(!largestJump||delta>largestJump.delta)largestJump={field:spec.id,before:a.time,time:b.time,index:i,unit:b.glyphs[i].unit,dx,dy,delta};
            }
          }
          for(const sample of candidates){
            if(sample.input?.active){
              viewportSamples++;maxScroll=Math.max(maxScroll,Math.abs(sample.input.scrollX));
              for(const kind of inputViewportFindings(sample.input))viewportFindings.push({field:spec.id,time:sample.time,kind,input:sample.input});
            }
            assert.ok(spec.text.startsWith(sample.text),`${spec.id}: changed visible copy ${sample.text}`);
            if(sample.text||sample.input?.active){
              const progress=Math.max(0,Math.min(1,(sample.time-spec.from)/spec.span));
              const count=(spec.floor?Math.floor:Math.round)(progress*spec.text.length);
              assert.equal(sample.text,spec.text.slice(0,count),`${spec.id}: visible copy is out of sync with its original typing clock at ${sample.time}`);
            }
            for(const [i,g]of sample.glyphs.entries()){
              if(/\s/u.test(g.unit))continue;
              const expected=reference.glyphs[i];assert.equal(g.unit,expected.unit);
              const dx=g.x-expected.x,dy=g.y-expected.y,drift=Math.max(Math.abs(dx),Math.abs(dy));maxDrift=Math.max(maxDrift,drift);
              if(drift>.35)findings.push({field:spec.id,time:sample.time,index:i,unit:g.unit,dx,dy});
            }
          }
        }
        row.maxDrift=maxDrift;row.largestJump=largestJump;row.findings=findings.slice(0,12);row.findingCount=findings.length;row.sampleCount=samples.length;
        row.viewportSamples=viewportSamples;row.maxScroll=maxScroll;row.viewportFindings=viewportFindings;
        if(fields.some(f=>f.scrolling))assert.ok(viewportSamples>0,'The input viewport must be measured while visible');
        if(fields.some(f=>f.requireScroll))assert.ok(maxScroll>1,'The maximum input fixture must exercise real scrolling');
        for(const sample of [...samples].reverse()){
          await page.shoot(p.start+sample.time/p.speed);const actual=await page.evaluate(readFields,fields);
          // Native transforms round their CSS strings; affine removal can amplify
          // that rounding by a few thousandths, so keep a 0.01px seek tolerance.
          for(let f=0;f<actual.length;f++){
            const expected=sample.fields[f];assert.equal(actual[f].text,expected.text);
            assert.deepEqual(inputViewportFindings(actual[f].input),inputViewportFindings(expected.input));
            if(expected.input){
              assert.equal(actual[f].input.active,expected.input.active);
              assert.ok(Math.abs(actual[f].input.scrollX-expected.input.scrollX)<.01,`${row.id} reverse input scroll at ${sample.time}`);
            }
            assert.equal(actual[f].glyphs.length,expected.glyphs.length);
            actual[f].glyphs.forEach((g,i)=>{for(const key of ['x','y','w','h'])assert.ok(Math.abs(g[key]-expected.glyphs[i][key])<.01,`${row.id} reverse ${key} at ${sample.time}`);});
          }
        }
        row.reverseExact=true;row.reverseWitnesses=samples.length;
        const witness=before?.results.find(result=>result.id===row.id)?.largestJump??largestJump;
        if(witness){
          row.images=[];
          for(const [label,time]of [['a',witness.before],['b',witness.time]]){
            await page.shoot(p.start+time/p.speed);const file=`${row.id}-${label}.png`;await page.screenshot({path:path.join(out,file)});row.images.push({file,time});
          }
        }
        if(!report.negativeControls&&await page.evaluate(()=>Boolean(document.querySelector('[data-typing-host]')))){
          await page.shoot(p.start+p.dur*.98);const clean=await page.evaluate(readFields,fields),visible=clean.find(f=>f.glyphs.length);
          const saved=await page.evaluate(id=>{
            const host=document.querySelector(`[data-typing-id="${id}"]`),unit=host.querySelector('[data-typing-unit]'),style=unit.getAttribute('style');
            unit.style.position='relative';unit.style.left='20px';return style;
          },visible.id);
          const shifted=(await page.evaluate(readFields,fields)).find(f=>f.id===visible.id);
          assert.equal(shifted.text,visible.text);
          assert.ok(Math.abs(shifted.glyphs[0].x-visible.glyphs[0].x)>15,'A real shifted visible unit must fail the geometry gate');
          await page.evaluate(({id,style})=>{const node=document.querySelector(`[data-typing-id="${id}"] [data-typing-unit]`);if(style===null)node.removeAttribute('style');else node.setAttribute('style',style);},{id:visible.id,style:saved});
          assert.deepEqual(await page.evaluate(readFields,fields),clean,'Negative control must restore the rendered state');
          report.negativeControls={shiftedVisibleUnitRejected:true,restoredExact:true};
        }
        if(!report.viewportNegativeControls&&maxScroll>1){
          await page.shoot(p.start+p.dur*.98);
          const clean=await page.evaluate(readFields,fields),scrolled=clean.find(f=>f.input?.active&&f.input.scrollX< -1);
          assert.ok(scrolled,'An overflowing input must scroll by the end of typing');
          const saved=await page.evaluate(id=>{const host=document.querySelector(`[data-typing-id="${id}"]`),value=host.style.transform;host.style.transform='none';return value;},scrolled.id);
          const broken=(await page.evaluate(readFields,fields)).find(f=>f.id===scrolled.id);
          assert.ok(inputViewportFindings(broken.input).length,'Disabling real input scrolling must fail the viewport gate');
          await page.evaluate(({id,value})=>{document.querySelector(`[data-typing-id="${id}"]`).style.transform=value;},{id:scrolled.id,value:saved});
          assert.deepEqual(await page.evaluate(readFields,fields),clean,'Viewport negative control must restore the rendered state');
          report.viewportNegativeControls={disabledScrollingRejected:true,restoredExact:true};
        }
        assert.deepEqual(page.errors,[]);assert.deepEqual(page.externalRequests,[]);
        assert.deepEqual(viewportFindings,[],'The latest input glyph and caret must remain inside the viewport');
        assert.deepEqual(findings,[],'Existing glyphs moved inside their authored frame');row.passed=true;
      }catch(error){row.passed=false;row.errors.push(String(error.stack??error));try{await page.screenshot({path:path.join(out,row.id+'-failure.png')});}catch{}await browser.recycle();}
      report.results.push(row);write();console.log(row.id,row.passed?'pass':row.errors[0].split('\n')[0]);
    }
  }finally{await browser.close();}
  report.sourceAfter=sourceHashes(source);report.sourceStable=report.sourceReceipt.aggregate===report.sourceAfter.aggregate;
  report.passed=report.sourceStable&&report.results.every(r=>r.passed);write();return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),option=(name,otherwise)=>args.includes('--'+name)?args[args.indexOf('--'+name)+1]:otherwise;
  const report=await run({out:path.resolve(option('out','/tmp/pk-typing-builtin')),source:path.resolve(option('source',SOURCE)),font:option('font','Geist'),
    ...(option('cases')?{ids:option('cases').split(',')}:{}),...(option('aspects')?{aspects:option('aspects').split(',')}: {}),...(option('compare')?{compare:path.resolve(option('compare'))}: {})});
  if(!report.passed)process.exitCode=1;
}
