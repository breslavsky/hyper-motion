// Native adaptations of two community techniques. Provenance is in each definition.
// Construction is instance-local; every pose, guide and tether comes from local time.
import metadata from '../../metadata.mjs';

const clamp = value => Math.max(0,Math.min(1,value));
const progress = (time,from,to) => clamp((time-from)/Math.max(.0001,to-from));
const smooth = value => {const x=clamp(value);return x*x*(3-2*x);};
const cubicInOut = value => {const x=clamp(value);return x<.5?4*x*x*x:1-(-2*x+2)**3/2;};
const cubicOut = value => 1-(1-clamp(value))**3;
const sineInOut = value => (1-Math.cos(Math.PI*clamp(value)))/2;
const NS='http://www.w3.org/2000/svg';

function svgNode(parent,tag,attributes={}) {
  const node=parent.ownerDocument.createElementNS(NS,tag);
  for(const [name,value] of Object.entries(attributes))node.setAttribute(name,String(value));
  parent.appendChild(node);
  return node;
}

function svgLayer(K,parent) {
  const node=svgNode(parent,'svg',{viewBox:`0 0 ${K.W} ${K.H}`,width:K.W,height:K.H,class:'deco'});
  K.set(node,{position:'absolute',inset:'0',overflow:'visible',pointerEvents:'none'});
  return node;
}

/** Responsive form of the reference's focus packet and delayed sine wave. */
export function accordionFrame({W,H,S,safe,design},count,time,times) {
  const vertical=W<=H*1.2;
  const length=(vertical?safe.h:safe.w)*.88;
  const base=Math.min(length/(count*.92+1.3),vertical?safe.w*.25:340*S);
  const focus=-1.6+(count+2.2)*progress(time,times.start,times.focusEnd);
  const ramp=Math.max(.001,(times.waveEnd-times.focusEnd)*.16);
  const waveGain=smooth((time-times.focusEnd)/ramp)*(1-smooth(progress(time,times.waveEnd,times.end)));
  const sizes=Array.from({length:count},(_,i)=>base*(1+.4*smooth(1-Math.abs(i-focus)/1.6)));
  const total=sizes.reduce((a,b)=>a+b,0)-base*.08*(count-1);
  let along=(vertical?safe.y+safe.h/2:safe.x+safe.w/2)-total/2;
  const boxes=sizes.map((size,i)=>{
    const sway=base*.28*Math.sin(2*Math.PI*(time-times.focusEnd)/times.period-i*.5)*waveGain;
    const lean=base*.045*(i-focus)*(1-progress(time,times.start,times.focusEnd));
    const box=vertical
      ? {x:safe.x+safe.w*.11+sway*.65+lean,y:along,size}
      : {x:along,y:safe.y+safe.h*.58-size/2+sway+lean,size};
    along+=size-base*.08;
    return box;
  });
  const labelW=vertical?safe.w*.42:base*.90;
  const labelH=Math.max(vertical?Math.min(base*.8,100*S):base*.54,(vertical?2:3)*(design?.steps('controlLabel').at(-1).lineHeight??48*S));
  const labels=boxes.map(box=>vertical
    ? {x:safe.x+safe.w*.54,y:box.y+(box.size-labelH)/2,w:labelW,h:labelH}
    : {x:box.x+base*.04,y:box.y-labelH-22*S,w:labelW,h:labelH});
  const left=Math.min(...boxes.map(box=>box.x)),right=Math.max(...boxes.map(box=>box.x+box.size));
  const top=Math.min(...boxes.map(box=>box.y)),bottom=Math.max(...boxes.map(box=>box.y+box.size));
  return {vertical,base,boxes,labels,bounds:{left,right,top,bottom}};
}

/** CSS's rotateX * rotateZ * scale, followed by the parent perspective. */
export function projectPlane(point,{cx,cy,perspective,tilt,turn,scale}) {
  const ax=tilt*Math.PI/180,az=turn*Math.PI/180;
  const x=point.x*scale,y=point.y*scale,z=point.z*scale;
  const rx=x*Math.cos(az)-y*Math.sin(az),ry=x*Math.sin(az)+y*Math.cos(az);
  const yy=ry*Math.cos(ax)-z*Math.sin(ax),zz=ry*Math.sin(ax)+z*Math.cos(ax);
  const k=perspective/(perspective-zz);
  return {x:cx+rx*k,y:cy+yy*k};
}

export function explodeFrame({W,H,S,safe,design},count,time,times) {
  const wide=W>H*1.2;
  // Solve the entire depth envelope before sizing it. The heading and flat
  // labels keep their own space even when the outer planes are fully spread.
  const envelope=[];
  for(const [tilt,turn,scale] of [[0,0,1],[29,-19,.96],[58,-38,.92],[58,-32,.92]]){
    for(const depth of [0,.115])for(const i of [0,count-1])for(const x of [-.5,.5])for(const y of [-.3175,.3175]){
      envelope.push(projectPlane({x,y,z:(i-(count-1)/2)*depth},{cx:0,cy:0,perspective:1.6,tilt,turn,scale}));
    }
  }
  const left=Math.min(...envelope.map(p=>p.x)),right=Math.max(...envelope.map(p=>p.x));
  const top=Math.min(...envelope.map(p=>p.y)),bottom=Math.max(...envelope.map(p=>p.y));
  const area=wide
    ? {x:safe.x+safe.w*.02,y:safe.y+safe.h*.18,w:safe.w*.59,h:safe.h*.72}
    : {x:safe.x+safe.w*.02,y:safe.y+safe.h*.18,w:safe.w*.96,h:safe.h*.41};
  const width=Math.min(area.w/(right-left),area.h/(bottom-top),760*S);
  const height=width*.635;
  const cx=area.x+(area.w-(right-left)*width)/2-left*width;
  const cy=area.y+(area.h-(bottom-top)*width)/2-top*width;
  const tipped=cubicInOut(progress(time,times.tilt,times.tilted))*(1-cubicInOut(progress(time,times.collapsed,times.flat)));
  const spread=cubicOut(progress(time,times.spread,times.separated))*(1-cubicInOut(progress(time,times.collapse,times.collapsed)));
  const tilt=58*tipped,turn=-38*tipped+6*sineInOut(progress(time,times.separated,times.hold))*tipped;
  const scale=1-.08*tipped,perspective=width*1.6;
  const gap=width*.115*spread;
  const pose={cx,cy,perspective,tilt,turn,scale};
  const labelW=wide?safe.w*.30:safe.w*.80;
  // Reserve at least one Radix control-label line plus the token gap.
  // Pure geometry callers use the same minimum at the standard 3px unit.
  const labelMin=design?design.type('controlLabel',1).lineHeight:48*S;
  const labelGap=design?design.space(1):12*S;
  const pitch=wide?safe.h*.65/count:Math.max(safe.h*.30/count,labelMin+labelGap);
  const labels=Array.from({length:count},(_,i)=>wide
    ? {x:safe.x+safe.w*.68,y:safe.y+safe.h*.30+(count-1-i)*pitch,w:labelW,h:pitch-labelGap}
    : {x:safe.x+safe.w*.12,y:safe.y+safe.h-count*pitch+(count-1-i)*pitch,w:labelW,h:pitch-labelGap});
  const planes=Array.from({length:count},(_,i)=>{
    const z=(i-(count-1)/2)*gap;
    return {z,opacity:i===Math.floor(count/2)?1:clamp(spread*2),anchor:projectPlane({x:width*.50,y:wide?0:height*.4,z},pose)};
  });
  return {wide,width,height,...pose,spread,planes,labels};
}

function artwork(K,parent,index,accent,palette,bg,fg) {
  const svg=svgNode(parent,'svg',{viewBox:'-500 -500 1000 1000',width:'100%',height:'100%'});
  K.set(svg,{transform:`scale(${1.25+index*.16}) rotate(${index*25}deg)`});
  const defs=svgNode(svg,'defs'),id=K.uid(`accordion-petal-${index}`);
  const gradient=svgNode(defs,'linearGradient',{id,x1:'0',y1:'1',x2:'0',y2:'0'});
  svgNode(gradient,'stop',{offset:'0','stop-color':K.mixHex(accent,bg,.65)});
  svgNode(gradient,'stop',{offset:'.48','stop-color':accent});
  svgNode(gradient,'stop',{offset:'1','stop-color':K.mixHex(accent,fg,.25)});
  for(let i=0;i<6;i++)svgNode(svg,'path',{transform:`rotate(${i*60})`,d:'M0 0 C80 -30 140 -130 115 -235 C95 -330 40 -420 0 -470 C-40 -420 -95 -330 -115 -235 C-140 -130 -80 -30 0 0Z',fill:`url(#${id})`});
  svgNode(svg,'circle',{r:70,fill:palette.butter??fg});
}

function fitLabel(K,node,box) {
  K.set(node,{width:K.px(box.w)});
  const copy=node.textContent;node.textContent='';
  const leaf=K.el('span','',node,copy);
  K.set(leaf,{display:'block',width:'100%',flex:'1 1 auto'});
  K.design.apply(leaf,'controlLabel');K.design.truncateLine(leaf);
}

export function createFamily(K) {
  const sceneFactories={};
  const accordion={...metadata.accordion,build({p,cam,fg,accent,palette,bg,K}) {
    const invalid=this.validate(p.scene);
    if(invalid.length)throw new Error(`accordion: ${invalid.join('; ')}`);
    const {el,set,px,S,W,H,alpha}=K;
    // A sky look contains white clouds; its labels need dark ink throughout.
    const sky=p.bg==='sky'||bg==='sky';
    const ground=sky?(palette.sky??'#8fc7ff'):bg;
    const ink=sky?K.textOn(ground):fg;
    const t=this.times(p.scene,p.dur,p.beatLen),n=p.scene.items.length;
    const initial=accordionFrame(K,n,0,t);
    const guides=svgLayer(K,cam),cards=el('div','',cam),tethers=svgLayer(K,cam),labels=el('div','',cam);
    set(cards,{position:'absolute',inset:'0'});set(labels,{position:'absolute',inset:'0'});
    const guideLines=Array.from({length:4},()=>svgNode(guides,'line',{stroke:alpha(ink,.25),'stroke-width':Math.max(1,1.5*S),'stroke-dasharray':`${12*S} ${8*S}`}));
    const curves=Array.from({length:n-1},()=>svgNode(tethers,'path',{fill:'none',stroke:alpha(ink,.58),'stroke-width':Math.max(1,1.4*S)}));
    const nodes=p.scene.items.map((name,i)=>{
      const card=el('div','',cards);
      set(card,{position:'absolute',background:K.mixHex(ground,fg,.08),boxShadow:`0 0 0 ${px(1.5*S)} ${alpha(fg,.8)}`,zIndex:String(n-i)});
      K.design.surface(card,'card',{layout:'frame',purpose:'media'});
      const picture=el('div','',card);
      set(picture,{position:'absolute',inset:'0',overflow:'hidden'});
      K.design.surface(picture,'card',{layout:'frame',purpose:'media'});
      const image=p.scene.images?.[i];
      if(image&&K.images[image]){
        const img=el('img','',picture);img.src=K.images[image].src;
        set(img,{width:'100%',height:'100%',objectFit:'cover'});
      }else artwork(K,picture,i,accent,palette,ground,fg);
      for(const [x,y] of [[0,0],[1,0],[1,1],[0,1]]){
        const handle=el('div','',card),size=12*S;
        set(handle,{position:'absolute',left:`${x*100}%`,top:`${y*100}%`,width:px(size),height:px(size),transform:'translate(-50%,-50%)',background:fg,boxShadow:`0 0 0 ${px(S)} ${alpha(ground,.5)}`});
        if(x===0&&y===1){const dot=el('div','',handle);set(dot,{position:'absolute',inset:'30%',background:ground,borderRadius:'50%'});}
      }
      const label=el('div','bold',labels,name);
      set(label,{position:'absolute',color:ink,display:'flex',alignItems:initial.vertical?'center':'flex-end'});
      fitLabel(K,label,initial.labels[i]);
      const lead=initial.vertical?svgNode(tethers,'line',{stroke:alpha(ink,.3),'stroke-width':Math.max(1,S)}):null;
      return {card,picture,label,lead};
    });
    return time=>{
      const f=accordionFrame(K,n,time,t);
      for(const [i,node] of nodes.entries()){
        const box=f.boxes[i],label=f.labels[i];
        set(node.card,{left:px(box.x),top:px(box.y),width:px(box.size),height:px(box.size)});
        K.design.nest(node.picture,node.card,{inset:0});
        set(node.label,{left:px(label.x),top:px(label.y),height:px(label.h)});
        if(node.lead){node.lead.setAttribute('x1',String(box.x+box.size+10*S));node.lead.setAttribute('x2',String(label.x-14*S));node.lead.setAttribute('y1',String(box.y+box.size/2));node.lead.setAttribute('y2',String(box.y+box.size/2));}
      }
      const {left,right,top,bottom}=f.bounds;
      [[left,0,left,H],[right,0,right,H],[0,top,W,top],[0,bottom,W,bottom]].forEach((v,i)=>v.forEach((value,j)=>guideLines[i].setAttribute(['x1','y1','x2','y2'][j],String(value))));
      const first=f.boxes[0];
      curves.forEach((curve,i)=>{
        const box=f.boxes[i+1];
        if(f.vertical){
          const x0=first.x,y0=first.y+first.size,x1=box.x,y1=box.y+box.size;
          const bend=Math.min((y1-y0)*.32,K.safe.w*.16);
          curve.setAttribute('d',`M${x0} ${y0}C${x0-bend} ${y0+(y1-y0)*.2} ${x1-bend*.6} ${y1-(y1-y0)*.25} ${x1} ${y1}`);
        }else{
          const x0=first.x,y0=first.y+first.size,x1=box.x,y1=box.y+box.size,dx=x1-x0;
          const bend=Math.min(dx*.5,K.safe.h*.21);
          curve.setAttribute('d',`M${x0} ${y0}C${x0+.2*dx} ${y0+bend} ${x1-.25*dx} ${y1+bend*.4} ${x1} ${y1}`);
        }
      });
    };
  }};
  sceneFactories.accordion=given=>accordion.build(given);

  const explode={...metadata.explode,build({p,cam,fg,accent,palette,bg,K}) {
    const {el,set,px,S,alpha}=K,n=p.scene.layers.length,t=this.times(p.scene,p.dur,p.beatLen);
    const sky=p.bg==='sky'||bg==='sky';
    const ground=sky?(palette.sky??'#8fc7ff'):bg;
    const labelInk=sky?K.textOn(ground):fg;
    const initial=explodeFrame(K,n,0,t);
    const guides=svgLayer(K,cam),rig=el('div','',cam),stack=el('div','',rig),labelRoot=el('div','',cam);
    set(rig,{position:'absolute',left:px(initial.cx),top:px(initial.cy),width:'0',height:'0',perspective:px(initial.perspective),perspectiveOrigin:'0 0'});
    set(stack,{position:'absolute',left:'0',top:'0',width:'0',height:'0',transformStyle:'preserve-3d'});
    set(labelRoot,{position:'absolute',inset:'0'});
    if(p.scene.title){
      const title=el('div','bold',cam,p.scene.title);
      set(title,{position:'absolute',left:px(K.safe.x),top:px(K.safe.y+K.safe.h*.015),width:px(K.safe.w),color:labelInk,textAlign:'center',whiteSpace:'normal'});
      K.design.fitSize(title,K.safe.w*.94,K.design.type('sceneTitle').lineHeight*2,'sceneTitle');
    }
    const colours=[palette.sky,accent,palette.lilac,palette.coral,palette.lime].map(c=>c??accent);
    const nodes=p.scene.layers.map((name,i)=>{
      const plane=el('div','',stack),central=i===Math.floor(n/2),colour=colours[i];
      set(plane,{position:'absolute',left:px(-initial.width/2),top:px(-initial.height/2),width:px(initial.width),height:px(initial.height),borderRadius:px(K.design.radius(2)),border:`${px(2*S)} solid ${alpha(central?accent:labelInk,central?.95:.55)}`,background:central?`linear-gradient(135deg,${K.mixHex(accent,ground,.18)},${K.mixHex(colour,ground,.42)})`:`linear-gradient(145deg,${alpha(colour,.13)},${alpha(ground,.22)})`,backfaceVisibility:'visible',boxSizing:'border-box'});
      const svg=svgNode(plane,'svg',{viewBox:'0 0 660 420',width:'100%',height:'100%'});
      const ink=central?K.textOn(accent):labelInk;
      if(i%3===0){
        for(let j=1;j<6;j++)svgNode(svg,'line',{x1:j*110,y1:28,x2:j*110,y2:392,stroke:alpha(ink,.15),'stroke-width':1.5});
        for(let j=1;j<4;j++)svgNode(svg,'line',{x1:28,y1:j*105,x2:632,y2:j*105,stroke:alpha(ink,.15),'stroke-width':1.5});
        svgNode(svg,'rect',{x:50,y:45,width:560,height:330,rx:9,fill:'none',stroke:alpha(ink,.45),'stroke-dasharray':'9 7','stroke-width':2});
      }else if(i%3===1){
        svgNode(svg,'rect',{x:52,y:50,width:185,height:310,rx:12,fill:alpha(ink,.1),stroke:alpha(ink,.35),'stroke-width':2});
        for(let j=0;j<3;j++)svgNode(svg,'rect',{x:270,y:52+j*108,width:330,height:76,rx:12,fill:alpha(ink,.12),stroke:alpha(ink,.4),'stroke-width':2});
      }else{
        svgNode(svg,'circle',{cx:330,cy:210,r:112,fill:alpha(ink,.12),stroke:alpha(ink,.8),'stroke-width':4});
        svgNode(svg,'path',{d:'M270 212l42 42 86-92',fill:'none',stroke:alpha(ink,.9),'stroke-width':14,'stroke-linecap':'round','stroke-linejoin':'round'});
      }
      const line=svgNode(guides,'path',{fill:'none',stroke:alpha(labelInk,.42),'stroke-width':Math.max(1,1.4*S)});
      const dot=svgNode(guides,'circle',{r:4*S,fill:colour});
      const label=el('div','bold',labelRoot,name);
      set(label,{position:'absolute',color:labelInk,paddingLeft:px(K.design.space(2)),display:'flex',alignItems:'center',borderLeft:`${px(4*S)} solid ${colour}`,boxSizing:'border-box'});
      fitLabel(K,label,{...initial.labels[i],w:initial.labels[i].w-K.design.space(2)});
      return {plane,line,dot,label};
    });
    return time=>{
      const f=explodeFrame(K,n,time,t);
      set(stack,{transform:`rotateX(${f.tilt.toFixed(6)}deg) rotateZ(${f.turn.toFixed(6)}deg) scale(${f.scale.toFixed(6)})`});
      for(const [i,node] of nodes.entries()){
        const plane=f.planes[i],label=f.labels[i],x1=label.x-14*S,y1=label.y+label.h/2;
        set(node.plane,{transform:`translateZ(${px(plane.z)})`,opacity:plane.opacity.toFixed(6)});
        set(node.label,{left:px(label.x),top:px(label.y),height:px(label.h)});
        if(f.wide){
          const bend=Math.max(24*S,(x1-plane.anchor.x)*.45);
          node.line.setAttribute('d',`M${plane.anchor.x} ${plane.anchor.y}C${plane.anchor.x+bend} ${plane.anchor.y} ${x1-bend} ${y1} ${x1} ${y1}`);
        }else{
          // The leaders enter a rail beside the list before descending, so
          // no line cuts through another layer's label.
          const rail=label.x-(26+6*i)*S,turnY=K.safe.y+K.safe.h*.61;
          node.line.setAttribute('d',`M${plane.anchor.x} ${plane.anchor.y}C${plane.anchor.x} ${turnY} ${rail} ${turnY-20*S} ${rail} ${turnY}L${rail} ${y1}L${x1} ${y1}`);
        }
        node.line.setAttribute('opacity',f.spread.toFixed(6));node.dot.setAttribute('opacity',f.spread.toFixed(6));
        node.dot.setAttribute('cx',String(plane.anchor.x));node.dot.setAttribute('cy',String(plane.anchor.y));
      }
    };
  }};
  sceneFactories.explode=given=>explode.build(given);
  return {sceneFactories};
}
