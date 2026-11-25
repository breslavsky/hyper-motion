// The Glass family's own ground: the colours of the `glass` look, used whatever
// the film's look is, unless somebody chose the scene's colours.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {GLASS_GROUND, glassGround, glassColoursChosen} from '../source/lib/components/glass/ground.mjs';

const require = createRequire(import.meta.url);
const {compile} = require('../source/lib/compiler/plan.cjs');
const definitions = require('../source/lib/components/metadata.cjs');
const film = (style, extra = {}) => compile({aspect: '16:9', style, brand: {name: 'Nook'}, scenes: [definitions['glass-island'].sample], ...extra});

test('the ground is the glass look\'s own first scene', () => {
  const plan = film('glass'), scene = plan.scenes[0];
  assert.deepEqual({bg: scene.bg, fg: scene.fg, accent: scene.accent, palette: plan.palette}, {...GLASS_GROUND, palette: {...GLASS_GROUND.palette}});
  assert.ok(Object.isFrozen(GLASS_GROUND) && Object.isFrozen(GLASS_GROUND.palette));
});

test('a film\'s look does not reach a Glass scene; chosen colours do', () => {
  for (const style of ['editorial', 'noir', 'frost', 'liquid', 'glass']) {
    const plan = film(style), ps = plan.scenes[0];
    const compiled = {palette: plan.palette, bg: ps.bg, fg: ps.fg, accent: ps.accent};
    // As the runtime mounts it: the host's style variable holds the compiled defaults.
    assert.equal(glassGround({scene: ps.scene, tokens: plan.brand?.tokens, style: compiled, compiled}), GLASS_GROUND, style);
    assert.equal(glassGround({scene: ps.scene, tokens: plan.brand?.tokens, style: {}, compiled}), GLASS_GROUND, style);
  }
  const scene = definitions['glass-island'].sample;
  assert.equal(glassGround({scene: {...scene, bg: '#ffffff'}}), null);
  assert.equal(glassGround({scene: {...scene, fg: '#000000'}}), null);
  for (const key of ['background', 'foreground', 'accent', 'accent2']) assert.equal(glassGround({scene, tokens: {[key]: '#123456'}}), null, key);
  assert.equal(glassGround({scene, tokens: {font: 'Inter'}}), GLASS_GROUND, 'a brand font is not a colour');
  assert.equal(glassColoursChosen({scene, style: {bg: '#101010'}, compiled: {bg: '#0b0a1a'}}), true, 'a style edited on the host is kept');
  // A photo or a video behind the glass does not choose the ink.
  assert.equal(glassGround({scene: {...scene, background: {video: 'assets/street.mp4'}}}), GLASS_GROUND);
});
