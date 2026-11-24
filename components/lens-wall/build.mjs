#!/usr/bin/env node
// Lens Wall as a native HyperFrames composition, built from a short recipe.
//
//   node <kit>/build.mjs recipe.json     (or "-" to read the recipe from stdin)
//
// run in the project's source folder, where its index.html is. It writes
// compositions/lw-<id>.html and prints what to put on the page: the host
// element, how long the scene is, where the camera stops and the moments a
// soundtrack can mark. A wall with fewer than seven files of the film's is
// filled with the wall's own example videos, loaded from their public address. Nothing is written for a recipe it refuses: the
// errors go to stderr. USAGE.md says what a recipe holds.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {plan, examplesFor, PUBLIC} from './wall.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll("'", '&#39;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const json = value => JSON.stringify(value).replaceAll('<', '\\u003c');
const time = value => Number(value.toFixed(3));

function inside(out, relative) {
  if (path.isAbsolute(relative) || relative.split(/[\\/]/).includes('..')) return false;
  return fs.existsSync(path.join(out, relative)) && fs.statSync(path.join(out, relative)).isFile();
}

// A video's length in seconds and its frame, or nothing where ffprobe is not installed.
function probe(file) {
  const run = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', file], {encoding: 'utf8'});
  try {
    const data = JSON.parse(run.stdout), stream = data.streams[0], seconds = Number(data.format.duration);
    return run.status === 0 && Number.isFinite(seconds) && stream.width > 0 ? {seconds, size: [stream.width, stream.height]} : null;
  } catch { return null; }
}

export function buildWall(recipe, out = process.cwd()) {
  // The film's own files first, the wall's examples in the places they leave.
  const given = Array.isArray(recipe?.media) ? recipe.media : recipe?.media === undefined ? [] : null;
  const added = given ? examplesFor(given.length) : [];
  const planned = plan(given ? {...recipe, media: [...given, ...added]} : recipe);
  if (planned.errors) return {errors: planned.errors};
  const {spec} = planned;
  const errors = [];
  const kit = path.relative(out, HERE).split(path.sep).join('/') || '.';
  if (kit.startsWith('..')) return {errors: [`the kit (${HERE}) must be inside the folder the page is in (${out})`]};

  spec.media.forEach((item, index) => {
    if (!item.src.startsWith(`${PUBLIC}/`) && !inside(out, item.src)) errors.push(`media ${index + 1}: there is no file ${item.src} in this folder (paths start at the folder of index.html)`);
  });
  if (errors.length) return {errors};

  spec.media.forEach((item, index) => {
    if (item.kind !== 'video' || item.src.startsWith(`${PUBLIC}/`)) return;
    const known = probe(path.join(out, item.src));
    if (!known) return;
    item.size = known.size;
    for (const [number, stop] of spec.stops.entries()) {
      if (stop.media !== index || !stop.open) continue;
      if (item.from + stop.open > known.seconds + .05) {
        errors.push(`stop ${number + 1} keeps ${item.src} open for ${stop.open} s from its second ${item.from}, but the video is ${time(known.seconds)} s long: shorten "open" or lower "from"`);
      }
    }
  });
  if (errors.length) return {errors};

  const {id, width, height, duration} = spec;
  const definitionId = `lw-${id}`, file = `compositions/${definitionId}.html`;
  const tall = height / width > 1.5;
  const short = Math.min(width, height);
  const pad = Math.round(width * .065);
  // The frame's own norms: body text, a tenth larger in a tall frame, above
  // what the app draws over the bottom of one.
  const captionSize = Math.round(52 * short / 1080 * (tall ? 1.1 : 1));
  const captionBottom = Math.round(height * (tall ? .31 : .07));
  const frames = [], captions = [];
  // A video plays in its tiles: the page declares one muted input for each,
  // which HyperFrames plays in a preview and decodes for a render.
  const inputs = spec.media.flatMap((item, index) => (item.kind !== 'video' ? [] : [
    `<video id="${definitionId}-in-${index + 1}" data-lens-input="${index}" class="clip" data-start="0" data-duration="${duration}" data-track-index="${2 + index}" data-volume="0"${item.from ? ` data-media-start="${item.from}"` : ''} muted playsinline loop preload="auto" src="${escape(item.src)}" style="position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover"></video>`]));
  spec.stops.forEach((stop, index) => {
    if (!stop.open) return;
    const item = spec.media[stop.media];
    const fill = 'position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;display:block';
    const begin = time(stop.at + stop.hold);
    const inner = item.kind === 'video'
      ? `<video id="${definitionId}-clip-${index + 1}" class="clip" data-start="${begin}" data-duration="${time(stop.open)}" data-track-index="1" data-hf-media-start-basis="local"${item.from ? ` data-media-start="${item.from}"` : ''} ${stop.sound ? 'playsinline data-has-audio="true"' : 'muted playsinline'} src="${escape(item.src)}" style="${fill}"></video>`
      : `<img src="${escape(item.src)}" alt="" style="${fill}">`;
    frames.push(`<div data-lens-open="${index}" style="position:absolute;overflow:hidden;visibility:hidden;background:${spec.background}">${inner}</div>`);
    if (stop.caption) captions.push(`<div data-lens-caption="${index}" style="position:absolute;left:0;bottom:0;display:inline-block;white-space:nowrap;opacity:0;font-size:${captionSize}px;line-height:1.15;font-weight:600;color:#fff;text-shadow:0 2px 18px rgba(0,0,0,.55),0 1px 3px rgba(0,0,0,.6)">${escape(stop.caption)}</div>`);
  });
  const html = `<!doctype html><html data-composition-id="${definitionId}" data-composition-duration="${duration}"><body><template>
<div id="${definitionId}-root" data-composition-id="${definitionId}" data-duration="${duration}" style="position:absolute;inset:0;overflow:hidden;background:${spec.background}">
<div id="${definitionId}-wall" class="clip" data-start="0" data-duration="${duration}" data-track-index="0" style="position:absolute;inset:0"><canvas data-lens-wall aria-label="A wall of pictures under a lens" style="position:absolute;left:0;top:0;width:${width}px;height:${height}px;display:block"></canvas></div>
${inputs.length ? `<div aria-hidden="true" style="position:absolute;inset:0;opacity:0;pointer-events:none">${inputs.join('\n')}</div>` : ''}
${frames.join('\n')}
<div style="position:absolute;left:${pad}px;right:${pad}px;bottom:${captionBottom}px;height:${Math.round(captionSize * 1.15)}px;pointer-events:none">${captions.join('')}</div>
<script>(function(){const root=document.getElementById(${json(`${definitionId}-root`)});const spec=${json(spec)};
const setup=import(${json(`./${kit}/wall.mjs`)}).then(({mount})=>mount(root,spec,window.gsap)).then(({timeline})=>{window.__timelines=window.__timelines||{};window.__timelines[${json(definitionId)}]=timeline;});
window.__hf=window.__hf||{};window.__hf.buildReady=window.__hf.buildReady||{};window.__hf.buildReady[${json(`lens-wall:${definitionId}`)}]=setup;
setup.catch(error=>{console.error('Lens Wall failed:',error);});})();</script>
</div></template></body></html>
`;
  fs.mkdirSync(path.join(out, 'compositions'), {recursive: true});
  fs.writeFileSync(path.join(out, file), html);

  const at = seconds => time(spec.start + seconds);
  const cues = [];
  const stops = spec.stops.map((stop, index) => {
    const item = spec.media[stop.media];
    cues.push({at: at(stop.at - stop.travel), kind: 'travel', length: stop.travel}, {at: at(stop.at), kind: 'arrive'});
    if (stop.open) {
      cues.push({at: at(stop.at + stop.hold), kind: 'open'});
      if (stop.close) cues.push({at: at(stop.end - Math.min(.45, stop.open / 2)), kind: 'close'});
    }
    return {stop: index + 1, src: item.src, arrives: at(stop.at),
      ...(stop.open ? {opens: at(stop.at + stop.hold), ...(stop.close ? {closes: at(stop.end)} : {staysOpen: true})} : {})};
  });
  return {
    file, duration,
    mount: `<div id="${id}" class="clip" data-composition-id="${id}" data-composition-src="${file}" data-start="${spec.start}" data-duration="${duration}" data-track-index="${spec.track}" data-track-kind="graphics" data-width="${width}" data-height="${height}" style="position:absolute;inset:0;z-index:${spec.track}"></div>`,
    examples: added,
    stops, cues,
  };
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) { process.stderr.write('usage: node build.mjs <recipe.json | ->\n'); process.exit(2); }
  let recipe;
  try { recipe = JSON.parse(fs.readFileSync(file === '-' ? 0 : file, 'utf8')); }
  catch (error) { process.stderr.write(`${file}: ${error.message}\n`); process.exit(2); }
  const result = buildWall(recipe);
  if (result.errors) { process.stderr.write(result.errors.map(line => `${line}\n`).join('')); process.exit(1); }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
