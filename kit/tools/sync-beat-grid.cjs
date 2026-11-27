// The browser's module of the beat grid is written from the one canonical CJS declaration.
const fs=require('node:fs'),path=require('node:path');
function syncBeatGrid(directory=path.resolve(__dirname,'../source/lib/components')){
  const source=fs.readFileSync(path.join(directory,'beat-grid.cjs'),'utf8'),marker='module.exports = {onBeat, nearBeat, lastBeat};';
  if(source.split(marker).length!==2)throw new Error('beat-grid.cjs must export its helpers exactly once');
  const browser=source.replace(marker,'export {onBeat, nearBeat, lastBeat};'),target=path.join(directory,'beat-grid.mjs');
  if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==browser)fs.writeFileSync(target,browser);
  return target;
}
module.exports={syncBeatGrid};
if(require.main===module)console.log(syncBeatGrid(process.argv[2]));
