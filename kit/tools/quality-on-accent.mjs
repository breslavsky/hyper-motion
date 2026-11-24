// Focused verification of dark/white text on a resolved solid brand accent.
// --source copies an immutable model result, changing ONLY maths.mjs in that
// isolated render copy. Its frames are post-benchmark verification, never a new
// model benchmark result. The original project and receipts remain untouched.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createNativeBrowser,sourceHashes,sharp,SOURCE,TEMPLATE} from './native-browser.mjs';
const args=process.argv.slice(2),option=(key,fallback)=>args.includes('--'+key)?args[args.indexOf('--'+key)+1]:fallback;
const original=option('source',undefined),source=path.resolve(original??SOURCE),out=path.resolve(option('out','/tmp/pk-native-on-accent'));
fs.mkdirSync(out,{recursive:true});
const helper='lib/components/maths.mjs',hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const recipe=original?JSON.parse(fs.readFileSync(path.join(source,'film.json'),'utf8')):{
 aspect:'9:16',style:'noir',pace:'normal',brand:{name:'Folio',font:'Geist Mono',tokens:{background:'#0d0d0f',foreground:'#f2f2f0',accent:'#ff6a70',accent2:'#bbddff'}},music:{bpm:108},
 scenes:[{type:'title',beats:4,text:'From scattered to sorted'},{type:'endcard',beats:5,cta:'Try Folio',tagline:'Find your next idea'}],
};
assert.equal(recipe.scenes.at(-1).type,'endcard');
const originalRecipe=JSON.stringify(recipe),originalIndex=original?hash(path.join(source,'index.html')):null,before=sourceHashes(source);
const audit=fs.readFileSync(path.join(TEMPLATE,'node_modules/hyperframes/dist/commands/contrast-audit.browser.js'),'utf8');
const browser=await createNativeBrowser({source}),page=await browser.newPage(),results=[];
const report={schema:'pk-on-accent-v1',kind:original?'post-benchmark-native-verification':'native-regression',source,originalRecipeHash:createHash('sha256').update(originalRecipe).digest('hex'),
 helperChange:{path:helper,before:hash(path.join(source,helper)),after:hash(path.join(SOURCE,helper))},sourceReceiptBefore:before,results};
fs.writeFileSync(path.join(out,'README.txt'),original?'POST-BENCHMARK VERIFICATION. This renders an isolated copy of the archived recipe with the corrected on-accent ink helper. It does not replace the original model benchmark, its warnings, or its source receipt. Aspect variants change only the frame format.\n':'Native on-accent contrast regression.\n');
try{
 for(const aspect of ['9:16','1:1','16:9']){
  const film={...structuredClone(recipe),aspect};
  const {plan}=await page.play(film,{transformProject(project){fs.copyFileSync(path.join(SOURCE,helper),path.join(project,helper));}});
  const after=sourceHashes(page.project),changed=Object.keys(before.files).filter(file=>before.files[file]!==after.files[file]);
  assert.deepEqual(changed,report.helperChange.before===report.helperChange.after?[]:[helper],'No other component source may change in a post-benchmark reproduction');
  report.sourceReceiptAfter=after;
  await page.evaluate(script=>(0,eval)(script),audit);
  const last=plan.scenes.at(-1),end=last.start+last.dur,initial=film.brand.name.trim().charAt(0).toUpperCase(),cta=last.scene.cta;
  const times=[...new Set([.46,.64,.82,.982,1].map(f=>Number((last.start+last.dur*f).toFixed(9))).concat([end+.031,end+.1,plan.duration-.028].map(t=>Number(Math.min(plan.duration-.001,t).toFixed(9)))))];
  const row={aspect,duration:plan.duration,sceneStart:last.start,sceneEnd:end,samples:[]};
  for(const at of times){
   await page.shoot(at);
   const state=await page.evaluate(id=>{
    const scene=window.__pkScenes[id],center=scene.sceneRoot.querySelector('.center'),logo=center.firstElementChild.querySelector('.display'),primary=center.children[1],cta=center.querySelector('.pill');
    const read=node=>{let opacity=1;for(let p=node;p;p=p.parentElement)opacity*=Number(getComputedStyle(p).opacity);const s=getComputedStyle(node);return {text:node.textContent,color:s.color,opacity,background:s.backgroundColor,backgroundImage:s.backgroundImage};};
    return {logo:read(logo),primary:read(primary),cta:read(cta),foreground:scene.ps.fg,surfaceForeground:scene.surfaceForeground};
   },`s${last.index+1}`);
   assert.equal(state.logo.color,'rgb(17, 17, 17)');assert.equal(state.cta.color,'rgb(17, 17, 17)');
   assert.equal(state.logo.opacity,1);assert.equal(state.cta.opacity,1);
   assert.equal(state.primary.color,'rgb(242, 242, 240)','Explicit brand foreground must remain unchanged');
   assert.equal(state.foreground,'#f2f2f0');
   const candidates=await page.evaluate(()=>window.__contrastAuditPrepare());
   const png=Buffer.from(await page.screenshot({type:'png'})).toString('base64');
   const measured=await page.evaluate(async({png,at,candidates})=>window.__contrastAuditFinish(png,at,candidates),{png,at,candidates});
   const text=measured.filter(value=>value.text===cta||(value.text===initial&&value.fg==='rgb(17,17,17)'));
   assert.equal(text.length,2,'Both the logo initial and CTA must be measured');
   assert.ok(text.every(value=>value.wcagAA&&value.ratio>=3),JSON.stringify(text));
   row.samples.push({at,state,contrast:text});
  }
  row.minimum=Math.min(...row.samples.flatMap(sample=>sample.contrast.map(text=>text.ratio)));
  await page.shoot(Math.min(plan.duration-.001,end+.031));
  await sharp(await page.screenshot({type:'png'})).resize({width:960,height:960,fit:'inside'}).png().toFile(path.join(out,'post-benchmark-'+aspect.replace(':','x')+'.png'));
  assert.deepEqual(page.errors,[]);assert.deepEqual(page.externalRequests,[]);results.push(row);
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(`${aspect}: ${times.length} hold/shine samples, logo+CTA >= ${row.minimum.toFixed(2)}:1, explicit foreground preserved`);
 }
 assert.equal(JSON.stringify(recipe),originalRecipe);
 if(original){assert.equal(hash(path.join(source,'index.html')),originalIndex);assert.deepEqual(sourceHashes(source),before);}
}finally{await browser.close();}
