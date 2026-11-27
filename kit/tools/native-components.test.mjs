import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {catalog,createComponentLibrary} from '../source/lib/components/index.mjs';
import {resolveContent} from '../source/lib/components/timing.mjs';
import browserDefinitions from '../source/lib/components/metadata.mjs';
import * as maths from '../source/lib/components/maths.mjs';
import {createDom} from '../source/lib/components/dom.mjs';
import {createDesignSystem} from '../source/lib/components/design-system.mjs';
const require=createRequire(import.meta.url);
const nodeDefinitions=require('../source/lib/components/metadata.cjs');
const SOURCE=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../source/lib/components');
const serialize=value=>JSON.stringify(value,(_,v)=>typeof v==='function'?v.toString():v);

test('Node compiler and browser share every field and action/sound schedule',()=>{
  assert.equal(serialize(nodeDefinitions),serialize(browserDefinitions));
  const cjs=fs.readFileSync(path.join(SOURCE,'metadata.cjs'),'utf8');
  assert.equal(fs.readFileSync(path.join(SOURCE,'metadata.mjs'),'utf8'),cjs.replace('module.exports = definitions;','export {definitions};\nexport default definitions;')
    .replace("const {onBeat, nearBeat, lastBeat} = require('./beat-grid.cjs');","import {onBeat, nearBeat, lastBeat} from './beat-grid.mjs';"));
  for(const name of Object.keys(nodeDefinitions))for(const duration of [1,3,8]){
    const a=nodeDefinitions[name],b=browserDefinitions[name],eventsA=[],eventsB=[];
    a.sounds?.(a.sample,duration,(...cue)=>eventsA.push(cue),.5);
    b.sounds?.(b.sample,duration,(...cue)=>eventsB.push(cue),.5);
    assert.deepEqual(eventsA,eventsB,`${name}/${duration}`);
    assert.equal(Object.hasOwn(a,'build'),false);
  }
});

test('every compiler type resolves independently and unknown types fail',async()=>{
  const expected=[...Object.keys(require('../source/lib/compiler/fields.cjs')),...Object.keys(nodeDefinitions)].sort();
  assert.deepEqual(Object.keys(catalog).sort(),expected);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(SOURCE,'catalog.json'),'utf8')),catalog);
  const context={W:1920,H:1080,S:1,plan:{look:{}},helpers:{maths,dom:{},moves:{},ui:{}}};
  const library=createComponentLibrary(context);
  assert.equal(library.types.length,expected.length);
  for(const [type,entry] of Object.entries(catalog)){
    assert.equal(library.has(type),true);
    if(!['three','kinetic3d'].includes(entry.family))assert.equal(typeof await library.get(type),'function',type);
  }
  await assert.rejects(library.get('not-a-scene'),/Unknown component/);
  assert.equal(library.has('toString'),false);
});

test('DOM styles preserve explicit design roles without a second nearest-size scale',()=>{
  const document={defaultView:{getComputedStyle(){},NodeFilter:{}}};
  const a=createDom({document}),b=createDom({document});
  const node=()=>({style:{setProperty(key,value){this[key]=value;}},dataset:{}});
  const one=node(),two=node();
  createDesignSystem({S:1}).apply(one,'button');createDesignSystem({S:.5}).apply(two,'button');
  a.set(one,{transform:'translateX(10px)'});b.set(two,{transform:'scale(.9)'});
  assert.equal(one.style.fontSize,'42px');assert.equal(two.style.fontSize,'21px');
  assert.equal(one.style.lineHeight,'60px');assert.equal(two.style.lineHeight,'30px');
  assert.equal('useScale' in a,false);assert.equal('fit' in a,false);
});

test('dial puts its default gesture on the beats and stretches explicit arrival to musical beats',()=>{
  const definition=nodeDefinitions.dial;
  for(const bpm of [100,120,150,170])for(const beats of [3,4,8]){
    // By itself the knob is taken on the first beat and looks arrived (0.7 of its time, the chime) on a half beat.
    const beat=60/bpm*1.25,len=beats*beat,scene={...definition.sample},times=definition.times(scene,len,beat);
    assert.equal(times.bubble,beat/2);assert.equal(times.from,beat);
    assert.ok(Math.abs(times.settle/(beat/2)-Math.round(times.settle/(beat/2)))<1e-9,'the chime stands on a half beat');
    assert.ok(Math.abs(times.from+(times.to-times.from)*.7-times.settle)<1e-9&&times.to<len);
    const sounds=[];definition.sounds(scene,len,(...cue)=>sounds.push(cue),beat);
    assert.deepEqual(sounds[0],[times.bubble,'pop',.7]);
    assert.deepEqual(sounds.at(-1),[times.settle,'chime',.9]);
  }
  assert.throws(()=>definition.times({...definition.sample},3),/beat/);
  for(const bpm of [72,120,180])for(const speed of [1,1.25,1.6])for(const value of [1,37,100])for(const label of ['A','Longer control label']){
    const beat=60/bpm,logicalBeat=beat*speed;
    const scene={...definition.sample,label,value,timing:{slide:{startBeat:.5,endBeat:2.75}}};
    const len=4*logicalBeat,times=definition.times(scene,len,logicalBeat),sounds=[];
    definition.sounds(scene,len,(...cue)=>sounds.push(cue),logicalBeat);
    assert.ok(Math.abs(times.from/speed-.5*beat)<1e-12);
    assert.ok(Math.abs(times.to/speed-2.75*beat)<1e-12);
    const [arrival,kind]=sounds.at(-1);
    assert.equal(kind,'chime');
    assert.ok(Math.abs(arrival/speed-2.75*beat)<1e-12);
    for(const [at,kind] of sounds)if(kind==='tick')assert.ok(at>times.from&&at<times.to);
    assert.deepEqual(browserDefinitions.dial.times(scene,len,logicalBeat),times);
  }
  assert.throws(()=>definition.times({...definition.sample,timing:{slide:{startBeat:2,endBeat:1}}},4,.5),/timing.slide/);
});
