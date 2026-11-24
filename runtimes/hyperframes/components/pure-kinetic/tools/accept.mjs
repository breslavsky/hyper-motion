// Direct native HyperFrames acceptance; outputs projects, raw measurements and frames.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {buildProject} from '../build.mjs';
import {components,formats} from '../catalog.mjs';
import {auditResult} from './audit.mjs';
const HERE=path.dirname(fileURLToPath(import.meta.url));
const REPO=path.resolve(HERE,'../../../../..');
const packageRoot=path.join(REPO,'templates/pure-kinetic/node_modules/hyperframes');
const version=JSON.parse(fs.readFileSync(path.join(packageRoot,'package.json'))).version;
if(version!=='0.9.19')throw new Error(`Acceptance requires HyperFrames 0.9.19, found ${version}`);
const dist=path.join(packageRoot,'dist');
const sharp=createRequire(path.join(fs.realpathSync(packageRoot),'package.json'))('sharp');
const load=prefix=>import(path.join(dist,fs.readdirSync(dist).find(f=>f.startsWith(prefix+'-')&&f.endsWith('.js'))));
const {bundleWithLocalizedFonts}=await load('bundleWithLocalizedFonts');
const {serveStaticProjectHtml}=await load('staticProjectServer');
const {openSettledCompositionPage,seekCompositionTimeline}=await load('captureCompositionFrame');
const output=path.resolve(process.argv[2]??'/tmp/pure-kinetic-port');
const filter=new RegExp(process.argv[3]??'.');
const ru={
  title:{text:'Меньше шума. *Больше важных дел.*',sub:'Ваш спокойный рабочий день'},
  stack:{words:['Меньше шума','Больше смысла','Каждый день']},
  chart:{title:'Рост активных пользователей',labels:['Первая неделя','Вторая неделя','Третья неделя','Четвёртая неделя'],values:[24,48,62,90],suffix:'%'},
  controls:{title:'Настройте под себя',toggles:['Режим концентрации','Умные напоминания','Тихие часы'],slider:'Сила эффекта'},
  phone3d:{caption:'Всё важное для вашего дня',appName:'Мой рабочий день'}
};
const cases=[];
for(const kind of Object.keys(components))for(const aspect of formats){
  const format=aspect.replace(':','x');
  for(const [variant,look,duration,content] of [['base','editorial',4,{}],['loud','loud',4,{}],['short','editorial',2,{}],['long','editorial',8,{}],['ru','editorial',4,ru[kind]]])
    cases.push({id:`${kind}-${format}-${variant}`,kind,aspect,variant,spec:{aspect,look,scenes:[{id:`${kind}-one`,kind,duration,content}]}});
}
// The second instance starts later and overlaps; assertions inspect both local clocks.
for(const kind of Object.keys(components))cases.push({id:`${kind}-multi`,kind,aspect:'1:1',variant:'multi',spec:{aspect:'1:1',scenes:[{id:`${kind}-a`,kind,duration:4},{id:`${kind}-b`,kind,duration:4,start:2,content:ru[kind],look:'loud'}]}});
cases.push({id:'mixed-9x16',kind:'mixed',aspect:'9:16',variant:'mixed',spec:JSON.parse(fs.readFileSync(path.join(HERE,'../example.json'),'utf8'))});
fs.mkdirSync(path.join(output,'results/native'),{recursive:true});
fs.writeFileSync(path.join(output,'cases.json'),JSON.stringify(cases,null,2));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const sourceHash=hash(['build.mjs','catalog.mjs','runtime.mjs',...Object.keys(components).map(k=>`scenes/${k}.mjs`)].map(f=>fs.readFileSync(path.join(HERE,'..',f),'utf8')).join('\n'));
function inspect(){
  const data=[];
  for(const [id,c] of Object.entries(window.__mfComponents||{})){
    const texts=[];const walker=document.createTreeWalker(c.root,NodeFilter.SHOW_TEXT);let node;
    while(node=walker.nextNode()){
      const e=node.parentElement;if(!node.textContent.trim()||e.closest('script,style,[aria-hidden="true"]'))continue;
      let opacity=1,hidden=false;for(let p=e;p;p=p.parentElement){const s=getComputedStyle(p);opacity*=Number(s.opacity);hidden||=s.display==='none'||s.visibility==='hidden';}
      if(hidden||opacity<.1)continue;
      const range=document.createRange();range.selectNodeContents(node);const css=getComputedStyle(e);
      const canvas=document.createElement('canvas');const g=canvas.getContext('2d');g.font=`${css.fontWeight} ${css.fontSize} ${css.fontFamily}`;
      const fm=g.measureText(node.textContent);const metricHeight=fm.fontBoundingBoxAscent+fm.fontBoundingBoxDescent;
      for(const r of range.getClientRects()){
        if(!r.width||!r.height)continue;
        const scale=r.height/metricHeight;
        const ink={left:r.left,top:r.top+(fm.fontBoundingBoxAscent-fm.actualBoundingBoxAscent)*scale,right:r.right,bottom:r.top+(fm.fontBoundingBoxAscent+fm.actualBoundingBoxDescent)*scale};
        let clip=null;for(let p=e.parentElement;p;p=p.parentElement){const s=getComputedStyle(p);if(['hidden','clip'].includes(s.overflowY)||['hidden','clip'].includes(s.overflowX)){const q=p.getBoundingClientRect();clip=clip?{left:Math.max(clip.left,q.left),top:Math.max(clip.top,q.top),right:Math.min(clip.right,q.right),bottom:Math.min(clip.bottom,q.bottom)}:{left:q.left,top:q.top,right:q.right,bottom:q.bottom};}}
        texts.push({text:node.textContent.trim(),field:e.closest('[data-field]')?.dataset.field,group:e.closest('[data-text-role]')?.dataset.field??e.closest('[data-text-role]')?.textContent,fontSize:parseFloat(css.fontSize)*scale,font:css.fontFamily,opacity,ink,clip,clipped:!!clip&&(ink.left<clip.left-1||ink.right>clip.right+1||ink.top<clip.top-1||ink.bottom>clip.bottom+1)});
      }
    }
    data.push({id,kind:c.kind,data:c.data,time:c.time,duration:c.duration,style:c.style,safe:c.ctx.safe,minFont:c.ctx.type.label,texts,canvas:c.scene.audit?.()??[],events:c.scene.events??[]});
  }
  return {instances:data,errors:window.__mfErrors??[],pureGlobal:!!(window.PurePlan||window.PureDom||window.PureScenes),timelines:Object.fromEntries(Object.entries(window.__timelines||{}).map(([k,t])=>[k,{duration:t.duration(),time:t.time()}]))};
}
let sharedBrowser;
let failedCases=0;
const selectedCases=cases.filter(c=>filter.test(c.id));
if(!selectedCases.length)throw new Error('No acceptance cases match the filter');
for(const c of selectedCases){
  const resultFile=path.join(output,'results/native',`${c.id}.json`);
  const result={id:c.id,kind:c.kind,aspect:c.aspect,variant:c.variant,hyperframes:version,sourceHash,errors:[],externalRequests:[],samples:[],faults:[]};
  let page,server;
  try{
    const project=path.join(output,'projects',c.id);
    if(fs.existsSync(path.join(project,'component-project.json')))fs.rmSync(project,{recursive:true});
    const built=buildProject(project,c.spec);
    result.project=project;result.width=built.width;result.height=built.height;result.duration=built.duration;
    const html=await bundleWithLocalizedFonts(project);server=await serveStaticProjectHtml(project,html);
    const opened=await openSettledCompositionPage(html,server.url,{renderReadyTimeoutMs:15000,browserGpuMode:'hardware',
      prelaunched:sharedBrowser?{take:async()=>({browser:sharedBrowser,softwareWebGpu:false})}:undefined,
      beforeNavigate:async page=>{
      page.on('pageerror',e=>result.errors.push(e.message));
      await page.setRequestInterception(true);page.on('request',r=>{const u=new URL(r.url());if(['http:','https:'].includes(u.protocol)&&!['127.0.0.1','localhost'].includes(u.hostname)){result.externalRequests.push(r.url());r.abort();}else r.continue();});
    }});sharedBrowser=opened.browser;page=opened.page;
    await page.waitForFunction(n=>Object.keys(window.__mfComponents||{}).length===n||window.__mfErrors?.length,{timeout:15000},c.spec.scenes.length);
    result.renderReady=!opened.renderReadyTimedOut;
    const times=c.variant==='mixed'?built.scenes.flatMap(s=>[s.start+.8,s.start+2,s.start+3.2]):c.variant==='multi'?[.5,1.5,2.5,3.5,5.5]:[.1,.2,.35,.5,.8,1.2,built.duration*.5,built.duration*.8,built.duration-1/30].filter(t=>t<built.duration);
    for(const t of [...new Set(times)].sort((a,b)=>a-b)){
      const start=performance.now();await seekCompositionTimeline(page,t,{exactTime:true});const seekMs=performance.now()-start;
      const snapshot=await page.evaluate(inspect);result.samples.push({time:t,seekMs,...snapshot});
      if(snapshot.pureGlobal)result.faults.push({time:t,reason:'Pure Kinetic film engine loaded'});
      for(const instance of snapshot.instances){
        const scene=built.scenes.find(s=>s.id===instance.id);const expected=Math.min(scene.duration,Math.max(0,t-scene.start));
        if(JSON.stringify(instance.data)!==JSON.stringify(scene.data))result.faults.push({time:t,instance:instance.id,reason:'content isolation'});
        if(JSON.stringify(instance.style)!==JSON.stringify(scene.style))result.faults.push({time:t,instance:instance.id,reason:'style isolation'});
        if(t>=(scene.start??0)&&t<(scene.start??0)+(scene.duration??4)&&Math.abs(instance.time-expected)>.001)result.faults.push({time:t,instance:instance.id,reason:'local clock',actual:instance.time,expected});
      }
    }
    const t=c.variant==='multi'?3.5:built.duration*.8;
    await seekCompositionTimeline(page,t,{exactTime:true});const first=await page.screenshot();const firstState=await page.evaluate(inspect);
    await seekCompositionTimeline(page,built.duration-.01,{exactTime:true});await seekCompositionTimeline(page,.01,{exactTime:true});await seekCompositionTimeline(page,t,{exactTime:true});const second=await page.screenshot();
    const secondState=await page.evaluate(inspect);
    const a=await sharp(first).removeAlpha().raw().toBuffer(),b=await sharp(second).removeAlpha().raw().toBuffer();
    let maxChannelDelta=0,changedPixels=0;for(let i=0;i<a.length;i+=3){let changed=false;for(let k=0;k<3;k++){const delta=Math.abs(a[i+k]-b[i+k]);maxChannelDelta=Math.max(maxChannelDelta,delta);changed ||= delta>0;}if(changed)changedPixels++;}
    const stateEqual=JSON.stringify(firstState)===JSON.stringify(secondState);
    // Chrome's compositor can quantize antialiased text by one 8-bit level after
    // a layer is hidden/restored. Require identical state and at most 1/255 RGB.
    result.repeat={time:t,first:hash(first),second:hash(second),equal:hash(first)===hash(second),stateEqual,maxChannelDelta,changedPixels,pixelTolerance:1,equivalent:stateEqual&&maxChannelDelta<=1,firstState,secondState};
    if(!result.repeat.equivalent)result.faults.push({reason:'repeat pixels or state'});
    if(!result.repeat.equal){fs.writeFileSync(path.join(output,'results/native',`${c.id}-repeat-first.png`),first);fs.writeFileSync(path.join(output,'results/native',`${c.id}-repeat-second.png`),second);}
    for(const fraction of [.2,.5,.8]){await seekCompositionTimeline(page,built.duration*fraction,{exactTime:true});await page.screenshot({path:path.join(output,'results/native',`${c.id}-${fraction}.png`)});}
    // Readability of settled text; early stationary text is included if it stays
    // in the same place across samples. Canvas text supplies projected ink bounds.
    for(const [i,s] of result.samples.entries())for(const inst of s.instances){
      const scene=built.scenes.find(q=>q.id===inst.id);if(s.time<scene.start||s.time>=scene.start+scene.duration)continue;
      for(const text of inst.texts){
        const settled=result.samples.some((other,j)=>j!==i&&Math.abs(other.time-s.time)>=.1&&other.instances.find(x=>x.id===inst.id)?.texts.some(q=>q.text===text.text&&Math.abs(q.ink.left-text.ink.left)<1&&Math.abs(q.ink.top-text.ink.top)<1));
        if(!settled)continue;
        const {safe}=inst;const fault=[];
        if(text.fontSize<inst.minFont-.2)fault.push('font');
        if(text.ink.left<safe.x-1||text.ink.top<safe.y-1||text.ink.right>safe.x+safe.w+1||text.ink.bottom>safe.y+safe.h+1)fault.push('safe');
        if(text.clipped)fault.push('clip');if(fault.length)result.faults.push({time:s.time,instance:inst.id,text:text.text,reason:fault.join(','),fontSize:text.fontSize});
      }
      for(const text of inst.canvas.filter(q=>q.visible&&!q.intentionalClip)){
        const {safe}=inst;const fault=[];if(text.fontSize<inst.minFont-.2)fault.push('font');
        if(text.x<safe.x-1||text.y<safe.y-1||text.x+text.width>safe.x+safe.w+1||text.y+text.height>safe.y+safe.h+1)fault.push('safe');
        if(fault.length)result.faults.push({time:s.time,instance:inst.id,text:text.text,reason:`canvas:${fault.join(',')}`});
      }
    }
    const last=result.samples.at(-1);if(!last.instances.some(i=>i.texts.length||i.canvas.some(q=>q.visible)))result.faults.push({reason:'empty tail'});
    result.errors.push(...last.errors);
    result.maxSeekMs=Math.max(...result.samples.map(s=>s.seekMs));
  }catch(e){result.error=e.stack??String(e);await sharedBrowser?.close();sharedBrowser=undefined;}finally{await page?.close().catch(()=>{});await server?.close();}
  result.faults.push(...auditResult(result));
  result.passed=!result.error&&!result.errors.length&&!result.externalRequests.length&&!result.faults.length&&result.renderReady;
  if(!result.passed)failedCases++;
  fs.writeFileSync(resultFile,JSON.stringify(result,null,2));
  console.log(JSON.stringify({id:c.id,passed:result.passed,error:result.error,faults:result.faults.slice(0,3),maxSeekMs:result.maxSeekMs}));
}
await sharedBrowser?.close();
if(failedCases)process.exitCode=1;
