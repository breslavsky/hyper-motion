import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {scanStatusState} from '../source/lib/components/scenes/pictures/scan.mjs';
const require=createRequire(import.meta.url);
const {compile}=require('../source/lib/compiler/plan.cjs');
const {scan}=require('../source/lib/components/metadata.cjs');

test('seven-beat scan holds short tags and completion at the checked normal tempos',()=>{
  // This is the supported short-copy sample, not a claim that arbitrarily fast
  // music or arbitrarily long copy fits the same fixed-duration native slot.
  for(const bpm of [108,128]){
    const plan=compile({aspect:'9:16',style:'noir',pace:'normal',brand:{name:'Test'},music:{bpm},scenes:[scan.sample]});
    const ps=plan.scenes[0],t=scan.times(scan.sample,ps.ldur,plan.beat*ps.speed);
    for(const item of t.items){
      const fullTag=(item.fly-item.scan-ps.ldur*.03)/ps.speed;
      assert.ok(fullTag>=.4,`${bpm} BPM: a short tag holds only ${fullTag}s`);
    }
    const fullComplete=(ps.ldur-t.complete-ps.ldur*.03)/ps.speed;
    assert.ok(fullComplete>=1.05-1e-9,`${bpm} BPM: completion holds only ${fullComplete}s`);
    assert.ok(t.complete>Math.max(...t.items.map(item=>item.land)));
  }
});

const visibleStatus=state=>({
  surface:state.surfaceOpacity,
  busy:state.surfaceOpacity*state.busyOpacity,
  done:state.surfaceOpacity*state.doneOpacity,
});
const near=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<1e-9,`${message}: ${actual} != ${expected}`);

test('status changes sequentially on the completion cue without dimming its surface',()=>{
  const timing={enter:.2,complete:6},length=10;
  const cases=[
    [5.7,1,0],[5.85,.5,0],[6,0,0],[6.15,0,.5],[6.3,0,1],[9.9,0,1],
  ];
  for(const [time,busy,done]of cases){
    const state=visibleStatus(scanStatusState(time,timing,length));
    near(state.surface,1,`background at ${time}`);
    near(state.busy,busy,`busy at ${time}`);
    near(state.done,done,`done at ${time}`);
  }
  for(const time of [6-1e-8,6,6+1e-8]){
    const state=visibleStatus(scanStatusState(time,timing,length));
    assert.equal(state.busy*state.done,0,`no simultaneous glyphs at ${time}`);
  }
});

test('status survives forward, reverse and arbitrary seeks at every handoff boundary',()=>{
  const timing=Object.freeze({enter:.2,complete:6}),length=10;
  const times=[0,.2,.55,.9,5.7-1e-8,5.7,5.85,6-1e-8,6,6+1e-8,6.15,6.3,10];
  const first=times.map(time=>scanStatusState(time,timing,length));
  for(const index of [...times.keys()].reverse())assert.deepEqual(scanStatusState(times[index],timing,length),first[index]);
  for(const index of [12,0,8,4,11,2,7,10,6,1,9,3,5])assert.deepEqual(scanStatusState(times[index],timing,length),first[index]);
  assert.deepEqual(visibleStatus(first[0]),{surface:0,busy:0,done:0});
});

test('optional status copy fades once, without inventing the missing label or a blank badge',()=>{
  const timing={enter:.2,complete:6},length=10;
  for(const [time,expected]of [[1,1],[5.85,1],[6,1],[6.15,.5],[6.3,0],[10,0]]){
    const state=visibleStatus(scanStatusState(time,timing,length,{busy:true,done:false}));
    near(state.busy,expected,`busy-only at ${time}`);near(state.surface,expected,`busy-only background at ${time}`);
    assert.equal(state.done,0);
  }
  for(const [time,expected]of [[0,0],[5.85,0],[6,0],[6.15,.5],[6.3,1],[10,1]]){
    const state=visibleStatus(scanStatusState(time,timing,length,{busy:false,done:true}));
    near(state.done,expected,`done-only at ${time}`);near(state.surface,expected,`done-only background at ${time}`);
    assert.equal(state.busy,0);
  }
  for(const time of [0,1,5.85,6,6.15,10])assert.deepEqual(
    visibleStatus(scanStatusState(time,timing,length,{busy:false,done:false})),
    {surface:0,busy:0,done:0},`no status at ${time}`,
  );
});

test('supported scan durations preserve completion audio and full done hold without any status overlap',()=>{
  for(const count of [3,4,5,6])for(const bpm of [60,108,128,180])for(const pace of ['chill','normal','hyper']){
    const scene={...scan.sample,items:scan.sample.items.slice(0,count)};
    const plan=compile({aspect:'9:16',style:'noir',pace,brand:{name:'Test'},music:{bpm},scenes:[scene]});
    const ps=plan.scenes[0],t=scan.times(scene,ps.ldur,plan.beat*ps.speed),fade=ps.ldur*.03;
    const chime=plan.audioEvents.find(event=>event.kind==='chime');
    assert.ok(chime,'completion has its compiled chime');
    near(chime.t,t.complete/ps.speed,'chime stays on semantic completion');
    assert.equal(visibleStatus(scanStatusState(t.complete,t,ps.ldur)).done,0,'done cannot announce completion early');
    near(visibleStatus(scanStatusState(t.complete+fade,t,ps.ldur)).done,1,'full done hold starts at the original time');
    for(let index=0;index<=100;index++){
      const time=t.complete-fade+2*fade*index/100,state=visibleStatus(scanStatusState(time,t,ps.ldur));
      near(state.surface,1,'the status surface remains stable across the handoff');
      assert.equal(state.busy*state.done,0,`${count} objects, ${bpm} BPM, ${pace}: overlap at ${time}`);
      if(time<t.complete)assert.equal(state.done,0,'no early completion glyphs');
    }
  }
});
