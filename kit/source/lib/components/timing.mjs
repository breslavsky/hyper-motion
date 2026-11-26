// Component-local semantic timing. This does not compile a film or own a clock.
// A scene's moments are the plan's own reckoning (scene-moments.cjs, written for the browser by
// tools/sync-scene-moments.cjs), asked again here for a scene whose content was changed after the
// film was built.
import metadata from './metadata.mjs';
import {sceneMoments} from './scene-moments.mjs';
import aliases from './scene-aliases.json' with {type:'json'};

const sceneAliases = new Map(Object.entries(aliases));
export const canonicalType = type => sceneAliases.get(type) ?? type;

// Wrap each factory once so direct callers, native seeks, fit samples and async
// repaints use the same choreography clock. The backdrop keeps its source time.
export function timedGlassFactories(factories){
  const wrapped={};
  for(const [type,build] of Object.entries(factories)){
    wrapped[type]=args=>{
      const {scene,dur,beatLen}=args.p;
      const clock=metadata[type].retime(scene,dur,beatLen);
      const draw=build(args);
      if(!clock)return draw;
      return (time,duration=dur)=>draw(clock.motionTime(time),duration,time);
    };
  }
  return wrapped;
}

export const componentTiming=sceneMoments;

const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function resolveContent(original,override){
  // Saved native compositions may carry the old name in either the compiled
  // scene or its editable content variable. Both describe the same slot.
  original={...original,type:canonicalType(original.type)};
  const scene={...original,...override};
  scene.type=canonicalType(scene.type);
  const slotFields=['type','beats','in','duration','dur','seconds','start','ldur','beatLen'];
  if(!metadata[original.type]?.retime)slotFields.push('speed');
  for(const key of slotFields)if(!same(scene[key],original[key]))throw new Error(`content.${key} changes the native component or its slot; update film.json and rebuild`);
  for(const key of ['look','bg','fg','metalVariant'])if(!same(scene[key],original[key]))throw new Error(`content.${key} is compiled style; edit the style variable or update film.json and rebuild`);
  if(!same(scene.sound,original.sound))throw new Error('content.sound changes the mixed audio track; update film.json and rebuild');
  const changed=Object.keys(scene).filter(key=>!same(scene[key],original[key]));
  return {scene,changed};
}
