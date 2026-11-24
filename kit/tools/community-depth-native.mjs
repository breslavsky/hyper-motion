// Native depth probes: contact sheets, maximum-length Cyrillic font floors, and local images.
// node tools/community-depth-native.mjs [--out /path/to/results]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createNativeBrowser,sharp} from './native-browser.mjs';
import defs from '../source/lib/components/metadata.cjs';
const args=process.argv.slice(2),outAt=args.indexOf('--out');
if(outAt>=0&&(!args[outAt+1]||args[outAt+1].startsWith('--')))throw new Error('--out requires a directory');
const out=path.resolve(outAt>=0?args[outAt+1]:path.join(os.tmpdir(),'pk-community-depth'));
fs.mkdirSync(out,{recursive:true});
const browser=await createNativeBrowser(),page=await browser.newPage(),sourceReceipt=page.sourceHashes,results=[];
const fixture='<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500"><rect width="500" height="500" fill="#264bd7"/><circle cx="250" cy="250" r="180" fill="#ffcc42"/><path d="M140 260l75 75 145-170" fill="none" stroke="#151b30" stroke-width="35"/></svg>';
let currentCase=null;
const normal=text=>String(text).replace(/\s+/g,' ').trim();
const counts=values=>{
 const found=new Map();for(const value of values)found.set(value,(found.get(value)??0)+1);
 return [...found].sort(([a],[b])=>a.localeCompare(b));
};
function cleanPage(){
 assert.deepEqual(page.errors,[],`${currentCase}: browser errors`);
 assert.deepEqual(page.externalRequests,[],`${currentCase}: external requests`);
}
function report(extra={}){
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({schema:'community-depth-native-v1',sourceReceipt,total:24,completed:results.length,results,...extra},null,2));
}
async function labelsAt(scene){
 cleanPage();
 const state=await page.evaluate(()=>{
  const instance=window.__pkScenes.s1,K=instance.context.K,plan=instance.context.plan;
  const root=instance.context.stage.getBoundingClientRect(),m=plan.safe;
  return {floor:K.type.label,boxes:instance.textBoxes(),safe:{left:root.left+K.W*m.left,top:root.top+K.H*m.top,right:root.left+K.W*(1-m.right),bottom:root.top+K.H*(1-m.bottom)}};
 });
 const expected=[...(scene.items??scene.layers),...(scene.title?[scene.title]:[])].map(normal);
 assert.deepEqual(counts(state.boxes.map(box=>normal(box.text))),counts(expected),`${currentCase}: expected visible text, including repeated labels`);
 const minima=[];
 for(const box of state.boxes){
  assert.ok(box.opacity>=.99,`${currentCase}: faded label ${box.text}`);
  assert.ok(box.seen>=.99,`${currentCase}: clipped label ${box.text}`);
  assert.ok(box.size>=state.floor-.01,`${currentCase}: ${box.text} at ${box.size}px below ${state.floor}px`);
  assert.ok(box.w>0&&box.h>0,`${currentCase}: zero-area label ${box.text}`);
  assert.ok(box.x>=state.safe.left-1&&box.y>=state.safe.top-1&&box.x+box.w<=state.safe.right+1&&box.y+box.h<=state.safe.bottom+1,`${currentCase}: label outside safe frame ${box.text}`);
  minima.push(box.size);
 }
 for(let i=0;i<state.boxes.length;i++)for(let j=i+1;j<state.boxes.length;j++){
  const a=state.boxes[i],b=state.boxes[j];
  const width=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x),height=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);
  assert.ok(width<=1||height<=1,`${currentCase}: labels overlap: ${a.text} / ${b.text}`);
 }
 cleanPage();
 return {minimum:Math.min(...minima),floor:state.floor,visibleLabels:state.boxes.length,safeFrame:true,unclipped:true,noOverlap:true};
}
function record(value){cleanPage();results.push({...value,errors:[],externalRequests:[]});report();}
try{
 for(const aspect of ['16:9','1:1','9:16'])for(const type of ['accordion','explode']){
  currentCase=`preview/${type}/${aspect}`;
  const scene=defs[type].sample,plan=await page.play({aspect,style:'editorial',brand:{name:'Nook'},scenes:[scene]}),tiles=[],measurements=[];
  for(const f of [.16,.38,.62,.90]){await page.shoot(plan.duration*f);measurements.push({fraction:f,...await labelsAt(scene)});tiles.push(await sharp(await page.screenshot({type:'png'})).resize({width:480,height:480,fit:'inside'}).png().toBuffer());}
  const meta=await sharp(tiles[0]).metadata();await sharp({create:{width:meta.width*4,height:meta.height,channels:3,background:'#fff'}}).composite(tiles.map((input,i)=>({input,left:i*meta.width,top:0}))).jpeg({quality:90}).toFile(`${out}/${type}-${aspect.replace(':','x')}.jpg`);
  record({type,aspect,branch:'preview',measurements});
 }
 for(const aspect of ['16:9','1:1','9:16'])for(const type of ['accordion','explode'])for(const style of ['editorial','noir']){
  const scene={...defs[type].sample,[type==='accordion'?'items':'layers']:Array.from({length:5},(_,i)=>(`${i+1} Автоматизированный анализ`).slice(0,24))};
  currentCase=`maximum-russian-geist-mono/${type}/${aspect}/${style}`;
  if(type==='explode')scene.title='Архитектура понятного продукта';
  const plan=await page.play({aspect,style,brand:{name:'Nook',font:'Geist Mono'},scenes:[scene]});
  let minimum=Infinity,floor;const measurements=[];
  for(const fraction of [.2,.45,.7,.95]){
   await page.shoot(plan.duration*fraction);
   const state=await labelsAt(scene);
   floor=state.floor;minimum=Math.min(minimum,state.minimum);measurements.push({fraction,...state});
  }
  record({type,aspect,style,branch:'maximum-russian-geist-mono',minimum,floor,measurements});
 }
 for(const aspect of ['16:9','1:1','9:16'])for(const n of [3,5]){
  const scene={...defs.accordion.sample,items:defs.accordion.sample.items.slice(0,n),images:Array(n).fill('assets/depth-fixture.svg')};
  currentCase=`images/accordion/${aspect}/${n}`;
  const plan=await page.play({aspect,style:'noir',brand:{name:'Nook',font:'Geist Mono'},scenes:[scene]},{transformProject:project=>fs.writeFileSync(`${project}/assets/depth-fixture.svg`,fixture)});
  await page.shoot(plan.duration*.6);
  const measurement=await labelsAt(scene);
  const images=await page.evaluate(()=>[...window.__pkScenes.s1.root.querySelectorAll('img')].map(n=>({ready:n.complete,width:n.naturalWidth})));
  if(images.length!==n||images.some(i=>!i.ready||i.width!==500)||page.errors.length||page.externalRequests.length)throw new Error('image branch failed');
  record({type:'accordion',aspect,branch:'images',count:n,images,measurements:[{fraction:.6,...measurement}]});
 }
 report({passed:true});
 console.log(`${results.length} preview/font/image cases passed; ${out}`);
}catch(error){
 report({passed:false,failedCase:currentCase,error:String(error?.stack??error),browserErrors:[...page.errors],externalRequests:[...page.externalRequests]});
 throw error;
}finally{await browser.close();}
