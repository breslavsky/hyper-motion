import test from 'node:test';
import assert from 'node:assert/strict';
import {compile,stateAt,normalize,DEFAULT_RECIPE} from '../source/lib/sequences/document-flow/model.mjs';

test('one scan edge owns recognition states and sound times in every format and tempo',()=>{
  for(const aspect of ['9:16','1:1','16:9'])for(const bpm of [96,108,132]){
    const plan=compile({aspect,bpm});
    for(const d of plan.layout.documents){
      const event=plan.events.find(e=>e.id===`scan-${d.id}`);
      const state=stateAt(plan,event.time);
      assert.ok(Math.abs(state.scan.y-d.source.y)<1e-8);
      assert.equal(state.documents.find(x=>x.id===d.id).scanned,true);
      assert.equal(stateAt(plan,event.time-1e-5).documents.find(x=>x.id===d.id).scanned,false);
    }
  }
});

test('documents land once in their named categories and remain the same identities',()=>{
  for(const aspect of ['9:16','1:1','16:9']){
    const plan=compile({aspect}),ids=plan.content.documents.map(d=>d.id);
    for(let frame=0;frame<plan.duration*60;frame++)assert.deepEqual(stateAt(plan,frame/60).documents.map(d=>d.id),ids);
    for(const d of plan.layout.documents){
      const event=plan.events.find(e=>e.id===`sorted-${d.id}`),land=stateAt(plan,event.time).documents.find(x=>x.id===d.id);
      assert.equal(land.sorted,true);assert.deepEqual({x:land.x,y:land.y},d.destination);
      assert.equal(land.category,d.category);
    }
    const final=stateAt(plan,plan.phases.find(phase=>phase.id==='arrange').end);
    assert.deepEqual(final.categories.map(g=>g.count),plan.content.categories.map(g=>plan.content.documents.filter(d=>d.category===g.id).length));
  }
});

test('arbitrary reverse seeks are pure, and camera handoffs are continuous',()=>{
  const plan=compile(),before=JSON.stringify(plan);
  const times=[0,1.1,4,7,10,13,16,plan.duration-.001];
  const forward=times.map(t=>stateAt(plan,t));
  for(let i=times.length-1;i>=0;i--)assert.deepEqual(stateAt(plan,times[i]),forward[i]);
  for(const b of [0,5,10,22,26,32]){
    const a=stateAt(plan,b*plan.beat-1e-7).camera,z=stateAt(plan,b*plan.beat+1e-7).camera;
    for(const key of ['x','y','zoom'])assert.ok(Math.abs(a[key]-z[key])<1e-3,`${b} ${key}`);
  }
  assert.equal(JSON.stringify(plan),before);
});

test('action words and sound events coincide with collecting, arranging and creating',()=>{
  for(const aspect of ['9:16','1:1','16:9'])for(const bpm of [96,108,132]){
    const plan=compile({aspect,bpm});
    assert.deepEqual(plan.phases.map(phase=>[phase.id,phase.start,phase.end]),
      [['intro',0,5],['collect',5,10],['arrange',10,22],['create',22,26],['end',26,32]]
        .map(([name,start,end])=>[name,start*plan.beat,end*plan.beat]));
    for(const [i,name]of ['collect','arrange','create'].entries()){
      const phase=plan.phases.find(phase=>phase.id===name),time=(phase.start+phase.end)/2;
      const state=stateAt(plan,time),event=plan.events.find(event=>event.kind==='action.start'&&event.target===`action:${name}`);
      assert.ok(event,`${name}: an action sound must be declared`);
      assert.equal(event.time,phase.start);
      assert.equal(state.actionLabel,plan.content.steps[i]);
      assert.deepEqual(state.categories.map(group=>group.label),plan.content.categories.map(group=>group.label));
    }
    assert.equal(stateAt(plan,plan.duration).actionLabel,'');
  }
});

test('six carries are sequential gestures with a landing interval before the next gesture',()=>{
  for(const aspect of ['9:16','1:1','16:9']){
    const plan=compile({aspect}),arrange=plan.phases.find(phase=>phase.id==='arrange');
    const carrying=[...plan.layout.documents].sort((a,b)=>a.sortBeat-b.sortBeat);
    for(const [i,document]of carrying.entries()){
      assert.ok(document.sortBeat*plan.beat>=arrange.start);
      assert.ok(document.sortEndBeat>document.sortBeat);
      assert.ok(document.sortEndBeat*plan.beat<arrange.end);
      if(i)assert.ok(document.sortBeat-carrying[i-1].sortEndBeat>=.1,
        `${document.id}: the preceding document must finish and land before another carry starts`);
    }
    for(let beat=10;beat<=22;beat+=.025){
      const state=stateAt(plan,beat*plan.beat);
      assert.ok(state.documents.filter(document=>document.moving).length<=1,`At ${beat}: more than one active carry`);
    }
  }
});

test('the existing draft remains the hero and physical backs carry no readable front label',()=>{
  for(const aspect of ['9:16','1:1','16:9']){
    for(const kindIndex of [5,0,-1]){
      const recipe=structuredClone(DEFAULT_RECIPE);recipe.aspect=aspect;
      recipe.content.documents.forEach((document,index)=>{document.kind=index===kindIndex?'draft':'file';});
      const plan=compile(recipe),heroId=recipe.content.documents[kindIndex<0?5:kindIndex].id;
      assert.equal(plan.layout.heroId,heroId);
      const intro=stateAt(plan,2*plan.beat);
      assert.equal(intro.heroId,heroId);
      assert.deepEqual(intro.documents.filter(document=>document.active).map(document=>document.id),[heroId]);
      const collect=stateAt(plan,8.8*plan.beat);
      assert.ok(collect.documents.every(document=>document.active&&document.face==='front'));
      const queue=stateAt(plan,10*plan.beat);
      assert.ok(queue.documents.every(document=>document.face==='back'&&!document.active));
      const create=stateAt(plan,24*plan.beat);
      assert.equal(create.heroId,heroId);
      assert.deepEqual(create.documents.filter(document=>document.active).map(document=>document.id),[heroId]);
      assert.ok(create.documents.find(document=>document.id===heroId).artProgress>0);
      for(let beat=9;beat<22;beat+=.025){
        for(const document of stateAt(plan,beat*plan.beat).documents){
          if(document.face==='back')assert.equal(document.active,false);
          if(document.active)assert.ok(document.front>.92);
        }
      }
    }
  }
});

test('a category becomes ready only when its last document has landed',()=>{
  for(const aspect of ['9:16','1:1','16:9'])for(const bpm of [96,108,132]){
    const plan=compile({aspect,bpm}),events=plan.events.filter(event=>event.kind==='category.ready');
    assert.equal(events.length,plan.content.categories.length);
    for(const category of plan.content.categories){
      const assigned=plan.layout.documents.filter(document=>document.category===category.id);
      const event=events.find(event=>event.target===`category:${category.id}`);
      assert.ok(event,`${category.id}: missing readiness event`);
      assert.equal(event.time,Math.max(...assigned.map(document=>document.sortEndBeat*plan.beat)));
      const before=stateAt(plan,event.time-1e-6).categories.find(group=>group.id===category.id);
      const ready=stateAt(plan,event.time).categories.find(group=>group.id===category.id);
      assert.ok(before.count<assigned.length);
      assert.equal(ready.count,assigned.length);
    }
  }
});

test('accepted opening, action and closing copy retains an opaque reading window',()=>{
  const longer={...structuredClone(DEFAULT_RECIPE.content),
    opening:'Bring scattered creative work into organized collections',
    steps:['Collect material','Arrange projects','Create concepts'],
    closing:'Find your next idea among collected work',cta:'Start creating today'};
  for(const input of [{bpm:132},{bpm:96,content:longer},{bpm:108,content:longer}]){
    const plan=compile(input),step=1/120;
    const longest=predicate=>{
      let current=0,maximum=0;
      for(let time=0;time<plan.duration;time+=step){
        current=predicate(stateAt(plan,time))?current+step:0;
        maximum=Math.max(maximum,current);
      }
      return maximum;
    };
    const check=(text,predicate)=>{
      const seconds=.5+.28*text.split(/\s+/).length,actual=longest(predicate);
      assert.ok(actual+1/60>=seconds,`${plan.bpm} BPM: ${text} holds ${actual.toFixed(3)}s, requires ${seconds.toFixed(3)}s`);
    };
    check(plan.content.opening,state=>state.introOpacity>=.75);
    for(const text of plan.content.steps)check(text,state=>state.actionLabel===text&&(state.actionOpacity??1)>=.75);
    check(plan.content.closing,state=>state.endOpacity>=.75);
    check(plan.content.cta,state=>state.endOpacity*state.ctaOpacity>=.75);
  }
});

test('brief and sound contracts reject unsupported choices before building',()=>{
  for(const bad of [{extra:true},{aspect:'4:5'},{bpm:400},{brand:{font:'Imaginary'}},{sound:{targets:{ideas:{mute:true}}}}])assert.throws(()=>compile(bad));
  const extra=structuredClone(DEFAULT_RECIPE);extra.content.documents.push(extra.content.documents[0]);assert.throws(()=>compile(extra));
  const unknown=structuredClone(DEFAULT_RECIPE);unknown.content.documents[0].category='missing';assert.throws(()=>compile(unknown));
  const long=structuredClone(DEFAULT_RECIPE);long.content.opening='one two three four five six seven eight nine';assert.throws(()=>compile(long),/eight words/);
  assert.doesNotThrow(()=>compile({bpm:132,content:{...DEFAULT_RECIPE.content,steps:['Collect work','Arrange work','Create work']}}));
});

test('normalization does not modify input and event targets separate documents from groups',()=>{
  const input=structuredClone(DEFAULT_RECIPE),before=JSON.stringify(input),plan=compile(input);
  assert.equal(JSON.stringify(input),before);assert.deepEqual(normalize(input),input);
  assert.ok(plan.events.some(e=>e.target==='document:ideas'));
  assert.ok(plan.events.some(e=>e.target==='category:ideas'));
  assert.equal(new Set(plan.events.map(e=>e.id)).size,plan.events.length);
  const muted=compile({sound:{targets:{'document:ideas':{mute:true}}}});
  assert.equal(muted.recipe.sound.targets['document:ideas'].mute,true);
});

test('format and color contracts reject inherited property names and coerced JSON values',()=>{
  for(const aspect of ['toString','constructor','__proto__',['9:16'],{'0':'9:16'},null,16])
    assert.throws(()=>compile({aspect}),/aspect: use/);
  for(const key of ['background','foreground','accent','accent2'])for(const value of [['#ff0000'],{color:'#ff0000'},null,123456]){
    const recipe=structuredClone(DEFAULT_RECIPE);recipe.brand[key]=value;
    assert.throws(()=>compile(recipe),new RegExp(`brand.${key}: use`));
  }
  for(const aspect of Object.keys({'9:16':0,'1:1':0,'16:9':0})){
    const plan=compile({aspect});assert.ok(Number.isFinite(plan.width)&&Number.isFinite(plan.height));
  }
});
