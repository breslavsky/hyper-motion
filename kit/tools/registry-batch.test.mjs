// Registry adaptations must extend the existing catalogue and its native contract.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {catalog} from '../source/lib/components/index.mjs';
import {loadImages} from '../source/lib/components/context.mjs';
const require=createRequire(import.meta.url),F=require('../source/lib/film.cjs');
const definitions=require('../source/lib/components/metadata.cjs');
const NAMES=['before-after-wipe','screen-flow-carousel','chart-story','testimonial-proof-card','modal-morph'];
const film=(scene,more={})=>({aspect:'9:16',style:'editorial',brand:{name:'Nook'},scenes:[scene],...more});

test('registry schemas reject wrong types and field bounds before rendering',()=>{
  for(const name of NAMES){
    const d=definitions[name],sample=structuredClone(d.sample);
    assert.deepEqual(F.problems(film(sample)),[],name);
    for(const [key,spec] of Object.entries(d.fields)){
      for(const value of [...(!spec.optional?[null]:[]),spec.kind==='string'?42:spec.kind==='array'?{}:'wrong-type',...(spec.kind==='string'&&spec.max?['x'.repeat(spec.max+1)]:[]),...(spec.kind==='array'&&spec.max&&sample[key]?.length?[Array(spec.max+1).fill(sample[key][0])]:[])]){
        assert.ok(F.problems(film({...sample,[key]:value})).length,`${name}.${key} accepted ${JSON.stringify(value)}`);
      }
    }
    assert.ok(F.problems(film({...sample,notAField:true})).length);
  }
});

test('registry cross-field constraints reject misleading or unusable content',()=>{
  const sample=name=>structuredClone(definitions[name].sample);
  const reject=scene=>assert.ok(F.problems(film(scene)).length,JSON.stringify(scene));
  const chart=sample('chart-story');
  for(const mode of ['bars','line','donut','progress'])assert.deepEqual(F.problems(film({...chart,chart:mode})),[]);
  reject({...chart,chart:'donut',items:chart.items.map(item=>({...item,value:0}))});
  for(const value of [-1,1000001,NaN,Infinity])reject({...chart,items:[{label:'Invalid',value},chart.items[0]]});
  for(const emphasize of [0,1.5,chart.items.length+1])reject({...chart,emphasize});
  reject({...sample('testimonial-proof-card'),emphasis:'absent from supplied quote'});
  const carousel=sample('screen-flow-carousel');
  reject({...carousel,images:['a.png','b.png']});
  reject({...sample('before-after-wipe'),images:['a.png']});
});

test('native registry media preflight rejects invalid paths before any Image request',async()=>{
  const previous=globalThis.Image,requests=[];
  globalThis.Image=class {naturalWidth=640;naturalHeight=480;set src(value){requests.push(value);this.onload();}};
  try{
    for(const name of ['before-after-wipe','screen-flow-carousel','testimonial-proof-card']){
      const sample=structuredClone(definitions[name].sample),field=name==='testimonial-proof-card'?'image':'images';
      const slot=value=>field==='image'?value:Array.from({length:name==='before-after-wipe'?2:sample.screens.length},()=>value);
      for(const invalid of ['https://example.invalid/remote.png',' https://example.invalid/remote.png','//example.invalid/remote.png','/tmp/local.png','../outside.png','derived/../outside.png','derived\\outside.png','https%3A%2F%2Fexample.invalid/a.png','%2F%2Fexample.invalid/a.png','derived/%2e%2e/outside.png','derived/%5coutside.png','bad%ZZ.png','\tremote.png',42,true,{}]){
        const before=requests.length,context={plan:{brand:{}},ps:{scene:{...sample,[field]:slot(invalid)}},images:{}};
        await assert.rejects(loadImages(context),/image|media|path/i,`${name}: ${JSON.stringify(invalid)}`);
        assert.equal(requests.length,before,'Invalid native override issued Image.src');
      }
      if(field==='images')for(const invalid of ['derived/photo.png',42,{},true]){
        const before=requests.length;await assert.rejects(loadImages({plan:{brand:{}},ps:{scene:{...sample,images:invalid}},images:{}}),/image|media|path/i);assert.equal(requests.length,before);
      }
      for(const valid of ['derived/cover.png','uploads/folder name/avatar.svg','derived/caf%C3%A9.svg']){
        const context={plan:{brand:{}},ps:{scene:{...sample,[field]:slot(valid)}},images:{}};
        await loadImages(context);assert.deepEqual(context.images[valid],{src:valid,w:640,h:480});
      }
    }
  }finally{if(previous===undefined)delete globalThis.Image;else globalThis.Image=previous;}
});

test('pinned registry provenance verifies originals, manifests, license and adaptation targets',()=>{
  const base=fileURLToPath(new URL('../source/lib/components/upstream/hyperframes-registry-01/',import.meta.url));
  const receipt=JSON.parse(fs.readFileSync(path.join(base,'RECEIPT.json'),'utf8'));
  const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  assert.equal(receipt.repository,'https://github.com/heygen-com/hyperframes');
  assert.match(receipt.commit,/^[a-f\d]{40}$/);assert.equal(receipt.license,'Apache-2.0');
  assert.equal(hash(path.join(base,'LICENSE')),receipt.licenseSha256);
  assert.deepEqual(receipt.items.map(item=>item.name).sort(),[...NAMES].sort());
  const archive=path.resolve(base,receipt.archiveRoot);
  assert.equal(archive,fileURLToPath(new URL('./upstream/hyperframes-registry-01/',import.meta.url)).replace(/\/$/,''));
  for(const item of receipt.items){
    const original=path.join(archive,item.name,path.basename(item.path));
    const manifest=path.join(archive,item.name,'registry-item.json');
    assert.equal(hash(original),item.sha256,item.name+' source');
    assert.equal(hash(manifest),item.manifestSha256,item.name+' manifest');
    assert.equal(JSON.parse(fs.readFileSync(manifest,'utf8')).name,item.name);
    assert.ok(item.source.includes('/'+receipt.commit+'/'));
    const adapted=path.resolve(base,item.adaptedTo);
    assert.equal(adapted,fileURLToPath(new URL(`../source/lib/components/scenes/${catalog[item.name].family}.mjs`,import.meta.url)));
    const code=fs.readFileSync(adapted,'utf8').replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
    assert.doesNotMatch(code,/upstream\/|\.html\b|fetch\(/,'Runtime must not load upstream HTML');
  }
  // Studio discovers renderable HTML recursively, so archived originals must
  // never accompany the runtime as five extra selectable compositions.
  const project=fs.mkdtempSync(path.join(os.tmpdir(),'pk-registry-studio-'));
  try{
    fs.cpSync(new URL('../source/lib/',import.meta.url),path.join(project,'lib'),{recursive:true});
    const demo=JSON.parse(fs.readFileSync(new URL('./registry-demo.json',import.meta.url),'utf8'));
    assert.deepEqual(F.problems(demo),[]);
    require('../source/lib/build.cjs').buildProject(project,demo,F.planOf(demo));
    const html=fs.readdirSync(project,{recursive:true}).filter(file=>file.endsWith('.html'));
    assert.equal(html.length,6);assert.ok(html.every(file=>file==='index.html'||file.startsWith('compositions/')));
    assert.equal(html.filter(file=>file.startsWith('compositions/')).length,5);
  }finally{fs.rmSync(project,{recursive:true,force:true});}
});

test('registry sound cues share the motion schedule through tempo, pace, gain and mute',()=>{
  for(const name of NAMES)for(const aspect of ['9:16','1:1','16:9'])for(const pace of ['chill','normal','hyper'])for(const bpm of [72,120,180]){
    const d=definitions[name],sample=structuredClone(d.sample),input=film(sample,{aspect,pace,music:{bpm}});
    assert.deepEqual(F.problems(input),[],`${name}/${pace}/${bpm}`);
    const plan=F.planOf(input),ps=plan.scenes[0],cues=[];
    d.sounds(sample,ps.ldur,(at,kind,strength)=>cues.push({t:at/ps.speed,kind,strength}),plan.beat*ps.speed);
    assert.ok(cues.length,name);
    assert.equal(plan.audioEvents.filter(event=>event.t>0).length,cues.length,'Extra or missing component audio event');
    for(const cue of cues){assert.ok(cue.t>=0&&cue.t<ps.dur,`${name}: cue outside slot`);assert.ok(plan.audioEvents.some(x=>x.kind===cue.kind&&Math.abs(x.t-cue.t)<1e-8&&x.strength===cue.strength),`${name}: detached audio cue`);}
    const muted=F.planOf({...input,scenes:[{...sample,sound:{mute:true}}]});assert.deepEqual(muted.audioEvents,[]);assert.deepEqual(muted.cues,plan.cues);
    const quiet=F.planOf({...input,scenes:[{...sample,sound:{gain:.35,kit:'tech'}}]});assert.ok(quiet.audioEvents.every(x=>x.gain===.35&&x.kit==='tech'));
  }
});
