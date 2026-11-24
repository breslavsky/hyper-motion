import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {components,formats,looks,validateContent,validateStyle,validateDuration,nativeVariables} from './catalog.mjs';
const HERE=path.dirname(fileURLToPath(import.meta.url));
const REPO=path.resolve(HERE,'../../../..');
const SOURCE=path.join(REPO,'templates/pure-kinetic/source/lib');
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll("'",'&#39;').replaceAll('<','&lt;');
const json=value=>JSON.stringify(value).replaceAll('<','\\u003c');
export function buildProject(destination, spec) {
  const aspect=spec.aspect??'9:16';if(!formats.includes(aspect))throw new Error('aspect: use 9:16, 1:1 or 16:9');
  const norms=JSON.parse(fs.readFileSync(path.join(REPO,'design/norms.json'),'utf8'));
  const {width,height}=norms.aspects[aspect];
  if(!spec.scenes?.length)throw new Error('scenes: supply at least one component');
  const ids=new Set();let cursor=0;
  const scenes=spec.scenes.map((s,i)=>{
    const id=s.id??`${s.kind}-${i+1}`;
    if(!/^[a-z][a-z0-9-]*$/.test(id)||ids.has(id)||id==='main')throw new Error(`scenes[${i}].id: use a unique lowercase id other than main`);ids.add(id);
    if(!components[s.kind])throw new Error(`scenes[${i}].kind: unknown component ${s.kind}`);
    const duration=validateDuration(s.duration??4);
    const start=s.start??cursor;if(!Number.isFinite(start)||start<0)throw new Error(`scenes[${i}].start: use nonnegative seconds`);
    cursor=Math.max(cursor,start+duration);
    const selectedLook=s.look??spec.look??'editorial';if(!looks[selectedLook])throw new Error(`look: unknown look ${selectedLook}`);
    return {id,kind:s.kind,data:validateContent(s.kind,s.content),style:validateStyle({...looks[selectedLook],...spec.style,...s.style}),duration,start,width,height,aspect,norms};
  });
  const dest=path.resolve(destination);
  if(fs.existsSync(path.join(dest,'index.html')))throw new Error(`destination already contains index.html: ${dest}`);
  fs.mkdirSync(path.join(dest,'assets/pk/scenes'),{recursive:true});fs.mkdirSync(path.join(dest,'compositions'),{recursive:true});
  for(const f of ['runtime.mjs','catalog.mjs'])fs.copyFileSync(path.join(HERE,f),path.join(dest,'assets/pk',f));
  for(const kind of new Set(scenes.map(s=>s.kind)))fs.copyFileSync(path.join(HERE,'scenes',`${kind}.mjs`),path.join(dest,'assets/pk/scenes',`${kind}.mjs`));
  if(scenes.some(s=>s.kind==='phone3d')){
    fs.cpSync(path.join(SOURCE,'vendor/three'),path.join(dest,'assets/pk/vendor/three'),{recursive:true});
    for(const f of ['RoomEnvironment.js','RoundedBoxGeometry.js']){const p=path.join(dest,'assets/pk/vendor/three',f);fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace(/from ['"]three['"]/g,"from './three.module.min.js'"));}
    const shared=path.join(HERE,'scenes/three-shared.mjs');if(fs.existsSync(shared))fs.copyFileSync(shared,path.join(dest,'assets/pk/scenes/three-shared.mjs'));
  }
  fs.cpSync(path.join(SOURCE,'fonts'),path.join(dest,'assets/fonts'),{recursive:true});
  fs.copyFileSync(path.join(SOURCE,'fonts.css'),path.join(dest,'assets/fonts.css'));
  fs.mkdirSync(path.join(dest,'assets/pk/vendor'),{recursive:true});
  fs.copyFileSync(path.join(HERE,'vendor/gsap-3.14.2.min.js'),path.join(dest,'assets/pk/vendor/gsap-3.14.2.min.js'));
  fs.copyFileSync(path.join(HERE,'SOURCE.json'),path.join(dest,'assets/pk/SOURCE.json'));
  const fonts=[['Geist','Geist'],['Archivo','Archivo'],['Geist Mono','GeistMono']].map(([family,file])=>`@font-face{font-family:"${family}";src:url('assets/fonts/${file}-Variable.woff2');font-weight:100 900;font-display:block}`).join('\n')+`\n@font-face{font-family:"Instrument Serif";src:url('assets/fonts/InstrumentSerif-Italic.woff2');font-weight:400;font-style:italic;font-display:block}`;
  const definitions=new Set();
  const definitionFile=s=>`${s.kind}-${String(s.duration).replace('.','_')}.html`;
  for(const s of scenes){
    const file=definitionFile(s);if(definitions.has(file))continue;definitions.add(file);
    const vars=nativeVariables(s.kind,s.data,s.style,s.duration);
    fs.writeFileSync(path.join(dest,'compositions',file),`<!doctype html><html data-composition-id="${s.kind}" data-composition-duration="${s.duration}" data-composition-variables='${escape(JSON.stringify(vars))}'><body><template>
<div id="root" data-composition-id="${s.kind}" data-duration="${s.duration}">
<style>#root{position:absolute;inset:0;overflow:hidden}#root *{box-sizing:border-box}</style>
<div id="content-${s.id}" class="clip" data-start="0" data-duration="${s.duration}" data-track-index="0" style="position:absolute;inset:0"></div>
<script>(function(){const root=document.getElementById('content-${s.id}');const variables=window.__hyperframes?.getVariables?.()||{};
import('./assets/pk/runtime.mjs').then(({mount})=>mount(root,${json(s)},variables,window.gsap)).then(({timeline})=>{window.__timelines=window.__timelines||{};window.__timelines["${s.kind}"]=timeline;}).catch(e=>{window.__mfErrors??=[];window.__mfErrors.push(e.message);console.error(e);});})();</script>
</div></template></body></html>`);
  }
  const hosts=scenes.map((s,i)=>{const values=Object.fromEntries(nativeVariables(s.kind,s.data,s.style,s.duration).map(v=>[v.id,v.default]));return `<div id="${s.id}" class="clip" data-composition-id="${s.id}" data-composition-src="compositions/${definitionFile(s)}" data-variable-values='${escape(JSON.stringify(values))}' data-start="${s.start}" data-duration="${s.duration}" data-track-index="${i+1}" data-track-kind="graphics" data-width="${width}" data-height="${height}" style="position:absolute;inset:0"></div>`;}).join('\n');
  fs.writeFileSync(path.join(dest,'index.html'),`<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="assets/fonts.css"><style>${fonts}\nhtml,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;background:${scenes[0].style.bg}}#main{position:relative;width:${width}px;height:${height}px}</style></head><body>
<script src="assets/pk/vendor/gsap-3.14.2.min.js"></script>
<div id="main" data-composition-id="main" data-width="${width}" data-height="${height}" data-duration="${cursor}">${hosts}</div>
<script>window.__timelines=window.__timelines||{};window.__timelines.main=gsap.timeline({paused:true}).to({},{duration:${cursor}});</script></body></html>`);
  fs.writeFileSync(path.join(dest,'component-project.json'),JSON.stringify({schemaVersion:1,aspect,width,height,duration:cursor,scenes:scenes.map(({norms,...s})=>s)},null,2));
  return {project:dest,width,height,duration:cursor,scenes};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [input,dest]=process.argv.slice(2);if(!input||!dest)throw new Error('Usage: node build.mjs spec.json output-directory');
  const result=buildProject(dest,JSON.parse(fs.readFileSync(input,'utf8')));console.log(JSON.stringify({project:result.project,width:result.width,height:result.height,duration:result.duration}));
}
