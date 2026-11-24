// Actual native registry acceptance; no renderer replacement or layout allowances.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createNativeBrowser,sharp,SOURCE,sourceHashes} from './native-browser.mjs';
import {measureRenderedText,layoutFindings} from './quality-layout.mjs';
import {measureDesign,designFindings} from './design-audit.mjs';
const require=createRequire(import.meta.url),definitions=require('../source/lib/components/metadata.cjs'),F=require('../source/lib/film.cjs');
export const NAMES=['before-after-wipe','screen-flow-carousel','chart-story','testimonial-proof-card','modal-morph'];
const ASPECTS=['9:16','1:1','16:9'];
const BRANDS={dark:{name:'Registry',font:'Geist Mono',tokens:{background:'#101828',foreground:'#f7f7f2',accent:'#b9f24a',accent2:'#8ec7ff'}},light:{name:'Registry',font:'Archivo',tokens:{background:'#f5f1e8',foreground:'#182738',accent:'#1b6345',accent2:'#6742a5'}}};
const clone=structuredClone;
const phrase=(max,seed='Independent creative teams share clear decisions and better work')=>seed.repeat(Math.ceil(max/seed.length)+1).slice(0,max).replace(/\s+\S*$/,'').trim();
function longer(value,spec,key=''){
 if(!spec||value===undefined||['image','images','emphasis','unit'].includes(key))return value;
 if(spec.kind==='string')return phrase(spec.max);
 if(spec.kind==='array')return Array.from({length:spec.max??value.length},(_,i)=>longer(clone(value[i%value.length]),spec.of));
 if(spec.kind==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,longer(v,spec.fields[k],k)]));
 return value;
}
export function cases(){
 return ASPECTS.flatMap(aspect=>['normal','long'].flatMap(copy=>Object.keys(BRANDS).flatMap(brand=>NAMES.flatMap(type=>(type==='chart-story'?['bars','line','donut','progress']:[null]).map(mode=>{
  const d=definitions[type],scene={...clone(d.sample),in:'glide'};if(mode)scene.chart=mode;
  if(copy==='long')for(const[key,value]of Object.entries(scene))scene[key]=longer(value,d.fields[key],key);
  if(copy==='long'&&type==='testimonial-proof-card'){scene.quote='Our team can review every update together and finish each project with clear decisions. We spend less time searching and more time creating work we can share.';scene.emphasis='clear decisions';scene.company='Independent studio collective';scene.beats=9;}
  if(copy==='long'&&type==='chart-story'){scene.items.forEach((item,i)=>{item.value=[1200.5,24000,145000,690000.25,1000000][i];item.label=['Internationalization','Creative development','Customer experiences','Product architecture','International launch'][i];});scene.emphasize=scene.items.length;}
  if(type==='modal-morph')scene.register=copy==='long'?'snappy':'calm';
  if(copy==='long'&&d.fields.images)scene.images=Array.from({length:type==='before-after-wipe'?2:scene.screens.length},(_,i)=>`derived/registry-fixture-${i%2}.svg`);
  if(copy==='long'&&d.fields.image)scene.image='derived/registry-fixture-0.svg';
  return {id:[type,mode,aspect.replace(':','x'),copy,brand].filter(Boolean).join('-'),type,mode,aspect,copy,brand,scene};
 })))));
}
export function avatarCases(){
 return ASPECTS.flatMap(aspect=>Object.keys(BRANDS).flatMap(brand=>[['A','A'],['A V','AV'],['Я','Я'],['Я Ф','ЯФ']].map(([name,avatar])=>({
  id:`testimonial-proof-card-avatar-${avatar}-${aspect.replace(':','x')}-normal-${brand}`,
  type:'testimonial-proof-card',mode:null,aspect,copy:'normal',brand,avatar,
  scene:{...clone(definitions['testimonial-proof-card'].sample),in:'glide',name},
 }))));
}
export function strictFindings(texts,bounds,occlusion=[]){return [...layoutFindings(texts.map(t=>({...t,over:false})),bounds),...occlusion.filter(t=>t.blockedGlyphs).map(t=>({kind:'opaque-surface-occlusion',...t}))];}

// Shared measurement method, independently calibrated below for registry scenes.
export function measureTextOcclusion(root, texts, {blockerSelector} = {}) {
  const document = root.ownerDocument, window = document.defaultView;
  const nodes = new Map(), walker = document.createTreeWalker(root, window.NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode, id = root.__qualityTextIdentities?.nodes.get(node);
    if (id !== undefined) nodes.set(id, node);
  }
  const style = document.createElement('style');
  style.textContent = 'body,body *{pointer-events:auto!important}';document.head.append(style);
  const opacity = node => {
    let value = 1;
    for (let p = node; p; p = p.parentElement) value *= Number(window.getComputedStyle(p).opacity);
    return value;
  };
  const painted = new Map();
  function surface(node) {
    if (blockerSelector && !node.closest(blockerSelector)) return false;
    if (painted.has(node)) return painted.get(node);
    const computed = window.getComputedStyle(node), rgba = computed.backgroundColor.match(/[\d.]+/g)?.map(Number);
    const value = !!rgba && (rgba[3] ?? 1) * opacity(node) >= .75;
    painted.set(node, value);return value;
  }
  try {
    return texts.map(text => {
      const node = nodes.get(text.id), parent = node?.parentElement, blockers = new Map();
      if (!parent) throw new Error(`Missing measured text node: ${text.text}`);
      let glyphs = 0, blockedGlyphs = 0;
      for (let start = 0; start < node.length;) {
        const character = String.fromCodePoint(node.textContent.codePointAt(start)), end = start + character.length;
        if (!/\s/u.test(character)) {
          const range = document.createRange();range.setStart(node, start);range.setEnd(node, end);
          const box = range.getBoundingClientRect();
          if (box.width > .5 && box.height > .5) {
            glyphs++;let blocked = false;
            for (const fy of [.45, .6, .75]) {
              const x = box.left + box.width / 2, y = box.top + box.height * fy;
              const stack = document.elementsFromPoint(x, y), own = stack.indexOf(parent);
              // Clipping/out-of-frame points are handled by strict glyph geometry.
              if (own < 0) continue;
              const cover = stack.slice(0, own).find(candidate =>
                !candidate.contains(parent) && !parent.contains(candidate) && surface(candidate));
              if (cover) {
                blocked = true;
                const label = cover.getAttribute('data-document-id') ?? cover.getAttribute('data-category-id') ?? cover.id ?? cover.tagName;
                blockers.set(label, (blockers.get(label) ?? 0) + 1);
              }
            }
            if (blocked) blockedGlyphs++;
          }
        }
        start = end;
      }
      return {id: text.id, text: text.text, glyphs, blockedGlyphs,
        blockers: [...blockers].map(([id, points]) => ({id, points}))};
    });
  } finally {style.remove();}
}

const luminance=rgb=>rgb.map(v=>(v/=255)<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>{const[hi,lo]=[luminance(a),luminance(b)].sort((x,y)=>y-x);return(hi+.05)/(lo+.05);};
async function read(page,id){return page.evaluate(({id,measure,occlude})=>{
 const s=window.__pkScenes[id],root=s.sceneRoot,texts=(0,eval)(`(${measure})`)(root),nodes=new Map(),walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 while(walker.nextNode()){const n=walker.currentNode,key=root.__qualityTextIdentities?.nodes.get(n);if(key!==undefined)nodes.set(key,n);}
 for(const text of texts){const parent=nodes.get(text.id).parentElement;text.foreground=getComputedStyle(parent).color.match(/[\d.]+/g).map(Number);text.role=parent.closest('[data-registry-role]')?.dataset.registryRole??null;text.designRole=parent.closest('[data-design-role]')?.dataset.designRole??null;}
 const encode=n=>n.nodeType!==Node.ELEMENT_NODE?[n.nodeType,n.nodeValue]:[n.tagName,[...n.attributes].map(a=>[a.name,a.name==='style'?[...n.style].sort().map(k=>[k,n.style.getPropertyValue(k)]):a.value]).sort((a,b)=>a[0].localeCompare(b[0])),[...n.childNodes].map(encode)];
 const component=root.querySelector('[data-registry-item]');
 const brokenWords=[];
 if(component?.dataset.registryItem==='chart-story')for(const label of root.querySelectorAll('[data-registry-role="label"],[data-registry-role="callout-label"]')){
  const walk=document.createTreeWalker(label,NodeFilter.SHOW_TEXT);while(walk.nextNode())for(const match of walk.currentNode.textContent.matchAll(/\p{L}{3,}/gu)){
   const range=document.createRange();range.setStart(walk.currentNode,match.index);range.setEnd(walk.currentNode,match.index+match[0].length);
   const lines=[...range.getClientRects()].filter(r=>r.width>.5&&r.height>.5);if(new Set(lines.map(r=>Math.round(r.top))).size>1)brokenWords.push({label:label.textContent,word:match[0]});
  }
 }
 const lineCount=n=>{const range=document.createRange();range.selectNodeContents(n);return new Set([...range.getClientRects()].filter(r=>r.width>.5&&r.height>.5).map(r=>Math.round(r.top))).size;};
 const records=[...root.querySelectorAll('[data-registry-role],[data-registry-datum],[data-registry-length],[data-registry-screen],[data-morph-key]')].map(n=>{let opacity=1;for(let p=n;p;p=p.parentElement){const style=getComputedStyle(p);opacity*=Number(style.opacity);if(style.visibility==='hidden'||style.display==='none')opacity=0;}return {tag:n.tagName,text:n.textContent,attributes:Object.fromEntries([...n.attributes].map(a=>[a.name,a.value])),style:n.getAttribute('style'),cssWidth:parseFloat(getComputedStyle(n).width),background:n.dataset.registryRole==='avatar'?getComputedStyle(n).backgroundColor.match(/[\d.]+/g).map(Number):undefined,geometry:n instanceof SVGGeometryElement?{length:n.getTotalLength(),y:n.getBBox().y}:undefined,lineCount:/^(value|callout-value)$/.test(n.dataset.registryRole)?lineCount(n):undefined,opacity,box:{x:n.getBoundingClientRect().x,y:n.getBoundingClientRect().y,w:n.getBoundingClientRect().width,h:n.getBoundingClientRect().height}};});
 return {id,time:s.time,localTime:s.localTime,scene:s.ps.scene,brand:s.plan.brand,safe:s.context.safe,component:component?Object.fromEntries([...component.attributes].filter(a=>a.name.startsWith('data-')).map(a=>[a.name,a.value])):null,records,texts,brokenWords,occlusion:(0,eval)(`(${occlude})`)(root,texts),dom:JSON.stringify(encode(root)),images:[...root.querySelectorAll('img')].map(n=>({src:n.getAttribute('src'),complete:n.complete,width:n.naturalWidth})),allowances:[...root.querySelectorAll('[data-over]')].length};
 },{id,measure:measureRenderedText.toString(),occlude:measureTextOcclusion.toString()});}
async function measureContrast(page,texts){
 await page.evaluate(()=>{const style=document.createElement('style');style.id='registry-hide-paint';style.textContent='.pk-stage,.pk-stage *{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important}';document.head.append(style);});
 let pixels;try{pixels=await sharp(await page.screenshot({type:'png'})).removeAlpha().raw().toBuffer({resolveWithObject:true});}finally{await page.evaluate(()=>document.getElementById('registry-hide-paint').remove());}
 return texts.map(text=>{const ratios=[];for(const box of text.inkLines)for(const fx of [.2,.5,.8])for(const fy of [.25,.5,.75]){const x=Math.max(0,Math.min(pixels.info.width-1,Math.round(box.x+box.w*fx))),y=Math.max(0,Math.min(pixels.info.height-1,Math.round(box.y+box.h*fy))),at=(y*pixels.info.width+x)*pixels.info.channels,bg=[...pixels.data.subarray(at,at+3)],alpha=text.opacity*(text.foreground[3]??1);ratios.push(contrast(bg.map((v,i)=>v+(text.foreground[i]-v)*alpha),bg));}return {text:text.text,role:text.role,minimum:Math.min(...ratios)};});
}
async function avatarCenter(page,snapshot,assertCentered=true){
 const avatar=snapshot.records.find(n=>n.attributes['data-registry-role']==='avatar'),initials=snapshot.texts.find(n=>n.role==='initials');
 assert.ok(avatar&&initials,'Missing visible monogram');
 const pixels=await sharp(await page.screenshot({type:'png'})).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const {x,y,w,h}=avatar.box,cx=x+w/2,cy=y+h/2,points=[],background=avatar.background.slice(0,3),axis=background.map((value,i)=>initials.foreground[i]-value),norm=axis.reduce((sum,value)=>sum+value*value,0);
 for(let yy=Math.floor(y);yy<y+h;yy++)for(let xx=Math.floor(x);xx<x+w;xx++){
  if(Math.hypot(xx+.5-cx,yy+.5-cy)>Math.min(w,h)*.43)continue;
  const at=(yy*pixels.info.width+xx)*pixels.info.channels,rgb=[...pixels.data.subarray(at,at+3)];
  // Visible anti-aliased ink belongs to the glyph, including a thin apex.
  // The inner-circle crop excludes the avatar's translucent border.
  const coverage=rgb.reduce((sum,value,i)=>sum+(value-background[i])*axis[i],0)/norm;
  if(coverage>.25)points.push([xx+.5,yy+.5]);
 }
 assert.ok(points.length>15,'No raster initials paint');
 const left=Math.min(...points.map(p=>p[0])),right=Math.max(...points.map(p=>p[0])),top=Math.min(...points.map(p=>p[1])),bottom=Math.max(...points.map(p=>p[1]));
 const paintScale=w/avatar.cssWidth,measured={text:initials.text,avatar:avatar.box,ink:{left,right,top,bottom},paintScale,dx:Math.abs((left+right)/2-cx)/paintScale,dy:Math.abs((top+bottom)/2-cy)/paintScale,pixels:points.length};
 measured.vector=await page.evaluate(id=>{
  const avatar=window.__pkScenes[id].sceneRoot.querySelector('[data-registry-role=avatar]'),node=avatar.querySelector('[data-registry-role=initials]');
  const a=avatar.getBoundingClientRect(),n=node.getBoundingClientRect(),style=getComputedStyle(node),aStyle=getComputedStyle(avatar);
  const sx=a.width/parseFloat(aStyle.width),sy=a.height/parseFloat(aStyle.height),ctx=document.createElement('canvas').getContext('2d');
  ctx.font=`${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;ctx.fontKerning=style.fontKerning;ctx.fontStretch='normal';
  const ink=ctx.measureText(node.textContent),marker=document.createElement('span');marker.style.cssText='display:inline-block;width:0;height:0;padding:0;margin:0;vertical-align:baseline';node.append(marker);
  try{return {dx:Math.abs(n.x+(ink.actualBoundingBoxRight-ink.actualBoundingBoxLeft)*sx/2-a.x-a.width/2)/sx,
    dy:Math.abs(marker.getBoundingClientRect().top+(ink.actualBoundingBoxDescent-ink.actualBoundingBoxAscent)*sy/2-a.y-a.height/2)/sy};}finally{marker.remove();}
 },snapshot.id);
 // Outlines and DOM baseline give subpixel geometric centering. Raster edges
 // are sampled at pixel centers; allow half a physical pixel of quantization
 // in addition to one logical pixel of antialias/hinting variation.
 measured.rasterTolerance=1+.5/paintScale;
 if(assertCentered){assert.ok(measured.vector.dx<=.03&&measured.vector.dy<=.03,JSON.stringify(measured));assert.ok(measured.dx<=measured.rasterTolerance&&measured.dy<=measured.rasterTolerance,JSON.stringify(measured));}return measured;
}
async function avatarNegativeControl(page,id){
 const left=await page.evaluate(id=>{const n=window.__pkScenes[id].sceneRoot.querySelector('[data-registry-role="initials"]'),left=n.style.left;n.style.left=`calc(${left} + 3px)`;return left;},id);
 try{const shifted=await avatarCenter(page,await read(page,id),false);assert.ok(shifted.dx>=2,'Visible-ink classifier missed a real 3px shift');return shifted;}
 finally{await page.evaluate(({id,left})=>{window.__pkScenes[id].sceneRoot.querySelector('[data-registry-role="initials"]').style.left=left;},{id,left});}
}
function media(project){
 fs.mkdirSync(path.join(project,'derived'),{recursive:true});
 for(let i=0;i<2;i++)fs.writeFileSync(path.join(project,`derived/registry-fixture-${i}.svg`),`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480"><rect width="640" height="480" fill="${i?'#182f55':'#dfecc9'}"/><circle cx="${i?400:180}" cy="220" r="125" fill="${i?'#ebbd63':'#27664d'}"/><path d="M55 390H585M55 425H460" stroke="${i?'#ffffff':'#182738'}" stroke-width="15"/></svg>`);
}
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll("'",'&#39;').replaceAll('"','&quot;').replaceAll('<','&lt;');
const unescape=s=>s.replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&lt;','<').replaceAll('&amp;','&');
function changeBrands(project,brand){
 const file=path.join(project,'index.html');let html=fs.readFileSync(file,'utf8');
 html=html.replace(/(<div id="s\d+"[^>]*data-variable-values=')([^']*)(')/g,(_,a,value,z)=>{const data=JSON.parse(unescape(value)),id=+(a.match(/id="s(\d+)"/)[1]);if(id>=3&&id%2===1){data.brand=JSON.stringify(BRANDS[brand==='dark'?'light':'dark']);const style=JSON.parse(data.style),tokens=BRANDS[brand==='dark'?'light':'dark'].tokens;data.style=JSON.stringify({...style,bg:tokens.background,fg:tokens.foreground,accent:tokens.accent});}return a+escape(JSON.stringify(data))+z;});
 fs.writeFileSync(file,html);
}
async function independence(page,first,second){return page.evaluate(({first,second})=>{
 const a=window.__pkScenes[first],b=window.__pkScenes[second],state=s=>JSON.stringify([s.localTime,s.sceneRoot.outerHTML]);
 const t=id=>window.__timelines[id];t(first).seek(a.clipDuration*.4,false);t(second).seek(b.clipDuration*.7,false);const beforeA=state(a),beforeB=state(b);
 t(second).seek(b.clipDuration*.9,false);const firstUnchanged=state(a)===beforeA;t(second).seek(b.clipDuration*.7,false);const secondRestored=state(b)===beforeB;
 t(first).seek(a.clipDuration*.85,false);const secondUnchanged=state(b)===beforeB;t(first).seek(a.clipDuration*.4,false);const firstRestored=state(a)===beforeA;
 const host=id=>document.querySelector(`[data-composition-id="${id}"]`),src=id=>host(id).dataset.compositionFile??host(id).dataset.compositionSrc,ids=[...a.sceneRoot.querySelectorAll('[id]'),...b.sceneRoot.querySelectorAll('[id]')].map(n=>n.id);
 const renderedFont=s=>getComputedStyle(s.sceneRoot.querySelector('[data-registry-role="title"],[data-registry-role="quote"]')).fontFamily;
 return {sameDefinition:src(first)===src(second),firstUnchanged,secondUnchanged,firstRestored,secondRestored,privateIds:ids.length===new Set(ids).size,firstFont:a.plan.brand.font,secondFont:b.plan.brand.font,firstRenderedFont:renderedFont(a),secondRenderedFont:renderedFont(b),distinctContent:JSON.stringify(a.ps.scene)!==JSON.stringify(b.ps.scene)};
 },{first,second});}
function alternate(scene){const s=clone(scene);for(const key of ['title','before','name'])if(typeof s[key]==='string'){s[key]='Other view';return s;}if(s.screens)s.screens[0].label='Other screen';else if(s.items)s.items[0].label='Other item';return s;}
function exactCues(plan,ps,scene){const expected=[];definitions[scene.type].sounds(scene,ps.ldur,(at,kind,strength)=>expected.push({time:ps.start+at/ps.speed,kind,strength}),plan.beat*ps.speed);const actual=plan.audioEvents.filter(x=>x.scene===ps.index&&x.t>ps.start+1e-8);assert.equal(actual.length,expected.length,'Unexpected or missing semantic audio event');for(const cue of expected)assert.ok(actual.some(x=>x.kind===cue.kind&&Math.abs(x.t-cue.time)<1e-7&&x.strength===cue.strength),'Missing exact semantic audio cue');return expected;}
function semanticProof(row,scene,snapshot){
 assert.ok(snapshot.component,'Missing native registry root marker');assert.equal(snapshot.component['data-registry-item'],scene.type);assert.equal(snapshot.allowances,0,'Registry labels may not opt out of overlap checks');
 assert.deepEqual(snapshot.scene,scene,'Native input changed');
 assert.ok(snapshot.texts.every(text=>text.font.includes(BRANDS[row.brand].font)),'Requested brand font did not reach rendered text');
 const role=name=>snapshot.records.filter(n=>n.attributes['data-registry-role']===name);
 const exact=(name,copy)=>{const matches=role(name).filter(n=>n.text===copy&&n.opacity>.98);assert.ok(matches.length,`Missing visible exact ${name}: ${copy}`);return matches[0];};
 if(scene.title)exact('title',scene.title);
 if(scene.type==='before-after-wipe'){
  assert.equal(+snapshot.component['data-registry-progress'],1);assert.equal(+snapshot.component['data-registry-split'],scene.split??50);
  exact('before-label',scene.before);exact('after-label',scene.after);
  assert.ok(role('after')[0].style.includes(`inset(0px ${100-(scene.split??50)}% 0px 0px)`));
  assert.ok(role('divider')[0].style.includes(`left: ${scene.split??50}%`));
 }
 if(scene.type==='screen-flow-carousel'){
  assert.equal(+snapshot.component['data-registry-active-screen'],scene.screens.length-1);
  assert.equal(+snapshot.component['data-registry-position'],scene.screens.length-1);
  assert.equal(role('screen').filter(n=>n.attributes['data-registry-active']==='true').length,1);
  exact('caption',scene.screens.at(-1).label);
 }
 if(scene.type==='modal-morph'){
  assert.equal(snapshot.component['data-registry-phase'],'panel');assert.equal(+snapshot.component['data-registry-progress'],1);
  assert.equal(snapshot.component['data-registry-body-visible'],'true');exact('body',scene.body);exact('cta',scene.cta);if(scene.eyebrow)exact('eyebrow',scene.eyebrow);
  for(const key of ['title','body','cta','dot','action'])assert.equal(snapshot.records.filter(n=>n.attributes['data-morph-key']===key).length,1,'Persistent modal '+key);
  const from=JSON.parse(snapshot.component['data-registry-from']),to=JSON.parse(snapshot.component['data-registry-to']);assert.ok(to.w>=from.w&&to.h>from.h,'Modal must grow into a panel');
 }
 if(scene.type==='testimonial-proof-card'){
  const quote=exact('quote',scene.quote);assert.equal(quote.attributes['aria-label'],scene.quote);
  assert.ok(+snapshot.component['data-registry-lines']>0);assert.equal(+snapshot.component['data-registry-progress'],1);
  exact('author',scene.name);if(scene.role)exact('role',scene.role);if(scene.company)exact('company',scene.company);
  if(scene.emphasis)assert.equal(+snapshot.component['data-registry-underline'],1);
 }
 if(scene.type==='chart-story'){
  assert.deepEqual(snapshot.brokenWords,[],'Natural chart label words must not fracture across lines');row.brokenWords=snapshot.brokenWords;
  assert.equal(snapshot.component['data-registry-mode'],scene.chart??'bars');
  assert.equal(snapshot.component['data-registry-settled'],'true');assert.equal(+snapshot.component['data-registry-progress'],1);
  assert.deepEqual(JSON.parse(snapshot.component['data-registry-values']),scene.items.map(item=>item.value));
  const data=snapshot.records.filter(x=>x.attributes['data-registry-datum']);assert.equal(data.length,scene.items.length);
  const maximum=Math.max(...scene.items.map(item=>item.value))||1,total=scene.items.reduce((sum,item)=>sum+item.value,0),denominator=scene.chart==='donut'?total:scene.chart==='progress'&&scene.unit?.trim()==='%'?Math.max(100,maximum):maximum;
  for(const node of data){const i=+node.attributes['data-registry-datum']-1;assert.equal(+node.attributes['data-registry-target-value'],scene.items[i].value);assert.equal(+node.attributes['data-registry-progress'],1);assert.ok(Math.abs(+node.attributes['data-registry-fraction']-scene.items[i].value/denominator)<1e-9);}
  // Check painted SVG geometry against the data, independently of audit attributes.
  const near=(actual,wanted)=>assert.ok(Math.abs(actual-wanted)<.002,`${actual} != ${wanted}`),fractions=scene.items.map(item=>item.value/denominator);
  if((scene.chart??'bars')==='bars'){const height=Math.max(...data.map(n=>+n.attributes.height))||1;data.forEach((n,i)=>near(+n.attributes.height/height,fractions[i]));}
  if(scene.chart==='progress')data.forEach((n,i)=>near(+n.attributes.width/snapshot.safe.w,fractions[i]));
  if(scene.chart==='donut'){const length=data.reduce((sum,n)=>sum+n.geometry.length,0);data.forEach((n,i)=>{near(n.geometry.length/length,fractions[i]);near(+n.attributes['stroke-dashoffset'],0);});}
  if(scene.chart==='line'){const baseline=snapshot.records.find(n=>n.attributes['data-registry-length']).geometry.y,span=baseline-Math.min(...data.map(n=>+n.attributes.cy));data.forEach((n,i)=>{near(span?(baseline-n.attributes.cy)/span:0,fractions[i]);assert.ok(+n.attributes.r>0);assert.ok(Math.abs(n.box.w-n.box.h)<.1,'Line data markers must remain circles across formats');});}
  for(const item of scene.items){exact('label',item.label);exact('value',String(item.value)+(scene.unit??''));}
  assert.ok([...role('value'),...role('callout-value')].every(node=>node.lineCount===1),'Exact chart value and unit must fit on one line');
  const chosen=scene.items[(scene.emphasize??scene.items.length)-1];exact(scene.chart==='progress'||snapshot.component['data-registry-callout-placement']==='ledger'?'value':'callout-value',String(chosen.value)+(scene.unit??''));
  if(snapshot.component['data-registry-callout-placement']==='ledger')exact('callout',String(chosen.value)+(scene.unit??''));
  if(role('callout-label').length)exact('callout-label',chosen.label);
 }
 if(scene.images||scene.image){assert.ok(snapshot.images.length>0,'Supplied media was not mounted');assert.ok(snapshot.images.every(x=>x.complete&&x.width>0),'Supplied media did not decode');}
 row.semantic=true;
}
function checkpoints(scene,ps){
 const t=definitions[scene.type].times(scene,ps.ldur),checks=[];
 const at=(local,kind,detail={})=>checks.push({local,kind,...detail});
 if(scene.type==='before-after-wipe'){at(t.wipe+.005,'wipe-start');at(t.land+.015,'wipe-land');}
 if(scene.type==='screen-flow-carousel'){at(t.enter+.015,'screen-land',{index:0});t.starts.forEach((start,i)=>{at(start+.1*t.advance,'screen-advance',{index:i+1});at(start+t.advance+.015,'screen-land',{index:i+1});});}
 if(scene.type==='modal-morph'){at(t.expand-.015,'modal-card');at(t.expand+t.morph*.5,'modal-morph');at(t.expand+t.morph+.015,'modal-panel');}
 if(scene.type==='testimonial-proof-card'){at(t.byline+t.bylineDuration+.015,'byline-land');at(t.draw+t.drawDuration+.015,'underline-land');}
 if(scene.type==='chart-story'){t.items.forEach((item,i)=>at(item.end+.015,'datum-land',{index:i+1}));at(t.callout+t.rollDuration+.015,'callout-land');}
 return checks.filter(check=>check.local>0&&check.local<ps.ldur*.96);
}
function checkpointProof(scene,check,snapshot){
 const data=snapshot.component,role=name=>snapshot.records.filter(n=>n.attributes['data-registry-role']===name);
 if(check.kind==='wipe-start')assert.ok(+data['data-registry-progress']<.001);
 if(check.kind==='wipe-land')assert.equal(+data['data-registry-split'],scene.split??50);
 if(check.kind.startsWith('screen-')){
  assert.equal(+data['data-registry-active-screen'],check.index);
  if(check.kind==='screen-land'){assert.equal(+data['data-registry-position'],check.index);const captions=role('caption').filter(n=>n.opacity>.98);assert.equal(captions.length,1);assert.equal(captions[0].text,scene.screens[check.index].label);}
  else assert.equal(data['data-registry-phase'],'advance');
 }
 if(check.kind.startsWith('modal-'))assert.equal(data['data-registry-phase'],check.kind.slice(6)==='card'?'card':check.kind.slice(6)==='panel'?'panel':'morph');
 if(check.kind==='byline-land')assert.ok(role('author').some(n=>n.opacity>.98&&n.text===scene.name));
 if(check.kind==='underline-land')assert.equal(+data['data-registry-underline'],1);
 if(check.kind==='datum-land'){const node=snapshot.records.find(n=>+n.attributes['data-registry-datum']===check.index);assert.equal(+node.attributes['data-registry-progress'],1);}
 if(check.kind==='callout-land'){assert.equal(data['data-registry-settled'],'true');const selected=scene.items[(scene.emphasize??scene.items.length)-1];assert.ok([String(selected.value)+(scene.unit??''),String(selected.value)+(scene.unit??'')+selected.label].includes(role('callout')[0].text));}
}
async function calibrate(page){
 await page.evaluate(()=>{const root=document.createElement('div');root.id='registry-calibration';root.className='pk-stage';root.style.cssText='position:absolute;left:100px;top:200px;width:700px;height:220px;z-index:999999;background:white;font:48px Arial;color:#111';const text=document.createElement('div');text.textContent='Visible calibrated text';text.style.cssText='position:absolute;left:20px;top:30px';root.append(text);document.body.append(root);});
 const measure=()=>page.evaluate(({measure,occlude})=>{const root=document.getElementById('registry-calibration'),texts=(0,eval)(`(${measure})`)(root);return {texts,occlusion:(0,eval)(`(${occlude})`)(root,texts)};},{measure:measureRenderedText.toString(),occlude:measureTextOcclusion.toString()});
 const initial=await measure();assert.ok(initial.texts.length&&initial.occlusion.every(t=>t.blockedGlyphs===0));
 await page.evaluate(()=>{const root=document.getElementById('registry-calibration'),cover=document.createElement('div');cover.id='registry-calibration-cover';cover.style.cssText='position:absolute;left:20px;top:30px;width:600px;height:70px;z-index:20;background:#aaa;pointer-events:none';root.append(cover);});
 const blocked=await measure();assert.ok(blocked.occlusion.some(t=>t.blockedGlyphs>0),'Opaque pointer-events:none cover escaped detection');
 await page.evaluate(()=>{document.getElementById('registry-calibration-cover').remove();const root=document.getElementById('registry-calibration'),t=root.firstElementChild.cloneNode(true);t.textContent='Colliding calibrated text';t.setAttribute('data-layout-allow-overlap','');t.setAttribute('data-over','');root.append(t);});
 const collision=await measure(),bounds={width:1920,height:1920,floor:36,safe:{left:0,top:0,right:1920,bottom:1920}};assert.ok(strictFindings(collision.texts,bounds).some(f=>f.kind==='label-overlap'));
 await page.evaluate(()=>{const root=document.getElementById('registry-calibration');root.lastElementChild.remove();root.style.background='rgb(120,120,120)';root.firstElementChild.style.color='rgb(119,119,119)';});
 const low=await measure(),paint=await measureContrast(page,low.texts.map(t=>({...t,foreground:[119,119,119]})));assert.ok(paint.length&&paint.every(t=>t.minimum<3),'Actual low-contrast text escaped pixel measurement');
 await page.evaluate(()=>document.getElementById('registry-calibration').remove());
 return {opaqueCoverDetected:true,overlapAllowanceRejected:true,lowContrastRejected:true,negativeContrast:paint};
}
async function main(){
 const args=process.argv.slice(2),option=(key,fallback)=>args.includes('--'+key)?args[args.indexOf('--'+key)+1]:fallback;
 const all=args.includes('--avatars')?avatarCases():cases(),selection=option('cases',''),jobs=selection?all.filter(j=>new RegExp(selection).test(j.id)):all;
 if(args.includes('--list')){console.log(JSON.stringify(jobs));return;}
 assert.ok(jobs.length,'No registry cases matched the requested filter');
 const out=path.resolve(option('out','/tmp/pk-registry-01-qa'));if(fs.existsSync(out))throw new Error('Use a fresh output directory: '+out);fs.mkdirSync(out,{recursive:true});
 const results=[],receipt=sourceHashes(),warnings=new Map(),report={schema:'pure-kinetic.registry-native.v1',sourceReceipt:receipt,total:jobs.length,results};
 const productionWarnings=()=>[...warnings.values()].filter(w=>[w.location,...w.stack].some(frame=>/\/scenes\/registry-[^/]+\.mjs(?:[?#]|$)/.test(frame.url??'')));
 const write=()=>{report.completed=results.length;report.failedCases=results.filter(r=>!r.passed).length;report.consoleWarnings=[...warnings.values()];report.registryWarnings=productionWarnings();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');};
 const browser=await createNativeBrowser(),page=await browser.newPage();media(page.project);
 page.on('console',message=>{if(!['warn','error'].includes(message.type()))return;const warning={type:message.type(),text:message.text(),location:message.location(),stack:message.stackTrace()},key=JSON.stringify(warning);if(warnings.has(key))warnings.get(key).count++;else warnings.set(key,{...warning,count:1});});
 try{
  for(const aspect of ASPECTS)for(const copy of ['normal','long'])for(const brand of Object.keys(BRANDS)){
   const group=jobs.filter(j=>j.aspect===aspect&&j.copy===copy&&j.brand===brand);if(!group.length)continue;
   const scenes=[{type:'title',beats:3,text:'Registry components',in:'glide'},...group.flatMap(job=>[job.scene,alternate(job.scene)]),{type:'endcard',beats:3,cta:'Build your next idea',in:'glide'}],film={aspect,style:'editorial',brand:BRANDS[brand],grain:false,sparks:false,scenes};
   assert.deepEqual(F.problems(film),[],'Fixture contract');const {plan}=await page.play(film,{transformProject:p=>changeBrands(p,brand)}),m=plan.safe;
   if(!report.calibration)report.calibration=await calibrate(page);
   const bounds={width:plan.width,height:plan.height,floor:plan.type.label,safe:{left:plan.width*m.left,top:plan.height*m.top,right:plan.width*(1-m.right),bottom:plan.height*(1-m.bottom)}};
   for(let index=0;index<group.length;index++){
    const job=group[index],scene=job.scene,ps=plan.scenes[index*2+1],id='s'+(index*2+2),row={...job,errors:[],samples:[]};
    try{
     row.audio=exactCues(plan,ps,scene);const fractions=[.12,.24,.36,.48,.6,.72,.84,.92];
     for(const fraction of fractions){await page.shoot(ps.start+ps.dur*fraction);const snapshot=await read(page,id),findings=strictFindings(snapshot.texts,bounds,snapshot.occlusion);row.samples.push({fraction,texts:snapshot.texts,component:snapshot.component,findings});assert.deepEqual(findings,[],JSON.stringify(findings));}
     row.checkpoints=[];
     for(const check of checkpoints(scene,ps)){await page.shoot(ps.start+check.local/ps.speed);const snapshot=await read(page,id),findings=strictFindings(snapshot.texts,bounds,snapshot.occlusion);assert.deepEqual(findings,[],JSON.stringify({check,findings}));checkpointProof(scene,check,snapshot);row.checkpoints.push({...check,component:snapshot.component,texts:snapshot.texts,findings});}
     await page.shoot(ps.start+ps.dur*.88);const before=await read(page,id);assert.ok(before.texts.length,'No readable content at payoff');semanticProof(row,scene,before);
     if(scene.type==='testimonial-proof-card'&&!scene.image){row.avatarCenter=await avatarCenter(page,before);if(job.avatar)assert.equal(row.avatarCenter.text,job.avatar);if(!report.calibration.avatarShiftDetected){report.calibration.avatarShift=await avatarNegativeControl(page,id);report.calibration.avatarShiftDetected=true;}}
     row.design=await page.evaluate(({id,measure})=>(0,eval)(`(${measure})`)(window.__pkScenes[id].sceneRoot),{id,measure:measureDesign.toString()});
     const designUnit=Math.max(3*Math.min(plan.width,plan.height)/1080,plan.type.label/12);
     row.designFindings=designFindings(row.design,designUnit);assert.deepEqual(row.designFindings,[],'Design contract');assert.ok(before.texts.every(t=>t.designRole),'All visible copy must have a semantic typography role');
     for(const heading of row.design.typography.filter(t=>t.role==='sceneTitle'))assert.ok(heading.anchor&&Math.abs(heading.anchor.x-before.safe.x)<1&&Math.abs(heading.anchor.y-before.safe.y)<1,'Scene headings must share the safe-area anchor');
     if(scene.type==='modal-morph'&&!report.calibration.typeDriftDetected){
      const original=await page.evaluate(id=>{const node=window.__pkScenes[id].sceneRoot.querySelector('[data-design-role=button]'),original=node.style.fontSize;node.style.fontSize=`${parseFloat(original)+3}px`;return original;},id);
      try{const changed=await page.evaluate(({id,measure})=>(0,eval)(`(${measure})`)(window.__pkScenes[id].sceneRoot),{id,measure:measureDesign.toString()});assert.ok(designFindings(changed,designUnit).some(f=>f.kind==='type-token-drift'));report.calibration.typeDriftDetected=true;}finally{await page.evaluate(({id,original})=>window.__pkScenes[id].sceneRoot.querySelector('[data-design-role=button]').style.fontSize=original,{id,original});}
      const left=await page.evaluate(id=>{const node=window.__pkScenes[id].sceneRoot.querySelector('[data-design-role=button]'),value=node.style.left;node.style.left=`${parseFloat(value)+3}px`;return value;},id);
      try{const shifted=await page.evaluate(({id,measure})=>(0,eval)(`(${measure})`)(window.__pkScenes[id].sceneRoot),{id,measure:measureDesign.toString()});assert.ok(designFindings(shifted,designUnit).some(f=>f.kind==='control-spacing-drift'));report.calibration.spacingDriftDetected=true;}finally{await page.evaluate(({id,left})=>window.__pkScenes[id].sceneRoot.querySelector('[data-design-role=button]').style.left=left,{id,left});}
     }
     row.contrast=await measureContrast(page,before.texts);assert.ok(row.contrast.every(t=>t.minimum>=3),JSON.stringify(row.contrast.filter(t=>t.minimum<3)));
     await sharp(await page.screenshot({type:'png'})).resize({width:640,height:640,fit:'inside'}).png().toFile(path.join(out,job.id+'.png'));
     await page.shoot(ps.start+ps.dur*.96);await page.shoot(ps.start+ps.dur*.15);await page.shoot(ps.start+ps.dur*.88);const after=await read(page,id);assert.equal(after.dom,before.dom,'Reverse DOM');assert.deepEqual(after.texts,before.texts,'Reverse text metrics');row.reverseExact=true;
     row.independence=await independence(page,id,'s'+(index*2+3));for(const key of ['sameDefinition','firstUnchanged','secondUnchanged','firstRestored','secondRestored','privateIds','distinctContent'])assert.equal(row.independence[key],true,key);assert.notEqual(row.independence.firstFont,row.independence.secondFont);
     assert.ok(row.independence.firstRenderedFont.includes(row.independence.firstFont));assert.ok(row.independence.secondRenderedFont.includes(row.independence.secondFont));
     assert.deepEqual(page.errors,[]);assert.deepEqual(page.externalRequests,[]);assert.deepEqual(productionWarnings(),[],'Registry production console warnings');row.minimumRendered=Math.min(...row.samples.flatMap(s=>s.texts.map(t=>t.renderedSize)));row.passed=true;
    }catch(error){row.errors.push(String(error.stack??error));row.passed=false;try{await sharp(await page.screenshot({type:'png'})).png().toFile(path.join(out,job.id+'-failure.png'));}catch{}}
    results.push(row);write();console.log(job.id,row.passed?'pass':row.errors[0]);
   }
  }
 }catch(error){report.error=String(error.stack??error);process.exitCode=1;}finally{await browser.close();}
 report.sourceAfter=sourceHashes();report.sourceStable=report.sourceAfter.aggregate===receipt.aggregate;report.passed=!report.error&&report.sourceStable&&results.length===jobs.length&&results.every(r=>r.passed);write();if(!report.passed)process.exitCode=1;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
