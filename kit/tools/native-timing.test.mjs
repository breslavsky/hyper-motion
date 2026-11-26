import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import {componentTiming,resolveContent} from '../source/lib/components/timing.mjs';
import {typewriterTiming as browserTyping} from '../source/lib/components/typewriter-timing.mjs';
const require=createRequire(import.meta.url),P=require('../source/lib/compiler/plan.cjs');
const {typewriterTiming}=require('../source/lib/components/typewriter-timing.cjs');
const samples=new Map();
for(const template of require('./kinetic/templates.json'))for(const scene of template.scenes)if(!samples.has(scene.type))samples.set(scene.type,scene);
for(const scene of require('./kinetic/samples.json'))if(!samples.has(scene.type))samples.set(scene.type,scene);
for(const [type,definition]of Object.entries(require('../source/lib/compiler/definitions.cjs')))samples.set(type,definition.sample);

test('native semantic timing matches every compiled sample at three speeds and tempos',()=>{
  for(const scene of samples.values())for(const pace of ['chill','normal','hyper'])for(const bpm of [72,120,180]){
    const plan=P.compile({aspect:'9:16',style:'editorial',pace,brand:{name:'Timing'},music:{bpm},scenes:[scene]}),ps=plan.scenes[0];
    assert.deepEqual(componentTiming(scene,ps.ldur,plan.beat*ps.speed),{marks:ps.marks,clickAt:ps.clickAt,...(ps.at?{at:ps.at}:{})},`${scene.type}/${pace}/${bpm}`);
  }
});

test('native changed arrays get fresh marks while fixed slot edits require rebuild',()=>{
  const original={type:'slam',beats:4,lines:['First','Second']};
  const {scene,changed}=resolveContent(original,{lines:['One','Two','Three','Four']});
  assert.deepEqual(changed,['lines']);assert.equal(scene.type,'slam');
  const fresh=componentTiming(scene,2,.5),old=componentTiming(original,2,.5);
  assert.equal(old.marks.length,2);assert.equal(fresh.marks.length,4);
  assert.ok(fresh.marks.every(Number.isFinite));assert.equal(original.lines.length,2);
  for(const edit of [{type:'title'},{beats:8},{in:'glide'},{sound:{mute:true}}])assert.throws(()=>resolveContent(original,edit),/rebuild/);
  assert.throws(()=>resolveContent(original,{look:'noir'}),/style variable/);
  assert.equal(componentTiming({type:'ui-macro',click:false},2,.5).clickAt,undefined);
});

test('typewriter audio follows its visible keys and erasing at every tempo and pace',()=>{
  for(const text of ['Hi','A longer sentence, with spaces.','Привет, мир!'])for(const edit of [{},{then:'Again'},{erase:2,then:'Done'}])for(const pace of ['chill','normal','hyper'])for(const bpm of [72,120,180]){
    const scene={type:'typewriter',beats:4,text,...edit},film={aspect:'9:16',style:'editorial',pace,brand:{name:'Typing'},music:{bpm},scenes:[scene]};
    const plan=P.compile(film),ps=plan.scenes[0],schedule=typewriterTiming(scene,ps.ldur);
    assert.deepEqual(browserTyping(scene,ps.ldur),schedule);
    assert.deepEqual(plan.cues,[{t:0,kind:'tick',strength:.5}],'Keys must not create visual film impulses');
    const audio=plan.audioEvents.filter(cue=>cue.kind==='type');
    assert.equal(audio.length,[...text].length+[...schedule.then].length+(edit.erase??0));
    assert.deepEqual(audio.map(cue=>cue.t),schedule.events.map(event=>event.at/ps.speed));
    assert.ok(audio.every(cue=>cue.t>=0&&cue.t<ps.dur));
    const muted=P.compile({...film,scenes:[{...scene,sound:{mute:true}}]});
    assert.deepEqual(muted.audioEvents,[]);assert.deepEqual(muted.cues,plan.cues);
    const mapped=P.compile({...film,scenes:[{...scene,sound:{mapping:{type:'click'},gain:.4,kit:'tech'}}]});
    assert.equal(mapped.audioEvents.filter(cue=>cue.kind==='click').length,audio.length);
    assert.ok(mapped.audioEvents.every(cue=>cue.kit==='tech'&&cue.gain===.4));
  }
});

test('typewriter erases astral characters as codepoints and shares their sound count',()=>{
  const scene={type:'typewriter',beats:4,text:'Go 🚀',erase:1,then:'✨🎉'};
  const schedule=typewriterTiming(scene,2.5);
  assert.deepEqual(schedule.textUnits,['G','o',' ','🚀']);
  assert.deepEqual(schedule.thenUnits,['✨','🎉']);
  assert.equal(schedule.finalText,'Go ✨🎉');
  assert.equal(schedule.events.length,7);
  assert.equal(schedule.events.filter(event=>event.action==='erase').length,1);
  assert.equal(typewriterTiming({...scene,text:'🚀',erase:4,then:'✓'},2.5).events.filter(event=>event.action==='erase').length,1);
  const plan=P.compile({aspect:'9:16',style:'editorial',brand:{name:'Unicode'},scenes:[scene]});
  assert.equal(plan.audioEvents.filter(event=>event.kind==='type').length,7);
  assert.deepEqual(browserTyping(scene,2.5),schedule);
});

test("the browser's module of scene moments is the canonical one, written by its tool",()=>{
  const fs=require('node:fs'),path=require('node:path'),dir=path.join(path.dirname(new URL(import.meta.url).pathname),'../source/lib/components');
  const source=fs.readFileSync(path.join(dir,'scene-moments.cjs'),'utf8'),browser=fs.readFileSync(path.join(dir,'scene-moments.mjs'),'utf8');
  assert.equal(browser,source.replace('module.exports = {sceneMoments, onBeat, landings};','export {sceneMoments, onBeat, landings};'),'run node kit/tools/sync-scene-moments.cjs');
});
