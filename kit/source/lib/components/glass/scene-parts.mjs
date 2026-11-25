// What the Glass scenes are built from: the world and its card, the copy on a
// card, the camera, and the parts of a field somebody types into. A scene
// names its parts here and keeps only what is its own.
import {createIslandIcon} from '../island-icon.mjs';
import {createGlassWorld,phase,smoother,mix} from './world.mjs';
import {glassPanelWidth} from './layout.mjs';

export function enumValue(value,allowed,fallback,name){
  if(value!==undefined&&!allowed.includes(value))throw new Error(`${name}: expected ${allowed.join(' or ')}`);
  return value??fallback;
}
export function cameraMode(scene,name,fallback='orbit'){
  return enumValue(scene.camera,['static','orbit'],fallback,`${name}.camera`);
}

// ---- The world and its card ------------------------------------------------

export function makeWorld(args,mode){
  const {K,p,cam,bg,fg,accent,palette}=args;
  const host=K.el('div','pk-glass-world',cam);
  K.set(host,{position:'absolute',inset:'0',width:K.px(K.W),height:K.px(K.H),color:fg});
  const tokens=K.plan.brand?.tokens??{};
  const referencePalette=p.scene.bg===undefined&&!['background','accent','accent2'].some(key=>tokens[key]!==undefined);
  // Where the film puts the panel over its picture, and how large (grid.mjs).
  const placement={place:p.scene.place??'middle',size:p.scene.size??'normal'};
  const world=createGlassWorld({K,parent:host,mode,bg,fg,accent,palette,referencePalette,placement,ride:Boolean(args.ride)});
  // A ride moves the worlds of its steps (glass-ride).
  args.ride?.worlds.push(world);
  return {host,world};
}
// Optical panels use one card layout; camera motion does not pick a
// different type scale, density or content inset.
export function panelWidth(K){
  return glassPanelWidth(K);
}
export function cardSurface(K,parent,copy){
  const {el,set,px}=K;
  const width=panelWidth(K);
  const surface=el('div','pk-glass-copy',parent);surface.dataset.glassCopy=copy.filter(Boolean).join('\n');
  const recipe=K.design.surface(surface,'card');
  set(surface,{position:'absolute',left:'0',top:'0',width:px(width),height:'auto',display:'flex',flexDirection:'column',justifyContent:'flex-start',textAlign:'left'});
  return {surface,width,recipe};
}
export function cardHeading(K,parent,title,width){
  const heading=K.el('div','pk-glass-heading',parent,title),role='cardTitle';
  const size=K.design.fitSize(heading,width,Math.min(K.safe.h*.35,K.design.type(role).lineHeight*3),role,{wrap:'anywhere'});
  return {heading,size};
}
export function finishCard(K,surface,width){
  const height=Math.max(surface.offsetHeight,260*K.S);
  K.set(surface,{height:K.px(height)});
  return {surface,width,height};
}
export function cardCopy(K,parent,{title,body,icon}){
  const {el,set,px}=K,{surface,width,recipe}=cardSurface(K,parent,[title,body,icon]);
  let contentW=width-recipe.paddingX*2,words=surface,badge=null;
  if(icon){
    const row=el('div','pk-glass-content',surface);
    const size=K.design.type('cardTitle').size,gap=recipe.gap;
    set(row,{display:'flex',alignItems:'flex-start',gap:px(gap),minWidth:'0'});
    badge=createIslandIcon(K,row,icon,size);badge.classList.add('pk-glass-icon');
    contentW-=size+gap;
    words=el('div','pk-glass-words',row);
    set(words,{display:'flex',flexDirection:'column',gap:px(recipe.gap),minWidth:'0',flex:'1'});
  }
  const {heading,size:titleSize}=cardHeading(K,words,title,contentW);
  if(badge){
    // Align to the first title line even when the heading wraps. Use its fitted
    // size, rather than centring an unrelated badge on the whole text block.
    const lineHeight=parseFloat(heading.style.lineHeight);
    set(badge,{width:px(titleSize),height:px(titleSize),fontSize:px(titleSize),marginTop:px((lineHeight-titleSize)/2)});
    contentW=width-recipe.paddingX*2-titleSize-recipe.gap;
    set(heading,{maxWidth:px(contentW)});
  }
  if(body){const caption=el('div','pk-glass-body',words,body);K.design.fitSize(caption,contentW,K.design.type('body').lineHeight*5,'body',{wrap:'anywhere'});}
  return finishCard(K,surface,width);
}
// A card grows out of a pill (or a round seed) into its sheet.
export function updateCard(card,world,width,height,growW,growH,optical,seedDiameter){
  const pillW=seedDiameter??Math.min(width*.45,250*world.U*300),pillH=seedDiameter??Math.min(76,height);
  const w=mix(pillW,width,growW)*world.U,h=mix(pillH,height,growH)*world.U;
  const radius=Math.min(h/2,mix(pillH*world.U/2,.22,optical));
  const gauge=card.opticalFrame?1:optical;
  card.geometry.update(w,h,radius,mix(.18,.38,gauge),mix(.045,.08,gauge));
}
// How a sheet at rest is turned to the viewer.
export const REST_TILT=Object.freeze({x:.015,y:-.035,z:.005});
// A sheet taller than the frame is scaled as a whole, so type, controls and
// spacing stay on one scale.
export function fitToFrame(K,height){
  return Math.min(1,K.safe.h*.88/height);
}

// ---- The camera ------------------------------------------------------------

// A still camera, or one that swings from one side of the sheet to the other
// as `progress` runs: `sway` and `rise` in distances to the sheet, coming from
// `far` to `near`; a still one stands at `rest`.
export function orbitCamera(world,mode,progress,{sway=.06,rise=.018,far=1.08,near=1.02,rest=1.05,target=0}={}){
  const d=world.distance,moving=mode==='orbit',orbit=smoother(progress);
  world.camera.position.set(moving?mix(-sway,sway,orbit)*d:0,moving?rise*d:0,d*(moving?mix(far,near,orbit):rest));
  world.camera.lookAt(0,0,target);
}

// ---- A field somebody types into -------------------------------------------

export function caretOf(K,parent,color,height='1em'){
  const caret=K.el('span','',parent),width=K.px(K.design.unit);
  K.set(caret,{width,height,background:color,borderRadius:width});
  return caret;
}
// The place of a round action button in the page's layout.
export function actionSlot(K,parent,name,size,style={}){
  const slot=K.el('div',name,parent);
  K.set(slot,{width:K.px(size),height:K.px(size),...style});
  return slot;
}
// The pointer of whoever uses the field, on a layer over its content.
export function pointerOf(K,parent,name,size,layer){
  const pointer=K.el('div',name,parent);
  K.set(pointer,{position:'absolute',inset:'0',pointerEvents:'none',zIndex:String(layer)});
  return {pointer,cursor:K.makeCursor(pointer,size,{clickRing:false})};
}
// How much of the text is typed by `time`, from the keys of the scene's cues.
export function typedCount(keys,time){
  return keys.findLast(key=>key.at<=time)?.count??0;
}
// Shows the typed part of the text, touching the page only when it changes.
export function revealer(typing,changed){
  let shown=-1;
  return count=>{
    if(count===shown)return;
    typing.reveal(count);shown=count;changed?.(count);
  };
}
// One press: up to 1 and back between two times.
export function pulse(time,from,to){
  return Math.sin(Math.PI*phase(time,from,to));
}
export function middleOf(node){
  return {x:node.offsetLeft+node.offsetWidth/2,y:node.offsetTop+node.offsetHeight/2};
}

// ---- Lettering drawn on a canvas -------------------------------------------

export function fontOf(style){
  return `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
}
// An inline SVG (the kit's emoji) as an image a canvas can draw; `size` gives
// a picture with no size of its own one to be drawn at.
export function svgPicture(svg,size){
  const image=new Image();
  let source=svg;
  if(size){
    source=svg.cloneNode(true);
    source.setAttribute('xmlns','http://www.w3.org/2000/svg');source.setAttribute('width',String(size));source.setAttribute('height',String(size));
  }
  image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(source));
  return image;
}
