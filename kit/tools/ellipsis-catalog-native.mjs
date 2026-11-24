// Seek the real HyperFrames timeline and inspect every opted-in text leaf.
// Catalog token/surface checks run separately; this gate owns overflow and seek.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createNativeBrowser,sourceHashes,SOURCE,sharp} from './migration-browser.mjs';
import {maximumScene,samples} from './quality-layout.mjs';
import {RADIX_TOKENS,ROLE_STEPS} from '../source/lib/components/design-system.mjs';

const fields=createRequire(import.meta.url)('../source/lib/compiler/fields.cjs');
export function ellipsisScene(type,long,base){
  const scene=long?maximumScene(type):structuredClone((base??samples()).get(type));
  if(type==='dock'){
    scene.apps=long?['★',...scene.apps.slice(1)]:['★','Mail','Plan','Docs','Chat','Code'];
    scene.open=0;
  }
  if(type==='widgets')scene.items=scene.items.slice(0,2);
  if(type==='prompt')scene.placeholder=long?'Ш'.repeat(fields.prompt.placeholder.max):'Describe the result';
  if(type==='compare'){
    scene.beforeLabel=long?'Ш'.repeat(fields.compare.beforeLabel.max):'Before';
    scene.afterLabel=long?'Ш'.repeat(fields.compare.afterLabel.max):'After';
  }
  if(type==='morph')scene.states=['button','loader','check','toggle','slider','player','tabs','search','toast'];
  return scene;
}

export function readSingleLines(){
  const instance=window.__pkScenes.s1,root=instance.sceneRoot,round=v=>Math.round(v*1e5)/1e5;
  const rect=n=>{const b=n.getBoundingClientRect();return {x:round(b.x),y:round(b.y),w:round(b.width),h:round(b.height)};};
  const opacity=n=>{let a=1;for(let p=n;p;p=p.parentElement){const s=getComputedStyle(p);if(s.display==='none'||s.visibility==='hidden')return 0;a*=+s.opacity;}return round(a);};
  const nodes=[...root.querySelectorAll('[data-design-overflow="ellipsis"]')].map((n,id)=>{
    const s=getComputedStyle(n),role=n.closest('[data-design-role]'),range=document.createRange();range.selectNodeContents(n);
    const canvas=document.createElement('canvas'),g=canvas.getContext('2d');g.font=`${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
    if('letterSpacing' in g)g.letterSpacing=s.letterSpacing;
    return {id,text:n.textContent,title:n.title,hasTitle:n.hasAttribute('title'),field:n.dataset.ellipsisField??n.dataset.registryRole??null,alpha:opacity(n),box:rect(n),
      role:role?.dataset.designRole,step:+role?.dataset.designStep,unit:+role?.dataset.designUnit,
      size:parseFloat(s.fontSize),lineHeight:parseFloat(s.lineHeight),whiteSpace:s.whiteSpace,textOverflow:s.textOverflow,
      overflowX:s.overflowX,overflowY:s.overflowY,display:s.display,clientWidth:n.clientWidth,clientHeight:n.clientHeight,
      scrollWidth:n.scrollWidth,scrollHeight:n.scrollHeight,paddingX:parseFloat(s.paddingLeft)+parseFloat(s.paddingRight),
      paddingY:parseFloat(s.paddingTop)+parseFloat(s.paddingBottom),ellipsisWidth:g.measureText('…').width,
      truncates:n.scrollWidth>n.clientWidth+1,decor:!!n.closest('.deco,[data-deco]'),
      animatedCopy:!!n.closest('[data-typing-id],[data-typing-host],.glyph')||!!n.querySelector('[data-typing-id],[data-typing-host],.glyph'),
      siblings:[...n.parentElement.children].filter(p=>p!==n&&opacity(p)>.75).map(rect)};
  });
  return {nodes,raster:instance.context.K.rasterTypography??[],fit:instance.fitted??null};
}

export function singleLineFindings(state,{allowedCopies}={}){
  const findings=[];
  for(const n of state.nodes){
    if(n.alpha<=.01||!n.text.trim())continue;
    const add=kind=>findings.push({kind,id:n.id,text:n.text});
    if(n.whiteSpace!=='nowrap'||n.textOverflow!=='ellipsis'||!['hidden','clip'].includes(n.overflowX)||!['hidden','clip'].includes(n.overflowY)||
      !['block','inline-block','flow-root'].includes(n.display))add('single-line-css');
    if(!(n.lineHeight>0)||Math.abs(n.clientHeight-n.paddingY-n.lineHeight)>1||n.scrollHeight>n.clientHeight+1)add('single-line-height');
    if(n.clientWidth-n.paddingX<n.ellipsisWidth-1)add('no-room-for-ellipsis');
    if(n.role){
      const role=ROLE_STEPS[n.role],step=n.step-1;
      if(!role?.steps.includes(n.step)||!Number.isFinite(n.unit)||n.unit<=0)add('missing-type-contract');
      else if(Math.abs(n.size-RADIX_TOKENS.fontSizes[step]*n.unit*(role.multiplier??1))>.06)add('single-line-font-drift');
    }else if(!n.decor)add('missing-type-contract');
    // A tooltip is optional. When supplied it must retain the displayed node's
    // complete DOM text. Original field completeness is covered separately by
    // the indexed content gate; this gate also binds copy across native seeks.
    if(!n.animatedCopy){
      if((n.hasTitle??Boolean(n.title))&&n.title!==n.text)add('single-line-copy-lost');
      if(allowedCopies&&(!allowedCopies.has(n.id)||!allowedCopies.get(n.id).has(n.text)))add('single-line-copy-changed');
    }
  }
  for(const [id,r]of state.raster.entries())if(r.overflowPolicy==='ellipsis'){
    if(!(r.width<=r.maxWidth+1)||r.paintedText===undefined||!r.text.startsWith(r.truncated?r.paintedText.slice(0,-1):r.paintedText)||
       (r.truncated&&!r.paintedText.endsWith('…')))findings.push({kind:'raster-ellipsis',id});
  }
  return findings;
}

export function motionSampleTimes(ps){
  const duration=ps.dur,speed=ps.speed??1,times=new Set([0,Math.max(0,duration-1/30)]);
  // Dense entrance/exit plus evenly distributed motion and every authored cue.
  for(const t of [.033,.066,.1,.15,.2,.3,.45,.6,.8,1])if(t<duration)times.add(t);
  for(let i=1;i<16;i++)times.add(duration*i/16);
  for(const mark of ps.marks??[])for(const offset of [-1/30,0,1/30]){
    const t=mark/speed+offset;if(t>=0&&t<duration)times.add(t);
  }
  return [...times].sort((a,b)=>a-b).map(t=>Math.round(t*1e6)/1e6);
}

export async function run({out,source=SOURCE,types,aspects=['9:16','1:1','16:9'],font='Archivo',long=true,baseline,sceneOverrides={}}={}){
  assert.ok(types?.length,'Explicit component scope required');assert.ok(!fs.existsSync(out),'Use a fresh output directory');fs.mkdirSync(out,{recursive:true});
  const require=createRequire(import.meta.url),api=require(path.join(source,'lib/film.cjs')),prior=baseline?require(path.join(baseline,'lib/compiler/plan.cjs')):null;
  const report={schema:'pure-kinetic.ellipsis-catalog-native.v1',sourceReceipt:sourceHashes(source),font,long,total:types.length*aspects.length,
    policy:{sampling:'Entrance, exit, 16 uniform divisions and ±1frame around authored cues; exact reverse replay.',geometry:'Actual native text leaves; shared typography and one-line capacities. Catalog gate separately checks surfaces and painted collisions.'},results:[]};
  const browser=await createNativeBrowser({source}),page=await browser.newPage(),base=samples();
  report.testedSourceReceipt=page.sourceHashes;
  const write=()=>{report.completed=report.results.length;report.failed=report.results.filter(x=>!x.passed).length;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');};
  try{for(const aspect of aspects)for(const type of types){
    const row={id:`${type}-${aspect.replace(':','x')}`,type,aspect,findings:[],errors:[]};
    try{
      const scene=structuredClone(sceneOverrides[type]??ellipsisScene(type,long,base));
      assert.equal(scene.type,type,'Scene override type must match its requested catalog type');row.scene=scene;
      const label=limit=>long?'Ш'.repeat(limit):'Overview';
      const film={aspect,style:'noir',grain:false,sparks:false,brand:{name:long&&type!=='hive'?'Worldwide collaborative workflow':'Nook',font,
        tokens:{background:'#101820',foreground:'#f6f6ef',accent:'#b9f24a',accent2:'#8ec7ff'}},
        app:{nav:[label(14),label(14),label(14)],title:label(24),cta:long?label(14):'Open',
          stats:[[label(18),'24'],[label(18),'8']],rows:[[label(34),label(34)],[label(34),label(34)],[label(34),label(34)]],status:[label(10),label(10)]},scenes:[scene]};
      assert.deepEqual(api.problems(film),[],'Fixture violates the public film schema');
      const {plan}=await page.play(film),ps=plan.scenes[0];
      if(prior){assert.deepEqual(plan,prior.compile(film),'Compiled timeline or sound changed');row.planUnchanged=true;}
      const initial=await page.evaluate(readSingleLines);
      const allowedCopies=new Map(initial.nodes.map(n=>[n.id,new Set([n.text])]));
      const states=[],seen=new Set(),decorative=new Set(),truncated=new Set(),visibleFields=new Set(),truncatedFields=new Set();let witness={count:-1,visible:-1,time:ps.dur*.8};
      for(const time of motionSampleTimes(ps)){
        await page.shoot(ps.start+time);const state=await page.evaluate(readSingleLines);
        row.findings.push(...singleLineFindings(state,{allowedCopies}).map(f=>({...f,time})));
        for(const n of state.nodes)if(n.alpha>.4&&n.text.trim()){
          (n.decor?decorative:seen).add(n.id);if(!n.decor&&n.field)visibleFields.add(n.field);
          if(n.truncates&&!n.decor){truncated.add(n.id);if(n.field)truncatedFields.add(n.field);}
        }
        const visible=state.nodes.filter(n=>n.alpha>.75&&!n.decor&&n.text.trim()).length;
        const count=state.nodes.filter(n=>n.alpha>.75&&!n.decor&&n.truncates).length;
        if(count>witness.count||(count===witness.count&&(visible>witness.visible||
          (visible===witness.visible&&Math.abs(time-ps.dur*.8)<Math.abs(witness.time-ps.dur*.8))))){witness={count,visible,time};}
        states.push({time,state});
      }
      for(const sample of [...states].reverse()){
        await page.shoot(ps.start+sample.time);assert.deepEqual(await page.evaluate(readSingleLines),sample.state,`Reverse seek ${sample.time}`);
      }
      row.visibleFields=[...visibleFields];row.truncatedFields=[...truncatedFields];
      row.reverseExact=true;row.samples=states.length;row.visibleLeaves=seen.size;row.decorativeLeaves=decorative.size;row.truncatedLeaves=truncated.size;
      row.rasterLeaves=states[0].state.raster.filter(r=>r.overflowPolicy==='ellipsis').length;
      assert.ok(row.visibleLeaves+row.rasterLeaves>0,'Declared component never exposes a single-line text policy');
      await page.shoot(ps.start+witness.time);row.witness=witness.time;
      await sharp(await page.screenshot()).resize({width:600,height:900,fit:'inside'}).png().toFile(path.join(out,row.id+'.png'));
      assert.deepEqual(page.errors,[]);assert.deepEqual(page.externalRequests,[]);
      row.findingCount=row.findings.length;row.findings=row.findings.slice(0,25);assert.equal(row.findingCount,0,JSON.stringify(row.findings[0]));row.passed=true;
    }catch(error){row.errors.push(String(error.stack??error));row.passed=false;try{await page.screenshot({path:path.join(out,row.id+'-failure.png')});}catch{}await browser.recycle();}
    report.results.push(row);write();console.log(row.id,row.passed?'pass':row.errors[0]?.split('\n')[0]);
  }}finally{await browser.close();}
  report.sourceAfter=sourceHashes(source);report.sourceStable=report.sourceReceipt.aggregate===report.sourceAfter.aggregate;
  report.passed=report.sourceStable&&report.completed===report.total&&report.failed===0;write();return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),option=(name,fallback)=>args.includes('--'+name)?args[args.indexOf('--'+name)+1]:fallback;
  const r=await run({out:path.resolve(option('out','/tmp/pk-ellipsis-catalog')),source:path.resolve(option('source',SOURCE)),
    types:option('types','').split(',').filter(Boolean),font:option('font','Archivo'),long:!args.includes('--normal'),
    ...(option('aspects')?{aspects:option('aspects').split(',')}:{}),...(option('baseline')?{baseline:path.resolve(option('baseline'))}:{})});
  if(!r.passed)process.exitCode=1;
}
