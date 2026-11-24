// Per-key glyph stability through the real HyperFrames timeline.
// Authored camera/sway transforms are frozen only while measuring, then restored.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createNativeBrowser, sourceHashes, SOURCE, sharp} from './native-browser.mjs';

export const fixtures = [
  {type:'trail', beats:6, text:'AVATAR travels around the room'},
  {type:'palette', beats:6, query:'Worldwide work AVATAR AV', results:['Worldwide work AVATAR AV','Another workflow']},
  {type:'bubbles', beats:6, questions:['What happens?','Where next?','Ready now?'], answer:'Worldwide workflow management AVATAR'},
  {type:'checklist', beats:6, title:'Worldwide workflow management', items:['AVATAR office typography','Review the entire workflow','Ship the finished project']},
  {type:'retype', beats:8, from:'AVATAR office', to:['iiiiiiiiiiiiiiii','WWWWWWWW']},
  {type:'pullback', beats:6, text:'Ask @Nook to arrange the AVATAR office launch across every channel', chips:['Project files','Calendar']},
];

export function schedules(scene,duration) {
  const group=(id,selector,text,times,variant)=>({id,selector,text,times:times.map((time,i)=>({time:Math.max(0,time)+.0001,count:i+1})),variant});
  const keys=(text,at,dur,round=false)=>Array.from({length:text.length},(_,i)=>at+(i+1-(round?.5:0))/text.length*dur);
  switch(scene.type){
    case'trail':return[group('trail-line','span[data-design-role="controlLabel"]',scene.text,keys(scene.text,.35,Math.min(1.2,duration*.4),true))];
    case'palette':{
      const cps=Math.max(9,scene.query.length/Math.max(.6,duration*.32));
      return[group('palette-query','[data-design-role="body"] > span:first-child',scene.query,keys(scene.query,.35,scene.query.length/cps))];
    }
    case'bubbles':return[group('bubbles-answer','[data-design-role="caption"] > span:first-child',scene.answer,keys(scene.answer,duration*.58+.2,.7))];
    case'checklist':return[
      group('checklist-title','[data-design-role="sceneTitle"]',scene.title,keys(scene.title,-.08,.45)),
      ...scene.items.map((text,i)=>group(`checklist-item-${i}`,`[data-design-role="caption"] > span:first-child`,text,keys(text,.02+i*.09,.018*text.length+.1),i)),
    ];
    case'retype':{
      const seq=[scene.from,...scene.to],out=[];let at=.08;
      const room=Math.max(.6,duration*.96-at-seq[0].length*.06),per=room/scene.to.length;
      out.push(group('retype-value-0','[data-design-role="hero"] > span:first-child',seq[0],keys(seq[0],at,seq[0].length*.06),0));
      at+=seq[0].length*.06;
      for(let i=1;i<seq.length;i++){
        const start=at+per*.12+.42;
        out.push(group(`retype-value-${i}`,'[data-design-role="hero"] > span:first-child',seq[i],keys(seq[i],start,seq[i].length*.06),i));
        at+=per;
      }
      return out;
    }
    case'pullback':{
      const text=scene.text,mention=text.match(/@\S+(?:\s\p{Lu}\S*)*/u),start=mention?.index??-1,end=mention?start+mention[0].length:-1;
      const dur=Math.min(duration*.5,text.length*.05+(mention?.35:0));
      return[group('pullback-body','[data-design-role="body"]',text,Array.from({length:text.length},(_,i)=>.12+i/text.length*dur+(mention&&i>start?.25:0)+(mention&&i>=end?.1:0)))];
    }
    default:throw new Error(`No typing schedule for ${scene.type}`);
  }
}

function measure({target,count,canary=false}) {
  const root=window.__pkScenes.s1.sceneRoot;
  let host=root.querySelector(`[data-typing-id="${target.id}"]`);
  if(!host){
    const nodes=[...root.querySelectorAll(target.selector)];
    host=nodes[target.id.startsWith('checklist-item-')?target.variant:0];
  }
  if(!host)throw new Error(`Missing typing target ${target.id}`);
  if(canary){
    const glyph=host.querySelector('[data-typing-unit="0"]');
    if(!glyph)throw new Error('Canary requires an immutable typing unit');
    glyph.style.position='relative';glyph.style.left=count>=2?'32px':'0px';
  }
  const frozen=window.__typingFrozenTransforms??=new WeakMap(),restore=[];
  for(let node=host;node;node=node.parentElement){
    if(!frozen.has(node))frozen.set(node,Object.fromEntries(['transform','translate','rotate','scale'].map(key=>[key,node.style.getPropertyValue(key)||getComputedStyle(node)[key]])));
    for(const [key,value]of Object.entries(frozen.get(node))){
      restore.push([node,key,node.style.getPropertyValue(key),node.style.getPropertyPriority(key)]);
      node.style.setProperty(key,value,'important');
    }
    if(node===root)break;
  }
  const round=n=>Math.round(n*1e5)/1e5;
  try{
    const walker=document.createTreeWalker(host,NodeFilter.SHOW_TEXT),nodes=[];let text='';
    while(walker.nextNode()){
      const node=walker.currentNode;
      if(node.parentElement.closest('svg,.ghost,[data-deco]'))continue;
      nodes.push({node,start:text.length,end:text.length+node.data.length});text+=node.data;
    }
    const expected=target.text.slice(0,count);
    if(!text.startsWith(expected))throw new Error(`${target.id} key ${count}: expected prefix ${JSON.stringify(expected)}, got ${JSON.stringify(text)}`);
    const units=[];
    for(let i=0;i<count;i++){
      if(/\s/u.test(target.text[i]))continue;
      const entry=nodes.find(n=>n.start<=i&&n.end>i);if(!entry)continue;
      const range=document.createRange();range.setStart(entry.node,i-entry.start);range.setEnd(entry.node,i-entry.start+1);
      const r=range.getBoundingClientRect(),style=getComputedStyle(entry.node.parentElement);
      let painted=style.visibility!=='hidden'&&style.color!=='rgba(0, 0, 0, 0)';
      for(let n=entry.node.parentElement;n&&n!==host.parentElement;n=n.parentElement){const s=getComputedStyle(n);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)painted=false;}
      units.push({index:i,text:target.text[i],x:round(r.x),y:round(r.y),w:round(r.width),h:round(r.height),painted});
    }
    return{count,units};
  }finally{for(const [node,key,value,priority]of restore.reverse()){if(value)node.style.setProperty(key,value,priority);else node.style.removeProperty(key);}}
}

export async function run({source=SOURCE,out='/tmp/pk-typing-motion',baseline=false,aspects=['9:16','1:1','16:9'],types=fixtures.map(s=>s.type),font='Geist',canary=false}={}){
  fs.mkdirSync(out,{recursive:true});
  const receipt=sourceHashes(source),browser=await createNativeBrowser({source}),page=await browser.newPage();
  const report={schema:'pk-typing-motion-v1',baseline,canary,font,total:aspects.length*fixtures.filter(s=>types.includes(s.type)).length,sourceReceipt:receipt,results:[]};
  const write=()=>{report.completed=report.results.length;report.failed=report.results.filter(r=>!r.passed).length;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');};
  try{for(const aspect of aspects)for(const scene of fixtures.filter(s=>types.includes(s.type))){
    const row={id:`${scene.type}-${aspect.replace(':','x')}`,type:scene.type,aspect,targets:[],errors:[]};
    try{
      const {plan}=await page.play({aspect,style:'noir',grain:false,sparks:false,music:{bpm:60,track:'none'},brand:{name:'Nook',font},scenes:[scene]}),ps=plan.scenes[0],duration=ps.ldur??ps.dur;
      for(const target of schedules(scene,duration)){
        const result={id:target.id,keys:[],drifts:[]};let previous=null;
        for(const event of target.times){
          const time=ps.start+event.time/(ps.speed??1);await page.shoot(time);
          const snapshot=await page.evaluate(measure,{target,count:event.count,canary});
          for(const unit of previous?.units??[]){
            const next=snapshot.units.find(n=>n.index===unit.index);
            if(!next||!next.painted||['x','y','w','h'].some(key=>Math.abs(next[key]-unit[key])>.03))result.drifts.push({key:event.count,index:unit.index,before:unit,after:next});
          }
          assert.ok(snapshot.units.every(u=>u.painted),`${target.id} revealed prefix includes an invisible glyph`);
          result.keys.push({time,snapshot});previous=snapshot;
        }
        for(const key of [...result.keys].reverse()){
          await page.shoot(ps.start+ps.dur*.99);await page.shoot(key.time);
          assert.deepEqual(await page.evaluate(measure,{target,count:key.snapshot.count,canary}),key.snapshot,'Reverse seek changed per-key glyph geometry');
        }
        result.reverseExact=true;result.maximumDrift=Math.max(0,...result.drifts.flatMap(d=>d.after?['x','y','w','h'].map(k=>Math.abs(d.after[k]-d.before[k])):[Infinity]));
        row.targets.push(result);
      }
      assert.deepEqual(page.errors,[]);assert.deepEqual(page.externalRequests,[]);
      assert.equal(row.targets.reduce((sum,t)=>sum+t.drifts.length,0),0,'Previously typed glyphs moved after a later key');
      row.passed=true;
    }catch(error){row.passed=false;row.errors.push(String(error.stack??error));}
    row.reverseExact=row.targets.length>0&&row.targets.every(t=>t.reverseExact);
    row.maximumDrift=Math.max(0,...row.targets.map(t=>t.maximumDrift));
    row.keyCount=row.targets.reduce((n,t)=>n+t.keys.length,0);
    report.results.push(row);write();console.log(row.id,row.passed?'pass':row.errors[0]?.split('\n')[0]);
  }}finally{await browser.close();}
  report.sourceAfter=sourceHashes(source);report.sourceStable=receipt.aggregate===report.sourceAfter.aggregate;report.passed=report.sourceStable&&report.failed===0;write();return report;
}

export async function captureComparison({baselineSource,baselineReport,source=SOURCE,out}){
  const before=JSON.parse(fs.readFileSync(baselineReport)),receipt=sourceHashes(source);
  const browserBefore=await createNativeBrowser({source:baselineSource}),browserAfter=await createNativeBrowser({source});
  const pages=[await browserBefore.newPage(),await browserAfter.newPage()],comparisons=[];
  fs.mkdirSync(out,{recursive:true});
  try{for(const aspect of ['9:16','1:1','16:9'])for(const type of ['bubbles','checklist']){
    const row=before.results.find(r=>r.id===`${type}-${aspect.replace(':','x')}`);
    const target=[...row.targets].sort((a,b)=>b.maximumDrift-a.maximumDrift)[0];
    const drift=[...target.drifts].sort((a,b)=>Math.max(...['x','y','w','h'].map(k=>Math.abs(b.after[k]-b.before[k])))-Math.max(...['x','y','w','h'].map(k=>Math.abs(a.after[k]-a.before[k]))))[0];
    const index=target.keys.findIndex(k=>k.snapshot.count===drift.key),keys=[target.keys[index-1],target.keys[index]],frames=[];
    const scene=fixtures.find(s=>s.type===type),film={aspect,style:'noir',grain:false,sparks:false,music:{bpm:60,track:'none'},brand:{name:'Nook',font:before.font??'Geist'},scenes:[scene]};
    for(const [version,page]of pages.entries()){
      await page.play(film);
      for(const [phase,key]of keys.entries()){
        await page.shoot(key.time);
        frames.push({version,phase,time:key.time,buffer:await page.screenshot({type:'png'})});
      }
    }
    const w=aspect==='9:16'?320:aspect==='1:1'?400:480,h=aspect==='9:16'?570:aspect==='1:1'?400:270,header=34;
    const composites=[];
    for(const frame of frames){
      const x=frame.phase*w,y=frame.version*(h+header),label=`${frame.version?'After':'Before'} · ${frame.phase?'after':'before'} key ${drift.key} · ${frame.time.toFixed(3)}s`;
      composites.push({input:Buffer.from(`<svg width="${w}" height="${header}"><rect width="100%" height="100%" fill="#20252c"/><text x="10" y="23" fill="white" font-family="sans-serif" font-size="13">${label}</text></svg>`),left:x,top:y});
      composites.push({input:await sharp(frame.buffer).resize(w,h,{fit:'contain',background:'#080d14'}).png().toBuffer(),left:x,top:y+header});
    }
    const file=`${type}-${aspect.replace(':','x')}.png`;
    await sharp({create:{width:w*2,height:(h+header)*2,channels:3,background:'#080d14'}}).composite(composites).png().toFile(path.join(out,file));
    comparisons.push({type,aspect,file,target:target.id,key:drift.key,times:keys.map(k=>k.time),baselineDrift:target.maximumDrift});
  }}finally{await browserBefore.close();await browserAfter.close();}
  const report={sourceReceipt:receipt,sourceAfter:sourceHashes(source),comparisons};report.sourceStable=report.sourceReceipt.aggregate===report.sourceAfter.aggregate;
  fs.writeFileSync(path.join(out,'comparisons.json'),JSON.stringify(report,null,2)+'\n');return report;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),option=(name,fallback)=>args.includes('--'+name)?args[args.indexOf('--'+name)+1]:fallback;
  const baseline=args.includes('--baseline'),selfTest=args.includes('--self-test'),source=path.resolve(option('source',SOURCE)),out=path.resolve(option('out','/tmp/pk-typing-motion'));
  const report=await run({source,out,baseline,font:option('font','Geist'),...(option('types')?{types:option('types').split(',')}:{}),...(option('aspects')?{aspects:option('aspects').split(',')}:{}),...(selfTest?{types:['trail'],aspects:['1:1'],canary:true}:{})});
  if(selfTest){assert.equal(report.failed,1);assert.ok(report.results[0].targets.some(t=>t.drifts.some(d=>d.index===0)),'Moved visible unit must fail');console.log('Visible-unit motion canary correctly rejected');}
  else if(!baseline&&!report.passed)process.exitCode=1;
  if(option('capture-baseline'))await captureComparison({source,out:path.join(out,'comparisons'),baselineReport:path.resolve(option('capture-baseline')),baselineSource:path.resolve(option('baseline-source'))});
}
