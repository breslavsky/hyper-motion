// Measure foreground contrast against the real composited surface beneath text.
// Hides only text paint for the second capture; layout and materials are unchanged.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createNativeBrowser,sharp} from './native-browser.mjs';
import {maximumScene} from './quality-layout.mjs';
const args=process.argv.slice(2),option=(key,fallback)=>args.includes('--'+key)?args[args.indexOf('--'+key)+1]:fallback;
const out=path.resolve(option('out','/tmp/pk-quality-contrast'));fs.mkdirSync(out,{recursive:true});
const names=option('scenes','winner,tabs,endcard').split(','),aspects=option('aspects','9:16,1:1,16:9').split(','),look=option('look','editorial');
const require=createRequire(import.meta.url),F=require('../source/lib/film.cjs');
const browser=await createNativeBrowser(),page=await browser.newPage(),results=[];
const luminance=rgb=>rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>{const [hi,lo]=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (hi+.05)/(lo+.05);};
try{
 for(const name of names)for(const aspect of aspects){
  const scene=maximumScene(name),foreground=option('foreground',undefined);
  if(foreground!==undefined)scene.fg=foreground;
  const film={aspect,style:look,brand:{name:'Nook',font:'Geist Mono'},grain:false,sparks:false,scenes:[scene]};
  const {plan}=await page.play(film);
  const ps=plan.scenes[0],review=F.review(film,plan).scenes[0],row={type:name,aspect,look,planned:{bg:ps.bg,fg:ps.fg,accent:ps.accent},review,samples:[]};
  for(const fraction of option('fractions','.55,.72,.88').split(',').map(Number)){
   await page.shoot(ps.dur*fraction);
   const texts=await page.evaluate(()=>{
    const root=window.__pkScenes.s1.sceneRoot,walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),found=[];
    while(walker.nextNode()){
     const node=walker.currentNode,parent=node.parentElement,text=node.textContent.trim();
     if(!text||parent.closest('.deco,svg,.mock,.phone .screen'))continue;
     const style=getComputedStyle(parent),rgba=style.color.match(/[\d.]+/g)?.map(Number);if(!rgba||rgba.length<3)continue;
     let opacity=1,visible=true;for(let p=parent;p;p=p.parentElement){const s=getComputedStyle(p);opacity*=Number(s.opacity);if(s.display==='none'||s.visibility==='hidden')visible=false;}
     if(!visible||opacity<.75)continue; // Compare the active state, not deliberately faded alternatives.
     const range=document.createRange();range.selectNodeContents(node);const lines=[...range.getClientRects()].filter(r=>r.width>1&&r.height>1).map(r=>({x:r.left,y:r.top,w:r.width,h:r.height}));
     if(lines.length)found.push({text,rgba,opacity,lines});
    }
    const hide=document.createElement('style');hide.id='contrast-paint-hide';hide.textContent='.pk-stage,.pk-stage *{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important}';document.head.append(hide);
    return found;
   });
   const {data,info}=await sharp(await page.screenshot({type:'png'})).removeAlpha().raw().toBuffer({resolveWithObject:true});
   await page.evaluate(()=>document.getElementById('contrast-paint-hide').remove());
   const measurements=texts.map(text=>{
    const samples=[];
    for(const box of text.lines)for(const fx of [.15,.5,.85])for(const fy of [.25,.5,.75]){
     const x=Math.max(0,Math.min(info.width-1,Math.round(box.x+box.w*fx))),y=Math.max(0,Math.min(info.height-1,Math.round(box.y+box.h*fy))),at=(y*info.width+x)*info.channels;
     const background=[...data.subarray(at,at+3)],alpha=(text.rgba[3]??1)*text.opacity;
     const foreground=background.map((v,i)=>v+(text.rgba[i]-v)*alpha);
     samples.push({contrast:contrast(foreground,background),background});
    }
    const worst=samples.sort((a,b)=>a.contrast-b.contrast)[0];return {...text,...worst};
   });
   row.samples.push({fraction,measurements});
  }
  row.surfaceForeground=await page.evaluate(()=>window.__pkScenes.s1.surfaceForeground);
  assert.equal(row.surfaceForeground,review.surfaceForeground??review.foreground,'Review must report the actual component surface ink');
  row.minimum=Math.min(...row.samples.flatMap(sample=>sample.measurements.map(text=>text.contrast)));
  row.failures=row.samples.flatMap(sample=>sample.measurements.filter(text=>text.contrast<3).map(text=>({fraction:sample.fraction,text:text.text,contrast:text.contrast,foreground:text.rgba,background:text.background})));
  await sharp(await page.screenshot({type:'png'})).resize({width:960,height:960,fit:'inside'}).png().toFile(path.join(out,`${name}-${aspect.replace(':','x')}.png`));
  assert.deepEqual(page.errors,[]);assert.deepEqual(page.externalRequests,[]);
  results.push(row);console.log(`${name}/${aspect}: minimum ${row.minimum.toFixed(2)}:1, ${row.failures.length} active text samples below 3:1`);
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({schema:'pk-quality-contrast-v1',sourceReceipt:page.sourceHashes,results},null,2)+'\n');
 }
}finally{await browser.close();}
if(results.some(row=>row.failures.length))process.exitCode=1;
