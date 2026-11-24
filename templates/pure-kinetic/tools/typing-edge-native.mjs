// Bidirectional insertion and the last empty line, through the pinned native
// HyperFrames seek path. The oracle is one unsplit, preformatted text node.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createNativeBrowser,sourceHashes,SOURCE,sharp} from './migration-browser.mjs';
import {typewriterTiming} from '../source/lib/components/typewriter-timing.mjs';

export const fixtures=[
  {id:'arabic-mixed',text:'مرحبا AI 123 — واجهة جديدة',beats:6},
  {id:'hebrew-mixed',text:'שלום API 42 — מסך חדש 2026',beats:6},
  {id:'newline-short',text:'Готово\n',beats:5},
  {id:'newline-wrap',text:'The final empty line stays reserved after this longer sentence.\n',beats:8},
];
export const formats=['9:16','1:1','16:9'];

export function samplesFor(schedule,duration){
  const times=new Set([0,duration*.98]);
  for(const {at} of schedule.events)for(const delta of [-.0001,.0001,.025*schedule.scale,.051*schedule.scale]){
    const time=at+delta;if(time>=0&&time<duration)times.add(+time.toFixed(8));
  }
  return [...times].sort((a,b)=>a-b);
}

function mountReference(text){
  const host=document.querySelector('[data-typing-id="typewriter-final"]');
  if(!host)throw new Error('Native typewriter is missing');
  const reference=host.cloneNode(false);
  for(const {name} of [...reference.attributes])if(name.startsWith('data-'))reference.removeAttribute(name);
  reference.dataset.edgeReference='';reference.setAttribute('aria-hidden','true');
  Object.assign(reference.style,{position:'absolute',display:'block',width:getComputedStyle(host).width,height:'auto',left:'0',top:'0',visibility:'hidden',pointerEvents:'none'});
  // A zero-width text character is an independent browser reference for an
  // empty final line; production uses a text-free <br>, never an extra key.
  reference.textContent=text+(text.endsWith('\n')?'\u200b':'');
  host.parentElement.append(reference);
}

function readLayout(){
  const host=document.querySelector('[data-typing-id="typewriter-final"]'),reference=document.querySelector('[data-edge-reference]');
  // Remove scene-camera transforms only during measurement, then restore the
  // exact inline declarations. This measures intrinsic typography, not a zoom.
  const ancestors=[];
  for(let node=host.parentElement;node;node=node.parentElement){ancestors.push([node,node.style.getPropertyValue('transform'),node.style.getPropertyPriority('transform')]);node.style.setProperty('transform','none','important');}
  try{
    const rect=host.getBoundingClientRect(),rr=reference.getBoundingClientRect();
    const box=(r,origin=rect)=>({x:r.x-origin.x,y:r.y-origin.y,w:r.width,h:r.height});
    const count=Number(host.dataset.typingCount),units=[...host.querySelectorAll('[data-typing-unit]')];
    const text=units.map(node=>node.textContent).join(''),refText=reference.firstChild;
    const collapsed=(node,offset,origin)=>{const range=document.createRange();range.setStart(node,offset);range.collapse(true);return box(range.getBoundingClientRect(),origin);};
    let offset=0;
    const glyphs=units.map(node=>{
      const text=node.textContent,range=document.createRange();range.selectNodeContents(node);
      const actual=box(range.getBoundingClientRect());range.setStart(refText,offset);range.setEnd(refText,offset+text.length);
      const expected=box(range.getBoundingClientRect(),rr);offset+=text.length;
      const style=getComputedStyle(node),match=style.color.match(/^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)$/);
      return {text,actual,expected,visible:style.visibility!=='hidden'&&(!match||Number(match[1])>0)};
    });
    const current=units.slice(0,count).map(node=>node.textContent).join('');
    // A logical insertion boundary in the contiguous reference is independent
    // of the span structure and fallback logic used by createTyping.
    const insertion=collapsed(refText,current.length,rr);
    const last=glyphs[count-1],before=last?collapsed(refText,current.length-last.text.length,rr):null;
    const caret=host.querySelector('[data-typing-caret]'),cs=getComputedStyle(caret),cr=box(caret.getBoundingClientRect());
    cr.x-=parseFloat(cs.marginLeft)||0;
    return {count,text,domText:host.textContent,visibleText:glyphs.filter(g=>g.visible).map(g=>g.text).join(''),glyphs,
      host:{w:rect.width,h:rect.height},reference:{w:rr.width,h:rr.height},insertion,before,caret:cr,
      fontSize:parseFloat(getComputedStyle(host).fontSize),lineHeight:parseFloat(getComputedStyle(host).lineHeight),
      terminalCount:host.querySelectorAll('[data-typing-end]').length};
  }finally{for(const [node,value,priority]of ancestors){if(value)node.style.setProperty('transform',value,priority);else node.style.removeProperty('transform');}}
}

export function upstreamInsertion(layout){
  const last=layout.glyphs[layout.count-1],before=layout.before;
  if(!last||last.text==='\n'||!before)return layout.insertion;
  const glyph=last.expected;
  // Bidi boundaries have two caret affinities. Follow the just-typed glyph's
  // trailing edge: the opposite edge from its native logical start. This uses
  // the contiguous reference, never the component's per-character spans.
  if(Math.abs(before.y-glyph.y)<.35&&glyph.w>.35){
    if(Math.abs(before.x-glyph.x)<.35)return {...glyph,x:glyph.x+glyph.w,w:0};
    if(Math.abs(before.x-glyph.x-glyph.w)<.35)return {...glyph,w:0};
  }
  return layout.insertion;
}

export function layoutFindings(layout,{tolerance=.35}={}){
  const findings=[];
  const insertion=upstreamInsertion(layout),{caret}=layout;
  const dx=caret.x-insertion.x,dy=caret.y+caret.h/2-insertion.y-insertion.h/2;
  if(Math.abs(dx)>tolerance||Math.abs(dy)>tolerance)findings.push({kind:'caret-insertion',dx,dy});
  if(Math.abs(layout.host.h-layout.reference.h)>tolerance)findings.push({kind:'line-reservation',actual:layout.host.h,expected:layout.reference.h});
  if(layout.domText!==layout.text)findings.push({kind:'copy-mutated'});
  for(const [index,glyph]of layout.glyphs.entries()){
    if(/\s/u.test(glyph.text))continue;
    for(const key of ['x','y','w','h'])if(Math.abs(glyph.actual[key]-glyph.expected[key])>tolerance){findings.push({kind:'reference-shaping',index,key,actual:glyph.actual[key],expected:glyph.expected[key]});break;}
  }
  return findings;
}

export function driftFindings(layout,reference,{tolerance=.35}={}){
  const findings=[];let maximum=0;
  for(const [index,glyph]of layout.glyphs.entries())for(const key of ['x','y','w','h']){
    const drift=Math.abs(glyph.actual[key]-reference.glyphs[index].actual[key]);maximum=Math.max(maximum,drift);
    if(drift>tolerance)findings.push({kind:'glyph-moved',index,key,drift});
  }
  return {findings,maximum};
}

async function proof(page,out,row,samples){
  const counts=[1,Math.max(2,Math.floor([...row.text].length*.5)),[...row.text].length];
  const images=[];
  for(const count of counts){
    const sample=samples.findLast(s=>s.layout.count===count&&s.layout.visibleText.length>0);if(!sample)continue;
    await page.shoot(sample.globalTime);
    const file=path.join(out,`${row.id}-key-${count}.png`);await page.screenshot({path:file});
    images.push(await sharp(file).resize({width:420,height:420,fit:'contain',background:'#111820'}).png().toBuffer());
  }
  if(images.length){
    const file=path.join(out,`${row.id}-proof.png`);
    await sharp({create:{width:420*images.length,height:420,channels:3,background:'#111820'}}).composite(images.map((input,i)=>({input,left:i*420,top:0}))).png().toFile(file);
    row.proof=path.basename(file);
  }
}

export async function run({out,source=SOURCE,caseIds,aspects=formats}={}){
  assert.ok(out&&!fs.existsSync(out),'Use a fresh output directory');fs.mkdirSync(out,{recursive:true});
  const selected=caseIds?fixtures.filter(row=>caseIds.includes(row.id)):fixtures;assert.ok(selected.length,'No fixtures selected');
  const filmApi=createRequire(import.meta.url)(path.join(source,'lib/film.cjs'));
  const receipt=sourceHashes(source),browser=await createNativeBrowser({source}),page=await browser.newPage();
  assert.equal(page.sourceHashes.aggregate,receipt.aggregate,'Native clone must match the tested production source');
  const report={schema:'pure-kinetic.typing-edge-native.v1',sourceReceipt:receipt,testedSourceReceipt:page.sourceHashes,total:selected.length*aspects.length,results:[],
    policy:{oracle:'One unsplit text node with upstream caret affinity; terminal newline referenced by a zero-width text strut.',tolerance:.35,reverse:'Every sampled time in descending order.'}};
  const write=()=>{report.completed=report.results.length;report.failed=report.results.filter(row=>!row.passed).length;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');};
  try{
    for(const aspect of aspects)for(const fixture of selected){
      const {id,...copy}=fixture,scene={type:'typewriter',...copy},row={id:`${id}-${aspect.replace(':','x')}`,case:id,aspect,text:copy.text,errors:[]};
      try{
        const film={aspect,style:'noir',pace:'normal',grain:false,sparks:false,brand:{name:'Typing',font:'Geist'},music:{track:'none',bpm:108},scenes:[scene]};
        assert.deepEqual(filmApi.problems(film),[],'Fixture must use the public contract');
        const {plan}=await page.play(film),ps=plan.scenes[0],schedule=typewriterTiming(scene,ps.ldur),samples=[];
        assert.deepEqual(plan.audioEvents.filter(event=>event.kind==='type').map(event=>event.t),schedule.events.map(event=>ps.start+event.at/ps.speed),'Layout sentinel must not change sound events');
        await page.evaluate(mountReference,copy.text);
        let maximumGlyphDrift=0;const findings=[];
        for(const time of samplesFor(schedule,ps.ldur)){
          const globalTime=ps.start+time/ps.speed;await page.shoot(globalTime);const layout=await page.evaluate(readLayout);
          const count=schedule.events.filter(event=>event.at<=time+1e-10).length;
          assert.equal(layout.count,count,'Native typing schedule');assert.equal(layout.text,copy.text,'Full semantic copy');assert.equal(layout.domText,copy.text,'No extra sentinel text');
          // At the instant a new key has zero alpha, the previous prefix remains
          // visible. Sampling on either side also covers each fade midpoint.
          assert.ok(copy.text.startsWith(layout.visibleText),'Visible copy must remain a logical prefix');
          assert.ok([...layout.visibleText].length>=Math.max(0,count-1)&&[...layout.visibleText].length<=count,'Only the fresh key may be transparent');
          const drift=samples.length?driftFindings(layout,samples[0].layout):{findings:[],maximum:0};maximumGlyphDrift=Math.max(maximumGlyphDrift,drift.maximum);
          findings.push(...layoutFindings(layout).concat(drift.findings).map(f=>({...f,time,count})));
          samples.push({time,globalTime,layout});
        }
        row.sampleCount=samples.length;row.maximumGlyphDrift=maximumGlyphDrift;row.findings=findings.slice(0,20);row.findingCount=findings.length;
        row.fullCopyExact=true;row.audioEventsExact=true;
        for(const sample of [...samples].reverse()){
          await page.shoot(sample.globalTime);assert.deepEqual(await page.evaluate(readLayout),sample.layout,`Reverse seek at ${sample.time}`);
        }
        row.reverseExact=true;row.reverseWitnesses=samples.length;
        // Native mutations prove the gate detects a misplaced caret and an
        // omitted terminal line; restore exact styles before taking evidence.
        await page.shoot(samples.at(-1).globalTime);const original=await page.evaluate(readLayout);
        const caretStyle=await page.evaluate(()=>{const c=document.querySelector('[data-typing-caret]'),css=c.style.cssText;c.style.left=(parseFloat(c.style.left)+24)+'px';return css;});
        assert.ok(layoutFindings(await page.evaluate(readLayout)).some(f=>f.kind==='caret-insertion'),'Moved caret must fail');
        await page.evaluate(css=>{document.querySelector('[data-typing-caret]').style.cssText=css;},caretStyle);
        row.negativeControls={misplacedCaretRejected:true};
        if(copy.text.endsWith('\n')){
          const style=await page.evaluate(()=>{const node=document.querySelector('[data-typing-end]');if(!node)return null;const css=node.style.cssText;node.style.display='none';return css;});
          assert.notEqual(style,null,'Terminal newline needs a line reservation');
          assert.ok(layoutFindings(await page.evaluate(readLayout)).some(f=>f.kind==='line-reservation'),'Missing final line must fail');
          await page.evaluate(css=>{document.querySelector('[data-typing-end]').style.cssText=css;},style);
          row.negativeControls.missingTerminalLineRejected=true;
        }
        assert.deepEqual(await page.evaluate(readLayout),original,'Native negative controls restore exactly');row.negativeControls.restoredExact=true;
        await proof(page,out,row,samples);
        assert.deepEqual(page.errors,[]);assert.deepEqual(page.externalRequests,[]);
        assert.equal(findings.length,0,`Typography edge failure: ${JSON.stringify(findings[0])}`);row.passed=true;
      }catch(error){row.passed=false;row.errors.push(String(error.stack??error));try{await page.screenshot({path:path.join(out,`${row.id}-failure.png`)});}catch{}await browser.recycle();}
      report.results.push(row);write();console.log(row.id,row.passed?'pass':row.errors[0].split('\n')[0]);
    }
  }finally{await browser.close();}
  report.sourceAfter=sourceHashes(source);report.sourceStable=receipt.aggregate===report.sourceAfter.aggregate;
  report.passed=report.sourceStable&&report.results.length===report.total&&report.results.every(row=>row.passed);write();return report;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),option=(key,fallback)=>args.includes('--'+key)?args[args.indexOf('--'+key)+1]:fallback;
  const report=await run({out:path.resolve(option('out','/tmp/pk-typing-edge-native')),source:path.resolve(option('source',SOURCE)),
    ...(option('cases')?{caseIds:option('cases').split(',')}:{}),...(option('aspects')?{aspects:option('aspects').split(',')}: {})});
  if(!report.passed)process.exitCode=1;
}
