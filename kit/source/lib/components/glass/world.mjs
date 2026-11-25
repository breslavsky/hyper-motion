import * as THREE from '../../vendor/three/three.module.min.js';
import {createGlassGeometry} from './geometry.mjs';
import {createLensOverlay} from './lens-overlay.mjs';
import {createSurfaceMaterial,resolveSurfaceMetalPreset} from './materials.mjs';
import {attachGlassControls,attachActionButton} from './controls.mjs';
import {createSendWaveSurface} from './send-wave-surface.mjs';
import {createLiquidShade, createLiquidSlab} from './liquid.mjs';
import {glassPlacement} from './grid.mjs';
import {createMetal} from '../metal/metal.mjs';

export const clamp=x=>Math.max(0,Math.min(1,x));
export const phase=(t,a,b)=>clamp((t-a)/(b-a));
export const smooth=p=>p*p*(3-2*p);
export const smoother=p=>p*p*p*(10+p*(-15+6*p));
export const mix=(a,b,p)=>a+(b-a)*p;
export const outBack=p=>{const q=p-1,s=.6;return 1+(s+1)*q*q*q+s*q*q;};

// Only the renderer/environment are pooled. World state, output pixels, meshes,
// camera, render targets and material uniforms always belong to one native host.
// A world laid over footage draws on a clear frame: it has a renderer of its own kind.
const pools={};
function acquireRenderer(environmentKey='legacy',clear=false){
  const kind=clear?'clear':'solid';let pool=pools[kind];
  if(!pool){
    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:clear,preserveDrawingBuffer:true,powerPreference:'high-performance'});
    if(clear)renderer.setClearColor(0x000000,0);
    renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.NeutralToneMapping;renderer.toneMappingExposure=1;
    renderer.transmissionResolutionScale=.8;
    pool=pools[kind]={renderer,environments:new Map(),refs:0,width:0,height:0};
  }
  const own=pool,neutral=environmentKey!=='legacy';
  if(!own.environments.has(environmentKey)){
    // Glass and optical lens caps share the studio environment. The Metal
    // button sheet is unlit and preserves the source shader's own colours.
    const smoked=environmentKey==='smoked';
    const environmentScene=new THREE.Scene();
    environmentScene.background=smoked?new THREE.Color(0x030303):neutral?new THREE.Color(.75,.75,.75):new THREE.Color(.035,.045,.08);
    const lights=smoked?[[4.5,.45,[-3,4,2],'#fff',2.4]]:
      [[7,1.25,[-2.5,4,3],'#eef4ff',4],[.8,5,[4.5,.4,2],'#d5eaff',2.8],[1.1,4,[-4,-.5,1],'#dcd6ff',2.3],[6,.65,[0,-4,3],'#d6d9ff',1.6]];
    for(const [w,h,position,color,power] of lights){
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(neutral?'#ffffff':color).multiplyScalar(power),side:THREE.DoubleSide}));
      mesh.position.set(...position);mesh.lookAt(0,0,0);environmentScene.add(mesh);
    }
    const pmrem=new THREE.PMREMGenerator(own.renderer),environment=pmrem.fromScene(environmentScene,.025,.1,50);
    environmentScene.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});pmrem.dispose();
    own.environments.set(environmentKey,environment);
  }
  own.refs++;
  return {renderer:own.renderer,environment:own.environments.get(environmentKey).texture,
    size(width,height){
      // Three r170 assigns both canvas dimensions even when unchanged, which
      // resets the drawing buffer. Resize only when another world needs a
      // different output size, never on every frame of a stable preview.
      if(own.width!==width||own.height!==height){own.renderer.setSize(width,height,false);own.width=width;own.height=height;}
    },release(){
    own.refs--;if(own.refs===0){for(const environment of own.environments.values())environment.dispose();own.renderer.dispose();own.renderer.forceContextLoss();if(pools[kind]===own)delete pools[kind];}
  }};
}

function backgroundMaterial({bg,fg,accent,accent2,W,H,referencePalette}){
  const ground=new THREE.Color(bg),ink=new THREE.Color(fg),light=ground.getHSL({}).l>.5;
  // Preserve the approved prototype's luminous linear RGB palette. The former
  // 23% accent mix flattened it into a dark, desaturated backdrop.
  const colour=referencePalette&&!light?`
        vec3 col=mix(vec3(.009,.018,.09),vec3(.022,.045,1.35),smoothstep(-.95,.5,fold));
        col=mix(col,vec3(.56,.013,.95),smoothstep(.48,.78,r.x)*.8);
        float vein=pow(clamp(.5+.5*sin(f*18.+p.y*2.),0.,1.),32.);
        col+=vec3(.045,.24,.75)*vein*.14;
        float coral=exp(-length((p-vec2(.75,-.5)+q*.4)*vec2(1.7,2.))*1.8);
        col=mix(col,vec3(1.45,.12,.022),coral*.94);
        float cyan=exp(-length(p-vec2(-1.6,.7)+r*.4)*2.4);
        col+=vec3(.005,.53,.83)*cyan;
        vec3 warm=mix(vec3(.045,.006,.018),vec3(1.35,.16,.025),smoothstep(-.95,.5,fold));
        warm=mix(warm,vec3(.42,.018,.10),smoothstep(.5,.78,r.x)*.62);
        col=mix(col,warm,uWarm);
        col+=vec3(.2,.3,.38)*uDive*exp(-length(radial)*2.5);
        col*=.72*(1.-.32*dot(uv-.5,uv-.5));
      `:`
        vec3 a=mix(uAccent,uAccent2,uWarm),b=mix(uAccent2,uAccent,uWarm);
        float amount=mix(.23,.13,uLight);vec3 col=mix(uGround,a,smoothstep(-.95,.5,fold)*amount);
        col=mix(col,b,smoothstep(.48,.78,r.x)*amount*.65);
        float vein=pow(clamp(.5+.5*sin(f*18.+p.y*2.),0.,1.),32.);
        col=mix(col,a,vein*.055);col=mix(col,mix(uGround,vec3(1.),.28),uDive*.28*exp(-length(radial)*2.5));
      `;
  return new THREE.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,
    uniforms:{uTime:{value:0},uAspect:{value:W/H},uWarm:{value:0},uDive:{value:0},uTravel:{value:0},uPan:{value:new THREE.Vector2()},uWide:{value:1},
      uGround:{value:ground},uAccent:{value:new THREE.Color(accent)},uAccent2:{value:new THREE.Color(accent2)},uLight:{value:light?1:0},uInk:{value:ink}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`precision highp float;varying vec2 vUv;
      uniform float uTime,uAspect,uWarm,uDive,uTravel,uLight,uWide;uniform vec2 uPan;uniform vec3 uGround,uAccent,uAccent2,uInk;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      float fbm(vec2 p){float n=0.,a=.5;for(int i=0;i<4;i++){n+=a*noise(p);p=mat2(1.6,-1.2,1.2,1.6)*p;a*=.5;}return n;}
      void main(){vec2 uv=vUv,radial=uv-.5;uv+=radial*uDive*.15*sin(length(radial)*9.-uTravel*2.);
        vec2 p=((uv-.5)*vec2(uAspect,1.)*3.*uWide+uPan)/(1.+uTravel*.075);float t=uTime*.13;
        vec2 q=vec2(fbm(p*.65+vec2(t,-t*.5)),fbm(p*.65+vec2(4.2-t*.4,1.7+t*.6)));
        vec2 r=vec2(fbm(p*.7+q*1.8+vec2(1.7,t*.4)),fbm(p*.7-q*1.3+vec2(-t*.3,3.1)));
        float f=fbm(p*.8+r*2.),fold=sin(p.x*1.8+p.y*2.+f*7.+t);
        ${colour}
        gl_FragColor=vec4(col,1.);
        #include <colorspace_fragment>
      }`
  });
}

export const DEFAULT_MATERIAL=Object.freeze({type:'dark-glass'});
export function createGlassWorld({K,parent,mode,bg,fg,accent,palette,referencePalette=true,placement=null,ride=false,over=false}){
  const {W,H,S,el,set,px}=K,U=1/300;
  // Preview hosts may explicitly spend fewer pixels. Logical layout and text
  // projection retain the video size; exports omit this option and render 1:1.
  const previewScale=K.previewScale??1;
  if(!Number.isFinite(previewScale)||previewScale<.25||previewScale>1)throw new Error('Glass previewScale must be between .25 and 1');
  const renderW=Math.max(1,Math.round(W*previewScale)),renderH=Math.max(1,Math.round(H*previewScale));
  // The family's material when the film names none: smoked, frosted glass,
  // whose text reads over any picture. Clear glass and metal are asked for.
  const material=K.plan.look?.material??DEFAULT_MATERIAL;
  const branded=material.branded===true;
  const metal=material.type==='metal';
  const smoked=material.type==='dark-glass';
  // Glass, clear or smoked, is traced as thick round-edged slabs
  // (liquid.mjs). Metal stays polygons.
  const liquid=!metal;
  // What smoked glass does to what it shows: the tint of its finish, and for a
  // pane a part of the colour taken away.
  // local: the size of the part's own unit, for the specks of the glass.
  const smokeOf=(finish,pane,local=1)=>smoked?{tint:finish.tint,keep:pane?.78:1,pane,grain:.017*S/local}:null;
  const shared=acquireRenderer(smoked?'smoked':branded?'neutral':'legacy',over),renderer=shared.renderer;
  const canvas=el('canvas','pk-glass-canvas',parent);canvas.width=renderW;canvas.height=renderH;canvas.dataset.glass=mode;
  canvas.dataset.glassResolution=JSON.stringify({width:renderW,height:renderH,logicalWidth:W,logicalHeight:H,previewScale});
  set(canvas,{position:'absolute',inset:'0',width:px(W),height:px(H),pointerEvents:'none'});
  // Over footage on a track of its own (`over`): the world draws no backdrop.
  // Its frame is black but for the light of the glass: the last pass keeps
  // that light and makes the black clear (lightOnly); the pane's frost is the
  // page's own blur of what lies under it (frost()).

  const out=canvas.getContext('2d');
  // One original Paper/MetalFx sheet per world, shared by all its cards. It
  // stays small and fixed-size while the geometry morphs; no per-frame resize.
  const metalSheet=metal?createMetal({canvas:canvas.ownerDocument.createElement('canvas'),
    width:140,height:40,shaderScale:1,pixelRatio:1,kind:'fill',
    preset:resolveSurfaceMetalPreset(material),theme:K.lum(fg)>.4?'dark':'light',neutral:false}):null;
  metalSheet?.draw(0);
  const metalTexture=metalSheet?new THREE.CanvasTexture(metalSheet.canvas):null;
  if(metalTexture){metalTexture.colorSpace=THREE.SRGBColorSpace;metalTexture.generateMipmaps=false;
    metalTexture.minFilter=THREE.LinearFilter;metalTexture.magFilter=THREE.LinearFilter;}
  let metalTime=metalSheet?0:null;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(32,W/H,.025,150);
  const distance=H*U/(2*Math.tan(THREE.MathUtils.degToRad(16)));
  camera.position.z=distance;camera.updateMatrixWorld();scene.environment=shared.environment;scene.environmentIntensity=.68;
  const bgScene=new THREE.Scene(),bgCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  // The caller checks actual colour overrides. Independent material selection
  // alone does not replace the component's vivid default background.
  const media=K.glassBackground;
  const mediaTexture=media?new THREE.Texture(media.element):null;
  if(mediaTexture){
    // Sample the same centred cover crop outside and through every glass mesh.
    const ratio=(W/H)/(media.width/media.height);
    mediaTexture.repeat.set(Math.min(1,ratio),Math.min(1,1/ratio));
    mediaTexture.offset.set((1-mediaTexture.repeat.x)/2,(1-mediaTexture.repeat.y)/2);
    // A ride's camera travels past the edge of the picture: it goes on as its own mirror image, with no seam.
    if(ride)mediaTexture.wrapS=mediaTexture.wrapT=THREE.MirroredRepeatWrapping;
    mediaTexture.colorSpace=THREE.SRGBColorSpace;
    mediaTexture.generateMipmaps=false;
    mediaTexture.minFilter=THREE.LinearFilter;
    mediaTexture.needsUpdate=true;
    bgScene.background=new THREE.Color(bg);
  }
  const background=mediaTexture
    ?new THREE.MeshBasicMaterial({map:mediaTexture,toneMapped:false,transparent:true,depthWrite:false})
    :backgroundMaterial({bg,fg,accent,accent2:K.plan.brand?.tokens?.accent2??palette.coral??palette.lilac??accent,W,H,referencePalette});
  const backgroundPlane=new THREE.Mesh(new THREE.PlaneGeometry(2,2),background);bgScene.add(backgroundPlane);
  // Given the footage's own picture as well (`background`), the glass looks at
  // it as it does at any backdrop and bends it; the frame around the glass
  // stays clear, and the footage itself is the film's.
  const refracts=over&&Boolean(media);
  if(over&&!refracts){backgroundPlane.visible=false;bgScene.background=new THREE.Color(0x000000);}
  // The last pass of a world over footage: every pixel as bright as it was drawn, and as clear as it is dark.
  const lightOnly=over?(()=>{
    const target=new THREE.WebGLRenderTarget(renderW,renderH,{type:THREE.HalfFloatType,samples:4});
    const material=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,transparent:true,blending:THREE.NoBlending,uniforms:{map:{value:target.texture}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
      // A pane that shows the footage is as solid as it is drawn; the footage's colours are kept as they are.
      fragmentShader:`uniform sampler2D map;varying vec2 vUv;
        void main(){vec4 seen=texture2D(map,vUv);gl_FragColor=vec4(seen.rgb,1.);
          ${refracts?'':'#include <tonemapping_fragment>'}
          #include <colorspace_fragment>
          gl_FragColor.a=max(${refracts?'seen.a':'0.'},max(gl_FragColor.r,max(gl_FragColor.g,gl_FragColor.b)));}`});
    const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material),pass=new THREE.Scene();pass.add(quad);
    return {target,scene:pass,owned:[target,material,quad.geometry]};
  })():null;
  // Keep supplied SDR media in its source colour space through the background passes.
  const targetFormat=media?{type:THREE.UnsignedByteType,colorSpace:THREE.SRGBColorSpace}:{type:THREE.HalfFloatType};
  const target=new THREE.WebGLRenderTarget(renderW,renderH,{...targetFormat,depthBuffer:false});scene.background=target.texture;
  // Three's transmission buffer omits glass. A lens with a clear lip needs
  // the finished pane behind it, as do the empty switches on smoked glass.
  let panelTarget=null,behindTarget=null;
  const behindLayer=2;
  // Traced parts that are no cards: each brings its shader up to the frame.
  const optics=[];
  const panelLayer=1;
  const cards=[],surfaces=[],extraResources=[];
  if(lightOnly)extraResources.push(...lightOnly.owned);
  const local=new THREE.Matrix4(),clip=new THREE.Matrix4(),corner=new THREE.Vector3();
  const audit={mode,resolution:{width:renderW,height:renderH,logicalWidth:W,logicalHeight:H,previewScale},disposed:false,time:0,camera:{position:[],quaternion:[]},cards:[],surfaces:[],lens:null};
  let disposed=false,textureCanvas=null,textPlane=null,sendWave=null,projectLensCopy=null;
  function createFinish({insetControl=false,edgeGlow=false,localUnit=1,opticalFrame=null}={}){
    // Control meshes are measured in slot heights. Express the same metal ring
    // width and shader crop in those coordinates as on the world-space card.
    return createSurfaceMaterial({theme:material,fg,brand:K.plan.brand?.tokens,
      metalTexture,scale:S/localUnit,insetControl,edgeGlow,opticalFrame});
  }
  function compositePanel(group){
    panelTarget??=new THREE.WebGLRenderTarget(renderW,renderH,{...targetFormat,
      samples:Math.min(4,renderer.capabilities.maxSamples),resolveDepthBuffer:false});
    for(const mesh of group.children)mesh.layers.set(panelLayer);
  }
  function addCard({width,height,element=null,z=0,lens=false,backdropOnly=false,insetControl=false,fixedOptics=false}){
    const geometry=createGlassGeometry();geometry.update(width*U,height*U,Math.min(height*U/2,.24*S),.28*S,.065*S);
    const opticalFrame=fixedOptics?{size:new THREE.Vector2(width*U,height*U),
      restInverse:new THREE.Matrix4(),localToRest:new THREE.Matrix4()}:null;
    const finish=createFinish({insetControl,edgeGlow:true,opticalFrame}),material=finish.material;
    finish.setDimensions(geometry.width,geometry.height,geometry.radius,geometry.depth);
    const surfaceFinish=JSON.stringify({kind:finish.kind,variant:finish.variant,branded:finish.branded,shaderPreset:finish.shaderPreset});
    canvas.dataset.surfaceFinish=surfaceFinish;
    const group=new THREE.Group();group.position.z=z;scene.add(group);
    // A traced card (below) has no polygon pane in the scene. Its geometry
    // stays as the card's measure; its finish gives the slab a smoked tint.
    const traced=liquid;
    const mesh=new THREE.Mesh(geometry.geometry,finish.meshMaterial);if(!traced)group.add(mesh);
    let halo=null;
    if(finish.haloMaterial){const haloGeometry=new THREE.PlaneGeometry(1,1);
      halo=new THREE.Mesh(haloGeometry,finish.haloMaterial);halo.layers.mask=mesh.layers.mask;
      halo.frustumCulled=false;group.add(halo);extraResources.push(haloGeometry);}
    if(backdropOnly&&smoked)compositePanel(group);
    let slab=null,shade=null;
    if(traced){
      target.texture.minFilter=THREE.LinearMipmapLinearFilter;target.texture.generateMipmaps=true;
      // A lens is clear and looks at the backdrop with what lies behind it
      // (the lettering it glides over); a panel is frosted and sees the backdrop.
      if(lens)behindTarget??=new THREE.WebGLRenderTarget(renderW,renderH,targetFormat);
      slab=createLiquidSlab({backdrop:lens?behindTarget.texture:target.texture,camera,unit:U/previewScale,
        // Clear glass is all but transparent: it softens what it shows by a
        // pixel or two and is seen by its edge, which bends the picture.
        // Smoked glass is frosted.
        frost:lens?0:Math.max(0,(smoked?3:.9)+Math.log2(previewScale)),veil:smoked||lens?0:.03,
        // A film with its own brand keeps the brand's colours unsplit, as the
        // polygon glass does.
        deepest:30*S*U,texel:new THREE.Vector2(1/renderW,1/renderH),split:branded||smoked?0:.018,mapped:!media,smoke:smokeOf(finish,!insetControl&&!lens),frame:opticalFrame});
      // A pane casts a shadow and leaves a pool of light; a lens gliding
      // over lettering does not.
      if(!lens){shade=createLiquidShade();group.add(shade.mesh);extraResources.push(shade);}
      group.add(slab.mesh);extraResources.push(slab);
    }
    const card={group,mesh,geometry,material,finish,width,height,element,opticalFrame,slab,shade,halo,lens,opacity:1,
      get contentZ(){return geometry.depth/2+.012;}};
    cards.push(card);
    if(element){element.dataset.glassSurface=String(cards.length-1);element.dataset.surfaceFinish=surfaceFinish;set(element,{position:'absolute',left:'0',top:'0',width:px(width),height:px(height),transformOrigin:'0 0',willChange:'transform'});surfaces.push(card);}
    return card;
  }
  function project(card){
    const {element,group,width,height,unit=U}=card;
    const opacity=card.opacity;set(element,{opacity:String(opacity)});
    const receipt={cardIndex:cards.indexOf(card),text:element.dataset.glassCopy??element.textContent,opacity,corners:[],matrix:[]};
    if(opacity<=0){set(element,{transform:'none'});return receipt;}
    local.set(unit,0,0,-width*unit/2,0,-unit,0,height*unit/2,0,0,1,card.contentZ,0,0,0,1);
    clip.copy(camera.projectionMatrix).multiply(camera.matrixWorldInverse).multiply(group.matrixWorld).multiply(local);
    for(const [x,y] of [[0,0],[width,0],[width,height],[0,height]]){
      corner.set(x,y,0).applyMatrix4(local).applyMatrix4(group.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
      if(corner.z>=-.08){set(element,{opacity:'0',transform:'none'});receipt.opacity=0;return receipt;}
      corner.set(x,y,0).applyMatrix4(clip);receipt.corners.push({x:(corner.x+1)*W/2,y:(1-corner.y)*H/2});
    }
    const m=clip.elements,n=1/m[15];
    const css=[W/2*(m[0]+m[3])*n,H/2*(m[3]-m[1])*n,0,m[3]*n,W/2*(m[4]+m[7])*n,H/2*(m[7]-m[5])*n,0,m[7]*n,0,0,1,0,W/2*(m[12]+m[15])*n,H/2*(m[15]-m[13])*n,0,1];
    receipt.matrix=css;set(element,{transform:`matrix3d(${css.join(',')})`});return receipt;
  }
  // The frost of a pane laid over footage: a blur of what lies under it, in the
  // pane's shape as it stands now, on a layer under the glass's light. It
  // stands outside the pane's copy, whose fading would keep it from the footage.
  function frost(card){
    const {element,width,height,unit=U}=card;
    if(!card.frost){
      const wrap=el('span','pk-glass-frost');wrap.setAttribute('aria-hidden','true');parent.insertBefore(wrap,canvas);
      set(wrap,{position:'absolute',left:'0',top:'0',width:px(width),height:px(height),transformOrigin:'0 0',pointerEvents:'none'});
      const pane=el('span','',wrap),blur=`blur(${px(26*S)}) saturate(1.25)`;
      set(pane,{position:'absolute',backdropFilter:blur,webkitBackdropFilter:blur,background:smoked?'rgba(6,8,20,.5)':'rgba(255,255,255,.07)'});
      card.frost={wrap,pane};
    }
    const w=card.geometry.width/unit,h=card.geometry.height/unit,shown=card.opacity>0&&element.style.transform!=='none';
    set(card.frost.wrap,{transform:element.style.transform,visibility:shown?'visible':'hidden'});
    set(card.frost.pane,{left:px((width-w)/2),top:px((height-h)/2),width:px(w),height:px(h),borderRadius:px(card.geometry.radius/unit),opacity:String(card.opacity)});
  }
  function addControls(card, slots) {
    // Three's transmission buffer leaves a traced pane out, as it leaves out
    // every see-through object: the switches and the slider must look through
    // the finished pane, not at the bare backdrop.
    if(card.slab)compositePanel(card.group);
    const trace=card.slab?{
      pixel:U/previewScale,
      slab({lens,unit,finish}){
        behindTarget??=new THREE.WebGLRenderTarget(renderW,renderH,targetFormat);
        const slab=createLiquidSlab({backdrop:lens?behindTarget.texture:panelTarget.texture,camera,unit,frost:0,deepest:1,
          texel:new THREE.Vector2(1/renderW,1/renderH),split:branded||smoked?0:.018,mapped:!media,smoke:finish?smokeOf(finish,false,U/previewScale/unit):null});
        extraResources.push(slab);return slab;
      },
      behind(...parts){for(const part of parts)part.layers.enable(behindLayer);},
      each(update){optics.push(update);},
    }:null;
    const controls = attachGlassControls(card, U, slots, createFinish, trace);
    extraResources.push(controls);
    return controls;
  }
  // The card's action button (controls.mjs): a wave laid over the card leaves
  // it alone.
  function addSendButton(card, options) {
    card.sendButton = attachActionButton(card, U, options);
    extraResources.push(card.sendButton);
    return card.sendButton;
  }
  // options: tune, the change of the wave's style (send-wave-surface.mjs).
  function addSendWave(card, {source, ink, ...options}) {
    sendWave=createSendWaveSurface({card,unit:U,renderer,source,ink,previewScale,renderW,renderH,...options});
    canvas.dataset.sendWave='distortion-waves@0.1.0';
    extraResources.push(sendWave);
    return (progress,from)=>sendWave.setProgress(progress,from);
  }
  // A ripple in the glass of a traced card (liquid.mjs): the returned function
  // takes the ring this frame, {x, y} in logical pixels from the card's top
  // left, its radius, width and lift in logical pixels, or null for none. While
  // a ring runs, ink() draws the card's lettering in logical pixels into a
  // picture that lies in the glass, and the caller hides its own copy.
  function addRipple(card,{ink}){
    const {slab,width,height,element}=card;
    if(!slab)throw new Error('A ripple needs a traced glass card');
    // The page shows the frame at its logical size: draw the lettering at
    // least that sharp, also in a preview that renders fewer pixels.
    const sharp=Math.max(1,previewScale*2);
    const page=element.ownerDocument.createElement('canvas');
    page.width=Math.max(1,Math.round(width*sharp));page.height=Math.max(1,Math.round(height*sharp));
    const pen=page.getContext('2d');
    const texture=new THREE.CanvasTexture(page);texture.colorSpace=THREE.SRGBColorSpace;
    texture.generateMipmaps=false;texture.minFilter=texture.magFilter=THREE.LinearFilter;
    extraResources.push(texture);
    canvas.dataset.glassRipple='slab';
    let running=false;
    return ring=>{
      if(!ring||!(ring.lift!==0)){
        if(running){slab.ripple(0,0,0,1,0);slab.ink(null);running=false;}
        return false;
      }
      pen.setTransform(1,0,0,1,0,0);pen.clearRect(0,0,page.width,page.height);
      pen.setTransform(sharp,0,0,sharp,0,0);ink(pen);texture.needsUpdate=true;
      slab.ripple((ring.x-width/2)*U,(height/2-ring.y)*U,ring.radius*U,ring.width*U,ring.lift*U);
      slab.ink(texture,width*U,height*U,card.contentZ-slab.mesh.position.z);
      audit.ripple={...ring};
      return running=true;
    };
  }
  function addTextTexture(source,receipt,{card,projection}){
    textureCanvas=source;
    const texture=new THREE.CanvasTexture(source);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
    const factor=(distance+.5)/distance;
    const geo=new THREE.PlaneGeometry(W*U*factor,H*U*factor);
    const mat=new THREE.MeshBasicMaterial({map:texture,toneMapped:false});
    // An opaque composited text plane is included in the transmission buffer.
    // Preserve glyph antialiasing by blending alpha over the exact background
    // instead of alpha-testing (which makes fine letter edges visibly jagged).
    mat.onBeforeCompile=shader=>{
      shader.uniforms.uGlassBackdrop={value:target.texture};
      shader.uniforms.uGlassResolution={value:new THREE.Vector2(renderW,renderH)};
      shader.fragmentShader='uniform sampler2D uGlassBackdrop; uniform vec2 uGlassResolution;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
        diffuseColor.rgb=mix(texture2D(uGlassBackdrop,gl_FragCoord.xy/uGlassResolution).rgb,diffuseColor.rgb,diffuseColor.a);
        diffuseColor.a=1.;`);
    };
    const plane=new THREE.Mesh(geo,mat);textPlane=plane;plane.position.z=-.5;plane.layers.enable(behindLayer);scene.add(plane);extraResources.push(texture,geo,mat);
    // Three samples this plane in its offscreen transmission pass. Native DOM
    // paints the foreground at display resolution outside the optical mesh.
    // Keep the original composited backdrop in the final pass. The shader
    // reads this alpha when blending the glyph, then writes opaque pixels.
    plane.onBeforeRender=()=>{mat.opacity=renderer.getRenderTarget()===null?0:1;};
    const overlay=el('canvas','pk-glass-lens-optics',parent);overlay.width=renderW;overlay.height=renderH;
    set(overlay,{position:'absolute',inset:'0',width:px(W),height:px(H),pointerEvents:'none'});
    // A traced card's polygons are only its measure: they stand where its group stands.
    const drawOptics=createLensOverlay(overlay,canvas,card.slab?{geometry:card.mesh.geometry,matrixWorld:card.group.matrixWorld}:card.mesh);
    const copy={element:projection,group:plane,width:W,height:H,unit:U*factor,contentZ:0,opacity:1};
    projectLensCopy=()=>{
      if(projection)project(copy);
      drawOptics(camera,card.group.visible);
    };
    const pixels=source.getContext('2d').getImageData(0,0,source.width,source.height).data;
    let ink=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>0)ink++;
    audit.lens={...receipt,text:receipt.text,textureCopy:receipt.textureCopy??receipt.text,textureWidth:source.width,textureHeight:source.height,textureReady:true,textureInkPixels:ink,mechanism:metal?'opaque-metal':card.slab?'traced-slab':'three-transmission'};
    canvas.dataset.glassTextTexture=JSON.stringify(audit.lens);
    return plane;
  }
  function render(time,{warm=0,dive=0,travel=0}={}){
    if(disposed)return;
    // A step of a ride shares the ride's backdrop, which moves on with its time.
    const environmentTime=mode==='glass-ask'&&!ride?0:time;
    if(metalSheet&&metalTime!==environmentTime){metalSheet.draw(environmentTime);metalTexture.needsUpdate=true;metalTime=environmentTime;}
    scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
    for(const card of cards){
      const {mesh,finish,geometry,opticalFrame,slab,shade,lens,group}=card;
      // A traced pane stands with its middle in the plane of the page's own
      // layers on it (its text, a wave laid over it): its outline is then
      // theirs from every side. In the middle of the card's depth, the page's
      // rectangle and the pane's edge part by a few pixels as the camera
      // turns, which showed as a second contour beside a wave's rim.
      if(slab&&!lens){
        slab.mesh.position.z=card.contentZ;if(shade)shade.mesh.position.z=card.contentZ;
        // The glow around a smoked pane is drawn at the back of the polygon
        // pane, a whole depth behind this plane: bring it here, or it shows
        // to one side of the pane as the camera turns.
        if(card.halo)card.halo.position.z=card.contentZ+geometry.depth/2;
      }
      shade?.update(geometry.width,geometry.height,geometry.radius);
      finish.setDimensions(geometry.width,geometry.height,geometry.radius,geometry.depth);
      if(slab&&lens)slab.update(geometry.width,geometry.height,geometry.radius,
        {deep:geometry.depth/2,bevel:geometry.bevel,behind:Math.max(.05,group.position.z-(textPlane?.position.z??-.5))});
      else slab?.update(geometry.width,geometry.height,geometry.radius);
      if(opticalFrame)opticalFrame.localToRest.multiplyMatrices(opticalFrame.restInverse,(slab?.mesh??mesh).matrixWorld);
    }
    if(media){
      if(media.kind==='video')mediaTexture.needsUpdate=true;
    }else{
      background.uniforms.uTime.value=2.4+environmentTime*.17;background.uniforms.uWarm.value=warm;
      background.uniforms.uDive.value=dive;background.uniforms.uTravel.value=travel;
    }
    audit.time=time;audit.camera={position:camera.position.toArray(),quaternion:camera.quaternion.toArray()};
    audit.cards=cards.map(c=>({position:c.group.position.toArray(),rotation:c.group.rotation.toArray().slice(0,3),width:c.geometry.width,height:c.geometry.height,visible:c.group.visible,
      // Traced glass has no material to report: it is the slab, with the tint of smoked glass.
      finish:{kind:c.finish.kind,variant:c.finish.variant,branded:c.finish.branded,shaderPreset:c.finish.shaderPreset,
        ...(c.slab?{traced:true,tint:c.finish.tint?'#'+c.finish.tint.getHexString():null}:
          {color:'#'+c.material.color.getHexString(),metalness:c.material.metalness,transmission:c.material.transmission,
            roughness:c.material.roughness,edgeMetalness:c.finish.edgeMaterial?.metalness??null})}}));
    audit.surfaces=surfaces.map(project);
    if(over&&!refracts)for(const card of surfaces)frost(card);
    for(const update of optics)update();
    shared.size(renderW,renderH);renderer.setRenderTarget(target);renderer.render(bgScene,bgCamera);
    if(panelTarget){
      scene.background=target.texture;camera.layers.set(panelLayer);
      renderer.setRenderTarget(panelTarget);renderer.render(scene,camera);
      camera.layers.set(0);scene.background=panelTarget.texture;
    }
    if(behindTarget){
      // What a traced lens looks at: the backdrop, or the finished pane, with
      // what lies behind the lens (the lettering it glides over; a casing,
      // a rail and a disc under a thumb).
      camera.layers.set(behindLayer);
      renderer.setRenderTarget(behindTarget);renderer.render(scene,camera);
      camera.layers.set(0);
    }
    renderer.setRenderTarget(null);
    sendWave?.render(scene,camera);
    if(lightOnly){
      // The frame in full, then only its light on a clear frame: black is no light.
      // The frame around the glass is nothing: only what is drawn has a place in it.
      const behind=scene.background;if(refracts)scene.background=null;
      renderer.setRenderTarget(lightOnly.target);renderer.render(scene,camera);scene.background=behind;
      renderer.setRenderTarget(null);renderer.clear();renderer.render(lightOnly.scene,bgCamera);
      out.clearRect(0,0,renderW,renderH);
    }else renderer.render(scene,camera);
    // The source is opaque and covers the whole output; a clear/readback pass is unnecessary.
    out.drawImage(renderer.domElement,0,0,renderW,renderH);
    projectLensCopy?.();
    canvas.dataset.glassTime=String(time);
  }
  // Where the panel stands and how large it is (grid.mjs glassPlacement): the
  // whole world is scaled and moved after it is projected, so the glass, its
  // optics, the lettering laid over it and every camera move stay together.
  // The backdrop is not part of it: a photo or a video fills the frame.
  let placed=null;
  function place(){
    if(placed||!placement||!cards.length)return;
    const first=cards[0],k=first.group.scale.x;
    placed=glassPlacement(K,placement,{w:first.width*k,h:first.height*k});
    if(placed.scale===1&&!placed.dx&&!placed.dy)return;
    const move=new THREE.Matrix4().set(placed.scale,0,0,2*placed.dx/W, 0,placed.scale,0,-2*placed.dy/H, 0,0,1,0, 0,0,0,1);
    camera.projectionMatrix.premultiply(move);camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    canvas.dataset.glassPlacement=JSON.stringify(placed);
  }
  // A ride carries a panel on from where it stands: the same move of the
  // projected world, by `dx` and `dy` frame pixels from its place, squashed or
  // stretched by `sx` and `sy` about the panel's own middle.
  let rest=null;
  function shift(dx,dy,sx=1,sy=1){
    rest??=camera.projectionMatrix.clone();
    const cx=2*(placed?.dx??0)/W,cy=-2*(placed?.dy??0)/H;
    camera.projectionMatrix.copy(rest).premultiply(new THREE.Matrix4().set(sx,0,0,cx*(1-sx)+2*dx/W, 0,sy,0,cy*(1-sy)-2*dy/H, 0,0,1,0, 0,0,0,1));
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }
  // The camera of a ride moves over one large backdrop: `x` and `y` frame
  // pixels to the right and down from where the ride began, pulled back so
  // that it sees `wide` times as much. A photo or a video of the user's is
  // travelled the same way, mirrored beyond its edges.
  const crop=mediaTexture?{repeat:mediaTexture.repeat.clone(),offset:mediaTexture.offset.clone()}:null;
  function pan(x,y,wide=1){
    if(!media){background.uniforms.uPan.value.set(3*x/H,-3*y/H);background.uniforms.uWide.value=wide;return;}
    const {repeat,offset}=crop;
    mediaTexture.repeat.set(repeat.x*wide,repeat.y*wide);
    mediaTexture.offset.set(offset.x+repeat.x*(x/W-(wide-1)/2),offset.y-repeat.y*(y/H+(wide-1)/2));
  }
  // Where the panel's middle stands, in frame pixels from the frame's middle.
  const stands=()=>({dx:placed?.dx??0,dy:placed?.dy??0});
  function prepare(){
    place();
    for(const {mesh,slab,opticalFrame} of cards){
      if(opticalFrame){
        // A traced card has no polygon pane in the scene: its slab stands for it.
        const body=slab?.mesh??mesh;
        body.updateWorldMatrix(true,false);
        opticalFrame.restInverse.copy(body.matrixWorld).invert();
      }
    }
    shared.size(renderW,renderH);
    const ready=renderer.compileAsync(scene,camera).then(()=>{if(!disposed)render(0);});
    K.defer(ready);return ready;
  }
  function dispose(){
    if(disposed)return;disposed=true;audit.disposed=true;
    for(const card of cards){card.geometry.dispose();card.finish.dispose();}
    for(const resource of extraResources)resource.dispose();
    metalTexture?.dispose();metalSheet?.dispose();mediaTexture?.dispose();
    panelTarget?.dispose();behindTarget?.dispose();target.dispose();background.dispose();backgroundPlane.geometry.dispose();shared.release();
  }
  K.onDispose(dispose);
  K.glass={audit:()=>structuredClone(audit),get textureCanvas(){return textureCanvas;},canvas,dispose,
    inspect:()=>({scene,backdropScene:bgScene,camera,lens:mode==='glass-lens'?cards[0]?.group:null,textPlane,sendWave,render:()=>render(audit.time)})};
  return {scene,backdropScene:bgScene,camera,distance,U,canvas,addCard,addControls,addSendButton,addSendWave,addRipple,addTextTexture,render,prepare,dispose,shift,stands,pan};
}
