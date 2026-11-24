import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {buildProject} from './build.mjs';

test('exported recipe rebuilds the same custom sound kit and responsive world',async()=>{
  const folder=await fs.mkdtemp(path.join(os.tmpdir(),'ui-world-roundtrip-'));
  try{
    const spec={aspect:'1:1',sliderLength:340,style:{accent:'#FF8C42',font:'Archivo'},music:{bpm:90},timing:{slide:{startBeat:3,endBeat:12}},
      sound:{gain:.8,targets:{switch:{mute:true}},mapping:{'slider.tick':false,'actor.land':{sound:'pop',gain:.24}}}};
    const original=await buildProject(path.join(folder,'original'),spec);
    const recipe=JSON.parse(await fs.readFile(path.join(original.project,'recipe.json'),'utf8'));
    const rebuilt=await buildProject(path.join(folder,'rebuilt'),recipe);
    assert.deepEqual(rebuilt.plan,original.plan);
    assert.deepEqual(rebuilt.audio,original.audio);
    assert.equal(original.audio.clips.length,2);
    assert.equal(original.audio.clips[0].sound,'pop');
  }finally{await fs.rm(folder,{recursive:true,force:true});}
});
