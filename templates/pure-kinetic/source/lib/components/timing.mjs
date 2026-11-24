// Component-local semantic timing. This does not compile a film or own a clock.
// Keep equivalent to compiler/plan.cjs marks/click times; timing tests compare
// every catalogue sample against the build-time compiler.
import metadata from './metadata.mjs';
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

export function componentTiming(scene,len,beat){
  const spread=(count,from,to)=>{
    const step=Math.min(beat,(to-from)/Math.max(1,count));
    return Array.from({length:count},(_,i)=>from+i*step);
  };
  let marks;
  switch(scene.type){
    case 'slam':marks=spread(scene.lines.length,.02,len*.72);break;
    case 'morph':marks=Array.from({length:scene.states.length},(_,i)=>i*len/scene.states.length);break;
    case 'steps':marks=spread(scene.steps.length,.45,len*.82).map((t,i)=>t+i*.02);break;
    case 'ticket':marks=[Math.max(.6,len*.66)];break;
    case 'append':marks=spread(scene.words.length,.5,len*.85);break;
    case 'countdown':marks=spread(scene.from+1,.02,len*.8);break;
    case 'callouts':marks=spread(scene.notes.length,.55,len*.8);break;
    case 'chat':marks=spread(scene.messages.length,.2,len*.8);break;
    case 'notify':marks=spread(scene.items.length,.15,len*.7);break;
    case 'timeline':marks=spread(scene.items.length,.35,len*.85);break;
  }
  let clickAt;
  if((scene.type==='ui-macro'&&scene.click!==false)||scene.type==='prompt')clickAt=Math.min(len-.25,Math.max(.5,len*.74));
  else if(scene.type==='toggle')clickAt=Math.max(.45,len*.42);
  return {marks,clickAt};
}

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
