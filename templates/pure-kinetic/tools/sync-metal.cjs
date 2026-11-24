// The canonical Metal material ships with portable Pure Kinetic projects.
const fs = require('node:fs');
const path = require('node:path');
const canonical = path.resolve(__dirname, '../../../runtimes/hyperframes/components/metal');
const destination = path.resolve(__dirname, '../source/lib/components/metal');
const files = Object.freeze(['metal.mjs', 'vendor/shaders.mjs', 'vendor/presets.mjs', 'vendor/METAL-LICENSE', 'vendor/PAPER-LICENSE', 'vendor/PAPER-NOTICE', 'vendor/NOTICE', 'vendor/SOURCE.json', 'vendor/INTEGRITY.json']);
function syncMetal() {
  for (const file of files) {
    const target = path.join(destination, file), bytes = fs.readFileSync(path.join(canonical, file));
    fs.mkdirSync(path.dirname(target), {recursive:true});
    if (!fs.existsSync(target) || !fs.readFileSync(target).equals(bytes)) fs.writeFileSync(target, bytes);
  }
  return destination;
}
module.exports = {canonical, destination, files, syncMetal};
if (require.main === module) console.log(syncMetal());
