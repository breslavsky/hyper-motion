import {createOrb} from './orb.mjs';

// Each HyperFrames mount owns its canvas, clock and disposal. The original
// geometry/painter stays untouched; only the source of elapsed time changes.
export function mount(root, config, variables, gsap) {
  if (!root || !gsap?.timeline) throw new Error('Thinking Orbs requires a native root and GSAP');
  const number = (name, fallback) => {
    const value = Number(variables[name] ?? fallback);
    if (!Number.isFinite(value)) throw new Error(`${name} must be finite`);
    return value;
  };
  const dark = variables.dark ?? true;
  if (typeof dark !== 'boolean') throw new Error('dark must be a boolean');
  const x = number('x', 0), y = number('y', 0);
  const labelSize = number('labelSize', 28);
  if (labelSize < 12 || labelSize > 120) throw new Error('labelSize must be between 12 and 120');
  const canvas = root.querySelector('canvas');
  const options = {
    state: variables.state ?? 'searching',
    size: number('size', 192),
    presetSize: number('presetSize', 64),
    pixelRatio: number('pixelRatio', 1),
    speed: number('speed', 1),
    dark,
    ...(variables.color ? {color: variables.color} : {}),
  };
  const api = createOrb(canvas, options);
  const placement = root.querySelector('[data-orb-placement]');
  Object.assign(placement.style, {position:'absolute', left:`${x}px`, top:`${y}px`, width:`${options.size}px`});
  const label = root.querySelector('[data-orb-label]');
  label.textContent = variables.label ?? options.state;
  Object.assign(label.style, {
    marginTop:'18px', textAlign:'center', fontSize:`${labelSize}px`, lineHeight:'1.2',
    color:dark ? '#b8bdc7' : '#505662', fontFamily:'"Orb Demo", sans-serif', fontWeight:'500',
  });
  let time = 0;
  const clock = {get time(){return time;}, set time(value){
    time = Math.max(0, Math.min(config.duration, value));
    api.draw(time);
  }};
  const timeline = gsap.timeline({paused:true})
    .to(clock, {time:config.duration, duration:config.duration, ease:'none'}, 0);
  api.draw(0);
  root.orbInstance = {
    api, canvas, config:{...options, start:config.start ?? 0, duration:config.duration},
    get time(){return time;},
    dispose(){timeline.kill(); api.dispose(); delete root.orbInstance;},
  };
  return {timeline};
}
