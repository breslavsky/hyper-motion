// Preview may reduce the cost of the optical world. Compare the actual painted
// letters in the composite at the same instant and camera pose at both scales.
import assert from 'node:assert/strict';
import {createNativeBrowser, sharp} from './native-browser.mjs';
import catalog from '../source/lib/components/catalog.mjs';
import {arrowElbowDownLeftBold, checkBold, circleNotchBold, magnifyingGlassBold} from '../source/lib/components/upstream/phosphor-icons/search-icons.mjs';

const fixtures = [
  {scene: {type: 'island', title: 'Upcoming classes', camera: 'orbit', beats: 6},
    probes: [[.48, '.pk-glass-heading']]},
  {scene: {type: 'controls', toggles: ['Weekly updates', 'Reminders'], slider: 'Volume', beats: 6},
    probes: [[.48, '.pk-glass-control-label'], [.78, '.pk-glass-slider-row .pk-glass-control-label']]},
  {scene: {type: 'glass-steps', title: 'How it works', items: ['Upload your footage', 'Pick a style', 'Export in 4K'], beats: 6},
    probes: [[.48, '.pk-glass-heading'], [.8, '.pk-glass-step-text']]},
  {scene: {type: 'glass-checklist', title: 'Launch checklist', items: ['Brief approved', 'Footage uploaded', 'Captions checked'], beats: 8},
    probes: [[.48, '.pk-glass-heading'], [.8, '.pk-glass-check-text']]},
  {scene: {type: 'glass-like', text: 'Like', after: 'Liked', beats: 6},
    probes: [[.25, '.pk-glass-like-label']]},
  {scene: {type: 'ask', text: 'Find my next class', reply: 'Tuesday is confirmed.', beats: 6},
    probes: [[.35, '.pk-glass-ask-prompt'], [.85, '.pk-glass-ask-reply']]},
  {scene: {type: 'search', query: 'Thursday workshops', beats: 6, timing: {focus: .5, type: 1, typed: 3, search: 4, collapse: 5, collapsed: 5.7, checked: 5.9}},
    // Between the two click ripples, while the page's own text is what shows.
    probes: [[.6, '.pk-glass-search-query']]},
  {scene: {type: 'glass-flow', title: 'First message', nextTitle: 'Next message', beats: 16},
    probes: [[.32, '[data-glass-surface="0"] .pk-glass-heading'], [.88, '[data-glass-surface="1"] .pk-glass-heading']]},
  {scene: {type: 'widgets', items: [{label: 'Bookings', value: '12'}, {label: 'Reviews', value: '24'}], beats: 4},
    probes: [[.45, '[data-design-role="label"]']]},
  {scene: {type: 'sheet', title: 'Book a class', rows: ['Pick a time', 'Confirm booking'], cta: 'Confirm', beats: 5},
    probes: [[.55, '[data-design-role="body"]']]},
  {scene: {type: 'lens', text: 'Read every letter clearly', sub: 'Optical clarity', camera: 'orbit', beats: 6},
    probes: [[.1, '.pk-glass-lens-source'], [.525, '.pk-glass-lens-source'], [.955, '.pk-glass-lens-caption'], [.525, '.pk-glass-lens-source']]},
];
// send-prompt has its own button, wave and chip pixel comparisons in this pytest suite.
const covered = [...fixtures.map(({scene}) => scene.type), 'send-prompt'].sort();
assert.deepEqual(covered, Object.keys(catalog).filter(type => catalog[type].family === 'glass').sort(), 'Add a pixel probe for each glass component');
const film = {aspect: '16:9', style: 'glass', grain: false, sparks: false,
  brand: {name: 'Focus', tokens: {background: '#131924', foreground: '#ffffff', accent: '#285386'}},
  scenes: fixtures.map(({scene}) => ({...scene, in: 'cut'}))};

// The search action is a glyph printed on the pane, with no lens of its own.
// Its flat hover disc is there only while the field is whole.
async function checkHoverDisc(page, id, expected) {
  const {lens, disc} = await page.evaluate(id => {
    const {scene} = window.__pkScenes[id].context.K.glass.inspect();
    const backing = scene.getObjectByName('search-backing');
    return {lens: Boolean(scene.getObjectByName('search-lens')), disc: backing.visible ? backing.material.opacity : 0};
  }, id);
  assert.equal(lens, false, 'The search action has a plain face without a lens');
  if (expected) assert.ok(disc > .05 && disc < .5, 'A soft disc lies under the pointer over the button: ' + disc);
  else assert.equal(disc, 0, 'No flat disc lies on the field away from the pointer or on the folded button');
}

// The Enter glyph is the foreground ink of the leading magnifier. Whatever
// the button draws stays inside the circle of its slot.
async function checkInlineSearchInk(page, id, hex, {solid}) {
  const proof = await page.evaluate((id, hex) => {
    const {context, sceneRoot} = window.__pkScenes[id], world = context.K.glass;
    const field = sceneRoot.querySelector('.pk-glass-search-field').getBoundingClientRect();
    const slot = sceneRoot.querySelector('.pk-glass-search-button').getBoundingClientRect();
    const leading = sceneRoot.querySelector('.pk-glass-search-icon').getBoundingClientRect();
    const {scene, render} = world.inspect(), button = scene.getObjectByName('search-button');
    const canvas = world.canvas, frame = canvas.getBoundingClientRect(), scale = canvas.width / frame.width;
    const x = Math.floor((slot.left - frame.left) * scale) - 2, y = Math.floor((slot.top - frame.top) * scale) - 2;
    const w = Math.ceil(slot.width * scale) + 4, h = Math.ceil(slot.height * scale) + 4;
    const cx = (slot.left + slot.width / 2 - frame.left) * scale - x;
    const cy = (slot.top + slot.height / 2 - frame.top) * scale - y;
    const read = () => canvas.getContext('2d').getImageData(x, y, w, h).data;
    const actual = read(), visible = button.visible;
    let background;
    try { button.visible = false; render(); background = read(); }
    finally { button.visible = visible; render(); }
    const color = hex.slice(1).match(/../g).map(channel => parseInt(channel, 16)), size = leading.width * scale;
    const reach = Math.min(w, h) / 2;
    let outside = 0, accentInk = 0, solidInk = 0, extent = 0;
    for (let i = 0; i < actual.length; i += 4) {
      if (color.every((_, c) => Math.abs(actual[i + c] - background[i + c]) <= 3)) continue;
      const dx = (i / 4) % w + .5 - cx, dy = Math.floor(i / 4 / w) + .5 - cy;
      const error = Math.max(...color.map((v, c) => Math.abs(actual[i + c] - v)));
      if (Math.hypot(dx, dy) > reach) outside++;
      extent = Math.max(extent, Math.max(Math.abs(dx), Math.abs(dy)));
      const glassDistance = Math.max(...color.map((v, c) => Math.abs(background[i + c] - v)));
      // A thin stroke at half the preview resolution has no pixel of pure ink.
      if (error <= 40) solidInk++;
      // At rest the glyph is blended two thirds of the way to its ink.
      if (error <= 4 + .40 * glassDistance) accentInk++;
    }
    const insetDelta = (field.right - slot.left - slot.width / 2) - (leading.left + leading.width / 2 - field.left);
    return {outside, accentInk, solidInk, extent, size, insetDelta};
  }, id, hex);
  assert.ok(Math.abs(proof.insetDelta) < 2, 'The two inline icons share the same horizontal inset');
  assert.equal(proof.outside, 0, 'The button must not draw outside the circle of its slot');
  assert.ok(proof.accentInk > 8, 'The inline glyph must be drawn in the ' + hex + ' ink of the magnifier: ' + JSON.stringify(proof));
  if (solid) {
    assert.ok(proof.extent > proof.size * .30, 'The inline action must use the same icon scale as the magnifier: ' + JSON.stringify(proof));
    assert.ok(proof.solidInk > 0, 'Under the pointer the glyph has a solid ' + hex + ' core: ' + JSON.stringify(proof));
  }
}

// While a ripple runs the glass carries a picture of the field's lettering
// and the page's own copy is unseen. The two must be the same text in the same
// place: put the page's copy back at the same instant and compare.
async function checkCarriedText(page, id) {
  const clip = await page.evaluate(id => {
    const {sceneRoot, context} = window.__pkScenes[id];
    if (context.K.glass.canvas.dataset.glassRipple !== 'slab') return null;
    const field = sceneRoot.querySelector('.pk-glass-search-field').getBoundingClientRect();
    // The ring has only left the button; the lettering to its left lies flat.
    return {x: Math.round(field.x), y: Math.round(field.y), width: Math.round(field.width * .6), height: Math.round(field.height)};
  }, id);
  if (!clip) return;
  const carried = await page.screenshot({clip});
  await page.evaluate(id => {
    const {sceneRoot, context} = window.__pkScenes[id], {scene, render} = context.K.glass.inspect();
    scene.getObjectByName('liquid-slab').material.uniforms.uInked.value = 0;
    for (const part of sceneRoot.querySelectorAll('.pk-glass-search-input,.pk-glass-search-icon')) part.style.filter = 'none';
    render();
  }, id);
  const own = await page.screenshot({clip});
  const [a, b] = await Promise.all([carried, own].map(image => sharp(image).greyscale().raw().toBuffer()));
  let ink = 0, differ = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] <= 200 && b[i] <= 200) continue;
    ink++;
    if (Math.abs(a[i] - b[i]) > 80) differ++;
  }
  assert.ok(ink > 500, 'The field shows its lettering during the ripple: ' + ink);
  assert.ok(differ < ink * .12, `The glass must carry the page's own text in its own place: ${differ} of ${ink} bright pixels differ`);
}

async function checkSearch(page, id, ps) {
  const beat = ps.dur / ps.scene.beats, {timing, query} = ps.scene;
  async function checkFace(expectedIcon) {
    const match = await page.evaluate((id, svg) => {
      const {scene} = window.__pkScenes[id].context.K.glass.inspect();
      const canvas = scene.getObjectByName('search-face').material.map.image;
      const ctx = canvas.getContext('2d');
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const path = new Path2D(new DOMParser().parseFromString(svg, 'image/svg+xml').querySelector('path').getAttribute('d'));
      let ink = 0, differences = 0;
      for (let y = 2; y < canvas.height; y += 4) {
        for (let x = 2; x < canvas.width; x += 4) {
          const i = 4 * (y * canvas.width + x);
          const printed = pixels[i + 3] > 127;
          if (printed) ink++;
          if (printed !== ctx.isPointInPath(path, x + .5, y + .5)) differences++;
        }
      }
      return {ink, differences};
    }, id, expectedIcon);
    assert.ok(match.ink > 80 && match.differences < .1 * match.ink, 'Unexpected printed search glyph: ' + JSON.stringify(match));
  }
  async function frame(at) {
    await page.shoot(ps.start + at * beat);
    return page.evaluate(id => {
      const root = window.__pkScenes[id].sceneRoot;
      const world = window.__pkScenes[id].context.K.glass;
      const slot = root.querySelector('.pk-glass-search-button'), field = root.querySelector('.pk-glass-search-field');
      const query = root.querySelector('.pk-glass-search-query'), pointer = root.querySelector('.pk-glass-search-pointer .cursor svg');
      const visible = [...query.querySelectorAll('[data-typing-unit]')].filter(glyph => getComputedStyle(glyph).visibility === 'visible');
      const tip = new DOMPoint(3, 2.5).matrixTransform(pointer.getScreenCTM());
      const box = slot.getBoundingClientRect(), fieldBox = field.getBoundingClientRect();
      const inputBox = root.querySelector('.pk-glass-search-input').getBoundingClientRect();
      const overInput = tip.x >= inputBox.left && tip.x <= inputBox.right && tip.y >= inputBox.top && tip.y <= inputBox.bottom;
      const buttonX = box.left + box.width / 2, buttonY = box.top + box.height / 2;
      const overButton = Math.hypot(tip.x - buttonX, tip.y - buttonY) <= Math.min(box.width, box.height) / 2;
      const {scene, camera} = world.inspect();
      const face = scene.getObjectByName('search-face'), group = face.parent.parent;
      // Glass traces its pane; smoked glass and metal draw it as polygons.
      const slab = group.getObjectByName('liquid-slab'), pane = slab ?? group.children.find(node => node.isMesh);
      const centre = face.localToWorld(face.position.clone().set(0, 0, 0)).project(camera);
      const panePoints = pane.geometry.attributes.position, vertex = pane.position.clone();
      let left = Infinity, right = -Infinity;
      if (slab) {
        const half = slab.material.uniforms.uHalf.value.x;
        left = slab.localToWorld(vertex.set(-half, 0, 0)).project(camera).x;
        right = slab.localToWorld(vertex.set(half, 0, 0)).project(camera).x;
      } else for (let index = 0; index < panePoints.count; index++) {
        pane.localToWorld(vertex.fromBufferAttribute(panePoints, index)).project(camera);
        left = Math.min(left, vertex.x);
        right = Math.max(right, vertex.x);
      }
      const visibleOnScreen = element => element.checkVisibility({opacityProperty: true, visibilityProperty: true});
      return {copy: visible.map(glyph => glyph.dataset.emoji ?? glyph.textContent).join(''), busy: slot.getAttribute('aria-busy'), label: slot.getAttribute('aria-label'), text: root.innerText,
        icon: face.material.map.uuid, angle: face.material.map.rotation, overInput, overButton,
        pointer: Number(getComputedStyle(root.querySelector('.pk-glass-search-pointer')).opacity),
        clickFromText: (tip.x - inputBox.left) / root.querySelector('.pk-glass-search-icon').getBoundingClientRect().width,
        pane: {left, right, visible: pane.visible}, centre: [centre.x, centre.y], faceVisible: face.visible && face.parent.visible,
        queryVisible: visibleOnScreen(query), magnifierVisible: visibleOnScreen(root.querySelector('.pk-glass-search-icon')),
        insets: [box.top - fieldBox.top, fieldBox.bottom - box.bottom, fieldBox.right - box.right],
        textGap: box.left - inputBox.right, leadingIcon: root.querySelector('.pk-glass-search-icon path').getAttribute('d'),
        placeholder: root.querySelector('.pk-glass-search-placeholder').textContent};
    }, id);
  }
  const focus = await frame(timing.focus), partial = await frame((timing.type + timing.typed) / 2);
  assert.equal(focus.leadingIcon, magnifyingGlassBold.match(/<path d="([^"]+)"/)[1], 'The leading field icon is the magnifier');
  assert.equal(focus.placeholder, 'Search...');
  assert.equal(focus.copy, '');
  const tightest = Math.min(...focus.insets), widest = Math.max(...focus.insets);
  assert.ok(tightest > 0 && widest - tightest <= Math.max(2, widest * .15),
    'The button must sit inside the right end of the capsule with balanced top, bottom and right insets: ' + focus.insets);
  assert.ok(focus.textGap > 0, 'The input viewport must end before the inset button');
  assert.ok(focus.overInput && !focus.overButton, 'The first click must focus the text area');
  assert.ok(focus.clickFromText >= 0 && focus.clickFromText < 1, 'The first click lands where the text begins, right after the magnifier: ' + focus.clickFromText);
  assert.equal(focus.pointer, 1);
  assert.equal(partial.pointer, 0, 'The pointer leaves while the query is typed');
  assert.ok(partial.copy && query.startsWith(partial.copy) && partial.copy !== query, 'Search types an actual prefix');
  const resting = await frame(timing.typed);
  await checkInlineSearchInk(page, id, film.brand.tokens.foreground, {solid: false});
  await checkHoverDisc(page, id, false);
  assert.ok(resting.pointer < .2, 'The pointer is still away as the last letter lands');
  const ready = await frame(timing.search - .05);
  assert.equal(ready.pointer, 1, 'The pointer returns on its way to the button');
  await checkInlineSearchInk(page, id, film.brand.tokens.foreground, {solid: true});
  await checkHoverDisc(page, id, true);
  await checkFace(arrowElbowDownLeftBold);
  assert.equal(ready.copy, query);
  assert.equal(ready.busy, 'false');
  const pressed = await frame(timing.search + .03);
  assert.ok(pressed.overButton && !pressed.overInput && pressed.busy === 'true', 'The cursor clicks the round button on the search beat');
  assert.notEqual(pressed.icon, ready.icon, 'The spinner replaces the Enter arrow');
  await frame(timing.search + .07 / beat);
  await checkCarriedText(page, id);
  await frame(timing.search + .03);
  await checkFace(circleNotchBold);
  const loading = await frame(timing.search + .6);
  await checkInlineSearchInk(page, id, film.brand.tokens.foreground, {solid: true});
  assert.equal(loading.copy, query);
  assert.equal(loading.text.trim(), query, 'The loading state contains only the submitted query');
  assert.notEqual(loading.angle, pressed.angle, 'The spinner advances on the scene clock');
  assert.deepEqual(await frame((timing.type + timing.typed) / 2), partial, 'Seeking back restores the input state');
  assert.deepEqual(await frame(timing.search + .6), loading, 'Seeking forward restores the exact spinner angle');

  const held = await frame(timing.collapse - .03), halfway = await frame((timing.collapse + timing.collapsed) / 2);
  const circle = await frame(timing.collapsed + .02), spinning = await frame(timing.checked - .03);
  const checked = await frame(timing.checked + .02), final = await frame(ps.scene.beats - .02);
  assert.deepEqual(held.pane, ready.pane, 'The full field must hold through the delay after the click');
  const span = held.pane.right - held.pane.left, middle = (held.pane.left + held.pane.right) / 2;
  assert.ok(halfway.pane.visible && halfway.pane.left > held.pane.left + span * .1 && halfway.pane.right < held.pane.right - span * .1,
    'Both ends move toward the middle during the collapse');
  assert.ok(Math.abs((halfway.pane.left + halfway.pane.right) / 2 - middle) < span * .01, 'The field folds around its middle');
  assert.ok(halfway.centre[0] < held.centre[0] - span * .05 && halfway.centre[0] > middle, 'The button travels toward the middle with the fold');
  for (const end of [circle, spinning, checked, final]) {
    assert.ok(end.faceVisible && end.pane.visible && !end.queryVisible && !end.magnifierVisible,
      'The folded pane stays as the body of the round button, without the query or the magnifier');
    assert.ok(end.pane.right - end.pane.left < span * .15, 'The pane has folded into a round button');
    assert.ok(Math.abs(end.centre[0] - middle) < .002 && Math.abs((end.pane.left + end.pane.right) / 2 - middle) < .002,
      'The round button rests in the middle of the field');
  }
  for (const state of [halfway, circle, spinning, checked, final]) {
    assert.ok(Math.abs(state.centre[1] - held.centre[1]) < .001, 'The button keeps its height');
  }
  assert.equal(spinning.busy, 'true');
  assert.notEqual(spinning.angle, circle.angle, 'Spinner keeps turning until the checked beat');
  assert.equal(checked.busy, 'false');
  assert.equal(checked.label, 'Search complete');
  assert.notEqual(checked.icon, spinning.icon, 'The checkmark replaces the spinner');
  assert.equal(final.icon, checked.icon);
  assert.equal(final.angle, checked.angle, 'The checkmark holds through the final frame');
  await checkFace(checkBold);
  await checkHoverDisc(page, id, false);
  assert.deepEqual(await frame(timing.checked - .03), spinning, 'Seeking back from completion restores the spinner');
  assert.deepEqual(await frame((timing.collapse + timing.collapsed) / 2), halfway, 'Seeking back restores the shrinking field');
  assert.deepEqual(await frame(timing.search + .6), loading, 'Seeking back restores the expanded field');

  // Hold the lights, camera, cursor and pressing depth fixed. Rotate only
  // the glyph, then compare the actual WebGL pixels on the button face.
  const ink = await page.evaluate(id => {
    const {sceneRoot, context} = window.__pkScenes[id], world = context.K.glass;
    const {scene, render} = world.inspect(), texture = scene.getObjectByName('search-face').material.map;
    const canvas = world.canvas, ctx = canvas.getContext('2d');
    const button = sceneRoot.querySelector('.pk-glass-search-button').getBoundingClientRect(), frame = canvas.getBoundingClientRect();
    const sx = canvas.width / frame.width, sy = canvas.height / frame.height;
    const x = Math.floor((button.left - frame.left) * sx), y = Math.floor((button.top - frame.top) * sy);
    const w = Math.ceil(button.width * sx), h = Math.ceil(button.height * sy);
    const read = () => ctx.getImageData(x - 4, y - 4, w + 8, h + 8).data;
    const actual = read(), angle = texture.rotation;
    let rotated;
    try { texture.rotation += Math.PI; render(); rotated = read(); }
    finally { texture.rotation = angle; render(); }
    let inside = 0, outside = 0;
    for (let i = 0; i < actual.length; i += 4) {
      const delta = Math.max(...[0, 1, 2].map(c => Math.abs(actual[i + c] - rotated[i + c])));
      if (delta <= 8) continue;
      const px = (i / 4) % (w + 8) - 4, py = Math.floor(i / 4 / (w + 8)) - 4;
      if (px >= 0 && px < w && py >= 0 && py < h) inside++; else outside++;
    }
    return {inside, outside};
  }, id);
  assert.ok(ink.inside > 5, 'The rotating spinner must change visible pixels inside the 3D button');
  assert.equal(ink.outside, 0, 'The spinner must respect the button bounds');
}

async function checkSearchPlaceholders(page) {
  const hints = [undefined, 'Find classes, instructors and workshops near you...', ''];
  const base = fixtures.find(({scene}) => scene.type === 'search').scene;
  const scenes = hints.map(placeholder => ({...base, in: 'cut', ...(placeholder === undefined ? {} : {placeholder})}));
  const {plan} = await page.play({...film, brand: {name: 'Focus'}, aspect: '9:16', scenes});
  for (const [index, ps] of plan.scenes.entries()) {
    const expected = hints[index] ?? 'Search...';
    const beat = ps.dur / ps.scene.beats, firstKey = ps.scene.timing.type;
    async function sample(at) {
      await page.shoot(ps.start + at * beat);
      return page.evaluate(id => {
        const field = window.__pkScenes[id].sceneRoot.querySelector('.pk-glass-search-field');
        const input = field.querySelector('[role="searchbox"]'), button = field.querySelector('[role="button"]');
        return {visibleText: input.innerText.trim(), accessibleHint: input.getAttribute('aria-placeholder'),
          clipsBeforeButton: getComputedStyle(input).overflowX === 'hidden' && input.getBoundingClientRect().right < button.getBoundingClientRect().left};
      }, 's' + (index + 1));
    }
    const idle = await sample(firstKey - .08);
    if (!index) await checkInlineSearchInk(page, 's1', '#ffffff', {solid: false});
    assert.equal(idle.visibleText, expected, 'The empty input must show the authored placeholder or its default');
    assert.equal(idle.accessibleHint, expected);
    assert.ok(idle.clipsBeforeButton, 'Long portrait hints must be clipped before the Enter button');
    assert.equal((await sample(firstKey + .04)).visibleText, base.query[0], 'The first typed letter replaces the placeholder');
    assert.deepEqual(await sample(firstKey - .08), idle, 'Seeking back before typing restores the placeholder');
    if (!index) {
      await sample(ps.scene.beats - .02);
      await checkHoverDisc(page, 's1', false);
    }
  }
  assert.deepEqual(page.errors, []);
}

function setStyle(page, id, selector, property, value) {
  return page.evaluate(({id, selector, property, value}) => {
    const style = window.__pkScenes[id].sceneRoot.querySelector(selector).style;
    const previous = style[property];
    style[property] = value;
    return previous;
  }, {id, selector, property, value});
}

async function measureInk(page, id, selector, previewScale) {
  const clip = await page.evaluate(({id, selector, previewScale}) => {
    const instance = window.__pkScenes[id], target = instance.sceneRoot.querySelector(selector);
    if (!target) throw new Error(id + ' has no sample for ' + selector);
    const world = instance.context.K.glass;
    if (world && world.audit().resolution.previewScale !== previewScale) throw new Error(id + ' is using the wrong preview scale');
    const range = document.createRange();
    range.selectNodeContents(target);
    const box = range.getBoundingClientRect();
    const x = Math.max(0, Math.floor(box.x) - 2), y = Math.max(0, Math.floor(box.y) - 2);
    let right = Math.min(innerWidth, Math.ceil(box.right) + 2);
    // Measure the exposed headline left of the moving glass, including after a reverse seek.
    if (instance.ps.scene.type === 'lens') {
      const {lens, camera} = world.inspect();
      if (lens.visible) {
        const mesh = lens.children.find(node => node.isMesh), vertices = mesh.geometry.attributes.position;
        const point = mesh.position.clone(), viewport = world.canvas.getBoundingClientRect();
        for (let i = 0; i < vertices.count; i++) {
          mesh.localToWorld(point.fromBufferAttribute(vertices, i)).project(camera);
          right = Math.min(right, Math.floor(viewport.x + (point.x + 1) * viewport.width / 2) - 3);
        }
      }
    }
    return {x, y, width: right - x,
      height: Math.min(innerHeight, Math.ceil(box.bottom) + 2) - y};
  }, {id, selector, previewScale});
  assert.ok(clip.width > 5 && clip.height > 5, id + ' missing projected letters in ' + selector);
  const capture = async () => sharp(await page.screenshot({type: 'png', clip})).greyscale().raw().toBuffer();
  const actual = await capture();
  const opacity = await setStyle(page, id, selector, 'opacity', '0');
  let background;
  try { background = await capture(); }
  finally { await setStyle(page, id, selector, 'opacity', opacity); }
  // Subtract the identical backdrop, including the glass rim and its highlights.
  // Normalize edge energy by ink intensity, so brightness does not imply sharpness.
  const ink = Float32Array.from(actual, (v, i) => v - background[i]);
  let visible = 0, energy = 0, contrast = 0;
  const {width, height} = clip;
  assert.equal(ink.length, width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      if (Math.abs(ink[i]) > 24) visible++;
      contrast += ink[i] ** 2;
      energy += (ink[i - 1] + ink[i + 1] + ink[i - width] + ink[i + width] - 4 * ink[i]) ** 2;
    }
  }
  assert.ok(visible > 100, id + ' has too little live foreground ink in ' + selector + ': ' + visible);
  return Math.sqrt(energy / contrast);
}

const browser = await createNativeBrowser(), page = await browser.newPage();
try {
  const reference = new Map();
  for (const previewScale of [1, .5]) {
    const {plan} = await page.play(film, {options: {previewScale}});
    for (const [index, {scene, probes}] of fixtures.entries()) {
      const ps = plan.scenes[index];
      if (scene.type === 'search') await checkSearch(page, 's' + (index + 1), ps);
      for (const [sampleIndex, [fraction, selector]] of probes.entries()) {
        await page.shoot(ps.start + ps.dur * fraction);
        const id = 's' + (index + 1), focus = await measureInk(page, id, selector, previewScale);
        const key = scene.type + ' ' + sampleIndex + ' at ' + fraction;
        if (previewScale === 1) reference.set(key, focus);
        else {
          const ratio = focus / reference.get(key);
          console.log(key, ratio);
          assert.ok(ratio >= .95 && ratio <= 1.05, key + ': preview/native glyph edge energy ' + ratio);
          if (scene.type === 'island') {
            // Calibrate the same pixel metric against a deliberately softened live heading.
            const filter = await setStyle(page, id, selector, 'filter', 'blur(2px)');
            try {
              const softened = await measureInk(page, id, selector, previewScale);
              assert.ok(softened / reference.get(key) < .90, 'A deliberately blurred heading escaped the pixel check');
            } finally { await setStyle(page, id, selector, 'filter', filter); }
          }
        }
      }
    }
    assert.deepEqual(page.errors, []);
  }
  await checkSearchPlaceholders(page);
} finally {
  await browser.close();
}
