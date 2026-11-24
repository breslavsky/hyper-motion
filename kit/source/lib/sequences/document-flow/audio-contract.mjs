const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;

// The build embeds this resolved contract beside the native audio clips. Copy
// and brand changes are safe only while the actual event/audio schedule agrees.
export function audioContract(plan){
  return JSON.stringify(canonical({bpm:plan.bpm,duration:plan.duration,events:plan.events,sound:plan.recipe.sound}));
}

