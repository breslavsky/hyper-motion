import * as THREE from '../../vendor/three/three.module.min.js';
import {smokedSurface} from './materials.mjs';

// Liquid glass: a thick slab of nearly clear glass whose edge is a full round, traced per
// pixel through the shape's own formula instead of drawn as polygons. A ray
// bends where it enters the front, crosses the volume and bends again where it
// leaves, so the slab is a real lens with real thickness: lines of the picture
// behind it curve in its edge, and the light that bounces off its back wall
// shows as a second, fainter highlight beside the first. Each colour leaves at
// its own angle. The shape is a rounded rectangle from a pill to a card, given
// each frame, so it follows every morph.
//
// A ripple is part of the shape: where its ring passes, the slab swells, so the
// glass itself bends the picture, its highlights and its rim there, with no
// layer laid over it. Lettering handed in as a picture lies in the slab while
// a ripple runs and is carried by the same swell.
// mapped: the backdrop holds scene light, which the renderer maps to the
// screen wherever it shows it, so the slab maps what it shows the same way. A
// backdrop that is a picture or a video is shown as it is, and so is the slab.
// smoked: 'pane' or 'part' for smoked glass, which carries the strip light,
// the grain and the glints of the polygon material it replaced
// (materials.mjs), as a pane or as a raised part on it.
const material = (backdrop, mapped, smoked, fixed) => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, toneMapped: mapped,
  defines: {...(smoked ? {PK_SMOKED_GLASS: 1} : {}), ...(smoked === 'pane' ? {PK_SMOKED_PANEL: 1} : {}), ...(fixed ? {PK_FIXED_OPTICS: 1} : {})},
  uniforms: {
    uBackdrop: {value: backdrop}, uPlane: {value: new THREE.Vector2(1, 1)},
    uHalf: {value: new THREE.Vector2(1, 1)}, uRadius: {value: .1}, uThick: {value: .1}, uGap: {value: .3},
    uPixel: {value: .003}, uFrost: {value: 2}, uTexel: {value: new THREE.Vector2()},
    uWave: {value: new THREE.Vector4()}, uLift: {value: 0}, uInk: {value: null}, uInkHalf: {value: new THREE.Vector2(1, 1)}, uInked: {value: 0}, uInkZ: {value: 0}, uSplit: {value: .018}, uBulge: {value: 0}, uEdge: {value: .1}, uVeil: {value: 0},
    uTint: {value: new THREE.Color(1, 1, 1)}, uKeep: {value: 1}, uDark: {value: 0},
    uPanelDimensions: {value: new THREE.Vector4(1, 1, .1, .1)}, uSmokeGrainPitch: {value: .017},
    uCamera: {value: new THREE.Vector3()}, uToClip: {value: new THREE.Matrix4()},
  },
  vertexShader: `uniform vec2 uPlane;varying vec3 vLocal;
    void main(){vLocal=vec3(position.xy*uPlane,0.);gl_Position=projectionMatrix*modelViewMatrix*vec4(vLocal,1.);}`,
  fragmentShader: `precision highp float;
    uniform sampler2D uBackdrop;uniform vec2 uHalf;uniform float uRadius,uThick,uGap,uPixel,uFrost,uLift,uInked,uInkZ,uSplit,uBulge,uEdge,uVeil,uKeep,uDark;uniform vec3 uTint;uniform vec2 uTexel,uInkHalf;uniform vec4 uWave;uniform sampler2D uInk;
    uniform vec3 uCamera;uniform mat4 uToClip;varying vec3 vLocal;
    const float IOR=1.5;
    float outline(vec2 p){vec2 q=abs(p)-uHalf+uRadius;return length(max(q,0.))+min(max(q.x,q.y),0.)-uRadius;}
    // A ring around uWave.xy, uWave.w wide, its outer edge at uWave.z: how
    // much thicker the slab is there.
    float swell(vec2 p){
      if(uLift==0.)return 0.;
      float u=clamp((length(p-uWave.xy)-(uWave.z-uWave.w))/uWave.w,0.,1.),bell=sin(3.14159265*u);
      return uLift*bell*bell;
    }
    // The outline pulled out to both sides, its edge rounded by uEdge: all the
    // way for a panel, as a bevel around the flat faces of a lens.
    float slab(vec3 p){
      float e=uEdge;
      vec2 w=vec2(outline(p.xy)+e,abs(p.z)-(uThick+swell(p.xy)-e));
      return min(max(w.x,w.y),0.)+length(max(w,0.))-e;
    }
    vec3 normalAt(vec3 p){
      vec2 h=vec2(uPixel*.5,0.);
      return normalize(vec3(slab(p+h.xyy)-slab(p-h.xyy),slab(p+h.yxy)-slab(p-h.yxy),slab(p+h.yyx)-slab(p-h.yyx)));
    }
    // The picture stands uGap behind the slab's middle.
    vec2 seen(vec3 p,vec3 d){
      vec3 at=p+d*((-uGap-p.z)/min(d.z,-.001));
      vec4 clip=uToClip*vec4(at,1.);
      return clip.xy/clip.w*.5+.5;
    }
    // Frost: five looks at a smaller copy of the picture, spread wider than
    // one of its texels, so the blur is even and shows no blocks.
    vec3 frosted(vec2 uv){
      vec2 r=uFrost>0.?uTexel*exp2(uFrost)*.85:vec2(0.);
      float lod=max(uFrost-1.,0.);
      return (textureLod(uBackdrop,uv,lod).rgb*2.
        +textureLod(uBackdrop,uv+r*vec2(.92,.38),lod).rgb+textureLod(uBackdrop,uv+r*vec2(-.38,.92),lod).rgb
        +textureLod(uBackdrop,uv+r*vec2(-.92,-.38),lod).rgb+textureLod(uBackdrop,uv+r*vec2(.38,-.92),lod).rgb)/6.;
    }
    vec3 leave(vec3 d,vec3 inward,float ior){
      vec3 out_=refract(d,inward,ior);
      return dot(out_,out_)>0.?out_:reflect(d,inward);
    }
    float studio(vec3 d){
      vec3 key=normalize(vec3(-.5,.72,.55)),fill=normalize(vec3(.62,-.45,.5));
      // The black studio's one strip of light is drawn as the pane's sheen.
      return mix(1.5*pow(max(dot(d,key),0.),110.)+.28*pow(max(dot(d,fill),0.),36.),0.,uDark);
    }
    #ifdef PK_SMOKED_GLASS
    uniform vec4 uPanelDimensions;uniform float uSmokeGrainPitch;
    // What the shared light reads from a polygon surface, given here.
    vec2 vPanelPoint;
    // A sheet that grows or folds keeps its light where the whole sheet
    // had it: the point and the size are those of its pose at rest.
    #ifdef PK_FIXED_OPTICS
    uniform mat4 uLocalToRest;uniform vec2 uRestSize;
    vec2 fieldPoint(vec2 p){return (uLocalToRest*vec4(p,0.,1.)).xy;}
    vec2 fieldSize(vec2 size){return uRestSize;}
    #else
    vec2 fieldPoint(vec2 p){return p;}
    vec2 fieldSize(vec2 size){return size;}
    #endif
    // The specks are lit about twice as strongly as on the polygon pane:
    // under the same number they came out fainter here and were hard to see.
    #define PK_GRAIN_GAIN 13.0
    ${smokedSurface}
    float smokedSheen(vec2 q){
      vec2 e=vec2(uPixel,0.);
      vec2 outward=normalize(vec2(outline(q+e)-outline(q-e),outline(q+e.yx)-outline(q-e.yx))+1e-6);
      vPanelPoint=q;
      vec2 size=fieldSize(2.*uHalf);
      return smokedReflection(.5+fieldPoint(q)/size,outward,outline(q),.5*min(size.x,size.y));
    }
    #endif
    // What one ray shows, through the point of the quad it is aimed at: its
    // colour, mapped to the screen, and how much of a pixel it covers.
    vec4 look(vec3 through){
      vec3 ro=uCamera,rd=normalize(through-ro);
      float eps=uPixel*.25,reach=uThick+abs(uLift),t=(reach-ro.z)/rd.z,near=1e9;
      bool hit=false;
      for(int i=0;i<56;i++){
        float d=slab(ro+rd*t);
        near=min(near,d);
        if(d<eps){hit=true;break;}
        // A swelling slab is not an exact distance; shorter steps stay safe.
        t+=d*.8;
        if(ro.z+rd.z*t<-reach)break;
      }
      // A thin slab's silhouette is its outline in the middle plane, where
      // this quad lies: its distance there gives an even, soft edge. A deep
      // one (uBulge) stands out past that outline when seen from the side, so
      // its edge is where rays stop hitting it. A ray that just
      // misses adds a pale half pixel.
      float cover=mix(clamp(.5-outline(through.xy)/uPixel,0.,1.),hit?1.:.7*clamp(1.-near/uPixel,0.,1.),uBulge);
      if(cover<=0.)return vec4(0.);
      if(!hit){
        // A ray that only grazes the round edge sees the studio in it.
        vec3 graze=vec3(.28);
        #ifdef TONE_MAPPING
        graze=toneMapping(graze);
        #endif
        return vec4(graze,cover*.6);
      }
      vec3 p=ro+rd*t,n=normalAt(p);
      float facing=max(dot(-rd,n),0.),fresnel=.04+.96*pow(1.-facing,5.);
      vec3 inside=refract(rd,n,1./IOR);
      float run=eps*4.;
      for(int i=0;i<40;i++){
        float d=-slab(p+inside*run);
        if(d<eps)break;
        run+=max(d*.8,eps);
      }
      vec3 exit=p+inside*run,back=normalAt(exit);
      vec3 col=vec3(
        frosted(seen(exit,leave(inside,-back,IOR-uSplit))).r,
        frosted(seen(exit,leave(inside,-back,IOR))).g,
        frosted(seen(exit,leave(inside,-back,IOR+uSplit))).b);
      // Clear glass takes a little light on a long way through.
      col*=exp(-vec3(.42,.3,.24)*run);
      // Smoked glass takes some of the colour and some of the light.
      col=mix(vec3(dot(col,vec3(.2126,.7152,.0722))),col,uKeep)*uTint;
      vec3 mirrored=reflect(rd,n);
      // The studio is light all round: a grazing edge mirrors it as a pale
      // line, never as a dark one, which on a small part breaks into dots.
      // Smoked glass stands in a black studio under one strip of light.
      float sky=mix(mix(.22,.36,smoothstep(-.25,.9,mirrored.y)),mix(.012,.07,smoothstep(.2,.95,mirrored.y)),uDark);
      // The back wall mirrors the studio once more, through the glass.
      // Where the surface turns away from the eye a highlight is smaller
      // than a pixel and would flicker as dots: let it go there.
      float lit=smoothstep(.06,.34,facing);
      float second=.55*studio(reflect(inside,-back))*(1.-fresnel)*lit;
      // Frost scatters a little of the studio's light back: the body of the
      // glass is a shade lighter than what it stands in front of.
      col=mix(col,vec3(1.),uVeil);
      col=col*(1.-fresnel)+vec3(sky*fresnel+studio(mirrored)*lit+second);
      #ifdef PK_SMOKED_GLASS
      // The strip of light runs along the outline, a line a pixel wide. It is
      // placed by the point of the quad, where the outline is exact and
      // smooth, the same that gives the slab its edge. Placed by the point
      // the ray hits on the rounded edge, it broke into steps and dashes: the
      // hit lies a little inside the outline and jitters from pixel to pixel.
      col+=vec3(smokedSheen(through.xy));
      #endif
      // Map the light of the scene to the screen before the lettering goes
      // on: the page's own text is never mapped.
      #ifdef TONE_MAPPING
      col=toneMapping(col);
      #endif
      if(uInked>0.){
        // Lettering lies where the page puts it while the face is flat: in
        // the plane uInkZ, which the page projects its text from. It slides
        // with the tilt of a swelling face.
        float flat_=step(outline(p.xy),-uEdge);
        vec2 page=ro.xy+rd.xy*((uInkZ-ro.z)/rd.z);
        vec2 at=page-flat_*n.xy/max(n.z,.2)*uThick*2.5;
        vec2 uv=at/(2.*uInkHalf)+.5;
        if(uv.x>0.&&uv.x<1.&&uv.y>0.&&uv.y<1.){
          // Blend as the page blends its own text, in display values, or
          // light lettering comes out heavier than the copy it stands in for.
          vec4 ink=texture2D(uInk,uv);
          col=pow(mix(pow(max(col,0.),vec3(1./2.2)),pow(ink.rgb,vec3(1./2.2)),ink.a*uInked),vec3(2.2));
        }
      }
      return vec4(col,cover);
    }
    void main(){
      vec4 seen_;
      if(uBulge>.5){
        // A deep part is often a few pixels across, a switch's thumb: one ray
        // a pixel breaks its rim into dots. Four rays a pixel draw it evenly.
        vec3 dx=dFdx(vLocal)*.25,dy=dFdy(vLocal)*.25;
        vec4 a=look(vLocal-dx-dy),b=look(vLocal+dx-dy),c=look(vLocal-dx+dy),d=look(vLocal+dx+dy);
        float cover=a.a+b.a+c.a+d.a;
        if(cover<=0.)discard;
        seen_=vec4((a.rgb*a.a+b.rgb*b.a+c.rgb*c.a+d.rgb*d.a)/cover,cover*.25);
      }else{
        seen_=look(vLocal);
        if(seen_.a<=0.)discard;
      }
      gl_FragColor=seen_;
      #include <colorspace_fragment>
    }`,
});

/** One liquid slab in a card's group. update() follows the card's size each frame. */
// unit: the world size of one rendered pixel. frost: the blur of the picture
// seen through the slab, as a mip level of the backdrop. deepest: the most a
// slab is thick from its middle, in world units; a low field is thinner, so
// that only its edge is a lens and its face stays flat. split: how far apart
// the colours leave the glass; 0 keeps a brand's colours whole at the edge.
// smoke: for smoked glass {tint, keep, pane, grain}: the colour it multiplies
// what it shows by, how much of the colour's saturation it keeps, whether it
// is a pane or a raised part on one, and the pitch of the glass's specks in
// the slab's own units.
// veil: how much lighter the body of the glass is than what stands behind it.
export function createLiquidSlab({backdrop, camera, unit, frost, deepest, texel, split, mapped, smoke = null, veil = 0, frame = null}) {
  const shader = material(backdrop, mapped, smoke ? (smoke.pane ? 'pane' : 'part') : null, Boolean(smoke && frame)), plane = new THREE.PlaneGeometry(1, 1);
  if (smoke && frame) Object.assign(shader.uniforms, {uLocalToRest: {value: frame.localToRest}, uRestSize: {value: frame.size}});
  const mesh = new THREE.Mesh(plane, shader);
  mesh.name = 'liquid-slab';
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  const toLocal = new THREE.Matrix4();
  shader.uniforms.uPixel.value = unit;
  shader.uniforms.uFrost.value = frost;
  shader.uniforms.uSplit.value = split;
  // The veil belongs to scene light; glass over a picture or a video shows it
  // as it is.
  shader.uniforms.uVeil.value = mapped ? veil : 0;
  if (smoke) {
    shader.uniforms.uTint.value.copy(smoke.tint);
    shader.uniforms.uKeep.value = smoke.keep;
    shader.uniforms.uDark.value = 1;
    shader.uniforms.uSmokeGrainPitch.value = smoke.grain;
  }
  shader.uniforms.uTexel.value.copy(texel);
  return {
    mesh,
    // width, height and corner radius of the outline, in world units. deep:
    // half the thickness of a lens, which is as thick as it is told and not
    // by the rule of a panel; bevel: the rounding of its edge, around flat
    // faces; behind: how far behind its middle the picture it looks at stands.
    update(width, height, radius, {deep = null, bevel = null, behind = null} = {}) {
      const u = shader.uniforms, thick = deep ?? Math.min(.13 * Math.min(width, height), deepest);
      u.uBulge.value = deep === null ? 0 : 1;

      u.uHalf.value.set(width / 2, height / 2);
      u.uRadius.value = Math.min(radius, width / 2, height / 2);
      u.uEdge.value = Math.min(bevel ?? thick, thick, u.uRadius.value);
      u.uThick.value = thick;
      u.uPanelDimensions.value.set(width, height, u.uRadius.value, 2 * thick);
      u.uGap.value = behind ?? 3.5 * thick;
      const room = 4 * unit + (deep === null ? 0 : 2.5 * thick);
      u.uPlane.value.set(width + room, height + room);
      mesh.updateWorldMatrix(true, false);
      toLocal.copy(mesh.matrixWorld).invert();
      u.uCamera.value.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(toLocal);
      u.uToClip.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(mesh.matrixWorld);
    },
    // A ring of swell around (x, y), in world units from the slab's middle:
    // its outer radius, its width and how much thicker the slab is in it.
    // lift 0 leaves the slab flat.
    ripple(x, y, radius, width, lift) {
      shader.uniforms.uWave.value.set(x, y, radius, Math.max(width, 1e-6));
      shader.uniforms.uLift.value = lift;
    },
    // How milky the glass is, 0 to 1: a control that rests clouds over a little.
    veil(amount) { shader.uniforms.uVeil.value = amount; },
    // The lettering as a texture over the rest size of the slab, in the plane
    // z of the slab where the page shows its own text, or null.
    ink(texture, width, height, z = 0) {
      shader.uniforms.uInk.value = texture;
      shader.uniforms.uInked.value = texture ? 1 : 0;
      if (texture) { shader.uniforms.uInkHalf.value.set(width / 2, height / 2); shader.uniforms.uInkZ.value = z; }
    },
    dispose() { mesh.removeFromParent(); plane.dispose(); shader.dispose(); },
  };
}

// What a slab of glass leaves on the scene behind it: a soft shadow, a little
// below it, and a faint pool of the light that has gone through it, along its
// lower edge.
const shade = () => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, toneMapped: false, premultipliedAlpha: true,
  blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  uniforms: {
    uPlane: {value: new THREE.Vector2(1, 1)}, uHalf: {value: new THREE.Vector2(1, 1)},
    uRadius: {value: .1}, uSoft: {value: .1}, uDrop: {value: .05}, uShadow: {value: .2}, uGlow: {value: .05},
  },
  vertexShader: `uniform vec2 uPlane;varying vec2 vLocal;
    void main(){vLocal=position.xy*uPlane;gl_Position=projectionMatrix*modelViewMatrix*vec4(vLocal,0.,1.);}`,
  fragmentShader: `precision highp float;
    uniform vec2 uHalf;uniform float uRadius,uSoft,uDrop,uShadow,uGlow;varying vec2 vLocal;
    float outline(vec2 p){vec2 q=abs(p)-uHalf+uRadius;return length(max(q,0.))+min(max(q.x,q.y),0.)-uRadius;}
    void main(){
      float shadow=uShadow*(1.-smoothstep(-uSoft,uSoft,outline(vLocal+vec2(0.,uDrop))));
      float below=-(vLocal.y+uHalf.y);
      float along=1.-smoothstep(uHalf.x*.6,uHalf.x,abs(vLocal.x));
      float pool=uGlow*along*smoothstep(-uSoft*.15,uSoft*.1,below)*exp(-max(below,0.)/(uSoft*.8));
      // Plain light: a pool that took its colour from the backdrop would
      // change with the picture and read as the backdrop moving.
      vec3 tint=vec3(1.);
      // Screen values as they are: this layer only dims and lightens what
      // is drawn already.
      gl_FragColor=vec4(tint*pool,shadow);
    }`,
});

/** The shadow and the pool of light of one slab; update() follows its size. */
export function createLiquidShade() {
  const shader = shade(), plane = new THREE.PlaneGeometry(1, 1);
  const mesh = new THREE.Mesh(plane, shader);
  mesh.name = 'liquid-shade';
  mesh.frustumCulled = false;
  mesh.renderOrder = -2;
  return {
    mesh,
    // width, height and corner radius of the slab's outline, in world units.
    update(width, height, radius) {
      const u = shader.uniforms, short = Math.min(width, height), soft = Math.min(.45 * short, .14);
      u.uHalf.value.set(width / 2, height / 2);
      u.uRadius.value = Math.min(radius, width / 2, height / 2);
      u.uSoft.value = soft;
      u.uDrop.value = .45 * soft;
      u.uPlane.value.set(width + 5 * soft, height + 5 * soft);
    },
    dispose() { mesh.removeFromParent(); plane.dispose(); shader.dispose(); },
  };
}
