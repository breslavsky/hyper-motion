/*
 * Derivative adaptations of HyperFrames registry screen-flow-carousel and
 * modal-morph, distributed under Apache-2.0. See the pinned provenance in
 * ../upstream/hyperframes-registry-01/RECEIPT.json and its LICENSE for upstream
 * URLs, original files, hashes and license text.
 * Changes: instance-local K factories; three authored layouts; supplied brand
 * typography/colors and exact copy; persistent counter-scaled modal text;
 * deterministic local-time sampling and explicit semantic audit attributes.
 * The upstream throw/catch and FLIP counter-scaling mathematics are retained.
 */
import metadata from '../metadata.mjs';
import {createDesignSystem} from '../design-system.mjs';

const clamp=v=>Math.max(0,Math.min(1,v));
const progress=(t,start,duration)=>clamp((t-start)/Math.max(.000001,duration));
const lerp=(a,b,p)=>a+(b-a)*p;
const out=(u,power=3)=>1-(1-clamp(u))**power;
const snappy=u=>1+1.7*(u-1)**3+.7*(u-1)**2;
const attr=(node,key,value)=>node.setAttribute(`data-registry-${key}`,String(value));

function node(K,tag,parent,styles={},text) {
  const el=K.el(tag,'',parent,text);
  // New components expose actual findings; none of their text is exempted
  // from native clipping, overlap or occlusion checks by the generic helper.
  for(const key of ['overlap','occlusion','overflow'])el.removeAttribute(`data-layout-allow-${key}`);
  K.set(el,{boxSizing:'border-box',...styles});
  return el;
}
function rootFor(K,cam,name,fg) {
  const root=node(K,'div',cam,{position:'absolute',inset:'0',color:fg,fontFamily:'var(--fd)',isolation:'isolate'});
  attr(root,'component',name);attr(root,'item',name);return root;
}

// Original token skeleton variants: list / cards / bars / detail. They contain
// no product names, claims, numbers or default captions.
function skeleton(K,design,parent,index,fg,accent,bg) {
  const {S,px,alpha}=K,recipe=design.box('card',{density:'compact'});
  // The embedded abstract UI has seven rows plus its footer. Scale that whole
  // miniature system to the available screen, preserving its internal rhythm.
  // Readable captions use the scene design system outside this media frame.
  const minimumHeight=recipe.paddingY*2+recipe.gap*7+design.space(2)*7+design.space(3);
  const D=design.forSurface(Math.min(1,parent.clientHeight/minimumHeight));
  const furniture=node(K,'div',parent,{position:'absolute',inset:'0',display:'flex',flexDirection:'column'});
  D.surface(furniture,'card',{density:'compact'});
  D.nest(furniture,parent,{inset:parseFloat(getComputedStyle(parent).borderLeftWidth)});
  attr(furniture,'slot','abstract');furniture.setAttribute('aria-hidden','true');
  const line=(host,width,height=D.space(1),color=alpha(fg,.15))=>node(K,'div',host,{width,height:px(height),flex:'0 0 auto',borderRadius:px(height/2),background:color});
  line(furniture,index%4===3?'56%':'38%',D.space(2),alpha(fg,.3));
  if(index%4===0){
    for(const [i,w] of ['86%','72%','80%','64%','76%','58%'].entries()){
      const row=node(K,'div',furniture,{display:'flex',alignItems:'center',gap:px(D.space(2)),height:px(D.space(2))});
      node(K,'div',row,{width:px(D.space(1)),height:px(D.space(1)),borderRadius:'50%',flex:'none',background:i===0?accent:alpha(fg,.22)});
      line(row,w);
    }
    node(K,'div',furniture,{flex:'1',minHeight:px(D.space(3)),borderRadius:px(D.radius(3)),background:alpha(fg,.08)});
  }else if(index%4===1){
    const grid=node(K,'div',furniture,{display:'grid',gridTemplateColumns:'1fr 1fr',gridTemplateRows:'1fr 1fr',gap:px(D.space(2)),flex:'1',minHeight:'0'});
    for(let i=0;i<4;i++){
      const card=node(K,'div',grid,{display:'flex',flexDirection:'column',border:`${px(1.5*S)} solid ${alpha(fg,.2)}`});
      D.forSurface(2/3).surface(card,'card',{density:'compact'});
      line(card,'60%');node(K,'div',card,{flex:'1',minHeight:px(D.space(2)),borderRadius:px(D.radius(2)),background:i===0?alpha(accent,.3):alpha(fg,.1)});
    }
  }else if(index%4===2){
    const bars=node(K,'div',furniture,{display:'flex',alignItems:'flex-end',gap:px(D.space(2)),flex:'1',minHeight:'0'});
    [.34,.58,.42,.76,.50,.64].forEach((h,i)=>node(K,'div',bars,{height:`${h*100}%`,flex:'1',borderRadius:`${px(D.radius(2))} ${px(D.radius(2))} 0 0`,background:i===3?accent:alpha(fg,.18)}));
    line(furniture,'46%');
  }else{
    line(furniture,'28%',D.space(3),alpha(accent,.4));
    ['84%','72%','64%'].forEach(w=>line(furniture,w));
    node(K,'div',furniture,{flex:'1',minHeight:px(D.space(4)),borderRadius:px(D.radius(3)),background:K.mixHex(bg,fg,.09)});
  }
}

const sceneFactories={};
sceneFactories['screen-flow-carousel']=({p,cam,fg,accent,bg,K})=>{
  const s=p.scene,{S,W,H,safe,set,px}=K,D=createDesignSystem(K),t=metadata['screen-flow-carousel'].times(s,p.dur,p.beatLen);
  const tall=H>W*1.2,wide=W>H*1.2,root=rootFor(K,cam,'screen-flow-carousel',fg);
  const stage=node(K,'div',root,{position:'absolute',inset:'0'}),gap=D.space(4);
  let titleHeight=0;
  if(s.title){
    const title=D.text(stage,s.title,{role:'sceneTitle',box:{x:safe.x,y:safe.y,w:safe.w,h:D.type('sceneTitle').lineHeight*3}});
    titleHeight=title.h;attr(title.el,'key','title');attr(title.el,'role','title');
  }
  // Every caption shares one measured band. A long label cannot change the rail
  // geometry mid-sequence or enlarge a shorter label to fill the empty space.
  const captions=s.screens.map((screen,i)=>{
    const caption=D.text(stage,screen.label,{role:'caption',align:'center',box:{x:safe.x+D.space(2),w:safe.w-2*D.space(2),h:D.type('caption').lineHeight*3}});
    attr(caption.el,'caption',i);attr(caption.el,'key',`screen-${i}`);attr(caption.el,'role','caption');return caption;
  });
  const captionH=Math.max(...captions.map(c=>c.h)),railY=safe.y+titleHeight+(s.title?gap:0);
  const railH=safe.h-titleHeight-captionH-gap*(s.title?2:1);
  if(railH<D.space(9))throw new Error('screen-flow-carousel: copy leaves no room for a screen');
  const cardW=safe.w*(tall?.84:wide?.48:.72),pitch=cardW+D.space(3);
  const clip=node(K,'div',stage,{position:'absolute',left:px(safe.x),top:px(railY),width:px(safe.w),height:px(railH),overflow:'hidden'});
  attr(clip,'clip','screen-rail');clip.dataset.designGap=String(gap);
  const rail=node(K,'div',clip,{position:'absolute',left:'0',top:'0',height:px(railH),width:px(pitch*s.screens.length),transformOrigin:'0 0'});
  const nodes=s.screens.map((screen,i)=>{
    const card=node(K,'article',rail,{position:'absolute',left:px(i*pitch),top:px(D.space(1)),width:px(cardW),height:px(railH-2*D.space(1)),overflow:'hidden',border:`${px(2*S)} solid ${K.alpha(fg,.3)}`,background:K.mixHex(bg,fg,.075),transformOrigin:'50% 50%'});
    D.surface(card,'card',{layout:'frame',purpose:'media'});
    attr(card,'screen',i);attr(card,'role','screen');card.setAttribute('aria-label',screen.label);
    const image=s.images?.[i];
    if(image){
      const img=node(K,'img',card,{display:'block',width:'100%',height:'100%',objectFit:'contain',background:bg});img.alt='';img.src=K.images[image]?.src??image;
      attr(img,'slot','image');
      if(img.decode)K.defer(img.decode());
    }else skeleton(K,D,card,i,fg,accent,bg);
    const ring=node(K,'div',card,{position:'absolute',inset:'0',border:`${px(3*S)} solid ${accent}`,borderRadius:'inherit',pointerEvents:'none'});
    attr(ring,'ring',i);
    const caption=captions[i];set(caption.el,{top:px(railY+railH+gap)});
    return {card,ring,caption};
  });
  return local=>{
    let position=0,active=0,advance=-1,u=0;
    for(let i=0;i<t.starts.length;i++){
      if(local<t.starts[i])break;
      advance=i;u=progress(local,t.starts[i],t.advance);active=i+1;
      position=i+(u<.42?.86*out(u/.42,5):.86+.14*out((u-.42)/.58,3));
    }
    const entering=out(progress(local,0,t.enter),4),fade=out(progress(local,0,t.enter*.7),3);
    set(stage,{opacity:String(fade),transform:`translateY(${px((1-entering)*40*S)})`});
    set(rail,{transform:`translateX(${px((safe.w-cardW)/2-position*pitch)})`});
    attr(root,'position',position.toFixed(6));attr(root,'active-screen',active);attr(root,'phase',local<t.enter?'enter':advance>=0&&u<1?'advance':'hold');
    attr(root,'event',advance>=0?`screen.advance:${active}`:'screen.enter:0');
    for(const [i,item] of nodes.entries()){
      let focus=i===active?1:0,ring=focus,captionOpacity=focus,captionY=0;
      if(advance>=0&&u<1){
        const q=out(u,3);
        if(i===advance){focus=1-q;ring=1-out(progress(u,0,.5),2);captionOpacity=1-progress(u,0,.4)**2;captionY=-12*S*progress(u,0,.4)**2;}
        else if(i===active){focus=q;ring=out(progress(u,.4,.6),3);captionOpacity=out(progress(u,.4,.55),3);captionY=12*S*(1-captionOpacity);}
        else {focus=0;ring=0;captionOpacity=0;}
      }
      set(item.card,{transform:`scale(${(.94+.06*focus).toFixed(6)})`,opacity:String(.62+.38*focus)});
      set(item.ring,{opacity:String(ring)});
      set(item.caption.el,{opacity:String(captionOpacity),visibility:captionOpacity>0?'visible':'hidden',transform:`translateY(${px(captionY)})`});
      item.card.setAttribute('aria-current',String(i===active));attr(item.card,'active',i===active);attr(item.caption.el,'visible',captionOpacity>0);
    }
  };
};

sceneFactories['modal-morph']=({p,cam,fg,accent,bg,K})=>{
  const s=p.scene,{S,W,H,safe,set,px}=K,D=createDesignSystem(K),t=metadata['modal-morph'].times(s,p.dur,p.beatLen);
  const tall=H>W*1.2,wide=W>H*1.2,root=rootFor(K,cam,'modal-morph',fg);
  const control=D.control('button'),panelW=safe.w*(wide?.86:1),cardW=panelW*(wide?.7:tall?.94:1);
  // Fit the complete stack together: spacing first, then the next permitted
  // heading rung. Body and control roles keep their readable token floors.
  function compose(compact,titleStep){
    const density=compact?'compact':'normal',recipe=D.box('card',{density});
    const pad=recipe.paddingX,gap=recipe.gap,actionGap=gap,dotSize=D.space(4),textW=cardW-2*pad-4*S;
    const panel=node(K,'div',root,{position:'absolute',width:px(panelW),transformOrigin:'0 0',border:`${px(2*S)} solid ${K.alpha(fg,.3)}`,background:K.mixHex(bg,fg,.075),boxShadow:`0 ${px(D.space(2))} ${px(D.space(5))} ${K.alpha(bg,.36)}`});
    D.surface(panel,'card',{density,layout:'absolute'});
    try{
      attr(panel,'surface','shared-card-panel');attr(panel,'role','surface');panel.dataset.designPadding=String(pad);panel.dataset.designGap=String(gap);panel.dataset.designDensity=compact?'compact':'normal';
      const dot=node(K,'div',panel,{position:'absolute',width:px(dotSize),height:px(dotSize),borderRadius:'50%',background:accent,transformOrigin:'0 0'});
      attr(dot,'key','dot');dot.dataset.morphKey='dot';
      const eyebrowNode=s.eyebrow?node(K,'div',panel,{position:'absolute',width:px(textW-dotSize-gap)},s.eyebrow):null;
      if(eyebrowNode){D.apply(eyebrowNode,'label');D.truncateLine(eyebrowNode);}
      const eyebrow=eyebrowNode?{el:eyebrowNode,h:eyebrowNode.offsetHeight}:null;
      const eyeH=eyebrow?.h??0,titleY=pad+Math.max(dotSize,eyeH)+D.space(1);
      // Preserve one full-width title column throughout the shared-element move.
      const title=D.text(panel,s.title,{role:'cardTitle',maxStep:titleStep,box:{w:textW,h:D.type('cardTitle').lineHeight*3}});
      const startTitleY=titleY,cardH=startTitleY+title.h+pad+4*S,bodyY=titleY+title.h+gap;
      const innerW=panelW-2*pad-4*S,button=node(K,'div',panel,{position:'absolute',background:accent,color:K.textOn(accent),borderRadius:px(control.radius),transformOrigin:'0 0'});
      const ctaNode=node(K,'div',button,{position:'absolute',left:px(control.paddingX),width:px(innerW-2*control.paddingX),textAlign:'center'},s.cta);
      D.apply(ctaNode,control.role);D.truncateLine(ctaNode);
      const cta={el:ctaNode,h:ctaNode.offsetHeight};
      // Fixed control typography and measured intrinsic width replace fit-to-fill.
      const range=cta.el.ownerDocument.createRange();range.selectNodeContents(cta.el);
      const renderedWidth=cta.el.getBoundingClientRect().width;
      const textWidth=Math.max(...[...range.getClientRects()].map(r=>r.width),0)*(innerW-2*control.paddingX)/renderedWidth;
      const buttonW=Math.min(innerW,Math.ceil(textWidth+2*control.paddingX)),buttonH=Math.max(control.height,cta.h+2*control.paddingY);
      set(button,{width:px(buttonW),height:px(buttonH)});set(cta.el,{width:px(buttonW-2*control.paddingX),top:px((buttonH-cta.h)/2)});
      button.dataset.designControl='button';button.dataset.designPaddingX=String(control.paddingX);button.dataset.designPaddingY=String(control.paddingY);
      attr(cta.el,'key','cta');attr(cta.el,'role','cta');cta.el.dataset.morphKey='cta';
      const bodyMax=safe.h-bodyY-actionGap-buttonH-pad-4*S;
      const body=D.text(panel,s.body,{role:'body',box:{x:pad,y:bodyY,w:innerW,h:bodyMax}});
      const panelH=bodyY+body.h+actionGap+buttonH+pad+4*S;
      const target={x:safe.x+(safe.w-panelW)/2,y:safe.y+(safe.h-panelH)/2,w:panelW,h:panelH};
      const source={x:safe.x+(safe.w-cardW)/2,y:safe.y+(safe.h-cardH)/2,w:cardW,h:cardH};
      set(panel,{left:px(target.x),top:px(target.y),height:px(panelH)});
      return {pad,gap,actionGap,dotSize,panelH,panel,dot,eyebrow,title,body,button,titleY,startTitleY,bodyY,buttonH,target,source};
    }catch(error){panel.remove();throw error;}
  }
  function resolveLayout(){
    let lastError;
    for(const {step} of D.steps('cardTitle'))for(const compact of [false,true]){
      try{return compose(compact,step);}
      catch(error){
        if(!String(error.message).startsWith('Design text cannot fit role'))throw error;
        lastError=error;
      }
    }
    throw lastError;
  }
  const layout=resolveLayout();
  const {pad,gap,actionGap,dotSize,panelH,panel,dot,eyebrow,title,body,button,titleY,startTitleY,bodyY,buttonH,target,source}=layout;
  const entries=[];
  const key=(item,name,from,to)=>{
    const el=item.el??item;attr(el,'key',name);attr(el,'role',name);el.dataset.morphKey=name;
    set(el,{left:px(to.x),top:px(to.y),transformOrigin:'0 0'});
    D.surfaceContent(panel,el);
    entries.push({el,from,to,name});
  };
  key(dot,'dot',{x:pad,y:pad},{x:pad,y:pad});
  if(eyebrow)key(eyebrow,'eyebrow',{x:pad+dotSize+gap,y:pad},{x:pad+dotSize+gap,y:pad});
  key(title,'title',{x:pad,y:startTitleY},{x:pad,y:titleY});
  key(body,'body',{x:pad,y:bodyY},{x:pad,y:bodyY});
  key(button,'action',{x:pad,y:panelH-pad-4*S-buttonH},{x:pad,y:panelH-pad-4*S-buttonH});
  // Both authored rects are fixed at construction. The persistent child nodes
  // keep their measured native size; reciprocal scales cancel the surface FLIP.
  attr(root,'from',JSON.stringify(source));attr(root,'to',JSON.stringify(target));
  return local=>{
    // Calm UI panels open promptly and settle gently; the event/landing time
    // remains the shared metadata endpoint. Snappy retains its overshoot.
    const u=progress(local,t.expand,t.morph),q=s.register==='snappy'?snappy(u):out(u,3);
    const rect={x:lerp(source.x,target.x,q),y:lerp(source.y,target.y,q),w:lerp(source.w,target.w,q),h:lerp(source.h,target.h,q)};
    const sx=rect.w/target.w,sy=rect.h/target.h,enter=progress(local,0,t.enter);
    const currentHead=Math.max(pad+dotSize,lerp(startTitleY,titleY,q)+title.h);
    const currentBodyY=currentHead+gap;
    // Body copy becomes readable as soon as its own measured block fits. The
    // action waits for the complete stack, preserving room between both texts.
    const bodyRoom=clamp((rect.h-currentBodyY-body.h)/D.space(1));
    const actionRoom=clamp((rect.h-currentBodyY-body.h-buttonH-pad-actionGap+D.space(1))/D.space(1));
    const bodyLate=out(progress(u,.3,.4),2)*bodyRoom;
    const actionLate=out(progress(u,.55,.45),2)*actionRoom;
    set(panel,{transform:`translate(${px(rect.x-target.x)},${px(rect.y-target.y)}) scale(${sx.toFixed(8)},${sy.toFixed(8)})`,opacity:String(enter)});
    D.surfaceRadius(panel,{scaleX:sx,scaleY:sy});
    for(const entry of entries){
      const desiredX=lerp(source.x+entry.from.x,target.x+entry.to.x,q);
      const desiredY=entry.name==='body'?rect.y+currentBodyY
        :entry.name==='action'?rect.y+rect.h-pad-4*S-buttonH
          :lerp(source.y+entry.from.y,target.y+entry.to.y,q);
      const tx=(desiredX-rect.x-entry.to.x*sx)/sx,ty=(desiredY-rect.y-entry.to.y*sy)/sy;
      const reveal=entry.name==='body'?bodyLate:entry.name==='action'?actionLate:1;
      set(entry.el,{transform:`translate(${px(tx)},${px(ty)}) scale(${(1/sx).toFixed(8)},${(1/sy).toFixed(8)})`,opacity:String(reveal),visibility:reveal===0?'hidden':'visible'});
    }
    attr(root,'phase',local<t.expand?'card':u<1?'morph':'panel');attr(root,'progress',q.toFixed(8));attr(root,'body-visible',bodyLate>0);attr(root,'event',local<t.expand?'modal.enter':u<1?'modal.expand':'modal.ready');
  };
};

export {sceneFactories};
