// Native post-build edits: root defaults, per-host precedence and audio invalidation.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {loadNativeHyperframes} from './native-hyperframes-adapter.mjs';
import {buildProject} from '../source/lib/sequences/document-flow/build.mjs';
import {DEFAULT_RECIPE} from '../source/lib/sequences/document-flow/model.mjs';

const HERE=path.dirname(fileURLToPath(import.meta.url)),TEMPLATE=path.resolve(HERE,'..');
const out=process.argv.includes('--out')?path.resolve(process.argv[process.argv.indexOf('--out')+1]):'/tmp/pk-document-flow-variables';
if(fs.existsSync(out))throw new Error(`Use a fresh output directory: ${out}`);
fs.mkdirSync(out,{recursive:true});
const packageRoot=path.join(TEMPLATE,'node_modules/hyperframes');
const {bundleWithLocalizedFonts,serveStaticProjectHtml,openSettledCompositionPage,seekCompositionTimeline}=await loadNativeHyperframes(packageRoot);
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll("'",'&#39;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const unescape=value=>value.replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&');
function change(file,rootPatch={},childPatch={}){
  let html=fs.readFileSync(file,'utf8');
  if(Object.keys(rootPatch).length)html=html.replace(/(<html[^>]*?data-composition-variables=')([^']*)(')/,(_,a,data,z)=>{
    const defs=JSON.parse(unescape(data));
    for(const [key,value]of Object.entries(rootPatch))defs.find(def=>def.id===key).default=JSON.stringify(value);
    return a+escape(JSON.stringify(defs))+z;
  });
  if(Object.keys(childPatch).length)html=html.replace(/(<div id="document-flow"[^>]*?data-variable-values=')([^']*)(')/,(_,a,data,z)=>{
    const values=JSON.parse(unescape(data));for(const [key,value]of Object.entries(childPatch))values[key]=JSON.stringify(value);
    return a+escape(JSON.stringify(values))+z;
  });
  fs.writeFileSync(file,html);
}
const base=structuredClone(DEFAULT_RECIPE),rootBrand={...base.brand,name:'Juniper',background:'#f1f5e9',foreground:'#19382a',accent:'#257649',accent2:'#c9d99a'},childBrand={...base.brand,name:'Atlas',font:'Archivo',background:'#101e38',foreground:'#f1f5fa',accent:'#f0bf53',accent2:'#9cc4e7'};
const rootContent={...structuredClone(base.content),opening:'Your creative work, organized'};
const childContent=structuredClone(base.content);childContent.documents[0].label='Research';
const cases=[
  {id:'default',brand:base.brand,content:base.content},
  {id:'root-brand',root:{brand:rootBrand},brand:rootBrand,content:base.content},
  {id:'child-brand',child:{brand:childBrand},brand:childBrand,content:base.content},
  {id:'child-over-root',root:{brand:rootBrand},child:{brand:childBrand},brand:childBrand,content:base.content},
  {id:'child-explicit-original',root:{brand:rootBrand},child:{brand:base.brand},brand:base.brand,content:base.content},
  {id:'root-content',root:{content:rootContent},brand:base.brand,content:rootContent,edited:true},
  {id:'child-content',child:{content:childContent},brand:base.brand,content:childContent,edited:true},
];
const results=[];let browser;
try{
  for(const job of cases){
    const project=path.join(out,job.id),built=await buildProject(project,base),row={id:job.id,receipt:built.receipt,errors:[],externalRequests:[]};
    let page,server;
    try{
      change(path.join(project,'index.html'),job.root,job.child);
      const html=await bundleWithLocalizedFonts(project);server=await serveStaticProjectHtml(project,html);
      const opened=await openSettledCompositionPage(html,server.url,{renderReadyTimeoutMs:30000,browserGpuMode:'hardware',prelaunched:browser?{take:async()=>({browser,softwareWebGpu:false})}:undefined,
        beforeNavigate:async tab=>{tab.on('pageerror',e=>row.errors.push(e.message));await tab.setRequestInterception(true);tab.on('request',request=>{const url=new URL(request.url());if(['http:','https:'].includes(url.protocol)&&!['localhost','127.0.0.1'].includes(url.hostname)){row.externalRequests.push(request.url());request.abort();}else request.continue();});}});
      page=opened.page;browser=opened.browser;assert.ok(!opened.renderReadyTimedOut);
      await page.waitForFunction(()=>document.querySelector('[data-sequence-root="document-flow"]')?.documentFlow||window.__hfStartupError,{timeout:30000});
      await seekCompositionTimeline(page,1,{exactTime:true});
      row.actual=await page.evaluate(()=>{const instance=document.querySelector('[data-sequence-root="document-flow"]').documentFlow;if(!instance)throw new Error(window.__hfStartupError);return{brand:instance.plan.brand,content:instance.plan.recipe.content,edited:instance.contentEdited,audioCurrent:instance.audioCurrent,background:getComputedStyle(instance.root).backgroundColor,foreground:getComputedStyle(instance.root.querySelector('.df-intro')).color,opening:instance.root.querySelector('.df-intro').textContent,audio:[...document.querySelectorAll('audio[data-sequence-event]')].map(a=>({id:a.dataset.sequenceEvent,at:+a.dataset.start}))};});
      assert.deepEqual(row.actual.brand,job.brand);assert.deepEqual(row.actual.content,job.content);
      const rgb=hex=>`rgb(${[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(', ')})`;
      assert.equal(row.actual.background,rgb(job.brand.background));assert.equal(row.actual.foreground,rgb(job.brand.foreground));
      assert.equal(row.actual.opening,job.content.opening);assert.equal(Boolean(row.actual.edited),Boolean(job.edited));assert.equal(row.actual.audioCurrent,true);
      assert.deepEqual(row.actual.audio,built.audio.clips.map(c=>({id:c.eventId,at:c.start})));
      assert.deepEqual(row.externalRequests,[]);assert.deepEqual(row.errors,[]);row.passed=true;
    }catch(error){row.errors.push(String(error.stack??error));row.passed=false;}
    finally{await page?.close();await server?.close();}
    results.push(row);console.log(`${job.id}: ${row.passed?'pass':row.errors.at(-1).split('\n')[0]}`);
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({schema:'document-flow-native-variables.v1',results},null,2)+'\n');
  }
}finally{await browser?.close();}
if(results.some(row=>!row.passed))process.exitCode=1;
