import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const definitions=require('../source/lib/components/metadata.cjs');
const F=require('../source/lib/film.cjs');
const names=['polar','letterflip','accordion','explode','scan'];
const film=(scene,more={})=>({aspect:'9:16',style:'editorial',brand:{name:'Nook'},scenes:[scene],...more});

test('community action sounds stay inside the component and obey its pace, gain and mute',()=>{
  for(const name of names)for(const pace of ['chill','normal','hyper'])for(const bpm of [72,120,180]){
    const definition=definitions[name],scene=structuredClone(definition.sample);
    const input=film(scene,{pace,music:{bpm}}),plan=F.planOf(input),ps=plan.scenes[0],expected=[];
    assert.deepEqual(F.problems(input),[],`${name}/${pace}/${bpm}`);
    definition.sounds(scene,ps.ldur,(at,kind,strength)=>expected.push({t:at/ps.speed,kind,strength}),plan.beat*ps.speed);
    assert.ok(expected.length>1,name);
    for(const cue of expected){
      assert.ok(cue.t>=0&&cue.t<ps.dur,`${name}: action outside native slot`);
      assert.ok(plan.audioEvents.some(event=>event.kind===cue.kind&&Math.abs(event.t-cue.t)<1e-9&&event.strength===cue.strength),`${name}: audible event moved away from its action`);
    }
    const muted=F.planOf({...input,scenes:[{...scene,sound:{mute:true}}]});
    assert.deepEqual(muted.audioEvents,[]);
    assert.deepEqual(muted.cues,plan.cues,'Muting sound must preserve visual impulses');
    const quiet=F.planOf({...input,scenes:[{...scene,sound:{gain:.35,kit:'tech'}}]});
    assert.ok(quiet.audioEvents.every(event=>event.gain===.35&&event.kit==='tech'));
  }
});

test('component-owned relationships fail with the scene and field before building',()=>{
  const scan=structuredClone(definitions.scan.sample);
  scan.categories=['First','Second'];scan.items[0].category=3;
  assert.ok(F.problems(film(scan)).some(message=>message.includes('scenes[0] (scan)')&&message.includes('items[0].category')));
  scan.items.forEach(item=>{delete item.category;});
  assert.deepEqual(F.problems(film(scan)),[]);
  const schedule=definitions.scan.times(scan,4,.5);
  assert.deepEqual(schedule.items.map(item=>item.category),scan.items.map((_,i)=>i%2));
  assert.ok(F.problems(film({...scan,items:null})).length);
  assert.ok(F.problems(film({...scan,categories:null})).length);
  assert.throws(()=>F.planOf(film({...scan,items:[{label:'Wrong',category:4}]})),/items|at least/);
  const accordion={...definitions.accordion.sample,images:['a.svg','b.svg','c.svg']};
  assert.ok(F.problems(film(accordion)).some(message=>message.includes('scenes[0] (accordion)')&&message.includes('images')));
  accordion.images=Array(accordion.items.length).fill('a.svg');
  assert.deepEqual(F.problems(film(accordion)),[]);
});
