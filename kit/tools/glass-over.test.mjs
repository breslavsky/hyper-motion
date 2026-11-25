// A Glass scene laid over the film's own footage: what the scene builder
// refuses before it writes anything.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {buildScene} = require('../source/lib/scene.cjs');
const recipe = (scene, track = 2) => ({id: 'like', aspect: '16:9', style: 'editorial', material: 'dark-glass', brand: {name: 'Nook'}, start: 1, track,
  scene: {type: 'glass-like', beats: 6, over: true, text: 'Like', ...scene}});
const page = video => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'pk-over-'));
  if (video !== null) fs.writeFileSync(path.join(folder, 'index.html'), `<div id="root">${video}</div>`);
  return folder;
};

test('a scene that looks at a clip needs that clip on the page, on a track under its own', () => {
  const clip = {background: {clip: 'footage'}};
  assert.match(buildScene(recipe(clip), page(null)).errors.join('\n'), /index\.html has no <video id="footage">/);
  assert.match(buildScene(recipe(clip), page('<video id="other" data-track-index="0"></video>')).errors.join('\n'), /has no <video id="footage">/);
  assert.match(buildScene(recipe(clip, 1), page('<video id="footage" class="clip" data-track-index="1"></video>')).errors.join('\n'), /put the scene on a track above it/);
  // With the clip in place the recipe is taken: what stops it here is only that this page has no kit beside it.
  const taken = buildScene(recipe(clip), page('<video class="clip" data-track-index="0" id="footage" src="a.mp4"></video>'));
  assert.match(taken.errors.join('\n'), /must be inside the folder the page is in/);
  // Without a clip the scene only frosts what is under it and asks nothing of the page.
  assert.match(buildScene(recipe({}), page(null)).errors.join('\n'), /must be inside the folder the page is in/);
});
