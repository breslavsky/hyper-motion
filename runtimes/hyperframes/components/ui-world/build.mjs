import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compile} from './model.mjs';
import {buildAudio} from './audio.mjs';
const HERE=path.dirname(fileURLToPath(import.meta.url));
const REPO=path.resolve(HERE,'../../../..');
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll("'",'&#39;').replaceAll('<','&lt;');
const json=value=>JSON.stringify(value).replaceAll('<','\\u003c');

export async function buildProject(destination,spec={}) {
  const plan=compile(spec),{width,height,duration}=plan;
  const dest=path.resolve(destination);
  if(fs.existsSync(path.join(dest,'index.html')))throw new Error(`destination already contains index.html: ${dest}`);
  fs.mkdirSync(path.join(dest,'assets/ui-world'),{recursive:true});
  fs.mkdirSync(path.join(dest,'compositions'),{recursive:true});
  for(const name of ['model.mjs','view.mjs','runtime.mjs','SOURCE.json'])fs.copyFileSync(path.join(HERE,name),path.join(dest,'assets/ui-world',name));
  fs.copyFileSync(path.join(HERE,'../pure-kinetic/vendor/gsap-3.14.2.min.js'),path.join(dest,'assets/ui-world/gsap-3.14.2.min.js'));
  fs.cpSync(path.join(REPO,'templates/pure-kinetic/source/lib/fonts'),path.join(dest,'assets/fonts'),{recursive:true});
  fs.copyFileSync(path.join(REPO,'templates/pure-kinetic/source/lib/fonts.css'),path.join(dest,'assets/fonts.css'));
  const fonts=[['Geist','Geist'],['Archivo','Archivo'],['Geist Mono','GeistMono']].map(([family,file])=>`@font-face{font-family:"${family}";src:url('assets/fonts/${file}-Variable.woff2');font-weight:100 900;font-display:block}`).join('\n');
  const audio=await buildAudio({destination:dest,events:plan.events,kit:spec.sound,duration});
  const variables=[{id:'style',type:'string',label:'Brand tokens (JSON)',default:JSON.stringify(plan.style)},{id:'labels',type:'string',label:'Control labels (JSON)',default:JSON.stringify(plan.labels)}];
  const values=Object.fromEntries(variables.map(v=>[v.id,v.default]));
  const config={aspect:plan.aspect,duration:plan.duration,style:plan.style,labels:plan.labels,sliderLength:plan.layout.slider.length,...(plan.timing?{music:plan.music,timing:plan.timing}:{})};
  fs.writeFileSync(path.join(dest,'compositions/world.html'),`<!doctype html><html data-composition-id="ui-world" data-composition-duration="${duration}" data-composition-variables='${escape(JSON.stringify(variables))}'><body><template>
<div id="root" data-composition-id="ui-world" data-duration="${duration}">
<style>#root{position:absolute;inset:0;overflow:hidden}#root *{box-sizing:border-box}</style>
<div id="world-content" class="clip" data-start="0" data-duration="${duration}" data-track-index="0" style="position:absolute;inset:0"></div>
<script>(function(){const root=document.getElementById('world-content');const variables=window.__hyperframes?.getVariables?.()||{};
import('./assets/ui-world/runtime.mjs').then(({mount})=>mount(root,${json(config)},variables,window.gsap)).then(({timeline})=>{window.__timelines=window.__timelines||{};window.__timelines['ui-world']=timeline;}).catch(e=>{window.__mfErrors??=[];window.__mfErrors.push(e.message);console.error(e);});})();</script>
</div></template></body></html>`);
  const clips=audio.clips.map((clip,index)=>`<audio id="${escape(clip.id)}" src="${escape(clip.src)}" data-start="${clip.start}" data-duration="${clip.duration}" data-volume="${clip.gain}" data-track-index="${index+2}" data-ui-event="${escape(clip.eventId)}"></audio>`).join('\n');
  fs.writeFileSync(path.join(dest,'index.html'),`<!doctype html><html><head><meta charset="utf-8"><style>${fonts}\nhtml,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;background:${plan.style.bg}}#main{position:relative;width:${width}px;height:${height}px}</style><link rel="stylesheet" href="assets/fonts.css"></head><body>
<script src="assets/ui-world/gsap-3.14.2.min.js"></script>
<div id="main" data-composition-id="main" data-width="${width}" data-height="${height}" data-duration="${duration}">
<div id="world" class="clip" data-composition-id="world" data-composition-src="compositions/world.html" data-variable-values='${escape(JSON.stringify(values))}' data-start="0" data-duration="${duration}" data-track-index="1" data-track-kind="graphics" data-width="${width}" data-height="${height}" style="position:absolute;inset:0"></div>
${clips}
</div><script>window.__timelines=window.__timelines||{};window.__timelines.main=gsap.timeline({paused:true}).to({},{duration:${duration}});</script></body></html>`);
  fs.writeFileSync(path.join(dest,'world-project.json'),JSON.stringify({plan,audio},null,2));
  fs.writeFileSync(path.join(dest,'recipe.json'),JSON.stringify({...config,...(spec.sound===undefined?{}:{sound:spec.sound})},null,2));
  return {project:dest,width,height,duration,plan,audio};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [input,dest]=process.argv.slice(2);if(!input||!dest)throw new Error('Usage: node build.mjs recipe.json output-directory');
  const result=await buildProject(dest,JSON.parse(fs.readFileSync(input,'utf8')));
  console.log(JSON.stringify({project:result.project,width:result.width,height:result.height,duration:result.duration,audioClips:result.audio.clips.length}));
}
