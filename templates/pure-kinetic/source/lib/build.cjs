// Compile a film recipe into native HyperFrames hosts and reusable scene definitions.
// No film player is emitted: each child owns one paused native timeline.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const SCHEMA = 'pk-hyperframes-v1';
const escape = value => String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll("'",'&#39;').replaceAll('<','&lt;');
const json = value => JSON.stringify(value).replaceAll('<','\\u003c');
const seconds = value => Number(value.toFixed(9));
const buildMark = (film,plan=require('./compiler/plan.cjs').compile(film)) => crypto.createHash('sha256').update(JSON.stringify({schema:SCHEMA,film,plan})).digest('hex');

function nativeClips(plan) {
  return plan.scenes.map((ps,index) => {
    const start = index === 0 ? 0 : Math.max(0,ps.start-(ps.trDur??0)/2);
    const end = index === plan.scenes.length-1 ? plan.duration : Math.min(plan.duration,ps.start+ps.dur+(plan.scenes[index+1]?.trDur??0)/2);
    return {id:`s${index+1}`,type:ps.scene.type,start:seconds(start),duration:seconds(end-start)};
  });
}

function sceneVariables(plan,ps) {
  return [
    {id:'content',type:'string',role:'content',label:'Scene content (JSON)',default:JSON.stringify(ps.scene)},
    {id:'style',type:'string',role:'style',label:'Style tokens (JSON)',default:JSON.stringify({look:ps.look??plan.look,palette:ps.palette??plan.palette,bg:ps.bg,fg:ps.fg,accent:ps.accent})},
    {id:'brand',type:'string',role:'content',label:'Brand (JSON)',default:JSON.stringify(plan.brand??{})},
    {id:'app',type:'string',role:'content',label:'Product interface (JSON)',default:JSON.stringify(plan.app??{})},
  ];
}

// The file of one scene definition, which a native host points at. `runtime`
// is the kit's runtime module as the page sees it.
function sceneDefinition({definitionId,duration,variables,config,runtime='./lib/components/runtime.mjs'}) {
  return `<!doctype html><html data-composition-id="${definitionId}" data-composition-duration="${duration}" data-composition-variables='${escape(JSON.stringify(variables))}'><body><template>
<div id="scene-root" data-composition-id="${definitionId}" data-duration="${duration}" style="position:absolute;inset:0">
<div id="scene-content" class="clip" data-start="0" data-duration="${duration}" data-track-index="0" style="position:absolute;inset:0"></div>
<script>(function(){const root=document.getElementById('scene-content');const host=root.closest('[data-composition-file],[data-composition-src]');const config=JSON.parse(host?.getAttribute('data-pk-config')||${json(JSON.stringify(config))});const variables=window.__hyperframes?.getVariables?.()||{};
import('${runtime}').then(({mountScene})=>mountScene(root,config,variables,window.gsap)).then(({timeline})=>{window.__timelines=window.__timelines||{};window.__timelines[${json(definitionId)}]=timeline;}).catch(error=>{window.__pkErrors??=[];window.__pkErrors.push(String(error?.stack??error));console.error('component failed',config.id,error);});})();</script>
</div></template></body></html>`;
}

// A native host of a scene definition: its place in time and on the tracks.
function sceneHost({id,file,variables,config,start,duration,track,width,height}) {
  const values = Object.fromEntries(variables.map(v=>[v.id,v.default]));
  return `<div id="${id}" class="clip" data-composition-id="${id}" data-composition-src="compositions/${file}" data-variable-values='${escape(JSON.stringify(values))}' data-pk-config='${escape(JSON.stringify(config))}' data-start="${start}" data-duration="${duration}" data-track-index="${track}" data-track-kind="graphics" data-width="${width}" data-height="${height}" style="position:absolute;inset:0;z-index:${track}"></div>`;
}

function buildProject(source,film,plan,{options={}}={}) {
  const clips = nativeClips(plan),definitions = new Map();
  const compositionDir = path.join(source,'compositions');
  fs.mkdirSync(compositionDir,{recursive:true});
  const hosts = clips.map((clip,index) => {
    const ps = plan.scenes[index];
    const definitionId = `pk-${clip.type}`;
    // Different durations need different declared clip bounds. Equal definitions
    // really share a source file; instance data live on each native host.
    const file = `${clip.type}-${String(clip.duration).replace('.','_')}.html`;
    const config = {id:clip.id,plan,ps,clipStart:clip.start,clipDuration:clip.duration,options};
    const variables = sceneVariables(plan,ps);
    if(!definitions.has(file)) {
      definitions.set(file,{type:clip.type,duration:clip.duration});
      const html = sceneDefinition({definitionId,duration:clip.duration,variables,config});
      fs.writeFileSync(path.join(compositionDir,file),html);
    }
    return sceneHost({id:clip.id,file,variables,config,start:clip.start,duration:clip.duration,track:index+1,width:plan.width,height:plan.height});
  });
  // Remove only files from the preceding generated manifest, never user files.
  const manifestFile = path.join(source,'native-project.json');
  if(fs.existsSync(manifestFile)) {
    const previous=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
    if(previous.schema===SCHEMA)for(const name of Object.keys(previous.definitions??{})) {
      if(!definitions.has(name)&&/^[a-z0-9_-]+\.html$/.test(name))fs.rmSync(path.join(compositionDir,name),{force:true});
    }
  }
  const resolution={'16:9':'landscape','1:1':'square','9:16':'portrait'}[film.aspect];
  // Keep texture inputs discoverable by HyperFrames' offline frame extractor.
  // The scene paints their pixels into its own glass pass and composites it.
  const videoInput=(id,src,clip,track)=>`<video id="${id}" data-pk-background="${escape(src)}" src="${escape(src)}" muted playsinline loop preload="metadata" data-start="${clip.start}" data-duration="${clip.duration}" data-volume="0" data-track-index="${track}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"></video>`;
  let videoTrack=clips.length+2;
  const videoInputs=clips.flatMap((clip,i)=>{
    const scene=plan.scenes[i].scene,src=scene.background?.video;
    // A scene's own videos (a wall of them) are textures too, one input each.
    return [...(src?[videoInput(`pk-background-${clip.id}`,src,clip,videoTrack++)]:[]),
      ...(Array.isArray(scene.videos)?scene.videos:[]).map((path,k)=>videoInput(`pk-video-${clip.id}-${k}`,path,clip,videoTrack++))];
  });
  const hash=buildMark(film,plan);
  const rootConfig={id:'main',plan,sceneIds:clips.map(c=>c.id),options};
  const html=`<!doctype html><html lang="${escape(film.lang??'en')}" data-resolution="${resolution}"><head><meta charset="utf-8"><meta name="viewport" content="width=${plan.width}, height=${plan.height}">
<link rel="stylesheet" href="lib/components/presentation.css"><link rel="stylesheet" href="lib/fonts.css">
<style>*{margin:0;padding:0;box-sizing:border-box}html,body{margin:0;padding:0;width:${plan.width}px;height:${plan.height}px;overflow:hidden;background:#000}#root.pk-film{position:relative;width:${plan.width}px;height:${plan.height}px;overflow:hidden;isolation:isolate}</style>
<script type="importmap">{"imports":{"three":"./lib/vendor/three/three.module.min.js"}}</script><script src="lib/vendor/gsap/gsap.min.js"></script></head><body>
<div id="root" class="pk-film" data-composition-id="main" data-width="${plan.width}" data-height="${plan.height}" data-duration="${seconds(plan.duration)}" data-fps="${plan.fps}" data-pk-film-hash="${hash}">
${hosts.join('\n')}
${videoInputs.length?`<div aria-hidden="true" style="position:absolute;inset:0;opacity:0;pointer-events:none">${videoInputs.join('\n')}</div>`:''}
<audio id="music" src="assets/music.m4a" data-start="0" data-duration="${seconds(plan.duration)}" data-volume="1" data-track-index="${clips.length+1}"></audio>
</div><script>(function(){const root=document.getElementById('root');const config=${json(rootConfig)};
const ready=import('./lib/components/runtime.mjs').then(({mountFilm})=>mountFilm(root,config,window.gsap)).then(({timeline})=>{window.__timelines=window.__timelines||{};window.__timelines.main=timeline;}).catch(error=>{window.__pkErrors??=[];window.__pkErrors.push(String(error?.stack??error));console.error('film failed',error);throw error;});
window.__hf??={};window.__hf.buildReady??={};window.__hf.buildReady.pk=ready;})();</script></body></html>`;
  fs.writeFileSync(path.join(source,'index.html'),html);
  fs.writeFileSync(manifestFile,JSON.stringify({schema:SCHEMA,buildMark:hash,width:plan.width,height:plan.height,duration:plan.duration,clips,definitions:Object.fromEntries(definitions)},null,2)+'\n');
  return {html,clips,buildMark:hash};
}

module.exports={buildProject,nativeClips,buildMark,sceneVariables,sceneDefinition,sceneHost,SCHEMA};
