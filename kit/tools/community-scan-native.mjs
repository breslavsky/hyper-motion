// Native scan action, density, supplied-image and reversible-seek acceptance.
// node tools/community-scan-native.mjs [--out /tmp/pk-community-scan]
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createNativeBrowser,sharp,sourceHashes,SOURCE} from './native-browser.mjs';
import {measureRenderedText,layoutFindings} from './quality-layout.mjs';
import {ellipsisIssues} from './text-overflow-audit.mjs';
import {measureTextOcclusion} from './registry-native.mjs';
const require=createRequire(import.meta.url),meta=require(path.join(SOURCE,'lib/components/metadata.cjs')).scan;
const args=process.argv.slice(2),out=path.resolve(args.includes('--out')?args[args.indexOf('--out')+1]:'/tmp/pk-community-scan');fs.mkdirSync(out,{recursive:true});
const browser=await createNativeBrowser(),page=await browser.newPage();
fs.writeFileSync(path.join(page.project,'assets/scan-test.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="900" height="700"><rect width="900" height="700" fill="#c8e7f2"/><path d="M0 0L900 700M0 700L900 0" stroke="#1c607c" stroke-width="80"/><circle cx="450" cy="350" r="200" fill="#efad47"/></svg>');
const sample=meta.sample;
const variants=[
 ['sample',sample],
 ['dense',{...sample,categories:['Everything','Later'],items:sample.items.map(i=>({...i,category:1}))}],
 ['three',{...sample,categories:['Ideas','Tasks'],items:sample.items.slice(0,3).map(({label})=>({label}))}],
 ['five',{...sample,categories:['Ideas','Tasks','Files','Later'],items:sample.items.slice(0,5).map(({label})=>({label}))}],
 ['long',{...sample,categories:['International collection','Independent observations','Comprehensive references','Extraordinary iterations'],items:sample.items.map((item,i)=>({label:['Research direction','Design exploration','Customer feedback','Brand development','Project references','Product iterations'][i],category:i%4+1}))}],
 ['image',{...sample,image:'assets/scan-test.svg'}],
 ['no-status',{...sample,scanning:undefined,complete:undefined}],
 ['busy-only',{...sample,complete:undefined}],
 ['done-only',{...sample,scanning:undefined}],
];
const results=[];
let sourceAfter=null,sourceStable=false,passed=false;
const report=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({sourceReceipt:page.sourceHashes,sourceAfter,sourceStable,passed,total:variants.length*3,completed:results.length,failures:results.filter(x=>x.errors.length).length,results},null,2));
try{
 for(const [id,scene]of variants)for(const aspect of ['9:16','16:9','1:1']){
  const row={id:`${id}-${aspect.replace(':','x')}`,errors:[]};
  try{
   assert.deepEqual(meta.validate(scene),[]);
   const film={aspect,style:'editorial',pace:'normal',brand:{name:'Nook'},music:{track:'none',kit:'tech',bpm:120},scenes:[scene]};
   const {plan}=await page.play(film),ps=plan.scenes[0],schedule=meta.times(scene,ps.ldur,plan.beat*ps.speed);
   const sound=[];meta.sounds(scene,ps.ldur,(at,kind)=>sound.push({at,kind}),plan.beat*ps.speed);
   for(const cue of sound)assert.ok(plan.audioEvents.some(event=>event.kind===cue.kind&&Math.abs(event.t-cue.at/ps.speed)<1e-9),'Every visible action must retain its compiled sound time');
   const times=[.12,.24,.36,.5,.64,.8,.95].map(v=>ps.dur*v),states=[];
   for(const at of times){
    await page.shoot(at);
    const state=await page.evaluate(({measure,occlusion})=>{const s=window.__pkScenes.s1,text=(0,eval)(`(${measure})`)(s.sceneRoot);return {html:s.sceneRoot.innerHTML,text:s.textBoxes(),fit:s.fitted,
      measured:text,occlusion:(0,eval)(`(${occlusion})`)(s.sceneRoot,text,{blockerSelector:'[data-scan-tag]'}),
      tags:[...s.root.querySelectorAll('[data-scan-tag]')].filter(node=>{let opacity=1;for(let p=node;p;p=p.parentElement)opacity*=Number(getComputedStyle(p).opacity);return opacity>=.7;}).map(node=>{const b=node.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height};})};},{measure:measureRenderedText.toString(),occlusion:measureTextOcclusion.toString()});
    states.push(state.html);
    assert.deepEqual(layoutFindings(state.measured,{width:plan.width,height:plan.height,floor:plan.type.label,safe:{left:plan.width*plan.safe.left,top:plan.height*plan.safe.top,right:plan.width*(1-plan.safe.right),bottom:plan.height*(1-plan.safe.bottom)}}),[],`Text layout at ${at}`);
    assert.deepEqual(state.occlusion.filter(text=>text.blockedGlyphs),[],`Opaque annotation overlap at ${at}`);
    for(const b of state.text){
      if(b.opacity<.75)continue;
      const measured=state.measured.find(t=>t.text===b.text&&['x','y','w','h'].every(key=>Math.abs(t.box[key]-b[key])<.01));
      const bounds=measured?.ellipsis&&!ellipsisIssues(measured).length?measured.ellipsis.viewport:b;
      assert.ok(bounds.x>=-1&&bounds.y>=-1&&bounds.x+bounds.w<=plan.width+1&&bounds.y+bounds.h<=plan.height+1,`cut text ${b.text}`);
      assert.ok(b.size>=(plan.type.label-0.1),`small text ${b.text}: ${b.line/1.2}`);
    }
    for(let i=0;i<state.tags.length;i++)for(let j=i+1;j<state.tags.length;j++){
      const a=state.tags[i],b=state.tags[j],x=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x),y=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);
      assert.ok(x<=2||y<=2,'Readable tag backgrounds must not merge into columns');
    }
   }
   for(let i=times.length-1;i>=0;i--){await page.shoot(times[i]);assert.equal(await page.evaluate(()=>window.__pkScenes.s1.sceneRoot.innerHTML),states[i],'Reverse DOM state');}
   const crossings=[];
   for(const [i,item]of schedule.items.entries()){
    await page.shoot(item.scan/ps.speed);
    const crossing=await page.evaluate(index=>{const root=window.__pkScenes.s1.root,band=root.querySelector('[data-scan-band]').getBoundingClientRect(),mark=root.querySelector(`[data-scan-mark="${index}"]`).getBoundingClientRect();return {front:band.bottom,center:mark.y+mark.height/2};},i);
    assert.ok(Math.abs(crossing.front-crossing.center)<2,'Scan crossing must match the tag');crossings.push(crossing);
    await page.shoot((item.land-.0001)/ps.speed);
    assert.ok((await page.evaluate(key=>getComputedStyle(window.__pkScenes.s1.root.querySelector(`[data-scan-dot="${key}"]`)).backgroundColor,`${item.category}:${item.slot}`)).endsWith(', 0.14)'));
    await page.shoot((item.land+.001)/ps.speed);
    const landed=await page.evaluate(({index,key})=>{const root=window.__pkScenes.s1.root,a=root.querySelector(`[data-scan-item="${index}"]`).getBoundingClientRect(),b=root.querySelector(`[data-scan-slot="${key}"]`).getBoundingClientRect(),mark=root.querySelector(`[data-scan-mark="${index}"]`);return {dx:Math.abs(a.x+a.width/2-b.x-b.width/2),dy:Math.abs(a.y+a.height/2-b.y-b.height/2),width:a.width,height:a.height,slot:b.width,opacity:mark.style.opacity};},{index:i,key:`${item.category}:${item.slot}`});
    assert.ok(landed.dx<3&&landed.dy<3,`Crop must land inside its exact category slot: ${JSON.stringify(landed)}`);assert.ok(landed.width<=landed.slot&&landed.height<=landed.slot);assert.equal(landed.opacity,'0');
   }
   await page.shoot(ps.dur*.95);
   row.complete=await page.evaluate(()=>({opacity:window.__pkScenes.s1.root.querySelector('[data-scan-complete]')?.style.opacity??null,count:window.__pkScenes.s1.root.querySelectorAll('[data-scan-item]').length,statusRows:window.__pkScenes.s1.root.querySelector('[data-scan-status]')?.children.length??0}));
   assert.equal(row.complete.opacity,scene.complete?'1':null);assert.equal(row.complete.count,scene.items.length);
   assert.equal(row.complete.statusRows,Number(Boolean(scene.scanning))+Number(Boolean(scene.complete)),'Omitted copy must not leave a blank full-width status row');
   assert.deepEqual(page.errors,[]);assert.deepEqual(page.externalRequests,[]);
   // Geometry above is measured at native resolution. Only exported diagnostic
   // previews are reduced; preserve the whole frame and every inspected state.
   row.previews=[];
   for(const [phase,at]of [['done',ps.dur*.95],['scan',ps.dur*.36]]){
    await page.shoot(at);
    const capture=await page.screenshot({type:'png'}),metadata=await sharp(capture).metadata();
    row.nativeCapture={width:metadata.width,height:metadata.height};
    assert.deepEqual(row.nativeCapture,{width:plan.width,height:plan.height},'Capture must retain native composition dimensions');
    const file=`${row.id}-${phase}.png`,preview=await sharp(capture)
      .resize({width:960,height:960,fit:'inside',withoutEnlargement:true})
      .png({compressionLevel:9,adaptiveFiltering:true}).toFile(path.join(out,file));
    row.previews.push({file,width:preview.width,height:preview.height,bytes:preview.size});
   }
   Object.assign(row,{crossings,soundEvents:sound.length,minimumFont:plan.type.label,duration:ps.dur});
  }catch(e){row.errors.push(e.stack??String(e));}
  results.push(row);report();console.log(row.id,row.errors.length?row.errors[0]:'pass');
 }
}finally{await browser.close();}
sourceAfter=sourceHashes();sourceStable=sourceAfter.aggregate===page.sourceHashes.aggregate;
passed=sourceStable&&results.length===variants.length*3&&results.every(row=>row.errors.length===0);report();
if(!passed)process.exitCode=1;
