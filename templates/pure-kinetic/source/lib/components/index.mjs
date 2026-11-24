// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.
import {createBuiltin} from './builtin.mjs';
import metadata from './metadata.mjs';
import catalog from './catalog.mjs';
import {canonicalType} from './timing.mjs';
import aliases from './scene-aliases.json' with {type:'json'};
import {sceneFactories as text} from './scenes/text.mjs';
import {sceneFactories as data} from './scenes/data.mjs';
import {sceneFactories as ui} from './scenes/ui.mjs';
import {sceneFactories as flow} from './scenes/flow.mjs';
import {sceneFactories as hands} from './scenes/hands.mjs';
import {sceneFactories as reel} from './scenes/reel.mjs';
import {sceneFactories as studio} from './scenes/studio.mjs';
import {createFamily as create_glass} from './scenes/glass.mjs';
import {createFamily as create_words} from './scenes/words.mjs';
import {createFamily as create_cards} from './scenes/cards.mjs';
import {createFamily as create_bursts} from './scenes/bursts.mjs';

export {catalog};
const opticalTypes=new Set(Object.keys(catalog).filter(type=>catalog[type].family==='glass'&&catalog[type].renderMode==='webgl'));
export function createComponentLibrary(K){
 const builtin=createBuiltin(K);
 const factories={...builtin.SCENES,...text,...data,...ui,...flow,...hands,...reel,...studio,...create_glass(K).sceneFactories,...create_words(K).sceneFactories,...create_cards(K).sceneFactories,...create_bursts(K).sceneFactories};
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
