import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {buildAudio} from '../source/lib/sequences/document-flow/audio.mjs';
import {validateSound} from '../source/lib/sequences/document-flow/sound-contract.mjs';

const events = [
  {id:'arrive-one', time:.2, kind:'document.arrive', target:'document:one'},
  {id:'scan-one', time:3.125, kind:'document.scanned', target:'document:one'},
  {id:'scan-start', time:2.75, kind:'scan.start', target:'scanner'},
  {id:'sorted-one', time:7.625, kind:'document.sorted', target:'document:one'},
  {id:'action-collect', time:10.25, kind:'action.start', target:'action:collect'},
  {id:'cta', time:15, kind:'cta.reveal', target:'cta'},
];
async function folder(fn) {
  const destination = await fs.mkdtemp(path.join(os.tmpdir(), 'document-flow-audio-'));
  try {return await fn(destination);} finally {await fs.rm(destination,{recursive:true,force:true});}
}

test('semantic audio stays on exact event times and ships verified local PCM', () => folder(async destination => {
  const result = await buildAudio({destination, events, duration:32*60/108, bpm:108});
  assert.equal(result.clips.length, events.length);
  for (const event of events) {
    const clip = result.clips.find(clip => clip.eventId === event.id);
    assert.equal(clip.start, event.time);
    assert.equal(clip.kind, event.kind);
    assert.equal(clip.target, event.target);
    assert.ok(clip.start + clip.duration <= result.duration);
  }
  for (const asset of result.assets) {
    const data = await fs.readFile(path.join(destination,asset.src));
    assert.equal(createHash('sha256').update(data).digest('hex'),asset.sha256);
    assert.equal(data.readUInt32LE(24),48000);
    assert.ok(data.length>44);
  }
  assert.equal(result.music.playbackRate,1);
  assert.equal(result.music.gain,.32);
  assert.ok(result.music.note.includes('transpose'));
}));

test('music and effects share a changed musical grid without rounding visual events', () => folder(async destination => {
  const bpm=132, scale=108/bpm;
  const result=await buildAudio({destination, events:events.map(e=>({...e,time:e.time*scale})), duration:32*60/bpm,bpm});
  assert.equal(result.music.playbackRate,bpm/108);
  assert.equal(result.music.duration,32*60/bpm);
  assert.equal(result.clips.find(c=>c.eventId==='scan-one').start,3.125*scale);
  assert.ok(Math.abs(result.music.sourceDuration/result.music.playbackRate-result.duration)<1/48000);
}));

test('target mapping, gain, mute and music mute do not shift any remaining event', () => folder(async destination => {
  const kit={gain:.5,musicMute:true,mapping:{'document.scanned':false},targets:{'document:one':{gain:.5,mapping:{'document.sorted':{sound:'pop',gain:.8}}},scanner:{mute:true}}};
  const result=await buildAudio({destination,events,duration:32*60/108,bpm:108,kit});
  assert.equal(result.music,null);
  assert.deepEqual(result.mutedEvents,['scan-one','scan-start']);
  const sorted=result.clips.find(c=>c.eventId==='sorted-one');
  assert.equal(sorted.sound,'pop');
  assert.equal(sorted.gain,.2);
  assert.equal(sorted.start,7.625);
  const muted=await buildAudio({destination:path.join(destination,'muted'),events,duration:32*60/108,bpm:108,kit:{mute:true}});
  assert.deepEqual(muted.clips,[]);
  assert.equal(muted.music,null);
  assert.equal(muted.mutedEvents.length,events.length);
}));

test('bad sound options and unused target controls fail rather than disappear', () => folder(async destination => {
  for(const bad of [{extra:true},{gain:NaN},{musicGain:2},{mute:1},{mapping:{typo:'tick'}},{mapping:{'scan.start':'missing'}},{targets:{scanner:{mapping:{'scan.start':{unknown:true}}}}}]) assert.throws(()=>validateSound(bad));
  await assert.rejects(buildAudio({destination,events,duration:32*60/108,bpm:108,kit:{targets:{misspelled:{mute:true}}}}),/no event has this target/);
  await assert.rejects(buildAudio({destination,events:[...events,events[0]],duration:32*60/108,bpm:108}),/unique safe event id/);
  await assert.rejects(buildAudio({destination,events:[{id:'late',time:1.9,kind:'cta.reveal',target:'cta'}],duration:2,bpm:108,kit:{musicMute:true}}),/tail exceeds/);
}));
