import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {buildProject} from '../source/lib/sequences/document-flow/build.mjs';
import {DEFAULT_RECIPE} from '../source/lib/sequences/document-flow/model.mjs';

async function folder(fn) {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'document-flow-build-'));
  try{return await fn(root);}finally{await fs.rm(root,{recursive:true,force:true});}
}

test('native output owns clocks and exact semantic clips with complete source receipts',()=>folder(async root=>{
  const built=await buildProject(path.join(root,'project'),{});
  const html=await fs.readFile(path.join(built.project,'index.html'),'utf8');
  const composition=await fs.readFile(path.join(built.project,'compositions/document-flow.html'),'utf8');
  assert.ok(composition.includes('data-composition-variables='));
  assert.ok(composition.includes("window.__timelines['document-flow']=timeline"));
  assert.ok(composition.includes("window.__hf.buildReady['document-flow:'+instanceId]=setup"));
  assert.ok(!html.includes('window.__documentFlowRootVariables'));
  assert.ok(composition.includes('expectedAudio:'));
  assert.ok(html.includes(`data-duration="${built.duration}"`));
  assert.equal((html.match(/data-sequence-event=/g)??[]).length,built.plan.events.length);
  assert.equal((html.match(/data-sequence-music=/g)??[]).length,1);
  for(const [relative,hash]of Object.entries(built.receipt.files)){
    const bytes=await fs.readFile(path.join(built.project,relative));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),hash,relative);
  }
  assert.ok(built.receipt.files['assets/fonts/GeistMono-Variable.woff2']);
  assert.ok(built.receipt.files['assets/vendor/gsap/gsap.min.js']);
  assert.ok(built.receipt.files['assets/document-flow-audio/pulse-108.wav']);
  assert.equal((html.match(/font-family: "Geist Mono"/g)??[]).length>=1,true);
  for(const name of ['BRIEF.md','SPEC.md','STORYBOARD.md']) {
    assert.ok((await fs.readFile(path.join(built.project,name),'utf8')).length>20);
    assert.equal(await fs.readFile(path.join(built.project,name),'utf8'),await fs.readFile(path.join(built.project,'source/lib/sequences/document-flow',name),'utf8'));
  }
}));

test('untrusted text stays data in HTML variable attributes and script configuration',()=>folder(async root=>{
  const recipe=structuredClone(DEFAULT_RECIPE);
  recipe.brand.name='Folio<&"\'';
  recipe.content.opening='Keep </script><img src=x> safe';
  const built=await buildProject(path.join(root,'escaped'),recipe);
  const html=await fs.readFile(path.join(built.project,'compositions/document-flow.html'),'utf8');
  const rootHTML=await fs.readFile(path.join(built.project,'index.html'),'utf8');
  assert.ok(!html.includes('</script><img src=x>'));
  assert.ok(!rootHTML.includes('</script><img src=x>'));
  assert.ok(html.includes('\\u003c/script>'));
  assert.ok(rootHTML.includes('&lt;'));
  assert.ok(rootHTML.includes('&#39;'));
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(built.project,'recipe.json'),'utf8')).content,recipe.content);
}));

test('a packaged sequence rebuilds standalone, and build refuses occupied destinations',()=>folder(async root=>{
  const first=await buildProject(path.join(root,'first'),{aspect:'16:9',bpm:120},{instanceId:'flow-one'});
  const isolated=path.join(root,'isolated');
  await fs.cp(path.join(first.project,'source'),isolated,{recursive:true});
  const second=path.join(root,'second');
  const result=JSON.parse(execFileSync(process.execPath,[path.join(isolated,'sequence.mjs'),'build',path.join(isolated,'recipe.json'),'--out',second],{encoding:'utf8'}));
  assert.equal(result.ok,true);
  assert.equal(result.sourceAggregate,first.receipt.aggregate);
  assert.equal(await fs.readFile(path.join(second,'index.html'),'utf8'),await fs.readFile(path.join(first.project,'index.html'),'utf8'));
  await assert.rejects(buildProject(first.project,{}),/fresh or empty directory/);
  const marker=path.join(root,'occupied');await fs.mkdir(marker);await fs.writeFile(path.join(marker,'keep.txt'),'user work');
  await assert.rejects(buildProject(marker,{}),/fresh or empty directory/);
  assert.equal(await fs.readFile(path.join(marker,'keep.txt'),'utf8'),'user work');
  const validation=JSON.parse(execFileSync(process.execPath,[path.join(isolated,'sequence.mjs'),'validate',path.join(isolated,'recipe.json')],{encoding:'utf8'}));
  assert.equal(validation.seconds,first.duration);
  const invalid=path.join(root,'invalid.json');
  await fs.writeFile(invalid,JSON.stringify({sound:{targets:{misspelled:{mute:true}}}}));
  assert.throws(()=>execFileSync(process.execPath,[path.join(isolated,'sequence.mjs'),'validate',invalid],{encoding:'utf8',stdio:'pipe'}),error=>/no event has this target/.test(error.stderr));
}));

test('native identities are explicit and reject unsafe or root-colliding names',()=>folder(async root=>{
  for(const instanceId of ['main','../flow','Flow', ['flow']])await assert.rejects(buildProject(path.join(root,'bad'),{}, {instanceId}),/instanceId:/);
  const built=await buildProject(path.join(root,'named'),{}, {instanceId:'flow-other'});
  const html=await fs.readFile(path.join(built.project,'index.html'),'utf8');
  assert.ok(html.includes('data-composition-src="compositions/flow-other.html"'));
  const ids=[...html.matchAll(/<audio id="([^"]+)"/g)].map(match=>match[1]);
  assert.ok(ids.every(id=>id.startsWith('flow-other-')));assert.equal(new Set(ids).size,ids.length);
}));
