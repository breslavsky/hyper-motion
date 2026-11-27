// Browser metadata is generated from the one canonical CJS declaration.
const fs = require('node:fs');
const path = require('node:path');
function syncComponentMetadata(directory=path.resolve(__dirname,'../source/lib/components')) {
  const source=fs.readFileSync(path.join(directory,'metadata.cjs'),'utf8');
  const marker='module.exports = definitions;';
  if(source.split(marker).length!==2)throw new Error('metadata.cjs must export its definitions exactly once');
  // The one thing the declaration takes from another file: the beat grid, generated for the browser the same way.
  const GRID="const {onBeat, nearBeat, lastBeat} = require('./beat-grid.cjs');";
  if(source.split(GRID).length!==2)throw new Error('metadata.cjs must take the beat grid exactly once');
  const browser=source.replace(marker,'export {definitions};\nexport default definitions;').replace(GRID,"import {onBeat, nearBeat, lastBeat} from './beat-grid.mjs';");
  const target=path.join(directory,'metadata.mjs');
  if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==browser)fs.writeFileSync(target,browser);
  return target;
}
module.exports={syncComponentMetadata};
if(require.main===module)console.log(syncComponentMetadata(process.argv[2]));
