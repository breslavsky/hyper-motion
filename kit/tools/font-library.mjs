// The families a film may name in brand.font besides the kit's own four: copied from a font
// library (a folder per family with its faces and a catalog.json, as fonts/ of the Motion Fab
// harness is built from Google Fonts), with one @font-face per face in lib/fonts.css and the
// list in lib/fonts/library.json, which film.cjs, the guide and the Storybook read.
//   node kit/tools/font-library.mjs <font library folder>        copy the families named below
//   node kit/tools/font-library.mjs --check                      the files and the CSS match the list
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const lib = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../source/lib');
const listFile = path.join(lib, 'fonts/library.json'), cssFile = path.join(lib, 'fonts.css');
const FAMILIES = ['onest', 'manrope', 'unbounded', 'oswald', 'tektur', 'rubik', 'russo-one', 'yeseva-one', 'gloock', 'caveat', 'jetbrains-mono', 'press-start-2p'];
const START = '/* library:start (written by tools/font-library.mjs from fonts/library.json; do not edit) */', END = '/* library:end */';
const sum = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const css = list => [START, ...list.families.flatMap(family => family.faces.map(face =>
  `@font-face {\n\tfont-family: ${JSON.stringify(family.family)};\n\tsrc: url("fonts/${face.file}") format("woff2");\n\tfont-weight: ${face.weight};\n\tfont-style: ${face.style};\n\tfont-display: block;\n\tunicode-range: ${face.unicodeRange};\n}`)), END].join('\n');

if (process.argv[2] === '--check') {
  const list = JSON.parse(fs.readFileSync(listFile, 'utf8')), problems = [];
  for (const family of list.families) for (const face of family.faces) {
    const file = path.join(lib, 'fonts', face.file);
    if (!fs.existsSync(file)) problems.push(`${face.file} is missing`); else if (sum(file) !== face.sha256) problems.push(`${face.file} differs from the list`);
  }
  for (const family of list.families) if (!fs.existsSync(path.join(lib, 'fonts', family.licenseFile))) problems.push(`${family.licenseFile} is missing`);
  if (!fs.readFileSync(cssFile, 'utf8').includes(css(list))) problems.push('lib/fonts.css does not carry the list: run the tool again');
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  console.log(`${list.families.length} library families, ${list.families.reduce((n, family) => n + family.faces.length, 0)} faces`);
} else {
  const from = path.resolve(process.argv[2] ?? ''), catalog = JSON.parse(fs.readFileSync(path.join(from, 'catalog.json'), 'utf8'));
  const list = {note: 'Families of the font library a film may name in brand.font, with their faces; written by tools/font-library.mjs.', source: catalog.source, built: catalog.built, families: FAMILIES.map(id => {
    const family = catalog.families.find(entry => entry.id === id);
    if (!family) throw new Error(`The font library has no family ${id}`);
    if (!/^OFL/.test(family.license)) throw new Error(`${family.family}: ${family.license} is not a licence the kit takes`);
    // Upright faces only: a film's display type has no italic of its own.
    const faces = family.faces.filter(face => face.style === 'normal').map(face => {
      const file = path.join(from, id, face.file);
      if (sum(file) !== face.sha256) throw new Error(`${face.file} differs from its catalogue`);
      fs.copyFileSync(file, path.join(lib, 'fonts', face.file));
      return {subset: face.subset, style: face.style, weight: face.weight, unicodeRange: face.unicodeRange, file: face.file, bytes: face.bytes, sha256: face.sha256};
    });
    // The licence travels with the files, as it asks.
    fs.copyFileSync(path.join(from, id, 'OFL.txt'), path.join(lib, 'fonts', `OFL-${id}.txt`));
    return {id, family: family.family, role: family.role, tags: family.tags, note: family.note, scripts: family.scripts, weights: family.weights, license: family.license, licenseFile: `OFL-${id}.txt`, version: family.version, designers: family.designers, faces};
  })};
  fs.writeFileSync(listFile, JSON.stringify(list, null, 1) + '\n');
  const text = fs.readFileSync(cssFile, 'utf8'), at = text.indexOf(START), end = text.indexOf(END);
  fs.writeFileSync(cssFile, (at < 0 ? text.trimEnd() + '\n' : text.slice(0, at)) + css(list) + (at < 0 ? '\n' : text.slice(end + END.length)));
  const bytes = list.families.reduce((n, family) => n + family.faces.reduce((m, face) => m + face.bytes, 0), 0);
  console.log(`${list.families.length} families, ${Math.round(bytes / 1024)} KB: ${list.families.map(family => family.family).join(', ')}`);
}
