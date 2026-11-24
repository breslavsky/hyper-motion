const fs=require('node:fs'),path=require('node:path');
function syncBrandTokens(directory=path.resolve(__dirname,'../source/lib/components')){
  const source=fs.readFileSync(path.join(directory,'brand-tokens.cjs'),'utf8'),marker='module.exports={applyBrandPalette,resolveBrandStyle,surfaceForeground};';
  if(source.split(marker).length!==2)throw new Error('Brand token resolver must export its functions exactly once');
  const browser=source.replace(marker,'export {applyBrandPalette,resolveBrandStyle,surfaceForeground};'),target=path.join(directory,'brand-tokens.mjs');
  if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==browser)fs.writeFileSync(target,browser);
  return target;
}
module.exports={syncBrandTokens};
if(require.main===module)console.log(syncBrandTokens(process.argv[2]));
