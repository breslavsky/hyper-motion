import * as THREE from '../vendor/three/build/three.module.min.js';
import {Font} from '../vendor/three/examples/jsm/loaders/FontLoader.js';
import {UnrealBloomPass} from '../vendor/three/examples/jsm/postprocessing/UnrealBloomPass.js';
import wide from '../assets/type/anybody-w150-800.mjs';
import compact from '../assets/type/anybody-w130-800.mjs';
import {normalize, clamp, sample, cameraAt, wordAt, makeField, shardAt, transitionAt} from './model.mjs';
import {makeEnvironment, chrome, flareTexture} from './materials.mjs';
import {buildWord, updateClipping} from './geometry.mjs';

const active = new WeakSet();
const vertex = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
function quad(material) {
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  return {material, render: renderer => renderer.render(mesh, camera), dispose() {mesh.geometry.dispose(); material.dispose();}};
}

export async function createSpatialType(canvas, input, {fonts = {wide, compact}} = {}) {
  if (!canvas || active.has(canvas)) throw new Error('A fresh canvas is required; dispose its existing spatial world first');
  const config = normalize(input);
  const fontMap = Object.fromEntries(Object.entries(fonts).map(([key, data]) => [key, data.isFont ? data : new Font(structuredClone(data))]));
  for (const spec of [...config.words, ...config.fields.filter(f => f.alphabet).map(f => ({font: f.font ?? 'wide', text: f.alphabet}))]) {
    const font = fontMap[spec.font];
    if (!font?.data?.glyphs?.H) throw new Error(`Font geometry ${spec.font} needs a cap-height H glyph`);
    for (const ch of spec.text) if (!font.data.glyphs[ch]) throw new Error(`Font ${font.data.familyName} lacks ${JSON.stringify(ch)}; supply another local font geometry`);
  }
  active.add(canvas);
  let renderer;
  try {renderer = new THREE.WebGLRenderer({canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'});}
  catch (error) {active.delete(canvas); throw error;}
  renderer.setPixelRatio(config.pixelRatio); renderer.setSize(config.width, config.height, false);
  renderer.toneMapping = THREE.NoToneMapping; renderer.localClippingEnabled = true;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, config.width / config.height, config.camera.near, config.camera.far);
  const environment = makeEnvironment(renderer, config.environment);
  scene.environment = environment.texture;
  scene.fog = new THREE.FogExp2(config.look.background, config.look.fog);
  const words = config.words.map(spec => {
    if (!fontMap[spec.font]) throw new Error(`Unknown font geometry ${spec.font}`);
    const word = buildWord(fontMap[spec.font], spec, config.materials);
    scene.add(word.group); return {spec, ...word};
  });
  const fields = config.fields.map(spec => {
    const data = makeField(spec), material = chrome({color: '#9aa1ab', roughness: 0.2, flat: true, env: 0.9, ...spec.material});
    const groups = [];
    if (spec.alphabet) {
      const glyphs = [...new Set([...spec.alphabet].filter(ch => ch.trim()))];
      if (!glyphs.length) throw new Error('field.alphabet needs drawable characters');
      for (const [index, ch] of glyphs.entries()) {
        const word = buildWord(fontMap[spec.font ?? 'wide'], {text: ch,
          geometry: {depth: 0.45, bevel: 0.04, curveSegments: 6, bevelSegments: 3, tracking: 0}}, config.materials);
        const list = data.filter((_, i) => i % glyphs.length === index);
        if (list.length) groups.push({mesh: new THREE.InstancedMesh(word.letters[0].geometry, [word.face, word.side], list.length), data: list});
        else {word.letters[0].geometry.dispose(); word.face.dispose(); word.side.dispose();}
      }
      material.dispose();
    } else for (let kind = 0; kind < 2; kind++) {
      const list = data.filter((_, i) => i % 2 === kind);
      if (list.length) groups.push({mesh: new THREE.InstancedMesh(kind ? new THREE.OctahedronGeometry(1) : new THREE.TetrahedronGeometry(1), material, list.length), data: list});
    }
    for (const item of groups) {item.mesh.frustumCulled = false; scene.add(item.mesh);}
    return {spec, groups};
  });
  const flare = flareTexture();
  const glints = config.glints.map(spec => {
    const mesh = new THREE.Sprite(new THREE.SpriteMaterial({map: flare, color: spec.color ?? '#ffffff', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true}));
    mesh.position.set(...spec.position); scene.add(mesh); return {spec, mesh, color: new THREE.Color(spec.color ?? '#ffffff')};
  });
  const lights = config.lights.map(spec => {
    const light = new THREE.PointLight(spec.color ?? '#ffffff', 0, spec.distance ?? 12, spec.decay ?? 1.5);
    light.position.set(...spec.position); scene.add(light); return {spec, light};
  });
  const beams = (config.beams ?? []).map(spec => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({color: spec.color ?? '#b8ff2a'}));
    mesh.position.set(...spec.position); mesh.scale.set(spec.length ?? 60, spec.width ?? 0.011, spec.width ?? 0.011);
    scene.add(mesh); return {spec, mesh, color: new THREE.Color(spec.color ?? '#b8ff2a')};
  });
  const rays = (config.rays ?? []).map(spec => {
    const material = new THREE.ShaderMaterial({uniforms: {uI: {value: 0}, uT: {value: 0}, uColor: {value: new THREE.Color(spec.color ?? '#fffdfa')}},
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `varying vec2 vUv;uniform float uI,uT;uniform vec3 uColor;
        float h(float n){return fract(sin(n*91.345)*47453.123);}
        void main(){vec2 p=vUv-.5;p.x*=1.6;float r=length(p);float a=atan(p.y,p.x)+uT*.05;
          float b=floor((a/6.2831853+.5)*46.);float f=fract((a/6.2831853+.5)*46.);
          float ray=step(.55,h(b))*h(b*1.7)*smoothstep(.15,.5,f)*(1.-smoothstep(.5,.85,f));ray=pow(ray,1.5)*.6;
          float fall=exp(-r*8.5);float core=exp(-r*14.)*2.4;float streak=exp(-abs(p.y)*60.)*exp(-abs(p.x)*2.5)*.9;
          gl_FragColor=vec4(uColor*uI*(ray*fall*2.2+core+streak),1.);}`,
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true});
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(...(spec.size ?? [26, 16])), material);
    mesh.position.set(...spec.position); scene.add(mesh); return {spec, mesh};
  });
  let width = config.width, height = config.height, time = 0, disposed = false, lastCamera;
  const rw = Math.round(width * config.pixelRatio), rh = Math.round(height * config.pixelRatio);
  const frameTarget = new THREE.WebGLRenderTarget(rw, rh, {type: THREE.HalfFloatType, samples: 4});
  const accumulated = new THREE.WebGLRenderTarget(rw, rh, {type: THREE.HalfFloatType});
  const accumulation = quad(new THREE.ShaderMaterial({uniforms: {tex: {value: null}, weight: {value: 1}}, vertexShader: vertex,
    fragmentShader: 'uniform sampler2D tex;uniform float weight;varying vec2 vUv;void main(){vec3 c=clamp(texture2D(tex,vUv).rgb,0.,64.);gl_FragColor=vec4(c*weight,1.);}',
    blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true}));
  const bloom = new UnrealBloomPass(new THREE.Vector2(rw, rh), 0.22, 0.35, 1.4);
  const grade = quad(new THREE.ShaderMaterial({vertexShader: vertex, depthTest: false, depthWrite: false,
    uniforms: {tex: {value: null}, resolution: {value: new THREE.Vector2(rw, rh)}, seed: {value: 0}, exposure: {value: 1}, grain: {value: config.post.grain},
      aberration: {value: config.post.aberration}, flash: {value: 0}, wash: {value: 0}, band: {value: 1}, line: {value: 0}, reveal: {value: 0},
      lineColor: {value: new THREE.Color(config.transition?.color ?? '#d4ff3a')}},
    fragmentShader: `varying vec2 vUv;uniform sampler2D tex;uniform vec2 resolution;uniform vec3 lineColor;
      uniform float seed,exposure,grain,aberration,flash,wash,band,line,reveal;
      vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
      vec3 srgb(vec3 c){return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(.0031308,c));}
      float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
      void main(){vec2 d=vUv-.5;float aspect=resolution.x/resolution.y;float r=length(d*vec2(aspect,1.))/(aspect*.5);vec2 off=d*aberration*r;
        vec3 c=vec3(texture2D(tex,vUv+off).r,texture2D(tex,vUv).g,texture2D(tex,vUv-off).b);
        c=max(c,vec3(0.));c+=wash*vec3(1.,.99,.97)*(1.-.75*smoothstep(0.,1.15,r));c=srgb(aces(c*exposure));
        c*=1.-.5*smoothstep(.42,1.12,r);
        float mask=1.-smoothstep(band*.5,band*.5+.002,abs(d.y));
        c=mix(c,vec3(mask),flash);
        float strip=exp(-abs(abs(d.y)-reveal*.46)*resolution.y*.13);
        c+=lineColor*line*strip;c+=(hash(vUv*resolution+seed)-.5)*grain;
        gl_FragColor=vec4(c,1.);}` }));
  const object = new THREE.Object3D();

  function setState(at) {
    lastCamera = cameraAt(config, at);
    camera.position.set(...lastCamera.position); camera.up.set(0, 1, 0); camera.lookAt(...lastCamera.target);
    camera.rotateZ(lastCamera.roll); camera.fov = lastCamera.fov; camera.updateProjectionMatrix();
    for (const word of words) {
      const state = wordAt(word.spec, at, word.letters.length), g = word.group;
      g.visible = state.visible; g.position.set(...state.position); g.rotation.set(...state.rotation); g.scale.set(...state.scale);
      if (word.spec.width != null) g.scale.x *= word.spec.width / word.width;
      word.letters.forEach((letter, i) => {
        const offset = word.spec.assembly?.offset ?? [0, 0, 0], gain = state.assembly[i];
        letter.holder.position.set(letter.x + offset[0] * gain, offset[1] * gain, offset[2] * gain);
      });
      for (const piece of word.pieces) {
        piece.pivot.position.set(...piece.offset.map(v => v * state.fracture)); piece.pivot.rotation.set(0, 0, piece.rotation * state.fracture);
        piece.face.emissive.setRGB(1, 1, 1); piece.face.emissiveIntensity = state.emissive;
        piece.side.emissive.setRGB(1, 1, 1); piece.side.emissiveIntensity = state.emissive * 0.7;
      }
      word.face.emissive.setRGB(1, 1, 1); word.face.emissiveIntensity = state.emissive;
      word.side.emissive.setRGB(1, 1, 1); word.side.emissiveIntensity = state.emissive * 0.7;
    }
    for (const field of fields) for (const group of field.groups) {
      group.data.forEach((datum, index) => {
        const state = shardAt(datum, field.spec, at);
        object.position.set(...state.position); object.rotation.set(...state.rotation); object.scale.set(...state.scale); object.updateMatrix();
        group.mesh.setMatrixAt(index, object.matrix);
      });
      group.mesh.instanceMatrix.needsUpdate = true;
    }
    for (const g of glints) {
      const gain = Math.exp(-(((at - g.spec.peak) / g.spec.width) ** 2));
      g.mesh.visible = gain > 0.01;
      g.mesh.material.color.copy(g.color).multiplyScalar((g.spec.intensity ?? 3) * gain);
      const size = (g.spec.size ?? 1) * (0.5 + 0.5 * gain); g.mesh.scale.set(size * 0.8, size * 0.4, 1);
    }
    for (const {spec, light} of lights) light.intensity = sample(spec.intensity, at, 0);
    for (const {spec, mesh, color} of beams) {
      const intensity = sample(spec.intensity, at, 0); mesh.visible = intensity > 0;
      mesh.material.color.copy(color).multiplyScalar(intensity);
      mesh.position.set(...sample(spec.animate?.position, at, spec.position));
      mesh.rotation.set(...sample(spec.animate?.rotation, at, spec.rotation ?? [0, 0, 0]));
    }
    for (const {spec, mesh} of rays) {
      const intensity = sample(spec.intensity, at, 0); mesh.visible = intensity > 0;
      mesh.material.uniforms.uI.value = intensity; mesh.material.uniforms.uT.value = at;
    }
    scene.environmentRotation.set(0, config.look.envRotation * at, 0);
    camera.updateMatrixWorld(true); scene.updateMatrixWorld(true);
    for (const word of words) updateClipping(word);
  }
  function seek(at) {
    if (disposed) throw new Error('spatial world is disposed');
    if (!Number.isFinite(at)) throw new Error('seek time must be finite');
    time = clamp(at, 0, config.duration);
    renderer.setClearColor(0, 0); renderer.setRenderTarget(accumulated); renderer.clear(true, true, true);
    const count = config.motionBlur.samples;
    for (let i = 0; i < count; i++) {
      const offset = count === 1 ? 0 : config.motionBlur.shutter / config.fps * i / (count - 1);
      setState(Math.max(0, time - offset));
      renderer.setClearColor(config.look.background, 1); renderer.setRenderTarget(frameTarget); renderer.clear(true, true, true); renderer.render(scene, camera);
      renderer.setRenderTarget(accumulated); accumulation.material.uniforms.tex.value = frameTarget.texture;
      accumulation.material.uniforms.weight.value = 1 / count; renderer.autoClear = false; accumulation.render(renderer); renderer.autoClear = true;
    }
    setState(time); // Inspect state is exact requested time, not the final shutter sample.
    bloom.strength = sample(config.post.bloom, time, 0.22); bloom.radius = sample(config.post.radius, time, 0.35); bloom.threshold = sample(config.post.threshold, time, 1.4);
    bloom.render(renderer, null, accumulated, 0, false);
    const u = grade.material.uniforms, transition = transitionAt(config.transition, time);
    u.tex.value = accumulated.texture; u.seed.value = Math.floor(time * config.fps) * 17.13 % 1000;
    u.exposure.value = sample(config.post.exposure, time, config.look.exposure);
    u.flash.value = Math.max(transition.opacity, sample(config.post.flash, time, 0)); u.band.value = transition.height;
    u.line.value = transition.line; u.reveal.value = transition.reveal; u.wash.value = sample(config.post.wash, time, 0);
    renderer.setRenderTarget(null); grade.render(renderer);
    return inspect();
  }
  function inspect() {
    return {time, duration: config.duration, seed: config.seed, width, height, disposed,
      camera: structuredClone(lastCamera), words: words.map(word => ({id: word.spec.id, text: word.spec.text,
        visible: word.group.visible, position: word.group.position.toArray(), scale: word.group.scale.toArray(),
        letterCount: word.letters.length, pieceCount: word.pieces.length, vertexCount: word.letters.reduce((n, l) => n + l.geometry.attributes.position.count, 0),
        glyphs: word.letters.map(l => ({character: l.ch, localX: l.x, width: l.width, center: l.holder.getWorldPosition(new THREE.Vector3()).toArray()})),
        materials: {face: {type: word.face.type, color: word.face.color.getHexString(), metalness: word.face.metalness, roughness: word.face.roughness},
          side: {type: word.side.type, color: word.side.color.getHexString(), metalness: word.side.metalness, roughness: word.side.roughness}}})),
      shardCount: config.fields.reduce((sum, f) => sum + f.count, 0), sceneId: scene.uuid};
  }
  function resize(w, h) {
    if (disposed || !Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) throw new Error('resize needs positive finite dimensions on a live world');
    width = w; height = h; renderer.setSize(w, h, false); camera.aspect = w / h;
    const x = Math.round(w * config.pixelRatio), y = Math.round(h * config.pixelRatio);
    frameTarget.setSize(x, y); accumulated.setSize(x, y); bloom.setSize(x, y); grade.material.uniforms.resolution.value.set(x, y); seek(time);
  }
  function dispose() {
    if (disposed) return;
    disposed = true; const geometries = new Set(), materials = new Set();
    scene.traverse(node => {if (node.geometry) geometries.add(node.geometry); for (const m of Array.isArray(node.material) ? node.material : node.material ? [node.material] : []) materials.add(m);});
    for (const w of words) {materials.add(w.face); materials.add(w.side);}
    for (const g of geometries) g.dispose(); for (const m of materials) m.dispose();
    flare.dispose(); environment.dispose(); frameTarget.dispose(); accumulated.dispose(); accumulation.dispose(); grade.dispose(); bloom.dispose(); renderer.dispose();
    active.delete(canvas);
  }
  try {
    setState(config.duration / 2);
    if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
    seek(0);
  } catch (error) {dispose(); throw error;}
  return {seek, resize, dispose, inspect, config};
}
