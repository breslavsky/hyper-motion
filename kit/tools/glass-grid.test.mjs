// The Glass family's one grid: its tokens are steps of the design system, the
// panel's numbers are the card recipe's, and they scale with the frame.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createDesignSystem, RADIX_TOKENS, ROLE_STEPS} from '../source/lib/components/design-system.mjs';
import {SURFACE_RECIPES} from '../source/lib/components/surface-system.mjs';
import {createRequire} from 'node:module';
import {glassGrid, GLASS_UNITS, GLASS_TYPE, GLASS_TIME, GLASS_DENSITY, GLASS_PLACES, GLASS_SIZES, glassPlacement} from '../source/lib/components/glass/grid.mjs';

const frame = (W, H, safe = {}) => {
  const S = Math.min(W, H) / 1080, K = {W, H, S, type: {label: 36 * S}, plan: {safe}, safe: {x: W * .05, y: H * .05, w: W * .9, h: H * .9}};
  K.design = createDesignSystem(K);
  return K;
};

test('every length of the grid is a step of the design system', () => {
  const space = new Set(RADIX_TOKENS.space), radius = new Set(RADIX_TOKENS.radius);
  for (const value of [...Object.values(GLASS_UNITS.gap), GLASS_UNITS.row, GLASS_UNITS.mark.size, ...Object.values(GLASS_UNITS.move),
    GLASS_UNITS.card.paddingX, GLASS_UNITS.card.paddingY, GLASS_UNITS.card.gap]) assert.ok(space.has(value), `${value} is not a space step`);
  for (const value of [GLASS_UNITS.card.radius, GLASS_UNITS.mark.radius]) assert.ok(radius.has(value), `${value} is not a radius step`);
  assert.deepEqual(GLASS_UNITS.card, SURFACE_RECIPES.card.normal);
  assert.equal(GLASS_UNITS.icon, RADIX_TOKENS.fontSizes[ROLE_STEPS.cardTitle.steps[0] - 1]);
  // A box to tick is sized to the body text beside it: as tall as a line of
  // that text and smaller than a mark, its tick a size of the type ladder
  // between the text and the box, on the mark's stroke.
  const step = ROLE_STEPS[GLASS_TYPE.item.role].steps[0] - 1, body = RADIX_TOKENS.fontSizes[step];
  assert.equal(GLASS_UNITS.check.size, RADIX_TOKENS.lineHeights[step]);
  assert.ok(GLASS_UNITS.check.size < GLASS_UNITS.mark.size);
  assert.ok(RADIX_TOKENS.fontSizes.includes(GLASS_UNITS.check.glyph) && GLASS_UNITS.check.glyph > body && GLASS_UNITS.check.glyph < GLASS_UNITS.check.size);
  assert.ok(radius.has(GLASS_UNITS.check.radius));
  assert.equal(GLASS_UNITS.check.stroke, GLASS_UNITS.mark.stroke);
  assert.equal(GLASS_UNITS.row + GLASS_UNITS.gap.block, 44);
  for (const {role} of Object.values(GLASS_TYPE)) assert.ok(ROLE_STEPS[role], role);
  assert.ok(Object.isFrozen(GLASS_UNITS) && Object.isFrozen(GLASS_UNITS.gap) && Object.isFrozen(GLASS_TYPE) && Object.isFrozen(GLASS_TIME));
});

test('the grid scales with the frame and keeps its proportions', () => {
  const full = glassGrid(frame(1920, 1080)), half = glassGrid(frame(960, 540));
  assert.equal(full.unit, 3);
  assert.deepEqual([full.card.paddingX, full.card.gap, full.gap.column, full.row, full.mark.size, full.mark.radius, full.icon], [48, 36, 96, 96, 96, 24, 72]);
  assert.equal(full.mark.stroke, 4);
  assert.deepEqual([full.type.mark.size, full.type.mark.step, full.type.item.size], [60, 5, 48]);
  for (const key of ['row', 'icon', 'width', 'content']) assert.ok(Math.abs(full[key] / half[key] - 2) < 1e-9, key);
  assert.equal(full.content, full.width - 2 * full.card.paddingX);
  assert.ok(Math.abs(full.column(4) * 4 + full.gap.column * 3 - full.content) < 1e-9);
  assert.equal(full.beside(), full.content - full.mark.size - full.gap.group);
  assert.deepEqual([full.gap.group, full.gap.section], [48, 72]);
  // A dense panel has the same parts with every gap smaller, each still a token.
  const airy = full.density('airy'), dense = full.density('dense');
  assert.deepEqual(Object.keys(GLASS_DENSITY.airy), Object.keys(GLASS_DENSITY.dense));
  for (const part of Object.keys(airy)) assert.ok(dense[part] < airy[part], part);
  for (const token of [...Object.values(GLASS_DENSITY.airy), ...Object.values(GLASS_DENSITY.dense)]) assert.ok(token in GLASS_UNITS.gap, token);
  assert.deepEqual([airy.section, airy.rows, airy.columns, dense.section, dense.rows, dense.columns], [72, 48, 96, 36, 24, 72]);
  assert.equal(full.firstLine(full.type.item.lineHeight), (full.mark.size - full.type.item.lineHeight) / 2);
  assert.equal(full.type.item.height, full.type.item.lineHeight * 3);
});

test('a wide frame has columns, a square or tall one stacks, and 9:16 keeps a 7% inset', () => {
  assert.equal(glassGrid(frame(1920, 1080)).wide, true);
  assert.equal(glassGrid(frame(1080, 1080)).wide, false);
  const tall = glassGrid(frame(1080, 1920));
  assert.equal(tall.wide, false);
  assert.ok(Math.abs(tall.width - 1080 * .86) < 1e-9);
  assert.ok(Math.abs(glassGrid(frame(1080, 1920, {left: .1, right: .1})).width - 1080 * .8) < 1e-9);
});

test('a panel stands at one of nine places against the safe area, at one of two sizes', () => {
  const require = createRequire(import.meta.url);
  const definitions = require('../source/lib/components/metadata.cjs');
  // The film's field and the family's tokens name the same places and sizes.
  assert.deepEqual(definitions.island.fields.place.values, GLASS_PLACES);
  assert.deepEqual(definitions.island.fields.size.values, Object.keys(GLASS_SIZES));
  assert.equal(GLASS_PLACES.length, 9);
  assert.deepEqual(GLASS_SIZES, {normal: 1, small: .6});
  const placed = Object.keys(definitions).filter(type => definitions[type].fields?.place).sort();
  assert.deepEqual(placed, ['ask', 'controls', 'glass-checklist', 'glass-steps', 'island', 'search'], 'scenes that are one panel under a camera at rest');
  for (const type of ['widgets', 'sheet', 'lens', 'send-prompt', 'glass-flow']) assert.equal(definitions[type].fields.size, undefined, type);

  const K = frame(1920, 1080), box = {w: 1000, h: 400};
  assert.deepEqual(glassPlacement(K, {}, box), {place: 'middle', size: 'normal', scale: 1, dx: 0, dy: 0, width: 1000, height: 400});
  for (const place of GLASS_PLACES) for (const size of Object.keys(GLASS_SIZES)) {
    const at = glassPlacement(K, {place, size}, box), cx = K.W / 2 + at.dx, cy = K.H / 2 + at.dy;
    const left = cx - at.width / 2, right = cx + at.width / 2, top = cy - at.height / 2, bottom = cy + at.height / 2;
    assert.ok(left >= K.safe.x - 1e-9 && right <= K.safe.x + K.safe.w + 1e-9 && top >= K.safe.y - 1e-9 && bottom <= K.safe.y + K.safe.h + 1e-9, `${place} ${size} leaves the safe area`);
    if (place.endsWith('left')) assert.ok(Math.abs(left - K.safe.x) < 1e-9, place);
    if (place.endsWith('right')) assert.ok(Math.abs(right - K.safe.x - K.safe.w) < 1e-9, place);
    if (place.startsWith('top')) assert.ok(Math.abs(top - K.safe.y) < 1e-9, place);
    if (place.startsWith('bottom')) assert.ok(Math.abs(bottom - K.safe.y - K.safe.h) < 1e-9, place);
    assert.equal(at.scale, GLASS_SIZES[size]);
  }
  // Every placed scene's own sample is a film at every place and in both sizes:
  // a small panel is refused only by limits its scene has measured.
  const film = require('../source/lib/film.cjs');
  for (const [type, definition] of Object.entries(definitions)) {
    if (!definition.fields?.place) continue;
    for (const size of Object.keys(GLASS_SIZES)) for (const place of ['middle', 'bottom-right']) {
      const scene = {...definition.sample, place, size};
      assert.deepEqual(film.problems({aspect: '16:9', style: 'glass', brand: {name: 'Nook'}, scenes: [scene]}), [], `${type} ${size} ${place}`);
    }
  }
  // A panel as wide as the safe area cannot go left or right: it stays centred.
  assert.equal(glassPlacement(K, {place: 'left'}, {w: 1800, h: 400}).dx, 0);
  assert.throws(() => glassPlacement(K, {place: 'centre'}, box), /place must be one of/);
  assert.throws(() => glassPlacement(K, {size: 'tiny'}, box), /size must be one of/);
});
