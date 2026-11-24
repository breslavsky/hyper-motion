// Native regression for the geometry of text that has already been typed.
// Uses the actual HyperFrames seek path and browser Range boxes, not a simulated layout.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createNativeBrowser, sourceHashes, SOURCE} from './migration-browser.mjs';
import {typewriterTiming} from '../source/lib/components/typewriter-timing.mjs';

export const fixtures = [
  {id:'demo', text:'Текст, ритм и ясные акценты.', beats:5},
  {id:'wrap', text:'Words stay in place while the next longer word is being written.', beats:7},
  {id:'append', text:'Текст, ритм и', then:'ясные акценты.', beats:7},
  {id:'erase', text:'We make everything unnecessarily complex.', erase:22, then:'clear and useful.', beats:8},
  {id:'emoji', text:'Идея 🚀 становится яснее ✨', erase:1, then:'🎉', beats:7},
  {id:'newline', text:'Первая строка\nВторая строка.', beats:7},
  {id:'wide-original', text:'MMMMMMMMMMMMMMMM', erase:16, then:'iiiiiiiiiiiiiiiiiiiiiiii', beats:8},
];
export const formats=['9:16','1:1','16:9'];
export const fonts=['Geist','Archivo','Geist Mono','Instrument Serif'];

function readLayout() {
  const instance=window.__pkScenes.s1;
  const line=instance.root.querySelector('[data-typewriter-line]')??instance.root.querySelector('.cam .bold');
  if(!line)throw new Error('Missing typewriter text line');
  const wrap=line.parentElement,frame=wrap.getBoundingClientRect();
  const sx=frame.width/wrap.offsetWidth,sy=frame.height/wrap.offsetHeight;
  const box=rect=>({x:(rect.x-frame.x)/sx,y:(rect.y-frame.y)/sy,w:rect.width/sx,h:rect.height/sy});
  const opacity=node=>{let value=1;for(let p=node;p&&p!==wrap;p=p.parentElement){const style=getComputedStyle(p);if(style.visibility==='hidden'||style.display==='none')return 0;value*=Number(style.opacity);}return value;};
  const colorAlpha=node=>{
    const color=getComputedStyle(node).color;
    const alpha=/^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)$/.exec(color)??/\/\s*([\d.]+)\s*\)$/.exec(color);
    return alpha?Number(alpha[1]):1;
  };
  const layer=[...line.querySelectorAll('[data-typewriter-layout]')].find(node=>opacity(node)>.5);
  const parts=layer?null:Object.fromEntries(['typed','fresh','caret','rest'].map((name,index)=>[name,line.querySelector(`[data-typewriter-part="${name}"]`)??line.children[index]]));
  const units=layer?[...layer.querySelectorAll('[data-typewriter-unit]')]:[];
  const painted=node=>opacity(node)*(node.matches('[data-emoji]')||node.querySelector('[data-emoji]')?1:colorAlpha(node));
  const shown=units.filter(node=>painted(node)>0),future=units.filter(node=>painted(node)===0);
  const caret=layer?layer.querySelector('[data-typewriter-part="caret"]'):parts.caret;
  const glyphs=[];
  const semantic=node=>{
    if(node.nodeType===Node.TEXT_NODE)return node.nodeValue;
    if(node.dataset?.emoji)return node.dataset.emoji;
    return [...node.childNodes].map(semantic).join('');
  };
  function visit(node) {
    if(node.nodeType===Node.TEXT_NODE){
      for(let offset=0;offset<node.length;){
        const unit=String.fromCodePoint(node.nodeValue.codePointAt(offset)),range=document.createRange();
        range.setStart(node,offset);range.setEnd(node,offset+unit.length);
        glyphs.push({unit,...box(range.getBoundingClientRect()),opacity:opacity(node.parentElement)*(layer?colorAlpha(node.parentElement):1)});
        offset+=unit.length;
      }
    }else if(node.dataset?.emoji){
      // The bundled SVG is one shaped object; do not inspect its path text.
      for(const unit of [...node.dataset.emoji])glyphs.push({unit,...box(node.getBoundingClientRect()),opacity:opacity(node),emoji:true});
    }else for(const child of node.childNodes)visit(child);
  }
  if(layer)shown.forEach(visit);else{visit(parts.typed);visit(parts.fresh);}
  const style=getComputedStyle(line),caretStyle=getComputedStyle(caret);
  const full=layer?units.map(semantic).join(''):semantic(parts.typed)+semantic(parts.fresh)+semantic(parts.rest);
  const visibleText=layer?shown.map(semantic).join(''):semantic(parts.typed)+semantic(parts.fresh);
  const leaves=node=>{
    if(node.nodeType===Node.TEXT_NODE)return node.length?[node]:[];
    if(node.dataset?.emoji)return [node];
    return [...node.childNodes].flatMap(leaves);
  };
  const visibleLeaves=layer?shown.flatMap(leaves):[...leaves(parts.typed),...leaves(parts.fresh)],futureLeaves=layer?future.flatMap(leaves):leaves(parts.rest);
  const atStart=!visibleLeaves.length||visibleText.endsWith('\n');
  const anchor=atStart?futureLeaves[0]:visibleLeaves.at(-1);
  let insertion=null;
  if(anchor){
    const range=document.createRange();
    if(anchor.nodeType===Node.TEXT_NODE)range.setStart(anchor,atStart?0:anchor.length);
    else if(atStart)range.setStartBefore(anchor);else range.setStartAfter(anchor);
    range.collapse(true);const rect=range.getBoundingClientRect();
    if(rect.height>0)insertion=box(rect);
    else if(anchor.nodeType===Node.ELEMENT_NODE){const b=box(anchor.getBoundingClientRect());insertion={...b,x:atStart?b.x:b.x+b.w,w:0};}
  }
  return {
    text:visibleText,full,glyphs,insertion,
    reference:layer?.dataset.typewriterLayout??line.dataset.typewriterReference??null,
    line:box(line.getBoundingClientRect()),wrap:{w:wrap.offsetWidth,h:wrap.offsetHeight},
    fontSize:parseFloat(style.fontSize),lineHeight:parseFloat(style.lineHeight),
    whiteSpace:style.whiteSpace,parts:layer?units.map(node=>({text:semantic(node),painted:painted(node)})):Object.fromEntries(Object.entries(parts).map(([name,node])=>[name,{text:semantic(node),opacity:getComputedStyle(node).opacity}])),
    caret:{...box(caret.getBoundingClientRect()),position:caretStyle.position,opacity:opacity(caret)},
    hiddenRest:layer?full.startsWith(visibleText):getComputedStyle(parts.rest).visibility==='hidden',
    emoji:[...(layer??line).querySelectorAll('[data-emoji]')].filter(node=>opacity(node)>0).map(node=>({text:node.dataset.emoji,svg:Boolean(node.querySelector('svg path'))})),
  };
}

function expectedText(schedule,time) {
  const source=[...schedule.textUnits,...schedule.thenUnits],visible=[];let next=0;
  for(const event of schedule.events){
    if(event.at>time+1e-10)break;
    if(event.action==='erase')visible.pop();
    else visible.push(source[next++]);
  }
  return visible.join('');
}

function sampleTimes(schedule,duration) {
  const times=new Set([0,duration*.98]);
  const add=time=>{if(time>=0&&time<duration)times.add(+time.toFixed(8));};
  for(const event of schedule.events){
    add(event.at-.0001);add(event.at+.0001);
    add(event.at+.025*schedule.scale);add(event.at+.051*schedule.scale);
  }
  for(const at of [schedule.typedEnd,schedule.eraseStart,schedule.eraseEnd,schedule.eraseEnd+.15,schedule.total]){
    add(at*schedule.scale-.0001);add(at*schedule.scale+.0001);
  }
  return [...times].sort((a,b)=>a-b);
}

function phaseOf(snapshot,scene,schedule,time) {
  return snapshot.reference??(scene.erase&&time/schedule.scale<=schedule.eraseEnd?'original':'final');
}

function geometryFindings(samples,scene,schedule,{tolerance=.35}={}) {
  const references=new Map();
  for(const sample of samples){
    const phase=phaseOf(sample.layout,scene,schedule,sample.time),current=references.get(phase);
    if(!current||sample.layout.glyphs.length>=current.layout.glyphs.length)references.set(phase,sample);
  }
  const findings=[];let maximumDrift=0;
  for(const sample of samples){
    const phase=phaseOf(sample.layout,scene,schedule,sample.time),reference=references.get(phase);
    for(const [index,glyph]of sample.layout.glyphs.entries()){
      if(/\s/u.test(glyph.unit)||glyph.opacity<.99)continue;
      const anchor=reference.layout.glyphs[index];
      if(!anchor||anchor.unit!==glyph.unit)continue;
      const dx=glyph.x-anchor.x,dy=glyph.y-anchor.y,drift=Math.max(Math.abs(dx),Math.abs(dy));
      maximumDrift=Math.max(maximumDrift,drift);
      if(drift>tolerance)findings.push({kind:'existing-glyph-moved',phase,time:sample.time,index,unit:glyph.unit,dx,dy,referenceTime:reference.time});
    }
    if(sample.layout.glyphs.length){
      const delta=sample.layout.line.y-reference.layout.line.y;
      if(Math.abs(delta)>tolerance)findings.push({kind:'line-box-recentered',phase,time:sample.time,dy:delta});
    }
    const layout=sample.layout,last=layout.glyphs.at(-1);
    if(layout.line.w>layout.wrap.w*.8+1||layout.line.h>layout.wrap.h*.3+1)
      findings.push({kind:'line-outside-capacity',time:sample.time,line:layout.line,wrap:layout.wrap});
    const ink=layout.glyphs.filter(g=>!/\s/u.test(g.unit)&&g.opacity>=.99);
    if(ink.length){
      const bounds={x:Math.min(...ink.map(g=>g.x)),right:Math.max(...ink.map(g=>g.x+g.w)),y:Math.min(...ink.map(g=>g.y)),bottom:Math.max(...ink.map(g=>g.y+g.h))};
      if(bounds.x<layout.line.x-1||bounds.right>layout.line.x+layout.line.w+1||bounds.bottom-bounds.y>layout.wrap.h*.3+layout.fontSize*.3+1)
        findings.push({kind:'text-outside-capacity',time:sample.time,bounds,line:layout.line});
    }
    const anchor=layout.insertion??(last&&!/\s/u.test(last.unit)?{...last,x:last.x+last.w,w:0}:null);
    if(anchor&&layout.caret.opacity>.1){
      const dx=layout.caret.x-anchor.x,dy=layout.caret.y+layout.caret.h/2-anchor.y-anchor.h/2;
      if(dx<-.15*layout.fontSize||dx>.2*layout.fontSize||Math.abs(dy)>layout.lineHeight*.3)
        findings.push({kind:'caret-detached-from-insertion',time:sample.time,dx,dy,anchor,caret:layout.caret});
    }
  }
  return {findings,maximumDrift,phases:[...references.keys()]};
}

export async function run({out,source=SOURCE,caseIds,aspects=formats,brandFonts=fonts}={}) {
  assert.ok(!fs.existsSync(out),'Use a fresh output directory');fs.mkdirSync(out,{recursive:true});
  const selected=caseIds?fixtures.filter(row=>caseIds.includes(row.id)):fixtures;
  assert.ok(selected.length,'No selected fixtures');
  const filmApi=createRequire(import.meta.url)(path.join(source,'lib/film.cjs'));
  for(const {id,...copy}of selected)assert.deepEqual(filmApi.problems({aspect:aspects[0],style:'noir',brand:{name:'Typing',font:brandFonts[0]},scenes:[{type:'typewriter',...copy}]}),[],`Invalid public fixture ${id}`);
  const receipt=sourceHashes(source),browser=await createNativeBrowser({source}),page=await browser.newPage();
  const report={schema:'pure-kinetic.typewriter-layout-native.v1',sourceReceipt:receipt,
    policy:{measurement:'Per-codepoint Range boxes in the center wrapper coordinate system; intentional reference changes are separate phases.',tolerance:.35,reverse:'Every sampled time, in descending order.'},
    total:selected.length*aspects.length*brandFonts.length,results:[]};
  const write=()=>{report.completed=report.results.length;report.failed=report.results.filter(row=>!row.passed).length;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');};
  try{
    for(const aspect of aspects)for(const font of brandFonts)for(const entry of selected){
      const {id,...copy}=entry,scene={type:'typewriter',...copy},row={id:`${id}-${aspect.replace(':','x')}-${font.replaceAll(' ','-')}`,case:id,aspect,font,scene,errors:[]};
      try{
        const {plan}=await page.play({aspect,style:'noir',pace:'normal',grain:false,sparks:false,
          brand:{name:'Typing',font,tokens:{background:'#101820',foreground:'#f6f6ef',accent:'#b9f24a'}},
          music:{track:'none',bpm:108},scenes:[scene]});
        const ps=plan.scenes[0],schedule=typewriterTiming(scene,ps.ldur),times=sampleTimes(schedule,ps.ldur),samples=[];
        assert.deepEqual(plan.audioEvents.filter(event=>event.kind==='type').map(event=>event.t),schedule.events.map(event=>ps.start+event.at/ps.speed),'Audio key/erase events changed');
        for(const time of times){
          await page.shoot(ps.start+time/ps.speed);const layout=await page.evaluate(readLayout);
          assert.equal(layout.text,expectedText(schedule,time),`Visible semantic copy at ${time}`);
          assert.ok(layout.hiddenRest,'Unwritten copy must remain hidden');
          samples.push({time,layout});
        }
        const phaseSequence=[];
        for(const sample of samples){
          const phase=phaseOf(sample.layout,scene,schedule,sample.time);
          if(phaseSequence.at(-1)!==phase)phaseSequence.push(phase);
          assert.equal(sample.layout.full,phase==='original'?scene.text:schedule.finalText,'Reserved copy must remain complete inside its phase');
        }
        assert.deepEqual(phaseSequence,scene.erase?['original','final']:['final'],'A reference may change only once at the edit boundary');
        row.phaseSequence=phaseSequence;
        const proof=geometryFindings(samples,scene,schedule);Object.assign(row,{sampleCount:samples.length,maximumGlyphDrift:proof.maximumDrift,phases:proof.phases,findings:proof.findings.slice(0,12),findingCount:proof.findings.length});
        // Check every seek in reverse, including fades and edit boundaries.
        for(const sample of [...samples].reverse()){
          await page.shoot(ps.start+sample.time/ps.speed);
          const reverse=await page.evaluate(readLayout);
          try{assert.deepEqual(reverse,sample.layout,`Reverse seek changed layout at ${sample.time}`);}
          catch(error){row.reverseFailure={time:sample.time,forward:sample.layout,reverse};throw error;}
        }
        row.reverseExact=true;row.reverseWitnesses=samples.length;
        await page.shoot(ps.start+ps.dur*.98);const final=await page.evaluate(readLayout);
        assert.equal(final.text,schedule.finalText,'Final copy changed');
        assert.ok(final.emoji.every(value=>value.svg),'Typed emoji must use bundled SVG');
        if(!report.negativeControls&&await page.evaluate(()=>Boolean(document.querySelector('[data-typewriter-unit]')))){
          const original=await page.evaluate(()=>{
            const line=document.querySelector('[data-typewriter-line]');
            const layer=[...line.querySelectorAll('[data-typewriter-layout]')].find(node=>getComputedStyle(node).opacity==='1');
            const node=layer.querySelector('[data-typewriter-unit]');
            const previous={value:node.style.getPropertyValue('visibility'),priority:node.style.getPropertyPriority('visibility')};
            node.style.setProperty('visibility','hidden','important');return previous;
          });
          const hidden=await page.evaluate(readLayout);
          assert.notEqual(hidden.text,schedule.finalText,'A forcibly hidden visible unit must fail the semantic copy check');
          await page.evaluate(previous=>{
            const layer=[...document.querySelectorAll('[data-typewriter-layout]')].find(node=>getComputedStyle(node).opacity==='1');
            const node=layer.querySelector('[data-typewriter-unit]');
            if(previous.value)node.style.setProperty('visibility',previous.value,previous.priority);else node.style.removeProperty('visibility');
          },original);
          assert.deepEqual(await page.evaluate(readLayout),final,'Visibility negative control must restore the native scene exactly');
          report.negativeControls={hiddenVisibleUnitRejected:true,restoredExact:true};
        }
        if(scene.text.includes('\n')){
          const firstLine=final.glyphs.slice(0,final.glyphs.findIndex(g=>g.unit==='\n'));
          const second=final.glyphs.find((g,i)=>i>firstLine.length&&!/\s/u.test(g.unit));
          assert.ok(second&&second.y>firstLine[0].y+final.lineHeight*.5,'Explicit newline must remain a separate line');
        }
        assert.deepEqual(page.errors,[]);assert.deepEqual(page.externalRequests,[]);
        if(proof.findings.length){
          const witness=proof.findings[0].time;await page.shoot(ps.start+witness/ps.speed);
          await page.screenshot({path:path.join(out,`${row.id}-failure.png`)});
          assert.fail(`Typed glyph geometry changed: ${JSON.stringify(proof.findings[0])}`);
        }
        row.passed=true;
      }catch(error){row.passed=false;row.errors.push(String(error.stack??error));try{await page.screenshot({path:path.join(out,`${row.id}-failure.png`)});}catch{}await browser.recycle();}
      report.results.push(row);write();console.log(row.id,row.passed?'pass':row.errors[0].split('\n')[0]);
    }
  }finally{await browser.close();}
  report.sourceAfter=sourceHashes(source);report.sourceStable=receipt.aggregate===report.sourceAfter.aggregate;
  report.passed=report.sourceStable&&report.results.every(row=>row.passed);write();return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),option=(key,fallback)=>args.includes('--'+key)?args[args.indexOf('--'+key)+1]:fallback;
  const report=await run({out:path.resolve(option('out','/tmp/pk-typewriter-layout')),source:path.resolve(option('source',SOURCE)),
    ...(option('cases')?{caseIds:option('cases').split(',')}:{}),...(option('aspects')?{aspects:option('aspects').split(',')}:{}),
    ...(option('fonts')?{brandFonts:option('fonts').split(',')}: {})});
  if(!report.passed)process.exitCode=1;
}
