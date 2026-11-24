// Modified from HyperFrames before-after-wipe and testimonial-proof-card (Apache-2.0).
// Pinned originals, license and modification record: ../upstream/hyperframes-registry-01/RECEIPT.json.
// Pure Kinetic supplies the only clock, content contract, assets and brand roles.
import metadata from '../metadata.mjs';
import {createDesignSystem} from '../design-system.mjs';

const clamp = value => Math.max(0, Math.min(1, value));
const out = value => 1 - (1 - clamp(value)) ** 4;
function kit(K, parent, type) {
  const {el, set, px, S, safe} = K;
  const design=createDesignSystem(K);
  const root = el('div', '', parent);root.dataset.registryItem = type;
  set(root, {position:'absolute',left:px(safe.x),top:px(safe.y),width:px(safe.w),height:px(safe.h),color:'inherit',textTransform:'none',fontStretch:'normal'});
  const node=(tag,role,host=root,text)=>{const n=el(tag,'',host,text);n.dataset.registryRole=role;for(const key of ['overlap','occlusion','overflow'])n.removeAttribute(`data-layout-allow-${key}`);return n;};
  const text=(role,host,value,x,y,w,h,typeRole)=>{
    const n=node('div',role,host,value);n.dataset.registryText=role;
    set(n,{position:'absolute',left:px(x),top:px(y),width:px(w),maxWidth:px(w)});
    design.fit(n,{role:typeRole,w,h});
    return n;
  };
  return {root,node,text,set,px,S,design,w:safe.w,h:safe.h};
}

// Center painted glyphs, not their advance width or the font's line box.
// A zero-height inline marker measures the actual HTML baseline once; canvas
// ink extents use the same loaded font/weight. Initials remain normal HTML text.
function centeredInitials(K,avatar,value,node,design) {
  const {set,px}=K,monogram=node('span','initials',avatar,value);
  monogram.dataset.registryText='initials';
  // Canvas measures the font's default glyph forms, so do not inherit the
  // stage's stylistic alternates (notably Geist Mono's different "a").
  design.apply(monogram,'initials');
  set(monogram,{position:'absolute',left:'0',top:'0',width:'max-content',whiteSpace:'pre',
    fontKerning:'normal',fontFeatureSettings:'normal',textTransform:'none'});
  const style=avatar.ownerDocument.defaultView.getComputedStyle(monogram);
  const context=avatar.ownerDocument.createElement('canvas').getContext('2d');
  context.font=`${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  context.fontKerning=style.fontKerning;
  context.fontStretch='normal';
  const ink=context.measureText(value),inkW=ink.actualBoundingBoxLeft+ink.actualBoundingBoxRight;
  const inkH=ink.actualBoundingBoxAscent+ink.actualBoundingBoxDescent;
  // A wide pair in the requested brand font grows the avatar, never shrinks
  // below the shared text floor. The byline uses this measured diameter too.
  const size=Math.max(design.space(6),inkW+design.space(2),inkH+design.space(2));
  set(avatar,{width:px(size),height:px(size)});
  const marker=node('span','initials-baseline',monogram);
  set(marker,{display:'inline-block',width:'0',height:'0',padding:'0',margin:'0',verticalAlign:'baseline'});
  const rect=monogram.getBoundingClientRect(),scale=avatar.getBoundingClientRect().width/size;
  const baseline=(marker.getBoundingClientRect().top-rect.top)/scale;
  marker.remove();
  // clientWidth/clientHeight round to whole CSS pixels. The portrait scale and
  // an ink-driven avatar diameter can be fractional, so use its actual padding
  // box when positioning absolute children inside the border.
  const avatarStyle=avatar.ownerDocument.defaultView.getComputedStyle(avatar);
  const innerW=parseFloat(avatarStyle.width)-parseFloat(avatarStyle.borderLeftWidth)-parseFloat(avatarStyle.borderRightWidth);
  const innerH=parseFloat(avatarStyle.height)-parseFloat(avatarStyle.borderTopWidth)-parseFloat(avatarStyle.borderBottomWidth);
  set(monogram,{left:px((innerW-inkW)/2+ink.actualBoundingBoxLeft),
    top:px((innerH-inkH)/2+ink.actualBoundingBoxAscent-baseline)});
  return size;
}

function lineInkClearance(line,height,entries) {
  const document=line.ownerDocument,style=document.defaultView.getComputedStyle(line);
  const context=document.createElement('canvas').getContext('2d');
  context.font=`${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  context.fontStretch='normal';
  const marker=document.createElement('span');
  marker.style.cssText='display:inline-block;width:0;height:0;padding:0;margin:0;vertical-align:baseline;';
  line.appendChild(marker);
  const scale=line.getBoundingClientRect().height/height;
  const baseline=(marker.getBoundingClientRect().top-line.getBoundingClientRect().top)/scale;
  marker.remove();
  const descent=Math.max(0,...entries.map(({word})=>context.measureText(word.textContent).actualBoundingBoxDescent));
  return Math.max(.001,height-baseline-descent);
}

function beforeAfter({p,cam,fg,accent,bg,K}) {
  const s=p.scene,t=metadata['before-after-wipe'].times(s,p.dur),ui=kit(K,cam,'before-after-wipe');
  const {root,node,text,set,px,S,design:D,w,h}=ui;set(root,{color:fg});
  const panelW=w,x=0,gap=D.space(3),titleGap=D.space(4);
  const title=s.title?text('title',root,s.title,x,0,panelW,D.type('sceneTitle').lineHeight*3,'sceneTitle'):null;
  const titleH=title?.offsetHeight??0,labelH=D.type('caption').lineHeight*2;
  const panelH=Math.min(h*.61,panelW*.83,h-titleH-(title?titleGap:0)-gap-labelH);
  if(panelH<D.space(7))throw new Error('Before/after copy leaves no room for its comparison surface');
  const total=titleH+(title?titleGap:0)+panelH+gap+labelH;
  let y=title?0:(h-total)/2;
  if(title){set(title,{top:px(y)});y+=titleH+titleGap;}
  const stage=node('div','wipe-stage');set(stage,{position:'absolute',left:px(x),top:px(y),width:px(panelW),height:px(panelH),overflow:'hidden',background:bg,boxShadow:`0 0 0 ${px(2*S)} ${K.alpha(fg,.2)}`});
  D.surface(stage,'card',{layout:'frame',purpose:'media'});
  const makeSurface=(kind,index)=>{
    const layer=node('div',kind,stage);set(layer,{position:'absolute',inset:'0',background:bg});
    if(s.images){const img=node('img',kind+'-image',layer);img.src=K.images[s.images[index]].src;img.alt='';set(img,{width:'100%',height:'100%',objectFit:'cover',display:'block'});}
    else {
      // Abstract token wireframes from upstream; no invented product data.
      const pad=D.space(4),headH=D.space(3);
      const head=node('div',kind+'-header',layer);set(head,{position:'absolute',left:px(pad),top:px(pad),width:px(panelW-2*pad),height:px(headH),background:K.alpha(index?accent:fg,index?.8:.15),borderRadius:px(D.radius(2))});
      for(let i=0;i<3;i++){
        const card=node('div',kind+'-tile',layer);set(card,{position:'absolute',left:px(pad+i*(panelW-2*pad)/3),top:px(pad+headH+D.space(2)),width:px((panelW-2*pad)/3-D.space(2)),height:px(panelH*.31),background:K.alpha(index?accent:fg,index?.17:.06),border:`${px(2*S)} solid ${K.alpha(index?accent:fg,.28)}`,borderRadius:px(D.radius(index?4:1))});
      }
      for(let i=0;i<3;i++){const bar=node('div',kind+'-line',layer);set(bar,{position:'absolute',left:px(pad),top:px(panelH*.64+i*panelH*.082),width:px((panelW-2*pad)*(index?[.8,.64,.92][i]:[.92,.92,.92][i])),height:px(D.space(1)),background:K.alpha(index?accent:fg,index?.5:.16),borderRadius:px(D.radius(1))});}
    }
    return layer;
  };
  makeSurface('before',0);const after=makeSurface('after',1);
  const divider=node('div','divider',stage);set(divider,{position:'absolute',top:'0',bottom:'0',width:px(3*S),background:accent,transform:'translateX(-50%)'});
  const knob=node('div','divider-knob',divider);set(knob,{position:'absolute',left:'50%',top:'50%',width:px(D.space(3)),height:px(D.space(4)),borderRadius:px(D.radius(3)),background:accent,transform:'translate(-50%,-50%)',border:`${px(3*S)} solid ${bg}`});
  const half=(panelW-gap)/2;
  text('before-label',root,s.before,x,y+panelH+gap,half,labelH,'caption');
  const afterLabel=text('after-label',root,s.after,x+half+gap,y+panelH+gap,half,labelH,'caption');set(afterLabel,{textAlign:'right'});
  return l=>{
    const u=clamp((l-t.wipe)/t.duration),progress=.5-.5*Math.cos(Math.PI*u),split=(s.split??50)*progress;
    set(stage,{opacity:String(1-(1-clamp(l/t.enter))**3)});
    set(after,{clipPath:`inset(0 ${100-split}% 0 0)`});
    set(divider,{left:`${split}%`,opacity:String(1-(1-clamp((l-t.wipe)/Math.min(.22,t.duration)))**2)});
    root.dataset.registryProgress=String(progress);root.dataset.registrySplit=String(split);
  };
}

function testimonial({p,cam,fg,accent,bg,K}) {
  const s=p.scene,t=metadata['testimonial-proof-card'].times(s,p.dur),ui=kit(K,cam,'testimonial-proof-card');
  const {root,node,text,set,px,S,design:D,w,h}=ui;set(root,{color:fg});
  const square=K.H===K.W,density=square?'compact':'normal',recipe=D.box('card',{density});
  const cardW=w,pad=recipe.paddingX,innerW=cardW-2*pad-4*S,sectionGap=recipe.gap;
  const card=node('div','quote-card');card.dataset.designPadding=String(pad);
  set(card,{position:'absolute',left:'0',top:'0',width:px(cardW),height:px(h),background:bg,border:`${px(2*S)} solid ${K.alpha(fg,.24)}`,boxSizing:'border-box'});
  D.surface(card,'card',{density,layout:'absolute'});
  const author=node('div','byline',card);set(author,{position:'absolute',left:px(pad),top:'0',width:px(innerW)});
  let avatarSize=D.space(6);
  const avatar=node('div','avatar',author);set(avatar,{position:'absolute',left:'0',top:'0',width:px(avatarSize),height:px(avatarSize),borderRadius:'50%',overflow:'hidden',border:`${px(2*S)} solid ${K.alpha(fg,.3)}`,background:bg,boxSizing:'border-box'});
  if(s.image){const img=node('img','avatar-image',avatar);img.src=K.images[s.image].src;img.alt='';set(img,{width:'100%',height:'100%',objectFit:'cover'});}
  else {
    const initials=s.name.trim().split(/\s+/u).map(v=>[...v][0]).slice(0,2).join('').toUpperCase();
    avatar.dataset.registryInitialsConvention='uppercase';
    avatarSize=centeredInitials(K,avatar,initials,node,D);
  }
  const authorX=avatarSize+D.space(2),authorW=innerW-authorX,bylineGap=D.space(1);
  let bylineH=0;
  for(const [role,value,typeRole] of [['author',s.name,'name'],['role',s.role,'meta'],['company',s.company,'meta']]){
    if(!value)continue;
    const line=node('div',role,author,value);line.dataset.registryText=role;
    set(line,{position:'absolute',left:px(authorX),top:px(bylineH),width:px(authorW)});
    D.apply(line,typeRole);D.truncateLine(line);
    bylineH+=line.offsetHeight+bylineGap;
  }
  bylineH=Math.max(avatarSize,bylineH-bylineGap);
  const quoteH=h-2*pad-4*S-bylineH-sectionGap;
  const quote=node('div','quote',card);quote.dataset.registryText='quote';quote.setAttribute('aria-label',s.quote);
  D.apply(quote,'quote');
  set(quote,{position:'absolute',left:px(pad),top:px(pad),width:px(innerW),whiteSpace:'normal'});
  const words=[];let cursor=0;
  const emStart=s.emphasis?s.quote.indexOf(s.emphasis):-1,emEnd=emStart+(s.emphasis?.length??0);
  // Keep original whitespace, then measure rows with the actual loaded brand font.
  for(const part of s.quote.match(/\S+\s*|\s+/gu)??[]){
    const word=node('span','quote-word',quote,part.trimEnd());
    set(word,{display:'inline-block',whiteSpace:'nowrap'});
    const end=cursor+part.trimEnd().length;
    word.dataset.emphasis=String(emStart>=0&&end>emStart&&cursor<emEnd);
    const space=part.slice(part.trimEnd().length);
    if(space)quote.appendChild(quote.ownerDocument.createTextNode(space));
    words.push({word,space});cursor+=part.length;
  }
  // An unbroken URL/identifier or a CJK phrase must not create a wider-than-card
  // inline box even at the role's minimum step. Split only those oversized
  // tokens into graphemes; normal words retain their shaping and natural spaces.
  quote.style.fontSize=px(D.type('quote').minSize);
  let segments;
  for(let i=0;i<words.length;i++){
    const entry=words[i];if(entry.word.offsetWidth<=innerW+1)continue;
    segments??=new Intl.Segmenter(undefined,{granularity:'grapheme'});
    const chunks=[...segments.segment(entry.word.textContent)].map(({segment},j,all)=>{
      const word=node('span','quote-word',null,segment);set(word,{display:'inline-block',whiteSpace:'nowrap'});
      word.dataset.emphasis=entry.word.dataset.emphasis;entry.word.before(word);
      return {word,space:j===all.length-1?entry.space:''};
    });
    entry.word.remove();words.splice(i,1,...chunks);i+=chunks.length-1;
  }
  D.fit(quote,{role:'quote',w:innerW,h:quoteH});
  D.surfaceContent(card,quote);D.surfaceContent(card,author);
  const cardH=quote.offsetHeight+bylineH+2*pad+4*S+sectionGap;
  set(card,{top:px((h-cardH)/2),height:px(cardH)});
  set(author,{top:px(cardH-pad-4*S-bylineH),height:px(bylineH)});
  const rows=[];
  for(const entry of words){const top=entry.word.offsetTop;let row=rows.at(-1);if(!row||Math.abs(row.top-top)>2){row={top,entries:[]};rows.push(row);}row.entries.push(entry);}
  const lineH=parseFloat(getComputedStyle(quote).lineHeight);
  quote.textContent='';const lines=[],paths=[];
  const ns='http://www.w3.org/2000/svg';
  for(const [i,row] of rows.entries()){
    const mask=node('div','quote-mask',quote);set(mask,{height:px(lineH),overflow:'hidden',position:'relative'});
    const line=node('div','quote-line',mask);set(line,{height:px(lineH),lineHeight:px(lineH),whiteSpace:'nowrap',position:'relative'});
    for(const {word,space} of row.entries){line.appendChild(word);if(space)line.appendChild(line.ownerDocument.createTextNode(space));}
    const marked=row.entries.filter(({word})=>word.dataset.emphasis==='true');
    if(marked.length){
      const first=marked[0].word,last=marked.at(-1).word,x=first.offsetLeft,width=last.offsetLeft+last.offsetWidth-x;
      const svg=quote.ownerDocument.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 100 12');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');
      set(svg,{position:'absolute',left:px(x),top:px(lineH*.88),width:px(width),height:px(lineH*.12),overflow:'visible'});
      const path=quote.ownerDocument.createElementNS(ns,'path');path.setAttribute('d','M 2 7 C 20 4.5, 46 8.5, 66 6 C 80 4.5, 92 7.5, 98 5.5');path.setAttribute('fill','none');path.setAttribute('stroke',accent);path.setAttribute('stroke-width','4.5');path.setAttribute('stroke-linecap','round');svg.appendChild(path);line.appendChild(svg);
      const length=path.getTotalLength();path.style.strokeDasharray=String(length);paths.push({path,length});
    }
    lines.push({line,clearance:lineInkClearance(line,lineH,row.entries),at:t.lines+(rows.length<2?0:i/(rows.length-1)*(t.lastLine-t.lines))});
  }
  root.dataset.registryLines=String(rows.length);
  return l=>{
    const cardP=out(l/t.enter);set(card,{opacity:String(cardP),transform:`translateY(${(1-cardP)*D.space(3)}px)`});
    for(const {line,at,clearance} of lines){
      const u=out((l-at)/t.lineDuration),shift=(1-u)*lineH*1.3;
      // Mask travel stays translucent. Complete the fade only after the
      // measured descenders clear the aperture, preserving readable glyphs.
      const clear=clamp((clearance-shift)/clearance);
      set(line,{opacity:String(u*(.65+.35*clear)),transform:`translateY(${shift}px)`});
    }
    const byline=out((l-t.byline)/t.bylineDuration);set(author,{opacity:String(byline),transform:`translateY(${(1-byline)*D.space(2)}px)`});
    const raw=clamp((l-t.draw)/t.drawDuration),draw=raw<.5?4*raw**3:1-(-2*raw+2)**3/2;
    for(const {path,length} of paths){path.style.opacity=l>t.draw?'1':'0';path.style.strokeDashoffset=String(length*(1-draw));}
    root.dataset.registryProgress=String(clamp(l/t.settled));root.dataset.registryUnderline=String(draw);
  };
}
export const sceneFactories={'before-after-wipe':beforeAfter,'testimonial-proof-card':testimonial};
