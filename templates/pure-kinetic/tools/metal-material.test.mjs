import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {resolveContent} from '../source/lib/components/timing.mjs';
const require=createRequire(import.meta.url),mirror=require('./sync-metal.cjs');

test('portable Metal files match canonical shader adapter and licensing',()=>{
  const copied=fs.readdirSync(mirror.destination,{recursive:true}).filter(name=>fs.statSync(path.join(mirror.destination,name)).isFile()).sort();
  assert.deepEqual(copied,[...mirror.files].sort());
  for(const file of mirror.files)assert.deepEqual(fs.readFileSync(path.join(mirror.destination,file)),fs.readFileSync(path.join(mirror.canonical,file)),file);
  assert.ok(copied.includes('vendor/METAL-LICENSE'));assert.ok(copied.includes('vendor/PAPER-LICENSE'));
  assert.ok(!copied.some(name=>/react|test|example/.test(name)));
});

test('native copy edits preserve material and cannot silently change compiled variant',()=>{
  const original={type:'title',text:'Made of metal',beats:5,look:'metal',metalVariant:'gold'};
  assert.equal(resolveContent(original,{text:'New title'}).scene.metalVariant,'gold');
  assert.throws(()=>resolveContent(original,{metalVariant:'silver'}),/compiled style/);
  assert.throws(()=>resolveContent(original,{metalVariant:undefined}),/compiled style/);
});
