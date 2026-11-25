import {createContext,applyTypography,loadFonts,loadImages,loadEmoji} from './context.mjs';
import {createComponentLibrary,preloadFamilies} from './index.mjs';
import {fitScene} from './fit.mjs';
import {registerScene,rejectScene,unregisterScene} from './registry.mjs';
import {componentTiming,resolveContent} from './timing.mjs';
import {resolveBrandStyle,surfaceForeground} from './brand-tokens.mjs';
import {loadGlassBackground,loadVideoSource} from './glass/background.mjs';
import {glassGround} from './glass/ground.mjs';
import {kineticGround} from './kinetic-ground.mjs';
import catalog from './catalog.mjs';
import metadata from './metadata.mjs';
export {mountFilm} from './presentation.mjs';

const NS='http://www.w3.org/2000/svg';
function variable(values,key,fallback){
  if(values[key]===undefined)return fallback;
  const value=typeof values[key]==='string'?JSON.parse(values[key]):values[key];
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(`${key}: expected a JSON object`);
  return value;
}
function privateFilter(stage,id,scale,sketch){
  const doc=stage.ownerDocument,svg=doc.createElementNS(NS,'svg');
  svg.classList.add('pk-filter-defs');svg.setAttribute('aria-hidden','true');stage.append(svg);
  const filter=doc.createElementNS(NS,'filter');filter.id=`pk-${id}-blur`;filter.setAttribute('x','-20%');filter.setAttribute('width','140%');
  const blur=doc.createElementNS(NS,'feGaussianBlur');blur.setAttribute('stdDeviation','0 0');filter.append(blur);svg.append(filter);
  let boil=null;
  if(sketch){
    const f=doc.createElementNS(NS,'filter');f.id=`pk-${id}-boil`;
    boil=doc.createElementNS(NS,'feTurbulence');boil.setAttribute('type','fractalNoise');boil.setAttribute('baseFrequency','.018');boil.setAttribute('numOctaves','2');
    const disp=doc.createElementNS(NS,'feDisplacementMap');disp.setAttribute('in','SourceGraphic');disp.setAttribute('scale',String(Math.round(5*scale)));f.append(boil,disp);svg.append(f);
    stage.style.setProperty('--pk-boil',`url(#${f.id})`);
  }
  return {blur,blurId:filter.id,boil};
}
function paintBackground(root,bg,index,ctx){
  const {W,H,helpers:{maths:{hash},dom:{el,set,px}}}=ctx;
  if(bg!=='sky'){root.style.background=bg;return ()=>{};}
  const sky=el('div','sky',root);
  const clouds=[0,1,2,3,4].map(i=>{
    const c=el('div','cloud',sky),w=(.35+hash(i+index*7)*.4)*W;
    set(c,{width:px(w),height:px(w*.32),top:px((.55+hash(i*3.1)*.5)*H-w*.16)});
    return {c,x:hash(i*9.7)*1.2-.3,w,sp:.01+hash(i*1.3)*.02};
  });
  return l=>{for(const c of clouds)set(c.c,{left:px((c.x+l*c.sp)*W-c.w/2)});};
}
function rendered(node){
  for(let el=node;el;el=el.parentElement){const s=getComputedStyle(el);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)<.4)return false;}
  return true;
}
function withMeasurable(stage,run){
  // Native clips can be hidden by their timing wrappers before the first seek.
  // Fit the complete, self-contained stage outside those wrappers synchronously.
  // No frame is painted while it is moved, and no other component is unhidden.
  const parent=stage.parentNode,next=stage.nextSibling,doc=stage.ownerDocument;
  const measure=doc.createElement('div');
  measure.style.cssText=`position:absolute;left:0;top:0;width:${stage.style.width};height:${stage.style.height};pointer-events:none`;
  const saved=['display','visibility','opacity'].map(prop=>[prop,stage.style.getPropertyValue(prop),stage.style.getPropertyPriority(prop)]);
  doc.body.append(measure);measure.append(stage);
  stage.style.setProperty('display','block','important');stage.style.setProperty('visibility','visible','important');stage.style.setProperty('opacity','1','important');
  try{return run();}finally{
    parent.insertBefore(stage,next);
    measure.remove();
    for(const [prop,value,priority] of saved)value?stage.style.setProperty(prop,value,priority):stage.style.removeProperty(prop);
  }
}
async function bounded(promise,label,ms=15000){
  let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label} timed out`)),ms);})]);}finally{clearTimeout(timer);}
}

/** A single independent native component. The parent timeline never calls its clock. */
export async function mountScene(host,config,variables={},gsap){
  const nativeHost=host.closest('[data-composition-file],[data-composition-src]');
  const id=nativeHost?.dataset.compositionId??config.id;
  let ownedStage,ownedContext;
  try{
    await preloadFamilies((config.plan.scenes??[]).map(planned=>planned.scene?.type).filter(Boolean));
    const sourcePlan=structuredClone(config.plan),sourcePs=structuredClone(config.ps);
    const style=variable(variables,'style',{});
    const {scene,changed}=resolveContent(sourcePs.scene,variable(variables,'content',sourcePs.scene));
    sourcePlan.brand=variable(variables,'brand',sourcePlan.brand??{});
    sourcePlan.app=variable(variables,'app',sourcePlan.app??{});
    const ps={...sourcePs,scene,...componentTiming(scene,sourcePs.ldur??sourcePs.dur*(sourcePs.speed??1),sourcePlan.beat*(sourcePs.speed??1)),...Object.fromEntries(['look','palette','bg','fg','accent'].filter(key=>style[key]!==undefined).map(key=>[key,style[key]]))};
    // Host variables contain compiled defaults. A new central brand replaces
    // those defaults, while a deliberately edited native style still wins.
    if(JSON.stringify(sourcePlan.brand.tokens)!==JSON.stringify(config.plan.brand?.tokens)){
      const before={palette:sourcePs.palette??sourcePlan.palette,bg:sourcePs.bg,fg:sourcePs.fg,accent:sourcePs.accent};
      const resolved=resolveBrandStyle(sourcePs.brandBase??before,sourcePlan.brand.tokens,scene);
      for(const key of ['palette','bg','fg','accent'])if(style[key]===undefined||JSON.stringify(style[key])===JSON.stringify(before[key]))ps[key]=resolved[key];
    }
    // A Glass scene stands on the family's own ground, whatever the film's
    // look, unless its colours were chosen on purpose (glass/ground.mjs).
    if(catalog[scene.type]?.family==='glass'){
      const ground=glassGround({scene,tokens:sourcePlan.brand.tokens,style,compiled:{palette:sourcePs.palette??config.plan.palette,bg:sourcePs.bg,fg:sourcePs.fg,accent:sourcePs.accent}});
      if(ground){Object.assign(ps,{bg:ground.bg,fg:ground.fg,accent:ground.accent,palette:ground.palette});sourcePlan.palette=ground.palette;}
    }
    // A Kinetic Text scene stands on its family's ground too: black, with no decoration of the look (kinetic-ground.mjs).
    let plainGround=false;
    if(catalog[scene.type]?.ground==='kinetic'){
      const ground=kineticGround({scene,tokens:sourcePlan.brand.tokens,style,compiled:{palette:sourcePs.palette??config.plan.palette,bg:sourcePs.bg,fg:sourcePs.fg,accent:sourcePs.accent}});
      if(ground){Object.assign(ps,{bg:ground.bg,fg:ground.fg,accent:ground.accent,palette:ground.palette});sourcePlan.palette=ground.palette;plainGround=true;}
    }
    ps.explicitForeground=scene.fg!==undefined||sourcePlan.brand.tokens?.foreground!==undefined||(style.fg!==undefined&&style.fg!==sourcePs.fg);
    ps.explicitAccent=style.accent!==undefined&&style.accent!==sourcePs.accent;
    // Keep the compiled foreground role intact, but use readable implicit ink
    // on the painted sky. Individual materials may resolve their own ink below.
    const foreground=surfaceForeground('sky',ps.bg,ps.palette??sourcePlan.palette,ps.fg,{explicit:ps.explicitForeground});
    const options=config.options??{};
    const stage=host.ownerDocument.createElement('div');ownedStage=stage;stage.className='pk-stage';host.append(stage);
    const emoji=await loadEmoji(options);
    const ctx=createContext({stage,plan:sourcePlan,ps,emoji,options,id}),{W,H,S,M,K,helpers,plan,motion}=ctx;
    ownedContext=ctx;
    const {el,set,px}=helpers.dom;
    set(stage,{width:px(W),height:px(H)});
    const margin=plan.safe??{top:0,bottom:0,left:0,right:0};
    for(const [side,value] of [['t',H*margin.top],['b',H*margin.bottom],['l',W*margin.left],['r',W*margin.right]])stage.style.setProperty(`--safe-${side}`,px(value));
    applyTypography(stage,plan.look);
    await loadFonts(host.ownerDocument,[plan.brand,plan.app,ps.scene],plan);
    // A font a scene sets its words in whatever the film's own (a sign of tubes): asked for with the scene's letters.
    for(const font of metadata[ps.scene.type]?.fonts?.(ps.scene)??[])await host.ownerDocument.fonts.load(font,[...new Set(JSON.stringify(ps.scene))].join(''));
    await loadImages(ctx);
    if(ps.scene.background)K.glassBackground=await bounded(loadGlassBackground(ctx,id),'Glass background');
    // A scene that plays videos inside its own picture asks for them here,
    // in the size it draws them: K.videoSource(index or path,width,height).
    K.sceneVideos=[];
    // By its place among the scene's videos, or by its path (a clip of the
    // component's own, which the plan lists after the film's).
    K.videoSource=(which,width,height,{whole=false}={})=>{
      const list=ps.scene.videos??[],named=typeof which==='string';
      const path=named?which:(list[which]??ps.scene.video),index=named?Math.max(0,list.indexOf(which)):which;
      const source=loadVideoSource(ctx,{path,inputId:`pk-video-${id}-${index}`,width,height,whole});K.sceneVideos.push(source);return source;};
    const sceneRoot=el('div',`scene on look-${plan.look?.id??'editorial'}`,stage);
    sceneRoot.style.visibility='visible';sceneRoot.style.zIndex=String(10+ps.index);
    const post=plan.look?.post??{};
    if(post.bloom){sceneRoot.classList.add('fx-bloom');for(const [key,value] of Object.entries({bloom:post.bloom,'glow-fg':helpers.maths.alpha(foreground,.55),glow:helpers.maths.alpha(ps.accent,.6),'glow-soft':helpers.maths.alpha(ps.accent,.28)}))sceneRoot.style.setProperty(`--${key}`,String(value));}
    if(post.aberration)sceneRoot.classList.add('fx-ab');
    if(plan.look?.deco?.chrome)sceneRoot.classList.add('fx-chrome');
    const sky=paintBackground(sceneRoot,ps.bg,ps.index,ctx);
    // A scene laid over footage on a track of its own has no ground: the footage is seen through it.
    if(scene.over)sceneRoot.style.background='transparent';
    const decoration=helpers.decor.of({W,H,S,plan,stage,get M(){return M;}});
    // The look's own ground (its coloured lights) belongs under a scene that fills the frame: over footage there is none.
    const decoDraw=scene.over||plainGround?()=>{}:decoration.decorate(sceneRoot,ps);
    const life=el('div','layer',sceneRoot),cam=el('div','cam',life);
    K.presentationScale=1;
    if(sourcePlan.look?.deco?.letterbox){const k=1-2*decoration.letterboxBar()/H;K.presentationScale=Number(k.toFixed(4));set(cam,{scale:k.toFixed(4),translate:`${px(W*(1-k)/2)} ${px(H*(1-k)/2)}`});}
    // Every family receives its final presentation scale before it captures
    // shared design tokens, including lazily imported component factories.
    const library=createComponentLibrary(K);K.logoNode=library.logoNode;
    const builder=await library.get(scene.type);
    const selfCamera=library.selfCamera.has(scene.type);
    // A Glass scene and a Kinetic Text scene move their own frame: the slow drift every other scene has
    // would take a picture off the place it is handed over in. A Kinetic Text scene's frame stands still
    // altogether: the look's camera (a push, a punch on a cut, a kick on the beat) is not its own either.
    const stillFrame=catalog[scene.type]?.ground==='kinetic';
    const ownFrame=catalog[scene.type]?.family==='glass'||stillFrame;
    const filter=privateFilter(stage,id.replace(/[^\w-]/g,'-'),S,Boolean(plan.look?.deco?.sketch));
    const inner=selfCamera?null:el('div','layer',cam);
    const draw=withMeasurable(stage,()=>builder({p:{...ps,dur:ps.ldur??ps.dur,beatLen:plan.beat*(ps.speed??1)},root:sceneRoot,cam:inner??cam,fg:foreground,accent:ps.accent,palette:plan.palette,bg:ps.bg==='sky'?plan.palette.sky:ps.bg,K}));
    if(typeof draw!=='function')throw new Error(`${scene.type}: factory did not return a draw function`);
    await bounded(Promise.all(ctx.pending),'Component assets');
    const sceneVideos=await bounded(Promise.all(K.sceneVideos),'Scene videos');
    await bounded(Promise.all([...stage.querySelectorAll('img')].map(im=>im.decode?.())),'Component image decoding');
    const instance={id,root:stage,sceneRoot,plan,ps,context:ctx,life,cam,inner,draw,sky:l=>{sky(l);decoDraw(l);},...filter,
      surfaceForeground:K.surfaceForeground??foreground,duration:ps.dur,clipStart:config.clipStart??0,clipDuration:config.clipDuration??ps.dur,ab:post.aberration??0,lastVisible:true};
    const brandText=brand=>Object.fromEntries(Object.entries(brand??{}).filter(([key])=>!['font','colors','logo','tokens'].includes(key)));
    const contentChanged=changed.some(key=>key!=='background')||JSON.stringify(brandText(sourcePlan.brand))!==JSON.stringify(brandText(config.plan.brand))||JSON.stringify(sourcePlan.app)!==JSON.stringify(config.plan.app??{});
    instance.rebuildRequired=contentChanged?{audio:true,reason:'Native content changed. Visual timing was recalculated; update film.json and rebuild to synchronize the mixed audio and film-level hit effects.'}:null;
    if(instance.rebuildRequired)host.setAttribute('data-pk-rebuild-required','audio');
    if(options.fit!==false)withMeasurable(stage,()=>fitScene(instance,ctx,{selfCamera:library.selfCamera}));
    // The fit measures a scene under the look's camera and leaves that camera where it last stood. A scene
    // whose frame stands still is never moved again, so it is put back.
    if(stillFrame){set(cam,{transform:'none'});set(life,{transform:'none'});}
    // Preserve the original measurement order: factory textContent emoji are
    // measured as glyphs, then substituted after fitting (el() substitutes early).
    helpers.dom.emojify(stage);
    // Explicit materials belong only to the shared Liquid Glass 3D surfaces.
    // The older style:"metal" DOM look remains a deliberate look choice.
    const metal=plan.look?.material?.type==='metal'&&!plan.look.material.branded&&!K.glass
      ? (await import('./metal-material.mjs')).createMetalMaterial({root:sceneRoot,K,
        bg:ps.bg==='sky'?plan.palette.sky:ps.bg,fg:K.surfaceForeground??foreground,preset:plan.look.material.variant}) : null;
    let localTime=0,disposed=false,draws=0,drawnFrame=null;
    // The live preview is streamed at the film's frame rate while the player
    // moves its clock on every animation frame, 60 a second: there only the
    // frames of the film's grid are drawn, half the work. A window grabbed at
    // a fixed rate on its own clock (`capture: "interval"`) would take some
    // grid frames twice and miss the next, so then every one is drawn.
    const grid=K.live&&K.live.capture!=='interval'?plan.fps:0;
    const drawAt=value=>{
      if(disposed)return;
      if(grid){const frame=Math.round(Number(value)*grid);if(frame===drawnFrame)return;drawnFrame=frame;}
      draws++;
      localTime=Math.max(0,Math.min(instance.clipDuration,Number(value)));
      const t=instance.clipStart+localTime,l=t-ps.start,sp=ps.speed??1;
      K.glassBackground?.seek?.(localTime);
      for(const video of sceneVideos)video.seek(localTime);
      const punch=ps.transition==='cut'&&ps.index>0?.05*(1-helpers.maths.expoOut(helpers.maths.prog(l,0,.3))):0;
      const kick=.01*helpers.moves.pulse((t+1e-6)%plan.beat,9);
      if(!selfCamera&&!stillFrame)set(cam,{transform:motion.camera(M.camera,l,ps.dur,t,punch,kick,ps.index)});
      // A Glass scene draws the whole frame in its own world, under its own camera: the film's slow
      // drift would move that picture off the frame's edge and show the ground behind it.
      if(!ownFrame)set(life,{transform:motion.lifeOf(l,ps.dur,ps.index,selfCamera||['pan','punch','shake','push'].includes(M.camera))});
      if(instance.ab)sceneRoot.style.setProperty('--ab',(instance.ab*S*(1.5+7*helpers.moves.pulse((t+1e-6)%plan.beat,10))).toFixed(2));
      instance.sky(l);draw(Math.max(0,l*sp),ps.dur*sp);
      metal?.draw(Math.max(0,l*sp));
      if(filter.boil)filter.boil.setAttribute('seed',String(Math.floor(t*8)%97));
    };
    // The clock is a function GSAP calls, never an accessor: the HyperFrames
    // runtime takes a tween of an accessor for one that may move a sound's
    // volume, and to learn that volume it plays the whole film through at 60
    // steps a second before anybody sees it (HISTORY 384).
    const clock={time(value){if(value===undefined)return localTime;drawAt(value);}};
    const timeline=gsap.timeline({paused:true}).to(clock,{time:instance.clipDuration,duration:instance.clipDuration,ease:'none'},0);
    // `draws`: how often the scene was asked to draw, for the checks that hold
    // the runtime to seeking a scene only when somebody plays or seeks the film.
    Object.defineProperties(instance,{localTime:{get:()=>localTime},time:{get:()=>instance.clipStart+localTime},draws:{get:()=>draws}});
    instance.drawAt=drawAt;
    const repaint=()=>draw(Math.max(0,(instance.time-ps.start)*(ps.speed??1)),ps.ldur??ps.dur*(ps.speed??1));
    for(const video of sceneVideos)video.onRepaint(repaint);
    K.glassBackground?.onRepaint?.(()=>draw(Math.max(0,(instance.time-ps.start)*(ps.speed??1)),ps.ldur??ps.dur*(ps.speed??1)));
    // Resolves once nothing a seek started is still at work (a video frame
    // being decoded), so what is on the canvas is the frame of this moment.
    instance.frameReady=async()=>{while(ctx.frameWaits.size)await Promise.allSettled([...ctx.frameWaits]);};
    instance.textBoxes=()=>rendered(stage)?helpers.dom.textBoxes(stage):[];
    instance.audit=()=>({id,type:ps.scene.type,time:instance.time,localTime,texts:instance.textBoxes(),fit:instance.fitted??null,box:instance.box??null,surfaceForeground:instance.surfaceForeground,rebuildRequired:instance.rebuildRequired});
    instance.dispose=()=>{
      if(disposed)return;disposed=true;
      timeline.kill();ctx.dispose();stage.remove();unregisterScene(id,instance);
      for(const [key,value]of Object.entries(window.__timelines??{}))if(value===timeline)delete window.__timelines[key];
    };
    drawAt(0);registerScene(id,instance);
    return {timeline,instance};
  }catch(error){ownedContext?.dispose();ownedStage?.remove();rejectScene(id,error);throw error;}
}
