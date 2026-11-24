// Measure rendered text, including native presentation/camera scale, at field bounds.
// node tools/quality-layout.mjs --out /tmp/pk-quality-layout
// node tools/quality-layout.mjs --self-test --out /tmp/pk-quality-self-test
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createNativeBrowser,sharp,TEMPLATE,SOURCE} from './native-browser.mjs';
import {ellipsisIssues,ellipsisViewportText} from './text-overflow-audit.mjs';

const require=createRequire(import.meta.url),fields=require(path.join(SOURCE,'lib/compiler/fields.cjs'));
const definitions=require(path.join(SOURCE,'lib/compiler/definitions.cjs'));

// This function is serialized into the native page. Calibration is untransformed
// and uses the actual loaded font, so a 36px label scaled to 28px cannot pass.
export function measureRenderedText(root,{minimumOpacity=.75}={}) {
  const document=root.ownerDocument,window=document.defaultView;
  // Canvas ascender metrics map to a screen-space Range only when every
  // transform preserves the positive horizontal/vertical axes. A rotated
  // Range's tall bounding box is not a larger font or empty ascender space.
  function axisAligned(style){
    if(style.perspective!=='none'||(style.offsetPath&&style.offsetPath!=='none'))return false;
    if(style.rotate&&style.rotate!=='none'){
      const angle=/([+-]?(?:\d+(?:\.\d*)?|\.\d+))(?:deg|rad|grad|turn)$/.exec(style.rotate);
      if(!angle||Math.abs(Number(angle[1]))>1e-8)return false;
    }
    if(style.scale&&style.scale!=='none'){
      const values=style.scale.trim().split(/\s+/).map(value=>value.endsWith('%')?Number(value.slice(0,-1))/100:Number(value));
      if(values.length>3||values.some(value=>!Number.isFinite(value)||value<=0)||(values.length===3&&Math.abs(values[2]-1)>1e-8))return false;
    }
    if(style.translate&&style.translate!=='none'){
      const values=style.translate.trim().split(/\s+/);
      if(values.length>3||(values.length===3&&(!Number.isFinite(parseFloat(values[2]))||Math.abs(parseFloat(values[2]))>1e-8)))return false;
    }
    if(style.transform==='none')return true;
    try{
      const m=new window.DOMMatrixReadOnly(style.transform);
      return m.is2D&&[m.a,m.b,m.c,m.d,m.e,m.f].every(Number.isFinite)&&m.a>0&&m.d>0&&Math.abs(m.b)<1e-8&&Math.abs(m.c)<1e-8;
    }catch{return false;}
  }
  function measureEllipsisViewport(root,host){
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
      const paint=document.createElement('canvas').getContext('2d'),local=host.getBoundingClientRect();
      const top=local.top+host.clientTop,bottom=top+host.clientHeight;
      let verticalSeen=1;
      while(walker.nextNode()){
        if(!walker.currentNode.textContent.trim())continue;
        const range=document.createRange();range.selectNodeContents(walker.currentNode);
        const style=getComputedStyle(walker.currentNode.parentElement),metric=fontMetrics(style);
        paint.font=`${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;paint.fontStretch=style.fontStretch;
        const raw=walker.currentNode.textContent,text=style.textTransform==='uppercase'?raw.toUpperCase():style.textTransform==='lowercase'?raw.toLowerCase():raw,ink=paint.measureText(text);
        for(const r of range.getClientRects())if(r.width>.5&&r.height>.5){
          if(!lines.some(y=>Math.abs(y-r.y)<1))lines.push(r.y);
          const y=r.y+metric.baseline-ink.actualBoundingBoxAscent,h=ink.actualBoundingBoxAscent+ink.actualBoundingBoxDescent;
          if(h>0)verticalSeen=Math.min(verticalSeen,Math.max(0,Math.min(y+h,bottom)-Math.max(y,top))/h);
        }
      }
      paint.font=`${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;paint.fontStretch=s.fontStretch;paint.letterSpacing=s.letterSpacing;
      return {marker:host.dataset.designOverflow,whiteSpace:s.whiteSpace,textOverflow:s.textOverflow,
        overflowX:s.overflowX,display:s.display,lineCount:lines.length,lineHeight:parseFloat(s.lineHeight),
        clientWidth:host.clientWidth,clientHeight:host.clientHeight,scrollWidth:host.scrollWidth,scrollHeight:host.scrollHeight,
        paddingY:(parseFloat(s.paddingTop)||0)+(parseFloat(s.paddingBottom)||0),
        paddingX:(parseFloat(s.paddingLeft)||0)+(parseFloat(s.paddingRight)||0),ellipsisWidth:paint.measureText('…').width,verticalSeen,viewport,frame:rectangle(frame),
        ancestorClip:{x:ancestorClip.l,y:ancestorClip.t,w:Math.max(0,ancestorClip.r-ancestorClip.l),h:Math.max(0,ancestorClip.b-ancestorClip.t)},
        enclosingClip:{x:clip.l,y:clip.t,w:Math.max(0,clip.r-clip.l),h:Math.max(0,clip.b-clip.t)}};
    }finally{
      for(const [node,style] of restore)if(style===null)node.removeAttribute('style');else node.setAttribute('style',style);
    }
  }
  const overflowCache=new Map();
  const cache=new Map(),out=[],walker=document.createTreeWalker(root,window.NodeFilter.SHOW_TEXT);
  const calibration=document.createElement('span');
  const canvas=document.createElement('canvas').getContext('2d');
  calibration.style.cssText='position:absolute;left:-100000px;top:0;visibility:hidden;white-space:pre;transform:none;';
  document.body.appendChild(calibration);
  function fontMetrics(style){
    const key=[style.fontFamily,style.fontWeight,style.fontStyle,style.fontStretch,style.fontVariationSettings,style.fontSize].join('|');
    if(!cache.has(key)){
      for(const property of ['fontFamily','fontWeight','fontStyle','fontStretch','fontVariationSettings'])calibration.style[property]=style[property];
      calibration.style.fontSize=style.fontSize;calibration.textContent='Hg';
      const marker=document.createElement('span');marker.style.cssText='display:inline-block;width:0;height:0;padding:0;margin:0;vertical-align:baseline;';calibration.appendChild(marker);
      const r=document.createRange();r.selectNodeContents(calibration.firstChild);
      const rect=r.getBoundingClientRect();
      cache.set(key,{height:rect.height,baseline:marker.getBoundingClientRect().top-rect.top});
    }
    return cache.get(key);
  }
  const rectangle=r=>({x:r.left,y:r.top,w:r.width,h:r.height});
  const identities=root.__qualityTextIdentities??={nodes:new WeakMap(),next:0,labels:new WeakMap(),nextLabel:0};
  while(walker.nextNode()){
    const node=walker.currentNode,parent=node.parentElement,text=node.nodeValue.replace(/\s+/g,' ').trim();
    if(!parent||!text||parent.closest('.deco,.ghost,svg,[data-deco],.mock,.phone .screen,[data-roll]'))continue;
    if(!identities.nodes.has(node))identities.nodes.set(node,identities.next++);
    const id=identities.nodes.get(node),style=window.getComputedStyle(parent);let opacity=1,hidden=false,clip=null,inkAxisAligned=true;
    for(let p=parent;p;p=p.parentElement){
      const s=window.getComputedStyle(p);
      if(s.visibility==='hidden'||s.display==='none'){hidden=true;break;}
      opacity*=Number(s.opacity);
      inkAxisAligned&&=axisAligned(s);
      if(s.overflowX!=='visible'||s.overflowY!=='visible'){
        const r=p.getBoundingClientRect();
        clip=clip?{left:Math.max(clip.left,r.left),top:Math.max(clip.top,r.top),right:Math.min(clip.right,r.right),bottom:Math.min(clip.bottom,r.bottom)}:{left:r.left,top:r.top,right:r.right,bottom:r.bottom};
      }
    }
    if(hidden||opacity<minimumOpacity)continue;
    const range=document.createRange();range.selectNodeContents(node);
    const lines=[...range.getClientRects()].filter(r=>r.width>.5&&r.height>.5);
    if(!lines.length)continue;
    const metrics=fontMetrics(style),untransformedHeight=metrics.height,box=range.getBoundingClientRect();
    canvas.font=`${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    canvas.fontStretch=style.fontStretch;
    const ink=canvas.measureText(style.textTransform==='uppercase'?text.toUpperCase():style.textTransform==='lowercase'?text.toLowerCase():text);
    // Range line boxes include the font's reserved ascender/descender space.
    // Compare painted glyph bounds so a tall font metric is not a collision.
    const inkLines=lines.map(r=>{
      const scale=r.height/untransformedHeight;
      return {x:r.left,y:r.top+(metrics.baseline-ink.actualBoundingBoxAscent)*scale,w:r.width,h:(ink.actualBoundingBoxAscent+ink.actualBoundingBoxDescent)*scale};
    });
    let visible=0,total=0;
    for(const r of inkLines){
      total+=r.w*r.h;
      visible+=clip?Math.max(0,Math.min(r.x+r.w,clip.right)-Math.max(r.x,clip.left))*Math.max(0,Math.min(r.y+r.h,clip.bottom)-Math.max(r.y,clip.top)):r.w*r.h;
    }
    const paintedLines=clip?inkLines.map(r=>({x:Math.max(r.x,clip.left),y:Math.max(r.y,clip.top),
      w:Math.max(0,Math.min(r.x+r.w,clip.right)-Math.max(r.x,clip.left)),
      h:Math.max(0,Math.min(r.y+r.h,clip.bottom)-Math.max(r.y,clip.top))})):inkLines;
    const overflow=parent.closest('[data-design-overflow]');
    if(overflow&&!overflowCache.has(overflow))overflowCache.set(overflow,measureEllipsisViewport(root,overflow));
    const ellipsis=overflow?overflowCache.get(overflow):null;
    // The ported DOM helper sets native layout-allow annotations on every node.
    // Only the explicit component semantic marker exempts an actual overlap.
    const intentionalOverlap=parent.closest('[data-over]');
    const glyph=parent.closest('.glyph'),typing=parent.closest('[data-typing-host]');
    const label=typing??glyph?.closest('.word')?.parentElement??glyph?.parentElement??parent;
    if(!identities.labels.has(label))identities.labels.set(label,identities.nextLabel++);
    out.push({id,text,opacity,cssSize:parseFloat(style.fontSize),renderedSize:Math.min(...lines.map(r=>r.height))/untransformedHeight*parseFloat(style.fontSize),seen:total?visible/total:0,box:rectangle(box),lines:lines.map(rectangle),inkLines,inkAxisAligned,paintedLines,ellipsis,glyph:!!(glyph||typing),labelId:identities.labels.get(label),over:!!intentionalOverlap&&root.contains(intentionalOverlap),font:style.fontFamily});
  }
  calibration.remove();
  return out;
}

export function layoutFindings(texts,{width,height,floor,safe,auditEllipsis=true}){
  const found=[];
  for(const raw of texts){
    const issues=auditEllipsis?ellipsisIssues(raw):[];
    if(issues.length)found.push({kind:'invalid-ellipsis',id:raw.id,text:raw.text,issues});
    const text=auditEllipsis?ellipsisViewportText(raw):raw;
    if(text.renderedSize<floor-.5)found.push({kind:'rendered-font-floor',id:text.id,text:text.text,actual:text.renderedSize,expected:floor});
    if(text.seen<.98)found.push({kind:'clipped-text',id:text.id,text:text.text,seen:text.seen});
    for(const r of text.inkLines??text.lines){
      if(r.x<-1||r.y<-1||r.x+r.w>width+1||r.y+r.h>height+1){found.push({kind:'outside-frame',id:text.id,text:text.text,box:r});break;}
      if(r.x<safe.left-1||r.y<safe.top-1||r.x+r.w>safe.right+1||r.y+r.h>safe.bottom+1){found.push({kind:'outside-safe-area',id:text.id,text:text.text,box:r});break;}
    }
  }
  // Kerning within one glyph-based label is deliberate. Separate glyph labels
  // still collide; excluding all .glyph nodes would hide overlapping headings.
  // Retain line rectangles rather than bounding unions across multiline gaps.
  for(let i=0;i<texts.length;i++)for(let j=i+1;j<texts.length;j++){
    const a=texts[i],b=texts[j];if(a.over||b.over||(a.glyph&&b.glyph&&a.labelId===b.labelId))continue;
    let overlap=false;
    const paint=t=>auditEllipsis&&t.ellipsis&&!ellipsisIssues(t).length?t.paintedLines:t.inkLines??t.lines;
    for(const x of paint(a))for(const y of paint(b)){
      const w=Math.min(x.x+x.w,y.x+y.w)-Math.max(x.x,y.x),h=Math.min(x.y+x.h,y.y+y.h)-Math.max(x.y,y.y);
      if(w>2&&h>2)overlap=true;
    }
    if(overlap)found.push({kind:'label-overlap',id:[a.id,b.id],text:[a.text,b.text]});
  }
  return found;
}

export function samples(){
  const out=new Map(),fill=s=>JSON.parse(JSON.stringify(s).replaceAll('{name}','Nook').replaceAll('{NAME}','NOOK').replaceAll('{url}','nook.app').replaceAll('{tagline}','Ideas in motion'));
  for(const t of JSON.parse(fs.readFileSync(path.join(TEMPLATE,'tools/kinetic/templates.json'))))for(const s of t.scenes)if(!out.has(s.type)){
    const {image,images,...rest}=s;out.set(s.type,fill(rest));
  }
  for(const s of JSON.parse(fs.readFileSync(path.join(TEMPLATE,'tools/kinetic/samples.json'))))if(!out.has(s.type))out.set(s.type,fill(s));
  for(const [name,d]of Object.entries(definitions))out.set(name,structuredClone(d.sample));
  return out;
}

export function maximal(value,spec,key=''){
  if(!spec||value===undefined)return value;
  if(['icon','icons','image','images','emoji'].includes(key))return value;
  if(spec.kind==='string'&&spec.max){
    const marked=key==='text'&&/\*[^*]+\*/.test(value);
    const result=('Worldwide workflow management and independent review ').repeat(Math.ceil(spec.max/50)).slice(0,spec.max-(marked?2:0)).trimEnd();
    return marked?result.replace(/(\S+)$/,'*$1*'):result;
  }
  if(spec.kind==='array'&&Array.isArray(value)&&value.length)return Array.from({length:spec.max??value.length},(_,i)=>maximal(structuredClone(value[i%value.length]),spec.of));
  if(spec.kind==='tuple'&&Array.isArray(value))return value.map((v,i)=>maximal(v,spec.of[i]));
  if(spec.kind==='object'&&value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,maximal(v,spec.fields[k],k)]));
  return value;
}

export function maximumScene(name){
  const sample=structuredClone(samples().get(name));
  if(!sample)throw Error('Unknown sample '+name);
  const spec=definitions[name]?.fields??fields[name];
  return Object.fromEntries(Object.entries(sample).map(([key,value])=>[key,maximal(value,spec?.[key],key)]));
}

export function persistentFindings(samples){
  const seen=new Map();
  for(const sample of samples)for(const finding of sample.findings){
    const key=JSON.stringify([finding.kind,finding.id]);
    if(!seen.has(key))seen.set(key,{finding,fractions:new Set()});
    seen.get(key).fractions.add(sample.fraction);
  }
  return [...seen.values()].filter(x=>x.fractions.size>=2).map(x=>({...x.finding,occurrences:x.fractions.size}));
}

async function selfTest(page,out){
  await page.play({aspect:'1:1',style:'noir',brand:{name:'Test'},scenes:[{type:'title',text:'Test',beats:3}]});
  const proof=await page.evaluate(fn=>{
    const measure=(0,eval)(`(${fn})`),root=document.createElement('div');
    const outer=document.createElement('div');outer.setAttribute('data-layout-allow-overlap','');document.body.appendChild(outer);
    root.style.cssText='position:absolute;left:100px;top:100px;width:600px;font-family:Arial;font-size:36px;';outer.appendChild(root);
    const a=document.createElement('div');a.textContent='Full size';a.style.cssText='transform:scale(.5);transform-origin:0 0';root.appendChild(a);
    const b=document.createElement('div');b.textContent='Clipped';b.style.cssText='width:12px;overflow:hidden;white-space:nowrap';root.appendChild(b);
    const c=document.createElement('div');c.textContent='First line second line third line';c.style.cssText='width:180px;line-height:1.5';root.appendChild(c);
    const hidden=document.createElement('div');hidden.textContent='Inactive page';hidden.style.display='none';root.appendChild(hidden);
    const metricPair=document.createElement('div');metricPair.style.cssText='font-family:"Geist Mono";line-height:1;margin-top:20px';root.appendChild(metricPair);
    for(const text of ['Plain caps','Other caps']){const line=document.createElement('div');line.style.cssText='height:36px;overflow:hidden';line.textContent=text;metricPair.appendChild(line);}
    for(const text of ['Collision one','Collision two']){const line=document.createElement('div');line.setAttribute('data-layout-allow-overlap','');line.style.cssText='position:absolute;left:0;top:700px';line.textContent=text;root.appendChild(line);}
    for(const text of ['Glyph layer one','Glyph layer two']){
      const label=document.createElement('div');label.style.cssText='position:absolute;left:0;top:850px';root.appendChild(label);
      const word=document.createElement('span');word.className='word';label.appendChild(word);
      const glyph=document.createElement('span');glyph.className='glyph';glyph.textContent=text;word.appendChild(glyph);
    }
    const texts=measure(root),inserted=document.createElement('div');inserted.textContent='New leading text';root.prepend(inserted);
    const again=measure(root);outer.remove();
    return {texts,identitiesStable:texts.every(t=>again.find(x=>x.text===t.text)?.id===t.id)};
  },measureRenderedText.toString());
  const {texts}=proof;
  assert.ok(proof.identitiesStable,'Text identities must survive appearing/disappearing siblings');
  assert.ok(!texts.some(t=>t.text==='Inactive page'),'Explicitly hidden pages are not clipped visible content');
  const scaled=texts.find(x=>x.text==='Full size'),clipped=texts.find(x=>x.text==='Clipped'),wrapped=texts.find(x=>x.text.startsWith('First'));
  assert.equal(scaled.cssSize,36);assert.ok(Math.abs(scaled.renderedSize-18)<.1);
  assert.ok(clipped.seen<.4);assert.ok(wrapped.lines.length>=3);
  const findings=layoutFindings(texts,{width:1080,height:1080,floor:36,safe:{left:0,top:0,right:1080,bottom:1080}});
  assert.ok(findings.some(x=>x.kind==='rendered-font-floor'&&x.text==='Full size'));
  assert.ok(findings.some(x=>x.kind==='clipped-text'&&x.text==='Clipped'));
  const pair=texts.filter(t=>['Plain caps','Other caps'].includes(t.text));
  assert.ok(pair[0].lines[0].y+pair[0].lines[0].h>pair[1].lines[0].y+2,'Fixture must have overlapping reserved font rectangles');
  assert.ok(pair.every(t=>t.seen>.99),'Clipping only reserved font space must not be treated as cut glyph ink');
  assert.ok(!findings.some(f=>f.kind==='label-overlap'&&f.text.includes('Plain caps')&&f.text.includes('Other caps')),'Separated glyph ink must not be reported as overlapping text');
  assert.ok(findings.some(f=>f.kind==='label-overlap'&&f.text.includes('Collision one')&&f.text.includes('Collision two')),'Broad native layout annotations must not hide internal text collisions');
  assert.ok(findings.some(f=>f.kind==='label-overlap'&&f.text.includes('Glyph layer one')&&f.text.includes('Glyph layer two')),'Glyph rendering must not hide collisions between separate text blocks');
  const overflowProof=await page.evaluate(fn=>{
    const measure=(0,eval)(`(${fn})`),root=document.createElement('div');
    root.style.cssText='position:absolute;left:100px;top:100px;width:800px;height:800px';document.body.append(root);
    const wrap=document.createElement('div'),label=document.createElement('div'),other=document.createElement('div');
    root.append(wrap);wrap.append(label,other);
    label.textContent='A complete filename that must retain its original copy.pdf';
    other.textContent='Adjacent';
    const base='position:absolute;left:20px;top:20px;display:block;width:160px;height:40px;font:32px/40px Arial;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
    const variants=[['valid',''],['rotated','transform:rotate(5deg)'],['unmarked',''],
      ['plain-clip','text-overflow:clip'],['wrapping','white-space:normal;overflow-wrap:anywhere'],
      ['vertical-clip','height:10px'],['tight-leading','font:36px/20px Arial;height:20px'],['ancestor-clip',''],['no-ellipsis-room','width:8px'],['real-collision',''],['small-font','font-size:16px']];
    try{return variants.map(([id,css])=>{
      wrap.style.cssText=`position:absolute;left:40px;top:40px;width:${id==='ancestor-clip'?80:600}px;height:200px;overflow:hidden`;
      label.style.cssText=base+';'+css;
      if(id==='unmarked')delete label.dataset.designOverflow;else label.dataset.designOverflow='ellipsis';
      other.style.cssText=`position:absolute;left:${id==='real-collision'?70:240}px;top:20px;font:32px/40px Arial`;
      const before=label.getAttribute('style'),texts=measure(root);
      return {id,texts,stylesRestored:label.getAttribute('style')===before};
    });}finally{root.remove();}
  },measureRenderedText.toString());
  for(const row of overflowProof){
    assert.ok(row.stylesRestored,'Text measurement must preserve authored transform/style bytes');
    const faults=layoutFindings(row.texts,{width:1080,height:1080,floor:32,safe:{left:0,top:0,right:1080,bottom:1080}});
    row.findings=faults;
    if(['valid','rotated'].includes(row.id)){
      assert.deepEqual(faults,[],`Valid ellipsis rejected: ${row.id}`);
      const text=row.texts.find(t=>t.text.includes('filename'));
      assert.ok(text.seen<.5&&text.box.w>text.ellipsis.viewport.w,'Keep the original unabridged text geometry as evidence');
      assert.ok(text.text.endsWith('copy.pdf'),'Measurement must not replace input copy with the rendered ellipsis');
    }else if(row.id==='unmarked')assert.ok(faults.some(f=>f.kind==='clipped-text'),'Plain clipping must remain an error');
    else if(row.id==='real-collision')assert.ok(faults.some(f=>f.kind==='label-overlap'),'Visible glyph collisions must remain an error');
    else if(row.id==='small-font')assert.ok(faults.some(f=>f.kind==='rendered-font-floor'),'Ellipsis must not hide reduced font size');
    else assert.ok(faults.some(f=>f.kind==='invalid-ellipsis'),`Invalid ellipsis accepted: ${row.id}`);
  }
  const transformProof=await page.evaluate(fn=>{
    const measure=(0,eval)(`(${fn})`),root=document.createElement('div'),label=document.createElement('span');
    document.body.append(root);root.append(label);label.textContent='HELLO WORLD';
    const variants=[
      ['plain','','',true],
      ['positive-matrix','transform:translate(4px,6px) scale(1.2,.8)','',true],
      ['positive-ancestor','','transform:scale(.8)',true],
      ['individual-scale','scale:1.2 .8','',true],
      ['individual-translate','translate:12px 8px','',true],
      ['rotated-clipping','top:-60px;transform:rotate(90deg)','',false],
      ['ancestor-rotation','','transform:rotate(5deg)',false],
      ['skew','transform:skewX(12deg)','',false],
      ['reflection','transform:scaleX(-1)','',false],
      ['matrix-3d','transform:translateZ(1px)','',false],
      ['ancestor-perspective','','perspective:500px',false],
      ['individual-rotate','rotate:90deg','',false],
      ['individual-reflection','scale:-1 1','',false],
      ['individual-depth','translate:0px 0px 1px','',false],
    ];
    try{return variants.map(([id,css,ancestorCSS,expected])=>{
      root.style.cssText='position:absolute;left:100px;top:100px;width:500px;height:500px;overflow:hidden;transform-origin:0 0;'+ancestorCSS;
      label.style.cssText='display:inline-block;position:absolute;left:300px;top:20px;white-space:nowrap;font:36px/48px Arial;transform-origin:0 0;'+css;
      const range=document.createRange();range.selectNodeContents(label.firstChild);
      const box=range.getBoundingClientRect(),clip=root.getBoundingClientRect();
      const raw={text:label.textContent,x:box.x,y:box.y,w:box.width,h:box.height,line:box.height,
        seen:Math.max(0,Math.min(box.right,clip.right)-Math.max(box.left,clip.left))*Math.max(0,Math.min(box.bottom,clip.bottom)-Math.max(box.top,clip.top))/(box.width*box.height)};
      return {id,expected,raw,texts:measure(root)};
    });}finally{root.remove();}
  },measureRenderedText.toString());
  const {pictureTextBoxes}=await import('./picture-audit-text.mjs');
  for(const row of transformProof){
    const measured=row.texts.find(text=>text.text===row.raw.text);
    assert.equal(measured?.inkAxisAligned,row.expected,`Unreliable ink normalization: ${row.id}`);
    const [normalized]=pictureTextBoxes([row.raw],row.texts);
    if(!row.expected)assert.equal(normalized,row.raw,`Non-axis transform must retain raw clipping evidence: ${row.id}`);
    else assert.ok(normalized.auditBox,`Positive scale and translation must preserve calibrated ink: ${row.id}`);
    if(row.id==='rotated-clipping'){
      assert.ok(row.raw.seen<.85&&measured.seen>.85,'Fixture must expose rotated Range incorrectly treated as empty font space');
      assert.ok((normalized.auditSeen??normalized.seen)<.85,'Real clipped letters must still fail the picture audit');
    }
  }
  assert.deepEqual(page.errors,[]);assert.deepEqual(page.externalRequests,[]);
  fs.writeFileSync(path.join(out,'self-test.json'),JSON.stringify({passed:true,proof,findings,overflowProof,transformProof},null,2)+'\n');
  console.log('Rendered-size, true-line and clipping measurement self-test passed.');
}

async function main(){
  const args=process.argv.slice(2),option=(name,fallback)=>args.includes('--'+name)?args[args.indexOf('--'+name)+1]:fallback;
  const out=path.resolve(option('out','/tmp/pk-quality-layout'));fs.mkdirSync(out,{recursive:true});
  const names=option('scenes','connect,steps,code,between,arc,slam,winner,icon3d,scatter,endcard,flip,tabs').split(','),aspects=option('aspects','9:16,1:1,16:9').split(',');
  const all=samples(),content=option('content','max'),font=option('font','Geist Mono'),look=option('look','editorial');
  const browser=await createNativeBrowser(),page=await browser.newPage(),results=[];
  try{
    if(args.includes('--self-test')){await selfTest(page,out);return;}
    for(const name of names)for(const aspect of aspects){
      const row={id:name+'-'+aspect.replace(':','x'),type:name,aspect,errors:[],findings:[],samples:[]};
      try{
        const sample=structuredClone(all.get(name));if(!sample)throw Error('Unknown sample '+name);
        const spec=definitions[name]?.fields??fields[name];
        const scene=content==='max'?Object.fromEntries(Object.entries(sample).map(([k,v])=>[k,maximal(v,spec?.[k],k)])):sample;
        row.film={aspect,style:look,brand:{name:'Nook',font},grain:false,sparks:false,scenes:[scene]};
        const {plan}=await page.play(row.film),ps=plan.scenes[0],m=plan.safe;
        const bounds={width:plan.width,height:plan.height,floor:plan.type.label,safe:{left:plan.width*m.left,top:plan.height*m.top,right:plan.width*(1-m.right),bottom:plan.height*(1-m.bottom)}};
        for(const fraction of [.45,.65,.85]){
          await page.shoot(ps.start+ps.dur*fraction);
          const texts=await page.evaluate(fn=>(0,eval)(`(${fn})`)(window.__pkScenes.s1.sceneRoot),measureRenderedText.toString());
          const findings=layoutFindings(texts,bounds);
          row.samples.push({fraction,texts,findings});
        }
        // Persistent findings are defects; a single sample is retained as a
        // diagnostic because intentional entrances/exits can cross safe bounds.
        row.findings=persistentFindings(row.samples);
        assert.deepEqual(page.errors,[]);assert.deepEqual(page.externalRequests,[]);
        await page.shoot(ps.start+ps.dur*.65);
        await sharp(await page.screenshot({type:'png'})).resize({width:960,height:960,fit:'inside'}).png().toFile(path.join(out,row.id+'.png'));
      }catch(error){row.errors.push(String(error?.stack??error));}
      results.push(row);
      fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({schema:'pure-kinetic.quality-layout.v1',sourceReceipt:page.sourceHashes,content,font,look,total:names.length*aspects.length,completed:results.length,failedCases:results.filter(x=>x.errors.length||x.findings.length).length,results},null,2)+'\n');
      console.log(row.id,row.errors.length?'ERROR':row.findings.length?`${row.findings.length} findings`:'pass');
    }
  }finally{await browser.close();}
  if(results.some(row=>row.errors.length||row.findings.length))process.exitCode=1;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
