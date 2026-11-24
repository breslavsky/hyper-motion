// Proves one brand font reaches DOM, particle sampling and 3D texture text.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createNativeBrowser} from './migration-browser.mjs';
const browser=await createNativeBrowser(),page=await browser.newPage(),results=[];
const sourceReceipt=page.sourceHashes;
const scenes=[
  {type:'gather',beats:4,word:'BRAND'},
  {type:'particles',beats:4,text:'Brand particles'},
  {type:'trail',beats:4,text:'Brand action'},
  {type:'cards3d',beats:4,titles:['Brand card','Second card']},
  {type:'icon3d',beats:4,text:'Brand icon'},
  {type:'phone3d',beats:4,caption:'Brand phone'},
  {type:'assemble',beats:4,word:'BRAND'},
];
const fonts=['Instrument Serif',{family:'Uploaded Brand',src:'assets/fonts/uploaded-brand.woff2',weight:400}];
try{
  for(const font of fonts){
    const film={aspect:'9:16',style:'editorial',grain:false,sparks:false,brand:{name:'Brand',font},scenes};
    const {plan}=await page.play(film,{transformProject(project){
      fs.mkdirSync(path.join(project,'assets/fonts'),{recursive:true});
      fs.copyFileSync(path.join(project,'lib/fonts/InstrumentSerif-Regular.woff2'),path.join(project,'assets/fonts/uploaded-brand.woff2'));
      const file=path.join(project,'index.html'),html=fs.readFileSync(file,'utf8');
      const probe=`<script>window.__canvasFontWrites=[];const descriptor=Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype,'font');Object.defineProperty(CanvasRenderingContext2D.prototype,'font',{get:descriptor.get,set(value){window.__canvasFontWrites.push(value);descriptor.set.call(this,value);},configurable:true});</script>`;
      fs.writeFileSync(file,html.replace('<head>','<head>'+probe));
    }});
    for(const ps of plan.scenes)await page.shoot(ps.start+ps.dur*.6);
    const result=await page.evaluate(()=>({
      stages:Object.values(window.__pkScenes).map(instance=>({id:instance.id,type:instance.ps.scene.type,family:instance.plan.look.display.family,
        families:[...new Set([...instance.root.querySelectorAll('*')].filter(node=>node.children.length===0&&node.textContent.trim()).map(node=>getComputedStyle(node).fontFamily))]})),
      canvasFonts:window.__canvasFontWrites,
      loaded:[...document.fonts].filter(face=>face.family.includes('PKBrand-')).map(face=>({family:face.family,status:face.status})),
    }));
    const expected=typeof font==='string'?font:'PKBrand-';
    assert.ok(result.canvasFonts.length>=6,'Canvas text draw instrumentation must cover particle and 3D constructors');
    assert.deepEqual(result.canvasFonts.filter(family=>!family.includes(expected)),[],'Canvas samplers and texture captions must use the central font');
    for(const stage of result.stages)assert.ok(stage.families.every(family=>family.includes(expected)),`${stage.type}: DOM font mismatch`);
    if(typeof font==='object')assert.ok(result.loaded.some(face=>face.status==='loaded'),'Uploaded local FontFace must load before sampling');
    assert.deepEqual(page.errors,[]);assert.deepEqual(page.externalRequests,[]);
    results.push({font,scenes:result.stages.length,canvasFontWrites:result.canvasFonts.length,loaded:result.loaded});
    console.log(`${typeof font==='string'?font:font.family}: ${result.stages.length} native scenes, ${result.canvasFonts.length} Canvas font writes pass`);
  }
}finally{await browser.close();}
console.log(JSON.stringify(results,null,2));
fs.mkdirSync('/tmp/pk-native-fonts',{recursive:true});
fs.writeFileSync('/tmp/pk-native-fonts/report.json',JSON.stringify({schema:'pk-native-fonts-v1',sourceReceipt,results},null,2)+'\n');
