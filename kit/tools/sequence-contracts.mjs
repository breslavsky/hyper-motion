// Native multi-instance isolation and actual CLI export rejection/rebuild proof.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {promisify} from 'node:util';
import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {loadNativeHyperframes} from './native-hyperframes-adapter.mjs';
import {buildProject} from '../source/lib/sequences/document-flow/build.mjs';
import {DEFAULT_RECIPE} from '../source/lib/sequences/document-flow/model.mjs';

const HERE=path.dirname(fileURLToPath(import.meta.url)),TEMPLATE=path.resolve(HERE,'..');
const out=process.argv.includes('--out')?path.resolve(process.argv[process.argv.indexOf('--out')+1]):'/tmp/pk-document-flow-contracts';
if(fs.existsSync(out))throw new Error(`Use a fresh output directory: ${out}`);
fs.mkdirSync(out,{recursive:true});
const packageRoot=path.join(TEMPLATE,'node_modules/hyperframes');
const {bundleWithLocalizedFonts,serveStaticProjectHtml,openSettledCompositionPage,seekCompositionTimeline}=await loadNativeHyperframes(packageRoot);
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll("'",'&#39;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const unescape=value=>value.replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&');
function change(file,rootPatch={},childPatch={},instanceId='document-flow'){
  let html=fs.readFileSync(file,'utf8');
  if(Object.keys(rootPatch).length)html=html.replace(/(<html[^>]*?data-composition-variables=')([^']*)(')/,(_,a,data,z)=>{
    const defs=JSON.parse(unescape(data));for(const [key,value]of Object.entries(rootPatch))defs.find(def=>def.id===key).default=JSON.stringify(value);
    return a+escape(JSON.stringify(defs))+z;
  });
  if(Object.keys(childPatch).length)html=html.replace(new RegExp(`(<div id="${instanceId}"[^>]*?data-variable-values=')([^']*)(')`),(_,a,data,z)=>{
    const values=JSON.parse(unescape(data));for(const [key,value]of Object.entries(childPatch))values[key]=JSON.stringify(value);
    return a+escape(JSON.stringify(values))+z;
  });
  fs.writeFileSync(file,html);
}
const base=structuredClone(DEFAULT_RECIPE);base.aspect='1:1';
const swapped=structuredClone(base);[swapped.content.documents[0],swapped.content.documents[5]]=[swapped.content.documents[5],swapped.content.documents[0]];
const report={schema:'document-flow-native-contracts.v1',nativeVersion:'0.9.19',results:[]};
const write=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
const fingerprint=()=>Object.fromEntries(['model','view','runtime','build','audio','audio-contract','sound-contract'].map(name=>[`${name}.mjs`,createHash('sha256').update(fs.readFileSync(path.join(TEMPLATE,`source/lib/sequences/document-flow/${name}.mjs`))).digest('hex')]));
report.sourceBefore=fingerprint();

async function isolation(){
  const row={id:'two-native-instances',errors:[],externalRequests:[]};let page,server,browser;
  try{
    const first=await buildProject(path.join(out,'two-instances'),base,{instanceId:'flow-one'});
    const second=await buildProject(path.join(out,'second-source'),base,{instanceId:'flow-two'});
    const childBrand={...base.brand,name:'Atlas',font:'Archivo',background:'#101e38',foreground:'#f1f5fa',accent:'#f0bf53',accent2:'#9cc4e7'};
    const childContent=structuredClone(base.content);childContent.documents[0].label='Research';
    change(path.join(second.project,'index.html'),{},{brand:childBrand,content:childContent},'flow-two');
    // Reuse the very same source file twice through native composition aliases.
    const secondHTML=fs.readFileSync(path.join(second.project,'index.html'),'utf8');
    const host=secondHTML.match(/<div id="flow-two"[^>]+><\/div>/)[0].replace('compositions/flow-two.html','compositions/flow-one.html').replace('data-start="0"','data-start="3"').replace('position:absolute;inset:0','position:absolute;left:540px;top:0;width:1080px;height:1080px;transform:scale(.5);transform-origin:0 0');
    const audio=[...secondHTML.matchAll(/<audio[^>]+><\/audio>/g)].map(match=>match[0].replace(/data-start="([^"]+)"/,(_,value)=>`data-start="${Number(value)+3}"`)).join('\n');
    let html=fs.readFileSync(path.join(first.project,'index.html'),'utf8');
    html=html.replace('style="position:absolute;inset:0"','style="position:absolute;left:0;top:0;width:1080px;height:1080px;transform:scale(.5);transform-origin:0 0"');
    html=html.replace(`data-height="1080" data-duration="${first.duration}"`,`data-height="1080" data-duration="${first.duration+3}"`);
    html=html.replace('\n</div><script>window.__timelines',`\n${host}\n${audio}\n</div><script>window.__timelines`);
    fs.writeFileSync(path.join(first.project,'index.html'),html);
    html=await bundleWithLocalizedFonts(first.project);server=await serveStaticProjectHtml(first.project,html);
    const opened=await openSettledCompositionPage(html,server.url,{renderReadyTimeoutMs:15000,browserGpuMode:'hardware',beforeNavigate:async tab=>{
      tab.on('pageerror',error=>row.errors.push(error.message));await tab.setRequestInterception(true);tab.on('request',request=>{const url=new URL(request.url());if(['http:','https:'].includes(url.protocol)&&!['localhost','127.0.0.1'].includes(url.hostname)){row.externalRequests.push(request.url());request.abort();}else request.continue();});
    }});
    ({page,browser}=opened);assert.ok(!opened.renderReadyTimedOut);
    await page.waitForFunction(()=>[...document.querySelectorAll('[data-sequence-root="document-flow"]')].length===2&&[...document.querySelectorAll('[data-sequence-root="document-flow"]')].every(root=>root.documentFlow),{timeout:15000});
    await page.evaluate(()=>{for(const root of document.querySelectorAll('[data-sequence-root="document-flow"]'))root.proofNodes=[...root.querySelectorAll('[data-document-id]')];});
    const sample=()=>page.evaluate(()=>({instances:[...document.querySelectorAll('[data-sequence-root="document-flow"]')].map(root=>{const x=root.documentFlow,css=getComputedStyle(root);return{id:x.id,scope:root.dataset.dfInstance,computed:{background:css.backgroundColor,color:css.color,font:css.fontFamily.replaceAll('"','')},time:x.state.time,brand:x.plan.brand,content:x.plan.content,identities:root.proofNodes.every((node,i)=>node===root.querySelectorAll('[data-document-id]')[i]),cameras:root.querySelectorAll('[data-world-camera]').length,state:x.state};}),ids:[...document.querySelectorAll('[id]')].map(node=>node.id),audio:[...document.querySelectorAll('audio[data-sequence-instance]')].map(node=>({id:node.id,instance:node.dataset.sequenceInstance,start:+node.dataset.start,event:node.dataset.sequenceEvent})),readyKeys:Object.keys(window.__hf.buildReady),timelineKeys:Object.keys(window.__timelines),legacySingleton:typeof window.__documentFlow!=='undefined'||typeof window.__documentFlowRootVariables!=='undefined'}));
    await seekCompositionTimeline(page,6,{exactTime:true});const firstSample=await sample();
    row.sample=firstSample;assert.equal(firstSample.instances.length,2);assert.equal(firstSample.legacySingleton,false);
    for(const id of ['flow-one','flow-two']){assert.ok(firstSample.readyKeys.includes('document-flow:'+id));assert.ok(firstSample.timelineKeys.includes(id));}
    assert.equal(new Set(firstSample.ids).size,firstSample.ids.length,'Assembled DOM IDs must be unique');
    const a=firstSample.instances.find(x=>x.id==='flow-one'),b=firstSample.instances.find(x=>x.id==='flow-two');
    assert.ok(a&&b,JSON.stringify(firstSample.instances.map(x=>x.id)));
    assert.ok(Math.abs(a.time-6)<1e-5);assert.ok(Math.abs(b.time-3)<1e-5);
    assert.deepEqual(a.brand,base.brand);assert.deepEqual(b.brand,childBrand);assert.deepEqual(b.content,childContent);
    const rgb=hex=>'rgb('+[1,3,5].map(offset=>parseInt(hex.slice(offset,offset+2),16)).join(', ')+')';
    for(const instance of [a,b]){assert.equal(instance.scope,instance.id);assert.deepEqual(instance.computed,{background:rgb(instance.brand.background),color:rgb(instance.brand.foreground),font:instance.brand.font});}
    assert.equal(firstSample.audio.length,first.audio.clips.length+second.audio.clips.length+2);
    assert.ok(firstSample.audio.filter(x=>x.instance==='flow-two').every(x=>x.start>=3));
    assert.ok(firstSample.instances.every(x=>x.identities&&x.cameras===1));
    await seekCompositionTimeline(page,12,{exactTime:true});await seekCompositionTimeline(page,1,{exactTime:true});await seekCompositionTimeline(page,6,{exactTime:true});
    const reversed=await sample();assert.deepEqual(reversed,firstSample);
    await page.evaluate(()=>document.querySelector('[data-composition-id="flow-one"] [data-sequence-root]').documentFlow.dispose());
    await seekCompositionTimeline(page,7,{exactTime:true});
    row.afterDispose=await page.evaluate(()=>({firstMounted:Boolean(document.querySelector('[data-composition-id="flow-one"] [data-sequence-root]').documentFlow),secondTime:document.querySelector('[data-composition-id="flow-two"] [data-sequence-root]').documentFlow.state.time,secondDocuments:document.querySelector('[data-composition-id="flow-two"] [data-sequence-root]').querySelectorAll('[data-document-id]').length}));
    assert.equal(row.afterDispose.firstMounted,false);assert.equal(row.afterDispose.secondDocuments,6);assert.ok(Math.abs(row.afterDispose.secondTime-4)<1e-5);
    assert.deepEqual(row.errors,[]);assert.deepEqual(row.externalRequests,[]);row.sample=firstSample;row.sameSourceMountedTwice=true;row.passed=true;
  }catch(error){row.errors.push(String(error.stack??error));row.passed=false;}
  finally{await page?.close();await browser?.close();await server?.close();}
  report.results.push(row);write();console.log(`${row.id}: ${row.passed?'pass':row.errors.at(-1)}`);
}

async function exportCase(id,{rootPatch,childPatch,recipe=base,blocked=false}){
  const row={id,expectedBlocked:blocked};
  try{
    const built=await buildProject(path.join(out,id),recipe);change(path.join(built.project,'index.html'),rootPatch,childPatch);
    const output=path.join(out,`${id}.mp4`),command=path.join(TEMPLATE,'node_modules/.bin/hyperframes');
    const args=['render',built.project,'--output',output,'--fps','1','--workers','1','--browser-gpu','--player-ready-timeout','10000'];
    let result;
    try{result=await promisify(execFile)(command,args,{cwd:TEMPLATE,timeout:120000,maxBuffer:8*1024*1024,env:{...process.env,NO_COLOR:'1'}});row.exitCode=0;}
    catch(error){result=error;row.exitCode=typeof error.code==='number'?error.code:-1;}
    const log=`${result.stdout??''}\n${result.stderr??''}`;fs.writeFileSync(path.join(out,`${id}.log`),log);
    row.command=[command,...args];row.exportExists=fs.existsSync(output);row.hasStaleDiagnostic=log.includes('DOCUMENT_FLOW_AUDIO_STALE');row.defaultStrictness=true;
    if(blocked){assert.notEqual(row.exitCode,0);assert.equal(row.exportExists,false);assert.equal(row.hasStaleDiagnostic,true);}
    else{assert.equal(row.exitCode,0,log.slice(-5000));assert.ok(fs.statSync(output).size>1000);row.videoSha256=createHash('sha256').update(fs.readFileSync(output)).digest('hex');}
    row.passed=true;
  }catch(error){row.passed=false;row.error=String(error.stack??error);}
  report.results.push(row);write();console.log(`${id}: ${row.passed?'pass':row.error}`);
}

await isolation();
if(!process.argv.includes('--only-isolation')){
await exportCase('stale-root',{rootPatch:{content:swapped.content},blocked:true});
await exportCase('stale-child',{childPatch:{content:swapped.content},blocked:true});
await exportCase('rebuilt-events',{recipe:swapped});
const copy=structuredClone(base.content);copy.opening='Your creative work, organized';
await exportCase('safe-copy',{rootPatch:{content:copy}});
}
report.sourceAfter=fingerprint();report.sourceStable=JSON.stringify(report.sourceBefore)===JSON.stringify(report.sourceAfter);
report.passed=report.sourceStable&&report.results.every(row=>row.passed);write();
if(!report.passed)process.exitCode=1;
