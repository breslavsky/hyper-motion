// Portable projects carry a byte-identical subset of the canonical runtime.
// Edit components/thinking-orbs, then run this tool.
const fs = require('node:fs');
const path = require('node:path');
const canonical = path.resolve(__dirname, '../../components/thinking-orbs');
const destination = path.resolve(__dirname, '../source/lib/components/thinking-orbs');
const files = Object.freeze(['orb.mjs', 'vendor/engine.es.js', 'vendor/index-B8WsUNf5.js', 'vendor/package.json', 'vendor/LICENSE', 'vendor/SOURCE.json', 'vendor/INTEGRITY.json']);
function syncThinkingOrbs() {
  for (const file of files) {
    const target = path.join(destination, file), bytes = fs.readFileSync(path.join(canonical, file));
    fs.mkdirSync(path.dirname(target), {recursive:true});
    if (!fs.existsSync(target) || !fs.readFileSync(target).equals(bytes)) fs.writeFileSync(target, bytes);
  }
  return destination;
}
module.exports = {canonical, destination, files, syncThinkingOrbs};
if (require.main === module) console.log(syncThinkingOrbs());
