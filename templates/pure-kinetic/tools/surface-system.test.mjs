import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import catalog from '../source/lib/components/catalog.mjs';
import {surfaceRecipe} from '../source/lib/components/surface-system.mjs';
import {createDesignSystem} from '../source/lib/components/design-system.mjs';

test('surface scope accounts for every catalog component exactly once',()=>{
  const scope=JSON.parse(fs.readFileSync(new URL('./surface-scope.json',import.meta.url),'utf8'));
  // noText marks picture-only types among them, it is no group of its own.
  const {noText,...groups}=scope,names=Object.values(groups).flat();assert.equal(new Set(names).size,names.length);
  assert.ok(noText.every(type=>scope.noSurface.includes(type)));
  assert.deepEqual(names.sort(),Object.keys(catalog).sort());
});
test('local UI scale changes typography and all surface dimensions together',()=>{
  const D=createDesignSystem({W:1920,H:1080,S:1,type:{label:36}}),small=D.forSurface(.25);
  for(const metric of ['paddingX','paddingY','gap','radius'])assert.equal(small.box('card')[metric]/D.box('card')[metric],small.unit/D.unit);
  assert.equal(small.type('body').size/D.type('body').size,small.unit/D.unit);
});
test('unknown recipes and invalid units cannot silently fall back',()=>{
  for(const args of [['tile',{}],['card',{density:'dense'}],['field',{shape:'free'}],['badge',{unit:0}],['card',{unit:NaN}]])assert.throws(()=>surfaceRecipe(...args));
  assert.equal(surfaceRecipe('badge',{shape:'square'}).radius,0);
  assert.equal(surfaceRecipe('badge',{shape:'pill'}).radius,9999);
});
