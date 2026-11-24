import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freezeContract,checkCandidate,authorRecipe} from './sequence-authoring.mjs';

const reference={brand:{foreground:'#111111',accent:'#ff6a70'},content:{opening:'Keep every word',documents:[{id:'one',label:'Notes',category:'ideas'}],steps:['Collect','Arrange','Create'],closing:'Find your next idea',cta:'Try Folio'}};
const normalize=value=>{
  if(!value||Array.isArray(value)||typeof value!=='object')throw new Error('expected recipe object');
  if(Object.keys(value).some(k=>!['brand','content'].includes(k)))throw new Error('unsupported field');
  return structuredClone(value);
};
const contract=freezeContract(reference,{normalize});
const reply=text=>({text,model:'test-writer',costUsd:.0001,usage:{completion_tokens:20}});
const base={brief:'Preserve the supplied words and action order.',guide:'Return JSON only.',contract,normalize};

test('contract catches changed copy, brand, category, action order and extra actions',()=>{
  for(const change of [r=>r.content.opening+=' fast',r=>r.brand.foreground='#ffffff',r=>r.content.documents[0].category='files',r=>r.content.steps.reverse(),r=>r.content.steps.push('Repeat'),r=>r.scenes=[]]){
    const candidate=structuredClone(reference);change(candidate);
    assert.equal(checkCandidate(JSON.stringify(candidate),contract,{normalize}).ok,false);
  }
  assert.equal(checkCandidate(JSON.stringify(reference),contract,{normalize}).ok,true);
  assert.equal(checkCandidate('```json\n{}\n```',contract,{normalize}).ok,false);
});
test('trusted brief contract cannot be changed after freezing',()=>{
  const changed=structuredClone(contract);changed.recipe.content.cta='Subscribe';
  assert.throws(()=>checkCandidate(JSON.stringify(reference),changed,{normalize}),/changed frozen/);
});
test('accepted data finishes immediately without a visual-quality claim',async()=>{
  let calls=0;const result=await authorRecipe({...base,generate:async()=>{calls++;return reply(JSON.stringify(reference));}});
  assert.equal(result.status,'accepted');assert.equal(calls,1);assert.deepEqual(result.recipe,reference);
  assert.equal(result.visualQuality,undefined);
});
test('one repair uses concrete contract errors and keeps both untouched responses',async()=>{
  const wrong=structuredClone(reference);wrong.content.cta='Subscribe';let calls=0;
  const result=await authorRecipe({...base,generate:async({messages})=>{
    calls++;if(calls===2)assert.match(messages.at(-1).content,/content.cta/);
    return reply(JSON.stringify(calls===1?wrong:reference));
  }});
  assert.equal(calls,2);assert.equal(result.status,'accepted');assert.equal(result.attempts[0].response.text,JSON.stringify(wrong));
});
test('persistent invalid output stops after two calls even when writer asks to continue',async()=>{
  let calls=0;const result=await authorRecipe({...base,generate:async()=>{calls++;return reply('{"continue":true}');}});
  assert.equal(calls,2);assert.equal(result.status,'rejected');assert.equal(result.recipe,undefined);
  await assert.rejects(authorRecipe({...base,maxAttempts:3,generate:async()=>reply('{}')}),/At most one/);
});
test('budget reservation stops before a call and unknown cost stops before a repair',async()=>{
  let calls=0;
  const stopped=await authorRecipe({...base,maxCostUsd:.001,generate:async()=>{calls++;return reply('{}');}});
  assert.equal(stopped.status,'budget-stop');assert.equal(calls,0);
  const unknown=await authorRecipe({...base,generate:async()=>{calls++;return {text:'{}',model:'test'};}});
  assert.equal(unknown.status,'unmetered');assert.equal(calls,1);assert.equal(unknown.costIncomplete,true);
});
test('provider error and timeout never trigger further paid attempts',async()=>{
  let calls=0;const failed=await authorRecipe({...base,generate:async()=>{calls++;throw new Error('unavailable');}});
  assert.equal(failed.status,'provider-error');assert.equal(calls,1);
  let aborted=false;
  const timed=await authorRecipe({...base,timeoutMs:10,generate:({signal})=>new Promise(()=>{calls++;signal.addEventListener('abort',()=>{aborted=true;});})});
  assert.equal(timed.status,'timeout');assert.equal(calls,2);assert.equal(aborted,true);
});
test('production normalizer accepts all three trusted briefs and rejects invented renderer fields',async()=>{
  const {compile}=await import('../source/lib/sequences/document-flow/model.mjs');
  const normalize=recipe=>compile(recipe).recipe;
  const fixtures=JSON.parse(fs.readFileSync(new URL('../../tests/tools/model_bench_document_flow_briefs.json',import.meta.url)));
  for(const {reference}of fixtures.briefs){
    const contract=freezeContract(reference,{normalize});
    assert.equal(checkCandidate(JSON.stringify(reference),contract,{normalize}).ok,true);
    const added=structuredClone(reference);added.camera={zoom:3};
    assert.equal(checkCandidate(JSON.stringify(added),contract,{normalize}).ok,false);
    const changed=structuredClone(reference);changed.content.documents[0].category=reference.content.categories[2].id;
    assert.equal(checkCandidate(JSON.stringify(changed),contract,{normalize}).ok,false);
  }
});
