const fs=require('node:fs'),path=require('node:path');
function syncTypewriterTiming(directory=path.resolve(__dirname,'../source/lib/components')){
  const source=fs.readFileSync(path.join(directory,'typewriter-timing.cjs'),'utf8'),marker='module.exports = {typewriterTiming};';
  if(source.split(marker).length!==2)throw new Error('Typewriter timing must export its schedule exactly once');
  const browser=source.replace(marker,'export {typewriterTiming};'),target=path.join(directory,'typewriter-timing.mjs');
  if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==browser)fs.writeFileSync(target,browser);
  return target;
}
module.exports={syncTypewriterTiming};
if(require.main===module)console.log(syncTypewriterTiming(process.argv[2]));
