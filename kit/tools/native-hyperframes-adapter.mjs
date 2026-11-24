// QA-only compatibility boundary. HyperFrames 0.9.19 does not publicly export
// its browser host/seek helpers; production components never import this file.
// A vendor upgrade must deliberately review this contract and rerun native QA.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

export const NATIVE_HYPERFRAMES_VERSION='0.9.19';
const CHUNKS={
  bundleWithLocalizedFonts:['bundleWithLocalizedFonts'],
  staticProjectServer:['serveStaticProjectHtml'],
  captureCompositionFrame:['openSettledCompositionPage','seekCompositionTimeline'],
};

function incompatible(detail,cause){
  const error=new Error(`Pure Kinetic native QA requires HyperFrames ${NATIVE_HYPERFRAMES_VERSION}: ${detail}. Restore the pinned dependency with pnpm install --frozen-lockfile in kit, or review tools/native-hyperframes-adapter.mjs and rerun the native acceptance suite before upgrading.`,{cause});
  error.code='ERR_NATIVE_HYPERFRAMES_CONTRACT';
  return error;
}

export async function loadNativeHyperframes(packageRoot){
  let version,files;
  try{version=JSON.parse(fs.readFileSync(path.join(packageRoot,'package.json'),'utf8')).version;}
  catch(cause){throw incompatible(`cannot read package metadata at ${packageRoot}`,cause);}
  if(version!==NATIVE_HYPERFRAMES_VERSION)throw incompatible(`found version ${String(version)}`);
  const dist=path.join(packageRoot,'dist');
  try{files=fs.readdirSync(dist);}
  catch(cause){throw incompatible(`cannot read private QA chunks at ${dist}`,cause);}
  // Resolve the whole contract before importing: never silently select one of
  // multiple hashed chunks left behind by a partial installation/upgrade.
  const resolved=Object.entries(CHUNKS).map(([prefix,exports])=>{
    const matches=files.filter(file=>file.startsWith(`${prefix}-`)&&file.endsWith('.js'));
    if(matches.length!==1)throw incompatible(`expected one ${prefix}-*.js chunk, found ${matches.length}`);
    return {file:matches[0],exports};
  });
  const api={};
  for(const {file,exports}of resolved){
    let module;
    try{module=await import(pathToFileURL(path.join(dist,file)).href);}
    catch(cause){throw incompatible(`cannot load private QA chunk ${file}`,cause);}
    for(const name of exports){
      if(typeof module[name]!=='function')throw incompatible(`${file} must export function ${name}`);
      api[name]=module[name];
    }
  }
  return Object.freeze(api);
}
