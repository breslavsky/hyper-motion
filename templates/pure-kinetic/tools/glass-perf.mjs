// Native glass timing with completion boundaries and explicit diagnostic
// ablations. These numbers describe this machine/browser, not an FPS promise.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createNativeBrowser,SOURCE,sourceHashes} from './migration-browser.mjs';

const args=process.argv.slice(2);
const option=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const source=path.resolve(option('--source',SOURCE));
const out=path.resolve(option('--out','/tmp/glass-perf'));
const frames=Number(option('--frames',40)),rounds=Number(option('--rounds',3));
const buildOptions=JSON.parse(option('--options','{}'));
assert.ok(Number.isInteger(frames)&&frames>=10&&Number.isInteger(rounds)&&rounds>=1);
if(fs.existsSync(out))throw new Error('Use a fresh output directory: '+out);
fs.mkdirSync(out,{recursive:true});
const report={schema:'pure-kinetic.glass-perf.v1',source,sourceReceipt:sourceHashes(source),frames,rounds,buildOptions,
  policy:{completion:'Synchronous one-pixel WebGL readback per frame; one output pixel read per completed-output frame',warmup:12,
    profile:'Per-render synchronous WebGL readback attributes queued GPU work to that pass. Profiling serializes passes and is diagnostic only.',
    ablations:'Test-only method wrappers; all production methods restored between variants.'},results:[]};
const browser=await createNativeBrowser({source}),page=await browser.newPage();
try{
  await page.play({aspect:'16:9',style:'glass',grain:false,sparks:false,pace:'normal',brand:{name:'Glass performance',font:'Geist',
    tokens:{background:'#101828',foreground:'#ffffff',accent:'#6366f1',accent2:'#ff6b35'}},
    scenes:[{type:'island',title:'One clear message',body:'A surface with depth.',camera:'orbit',exit:'hold',beats:4}]},
  {options:buildOptions,transformProject:project=>{
    // Inspect only a private copied project. Production source remains intact.
    const file=path.join(project,'lib/components/glass/world.mjs');
    const text=fs.readFileSync(file,'utf8');
    // Whatever else inspect() hands out, it begins with the scene.
    const opening='inspect:()=>({scene,';
    assert.equal(text.split(opening).length,2,'Glass inspection contract changed');
    fs.writeFileSync(file,text.replace(opening,'inspect:()=>({renderer,scene,'));
  }});
  report.testedSourceReceipt=page.sourceHashes;
  await page.shoot(.8);
  report.environment=await page.evaluate(()=>{
    const world=window.__pkScenes.s1.context.K.glass,{renderer}=world.inspect(),gl=renderer.getContext();
    const info=gl.getExtension('WEBGL_debug_renderer_info');
    return {userAgent:navigator.userAgent,devicePixelRatio,canvas:[world.canvas.width,world.canvas.height],
      drawingBuffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],renderer:info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),
      vendor:info?gl.getParameter(info.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR)};
  });
  assert.ok(report.environment.canvas[0]<=1920&&report.environment.canvas[1]<=1080);
  const variants=[
    {name:'completed-static',motion:false,readback:true},
    {name:'completed-animated',motion:true,readback:true},
    {name:'gpu-animated',motion:true},
    {name:'profile-animated',motion:true,profile:true},
    {name:'cached-size-animated',motion:true,cacheSize:true,readback:true},
    {name:'no-copy-animated',motion:true,noCopy:true},
    {name:'no-background-animated',motion:true,noBackground:true,readback:true},
    {name:'no-glass-animated',motion:true,noGlass:true,readback:true},
  ];
  for(const variant of variants){
    console.log('Measuring '+variant.name);
    const result=await page.evaluate(async({variant,frames,rounds})=>{
      const instance=window.__pkScenes.s1,world=instance.context.K.glass,{renderer,scene}=world.inspect();
      const gl=renderer.getContext(),context=world.canvas.getContext('2d');
      const original={render:renderer.render,setSize:renderer.setSize,copy:context.drawImage};
      let current=null;
      const counters={setSize:0,render:0,copy:0,background:0,glass:0};
      const sync=()=>{
        const format=gl.getParameter(gl.IMPLEMENTATION_COLOR_READ_FORMAT),type=gl.getParameter(gl.IMPLEMENTATION_COLOR_READ_TYPE);
        const buffer=type===gl.FLOAT?new Float32Array(4):type===gl.HALF_FLOAT?new Uint16Array(4):new Uint8Array(4);
        gl.readPixels(0,0,1,1,format,type,buffer);
        const error=gl.getError();if(error!==gl.NO_ERROR)throw new Error('GPU completion readback failed '+error);
      };
      const measure=(key,fn,finish=false)=>{
        const start=performance.now();const result=fn();if(finish)sync();
        if(current)current[key]=(current[key]??0)+performance.now()-start;
        return result;
      };
      renderer.setSize=function(w,h,...rest){
        if(current)counters.setSize++;
        if(variant.cacheSize&&this.domElement.width===w&&this.domElement.height===h)return;
        return measure('setSize',()=>original.setSize.call(this,w,h,...rest),variant.profile);
      };
      renderer.render=function(renderedScene,...rest){
        // "glass" is every pass of the 3D scene: the finished pane, what a
        // traced lens looks at, and the frame itself. "background" is the rest.
        const main=renderedScene===scene,key=main?'glass':'background';
        if(current){counters.render++;counters[key]++;}
        if((main&&variant.noGlass)||(!main&&variant.noBackground))return;
        return measure(key,()=>original.render.call(this,renderedScene,...rest),variant.profile);
      };
      context.drawImage=function(...args){
        if(current)counters.copy++;
        if(variant.noCopy)return;
        return measure('copy',()=>{const result=original.copy.apply(this,args);if(variant.profile)context.getImageData(0,0,1,1);return result;});
      };
      const samples=[];
      const at=i=>instance.clipDuration*(variant.motion?.3+(i%frames)/(frames-1)*.3:.45);
      try{
        for(let i=0;i<12;i++){instance.drawAt(at(i));sync();if(variant.readback)context.getImageData(0,0,1,1);}
        for(let round=0;round<rounds;round++){
          for(let i=0;i<frames;i++){
            current={round,index:i};const start=performance.now();
            instance.drawAt(at(i));
            measure('completion',sync);
            if(variant.readback)measure('outputReadback',()=>context.getImageData(0,0,1,1));
            current.total=performance.now()-start;samples.push(current);current=null;
          }
          // Allow browser housekeeping outside the measured interval.
          await new Promise(resolve=>setTimeout(resolve,0));
        }
      }finally{renderer.render=original.render;renderer.setSize=original.setSize;context.drawImage=original.copy;}
      const stats=values=>{const sorted=values.toSorted((a,b)=>a-b);return {mean:values.reduce((a,b)=>a+b,0)/values.length,
        p50:sorted[Math.floor((sorted.length-1)*.5)],p95:sorted[Math.floor((sorted.length-1)*.95)],max:sorted.at(-1)};};
      const summary=Object.fromEntries(['total','setSize','background','glass','copy','completion','outputReadback']
        .map(key=>[key,stats(samples.map(sample=>sample[key]??0))]));
      return {variant,counters,summary,samples};
    },{variant,frames,rounds});
    report.results.push(result);
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({name:variant.name,total:result.summary.total,passes:variant.profile?result.summary:undefined}));
  }
  await page.shoot(.8);
  fs.writeFileSync(path.join(out,'frame.png'),Buffer.from(await page.screenshot({type:'png'})));
  report.errors=page.errors;
  assert.deepEqual(page.errors,[]);
  report.sourceAfter=sourceHashes(source);
  report.sourceStable=report.sourceReceipt.aggregate===report.sourceAfter.aggregate;
  assert.ok(report.sourceStable,'Source changed during performance measurement');
  report.completed=true;
}catch(error){report.failure=error.stack;throw error;}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
