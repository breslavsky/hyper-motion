import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {catalog,createComponentLibrary} from '../source/lib/components/index.mjs';
import {ORB_STATES} from '../source/lib/components/thinking-orbs/orb.mjs';
import {resolveContent} from '../source/lib/components/timing.mjs';
const require=createRequire(import.meta.url);
const F=require('../source/lib/film.cjs');
const definition=require('../source/lib/components/metadata.cjs')['thinking-orb'];
const mirror=require('./sync-thinking-orbs.cjs');
const film=(scene,more={})=>({aspect:'9:16',style:'editorial',brand:{name:'Studio'},scenes:[scene],...more});

test('portable Thinking Orbs files exactly mirror the canonical runtime and pinned MIT engine',()=>{
  const copied=fs.readdirSync(mirror.destination,{recursive:true}).filter(name=>fs.statSync(path.join(mirror.destination,name)).isFile()).sort();
  assert.deepEqual(copied,[...mirror.files].sort());
  for(const file of mirror.files)assert.deepEqual(fs.readFileSync(path.join(mirror.destination,file)),fs.readFileSync(path.join(mirror.canonical,file)),file);
  const receipt=JSON.parse(fs.readFileSync(path.join(mirror.destination,'vendor/INTEGRITY.json')));
  for(const file of ['engine.es.js','index-B8WsUNf5.js','LICENSE']){
    const bytes=fs.readFileSync(path.join(mirror.destination,'vendor',file));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),receipt.files[file].sha256,file);
  }
  assert.equal(receipt.version,'0.3.2');assert.equal(receipt.license,'MIT');
  assert.ok(!copied.some(name=>/golden|react|native|example|test/.test(name)));
});

test('new native family resolves beside the original orb without additional packages',async()=>{
  assert.deepEqual(catalog['thinking-orb'],{family:'shapes',renderMode:'canvas',owned:true});
  const library=createComponentLibrary({W:1920,H:1080,S:1,plan:{look:{}},helpers:{maths:{},dom:{},moves:{},ui:{}}});
  assert.equal(typeof await library.get('thinking-orb'),'function');
  assert.equal(typeof await library.get('orb'),'function');
  assert.notEqual(await library.get('thinking-orb'),await library.get('orb'));
  assert.deepEqual(F.problems(film({type:'orb',lines:['Original orb'],beats:4})),[]);
  // Import the shipped subset in isolation: no path back into the repository.
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'pk-orbs-portable-'));
  try{
    fs.cpSync(mirror.destination,path.join(directory,'orbs'),{recursive:true});
    const {sampleOrb}=await import(pathToFileURL(path.join(directory,'orbs/orb.mjs')));
    for(const state of ORB_STATES)assert.ok(sampleOrb({state},.5));
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
});

test('recipe validation covers all semantic states and rejects unsupported controls',()=>{
  assert.deepEqual(definition.fields.state.values,ORB_STATES);
  for(const state of ORB_STATES)for(const aspect of ['9:16','16:9','1:1']){
    const recipe=film({...definition.sample,state},{aspect});
    assert.deepEqual(F.problems(recipe),[],`${state}/${aspect}`);
    assert.equal(F.planOf(recipe).scenes[0].scene.state,state);
  }
  for(const overrides of [{state:'loading'},{state:null},{state:undefined},{title:''},{title:'x'.repeat(49)},{body:'x'.repeat(101)},{orbSpeed:-1},{orbSpeed:5},{orbSpeed:NaN},{size:.24},{size:1.1},{tint:'#1234'},{tint:'#abcdef80'},{tint:'rgba(0,0,0,.5)'},{speed:2},{url:'https://example.com'}]){
    assert.ok(F.problems(film({...definition.sample,...overrides})).length,JSON.stringify(overrides));
  }
  for(const tint of ['#abc','#12abef','brand','ink'])assert.deepEqual(F.problems(film({...definition.sample,tint,orbSpeed:0,size:.25})),[]);
  const changed=resolveContent(definition.sample,{state:'listening',orbSpeed:.5});
  assert.equal(changed.scene.state,'listening');assert.equal(changed.scene.orbSpeed,.5);
  assert.throws(()=>resolveContent(definition.sample,{speed:2}),/slot/);
});

test('storybook and resolved copy include only supplied captions, never semantic settings',()=>{
  const scene={...definition.sample,state:'searching',tint:'coral',orbSpeed:2,size:.75,title:'Ищем ответ',body:'По вашим материалам'};
  const recipe=film(scene),plan=F.planOf(recipe),review=F.review(recipe,plan),book=F.book(recipe,plan);
  assert.deepEqual(review.scenes[0].words,[scene.title,scene.body]);
  assert.equal(book.lang,'ru');
  assert.equal(book.episodes[0].shots[0].title,scene.title);
  assert.equal(book.episodes[0].shots[0].text,scene.body);
  const silent=film({type:'thinking-orb',state:'breathing',beats:4,tint:'ink'});
  assert.deepEqual(F.review(silent,F.planOf(silent)).scenes[0].words,[]);
});

test('palette-resolved tints reject alpha hex before building or mounting a canvas',()=>{
  for(const color of ['#abcd','#abcdef80']){
    const recipe=film({...definition.sample,tint:'brand'},{brand:{name:'Studio',colors:[color]}});
    assert.match(F.problems(recipe).join('\n'),/thinking-orb.*tint resolves to.*palette\/brand.colors/);
    assert.ok(definition.validateResolved(recipe.scenes[0],{palette:{brand:color},accent:'#123456'}).length);
    assert.ok(definition.validateResolved(definition.sample,{palette:{},accent:color}).length,'Native style accent');
    // An explicit compatible tint keeps an otherwise valid brand palette usable.
    assert.deepEqual(F.problems({...recipe,scenes:[{...recipe.scenes[0],tint:'#abc'}]}),[]);
  }
  for(const color of ['#abc','#abcdef']){
    const recipe=film({...definition.sample,tint:'brand'},{brand:{name:'Studio',colors:[color]}});
    assert.deepEqual(F.problems(recipe),[]);
  }
});

test('caption cues follow the same scene-local schedule at every pace and tempo',()=>{
  for(const pace of ['chill','normal','hyper'])for(const bpm of [60,108,180]){
    const recipe=film(definition.sample,{pace,music:{bpm}}),plan=F.planOf(recipe),ps=plan.scenes[0],cues=[];
    definition.sounds(definition.sample,ps.ldur,(at,kind)=>cues.push([ps.start+at/ps.speed,kind]),plan.beat*ps.speed);
    for(const [at,kind] of cues)assert.ok(plan.cues.some(c=>c.kind===kind&&Math.abs(c.t-at)<1e-8),`${pace}/${bpm}/${kind}`);
    const muted=F.planOf(film({...definition.sample,sound:{mute:true}},{pace,music:{bpm}}));
    assert.deepEqual(muted.audioEvents,[]);
  }
});
