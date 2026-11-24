import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import {catalog} from '../source/lib/components/index.mjs';
import {resolveContent,timedGlassFactories} from '../source/lib/components/timing.mjs';
import {createGlassGeometry} from '../source/lib/components/glass/geometry.mjs';
import {createSurfaceMaterial,resolveSurfaceMetalPreset} from '../source/lib/components/glass/materials.mjs';
import * as THREE from '../source/lib/vendor/three/three.module.min.js';

const require=createRequire(import.meta.url);
const F=require('../source/lib/film.cjs');
const definitions=require('../source/lib/components/metadata.cjs');
const film=(scene,aspect='16:9')=>({aspect,style:'glass',grain:false,sparks:false,brand:{name:'Glass'},scenes:[scene]});
const legacy={
  ask:{type:'ask',text:'Fill my Tuesday class',beats:6},
  island:{type:'island',title:'Everything together',body:'One clear message.',icon:'✦',beats:4},
  lens:{type:'lens',text:'A clearer view.',sub:'Look a little closer.',beats:4},
  controls:{type:'controls',title:'Autopilot',toggles:['Reminders','Waitlist','Payments'],slider:'Capacity',beats:4},
};

test('existing glass recipes remain valid without the new camera controls',()=>{
  for(const aspect of ['16:9','9:16','1:1'])for(const scene of Object.values(legacy)){
    assert.deepEqual(F.problems(film(scene,aspect)),[],`${scene.type}/${aspect}`);
    assert.equal(F.planOf(film(scene,aspect)).scenes[0].scene.type,scene.type);
  }
});

test('every Glass scene accepts one background asset in its recipe and native content',()=>{
  const types=Object.keys(catalog).filter(type=>catalog[type].family==='glass');
  for(const type of types){
    const original=definitions[type].sample;
    const baseline=F.planOf(film(original)),copy=F.review(film(original),baseline).scenes[0].words;
    for(const background of [{image:'assets/Мой экран %231.webp'},{video:'media/upload/original.mp4'}]){
      const {scene}=resolveContent(original,{background});
      const recipe=film(scene),plan=F.planOf(recipe);
      assert.deepEqual(plan.scenes[0].scene.background,background,type);
      assert.deepEqual(definitions[type].validateMedia(scene),[]);
      const reviewed=F.review(recipe,plan).scenes[0];
      assert.deepEqual(reviewed.words,copy);
      assert.deepEqual(reviewed.backgroundMedia,background);
      assert.equal(F.soundMark(recipe,plan),F.soundMark(film(original),baseline));
      const kind=Object.keys(background)[0];
      assert.deepEqual((kind==='image'?F.pictures:F.videos)(recipe),[[`scenes[0].background.${kind}`,background[kind]]]);
    }
    for(const background of [null,[],{},'photo.png',{image:'a.jpg',video:'b.mp4'},
      {image:''},{video:42},{src:'clip.mp4'},{image:'a.png',offset:2},
      {video:'https://example.com/a.mp4'},{image:'derived/%2e%2e/file.png'},
      {video:'?file=outside.mp4'}]){
      const scene={...original,background};
      assert.ok(F.problems(film(scene)).some(error=>error.includes('background')),type);
      assert.ok(definitions[type].validateMedia(scene).length,type);
    }
  }
  assert.ok(F.problems(film({type:'title',text:'One',beats:3,background:{image:'a.png'}}))
    .some(error=>error.includes('has no field "background"')));
});

test('glass cameras and capsule exits have bounded recipe controls',()=>{
  assert.deepEqual(definitions.island.fields.camera.values,['static','orbit']);
  assert.deepEqual(definitions.lens.fields.camera.values,['static','orbit']);
  assert.deepEqual(definitions.controls.fields.camera.values,['static','orbit']);
  assert.deepEqual(definitions.ask.fields.camera.values,['static','orbit']);
  assert.deepEqual(definitions.island.fields.exit.values,['hold','collapse']);
  for(const camera of ['static','orbit']){
    for(const exit of ['hold','collapse'])assert.deepEqual(F.problems(film({...legacy.island,camera,exit})),[]);
    assert.deepEqual(F.problems(film({...legacy.lens,camera})),[]);
    assert.deepEqual(F.problems(film({...legacy.controls,camera})),[]);
    assert.deepEqual(F.problems(film({...legacy.ask,camera})),[]);
  }
  for(const scene of [{...legacy.island,camera:'free'},{...legacy.island,exit:'explode'},
    {...legacy.lens,camera:'free'},{...legacy.lens,camera:0},{...legacy.island,exit:null},
    {...legacy.controls,camera:'free'},{...legacy.controls,camera:null},{...legacy.controls,camera:0},
    {...legacy.ask,camera:'free'},{...legacy.ask,camera:null}]){
    assert.ok(F.problems(film(scene)).length,JSON.stringify(scene));
  }
});

test('ask preserves the code-point keyboard, send and optional reply sound cues',()=>{
  const scene={...legacy.ask,text:'Book 🚀 now'},characters=[...scene.text].length,duration=3.25;
  const typed=Math.min(duration*.5,.5+characters/27);
  const times={type:.5,typed,send:typed+.2,reply:typed+.45};
  for(const reply of [undefined,'Booked.']){
    const ask={...scene,...(reply?{reply}:{})},cues=[];
    assert.deepEqual(definitions.ask.times(ask,duration),times);
    definitions.ask.sounds(ask,duration,(...cue)=>cues.push(cue));
    const expected=[[.2,'click',.8],[.32,'pop',.9]];
    for(let index=0;index<characters;index+=2)expected.push([.5+((typed-.5)*index)/characters,'type',.8]);
    expected.push([times.send,'click',.9]);
    if(reply)expected.push([times.reply+.1,'chime',.8]);
    assert.deepEqual(cues,expected);
  }
});

test('controls preserve optional copy, switch bounds and click timing across the optical port',()=>{
  for(const aspect of ['16:9','9:16','1:1'])for(const toggles of [['One','Two'],['One','Two','Three','Four']]){
    const scene={type:'controls',toggles,beats:4};
    assert.deepEqual(F.problems(film(scene,aspect)),[]);
    const plan=F.planOf(film(scene,aspect));
    assert.deepEqual(plan.scenes[0].scene.toggles,toggles);
    assert.deepEqual(F.review(film(scene,aspect),plan).scenes[0].words,toggles);
    for(const duration of [1.25,2.25,6]){
      const times=definitions.controls.times(scene,duration),cues=[];
      definitions.controls.sounds(scene,duration,(...cue)=>cues.push(cue));
      assert.equal(times.length,toggles.length);
      assert.equal(times[0],.5,'Keep the first switch on its existing sound cue');
      assert.ok(Math.abs(times.at(-1)-Math.max(.6,duration*.62))<1e-9);
      assert.ok(times.every((time,i)=>i===0||time>times[i-1]));
      assert.deepEqual(cues.map(([time,sound])=>[time,sound]),times.map(time=>[time,'click']));
      const withSlider=[];
      definitions.controls.sounds({...scene,slider:'Capacity'},duration,(...cue)=>withSlider.push(cue));
      assert.deepEqual(withSlider.slice(0,toggles.length),cues);
      assert.deepEqual(withSlider.at(-1).slice(0,2),[Math.max(.7,duration*.66),'sparkle']);
    }
  }
  for(const toggles of [[],['One'],['One','Two','Three','Four','Five']]){
    assert.ok(F.problems(film({...legacy.controls,toggles})).length,JSON.stringify(toggles));
  }
});

test('the continuous glass composition preserves both supplied messages',()=>{
  const scene={...definitions['glass-flow'].sample,title:'Первое сообщение',body:'Стекло раскрывается.',nextTitle:'Второе сообщение',nextBody:'Камера проходит дальше.'};
  for(const aspect of ['16:9','9:16','1:1']){
    const recipe=film(scene,aspect);
    assert.deepEqual(F.problems(recipe),[],aspect);
    const plan=F.planOf(recipe),review=F.review(recipe,plan);
    assert.equal(plan.scenes.length,1,'One persistent native composition');
    assert.equal(plan.scenes[0].scene.nextTitle,scene.nextTitle);
    for(const copy of [scene.title,scene.body,scene.nextTitle,scene.nextBody])assert.ok(review.scenes[0].words.includes(copy),copy);
  }
  for(const patch of [{title:''},{nextTitle:''},{nextTitle:undefined},{nextTitle:42}]){
    assert.ok(F.problems(film({...scene,...patch})).length,JSON.stringify(patch));
  }
});

test('glass native edits retain fixed-slot contracts and exclude camera settings from copy',()=>{
  for(const type of ['island','lens','controls','ask']){
    const original={...legacy[type],camera:'static',...(type==='island'?{exit:'hold'}:{})};
    const updated=resolveContent(original,{camera:'orbit',...(type==='island'?{exit:'collapse'}:{})});
    assert.equal(updated.scene.camera,'orbit');
    const recipe=film(updated.scene),words=F.review(recipe,F.planOf(recipe)).scenes[0].words;
    assert.ok(!words.some(word=>['static','orbit','hold','collapse'].includes(word)),JSON.stringify(words));
    assert.throws(()=>resolveContent(original,{beats:original.beats+1}),/slot/);
  }
  const original=definitions['glass-flow'].sample;
  assert.equal(resolveContent(original,{nextTitle:'A new destination'}).scene.nextTitle,'A new destination');
  assert.throws(()=>resolveContent(original,{type:'island'}),/slot/);
});

test('direct Glass factory seeks retime the choreography while the backdrop and slot keep their clocks',()=>{
  const original=definitions.lens.sample;
  const {scene,changed}=resolveContent(original,{timing:{sweep:1,sweepEnd:3}});
  assert.deepEqual(changed,['timing']);
  assert.deepEqual(resolveContent(original,{speed:2}).changed,['speed']);
  const {lens}=timedGlassFactories({lens:()=> (motion,duration,background=motion)=>({motion,duration,background})});
  const p={scene,dur:4,beatLen:1};
  const draw=lens({p});
  for(const [time,canonical] of [[1,.8],[3,3.4],[1,.8]]){
    const sample=draw(time);
    assert.equal(sample.duration,4);
    assert.equal(sample.background,time);
    assert.ok(Math.abs(sample.motion-canonical)<1e-8);
  }
  const invalid={...scene,timing:{sweepEnd:'earlier'}};
  assert.throws(()=>lens({p:{...p,scene:invalid}}),/timing/);
});

test('shared geometry keeps flat caps and bevel groups complete through reverse morphing',()=>{
  const shape=createGlassGeometry(),{geometry}=shape,index=geometry.getIndex(),normals=geometry.getAttribute('normal');
  const coverage=new Uint8Array(index.count);
  for(const group of geometry.groups){
    assert.ok(group.count>0&&group.count%3===0,'Each material group contains whole triangles');
    assert.ok(group.start>=0&&group.start+group.count<=index.count);
    for(let i=group.start;i<group.start+group.count;i++)coverage[i]++;
  }
  assert.ok(coverage.every(count=>count===1),'Every triangle must render once, with no holes or duplicate faces');
  const caps=geometry.groups.find(group=>group.materialIndex===0),bevel=geometry.groups.find(group=>group.materialIndex===1);
  assert.ok(caps&&bevel,'The shared shape must distinguish its flat caps from the bevel');
  for(let i=caps.start;i<caps.start+caps.count;i++){
    const vertex=index.getX(i);
    assert.equal(Math.abs(normals.getX(vertex)),0);assert.equal(Math.abs(normals.getY(vertex)),0);assert.equal(Math.abs(normals.getZ(vertex)),1);
  }
  const groups=structuredClone(geometry.groups);
  shape.update(4,1.8,.22,.38,.08);
  const expanded=Array.from(geometry.getAttribute('position').array);
  shape.update(.8,.25,.125,.18,.045);
  assert.notDeepEqual(Array.from(geometry.getAttribute('position').array),expanded);
  shape.update(4,1.8,.22,.38,.08);
  assert.deepEqual(Array.from(geometry.getAttribute('position').array),expanded,'Reverse seeking must restore identical geometry');
  assert.equal(geometry.getIndex(),index,'Morphing retains the fixed topology');
  assert.deepEqual(geometry.groups,groups,'Morphing must not reassign the caps or bevel');
  shape.dispose();
});

test('Dark Glass tints the panel and lens and leaves the insets lighter',()=>{
  const finish=(shape,fg='#ffffff')=>createSurfaceMaterial({theme:{type:'dark-glass'},fg,...shape});
  const panel=finish({}),lens=finish({lens:true}),inset=finish({insetControl:true}),lightGround=finish({},'#181830');
  try {
    for(const surface of [panel,lens,inset,lightGround]){
      const {material}=surface;
      assert.equal(surface.kind,'dark-glass');
      assert.equal(surface.haloMaterial,null);
      assert.equal(surface.shaderPreset,null);
      assert.equal(material.visible,false,'Dark Glass polygons are never drawn');
      assert.ok(surface.tint?.isColor,'The traced slab takes its tint from the finish');
    }
    assert.equal(panel.tint.getHex(),lens.tint.getHex());
    assert.ok(panel.tint.r<lightGround.tint.r);
    assert.ok(lightGround.tint.r<inset.tint.r);
    assert.ok(inset.tint.r<1);
  } finally {
    for(const surface of [panel,lens,inset,lightGround])surface.dispose();
  }
});

test('Metal variants select canonical shader presets while the quiet centre follows text contrast',()=>{
  const luminance=colour=>.2126*colour.r+.7152*colour.g+.0722*colour.b,presets=[];
  for(const variant of ['silver','gold','chromatic']){
    const dark=createSurfaceMaterial({theme:{type:'metal',variant},fg:'#ffffff'});
    const light=createSurfaceMaterial({theme:{type:'metal',variant},fg:'#111111'});
    assert.ok(luminance(light.material.color)>luminance(dark.material.color),`${variant} must give dark text a lighter housing`);
    assert.equal(dark.shaderPreset,variant);assert.equal(light.shaderPreset,variant);
    assert.ok(light.haloMaterial.uniforms.uMetalHaloAlpha.value<dark.haloMaterial.uniforms.uMetalHaloAlpha.value);
    presets.push(dark.shaderPreset);
    dark.dispose();light.dispose();
  }
  assert.equal(new Set(presets).size,3,'Silver, Gold and Chromatic must remain distinct material choices');
  assert.equal(resolveSurfaceMetalPreset(),null);
  assert.equal(resolveSurfaceMetalPreset({type:'glass',variant:'gold'}),null);
  assert.equal(resolveSurfaceMetalPreset({type:'metal'}),'silver');
  assert.equal(resolveSurfaceMetalPreset({type:'metal',variant:'invalid'}),'silver');
  assert.equal(resolveSurfaceMetalPreset({type:'metal',branded:true,variant:'gold'}),'chromatic');
});

test('the shared Metal surface and halo borrow one canonical texture and restore dimensions on reverse seek',()=>{
  const texture=new THREE.Texture();let textureDisposals=0;
  texture.addEventListener('dispose',()=>textureDisposals++);
  const finish=createSurfaceMaterial({theme:{type:'metal',branded:true},metalTexture:texture,scale:2});
  const shader={uniforms:{},vertexShader:THREE.ShaderLib.physical.vertexShader,fragmentShader:THREE.ShaderLib.physical.fragmentShader};
  finish.meshMaterial.onBeforeCompile(shader);
  const uniforms=[shader.uniforms,finish.haloMaterial.uniforms];
  for(const own of uniforms){
    assert.equal(own.uMetalSheet.value,texture,'A card must not manufacture or replace its world-owned shader texture');
    assert.equal(own.uMetalDimensions,uniforms[0].uMetalDimensions,'The whole rim and halo must morph together');
    assert.equal(own.uMetalRingWidth.value*own.uMetalCssPixels.value,1,'The original ring remains one CSS pixel at every video scale');
  }
  assert.match(shader.fragmentShader,/outgoingLight=mix\(uMetalBody,metal\.rgb,metalRing\*metal\.a\)/,'Original pixels bypass PBR relighting');
  assert.match(shader.vertexShader,/vMetalPosition=position/,'The ring follows local geometry, not the screen or camera');
  assert.match(shader.fragmentShader,/fwidth\(metalD\)/,'The thin ring remains antialiased through camera movement');
  finish.setDimensions(4,1.8,.22,.38);
  const expanded=uniforms[0].uMetalDimensions.value.toArray();
  finish.setDimensions(.8,.25,.125,.18);
  finish.setDimensions(4,1.8,.22,.38);
  for(const own of uniforms)assert.deepEqual(own.uMetalDimensions.value.toArray(),expanded);
  assert.equal(finish.haloMaterial.depthWrite,false);
  finish.dispose();finish.dispose();
  assert.equal(textureDisposals,0,'Disposing one card must not release the sheet borrowed by another');
  texture.dispose();assert.equal(textureDisposals,1);
});
