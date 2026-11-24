// How long a film takes to be ready in the live preview, and what its scenes
// are asked to draw before that. The other native suites open a film the way
// an export does (capture mode); the preview is another path: the page is
// served as it is, with the HyperFrames runtime and the live preview hint
// (`window.__harnessPreview`) put into its head, and the runtime plays it.
//
//   node tools/preview-ready-native.mjs [--film film.json] [--project dir] [--json]
//     --play     also play the film through and report how far apart its frames are
//     --window   in a Chrome window, not headless (frames are drawn at the screen's rate)
//     --export   without the preview hint: what the page does when it does not know it is previewed
//
// It also says what the preview hint does to a film: with it a scene draws
// its own pictures at the stream's size (K.previewScale) and only the frames
// of the film's grid; `--export` opens the same page without the hint.
//
// HISTORY 384: a film of the metal look never became ready in the preview.
// The runtime, looking for a timeline that moves the music's volume, played
// the whole film through at 60 steps a second, and a metal scene took 5 ms
// for each step.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url)),TEMPLATE=path.resolve(HERE,'..'),SOURCE=path.join(TEMPLATE,'source');
const packageRoot=fs.realpathSync(path.join(TEMPLATE,'node_modules/hyperframes'));
const puppeteer=createRequire(path.join(packageRoot,'package.json'))('puppeteer-core');
const args=process.argv.slice(2),option=name=>args.includes(name)?args[args.indexOf(name)+1]:null;

// The film that showed it: eleven scenes of the page's metal, an orb and a
// glass scene whose modules are imported when they mount.
export const METAL_FILM={aspect:'9:16',style:'metal',metalVariant:'silver',brand:{name:'Motion Fab',url:'motionfab.app',colors:['#cd005d','#1e1a33']},palette:'brand',music:{track:'drive'},
  scenes:[
    {type:'letterflip',beats:3,text:'HELLO, OPUS 5.5.',in:'glide'},
    {type:'impact',beats:3,text:'I’M DEEPSEEK.',in:'glide'},
    {type:'slam',beats:4,lines:['AND I’M','COMING FOR YOU.'],in:'glide'},
    {type:'sentence',beats:4,text:'You’ve had the spotlight long enough.',in:'glide'},
    {type:'thinking-orb',beats:5,state:'listening',title:'Now watch closely.',in:'glide'},
    {type:'search',beats:5,query:'One prompt.',placeholder:'',in:'glide'},
    {type:'shuffle',beats:5,from:'Words become motion.',to:'Shapes become stories.',in:'glide'},
    {type:'explode',beats:5,layers:['Ideas','Motion','Story'],title:'Ideas take over the screen.',in:'glide'},
    {type:'append',beats:4,base:'EVERY',words:['PIXEL','FRAME','MOVE'],in:'glide'},
    {type:'underline',beats:4,text:'JUST STARTED',tag:'and I’m just getting',in:'glide'},
    {type:'slam',beats:5,lines:['OPUS…','YOUR NEXT PROBLEM.'],in:'glide'},
    {type:'endcard',beats:5,cta:'motionfab.app',tagline:'Ideas in motion',in:'glide'},
  ]};

const TYPES={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.cjs':'text/javascript','.json':'application/json','.css':'text/css',
  '.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.m4a':'audio/mp4','.mp4':'video/mp4','.woff2':'font/woff2','.ttf':'font/ttf'};
const RUNTIME=path.join(packageRoot,'dist/hyperframe.runtime.iife.js');

/** Serves a project as the worker's preview route does (runtimes/hyperframes/adapter/routes.py). */
export function serve(project,hint){
  const tag=`${hint?`<script>window.__harnessPreview = ${JSON.stringify(hint)};</script>`:''}<script src="/hfrt/runtime.js"></script>`;
  const server=http.createServer((request,response)=>{
    const name=decodeURIComponent(new URL(request.url,'http://x').pathname);
    const file=name==='/hfrt/runtime.js'?RUNTIME:path.join(project,name);
    if(file!==RUNTIME&&!file.startsWith(project+path.sep)){response.writeHead(403).end();return;}
    fs.readFile(file,(error,body)=>{
      if(error){response.writeHead(404).end();return;}
      if(name==='/index.html'){const html=String(body),at=html.indexOf('>',html.toLowerCase().indexOf('<head'));body=html.slice(0,at+1)+tag+html.slice(at+1);}
      response.writeHead(200,{'content-type':TYPES[path.extname(file)]??'application/octet-stream','cache-control':'no-store'}).end(body);
    });
  });
  return new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve({url:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(done=>server.close(done))})));
}

/** Builds `film` in a copy of the template's source and returns the folder. */
export function buildProject(film){
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'pk-preview-ready-')),project=path.join(folder,'source');
  fs.cpSync(SOURCE,project,{recursive:true,filter:file=>path.basename(file)!=='.hyperframes'});
  fs.symlinkSync(path.join(TEMPLATE,'node_modules'),path.join(folder,'node_modules'));
  fs.writeFileSync(path.join(project,'film.json'),`${JSON.stringify(film,null,2)}\n`);
  execFileSync(process.execPath,[path.join(project,'lib/film.cjs'),'fit'],{cwd:project,encoding:'utf8',timeout:60000,stdio:['ignore','pipe','pipe']});
  return {folder,project};
}

/** Opens a built project as the live preview does and measures it until the film is ready. */
export async function measure(project,{hint={longSide:1280,capture:'frames'},timeout=120000,play=false,headless=true}={}){
  const server=await serve(project,hint);
  const browser=await puppeteer.launch({channel:'chrome',headless,defaultViewport:null,args:['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']});
  try{
    const page=await browser.newPage(),errors=[];
    if(headless)await page.setViewport({width:540,height:960});
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error'&&!/favicon|404/.test(message.text()))errors.push(message.text());});
    await page.evaluateOnNewDocument(()=>{
      window.__longTasks=[];
      new PerformanceObserver(list=>{for(const entry of list.getEntries())window.__longTasks.push(Math.round(entry.duration));}).observe({entryTypes:['longtask']});
    });
    await page.goto(`${server.url}/index.html`,{waitUntil:'domcontentloaded',timeout});
    const result=await page.evaluate(async({timeout,play})=>{
      const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
      const started=performance.now();
      while(!(window.__pkFilm?.ready||window.__pkFilm?.errors?.length)&&performance.now()-started<timeout)await wait(20);
      let failure=null;
      try{await Promise.race([window.__pkFilm.ready,wait(timeout).then(()=>{throw new Error('the film was not ready in time');})]);}
      catch(error){failure=String(error?.message??error);}
      const readyMs=Math.round(performance.now());
      // What the runtime does to a ready film in the next moments belongs to the start too.
      await wait(1500);
      const scenes=Object.fromEntries(Object.entries(window.__pkScenes??{}).map(([id,instance])=>[id,{type:instance.ps.scene.type,draws:instance.draws}]));
      const longTasks=[...window.__longTasks];
      // What one frame of playing costs: the film stepped as the player steps
      // it, 60 times a second of film, each step with the layout and style
      // work it leaves behind (a frame's worth, forced by reading a box).
      const player=window.__player;
      // First, before anything has seeked it: the film played as a viewer plays it, how far
      // apart the frames the page got to draw are, by the scene on screen.
      let played=null;
      if(play&&player&&!failure){
        const duration=player.getDuration(),gaps=[];
        await new Promise(resolve=>{
          let last=null;
          const tick=now=>{
            const time=player.getTime();
            if(last!==null)gaps.push([time,now-last]);
            last=now;
            if(time>=duration-.1||gaps.length>duration*240)resolve();else requestAnimationFrame(tick);
          };
          player.play();requestAnimationFrame(tick);
        });
        player.pause?.();
        const of=list=>{const sorted=list.map(gap=>gap[1]).sort((a,b)=>a-b);return {frames:sorted.length,mean:+(sorted.reduce((sum,ms)=>sum+ms,0)/Math.max(1,sorted.length)).toFixed(1),p95:+(sorted[Math.floor(sorted.length*.95)]??0).toFixed(1),max:+(sorted.at(-1)??0).toFixed(1),over34:sorted.filter(ms=>ms>34).length,over50:sorted.filter(ms=>ms>50).length};};
        played={all:of(gaps),scenes:{}};
        for(const [id,instance]of Object.entries(window.__pkScenes)){const {start,dur}=instance.ps;played.scenes[id]={...of(gaps.filter(([time])=>time>=start&&time<start+dur)),draws:instance.draws-scenes[id].draws};}
      }
      // A WebGL frame is done when the GPU has drawn it, not when the calls
      // were queued: one pixel read back from every WebGL canvas waits for it.
      const pixel=new Uint8Array(4);
      const contexts=()=>[...document.querySelectorAll('canvas')].map(canvas=>{try{return canvas.getContext('webgl2')??canvas.getContext('webgl');}catch{return null;}}).filter(Boolean);
      const finish=()=>{for(const gl of contexts())gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);};
      const steps=[];
      if(player&&!failure){
        const duration=player.getDuration();
        for(let time=0;time<=duration;time+=1/60){
          const before=performance.now();
          player.seek(time);document.body.getBoundingClientRect();finish();
          const ms=performance.now()-before;steps.push(ms);
          for(const [id,instance]of Object.entries(window.__pkScenes)){
            const {start,dur}=instance.ps;
            if(time>=start&&time<start+dur){const scene=scenes[id];scene.frames=(scene.frames??0)+1;scene.frameMs=(scene.frameMs??0)+ms;}
          }
        }
        for(const scene of Object.values(scenes))if(scene.frames)scene.frameMs=+(scene.frameMs/scene.frames).toFixed(2);
        for(const [id,instance]of Object.entries(window.__pkScenes))scenes[id].canvases=[...instance.root.querySelectorAll('canvas')].map(canvas=>`${canvas.width}x${canvas.height}`);
        player.seek(0);
      }
      steps.sort((a,b)=>a-b);
      const frame=steps.length?{mean:steps.reduce((sum,ms)=>sum+ms,0)/steps.length,p95:steps[Math.floor(steps.length*.95)],max:steps.at(-1)}:null;
      return {failure,readyMs,settledMs:Math.round(performance.now()),scenes,longTasks,frame,played,errors:window.__pkFilm?.errors??[]};
    },{timeout,play});
    result.errors.push(...errors);
    return result;
  }finally{await browser.close();await server.close();}
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const film=option('--film')?JSON.parse(fs.readFileSync(option('--film'),'utf8')):METAL_FILM;
  const built=option('--project')?{project:path.resolve(option('--project'))}:buildProject(film);
  try{
    const result=await measure(built.project,{play:args.includes('--play'),headless:!args.includes('--window'),hint:args.includes('--export')?null:undefined});
    const draws=Object.values(result.scenes).map(scene=>scene.draws),blocked=result.longTasks.reduce((sum,ms)=>sum+ms,0);
    if(args.includes('--json'))console.log(JSON.stringify(result,null,2));
    else{
      console.log(`ready in ${result.readyMs} ms; main thread blocked ${blocked} ms in ${result.longTasks.length} long tasks (longest ${Math.max(0,...result.longTasks)} ms)`);
      if(result.frame)console.log(`a frame of playing: ${result.frame.mean.toFixed(1)} ms on average, ${result.frame.p95.toFixed(1)} ms for 95 in 100, ${result.frame.max.toFixed(1)} ms at most`);
      console.log(`draws per scene before the first play: ${Object.entries(result.scenes).map(([id,scene])=>`${id} ${scene.type} ${scene.draws}`).join(', ')}`);
      console.log(`a frame of each scene, ms: ${Object.entries(result.scenes).sort((a,b)=>a[1].frameMs-b[1].frameMs).map(([id,scene])=>`${scene.type} ${scene.frameMs}`).join(', ')}`);
      if(result.played){
        const row=(name,stat)=>`${name}: ${stat.frames} frames, ${stat.mean} ms apart on average, ${stat.p95} for 95 in 100, ${stat.max} at most, ${stat.over34} over 34 ms, ${stat.over50} over 50 ms`;
        console.log(row('played',result.played.all));
        for(const [id,stat]of Object.entries(result.played.scenes))console.log('  '+row(`${id} ${result.scenes[id].type} ${result.scenes[id].canvases.join(' ')}`,stat));
      }
    }
    assert.equal(result.failure,null,result.failure);
    assert.deepEqual(result.errors,[]);
    assert.equal(Object.keys(result.scenes).length,film.scenes.length,'every scene mounted');
    // A scene is drawn when it mounts and when the runtime places the film at
    // its start: a handful of times, never once for every frame of the film.
    assert.ok(Math.max(...draws)<=30,`a scene was drawn ${Math.max(...draws)} times before anybody played the film`);
    assert.ok(result.readyMs<5000,`the film took ${result.readyMs} ms to be ready (the page gives its scenes 15 s)`);
    console.log('preview readiness: ok');
  }finally{if(built.folder)fs.rmSync(built.folder,{recursive:true,force:true});}
}
