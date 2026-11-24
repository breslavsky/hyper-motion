// Native sky ink belongs to the painted surface, while the compiled foreground
// and explicitly requested scene/brand/native colors keep their own contract.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createNativeBrowser,sharp,TEMPLATE} from './migration-browser.mjs';
const args=process.argv.slice(2),out=path.resolve(args.includes('--out')?args[args.indexOf('--out')+1]:'/tmp/pk-native-sky-contrast');
fs.mkdirSync(out,{recursive:true});
const require=createRequire(import.meta.url),F=require('../source/lib/film.cjs');
const audit=fs.readFileSync(path.join(TEMPLATE,'node_modules/hyperframes/dist/commands/contrast-audit.browser.js'),'utf8');
const title={type:'title',beats:4,text:'Make space for ideas'};
const scenes=[title,{type:'append',beats:6,base:'Make',words:['space','time','progress'],bg:'sky'},{type:'typewriter',beats:6,text:'Write your next idea',bg:'sky'}];
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll("'",'&#39;').replaceAll('<','&lt;');
const unescape=value=>value.replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&lt;','<').replaceAll('&amp;','&');
function editVariables(project,patches){
  const file=path.join(project,'index.html');let html=fs.readFileSync(file,'utf8');
  for(const [id,patch]of Object.entries(patches)){
    const re=new RegExp(`(<div id="${id}"[^>]*?data-variable-values=')([^']*)(')`);assert.ok(re.test(html));
    html=html.replace(re,(_,start,data,end)=>{
      const values=JSON.parse(unescape(data));
      for(const [key,value]of Object.entries(patch))values[key]=JSON.stringify({...JSON.parse(values[key]),...value});
      return start+escape(JSON.stringify(values))+end;
    });
  }
  fs.writeFileSync(file,html);
}
const browser=await createNativeBrowser(),page=await browser.newPage(),results=[];
async function measure(plan,ps,label,expected,review){
  const id=`s${ps.index+1}`,row={label,type:ps.scene.type,aspect:`${plan.width}x${plan.height}`,planned:{bg:ps.bg,fg:ps.fg},review,samples:[]};
  // Hold samples precede the outgoing scene transition, which can fully mask
  // the glyphs while their component ancestors still report opacity 1.
  for(const fraction of [.45,.6,.75]){
    const at=ps.start+ps.dur*fraction;await page.shoot(at);
    const state=await page.evaluate(id=>{
      const s=window.__pkScenes[id],node=s.sceneRoot.querySelector('.display,.bold');
      return {declared:s.ps.fg,bg:s.ps.bg,surface:s.surfaceForeground,paint:getComputedStyle(node).color,explicit:s.ps.explicitForeground,rebuild:s.rebuildRequired};
    },id);
    assert.equal(state.bg,'sky',label+' must exercise the painted sky');
    assert.equal(state.surface,expected,label+' must retain the surface/explicit ink contract');
    assert.equal(state.rebuild,null,'A color-only edit must not require rebuilding audio');
    if(review){assert.equal(review.foreground,ps.fg);assert.equal(review.surfaceForeground,expected);}
    const candidates=await page.evaluate(()=>window.__contrastAuditPrepare());
    const png=Buffer.from(await page.screenshot({type:'png'})).toString('base64');
    const measured=await page.evaluate(async({png,at,candidates})=>window.__contrastAuditFinish(png,at,candidates),{png,at,candidates});
    const rgb='rgb('+[0,2,4].map(i=>parseInt(expected.slice(i+1,i+3),16)).join(',')+')';
    assert.equal(state.paint.replaceAll(' ',''),rgb,'The factory must paint the actual reported surface color');
    const relevant=measured.filter(text=>text.fg===rgb);
    assert.ok(relevant.length,label+' must contain actual visible text in the resolved surface color: '+JSON.stringify({at,fraction,state,candidates,measured}));
    if(expected==='#111111')assert.ok(relevant.every(text=>text.ratio>=3),JSON.stringify(relevant));
    else assert.ok(relevant.some(text=>text.ratio<3),'Deliberate white-on-sky must remain visible as a real contrast warning');
    row.samples.push({fraction,state,contrast:relevant});
  }
  row.minimum=Math.min(...row.samples.flatMap(sample=>sample.contrast.map(text=>text.ratio)));
  if(['default-title','default-append','default-typewriter'].includes(label))await sharp(await page.screenshot({type:'png'})).resize({width:960,height:960,fit:'inside'}).png().toFile(path.join(out,`${label}-${plan.width}x${plan.height}.png`));
  results.push(row);console.log(`${label}/${row.aspect}: surface ${expected}, minimum ${row.minimum.toFixed(2)}:1`);
}
try{
  for(const aspect of ['9:16','1:1','16:9']){
    const film={aspect,style:'editorial',grain:false,sparks:false,brand:{name:'Nook'},scenes:[
      ...structuredClone(scenes),...scenes.map(s=>({...s,bg:'sky',fg:'#ffffff'})),
      {...title,bg:'sky'},title,{...title,bg:'#ffffff'},
    ]};
    const {plan}=await page.play(film,{transformProject:project=>editVariables(project,{
      s7:{style:{fg:'#fefefe'}},s8:{brand:{tokens:{foreground:'#ffffff'}},style:{bg:'sky'}},s9:{style:{bg:'sky',fg:'#ffffff'}},
    })});
    await page.evaluate(script=>(0,eval)(script),audit);
    const review=F.review(film,plan).scenes;
    for(const ps of plan.scenes){
      const i=ps.index,label=i<3?'default-'+ps.scene.type:i<6?'explicit-scene-'+ps.scene.type:['native-style-offwhite','native-brand-white','native-style-white'][i-6];
      await measure(plan,ps,label,i<3?'#111111':i===6?'#fefefe':'#ffffff',i<6?review[i]:undefined);
      if(i<3)assert.equal(ps.fg,'#ffffff','Compiler declarations and parity fixtures must remain unchanged');
    }
    // Removing a native foreground token restores the implicit surface policy.
    const original={...film,brand:{name:'Nook',tokens:{foreground:'#ffffff'}},scenes:[title]};
    const removed=await page.play(original,{transformProject:project=>editVariables(project,{s1:{brand:{tokens:{}}}})});
    await page.evaluate(script=>(0,eval)(script),audit);
    await measure(removed.plan,removed.plan.scenes[0],'native-brand-removed','#111111');
    assert.deepEqual(page.errors,[]);assert.deepEqual(page.externalRequests,[]);
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({schema:'pk-native-sky-contrast-v1',sourceReceipt:page.sourceHashes,results},null,2)+'\n');
  }
}finally{await browser.close();}
