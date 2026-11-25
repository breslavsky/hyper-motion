// Every component receives private helpers, layout, brand and motion state.
// In particular DOM type snapping and emoji substitution are never film globals.
import * as maths from './maths.mjs';
import metadata from './metadata.mjs';
import {createDom} from './dom.mjs';
import {createMoves} from './moves.mjs';
import {createUi} from './ui.mjs';
import {createType} from './type.mjs';
import {createLayers} from './layers.mjs';
import {createDecor} from './decor.mjs';
import {createMotion} from './motion.mjs';
import {createDesignSystem} from './design-system.mjs';

export function motionFeel(plan,look=plan.look) {
  const mo=plan.motion??{},fe=look?.feel??{};
  return {snap:(mo.snap??1)*(fe.snap??1),bounce:(mo.bounce??1)*(fe.bounce??1),
    curve:Array.isArray(mo.curve)&&mo.curve.length===4?maths.bezier(mo.curve):null,camera:fe.camera??'push'};
}

/** The harness's live preview, null in an export, a snapshot and a check:
 *  `{longSide, capture}` of the video the page is streamed as, set by the
 *  preview server before any script (docs/TEMPLATES.md "Runtimes"). */
export const livePreview=()=>(typeof window!=='undefined'&&window.__harnessPreview)||null;
/** A scene's own pictures (its WebGL buffer, a 2D canvas) are drawn for the
 *  stream a phone watches, not for the frame an export keeps: 1280 of 1920 px
 *  is two thirds a side, under half the pixels. Layout and DOM text stay at
 *  the frame's size. Never below a quarter, never above one. */
export const liveScale=(live,W,H)=>{
  const side=Number(live?.longSide);
  return Number.isFinite(side)&&side>0?Math.max(.25,Math.min(1,+(side/Math.max(W,H)).toFixed(4))):1;
};
export function createContext({stage,plan:sourcePlan,ps,emoji,options={},id='component'}) {
  const live=livePreview();
  const look=ps?.look??sourcePlan.look,compiledMaterial=sourcePlan.look?.material;
  // Native style variables may replace the look with an uncompiled preset.
  // An omitted material keeps the film's independent choice; an explicit
  // material (including null) remains a deliberate native override.
  const nativeLook=compiledMaterial?.branded&&look?.material===undefined?{...look,material:compiledMaterial}:look;
  const plan={...sourcePlan,look:nativeLook,palette:ps?.palette??sourcePlan.palette};
  const brandFont=plan.brand?.font;
  if(brandFont){
    const family=typeof brandFont==='string'?brandFont:fontAlias(brandFont);
    // A supplied brand font owns emphasis too: a look cannot introduce its
    // separate serif face or italic treatment into the brand's marked words.
    plan.look={...plan.look,display:{...plan.look?.display,family:`${JSON.stringify(family)}, sans-serif`,accent:'color',...(brandFont.weight?{weight:brandFont.weight}:{})}};
    stage.dataset.brandFont='';
  }
  const W=plan.width,H=plan.height,S=Math.min(W,H)/1080,M=motionFeel(plan);
  const document=stage.ownerDocument;
  const dom=createDom({document,emoji});
  const moves=createMoves({maths,dom}),ui=createUi({maths,dom}),type=createType({maths,dom});
  const layers=createLayers({maths,dom,moves}),decor=createDecor({maths,dom,moves,layers});
  const helpers={maths,dom,moves,ui,type,layers,decor};
  const margin=plan.safe??{top:0,bottom:0,left:0,right:0};
  const inside=(from,to,middle)=>[middle+(from-middle)/1.12,middle+(to-middle)/1.12];
  const [x0,x1]=inside(W*margin.left,W*(1-margin.right),W/2),[y0,y1]=inside(H*margin.top,H*(1-margin.bottom),H/2);
  const safe={x:x0,y:y0,w:x1-x0,h:y1-y0};
  const pending=[],frameWaits=new Set(),cleanups=new Set(),images={};
  const glyphText=(parent,text,{glyphs=true}={})=>dom.glyphText(parent,text,{glyphs,mask:plan.look?.text==='mask',serif:plan.look?.display?.accent==='serif'});
  const spring=(t,freq,damp)=>maths.spring(t,freq,damp,M);
  const riseGlyphs=(glyphs,l,o={})=>type.riseGlyphs(glyphs,l,{...o,mode:o.mode??plan.look?.text??'spring'},{feel:M,S});
  const misreg=(node,amount)=>type.misreg(node,amount,{look:plan.look,palette:plan.palette,S});
  const mockUI=(parent,palette,accent,seed,kind)=>ui.mockUI(parent,palette,accent,seed,kind,{W,H,brand:plan.brand,app:plan.app,ui:ps?.scene?.ui,design:K.design});
  const beatKick=(t,k=8)=>moves.beatKick(t,k,plan.beat);
  const namespace=String(id).replace(/[^\w-]/g,'-');
  const K={...maths,...dom,W,H,S,safe,plan,images,stage,type:plan.type,helpers,live,previewScale:options.previewScale??liveScale(live,W,H),uid:suffix=>`pk-${namespace}-${String(suffix).replace(/[^\w-]/g,'-')}`,
    ease:maths.EASE,EASE:maths.EASE,glyphText,spring,riseGlyphs,misreg,mockUI,beatKick,
    pulse:moves.pulse,blink:moves.blink,odometer:moves.odometer,frac:moves.frac,
    makeCursor:ui.makeCursor,CURSOR_SVG:ui.CURSOR_SVG,
    defer(pr){pending.push(Promise.resolve(pr));},
    waitFrame(pr){const p=Promise.resolve(pr);frameWaits.add(p);const settled=()=>frameWaits.delete(p);p.then(settled,settled);},
    onDispose(fn){if(typeof fn!=='function')throw new Error('onDispose expects a function');cleanups.add(fn);},
    driven:()=>true,playing:()=>false,
  };
  const context={W,H,S,M,safe,plan,ps,stage,K,helpers,pending,frameWaits,images,options,
    dispose(){for(const fn of cleanups){try{fn();}catch(error){console.error('component dispose failed',error);}}cleanups.clear();},
  };
  let design,designScale;
  Object.defineProperty(K,'design',{get(){
    if(!design||designScale!==K.presentationScale){designScale=K.presentationScale;design=createDesignSystem(K);}
    return design;
  }});
  context.motion=createMotion(context);
  return context;
}

export function applyTypography(stage,look) {
  const type=look?.display;if(!type)return;
  for(const [name,value] of Object.entries({fd:type.family,fw:type.weight,fb:Math.min(type.weight,820),fst:`${type.stretch}%`,ft:`${type.tracking}em`,flh:type.lineHeight,fcase:type.upper?'uppercase':'none'}))stage.style.setProperty(`--${name}`,String(value));
}

function fontAlias(font){
  // Distinct native brand variables can supply different files with one public
  // family name. An asset-derived alias keeps their FontFaces independent.
  let hash=2166136261;
  for(const char of JSON.stringify([font.family,font.src,font.weight??400]))hash=Math.imul(hash^char.charCodeAt(0),16777619);
  return `PKBrand-${(hash>>>0).toString(36)}-${font.family}`;
}
const fontLoads=new WeakMap();
export async function loadFonts(document,content,plan) {
  const letters=[...new Set(JSON.stringify(content??{}))].join('');
  const font=plan?.brand?.font;
  if(font&&typeof font==='object'){
    let cache=fontLoads.get(document);if(!cache){cache=new Map();fontLoads.set(document,cache);}
    const family=fontAlias(font),url=new URL(font.src,document.baseURI).href,key=JSON.stringify([family,url]);
    if(!cache.has(key))cache.set(key,(async()=>{
      const face=new FontFace(family,`url(${JSON.stringify(url)})`,{weight:String(font.weight??400)});
      await face.load();document.fonts.add(face);return face;
    })());
    await cache.get(key);
  }
  await Promise.all(['900 100px "Archivo"','900 100px "Geist"','500 100px "Geist Mono"','400 100px "Instrument Serif"','italic 400 100px "Instrument Serif"'].map(font=>document.fonts.load(font,letters)));
  // A bundled family named by the brand: its faces come by unicode-range, so the film's letters are asked for.
  if(typeof font==='string')await document.fonts.load(`700 100px ${JSON.stringify(font)}`,letters);
  if(plan?.look?.display?.family)await document.fonts.load(`${plan.look.display.weight??400} 100px ${plan.look.display.family}`,letters);
  await document.fonts.ready;
}

export async function loadImages(context) {
  // Validate declared component asset policy before any Image.src is assigned,
  // including native content-variable edits which do not pass through the CLI.
  const scene=context.ps?.scene;
  const mediaErrors=metadata[scene?.type]?.validateMedia?.(scene)??[];
  if(mediaErrors.length)throw new Error(`${scene.type}: ${mediaErrors.join('; ')}`);
  const urls=new Set();
  if(context.plan.brand?.logo)urls.add(context.plan.brand.logo);
  if(context.ps?.scene.image)urls.add(context.ps.scene.image);
  for(const url of context.ps?.scene.images??[])if(url)urls.add(url);
  await Promise.all([...urls].map(src=>new Promise((resolve,reject)=>{
    // A host may say where a file of the film really is (the Storybook's samples on our CDN), as it does
    // for a scene's backdrop and videos (`options.assetUrls`); the scene still knows it by its path.
    const at=context.options?.assetUrls?.[src]??src;
    const img=new Image();if(at!==src)img.crossOrigin='anonymous';
    img.onload=()=>{context.images[src]={src:at,w:img.naturalWidth,h:img.naturalHeight};resolve();};
    img.onerror=()=>reject(new Error(`Unable to load component image: ${src}`));img.src=at;
  })));
}

const emojiLoads=new Map();
export function loadEmoji(options={}) {
  if(options.emoji!==undefined)return Promise.resolve(options.emoji);
  const url=new URL('assets/emoji.json',location.href).href;
  if(!emojiLoads.has(url))emojiLoads.set(url,fetch(url).then(r=>r.ok?r.json():null).catch(()=>null));
  return emojiLoads.get(url);
}
