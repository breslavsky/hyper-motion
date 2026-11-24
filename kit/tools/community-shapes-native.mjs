// Native clocks, reverse state, readable type and safe layout for community shape/type components.
// node tools/community-shapes-native.mjs [--out /path/to/results]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createNativeBrowser, sharp} from './native-browser.mjs';

const args = process.argv.slice(2), outAt = args.indexOf('--out');
if (outAt >= 0 && (!args[outAt + 1] || args[outAt + 1].startsWith('--'))) throw new Error('--out requires a directory');
if (args.length && (args.length !== 2 || outAt !== 0)) throw new Error('Usage: community-shapes-native.mjs [--out directory]');
const out = path.resolve(outAt >= 0 ? args[outAt + 1] : path.join(os.tmpdir(), 'pk-community-shapes'));
fs.mkdirSync(out, {recursive: true});
const cases = [];
for (const aspect of ['9:16', '16:9', '1:1']) {
  cases.push({id: `polar-${aspect.replace(':', 'x')}`, aspect, scene: {type: 'polar', beats: 4, label: 'Made to adapt'}});
  cases.push({id: `letterflip-${aspect.replace(':', 'x')}`, aspect, scene: {type: 'letterflip', beats: 4, text: 'A fresh turn'}});
}
cases.push({id: 'unicode', aspect: '9:16', scene: {type: 'letterflip', beats: 3, text: 'Go 👩‍💻 café'}, font: 'Geist Mono'});
cases.push({id: 'arabic', aspect: '1:1', scene: {type: 'letterflip', beats: 4, text: 'مرحبا بالعالم'}});
cases.push({id: 'polar-min', aspect: '9:16', scene: {type: 'polar', beats: 3, shapes: ['square', 'circle'], satellites: false}});
cases.push({id: 'polar-max', aspect: '16:9', scene: {type: 'polar', beats: 5, shapes: ['circle', 'square', 'star', 'triangle', 'circle'], label: 'A shape for every idea'}, font: 'Geist Mono'});

const lettersOnly = text => String(text).normalize('NFC').replace(/[^\p{L}\p{N}\p{M}]/gu, '');
const fractions = [0, 0.08, 0.18, 0.3, 0.47, 0.72, 0.92];
const browser = await createNativeBrowser(), results = [], tiles = [];
let sourceReceipt;
try {
  const page = await browser.newPage();
  sourceReceipt = page.sourceHashes;
  const read = () => page.evaluate(() => Object.values(window.__pkScenes).map(instance => ({
    dom: instance.sceneRoot.outerHTML,
    boxes: instance.textBoxes(),
    time: instance.localTime,
    fit: instance.fitted,
    floor: instance.context.K.type.label,
    safe: {
      left: instance.plan.width * instance.plan.safe.left,
      right: instance.plan.width * (1 - instance.plan.safe.right),
      top: instance.plan.height * instance.plan.safe.top,
      bottom: instance.plan.height * (1 - instance.plan.safe.bottom),
    },
    pose: instance.ps.scene.type === 'letterflip' ? [...instance.sceneRoot.querySelectorAll('.glyph')].map(node => ({
      text: node.textContent, transform: node.style.transform, visible: node.style.visibility,
      origin: node.style.transformOrigin, localBox: [node.offsetLeft,node.offsetTop,node.offsetWidth,node.offsetHeight],
      movingProjection: node.hasAttribute('data-layout-allow-orbit'),
    })) : null,
    emojiCount: instance.sceneRoot.querySelectorAll('.emoji svg').length,
  })));
  for (const entry of cases) {
    const issues = [], states = [], stableChecks = [];
    const played = await page.play({aspect: entry.aspect, style: 'editorial', brand: {name: 'Nook', ...(entry.font ? {font: entry.font} : {})}, scenes: [entry.scene]});
    const duration = played.plan.scenes[0].dur, times = fractions.map(fraction => fraction * duration);
    for (const [index, time] of times.entries()) {
      await page.shoot(time);
      const state = await read();
      states.push(state);
      if (state.length !== 1) issues.push(`Expected one native instance, found ${state.length}`);
      if (Math.abs(state[0].time - time) > 1e-7) issues.push(`Native clock differs at ${time}`);
      if (state[0].pose) for (const [glyphIndex,glyph] of state[0].pose.entries()) {
        if (glyph.origin !== '50% 50%' || !glyph.movingProjection) issues.push(`3D glyph pivot or camera intent differs at ${time}`);
        if (JSON.stringify(glyph.localBox) !== JSON.stringify(states[0][0].pose[glyphIndex].localBox)) issues.push(`Glyph local pivot moves during flip at ${time}`);
      }
      if (fractions[index] < 0.7) continue;
      const {boxes, floor, safe} = state[0], expected = entry.scene.text ?? entry.scene.label ?? '';
      const minimumFont = boxes.length ? Math.min(...boxes.map(box => box.size)) : null;
      const minimumRenderedFont = boxes.length ? Math.min(...boxes.map(box => box.line / 1.2)) : null;
      if (expected && !boxes.length) issues.push(`No visible text at stable time ${time}`);
      if (lettersOnly(boxes.map(box => box.text).join('')) !== lettersOnly(expected)) issues.push(`Content differs at stable time ${time}`);
      for (const box of boxes) {
        if (!Number.isFinite(box.size) || box.size < floor - 0.01) issues.push(`Font ${box.size} below K.type.label ${floor} at ${time}`);
        if (box.line / 1.2 < floor - 0.01) issues.push(`Rendered font ${box.line / 1.2} below K.type.label ${floor} at ${time}`);
        if (box.x < safe.left - 1 || box.x + box.w > safe.right + 1 || box.y < safe.top - 1 || box.y + box.h > safe.bottom + 1) issues.push(`Unsafe stable text ${JSON.stringify(box.text)} at ${time}`);
        if (box.seen < 0.99 || box.opacity < 0.99) issues.push(`Clipped or faded stable text ${JSON.stringify(box.text)} at ${time}`);
      }
      if (state[0].pose?.some(glyph => glyph.visible !== 'visible' || !/^rotateY\(0(?:\.0+)?deg\)$/.test(glyph.transform))) issues.push(`Letter did not land flat at ${time}`);
      if (entry.id === 'unicode' && state[0].emojiCount !== 1) issues.push('The joined emoji must remain one bundled SVG');
      stableChecks.push({time, minimumFont, minimumRenderedFont, floor, safe, textCount: boxes.length});
    }
    for (let index = times.length - 1; index >= 0; index--) {
      await page.shoot(times[index]);
      if (JSON.stringify(await read()) !== JSON.stringify(states[index])) issues.push(`Reverse DOM/geometry/clock differs at ${times[index]}`);
    }
    issues.push(...page.errors, ...page.externalRequests.map(url => `External request: ${url}`));
    await page.shoot(duration * 0.28);
    const picture = await page.screenshot({type: 'png'});
    fs.writeFileSync(path.join(out, `${entry.id}.png`), picture);
    tiles.push(await sharp(picture).resize(300, 300, {fit: 'contain', background: '#222'}).png().toBuffer());
    results.push({id: entry.id, aspect: entry.aspect, scene: entry.scene, font: entry.font ?? null, ok: !issues.length, issues, times, stableChecks, fit: states.at(-1)[0].fit, finalPose: states.at(-1)[0].pose});
    console.log(`${entry.id}: ${issues.length ? `FAIL ${issues.join('; ')}` : 'PASS'}`);
  }
  await sharp({create: {width: 1500, height: 600, channels: 3, background: '#222'}})
    .composite(tiles.map((input, i) => ({input, left: i % 5 * 300, top: Math.floor(i / 5) * 300})))
    .jpeg({quality: 90}).toFile(path.join(out, 'sheet.jpg'));
} finally {
  await browser.close();
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({sourceReceipt, checks: ['native clock', 'exact reverse DOM/geometry/clock', 'stable content', 'K.type.label declared and rendered font floor', 'stable safe bounds and clipping', 'flat letter landing', 'joined emoji SVG', 'no external requests'], results}, null, 2));
}
if (results.length !== cases.length || results.some(result => !result.ok)) process.exitCode = 1;
