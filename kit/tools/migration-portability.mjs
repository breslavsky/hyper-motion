// Native source reuse and independent Canvas/WebGL lifecycle acceptance.
// node tools/migration-portability.mjs [--out /tmp/pk-portability] [--case repeat-phone3d-9x16]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createNativeBrowser,sharp} from './migration-browser.mjs';

const args=process.argv.slice(2),out=path.resolve(args.includes('--out')?args[args.indexOf('--out')+1]:'/tmp/pk-portability');
fs.mkdirSync(out,{recursive:true});
const samples={
  phone3d:{type:'phone3d',beats:4,caption:'First phone'},
  cards3d:{type:'cards3d',beats:4,titles:['First card','Second card','Third card']},
  field:{type:'field',beats:4,text:'First world',values:[12,30,48,64]},
  trail:{type:'trail',beats:4,text:'First action',warm:false},
  icon3d:{type:'icon3d',beats:4,text:'First icon'},
};
const other={phone3d:{caption:'Another phone'},cards3d:{titles:['Other card','Another card','Last card']},field:{text:'Another world',values:[9,20,35,55]},trail:{text:'Another action'}};
const aspects=['9:16','16:9','1:1'];
const film=(aspect,scenes)=>({aspect,style:'editorial',grain:false,sparks:false,pace:'normal',brand:{name:'Portability'},scenes});
const cases=aspects.flatMap(aspect=>[
  ...Object.keys(other).map(type=>({id:`repeat-${type}-${aspect.replace(':','x')}`,repeated:true,film:film(aspect,[{...samples[type],look:'noir',in:'cut'},{...samples[type],...other[type],look:'liquid',in:'cut'},{type:'title',beats:2,text:'Complete',in:'cut'}])})),
  {id:`webgl-montage-${aspect.replace(':','x')}`,film:film(aspect,['phone3d','cards3d','field','icon3d'].map((type,index)=>({...samples[type],look:index%2?'liquid':'noir',in:'cut'})))},
]).filter(entry=>!args.includes('--case')||entry.id===args[args.indexOf('--case')+1]);
const browser=await createNativeBrowser(),page=await browser.newPage(),results=[];
const sourceReceipt=page.sourceHashes;
const pixels=bytes=>sharp(bytes).removeAlpha().raw().toBuffer();
async function state(){return page.evaluate(async()=>{
  const digest=async data=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data))).map(x=>x.toString(16).padStart(2,'0')).join('');
  // toDataURL preserves the production Canvas backend. Repeated getImageData
  // calls make Chromium migrate a GPU canvas to CPU mid-test, changing shadows.
  const canvases=await Promise.all([...document.querySelectorAll('.pk-stage canvas')].map(async canvas=>({width:canvas.width,height:canvas.height,pixels:await digest(new TextEncoder().encode(canvas.toDataURL()))})));
  return {dom:await digest(new TextEncoder().encode(document.body.outerHTML)),canvases};
});}
function compare(a,b){
  assert.equal(a.length,b.length);
  let changed=0,total=0,max=0;
  for(let i=0;i<a.length;i+=3){let d=0;for(let c=0;c<3;c++){const n=Math.abs(a[i+c]-b[i+c]);total+=n;max=Math.max(max,n);d=Math.max(d,n);}if(d)changed++;}
  return {exact:changed===0,max,changed,mean:total/a.length,share:changed/(a.length/3)};
}
try{
  for(const entry of cases){
    const row={id:entry.id,errors:[],reverse:[],isolation:null};
    try{
      const {plan}=await page.play(entry.film);
      const times=plan.scenes.flatMap(ps=>[.2,.6,.9].map(f=>ps.start+ps.dur*f));
      const shots=new Map();
      for(const time of times){await page.shoot(time);shots.set(time,{png:Buffer.from(await page.screenshot({type:'png'})),state:await state()});}
      for(const time of times.toReversed()){
        await page.shoot(time);
        const shot=Buffer.from(await page.screenshot({type:'png'}));
        const delta=compare(await pixels(shots.get(time).png),await pixels(shot));
        const semanticExact=JSON.stringify(shots.get(time).state)===JSON.stringify(await state());
        const rasterOnly=!delta.exact&&semanticExact&&delta.mean<=.25&&delta.share<=.01;
        row.reverse.push({time,...delta,semanticExact,rasterOnly});
        if(!semanticExact)row.errors.push(`DOM or canvas buffer state differs at ${time}`);
        // Native Chromium can rasterize identical transformed glyph layers on
        // different subpixel edges. This tolerance is permitted only when the
        // complete DOM and every owned canvas pixel buffer are SHA256-identical.
        if(!delta.exact&&!rasterOnly){
          fs.writeFileSync(path.join(out,`${entry.id}-forward.png`),shots.get(time).png);
          fs.writeFileSync(path.join(out,`${entry.id}-reverse.png`),shot);
          row.errors.push(`Reverse pixels differ at ${time}: ${JSON.stringify(delta)}`);
        }
      }
      row.isolation=await page.evaluate(repeated=>{
        const instances=Object.values(window.__pkScenes).sort((a,b)=>a.ps.index-b.ps.index),a=instances[0],b=instances[1];
        const snapshot=instance=>({time:instance.localTime,dom:instance.root.outerHTML,canvases:[...instance.root.querySelectorAll('canvas')].map(canvas=>canvas.toDataURL())});
        const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
        const tl=id=>window.__timelines[id];
        tl(a.id).seek(.4,false);tl(b.id).seek(.7,false);
        const first=snapshot(a),second=snapshot(b);
        tl(b.id).seek(1.2,false);
        const firstUnchanged=same(first,snapshot(a));
        tl(b.id).seek(.7,false);
        const secondRestored=same(second,snapshot(b));
        tl(a.id).seek(1.1,false);
        const secondUnchanged=same(second,snapshot(b));
        tl(a.id).seek(.4,false);
        const firstRestored=same(first,snapshot(a));
        const hosts=[...document.querySelectorAll('[data-composition-src],[data-composition-file]')].map(host=>({id:host.dataset.compositionId,file:host.dataset.compositionSrc??host.dataset.compositionFile}));
        const canvasCounts=(repeated?instances.slice(0,2):instances).map(instance=>instance.root.querySelectorAll('canvas').length);
        const privateIds=instances.flatMap(instance=>[...instance.root.querySelectorAll('[id]')].map(node=>node.id));
        return {firstUnchanged,secondUnchanged,firstRestored,secondRestored,canvasCounts,hosts,
          repeatedSource:!repeated||hosts[0].file===hosts[1].file,
          distinctContent:JSON.stringify(a.ps.scene)!==JSON.stringify(b.ps.scene),distinctLook:a.plan.look.id!==b.plan.look.id,looks:instances.map(instance=>({actual:instance.plan.look.id,requested:instance.ps.scene.look})),
          privateIds:privateIds.length===new Set(privateIds).size};
      },Boolean(entry.repeated));
      for(const key of ['firstUnchanged','secondUnchanged','firstRestored','secondRestored','repeatedSource','distinctContent','privateIds',...(entry.repeated?['distinctLook']:[])])assert.equal(row.isolation[key],true,key);
      assert.ok(row.isolation.canvasCounts.every(count=>count>0),'Each hosted Canvas/WebGL instance owns output');
      assert.deepEqual(page.errors,[]);assert.deepEqual(page.externalRequests,[]);
    }catch(error){row.errors.push(error.stack??String(error));}
    results.push(row);
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({schema:'pk-native-portability-v1',sourceReceipt,total:cases.length,completed:results.length,failures:results.filter(x=>x.errors.length).length,results},null,2)+'\n');
    console.log(`${results.length}/${cases.length} ${row.id}: ${row.errors.length?'FAIL '+row.errors[0]:'pass'}`);
  }
}finally{await browser.close();}
if(results.some(row=>row.errors.length))process.exitCode=1;
