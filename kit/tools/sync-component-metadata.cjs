// Browser metadata is generated from the one canonical CJS declaration.
const fs = require('node:fs');
const path = require('node:path');
function syncComponentMetadata(directory=path.resolve(__dirname,'../source/lib/components')) {
  const source=fs.readFileSync(path.join(directory,'metadata.cjs'),'utf8');
  const marker='module.exports = definitions;';
  if(source.split(marker).length!==2)throw new Error('metadata.cjs must export its definitions exactly once');
  const browser=source.replace(marker,'export {definitions};\nexport default definitions;');
  const target=path.join(directory,'metadata.mjs');
  if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==browser)fs.writeFileSync(target,browser);
  return target;
}
module.exports={syncComponentMetadata};
if(require.main===module)console.log(syncComponentMetadata(process.argv[2]));
