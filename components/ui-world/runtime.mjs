import {compile,stateAt} from './model.mjs';
import {createView} from './view.mjs';

export async function mount(root,spec,variables,gsap) {
  const style=variables.style?JSON.parse(variables.style):spec.style;
  const labels=variables.labels?JSON.parse(variables.labels):spec.labels;
  const plan=compile({...spec,style,labels});
  Object.assign(root.style,{position:'absolute',inset:0,overflow:'hidden',background:plan.style.bg});
  const view=await createView({root,width:plan.width,height:plan.height,style:plan.style,layout:plan.layout,labels:plan.labels});
  let state=stateAt(plan,0);
  const clock={get time(){return state.time;},set time(value){state=stateAt(plan,value);view.draw(state);}};
  const timeline=gsap.timeline({paused:true}).to(clock,{time:plan.duration,duration:plan.duration,ease:'none'},0);
  view.draw(state);
  const id=root.closest('[data-composition-file], [data-composition-src]')?.dataset.compositionId??'world';
  window.__uiWorldInstances??={};
  const instance={plan,root,get state(){return state;},get time(){return state.time;},audit(){return view.audit(state);},dispose(){
    timeline.kill();view.dispose?.();
    if(window.__uiWorldInstances[id]===instance)delete window.__uiWorldInstances[id];
    if(window.__uiWorld===instance)window.__uiWorld=Object.values(window.__uiWorldInstances).at(-1);
  }};
  window.__uiWorldInstances[id]=instance;
  window.__uiWorld=instance;
  // GSAP timelines are thenables. Never return one naked from an async function.
  return {timeline};
}
