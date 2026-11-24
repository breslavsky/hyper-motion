// Native design contract under a real presentation camera and letterbox.
// node tools/design-system-native.mjs --out /tmp/pk-design-system-camera
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createNativeBrowser,sharp,sourceHashes} from './migration-browser.mjs';
import {measureRenderedText,layoutFindings} from './quality-layout.mjs';
import {cases as registryCases,measureTextOcclusion} from './registry-native.mjs';

export function cases(){
  return registryCases().filter(row=>row.brand==='dark'&&['modal-morph','screen-flow-carousel'].includes(row.type)).map(row=>({
    id:`${row.type}-${row.aspect.replace(':','x')}-${row.copy}-cinema-serif`,type:row.type,aspect:row.aspect,copy:row.copy,
    scene:Object.fromEntries(Object.entries(row.scene).filter(([key])=>key!=='images')),
  }));
}
async function read(page){return page.evaluate(({measure,occlude})=>{
  const instance=window.__pkScenes.s1,root=instance.sceneRoot,texts=(0,eval)(`(${measure})`)(root);
  const rectangle=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};};
  const semantic=[...root.querySelectorAll('[data-design-role]')].map(node=>{
    const style=getComputedStyle(node);let opacity=1;
    for(let p=node;p;p=p.parentElement){const css=getComputedStyle(p);opacity*=Number(css.opacity);if(css.visibility==='hidden'||css.display==='none')opacity=0;}
    return {role:node.dataset.designRole,text:node.textContent,size:parseFloat(style.fontSize),lineHeight:parseFloat(style.lineHeight),
      unit:Number(node.dataset.designUnit),weight:style.fontWeight,font:style.fontFamily,opacity,
      bounds:rectangle(node),width:parseFloat(style.width),height:parseFloat(style.height),scrollWidth:node.scrollWidth,scrollHeight:node.scrollHeight};
  });
  const button=root.querySelector('[data-design-control="button"]');
  return {texts,semantic,occlusion:(0,eval)(`(${occlude})`)(root,texts),camera:instance.cam.style.transform,letterboxScale:Number(instance.cam.style.scale),
    fontLoaded:document.fonts.check('42px "Instrument Serif"','Independent creative teams'),
    loadedFaces:[...document.fonts].filter(f=>f.family.replaceAll('"','')==='Instrument Serif'&&f.status==='loaded').map(f=>({family:f.family,weight:f.weight,status:f.status})),
    button:button?{bounds:rectangle(button),width:parseFloat(getComputedStyle(button).width),height:parseFloat(getComputedStyle(button).height),paddingX:Number(button.dataset.designPaddingX),paddingY:Number(button.dataset.designPaddingY)}:null};
},{measure:measureRenderedText.toString(),occlude:measureTextOcclusion.toString()});}

async function negativeControls(page){return page.evaluate(async()=>{
  const {createDesignSystem}=await import(new URL('lib/components/design-system.mjs',location.href).href);
  const instance=window.__pkScenes.s1,K=instance.context.K,D=createDesignSystem(K),host=document.createElement('div');
  instance.sceneRoot.append(host);Object.assign(host.style,{position:'absolute',left:'0',top:'0',width:'1000px',height:'700px'});
  try{
    const roomy=D.text(host,'Continue',{role:'button',box:{w:900,h:500}});
    const afterRoomy={size:parseFloat(getComputedStyle(roomy.el).fontSize),role:roomy.el.dataset.designRole,text:roomy.el.textContent};
    const enormous=D.fit(roomy.el,{role:'button',w:2000,h:1000});
    let tinyError=null;
    try{D.fit(roomy.el,{role:'button',w:1,h:1});}catch(error){tinyError=String(error.message);}
    const headingStep=D.steps('cardTitle').at(-1).step;
    const bounded=D.text(host,'A clear heading',{role:'cardTitle',maxStep:headingStep,box:{w:900,h:500}});
    const boundedHeadingKeepsTokens=bounded.size===D.type('cardTitle',headingStep).size
      && bounded.lineHeight===D.type('cardTitle',headingStep).lineHeight
      && bounded.size>D.type('body').size;
    let invalidCapRejected=false;
    try{D.fit(bounded.el,{role:'cardTitle',maxStep:headingStep-1,w:900,h:500});}
    catch(error){invalidCapRejected=String(error.message).includes('maximum type step');}
    return {afterRoomy,enormousSize:enormous.size,expected:D.type('button').size,tinyError,retainedText:roomy.el.textContent,
      boundedHeadingKeepsTokens,invalidCapRejected};
  }finally{host.remove();}
});}

function assertButton(snapshot,scene){
  const button=snapshot.button,label=snapshot.semantic.find(n=>n.role==='button'),title=snapshot.semantic.find(n=>n.role==='cardTitle');
  assert.ok(button&&label&&title,'Missing semantic control/title');
  assert.equal(label.text,scene.cta,'Button copy must remain exact');
  assert.ok(Math.abs(label.size-14*label.unit)<.001,'Button must use its fixed Radix role');
  assert.ok(Math.abs(label.lineHeight-20*label.unit)<.001,'Button line height must use its fixed Radix role');
  assert.ok(title.size/label.size>=20/14-.001,'Card title collapsed into button size');
  assert.ok(label.scrollWidth<=label.width+1&&label.scrollHeight<=label.height+1,'Button label overflows its allocated box');
  const sx=button.bounds.w/button.width,sy=button.bounds.h/button.height;
  assert.ok(label.bounds.x>=button.bounds.x+button.paddingX*sx-1&&label.bounds.x+label.bounds.w<=button.bounds.x+button.bounds.w-button.paddingX*sx+1,'Button horizontal padding changed under camera');
  assert.ok(label.bounds.y>=button.bounds.y+button.paddingY*sy-1&&label.bounds.y+label.bounds.h<=button.bounds.y+button.bounds.h-button.paddingY*sy+1,'Button vertical padding changed under camera');
  return {labelSize:label.size,titleSize:title.size,ratio:title.size/label.size,paddingX:button.paddingX,paddingY:button.paddingY};
}

export async function run(out){
  if(fs.existsSync(out))throw new Error(`Use a fresh output directory: ${out}`);
  fs.mkdirSync(out,{recursive:true});
  const jobs=cases(),browser=await createNativeBrowser(),page=await browser.newPage();
  const report={schema:'pure-kinetic.design-system-native.v1',sourceReceipt:page.sourceHashes,total:jobs.length,results:[]};
  const write=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  try{
    for(const job of jobs){
      const row={...job,samples:[],errors:[]};
      try{
        const film={aspect:job.aspect,style:'cinema',grain:false,sparks:false,brand:{name:'Design contract',font:'Instrument Serif',tokens:{background:'#101820',foreground:'#f6f6ef',accent:'#b9f24a',accent2:'#8ec7ff'}},scenes:[job.scene]};
        const {plan}=await page.play(film),ps=plan.scenes[0],m=plan.safe;
        assert.equal(plan.look.feel.camera,'dolly');assert.equal(plan.look.deco.letterbox,true);
        const bounds={width:plan.width,height:plan.height,floor:plan.type.label,safe:{left:plan.width*m.left,top:plan.height*m.top,right:plan.width*(1-m.right),bottom:plan.height*(1-m.bottom)}};
        for(const fraction of [.16,.35,.55,.75,.94]){
          await page.shoot(ps.start+ps.dur*fraction);const snapshot=await read(page);
          const findings=[...layoutFindings(snapshot.texts.map(t=>({...t,over:false})),bounds),...snapshot.occlusion.filter(t=>t.blockedGlyphs).map(t=>({kind:'opaque-surface-occlusion',...t}))];
          row.samples.push({fraction,camera:snapshot.camera,letterboxScale:snapshot.letterboxScale,texts:snapshot.texts,findings});
          assert.deepEqual(findings,[],JSON.stringify({id:job.id,fraction,findings}));
          assert.ok(snapshot.fontLoaded&&snapshot.loadedFaces.length>0,'Serif face failed to load');
          assert.ok(snapshot.semantic.every(n=>n.font.includes('Instrument Serif')),'Brand font escaped the semantic type system');
          assert.ok(snapshot.letterboxScale>0&&snapshot.letterboxScale<1,'Letterbox camera scaling was not active');
          if(job.type==='modal-morph'&&fraction>=.55)row.button=assertButton(snapshot,job.scene);
        }
        assert.ok(new Set(row.samples.map(s=>s.camera)).size>=3,'Camera did not move');
        const payoff=await read(page);
        if(!report.negativeControls){
          const negative=await negativeControls(page);
          assert.ok(Math.abs(negative.afterRoomy.size-negative.expected)<.001);assert.ok(Math.abs(negative.enormousSize-negative.expected)<.001);
          assert.match(negative.tinyError,/cannot fit role button/);assert.equal(negative.retainedText,'Continue');
          assert.ok(negative.boundedHeadingKeepsTokens&&negative.invalidCapRejected);
          report.negativeControls={...negative,roomDoesNotEnlarge:true,tinyBoundsRejected:true,copyPreserved:true};
        }
        await sharp(await page.screenshot({type:'png'})).resize({width:640,height:640,fit:'inside'}).png().toFile(path.join(out,job.id+'.png'));
        await page.shoot(ps.dur*.2);await page.shoot(ps.dur*.94);const reverse=await read(page);
        assert.deepEqual(reverse.semantic,payoff.semantic,'Reverse seek changed measured design roles');
        assert.deepEqual(page.errors,[]);assert.deepEqual(page.externalRequests,[]);
        row.reverseExact=true;row.passed=true;
      }catch(error){row.errors.push(String(error.stack??error));row.passed=false;try{await sharp(await page.screenshot({type:'png'})).resize({width:640,height:640,fit:'inside'}).png().toFile(path.join(out,job.id+'-failure.png'));}catch{}}
      report.results.push(row);write();console.log(job.id,row.passed?'pass':row.errors[0]);
    }
  }finally{await browser.close();}
  report.completed=report.results.length;report.sourceAfter=sourceHashes();report.sourceStable=report.sourceAfter.aggregate===report.sourceReceipt.aggregate;
  report.passed=report.sourceStable&&report.completed===report.total&&report.results.every(row=>row.passed);write();
  return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);
  if(args.includes('--list'))console.log(JSON.stringify(cases()));
  else{
    const index=args.indexOf('--out'),out=path.resolve(index<0?'/tmp/pk-design-system-camera':args[index+1]);
    const report=await run(out);if(!report.passed)process.exitCode=1;
  }
}
