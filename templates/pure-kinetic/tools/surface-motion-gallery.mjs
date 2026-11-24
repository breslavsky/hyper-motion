// Portable review UI for selected native motion comparisons. It never renders
// media or substitutes a player clock: every view uses the same HTML video node.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ASPECTS=['16:9','1:1','9:16'];
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const embeddedJson=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
const clock=time=>`${Math.floor(time/60)}:${String(Math.floor(time%60)).padStart(2,'0')}`;

export function normalizeManifest(input,{manifestDirectory,outDirectory}){
  if(!Array.isArray(input.formats)||input.formats.length!==3)throw new Error('Motion gallery requires exactly three format entries');
  const seen=new Set(),mediaCopies=[];
  const media=(value,aspect,kind)=>{
    if(typeof value!=='string'||!value||/^[a-z]+:\/\//i.test(value))throw new Error(`${aspect}.${kind} must reference a local media file`);
    const original=path.resolve(manifestDirectory,value);
    if(!fs.statSync(original).isFile())throw new Error(`Missing media file: ${original}`);
    let target=original,relative=path.relative(outDirectory,target);
    if(relative.startsWith('..'+path.sep)||relative==='..'||path.isAbsolute(relative)){
      target=path.join(outDirectory,'media',`${aspect.replace(':','x')}-${kind}${path.extname(original)}`);
      relative=path.relative(outDirectory,target);mediaCopies.push({from:original,to:target});
    }
    return relative.split(path.sep).map(encodeURIComponent).join('/');
  };
  const formats=input.formats.map(entry=>{
    if(!ASPECTS.includes(entry.aspect)||seen.has(entry.aspect))throw new Error(`Unknown or duplicate aspect: ${entry.aspect}`);seen.add(entry.aspect);
    if(!(Number.isFinite(entry.duration)&&entry.duration>0))throw new Error(`Invalid duration for ${entry.aspect}`);
    if(!Array.isArray(entry.chapters)||!entry.chapters.length)throw new Error(`Missing chapters for ${entry.aspect}`);
    let previous=-1;
    const chapters=entry.chapters.map(chapter=>{
      const time=chapter.time;
      if(!(Number.isFinite(time)&&time>=0&&time<entry.duration&&time>previous))throw new Error(`Chapters must increase within ${entry.aspect} duration`);
      if(typeof chapter.label!=='string'||!chapter.label.trim())throw new Error(`Missing chapter label for ${entry.aspect}`);
      previous=time;return {time,label:chapter.label,...(chapter.type?{type:String(chapter.type)}:{})};
    });
    return {aspect:entry.aspect,label:String(entry.label??entry.aspect),duration:entry.duration,chapters,
      comparison:media(entry.comparison,entry.aspect,'comparison'),poster:media(entry.poster,entry.aspect,'poster'),
      before:media(entry.before,entry.aspect,'before'),after:media(entry.after,entry.aspect,'after'),
      sourceHashes:entry.sourceHashes??input.sourceHashes??{}};
  }).sort((a,b)=>ASPECTS.indexOf(a.aspect)-ASPECTS.indexOf(b.aspect));
  const sceneCount=input.sceneCount??Math.max(...formats.map(format=>format.chapters.length));
  if(!(Number.isInteger(sceneCount)&&sceneCount>0))throw new Error('sceneCount must be a positive integer');
  const defaultAspect=input.defaultAspect??'16:9';
  if(!seen.has(defaultAspect))throw new Error(`Unknown default aspect: ${defaultAspect}`);
  return {data:{title:String(input.title??'До и после — в движении'),
    description:String(input.description??`${sceneCount} выбранных сцен. Движение и звуки компонентов в трёх форматах, без музыки.`),
    sceneCount,defaultAspect,formats},mediaCopies};
}

function client(){
  const data=JSON.parse(document.getElementById('motion-data').textContent),video=document.getElementById('player');
  const formats=document.getElementById('formats'),views=document.getElementById('views'),speeds=document.getElementById('speeds');
  const chapters=document.getElementById('chapters'),status=document.getElementById('player-status');
  const query=new URLSearchParams(location.search);
  let current=data.formats.find(format=>format.aspect===query.get('format'))??data.formats.find(format=>format.aspect===data.defaultAspect);
  let view=['comparison','before','after'].includes(query.get('view'))?query.get('view'):'comparison',rate=1;
  const requestedTime=Number(query.get('t'));
  const initialTime=query.has('t')&&Number.isFinite(requestedTime)&&requestedTime>=0&&requestedTime<current.duration?requestedTime:0;
  let request=0,pending={time:initialTime,playing:false},removeReady=null,ignoredPauses=0;
  const names={comparison:'Сравнение',before:'До',after:'После'};
  const timeLabel=value=>`${Math.floor(value/60)}:${String(Math.floor(value%60)).padStart(2,'0')}`;
  const bounded=(time,duration)=>Math.max(0,Math.min(time,Math.max(0,duration-.02)));
  const position=()=>pending?.time??video.currentTime??0;
  function bookmark(time=position()){
    const url=new URL(location.href);url.searchParams.set('format',current.aspect);url.searchParams.set('view',view);url.searchParams.set('t',String(Math.round(time*1000)/1000));
    // file:// previews may prohibit History API writes; playback still works.
    try{history.replaceState(null,'',url);}catch{}
  }
  function paintTime(time){
    let active=0;current.chapters.forEach((chapter,index)=>{if(time>=chapter.time)active=index;});
    [...chapters.children].forEach((button,index)=>{button.classList.toggle('current',index===active);if(index===active)button.setAttribute('aria-current','true');else button.removeAttribute('aria-current');});
    document.getElementById('clock').textContent=`${timeLabel(time)} / ${timeLabel(current.duration)}`;
  }
  function paintControls(){
    formats.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.aspect===current.aspect)));
    views.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===view)));
    speeds.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(+button.dataset.rate===rate)));
    document.getElementById('player-caption').textContent=`${names[view]} · ${current.aspect}`;
    document.getElementById('view-note').textContent=view==='comparison'?'«До» и «После» подписаны прямо в видео.':'Оригинальное видео на всю ширину плеера.';
    for(const key of ['before','after','comparison']){
      const link=document.getElementById(`download-${key}`);link.href=current[key];link.download=decodeURIComponent(current[key].split('/').at(-1));
    }
    const hashes=current.sourceHashes;
    document.getElementById('hash-before').textContent=hashes.before??'Не указан';
    document.getElementById('hash-after').textContent=hashes.after??'Не указан';
    document.getElementById('source-details').hidden=!hashes.before&&!hashes.after;
  }
  function paintChapters(){
    chapters.replaceChildren(...current.chapters.map((chapter,index)=>{
      const button=document.createElement('button');button.type='button';button.dataset.chapter=String(index);
      const time=document.createElement('span');time.className='chapter-time';time.textContent=timeLabel(chapter.time);
      const label=document.createElement('span');label.textContent=chapter.label;button.append(time,label);
      button.addEventListener('click',()=>{
        const target=bounded(chapter.time,current.duration);
        if(pending)pending.time=target;else video.currentTime=target;
        paintTime(target);bookmark(target);
      });return button;
    }));
  }
  function changeMedia(nextFormat,nextView){
    // Native video controls can also change speed. Read the actual player rate
    // before changing its source, even if ratechange has not fired yet.
    if(!pending&&Number.isFinite(video.playbackRate)&&video.playbackRate>0)rate=video.playbackRate;
    const state=pending?{time:pending.time,playing:pending.playing}:{time:video.currentTime||0,playing:!video.paused&&!video.ended};
    const id=++request;
    if(removeReady){removeReady();removeReady=null;}
    if(!video.paused){ignoredPauses++;video.pause();}
    current=nextFormat;view=nextView;pending={id,time:bounded(state.time,current.duration),playing:state.playing};
    paintControls();paintChapters();paintTime(pending.time);bookmark();status.textContent='Загрузка видео…';
    video.poster=view==='comparison'?current.poster:'';
    video.defaultPlaybackRate=rate;video.playbackRate=rate;
    const href=new URL(current[view],document.baseURI).href;
    const ready=()=>{
      if(id!==request||video.currentSrc!==href)return;
      const restore=pending;if(!restore||restore.id!==id)return;
      video.currentTime=bounded(restore.time,Number.isFinite(video.duration)?video.duration:current.duration);
      video.playbackRate=rate;pending=null;status.textContent='Готово к просмотру';paintTime(video.currentTime);
      if(restore.playing)video.play().catch(()=>{if(id===request)status.textContent='Нажмите ▶, чтобы продолжить';});
    };
    video.addEventListener('loadedmetadata',ready);removeReady=()=>video.removeEventListener('loadedmetadata',ready);
    video.src=current[view];video.load();
  }
  formats.addEventListener('click',event=>{const button=event.target.closest('button[data-aspect]');if(button&&button.dataset.aspect!==current.aspect)changeMedia(data.formats.find(format=>format.aspect===button.dataset.aspect),view);});
  views.addEventListener('click',event=>{const button=event.target.closest('button[data-view]');if(button&&button.dataset.view!==view)changeMedia(current,button.dataset.view);});
  speeds.addEventListener('click',event=>{const button=event.target.closest('button[data-rate]');if(button){rate=+button.dataset.rate;video.defaultPlaybackRate=rate;video.playbackRate=rate;paintControls();}});
  video.addEventListener('ratechange',()=>{if(!pending&&Number.isFinite(video.playbackRate)&&video.playbackRate>0){rate=video.playbackRate;paintControls();}});
  video.addEventListener('timeupdate',()=>{if(!pending)paintTime(video.currentTime);});
  video.addEventListener('play',()=>{if(pending)pending.playing=true;status.textContent='Воспроизведение';});
  video.addEventListener('pause',()=>{if(ignoredPauses){ignoredPauses--;return;}if(pending)pending.playing=false;status.textContent='Пауза';bookmark();});
  video.addEventListener('ended',()=>{status.textContent='Просмотр завершён';});
  video.addEventListener('error',()=>{status.textContent='Видео не загрузилось. Оригиналы доступны по ссылкам ниже.';});
  // Initial selection is always paused. Only an already playing user session
  // resumes after a format/view change; rapid changes retain the pending seek.
  changeMedia(current,view);
}

const CSS=`
:root{color-scheme:dark;--bg:#0b1118;--panel:#131d27;--border:#2c3946;--text:#f2f5f7;--muted:#a7b3bf;--accent:#c3f36b;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-synthesis:none}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text)}button,a,video{-webkit-tap-highlight-color:transparent}button{font:inherit;cursor:pointer}a{color:inherit;text-decoration:none}button:focus-visible,a:focus-visible,summary:focus-visible,video:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
main{max-width:1064px;margin:0 auto;padding:28px 24px 44px}.back{display:inline-flex;align-items:center;color:var(--muted);font-size:13px;margin-bottom:25px;min-height:24px}.back:hover{color:var(--text)}header{max-width:780px;margin-bottom:26px}.eyebrow{color:var(--accent);font-size:11px;font-weight:650;letter-spacing:.12em;text-transform:uppercase;margin:0 0 10px}h1{font-size:clamp(25px,4vw,38px);line-height:1.15;letter-spacing:-.035em;margin:0 0 12px;font-weight:650}header p{font-size:15px;line-height:1.55;color:var(--muted);margin:0;max-width:650px}
.toolbar{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:16px}.control-group{display:flex;align-items:center;gap:10px}.control-label{font-size:12px;color:var(--muted)}.segmented{display:flex;gap:3px;padding:4px;background:#101923;border:1px solid var(--border);border-radius:12px}.segmented button{border:0;background:transparent;color:var(--muted);border-radius:8px;padding:9px 14px;min-height:36px;font-size:13px;font-weight:600;white-space:nowrap}.segmented button:hover{background:#23303c;color:var(--text)}.segmented button[aria-pressed=true]{background:var(--accent);color:#14200b}.views{margin-bottom:14px;display:inline-flex}.views button{padding-inline:18px}
.player-panel{overflow:hidden;border:1px solid var(--border);border-radius:16px;background:#070c12}.player-top{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:13px 16px;border-bottom:1px solid var(--border);font-size:12px}.player-top span:first-child{font-weight:600}.player-top span:last-child{font-variant-numeric:tabular-nums;color:var(--muted)}video{display:block;width:100%;height:auto;max-height:74vh;background:#05090d;object-fit:contain}.under-player{display:flex;justify-content:space-between;gap:16px;padding:12px 2px 0;font-size:12px;line-height:1.5;color:var(--muted)}#player-status{white-space:nowrap}.help{color:var(--muted);font-size:13px;line-height:1.6;max-width:720px;margin:16px 0 26px}.section-label{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:600;margin:0 0 12px}.chapters{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.chapters button{display:flex;flex-direction:column;gap:5px;align-items:flex-start;text-align:left;padding:12px;background:var(--panel);border:1px solid var(--border);border-radius:10px;min-height:72px;color:var(--text);font-size:13px;line-height:1.35}.chapters button:hover{border-color:#637588}.chapters button.current{border-color:var(--accent);background:#1c2b27}.chapter-time{color:var(--muted);font-size:11px;font-variant-numeric:tabular-nums}.chapters button.current .chapter-time{color:var(--accent)}
.downloads{margin-top:28px;padding-top:22px;border-top:1px solid var(--border)}.download-links{display:flex;gap:10px;flex-wrap:wrap}.download-links a{display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--border);border-radius:9px;padding:11px 14px;min-height:42px;font-size:13px;background:var(--panel)}.download-links a:hover{border-color:#718395}.download-links a:last-child{color:var(--muted)}details{margin-top:26px;color:var(--muted);font-size:12px}summary{cursor:pointer;display:list-item;width:fit-content}dl{display:grid;grid-template-columns:42px 1fr;gap:8px;margin-top:14px}dt,dd{margin:0}code{font-size:11px;overflow-wrap:anywhere;word-break:break-all}noscript{display:block;margin-top:12px}
@media(max-width:650px){main{padding:20px 16px 32px}.back{margin-bottom:20px}header{margin-bottom:22px}header p{font-size:14px}.toolbar{gap:12px;align-items:flex-start}.control-group{gap:8px}.control-label{font-size:11px}.toolbar .control-label{display:none}.segmented button{padding:8px 12px}.views{width:100%;display:flex}.views button{flex:1;padding:9px 8px}.player-panel{border-radius:12px}.player-top{padding:11px 12px}video{max-height:70vh}.under-player{font-size:11px;gap:10px;align-items:flex-start}#player-status{white-space:normal;text-align:right}.help{font-size:12px;margin:14px 0 22px}.chapters{grid-template-columns:repeat(2,minmax(0,1fr))}.chapters button{min-height:72px}.download-links{display:grid;grid-template-columns:1fr 1fr}.download-links a{padding:11px 8px;font-size:12px}.download-links a:last-child{grid-column:1/-1}.downloads{margin-top:24px}}
@media(prefers-reduced-motion:no-preference){button,a{transition:background-color .12s,border-color .12s,color .12s}}
`;

export function buildMotionGallery({manifest,out}={}){
  const manifestFile=path.resolve(manifest),outFile=path.resolve(out??path.join(path.dirname(manifestFile),'index.html'));
  const {data,mediaCopies}=normalizeManifest(JSON.parse(fs.readFileSync(manifestFile,'utf8')),{manifestDirectory:path.dirname(manifestFile),outDirectory:path.dirname(outFile)});
  fs.mkdirSync(path.dirname(outFile),{recursive:true});
  for(const copy of mediaCopies){fs.mkdirSync(path.dirname(copy.to),{recursive:true});if(copy.from!==copy.to)fs.copyFileSync(copy.from,copy.to);}
  const initial=data.formats.find(format=>format.aspect===data.defaultAspect);
  const buttons=(items,attribute,selected)=>items.map(([value,label])=>`<button type="button" data-${attribute}="${escapeHtml(value)}" aria-pressed="${value===selected}">${escapeHtml(label)}</button>`).join('');
  const html=`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(data.title)} · Pure Kinetic</title><style>${CSS}</style></head><body><main>
<a class="back" href="../index.html">← Каталог: до и после</a>
<header><p class="eyebrow">Pure Kinetic · HyperFrames</p><h1>${escapeHtml(data.title)}</h1><p>${escapeHtml(data.description)}</p></header>
<div class="toolbar"><div class="control-group"><span class="control-label">Формат</span><div id="formats" class="segmented" role="group" aria-label="Формат видео">${buttons(data.formats.map(f=>[f.aspect,f.aspect]),'aspect',initial.aspect)}</div></div><div class="control-group"><span class="control-label">Скорость</span><div id="speeds" class="segmented" role="group" aria-label="Скорость воспроизведения">${buttons([['0.5','0,5×'],['1','1×']],'rate','1')}</div></div></div>
<div id="views" class="segmented views" role="group" aria-label="Вид видео">${buttons([['comparison','Сравнение'],['before','До'],['after','После']],'view','comparison')}</div>
<section class="player-panel" aria-label="Видео до и после"><div class="player-top"><span id="player-caption">Сравнение · ${escapeHtml(initial.aspect)}</span><span id="clock">0:00 / ${clock(initial.duration)}</span></div><video id="player" controls playsinline preload="metadata" poster="${escapeHtml(initial.poster)}" src="${escapeHtml(initial.comparison)}" aria-label="Выбранные сцены Pure Kinetic">Ваш браузер не поддерживает видео. Скачайте оригиналы ниже.</video></section>
<div class="under-player"><span id="view-note">«До» и «После» подписаны прямо в видео.</span><span id="player-status" role="status" aria-live="polite">Готово к просмотру</span></div>
<p class="help">Для мелких деталей переключитесь на «До» или «После». Скорость 0,5× помогает проверить движения. Звук включается только после запуска видео.</p>
<section aria-label="Главы видео"><h2 class="section-label">Выбранные сцены</h2><nav class="chapters" id="chapters" aria-label="Перейти к сцене"></nav></section>
<section class="downloads" aria-label="Скачать видео"><h2 class="section-label">Оригиналы в полном разрешении</h2><div class="download-links"><a id="download-before" href="${escapeHtml(initial.before)}" download>Скачать «До»</a><a id="download-after" href="${escapeHtml(initial.after)}" download>Скачать «После»</a><a id="download-comparison" href="${escapeHtml(initial.comparison)}" download>Скачать сравнение</a></div></section>
<details id="source-details"><summary>Исходники сравнения</summary><dl><dt>До</dt><dd><code id="hash-before"></code></dd><dt>После</dt><dd><code id="hash-after"></code></dd></dl></details>
<noscript>Видео и ссылки на скачивание доступны без JavaScript. Переключение форматов и глав требует JavaScript.</noscript>
</main><script type="application/json" id="motion-data">${embeddedJson(data)}</script><script>(${client.toString()})();</script></body></html>`;
  fs.writeFileSync(outFile,html);return {output:outFile,formats:data.formats.map(f=>f.aspect),sceneCount:data.sceneCount,mediaCopied:mediaCopies.length};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),option=name=>args.includes('--'+name)?args[args.indexOf('--'+name)+1]:undefined;
  if(!option('manifest'))throw new Error('Usage: node tools/surface-motion-gallery.mjs --manifest manifest.json [--out index.html]');
  console.log(JSON.stringify(buildMotionGallery({manifest:option('manifest'),out:option('out')}),null,2));
}
