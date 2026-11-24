// Native regression for typography reflow, repeated instances, and seek-safe state.
// node tools/quality-cards.mjs --out /tmp/pk-quality-cards
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createNativeBrowser,sharp} from './native-browser.mjs';
import {measureRenderedText,layoutFindings,persistentFindings,maximumScene} from './quality-layout.mjs';
import metadata from '../source/lib/components/metadata.mjs';

const args=process.argv.slice(2),out=path.resolve(args.includes('--out')?args[args.indexOf('--out')+1]:'/tmp/pk-quality-cards');
fs.mkdirSync(out,{recursive:true});
const browser=await createNativeBrowser(),page=await browser.newPage(),results=[],sourceReceipt=page.sourceHashes;
const report=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({schema:'pure-kinetic.quality-cards.v1',sourceReceipt,total:42,completed:results.length,failedCases:results.filter(r=>r.errors.length).length,results},null,2)+'\n');
const scenes=[...[2,3,4].map(n=>({...maximumScene('connect'),sources:maximumScene('connect').sources.slice(0,n)})),...['winner','tabs','steps','endcard'].map(maximumScene)];

async function read(id){
  return page.evaluate((id,fn)=>{
    const instance=window.__pkScenes[id],texts=(0,eval)(`(${fn})`)(instance.sceneRoot);
    const encode=node=>node.nodeType!==Node.ELEMENT_NODE?[node.nodeType,node.nodeValue]:[node.tagName,[...node.attributes].map(a=>[a.name,a.name==='style'?[...node.style].sort().map(k=>[k,node.style.getPropertyValue(k)]):a.value]).sort((a,b)=>a[0].localeCompare(b[0])),[...node.childNodes].map(encode)];
    return {texts,dom:JSON.stringify(encode(instance.sceneRoot)),sources:instance.sceneRoot.querySelectorAll('[data-connect-source]').length,targets:instance.sceneRoot.querySelectorAll('[data-connect-target]').length};
  },id,measureRenderedText.toString());
}

try{
  for(const aspect of ['9:16','1:1','16:9'])for(const font of ['Geist Mono','Archivo']){
    const film={aspect,style:'editorial',brand:{name:'Nook',font},grain:false,sparks:false,scenes};
    const {plan}=await page.play(film),m=plan.safe;
    const bounds={width:plan.width,height:plan.height,floor:plan.type.label,safe:{left:plan.width*m.left,top:plan.height*m.top,right:plan.width*(1-m.right),bottom:plan.height*(1-m.bottom)}};
    const fontProof=await page.evaluate(()=>{
      const node=document.querySelector('.pk-stage .bold,.pk-stage .display,.pk-stage .mono');
      const family=getComputedStyle(node).fontFamily,c=document.createElement('canvas').getContext('2d');c.font=`400 36px ${family}`;
      return {family,wide:c.measureText('WW').width,narrow:c.measureText('ii').width};
    });
    for(let index=0;index<scenes.length;index++){
      const ps=plan.scenes[index],scene=scenes[index],id=`s${index+1}`;
      const row={id:`${scene.type}-${index+1}-${aspect.replace(':','x')}-${font.replaceAll(' ','-')}`,aspect,font,fontProof,scene,errors:[],samples:[]};
      try{
        if(font==='Geist Mono'){
          assert.ok(Math.abs(fontProof.wide-fontProof.narrow)<.01,'Declared monospace font must really render monospace glyphs');
          assert.ok(Math.abs(fontProof.wide-43.1993408203125)<.01,'The bundled Geist Mono glyph metrics must survive native bundling');
        }
        for(const fraction of [.35,.55,.72,.88]){
          await page.shoot(ps.start+ps.dur*fraction);
          const state=await read(id);
          assert.ok(state.texts.length,'The active component must contain visible text');
          row.samples.push({fraction,texts:state.texts,findings:layoutFindings(state.texts,bounds)});
        }
        row.findings=persistentFindings(row.samples);
        assert.deepEqual(row.findings,[],'Persistent rendered typography defects');
        if(scene.type==='connect'){
          const state=await read(id);
          assert.equal(state.sources,scene.sources.length);assert.equal(state.targets,1);
          assert.deepEqual(state.texts.map(t=>t.text).sort(),[...scene.sources,scene.target].sort(),'Every source and target label, including repeated copy, must be visible');
          const expected=metadata.connect.times(scene,ps.ldur??ps.dur);
          for(const event of expected)assert.ok(plan.audioEvents.some(c=>c.kind==='ping'&&Math.abs(c.t-(ps.start+event.lands/(ps.speed??1)))<1e-6),'Every connection arrival keeps its sound cue');
        }
        const at=ps.start+ps.dur*.72;
        await page.shoot(at);const before=await read(id);
        await page.shoot(ps.start+ps.dur*.92);await page.shoot(ps.start+ps.dur*.18);await page.shoot(at);
        const after=await read(id);
        assert.equal(after.dom,before.dom,'Reverse seek must reconstruct the exact component DOM');
        assert.deepEqual(after.texts,before.texts,'Reverse seek must reconstruct rendered text geometry');
        assert.deepEqual(page.errors,[]);assert.deepEqual(page.externalRequests,[]);
        row.reverseExact=true;
        row.minimumRendered=Math.min(...row.samples.flatMap(s=>s.texts.map(t=>t.renderedSize)));
        await sharp(await page.screenshot({type:'png'})).resize({width:640,height:640,fit:'inside'}).png().toFile(path.join(out,row.id+'.png'));
      }catch(error){
        row.errors.push(String(error?.stack??error));
        await sharp(await page.screenshot({type:'png'})).resize({width:640,height:640,fit:'inside'}).png().toFile(path.join(out,row.id+'-failure.png'));
      }
      results.push(row);report();console.log(row.id,row.errors.length?'FAIL':'pass');
    }
    const independence=await page.evaluate(()=>{
      const scenes=window.__pkScenes,before=Object.fromEntries(Object.entries(scenes).map(([id,s])=>[id,s.localTime]));
      window.__timelines.s2.seek(.65,false);
      return {before,after:Object.fromEntries(Object.entries(scenes).map(([id,s])=>[id,s.localTime])),ids:Object.values(scenes).flatMap(s=>[...s.root.querySelectorAll('[id]')].map(n=>n.id))};
    });
    assert.equal(new Set(independence.ids).size,independence.ids.length,'Repeated components must own unique SVG/filter identifiers');
    assert.equal(independence.after.s2,.65);
    for(const [id,time]of Object.entries(independence.before))if(id!=='s2')assert.equal(independence.after[id],time,'Seeking one component must leave sibling clocks alone');
  }
}catch(error){results.push({id:'matrix',errors:[String(error?.stack??error)]});report();}
finally{await browser.close();}
if(results.some(r=>r.errors.length))process.exitCode=1;
