// Full-catalog native acceptance and reproducible visual index. Each screenshot
// comes from the actual HyperFrames renderer, never a replacement scene clock.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createNativeBrowser,sharp,sourceHashes,SOURCE} from './migration-browser.mjs';
import catalog from '../source/lib/components/catalog.mjs';
import {samples,maximumScene,measureRenderedText,layoutFindings,persistentFindings} from './quality-layout.mjs';
import {measureDesign,designFindings} from './design-audit.mjs';
import {RADIX_TOKENS,ROLE_STEPS} from '../source/lib/components/design-system.mjs';
import {rasterSurfaceFindings,surfaceFindings} from './surface-audit.mjs';
import {ellipsisIssues,ellipsisViewportText,ellipsisFindings} from './text-overflow-audit.mjs';
export {ellipsisIssues,ellipsisViewportText,ellipsisFindings} from './text-overflow-audit.mjs';

export const FORMATS=['9:16','1:1','16:9'];
const surfaceScope=JSON.parse(fs.readFileSync(new URL('./surface-scope.json',import.meta.url),'utf8'));
export const expectsSurface=job=>[...surfaceScope.direct,...surfaceScope.sharedUi].includes(job.type)&&
  (job.type!=='caption'||/\[[^\]]+\]/.test(job.scene.text)||Boolean(job.scene.image));
export function anchorFindings(anchors,{width,height}){
  return anchors.filter(r=>r.x< -1||r.y< -1||r.x+r.w>width+1||r.y+r.h>height+1)
    .map(r=>({kind:'structural-geometry-outside-frame',id:r.id,...r}));
}
// Only these genuine single-line inputs scroll earlier characters away. Keep
// font/token checks, and check the painted intersections instead of offscreen
// logical text. Its per-key gate separately requires the new glyph and caret
// to be visible; the viewport itself remains a structural boundary check.
export function typingViewportText(text){
  if(!['browser-url','ui-macro.typeText'].includes(text.typingViewport))return text;
  return {...text,seen:1,inkLines:text.paintedLines.filter(r=>r.w>0&&r.h>0)};
}
// Serialized into the native page; do not depend on module-scope helpers.
export function measureEllipsisViewport(root,host){
  if(!host)return null;
  const rectangle=r=>({x:r.left,y:r.top,w:r.width,h:r.height}),viewport=rectangle(host.getBoundingClientRect());
  const frame=root.getBoundingClientRect();let clip={l:frame.left,t:frame.top,r:frame.right,b:frame.bottom};
  // Start at the full label, not the stage: this second intersection isolates
  // internal clipping while preserving animated translations and rotations.
  let ancestorClip={l:viewport.x,t:viewport.y,r:viewport.x+viewport.w,b:viewport.y+viewport.h};
  for(let p=host.parentElement;p&&p!==root;p=p.parentElement){
    const s=getComputedStyle(p),r=p.getBoundingClientRect();
    for(const target of [clip,ancestorClip]){
      if(s.overflowX!=='visible'){target.l=Math.max(target.l,r.left);target.r=Math.min(target.r,r.right);}
      if(s.overflowY!=='visible'){target.t=Math.max(target.t,r.top);target.b=Math.min(target.b,r.bottom);}
    }
    const inset=/^inset\(([^)]+)\)$/.exec(s.clipPath);
    if(inset){
      const parts=inset[1].split(/\s+round\s+/)[0].trim().split(/\s+/);
      const v=[parts[0],parts[1]??parts[0],parts[2]??parts[0],parts[3]??parts[1]??parts[0]];
      const length=(value,dimension,logical)=>parseFloat(value)*(value.endsWith('%')?dimension/100:dimension/logical);
      for(const target of [clip,ancestorClip]){
        target.l=Math.max(target.l,r.left+length(v[3],r.width,p.offsetWidth||r.width));
        target.t=Math.max(target.t,r.top+length(v[0],r.height,p.offsetHeight||r.height));
        target.r=Math.min(target.r,r.right-length(v[1],r.width,p.offsetWidth||r.width));
        target.b=Math.min(target.b,r.bottom-length(v[2],r.height,p.offsetHeight||r.height));
      }
    }
  }
  const restore=[];
  try{
    // Rotation can turn one line into a tall physical rectangle. Measure its
    // line count locally, then restore every authored/animated style verbatim.
    for(let p=host;p;p=p.parentElement){
      restore.push([p,p.getAttribute('style')]);
      for(const name of ['transform','translate','rotate','scale'])p.style.setProperty(name,'none','important');
    }
    const s=getComputedStyle(host),lines=[],walker=document.createTreeWalker(host,NodeFilter.SHOW_TEXT);
    while(walker.nextNode()){
      if(!walker.currentNode.textContent.trim())continue;
      const range=document.createRange();range.selectNodeContents(walker.currentNode);
      for(const r of range.getClientRects())if(r.width>.5&&r.height>.5&&!lines.some(y=>Math.abs(y-r.y)<1))lines.push(r.y);
    }
    return {marker:host.dataset.designOverflow,whiteSpace:s.whiteSpace,textOverflow:s.textOverflow,
      overflowX:s.overflowX,display:s.display,lineCount:lines.length,lineHeight:parseFloat(s.lineHeight),
      clientWidth:host.clientWidth,clientHeight:host.clientHeight,scrollWidth:host.scrollWidth,scrollHeight:host.scrollHeight,
      paddingY:(parseFloat(s.paddingTop)||0)+(parseFloat(s.paddingBottom)||0),viewport,frame:rectangle(frame),
      ancestorClip:{x:ancestorClip.l,y:ancestorClip.t,w:Math.max(0,ancestorClip.r-ancestorClip.l),h:Math.max(0,ancestorClip.b-ancestorClip.t)},
      enclosingClip:{x:clip.l,y:clip.t,w:Math.max(0,clip.r-clip.l),h:Math.max(0,clip.b-clip.t)}};
  }finally{
    for(const [node,style] of restore)if(style===null)node.removeAttribute('style');else node.setAttribute('style',style);
  }
}
// These mechanisms deliberately pan/crop their world. They still undergo role,
// token, runtime, content-presence and exact-seek checks. The boundary exception
// does not exempt collisions between distinct labels or hide missing roles.
const CROPPED_WORLD=new Set(['marquee','wall','fullbleed','prompt','ui-macro','pullback','journey']);
function captureRasterPaint(){
  window.__designRasterPaint=[];
  window.__designSurfacePaint=[];
  const roundRect=CanvasRenderingContext2D.prototype.roundRect;
  CanvasRenderingContext2D.prototype.roundRect=function(...args){
    if(this.canvas.dataset.designSurface)window.__designSurfacePaint.push({args,receipt:JSON.parse(this.canvas.dataset.designSurface)});
    return roundRect.apply(this,args);
  };
  for(const method of ['fillText','strokeText']){
    const original=CanvasRenderingContext2D.prototype[method];
    CanvasRenderingContext2D.prototype[method]=function(text,...args){
      if(this.canvas.dataset.designRaster){
        const rows=JSON.parse(this.canvas.dataset.designRaster),metrics=this.measureText(String(text));
        window.__designRasterPaint.push({method,text:String(text),font:this.font,tracking:this.letterSpacing,
          width:metrics.width,receipt:rows.findLast(row=>(row.paintedText??row.text)===String(text))??rows.at(-1)});
      }
      return original.call(this,text,...args);
    };
  }
}
function instrumentRaster(project){
  const file=path.join(project,'index.html'),html=fs.readFileSync(file,'utf8');
  assert.ok(html.includes('<head>'));
  fs.writeFileSync(file,html.replace('<head>',`<head><script>(${captureRasterPaint.toString()})();</script>`));
}
export function rasterFindings(paints,{brandFont}={}){
  const errors=[];
  const family=value=>String(value??'').replace(/["']/g,'').split(',').map(s=>s.trim().toLowerCase()).join(',');
  for(const paint of paints){
    const spec=paint.receipt,role=ROLE_STEPS[spec?.role],step=spec?.step;
    if(!role?.steps.includes(step)||!(spec.unit>0&&Number.isFinite(spec.unit))){errors.push({kind:'unknown-raster-role',paint});continue;}
    const expected=RADIX_TOKENS.fontSizes[step-1]*spec.unit*(role.multiplier??1),fontSize=Number(/([\d.]+)px/.exec(paint.font)?.[1]);
    if(Math.abs(fontSize-expected)>.06)errors.push({kind:'raster-font-drift',paint,expected});
    const weight=Number(/(?:^|\s)([1-9]\d{2})\s/.exec(paint.font)?.[1]??(/\bbold\b/.test(paint.font)?700:400));
    if(weight!==role.weight)errors.push({kind:'raster-weight-drift',paint,expected:role.weight});
    const actualFamily=paint.font.slice(paint.font.indexOf('px')+2).trim(),expectedFamily=role.family??brandFont;
    if(expectedFamily&&family(actualFamily)!==family(expectedFamily))errors.push({kind:'raster-brand-font-drift',paint,expected:expectedFamily});
    const expectedTracking=Number.parseFloat(RADIX_TOKENS.letterSpacing[step-1])*expected;
    if(Math.abs((parseFloat(paint.tracking)||0)-expectedTracking)>.06)errors.push({kind:'raster-tracking-drift',paint,expected:expectedTracking});
    if(spec.overflowPolicy==='ellipsis'){
      if(paint.text!==spec.paintedText||typeof spec.text!=='string'||!(spec.maxWidth>0)||paint.width>spec.maxWidth+1)
        errors.push({kind:'raster-ellipsis-overflow',paint});
      if(spec.truncated&&(!paint.text.endsWith('…')||!spec.text.startsWith(paint.text.slice(0,-1))))
        errors.push({kind:'raster-ellipsis-copy',paint});
      if(!spec.truncated&&paint.text!==spec.text)errors.push({kind:'raster-ellipsis-copy',paint});
      if(step!==role.steps[0])errors.push({kind:'raster-ellipsis-font-shrink',paint});
    }
  }
  return errors;
}
export function cases({types=Object.keys(catalog),aspects=FORMATS,long=false,sceneOverrides={}}={}){
  const sample=samples();
  return aspects.flatMap(aspect=>types.map(type=>({id:`${type}-${aspect.replace(':','x')}${long?'-long':''}`,type,aspect,
    family:catalog[type].family,mode:catalog[type].renderMode,scene:structuredClone(sceneOverrides[type]??(long?maximumScene(type):sample.get(type)))})));
}
async function read(page){return page.evaluate(({measure,design,ellipsis})=>{
  const instance=window.__pkScenes.s1,root=instance.sceneRoot;
  const fontMetrics=new Map(),paint=document.createElement('canvas').getContext('2d');
  function glyphInk(node,start,end,matrix){
    const parent=node.parentElement,s=getComputedStyle(parent),key=[s.fontFamily,s.fontSize,s.fontWeight,s.fontStyle,s.fontStretch].join('|');
    if(!fontMetrics.has(key)){
      const probe=document.createElement('span');probe.style.cssText='position:absolute;left:-100000px;top:0;visibility:hidden;white-space:pre;transform:none';
      for(const k of ['fontFamily','fontSize','fontWeight','fontStyle','fontStretch','fontVariationSettings'])probe.style[k]=s[k];
      probe.textContent='Hg';const marker=document.createElement('span');marker.style.cssText='display:inline-block;width:0;height:0;vertical-align:baseline';probe.append(marker);document.body.append(probe);
      const range=document.createRange();range.selectNodeContents(probe.firstChild);const r=range.getBoundingClientRect();
      fontMetrics.set(key,{h:r.height,baseline:marker.getBoundingClientRect().y-r.y});probe.remove();
    }
    const metric=fontMetrics.get(key),range=document.createRange();range.setStart(node,start);range.setEnd(node,end);const r=range.getBoundingClientRect();
    paint.font=`${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;paint.fontStretch=s.fontStretch;
    const raw=node.textContent.slice(start,end),text=s.textTransform==='uppercase'?raw.toUpperCase():s.textTransform==='lowercase'?raw.toLowerCase():raw,ink=paint.measureText(text);
    const {a,b,c,d}=matrix,w=Math.max(0,(r.width-Math.abs(c)*metric.h)/Math.max(.001,Math.abs(a)));
    const origin={x:r.x-Math.min(0,a*w,c*metric.h,a*w+c*metric.h),y:r.y-Math.min(0,b*w,d*metric.h,b*w+d*metric.h)};
    const x0=-ink.actualBoundingBoxLeft,x1=ink.actualBoundingBoxRight,y0=metric.baseline-ink.actualBoundingBoxAscent,y1=metric.baseline+ink.actualBoundingBoxDescent;
    const points=[[x0,y0],[x1,y0],[x0,y1],[x1,y1]].map(([x,y])=>({x:origin.x+a*x+c*y,y:origin.y+b*x+d*y}));
    const xs=points.map(p=>p.x),ys=points.map(p=>p.y);return {x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};
  }
  const visible=node=>{let opacity=1;for(let p=node;p;p=p.parentElement){const s=getComputedStyle(p);if(s.display==='none'||s.visibility==='hidden')return false;opacity*=Number(s.opacity);}return opacity>=.75;};
  const uncovered=[],walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  while(walker.nextNode()){
    const node=walker.currentNode,parent=node.parentElement,text=node.textContent.trim();
    if(!text||!visible(parent)||parent.closest('svg,.deco,.ghost,[data-deco]'))continue;
    if(!parent.closest('[data-design-role]')&&!/^\p{Extended_Pictographic}[\p{Emoji_Modifier}\uFE0F\u200D\p{Extended_Pictographic}]*$/u.test(text))uncovered.push({text,class:parent.className});
  }
  const semantic=[...root.querySelectorAll('[data-design-role]')].map(n=>({role:n.dataset.designRole,step:n.dataset.designStep,unit:n.dataset.designUnit,text:n.textContent,style:n.getAttribute('style')}));
  const texts=(0,eval)(`(${measure})`)(root);
  const nodes=new Map(),textWalker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  while(textWalker.nextNode()){const n=textWalker.currentNode;nodes.set(root.__qualityTextIdentities.nodes.get(n),n.parentElement);}
  for(const text of texts){
    const parent=nodes.get(text.id);text.glyphArt=parent?.closest('[data-design-glyph-art]')?.dataset.designGlyphArt??null;
    text.viewport=parent?.closest('[data-design-viewport]')?.dataset.designViewport??null;
    const typingHost=parent?.closest('[data-typing-id]'),typingViewport=typingHost?.closest('[data-typing-viewport]');
    text.typingViewport=typingViewport?.dataset.typingViewport===typingHost?.dataset.typingId?typingViewport?.dataset.typingViewport:null;
    const frame=root.getBoundingClientRect();
    let clip={l:frame.left,t:frame.top,r:frame.right,b:frame.bottom},rotated=false,paintMatrix=new DOMMatrix();
    for(let p=parent;p&&p!==root;p=p.parentElement){const s=getComputedStyle(p);if(s.overflowX!=='visible'||s.overflowY!=='visible'){
      const r=p.getBoundingClientRect();clip=clip?{l:Math.max(clip.l,r.left),t:Math.max(clip.t,r.top),r:Math.min(clip.r,r.right),b:Math.min(clip.b,r.bottom)}:{l:r.left,t:r.top,r:r.right,b:r.bottom};
    }
      if(s.transform!=='none'){const matrix=new DOMMatrixReadOnly(s.transform);if(matrix.is2D){paintMatrix=matrix.multiply(paintMatrix);if(Math.abs(matrix.b)>.001||Math.abs(matrix.c)>.001)rotated=true;}}
      if(s.scale!=='none'){const values=s.scale.split(/\s+/).map(Number);paintMatrix=new DOMMatrix().scale(values[0],values[1]??values[0]).multiply(paintMatrix);}
      // An inset wipe paints only one side of its text. Use that intersection
      // for collision tests while retaining the original glyph bounds above.
      const inset=/^inset\(([^)]+)\)$/.exec(s.clipPath);
      if(inset){
        const values=inset[1].split(/\s+round\s+/)[0].trim().split(/\s+/),r=p.getBoundingClientRect();
        const v=[values[0],values[1]??values[0],values[2]??values[0],values[3]??values[1]??values[0]];
        const length=(value,dimension,logical)=>parseFloat(value)*(value.endsWith('%')?dimension/100:dimension/logical);
        const box={l:r.left+length(v[3],r.width,p.offsetWidth||r.width),t:r.top+length(v[0],r.height,p.offsetHeight||r.height),
          r:r.right-length(v[1],r.width,p.offsetWidth||r.width),b:r.bottom-length(v[2],r.height,p.offsetHeight||r.height)};
        clip=clip?{l:Math.max(clip.l,box.l),t:Math.max(clip.t,box.t),r:Math.min(clip.r,box.r),b:Math.min(clip.b,box.b)}:box;
      }
    }
    let painted=text.inkLines;
    if(rotated){
      // A long rotated ticker's union rectangle spans several other bands.
      // Individual glyph rectangles preserve the actual diagonal paint path.
      const walker=document.createTreeWalker(parent,NodeFilter.SHOW_TEXT);painted=[];
      while(walker.nextNode()){
        const n=walker.currentNode;if(root.__qualityTextIdentities.nodes.get(n)!==text.id)continue;
        for(let start=0;start<n.length;){const ch=String.fromCodePoint(n.textContent.codePointAt(start)),end=start+ch.length;
          if(!/\s/u.test(ch))painted.push(glyphInk(n,start,end,paintMatrix));start=end;
        }
      }
    }
    text.paintedLines=clip?painted.map(r=>({x:Math.max(r.x,clip.l),y:Math.max(r.y,clip.t),w:Math.max(0,Math.min(r.x+r.w,clip.r)-Math.max(r.x,clip.l)),h:Math.max(0,Math.min(r.y+r.h,clip.b)-Math.max(r.y,clip.t))})):painted;
    text.ellipsis=(0,eval)(`(${ellipsis})`)(root,parent?.closest('[data-design-overflow]'));
  }
  return {texts,design:(0,eval)(`(${design})`)(root),uncovered,semantic,
    anchors:[...root.querySelectorAll('[data-layout-fit-anchor]')].filter(visible).map((n,id)=>{const r=n.getBoundingClientRect();return {id,x:r.x,y:r.y,w:r.width,h:r.height};}),
    timelineLabels:[...root.querySelectorAll('[data-timeline-align="center"]')].filter(visible).map(n=>{
      const dot=root.querySelector(`[data-timeline-dot="${n.dataset.timelineLabel}"]`),range=document.createRange();range.selectNodeContents(n);
      const a=range.getBoundingClientRect(),b=dot.getBoundingClientRect();
      return {id:n.dataset.timelineLabel,text:n.textContent,offset:a.x+a.width/2-b.x-b.width/2};
    }),
    fit:instance.fitted??null,unit:instance.context.K.design?.unit,
    raster:[...root.querySelectorAll('[data-design-raster]')].map(n=>({kind:n.tagName,role:n.dataset.designRaster})),
    rasterPaint:window.__designRasterPaint??[],surfacePaint:window.__designSurfacePaint??[],
    metricOverflow:[...root.querySelectorAll('[data-design-role="metric"]')].filter(n=>n.clientWidth>0&&n.scrollWidth>n.clientWidth+1)
      .map(n=>({kind:'metric-copy-overflow',text:n.textContent,width:n.clientWidth,scrollWidth:n.scrollWidth})),
    mediaLayout:[...root.querySelectorAll('[data-design-viewport="moving-media"] [data-design-role]')].map(n=>({text:n.textContent,width:n.clientWidth,height:n.clientHeight,scrollWidth:n.scrollWidth,scrollHeight:n.scrollHeight})),
    text:root.textContent,canvases:root.querySelectorAll('canvas').length};
},{measure:measureRenderedText.toString(),design:measureDesign.toString(),ellipsis:measureEllipsisViewport.toString()});}

async function calibrate(page){
  const proof=await page.evaluate(async()=>{
    const instance=window.__pkScenes.s1,K=instance.context.K,D=K.design,root=document.createElement('div');
    root.style.cssText='position:absolute;left:100px;top:100px';instance.sceneRoot.append(root);
    try{
      const label=document.createElement('div');label.textContent='Continue';root.append(label);
      D.fitSize(label,1800,800,'button');const first=+label.dataset.designStep,size=parseFloat(getComputedStyle(label).fontSize);
      D.fitSize(label,2400,1000,'button');const second=parseFloat(getComputedStyle(label).fontSize);
      let error='';try{D.fitSize(label,1,1,'button');}catch(e){error=e.message;}
      const art=document.createElement('div');art.textContent='🟩';art.dataset.designGlyphArt='icon';root.append(art);D.apply(art,'label');
      const fake=document.createElement('div');fake.textContent='Actual label';fake.dataset.designGlyphArt='icon';root.append(fake);D.apply(fake,'label');
      const texts=K.helpers.dom.textBoxes(root).map(t=>t.text);
      const canvas=document.createElement('canvas'),g=canvas.getContext('2d'),spec=D.type('button');
      canvas.dataset.designRaster=JSON.stringify([{...spec,text:'Continue'}]);
      g.font=`500 ${spec.size}px Geist`;g.letterSpacing='0px';g.fillText('Continue',0,50);
      const good=window.__designRasterPaint.at(-1);g.font=`500 ${spec.size+3}px Geist`;g.fillText('Continue',0,50);const bad=window.__designRasterPaint.at(-1);
      window.__designRasterPaint.splice(-2);
      return {first,size,second,error,text:label.textContent,artExcluded:!texts.includes('🟩'),mixedLabelRetained:texts.includes('Actual label'),good,bad};
    }finally{root.remove();}
  });
  assert.equal(proof.size,proof.second);assert.equal(proof.first,2);assert.match(proof.error,/cannot fit role button/);assert.equal(proof.text,'Continue');
  assert.ok(proof.artExcluded&&proof.mixedLabelRetained);assert.deepEqual(rasterFindings([proof.good]),[]);
  assert.ok(rasterFindings([proof.bad]).some(f=>f.kind==='raster-font-drift'));
  const ellipsis=await page.evaluate(fn=>{
    const measure=(0,eval)(`(${fn})`),root=document.createElement('div');
    root.style.cssText='position:absolute;left:100px;top:100px;width:600px;height:600px';document.body.append(root);
    const wrap=document.createElement('div'),label=document.createElement('div');root.append(wrap);wrap.append(label);
    label.textContent='A complete filename that must retain its copy.pdf';label.dataset.designOverflow='ellipsis';
    const base='position:relative;left:20px;top:20px;display:block;width:160px;height:40px;font:32px/40px Arial;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
    const variants=[['valid',''],['rotated','transform:rotate(5deg)'],['wrapping','white-space:normal;overflow-wrap:anywhere'],
      ['plain-clip','text-overflow:clip'],['tall','height:80px'],['flex','display:flex'],['ancestor-clip',''],
      ['stage-crop',''],['stage-and-ancestor-clip','']];
    try{return variants.map(([id,css])=>{
      const stage=id.startsWith('stage-'),clipped=id.includes('ancestor-clip');
      wrap.style.cssText=`position:absolute;left:${stage?-260:40}px;top:40px;width:${clipped?80:360}px;height:200px;overflow:${id==='stage-crop'?'visible':'hidden'}`;
      label.style.cssText=base+';'+css;
      const before=label.getAttribute('style'),measurement=measure(root,label);
      return {id,measurement,stylesRestored:label.getAttribute('style')===before};
    });}finally{root.remove();}
  },measureEllipsisViewport.toString());
  for(const row of ellipsis){
    assert.ok(row.stylesRestored,'Ellipsis geometry measurement changed authored styles');
    const issues=ellipsisIssues({ellipsis:row.measurement,paintedLines:[row.measurement.viewport]});
    if(['valid','rotated'].includes(row.id))assert.deepEqual(issues,[],row.id);
    else assert.ok(issues.length,`Fake ellipsis fixture accepted: ${row.id}`);
    row.issues=issues;
    const worldIssues=ellipsisIssues({ellipsis:row.measurement,paintedLines:row.id.startsWith('stage-')?[]:[row.measurement.viewport]},{allowStageCrop:true});
    if(['valid','rotated','stage-crop'].includes(row.id))assert.deepEqual(worldIssues,[],row.id);
    else assert.ok(worldIssues.length,`Camera crop hid an internal ellipsis defect: ${row.id}`);
    row.worldIssues=worldIssues;
  }
  return {roomDoesNotEnlarge:true,tinyBoundsRejected:true,copyPreserved:true,illustrationMarkerCannotHideLabels:true,rasterDriftDetected:true,ellipsis};
}

export async function run({out,source=SOURCE,types,aspects,long=false,baseline=false,font='Geist',look='noir',sceneOverrides={}}={}){
  if(fs.existsSync(out))throw new Error(`Use a fresh output directory: ${out}`);
  fs.mkdirSync(out,{recursive:true});
  const jobs=cases({types,aspects,long,sceneOverrides}),receipt=sourceHashes(source),browser=await createNativeBrowser({source}),page=await browser.newPage();
  const report={schema:'pure-kinetic.catalog-design-native.v1',sourceReceipt:receipt,baseline,font,look,long,
    policy:{fractions:[.2,.45,.6,.8,.93],persistentSamples:2,croppedWorld:[...CROPPED_WORLD],
      movingMedia:'Local text-box fit and tokens; thumbnail text is excluded from global readability and frame/collision checks.',
      glyphArt:'Only marked pure emoji or at most two-character app/logo artwork; mixed labels remain measured.',
      ellipsis:'Explicit marker plus measured nowrap, hidden/clip overflow, ellipsis CSS, one-line footprint and unclipped viewport; original copy, roles and font floors remain audited.',
      rotatedInk:'Measured glyph ink for the catalog’s modest 2D rotations; not a general 3D occlusion proof.'},
    total:jobs.length,results:[]};
  const write=()=>{report.completed=report.results.length;report.failed=report.results.filter(r=>!r.passed).length;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');};
  try{
    for(const job of jobs){
      const row={...job,frames:[],errors:[]};
      try{
        const film={aspect:job.aspect,style:look,grain:false,sparks:false,brand:{name:'Nook',url:'nook.app',font,
          tokens:{background:'#101820',foreground:'#f6f6ef',accent:'#b9f24a',accent2:'#8ec7ff'}},scenes:[job.scene]};
        const {plan}=await page.play(film,{transformProject:instrumentRaster}),ps=plan.scenes[0],m=plan.safe;
        if(!baseline&&!report.calibration)report.calibration=await calibrate(page);
        const bounds={width:plan.width,height:plan.height,floor:plan.type.label,safe:{left:plan.width*m.left,top:plan.height*m.top,right:plan.width*(1-m.right),bottom:plan.height*(1-m.bottom)}};
        let payoff;
        for(const fraction of [.2,.45,.6,.8,.93]){
          await page.shoot(ps.start+ps.dur*fraction);const snapshot=await read(page);
          const emoji=/^\p{Extended_Pictographic}[\p{Emoji_Modifier}\uFE0F\u200D\p{Extended_Pictographic}]*$/u;
          const legible=snapshot.texts.filter(t=>t.viewport!=='moving-media'&&!(['logo-face','app-icon'].includes(t.glyphArt)&&[...t.text].length<=2)&&!(t.glyphArt==='icon'&&emoji.test(t.text)));
          const ellipsisOptions={allowStageCrop:CROPPED_WORLD.has(job.type)};
          // This collector already applies the shared overflow contract with
          // its explicit authored-camera policy; do not normalize it twice.
          const boundsOnly={...bounds,auditEllipsis:false};
          const boundaries=layoutFindings(legible.map(t=>ellipsisViewportText(typingViewportText(t),ellipsisOptions)),boundsOnly).filter(f=>f.kind!=='label-overlap');
          const collisions=layoutFindings(legible.map(t=>({...t,inkLines:t.paintedLines})),boundsOnly).filter(f=>f.kind==='label-overlap');
          const findings=[...boundaries,...collisions,...ellipsisFindings(legible,ellipsisOptions),...snapshot.mediaLayout.filter(r=>r.scrollWidth>r.width+1||r.scrollHeight>r.height+1).map(r=>({kind:'media-copy-overflow',id:r.text,...r}))].filter(f=>!CROPPED_WORLD.has(job.type)||!['outside-frame','outside-safe-area','clipped-text'].includes(f.kind));
          if(fraction>=.6)findings.push(...anchorFindings(snapshot.anchors,bounds),...snapshot.timelineLabels.filter(r=>Math.abs(r.offset)>2)
            .map(r=>({kind:'timeline-label-not-centered',...r})));
          row.frames.push({fraction,texts:snapshot.texts,findings,anchors:snapshot.anchors,uncovered:snapshot.uncovered,
            surfaceFindings:baseline?[]:surfaceFindings(snapshot.design)});
          if(fraction===.8){
            payoff=snapshot;row.design=snapshot.design;row.fit=snapshot.fit;row.raster=snapshot.raster;row.rasterPaint=snapshot.rasterPaint;row.surfacePaint=snapshot.surfacePaint;
            row.designFindings=baseline?[]:[...designFindings(snapshot.design,snapshot.unit).filter(f=>f.kind!=='missing-design-contract'||snapshot.raster.length===0),...rasterFindings(snapshot.rasterPaint,{brandFont:snapshot.design.brandFont}),...rasterSurfaceFindings(snapshot.surfacePaint),...snapshot.metricOverflow];
            const file=job.id+'.png';await sharp(await page.screenshot({type:'png'})).resize({width:480,height:720,fit:'inside'}).png().toFile(path.join(out,file));row.image=file;
          }
        }
        row.layoutFindings=persistentFindings(row.frames);
        row.surfaceFindings=persistentFindings(row.frames.map(frame=>({fraction:frame.fraction,findings:frame.surfaceFindings})));
        row.uncovered=[...new Set(row.frames.flatMap(frame=>frame.uncovered.map(n=>n.text)))];
        await page.shoot(ps.dur*.12);await page.shoot(ps.dur*.8);const reverse=await read(page);
        assert.deepEqual(reverse.semantic,payoff.semantic,'Exact backward seek changed the semantic design state');
        row.reverseExact=true;
        assert.deepEqual(page.errors,[],'Native runtime errors');assert.deepEqual(page.externalRequests,[],'External runtime request');
        if(!baseline){
          if(expectsSurface(job))assert.ok(
            row.design.surfaces.length+row.surfacePaint.length>0,'Declared UI type bypasses the surface system');
          if(surfaceScope.layoutGaps.includes(job.type))assert.ok(row.design.gaps.length>0,'Declared layout bypasses the shared gaps');
          assert.deepEqual(row.uncovered,[],'Text bypasses the shared design system');
          assert.deepEqual(row.designFindings,[],'Semantic token drift');
          assert.deepEqual(row.surfaceFindings,[],'Persistent surface spacing/radius drift');
          assert.deepEqual(row.layoutFindings,[],'Persistent rendered layout findings');
        }
        row.passed=true;
      }catch(error){row.errors.push(String(error.stack??error));row.passed=false;try{await sharp(await page.screenshot({type:'png'})).resize({width:480,height:720,fit:'inside'}).png().toFile(path.join(out,job.id+'-failure.png'));}catch{}await browser.recycle();}
      report.results.push(row);write();console.log(job.id,row.passed?'pass':row.errors[0].split('\n').slice(0,4).join(' '));
    }
  }finally{await browser.close();}
  report.sourceAfter=sourceHashes(source);report.sourceStable=receipt.aggregate===report.sourceAfter.aggregate;
  report.passed=report.sourceStable&&report.completed===report.total&&report.results.every(r=>r.passed);write();return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),option=(name,fallback)=>args.includes('--'+name)?args[args.indexOf('--'+name)+1]:fallback;
  const options={out:path.resolve(option('out','/tmp/pk-catalog-design')),source:path.resolve(option('source',SOURCE)),
    ...(option('types')?{types:option('types').split(',')}:{}),...(option('aspects')?{aspects:option('aspects').split(',')}:{}),
    long:args.includes('--long'),baseline:args.includes('--baseline'),font:option('font','Geist'),look:option('look','noir')};
  if(args.includes('--list'))console.log(JSON.stringify(cases(options)));
  else if(!(await run(options)).passed)process.exitCode=1;
}
