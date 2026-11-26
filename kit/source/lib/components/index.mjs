// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {createBuiltin} from './builtin.mjs';
import metadata from './metadata.mjs';
import catalog from './catalog.mjs';
import {canonicalType} from './timing.mjs';
import aliases from './scene-aliases.json' with {type:'json'};
import {plain as ownPlain,made as ownMade} from './scenes/folders.mjs';
import {sceneFactories as text} from './scenes/text.mjs';

export {catalog};
const opticalTypes=new Set(Object.keys(catalog).filter(type=>catalog[type].family==='glass'&&catalog[type].renderMode==='webgl'));
/** Loads what the film's scenes import on demand, before any of them mounts.
 *  A scene that has mounted is played at once, and a film of heavy scenes
 *  (six of the metal look) kept a glass scene's modules from arriving in time
 *  for the film to be ready. */
export async function preloadFamilies(types){
 if(types.some(type=>opticalTypes.has(canonicalType(type))))await import('./glass/components.mjs');
}
export function createComponentLibrary(K){
 const builtin=createBuiltin(K);
 const factories={...text,
  // The scenes that have a file of their own, scenes/<folder>/<type>.mjs (scenes/folders.mjs lists them).
  ...ownPlain,...Object.fromEntries(Object.entries(ownMade).map(([type,create])=>[type,create(K)]))};
 const types=Object.keys(catalog);
 const selfCamera=new Set([...builtin.SELF_CAMERA,...opticalTypes]);
 for(const [alias,type] of Object.entries(aliases))if(selfCamera.has(type))selfCamera.add(alias);
 return {types,selfCamera,logoNode:builtin.logoNode,definitions:metadata,has:type=>Object.hasOwn(catalog,canonicalType(type)),
  async get(type){
   type=canonicalType(type);
   if(!Object.hasOwn(catalog,type))throw new Error('Unknown component: '+type);
   if(opticalTypes.has(type)){const {factories}=await import('./glass/components.mjs');return factories[type];}
   if(catalog[type].family==='three'){const {sceneFactories}=await import('./scenes/three.mjs');return sceneFactories[type];}
   if(!factories[type]){
    const family=await import(`./scenes/${catalog[type].family}.mjs`);
    Object.assign(factories,family.createFamily?family.createFamily(K).sceneFactories:family.sceneFactories);
   }
   const factory=factories[type];if(typeof factory!=='function')throw new Error('Missing component factory: '+type);return factory;
  }
 };
}
