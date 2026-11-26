// The browser's module of a scene's moments is written from the one canonical CJS declaration.
const fs=require('node:fs'),path=require('node:path');
function syncSceneMoments(directory=path.resolve(__dirname,'../source/lib/components')){
  const source=fs.readFileSync(path.join(directory,'scene-moments.cjs'),'utf8'),marker='module.exports = {sceneMoments, onBeat, landings};';
  if(source.split(marker).length!==2)throw new Error('scene-moments.cjs must export its reckoning exactly once');
  const browser=source.replace(marker,'export {sceneMoments, onBeat, landings};'),target=path.join(directory,'scene-moments.mjs');
  if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==browser)fs.writeFileSync(target,browser);
  return target;
}
module.exports={syncSceneMoments};
if(require.main===module)console.log(syncSceneMoments(process.argv[2]));
