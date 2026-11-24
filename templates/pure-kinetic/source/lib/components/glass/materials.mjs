import * as THREE from '../../vendor/three/three.module.min.js';
import {METAL_PRESETS,resolveBrandMetalColors} from '../metal/metal.mjs';
import {lum} from '../maths.mjs';

export function resolveSurfaceMetalPreset(theme){
  if(theme?.type!=='metal')return null;
  return theme.branded===true?'chromatic':METAL_PRESETS.includes(theme.variant)?theme.variant:'silver';
}

// Geometry describes the boundary right now. The illumination and sample
// coordinates of a growing sheet can instead refer to its fixed studio pose.
const opticalCoordinates = `
  #ifdef PK_FIXED_OPTICS
  uniform mat4 uLocalToRest;
  uniform vec2 uRestSize;
  vec2 fieldPoint(vec2 p){return (uLocalToRest*vec4(p,0.,1.)).xy;}
  vec2 fieldSize(vec2 size){return uRestSize;}
  #else
  vec2 fieldPoint(vec2 p){return p;}
  vec2 fieldSize(vec2 size){return size;}
  #endif
`;

// Distribution of a strip light across the outer pane and the raised inner
// button. The surface reflection and the narrow glow share the same source.
const smokedLight = `
  void smokedLight(vec2 uv, vec2 edgeNormal, out float strip, out float scatter) {
    #ifdef PK_SMOKED_PANEL
      vec2 lampWidth = vec2(0.21, 0.29);
      float lowerWidth = 0.175;
    #else
      vec2 lampWidth = vec2(0.35, 0.32);
      float lowerWidth = 0.285;
    #endif
    vec2 lamp = (uv - vec2(0.13, 0.97)) / lampWidth;
    float upper = exp(-dot(lamp, lamp));
    float towardUpper = max(dot(edgeNormal, vec2(-0.60, 0.80)), 0.0);
    float alongLower = (uv.x - 0.105) / lowerWidth;
    float lower = exp(-alongLower * alongLower) * (1.0 - smoothstep(0.0, 0.45, uv.y));
    float towardLower = max(dot(edgeNormal, vec2(-0.43, -0.90)), 0.0);
    #ifdef PK_SMOKED_PANEL
      strip = 5.4 * upper * towardUpper + 0.80 * lower * towardLower;
      scatter = upper * 0.033;
    #else
      strip = 7.6 * upper * towardUpper + 9.0 * lower * towardLower;
      // Light travels a little way into the thicker left end of the button.
      float throughLeft = (uv.x - 0.09) / 0.27;
      scatter = upper * 0.075 + lower * 0.041 + 0.017 * exp(-throughLeft * throughLeft);
    #endif
  }`;

// The light of smoked glass: the strip of the black studio along the rim that
// faces it, its softer shoulder, the specks of the glass that scatter it and,
// on a raised button large enough to show them, single glints. The polygon
// material and the traced slab (liquid.mjs) share it. It reads the surface's
// size from uPanelDimensions, its point from vPanelPoint and the specks' pitch
// from uSmokeGrainPitch; PK_GRAIN_GAIN is how strongly the specks are lit.
export const smokedSurface = `
  ${smokedLight}
  float grainHash(vec2 cell) {
    vec3 p = fract(vec3(cell.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }
  // Microscopic inclusions scatter the strip light only where it hits. Anchor
  // them in physical surface units so they stay attached through a camera move.
  float glassGrain(vec2 p) {
    vec2 cell = floor(p);
    vec2 offset = vec2(grainHash(cell), grainHash(cell + vec2(19.0, 7.0)));
    vec2 q = fract(p) - (0.23 + 0.54 * offset);
    float aa = max(fwidth(p.x), fwidth(p.y));
    float speck = 1.0 - smoothstep(0.035, 0.09 + aa * 0.5, length(q));
    return speck * pow(offset.x, 10.0) * (1.0 - smoothstep(0.35, 0.8, aa));
  }
  float glassGlint(vec2 offset, vec2 extent) {
    vec2 p = abs(offset * extent / uSmokeGrainPitch);
    vec2 aa = max(fwidth(offset * extent / uSmokeGrainPitch), vec2(0.08));
    float core = exp(-dot(p, p) * 9.0);
    float crossX = exp(-p.x * 0.48 - p.y / (0.075 + aa.y * 0.3));
    float crossY = exp(-p.y * 0.64 - p.x / (0.075 + aa.x * 0.3));
    return core + 0.38 * (crossX + crossY);
  }
  float smokedReflection(vec2 uv, vec2 edgeNormal, float sdf, float shortAxis) {
    // All distances along the profile are inside the silhouette. The two
    // Gaussian widths model the hot strip and the softer reflected shoulder.
    float depth = abs(sdf);
    float aa = max(fwidth(sdf), 0.00001);
    float strip, scatter;
    smokedLight(uv, edgeNormal, strip, scatter);
    float coreWidth = 0.0065 * shortAxis;
    float glints = 0.0;
    #ifndef PK_SMOKED_PANEL
      coreWidth += 0.016 * shortAxis * smoothstep(1.6, 5.5, strip);
      // Large raised buttons can resolve individual glints. Small controls
      // keep the continuous bevel highlight at their native screen size.
      float resolved = smoothstep(10.0, 22.0, shortAxis / uSmokeGrainPitch);
      if (resolved > 0.0) {
        vec2 size = fieldSize(uPanelDimensions.xy);
        glints = resolved * (2.9 * glassGlint(uv - vec2(0.293, 0.98), size)
               + 2.0 * glassGlint(uv - vec2(0.645, 0.975), size)
               + 0.7 * glassGlint(uv - vec2(0.481, 0.73), size)
               + 0.9 * glassGlint(uv - vec2(0.125, 0.28), size));
      }
    #endif
    float core = exp(-pow(depth / max(coreWidth, 0.90 * aa), 2.0));
    float shoulder = exp(-depth / max(0.042 * shortAxis, 1.6 * aa));
    float dust = glassGrain(fieldPoint(vPanelPoint) / uSmokeGrainPitch);
    return core * strip + shoulder * (0.075 * strip) + scatter * (1.0 + PK_GRAIN_GAIN * dust) + glints;
  }
`;

// Glass, clear or smoked, is drawn by the traced slab (liquid.mjs) and has no
// material of its own. Its polygons stay as the surface's measure and place
// with this stand-in on them, never drawn. What the slab takes from the finish
// is the tint of smoked glass.
function createGlassStandIn(){
  return new THREE.MeshBasicMaterial({visible:false});
}
// Preserve dark brand ink on light grounds. The thinner inset glass lets the
// authored switch and slider colours show through the moving thumb.
function smokedTint(insetControl,fg){
  return new THREE.Color(insetControl?'#e8e9eb':lum(fg??'#ffffff')<.2?'#b8babd':'#999da2');
}

// The original metal-fx button is a flat centre with a one-CSS-pixel animated
// ring. The world supplies its canonical shader sheet; both cap and bevel
// sample it directly, without a second lighting model changing its colours.
const metalSampling=`
  ${opticalCoordinates}
  uniform sampler2D uMetalSheet;
  uniform vec4 uMetalDimensions;
  uniform vec3 uMetalBody;
  uniform float uMetalHasSheet,uMetalRingWidth,uMetalCssPixels;
  float metalDistance(vec2 p){
    vec2 q=abs(p)-uMetalDimensions.xy*.5+uMetalDimensions.z;
    return min(max(q.x,q.y),0.)+length(max(q,0.))-uMetalDimensions.z;
  }
  vec4 metalSample(vec2 p){
    if(uMetalHasSheet<.5)return vec4(uMetalBody,1.);
    // Keep the reference button's 1.6x crop even on a large video panel.
    // The uncropped Paper sheet fades to transparent at its outer border.
    vec2 size=fieldSize(uMetalDimensions.xy);
    vec2 crop=min(vec2(1./1.6),size*uMetalCssPixels/vec2(224.,64.));
    vec2 uv=.5+fieldPoint(p)/size*crop;
    return texture2D(uMetalSheet,clamp(uv,vec2(0.),vec2(1.)));
  }
`;

function createMetalMaterial(uniforms){
  const material=new THREE.MeshPhysicalMaterial({
    color:uniforms.uMetalBody.value,metalness:1,transmission:0,opacity:1,
    roughness:.24,envMapIntensity:0,specularColor:'#ffffff',clearcoat:0,iridescence:0,toneMapped:false,
  });
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader='varying vec3 vMetalPosition;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vMetalPosition=position;`);
    shader.fragmentShader='varying vec3 vMetalPosition;\n'+metalSampling+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
      float metalD=metalDistance(vMetalPosition.xy);
      float metalAA=max(fwidth(metalD),.0001);
      float metalRing=1.-smoothstep(uMetalRingWidth-metalAA,uMetalRingWidth+metalAA,-metalD);
      vec4 metal=metalSample(vMetalPosition.xy);
      outgoingLight=mix(uMetalBody,metal.rgb,metalRing*metal.a);
      #include <opaque_fragment>`);
  };
  material.customProgramCacheKey=()=> 'pk-canonical-metal-ring-v1';
  return material;
}

function createMetalHalo(uniforms,scale,light){
  return new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide,
    uniforms:{...uniforms,uMetalHaloExtent:{value:.3*scale},uMetalHaloAlpha:{value:light?.11:.3}},
    vertexShader:`
      uniform vec4 uMetalDimensions;uniform float uMetalHaloExtent;
      varying vec2 vMetalPosition;
      void main(){
        vec3 p=position;
        p.xy*=uMetalDimensions.xy+vec2(2.*uMetalHaloExtent);
        p.z=-uMetalDimensions.w*.5-uMetalHaloExtent/60.;
        vMetalPosition=p.xy;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
      }`,
    fragmentShader:`precision highp float;
      varying vec2 vMetalPosition;
      uniform float uMetalHaloExtent,uMetalHaloAlpha;
      ${metalSampling}
      void main(){
        float d=metalDistance(vMetalPosition),aa=max(fwidth(d),.0001);
        if(d < -aa)discard;
        // The same moving sheet lights the halo. No independent clock,
        // random walk or previous-frame state can make reverse seeks differ.
        vec4 metal=metalSample(vMetalPosition);
        float light=smoothstep(.12,.75,max(metal.r,max(metal.g,metal.b)));
        float spread=max(d,0.)/uMetalHaloExtent;
        float falloff=.68*exp(-spread*spread*100.)+.32*exp(-spread*spread*16.);
        float alpha=smoothstep(-aa,aa,d)*falloff*light*metal.a*uMetalHaloAlpha;
        gl_FragColor=vec4(metal.rgb,alpha);
        #include <colorspace_fragment>
      }`,
  });
}

// Local forward scatter immediately outside a polished lip. Only large card
// meshes request this quad; switches and slider thumbs use their real bevel.
function createGlassGlow(dimensions,scale,inset,fieldUniforms){
  return new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,toneMapped:false,
    defines:inset?{}:{PK_SMOKED_PANEL:1},
    uniforms:{...fieldUniforms,uPanelDimensions:dimensions,uGlowExtent:{value:0.075*scale}},
    vertexShader:`
      uniform vec4 uPanelDimensions;uniform float uGlowExtent;
      varying vec2 p;
      void main(){
        p=position.xy*(uPanelDimensions.xy+2.0*uGlowExtent);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,-0.5*uPanelDimensions.w,1.0);
      }`,
    fragmentShader:`precision highp float;
      uniform mat4 modelMatrix;
      uniform vec4 uPanelDimensions;uniform float uGlowExtent;varying vec2 p;
      ${opticalCoordinates}
      ${smokedLight}
      void main(){
        vec2 halfSize=uPanelDimensions.xy*0.5;
        vec2 q=abs(p)-halfSize+uPanelDimensions.z;
        vec2 arc=max(q,0.0);
        float d=length(arc)+min(max(q.x,q.y),0.0)-uPanelDimensions.z;
        if(d<0.0 || d>uGlowExtent)discard;
        vec2 outward=length(arc)>0.0?normalize(arc):vec2(step(q.y,q.x),step(q.x,q.y));
        vec2 viewEdge=(viewMatrix*modelMatrix*vec4(sign(p)*outward,0.,0.)).xy;
        float strip,scatter;
        smokedLight(0.5+fieldPoint(p)/fieldSize(uPanelDimensions.xy),viewEdge/max(length(viewEdge),0.0001),strip,scatter);
        float spread=d/uGlowExtent;
        float alpha=(1.0-exp(-0.22*strip))*0.27*exp(-spread*spread*9.0);
        gl_FragColor=vec4(vec3(1.0),alpha);
        #include <colorspace_fragment>
      }`,
  });
}

// Geometry, copy and choreography stay shared. Only the surface finish changes.
// The world owns metalTexture; all of its cards borrow that same timed sheet.
export function createSurfaceMaterial({theme,insetControl=false,edgeGlow=false,fg,brand,metalTexture=null,scale=1,opticalFrame=null}={}){
  const requested=theme?.type;
  const kind=requested==='dark-glass'||requested==='metal'?requested:'glass',branded=theme?.branded===true;
  const smoked=kind==='dark-glass';
  const shaderPreset=resolveSurfaceMetalPreset(theme);
  const variant=kind==='metal'&&!branded?shaderPreset:kind==='metal'?'silver':null;
  const colors=kind==='metal'?resolveBrandMetalColors(branded?(brand??{}):{},{foreground:fg}):null;
  const dimensions={value:new THREE.Vector4(1,1,.22,.28*scale)};
  const fieldUniforms=opticalFrame?{uLocalToRest:{value:opticalFrame.localToRest},uRestSize:{value:opticalFrame.size}}:{};
  const uniforms=colors?{
    ...fieldUniforms,
    uMetalSheet:{value:metalTexture},uMetalHasSheet:{value:metalTexture?1:0},uMetalDimensions:dimensions,
    uMetalBody:{value:new THREE.Color(colors.base)},uMetalRingWidth:{value:.015*scale},uMetalCssPixels:{value:300/(4.5*scale)},
  }:null;
  const material=kind==='metal'?createMetalMaterial(uniforms):createGlassStandIn();
  const tint=smoked?smokedTint(insetControl,fg):null;
  const edgeMaterial=kind==='metal'?material:null;
  const ink=colors?new THREE.Color(colors.foreground):null;
  const light=ink?ink.r*.2126+ink.g*.7152+ink.b*.0722<=Math.sqrt(.0525)-.05:false;
  const haloMaterial=smoked&&edgeGlow?createGlassGlow(dimensions,scale,insetControl,fieldUniforms):
    kind==='metal'&&!insetControl?createMetalHalo(uniforms,scale,light):null;
  if(opticalFrame){
    if(kind==='metal')material.defines.PK_FIXED_OPTICS=1;
    if(haloMaterial)haloMaterial.defines.PK_FIXED_OPTICS=1;
  }
  let disposed=false;
  return {
    material,edgeMaterial,meshMaterial:material,haloMaterial,
    kind,variant,shaderPreset,branded,tint,
    setDimensions(width,height,radius,depth=dimensions.value.w){
      dimensions.value.set(width,height,Math.min(radius,width/2,height/2),depth);
    },
    dispose(){
      if(disposed)return;
      disposed=true;
      material.dispose();haloMaterial?.dispose();
    },
  };
}
