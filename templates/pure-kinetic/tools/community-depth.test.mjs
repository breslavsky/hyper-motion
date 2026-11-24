import test from 'node:test';
import assert from 'node:assert/strict';
import plan from '../source/lib/compiler/plan.cjs';
import definitions from '../source/lib/components/metadata.cjs';
import {accordionFrame,explodeFrame,projectPlane} from '../source/lib/components/scenes/community-depth.mjs';

function frame(aspect) {
  const p=plan.compile({aspect,style:'editorial',brand:{name:'Nook'},scenes:[{type:'title',beats:6,text:'Test'}]});
  const {width:W,height:H,safe:m}=p;
  const x=W/2+(W*m.left-W/2)/1.12,y=H/2+(H*m.top-H/2)/1.12;
  const right=W/2+(W*(1-m.right)-W/2)/1.12,bottom=H/2+(H*(1-m.bottom)-H/2)/1.12;
  return {W,H,S:Math.min(W,H)/1080,safe:{x,y,w:right-x,h:bottom-y}};
}

test('accordion ticks land on each travelling focus peak, then the wave settles',()=>{
  const def=definitions.accordion;
  for(const aspect of ['16:9','1:1','9:16'])for(const n of [3,4,5])for(const duration of [1.2,3,7]){
    const K=frame(aspect),s={items:Array.from({length:n},(_,i)=>`Item ${i}`)},t=def.times(s,duration,.5);
    const events=[];def.sounds(s,duration,(at,kind)=>events.push({at,kind}),.5);
    assert.deepEqual(events.filter(e=>e.kind==='tick').map(e=>e.at),t.focus);
    t.focus.forEach((at,i)=>{
      const pose=accordionFrame(K,n,at,t);
      assert.ok(Math.abs(pose.boxes[i].size/pose.base-1.4)<1e-9);
      assert.equal(pose.boxes.indexOf(pose.boxes.reduce((a,b)=>a.size>b.size?a:b)),i);
    });
    const final=accordionFrame(K,n,duration,t);
    assert.ok(final.boxes.every(box=>Math.abs(box.size-final.base)<1e-9));
    assert.deepEqual(final,accordionFrame(K,n,duration,t));
  }
});

test('all depth labels stay inside the safe frame at 60 fps, including five-card portrait and square',()=>{
  for(const aspect of ['16:9','1:1','9:16'])for(const n of [3,4,5])for(const type of ['accordion','explode']){
    const K=frame(aspect),def=definitions[type],key=type==='accordion'?'items':'layers';
    const s={[key]:Array.from({length:n},(_,i)=>`Layer ${i}`)},t=def.times(s,3,.5);
    const draw=type==='accordion'?accordionFrame:explodeFrame;
    for(let f=0;f<=180;f++){
      const state=draw(K,n,f/60,t),safe=K.safe;
      for(const box of state.labels){
        assert.ok(box.x>=safe.x-1e-6&&box.y>=safe.y-1e-6,`${type} ${aspect}: label starts outside safe frame`);
        assert.ok(box.x+box.w<=safe.x+safe.w+1e-6&&box.y+box.h<=safe.y+safe.h+1e-6,`${type} ${aspect}: label ends outside safe frame`);
      }
      if(type==='accordion'&&state.vertical)for(let i=1;i<n;i++)assert.ok(state.labels[i].y>=state.labels[i-1].y+state.labels[i-1].h);
      if(type==='explode')for(const plane of state.planes)for(const x of [-state.width/2,state.width/2])for(const y of [-state.height/2,state.height/2]){
        const corner=projectPlane({x,y,z:plane.z},state);
        assert.ok(corner.x>=safe.x-1&&corner.x<=safe.x+safe.w+1,'A projected plane leaves the frame');
        assert.ok(corner.y>=safe.y+safe.h*.17,'A projected plane enters the heading');
        assert.ok(corner.y<=safe.y+safe.h*(state.wide?.91:.60),'A projected plane enters the lower label region');
        if(state.wide)assert.ok(corner.x<safe.x+safe.w*.63,'A projected plane enters the right label column');
      }
    }
  }
});

test('exploded planes keep equal centred depth gaps and reassemble to their exact initial pose',()=>{
  const def=definitions.explode;
  for(const aspect of ['16:9','1:1','9:16'])for(const n of [3,4,5]){
    const K=frame(aspect),s={layers:Array.from({length:n},(_,i)=>`Layer ${i}`)},t=def.times(s,3,.5);
    const initial=explodeFrame(K,n,0,t),opened=explodeFrame(K,n,t.separated,t),final=explodeFrame(K,n,3,t);
    assert.equal(opened.tilt,58);assert.equal(opened.spread,1);
    assert.ok(Math.abs(opened.planes.reduce((sum,p)=>sum+p.z,0))<1e-9);
    const distance=opened.planes[1].z-opened.planes[0].z;
    for(let i=1;i<n;i++)assert.ok(Math.abs(opened.planes[i].z-opened.planes[i-1].z-distance)<1e-9);
    assert.deepEqual(final,initial);
    const events=[];def.sounds(s,3,(at,kind)=>events.push({at,kind}),.5);
    assert.equal(events.find(e=>e.kind==='tick').at,t.separated);
    assert.equal(events.find(e=>e.kind==='pop').at,t.flat);
  }
});

test('leader projection follows the same perspective and rotation order as the CSS planes',()=>{
  const pose={cx:500,cy:400,perspective:1000,tilt:0,turn:0,scale:1};
  assert.deepEqual(projectPlane({x:100,y:50,z:0},pose),{x:600,y:450});
  assert.deepEqual(projectPlane({x:100,y:50,z:500},pose),{x:700,y:500});
  const rotated=projectPlane({x:100,y:0,z:0},{...pose,turn:90});
  assert.ok(Math.abs(rotated.x-500)<1e-9&&Math.abs(rotated.y-500)<1e-9);
});
