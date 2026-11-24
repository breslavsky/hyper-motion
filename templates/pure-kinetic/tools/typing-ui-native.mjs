// Native per-key regression for code, address bars and prompt inputs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createNativeBrowser,sourceHashes,SOURCE} from './migration-browser.mjs';
import {maximumScene} from './quality-layout.mjs';
import metadata from '../source/lib/components/metadata.mjs';
import {hash,clamp} from '../source/lib/components/maths.mjs';

export const fixtures=[
  {id:'code-rich',scene:{type:'code',title:'story.ts',beats:7,lines:[
    'const title = "Идея 🚀: понятный длинный ролик";',
    'const count = 42;', '// Preserve words that are already on screen', 'return title;']}},
  {id:'code-max',scene:maximumScene('code')},
  {id:'browser-unicode',scene:{type:'browser',url:'пример.рф/🚀',beats:4}},
  {id:'browser-scroll',scene:{type:'browser',url:'www.'+'w'.repeat(31)+'.app',beats:5}},
  {id:'ask-short',scene:{type:'ask',text:'Собери понятный ролик',reply:'Готово. Детали на своих местах.',beats:6}},
  {id:'ask-wrap',scene:maximumScene('ask')},
  {id:'ask-unicode',scene:{type:'ask',text:'Идея 🚀 становится понятным роликом ✨',beats:6}},
];
const formats=['9:16','1:1','16:9'],fonts=['Geist','Instrument Serif'];

function countAt(scene,duration,time){
  if(scene.type==='code'){
    const total=scene.lines.reduce((n,s)=>n+s.length,0),end=duration*.82;
    return Math.min(total,Math.floor(clamp((time-.25)/Math.max(.3,end-.25))*total+hash(Math.floor(time*12))*.5));
  }
  if(scene.type==='browser')return Math.round(clamp((time-.15)/Math.max(.2,duration*.42-.15))*scene.url.length);
  const t=metadata.ask.times(scene,duration);
  return Math.round(clamp((time-t.type)/(t.typed-t.type))*[...scene.text].length);
}
function keyTimes(scene,duration){
  const total=scene.type==='code'?scene.lines.reduce((n,s)=>n+s.length,0):scene.type==='browser'?scene.url.length:[...scene.text].length;
  const times=new Set([0,duration*.96]);
  for(let n=0;n<=total;n++){
    let t;
    if(scene.type==='code')t=.25+Math.max(.3,duration*.82-.25)*(n+.25)/total;
    else if(scene.type==='browser')t=.15+Math.max(.2,duration*.42-.15)*n/total;
    else {const at=metadata.ask.times(scene,duration);t=at.type+(at.typed-at.type)*n/total;}
    if(t<duration)times.add(+t.toFixed(9));
  }
  return [...times].sort((a,b)=>a-b);
}
function prefix(text,count,unit){
  let used=0,result='';
  for(const ch of text){used+=unit==='utf16'?ch.length:1;if(used>count)break;result+=ch;}
  return result;
}

export function readLayout(type){
  const instance=window.__pkScenes.s1,root=instance.root;
  const rich=Boolean(root.querySelector('[data-typing-host]'));
  const entries=type==='code'?[...root.querySelectorAll('[data-code-line]')].map(row=>({id:`code-line-${row.dataset.codeLine}`,host:row.children[1],anchor:row.children[1]})):
    type==='browser'?[{id:'browser-url',host:root.querySelector('[data-typing-id="browser-url"]')??root.querySelector('[data-design-role="controlLabel"]').children[1]}]:
    [{id:'ask-prompt',host:root.querySelector('[data-typing-id="ask-prompt"]')??root.querySelector('[data-design-role="body"]')}];
  const visible=node=>{let alpha=1;for(let p=node;p&&p!==root;p=p.parentElement){const s=getComputedStyle(p);if(s.visibility==='hidden'||s.display==='none')return 0;alpha*=Number(s.opacity);}return alpha;};
  const color=node=>{const v=getComputedStyle(node).color.match(/[\d.]+/g)?.map(Number)??[0,0,0];return [...v.slice(0,3),v[3]??1];};
  const semantic=node=>node.nodeType===3?node.nodeValue:node.dataset?.emoji??[...node.childNodes].map(semantic).join('');
  const viewport=root.querySelector('[data-typing-viewport]');
  // Camera, spring and address scrolling transforms are intentionally animated.
  // Remove them only while measuring intrinsic layout, then restore exact styles.
  const transforms=new Map();
  for(const {host}of entries)for(let p=host;p;p=p.parentElement){
    if(!transforms.has(p)){transforms.set(p,p.style.transform);p.style.transform='none';}
  }
  const round=n=>Math.round(n*1e5)/1e5,rect=(r,o)=>({x:round(r.x-o.x),y:round(r.y-o.y),w:round(r.width),h:round(r.height)});
  const hosts=[];
  try{
    for(const entry of entries){
      const {host,id}=entry,anchor=entry.anchor??(type==='ask'?host.parentElement:host),origin=anchor.getBoundingClientRect();
      const active=visible(host)>.01,units=rich?[...host.querySelectorAll('[data-typing-unit]')]:[];
      const glyphs=[];let index=0,lastVisible=null;
      const visit=(node,paint)=>{
        if(node.nodeType===3){
          for(let off=0;off<node.length;){const ch=String.fromCodePoint(node.nodeValue.codePointAt(off)),range=document.createRange();range.setStart(node,off);range.setEnd(node,off+ch.length);glyphs.push({index:index++,text:ch,...rect(range.getBoundingClientRect(),origin),paint,color:color(node.parentElement)});off+=ch.length;if(paint>.99)lastVisible={node,offset:off};}
        }else if(node.dataset?.emoji){
          for(const ch of [...node.dataset.emoji])glyphs.push({index:index++,text:ch,...rect(node.getBoundingClientRect(),origin),paint,color:color(node),emoji:true,svg:Boolean(node.querySelector('svg path'))});
          if(paint>.99)lastVisible={node};
        }else if(!node.matches?.('[data-typing-caret],.caret'))for(const child of node.childNodes)visit(child,paint);
      };
      if(rich){for(const node of units){const paint=active?visible(node)*(node.dataset.emoji?1:color(node)[3]):0;if(paint>0)visit(node,paint);else index+=[...semantic(node)].length;}}
      else if(active&&type==='ask')visit(host.children[0],1);
      else if(active)visit(host,1);
      const painted=glyphs.filter(g=>g.paint>0);
      let caret=host.querySelector('[data-typing-caret]')??(type==='ask'?host.children[1]:type==='browser'?host.nextElementSibling:null);
      if(type==='code')caret=root.querySelector('[data-code-pages] .caret');
      let insertion=null;
      if(lastVisible){
        const range=document.createRange();
        if(lastVisible.node.nodeType===3)range.setStart(lastVisible.node,lastVisible.offset);else range.setStartAfter(lastVisible.node);
        range.collapse(true);const box=[...range.getClientRects()].find(r=>r.height>0);
        if(box)insertion=rect(box,origin);
        else {const node=lastVisible.node.nodeType===3?lastVisible.node.parentElement:lastVisible.node,b=node.getBoundingClientRect();insertion={...rect(b,origin),x:round(b.right-origin.x),w:0};}
      }
      hosts.push({id,active,full:rich?units.map(semantic).join(''):null,text:painted.map(g=>g.text).join(''),glyphs,box:rect(host.getBoundingClientRect(),origin),
        insertion,fontSize:parseFloat(getComputedStyle(host).fontSize),caret:caret?{...rect(caret.getBoundingClientRect(),origin),visible:visible(caret),gap:parseFloat(getComputedStyle(caret).marginLeft)||0}:null});
    }
  }finally{for(const [node,value]of transforms)node.style.transform=value;}
  let scroll=null;
  if(viewport){
    const flow=viewport.firstElementChild,vr=viewport.getBoundingClientRect(),scale=vr.width/viewport.offsetWidth,caret=flow.querySelector('[data-typing-caret]');
    const nodes=[...flow.querySelectorAll('[data-typing-unit]')].filter(n=>visible(n)>.99&&color(n)[3]>.99),last=nodes.at(-1);
    const inViewport=n=>{if(!n)return null;const r=n.getBoundingClientRect();return{x:(r.x-vr.x)/scale,y:(r.y-vr.y)/scale,w:r.width/scale,h:r.height/scale};};
    scroll={w:viewport.clientWidth,h:viewport.clientHeight,caret:inViewport(caret),caretVisible:visible(caret),last:inViewport(last),count:Number(flow.dataset.typingCount)};
  }
  if(type==='code'){const last=hosts.findLast(h=>h.active&&h.text);for(const h of hosts)h.caretRelevant=h===last;}else for(const h of hosts)h.caretRelevant=true;
  return {rich,hosts,scroll,page:root.querySelector('[data-code-pages]')?.dataset.codePage??null};
}

function findings(samples){
  const refs=new Map(),out=[];let maximumDrift=0;
  for(const sample of samples)for(const host of sample.layout.hosts)if(host.active&&(!refs.has(host.id)||host.text.length>=refs.get(host.id).host.text.length))refs.set(host.id,{host,time:sample.time});
  for(const sample of samples)for(const host of sample.layout.hosts){
    if(!host.active)continue;const ref=refs.get(host.id);if(!ref)continue;
    for(const glyph of host.glyphs){
      if(glyph.paint<.99||/\s/u.test(glyph.text))continue;
      const anchor=ref.host.glyphs.find(g=>g.index===glyph.index&&g.text===glyph.text);if(!anchor)continue;
      const delta=Math.max(Math.abs(glyph.x-anchor.x),Math.abs(glyph.y-anchor.y));maximumDrift=Math.max(maximumDrift,delta);
      if(delta>.35)out.push({kind:'existing-glyph-moved',host:host.id,time:sample.time,referenceTime:ref.time,index:glyph.index,delta});
      if(JSON.stringify(glyph.color)!==JSON.stringify(anchor.color))out.push({kind:'syntax-ink-changed',host:host.id,time:sample.time,index:glyph.index});
    }
    if(host.caretRelevant&&host.caret?.visible>.1&&host.insertion){
      const c=host.caret,p=host.insertion,dx=c.x-p.x-c.gap,dy=c.y+c.h/2-p.y-p.h/2;
      if(Math.abs(dx)>Math.max(4,.15*host.fontSize)||Math.abs(dy)>.32*host.fontSize)out.push({kind:'caret-detached',host:host.id,time:sample.time,dx,dy});
    }
  }
  for(const sample of samples){const s=sample.layout.scroll;if(!s)continue;
    for(const [kind,b]of [['caret',s.caretVisible>.1?s.caret:null],['new-glyph',s.last]])if(b&&(b.x<-.6||b.x+b.w>s.w+.6||b.y<-.6||b.y+b.h>s.h+1))out.push({kind:`url-${kind}-outside-viewport`,time:sample.time,box:b,viewport:{w:s.w,h:s.h}});
  }
  return {findings:out,maximumDrift};
}

export async function run({out,source=SOURCE,caseIds,aspects=formats,brandFonts=fonts,baseline}={}){
  assert.ok(!fs.existsSync(out),'Use a fresh output directory');fs.mkdirSync(out,{recursive:true});
  const require=createRequire(import.meta.url),api=require(path.join(source,'lib/film.cjs')),prior=baseline?require(path.join(baseline,'lib/compiler/plan.cjs')):null;
  const selected=caseIds?fixtures.filter(f=>caseIds.includes(f.id)):fixtures;
  const sourceReceipt=sourceHashes(source),browser=await createNativeBrowser({source}),page=await browser.newPage();
  const report={schema:'pure-kinetic.typing-ui-native.v1',sourceReceipt,testedSourceReceipt:page.sourceHashes,policy:{measurement:'Actual Range geometry with camera/scroll transforms temporarily removed; actual paint visibility/colour; separate address viewport bounds.',tolerance:.35,reverse:'Every sampled key in descending order.'},total:selected.length*aspects.length*brandFonts.length,results:[]};
  const write=()=>{report.completed=report.results.length;report.failed=report.results.filter(r=>!r.passed).length;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');};
  try{for(const aspect of aspects)for(const font of brandFonts)for(const entry of selected){
    const scene=entry.scene,row={id:`${entry.id}-${aspect.replace(':','x')}-${font.replaceAll(' ','-')}`,type:scene.type,case:entry.id,aspect,font,errors:[]};
    try{
      const film={aspect,style:'noir',pace:'normal',grain:false,sparks:false,brand:{name:'Typing',font,tokens:{background:'#101820',foreground:'#f6f6ef',accent:'#b9f24a'}},music:{track:'none',bpm:108},scenes:[scene]};
      assert.deepEqual(api.problems(film),[]);
      const {plan}=await page.play(film),ps=plan.scenes[0],times=keyTimes(scene,ps.ldur),samples=[];
      if(prior){assert.deepEqual(plan,prior.compile(film),'Timeline/audio plan changed');row.planUnchanged=true;}
      for(const time of times){
        await page.shoot(ps.start+time/ps.speed);const layout=await page.evaluate(readLayout,scene.type),count=countAt(scene,ps.ldur,time);
        let remaining=count;
        for(const [i,host]of layout.hosts.entries()){
          const full=scene.type==='code'?scene.lines[i]:scene.type==='browser'?scene.url:scene.text,unit=scene.type==='ask'?'codepoint':'utf16';
          const n=scene.type==='code'?Math.max(0,Math.min(full.length,remaining)):count;remaining-=full.length;
          if(layout.rich)assert.equal(host.full,full,'Immutable full copy changed');
          if(host.active)assert.equal(host.text,prefix(full,n,unit),`Visible copy at ${time}, ${host.id}`);
        }
        samples.push({time,layout});
      }
      const proof=findings(samples);Object.assign(row,{sampleCount:samples.length,maximumGlyphDrift:proof.maximumDrift,findings:proof.findings.slice(0,16),findingCount:proof.findings.length});
      for(const sample of [...samples].reverse()){
        await page.shoot(ps.start+sample.time/ps.speed);assert.deepEqual(await page.evaluate(readLayout,scene.type),sample.layout,`Reverse seek changed state at ${sample.time}`);
      }
      row.reverseExact=true;row.reverseWitnesses=samples.length;
      if(!report.negativeControl&&samples.some(s=>s.layout.rich)){
        const sample=samples.findLast(s=>s.layout.hosts.some(h=>h.active&&h.text.trim()));await page.shoot(ps.start+sample.time/ps.speed);
        const shifted=await page.evaluate(()=>{
          const n=[...document.querySelectorAll('[data-typing-unit]')].find(n=>getComputedStyle(n).visibility==='visible'&&n.textContent.trim()&&n.getBoundingClientRect().width>0);
          const before=n.style.cssText;n.style.position='relative';n.style.left='80px';n.dataset.typingNegative='';return before;
        });
        const bad=await page.evaluate(readLayout,scene.type);
        assert.ok(findings([{time:sample.time-.00001,layout:bad},sample]).findings.some(f=>f.kind==='existing-glyph-moved'),'Moved visible glyph must be rejected');
        await page.evaluate(css=>{const n=document.querySelector('[data-typing-negative]');n.style.cssText=css;delete n.dataset.typingNegative;},shifted);
        assert.deepEqual(await page.evaluate(readLayout,scene.type),sample.layout);report.negativeControl={shiftedVisibleGlyphRejected:true,restoredExact:true};
        const early=samples.find(s=>s.layout.hosts.some(h=>h.active&&h.full&&h.text.length<h.full.length));
        if(early){
          await page.shoot(ps.start+early.time/ps.speed);
          const changed=await page.evaluate(()=>{
            const node=[...document.querySelectorAll('[data-typing-unit]')].find(n=>getComputedStyle(n).visibility==='hidden'&&(n.textContent.trim()||n.dataset.emoji)&&n.getBoundingClientRect().width>0);
            const css=node.style.cssText;node.dataset.typingNegative='';node.style.setProperty('visibility','visible','important');node.style.setProperty('color','rgb(255,255,255)','important');return css;
          });
          const visibleFuture=await page.evaluate(readLayout,scene.type);
          assert.notDeepEqual(visibleFuture.hosts.map(h=>h.text),early.layout.hosts.map(h=>h.text),'Painting an unwritten unit must change the measured visible copy');
          await page.evaluate(css=>{const n=document.querySelector('[data-typing-negative]');n.style.cssText=css;delete n.dataset.typingNegative;},changed);
          assert.deepEqual(await page.evaluate(readLayout,scene.type),early.layout);report.negativeControl.unwrittenInkRejected=true;
        }
      }
      const largest=proof.findings.filter(f=>f.kind==='existing-glyph-moved').sort((a,b)=>b.delta-a.delta)[0];
      const witness=largest?.time??ps.ldur*.96;row.witnessTime=witness;row.referenceTime=largest?.referenceTime??witness;
      await page.shoot(ps.start+witness/ps.speed);await page.screenshot({path:path.join(out,row.id+'.png')});
      assert.deepEqual(page.errors,[]);assert.deepEqual(page.externalRequests,[]);
      assert.equal(proof.findings.length,0,JSON.stringify(proof.findings[0]));row.passed=true;
    }catch(error){row.passed=false;row.errors.push(String(error.stack??error));try{await page.screenshot({path:path.join(out,row.id+'-failure.png')});}catch{}await browser.recycle();}
    report.results.push(row);write();console.log(row.id,row.passed?'pass':row.errors[0].split('\n')[0]);
  }}finally{await browser.close();}
  report.sourceAfter=sourceHashes(source);report.sourceStable=sourceReceipt.aggregate===report.sourceAfter.aggregate;report.passed=report.sourceStable&&report.failed===0;write();return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),option=(key,fallback)=>args.includes('--'+key)?args[args.indexOf('--'+key)+1]:fallback;
  const report=await run({out:path.resolve(option('out','/tmp/pk-typing-ui-native')),source:path.resolve(option('source',SOURCE)),...(option('baseline')?{baseline:path.resolve(option('baseline'))}:{}),
    ...(option('cases')?{caseIds:option('cases').split(',')}:{}),...(option('aspects')?{aspects:option('aspects').split(',')}:{}),...(option('fonts')?{brandFonts:option('fonts').split(',')}: {})});
  if(!report.passed)process.exitCode=1;
}
