import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import catalog from '../source/lib/components/catalog.mjs';

test('ellipsis scope accounts for the complete catalog, inherited labels and justified exclusions',()=>{
  const scope=JSON.parse(fs.readFileSync(new URL('./ellipsis-scope.json',import.meta.url),'utf8'));
  const names=scope.components.map(row=>row.type);
  assert.equal(new Set(names).size,names.length,'Each public type must have exactly one policy');
  assert.deepEqual([...names].sort(),Object.keys(catalog).sort(),'No missing or invented catalog types');
  const text=value=>typeof value==='string'&&value.trim().length>0;
  for(const row of scope.components){
    assert.ok(['direct','inherited','existing','preserved'].includes(row.policy),row.type);
    assert.equal(row.renderMode,catalog[row.type].renderMode,row.type);
    assert.ok(fs.existsSync(new URL('../'+row.file,import.meta.url)),row.file);
    assert.ok(Array.isArray(row.singleLine)&&row.singleLine.every(text),row.type);
    assert.equal(new Set(row.singleLine).size,row.singleLine.length,`${row.type}: repeated fields`);
    assert.ok(text(row.preserved?.reason),`${row.type}: explain preserved content`);
    if(row.preserved.fields)assert.ok(row.preserved.fields.length&&row.preserved.fields.every(text),row.type);
    if(['direct','existing'].includes(row.policy))assert.ok(row.singleLine.length,`${row.type}: name the affected fields`);
    if(row.policy==='inherited')assert.ok(row.inherits.length,`${row.type}: identify the shared renderer`);
    if(row.policy==='preserved')assert.equal(row.singleLine.length+row.inherits.length,0,`${row.type}: excluded policy cannot claim label changes`);
    for(const helper of row.inherits)assert.ok(scope.sharedHelpers[helper]?.callers.includes(row.type),`${row.type}: undeclared helper ${helper}`);
  }
  const mock=scope.sharedHelpers.mockUI;
  assert.equal(new Set(mock.callers).size,mock.callers.length,'Shared callers cannot duplicate coverage');
  assert.deepEqual([...mock.callers].sort(),scope.components.filter(row=>row.inherits.includes('mockUI')).map(row=>row.type).sort());
  assert.ok(mock.singleLine.length&&mock.singleLine.every(text)&&text(mock.preserved.reason));
  assert.ok(mock.callers.includes('between')&&mock.callers.includes('knockout'));
  assert.ok(!mock.callers.includes('montage'),'Montage gradient/photo plates do not invoke mockUI');
  const hud=scope.sharedHelpers.hud;
  assert.ok(text(hud.scope)&&text(hud.condition)&&hud.singleLine.length&&text(hud.preserved.reason));
  assert.ok(!names.includes('hud'),'Conditional global chrome is not an extra public scene type');
});
