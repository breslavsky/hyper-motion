// Portable projects carry a byte-identical copy of the canonical component.
// Edit components/lens-wall, then run this tool.
const fs = require('node:fs');
const path = require('node:path');
const canonical = path.resolve(__dirname, '../../components/lens-wall');
const destination = path.resolve(__dirname, '../source/lib/components/lens-wall');
const files = Object.freeze(['wall.mjs', 'SOURCE.json']);
function syncLensWall() {
  for (const file of files) {
    const target = path.join(destination, file), bytes = fs.readFileSync(path.join(canonical, file));
    fs.mkdirSync(path.dirname(target), {recursive:true});
    if (!fs.existsSync(target) || !fs.readFileSync(target).equals(bytes)) fs.writeFileSync(target, bytes);
  }
  return destination;
}
module.exports = {canonical, destination, files, syncLensWall};
if (require.main === module) console.log(syncLensWall());
