import {compile,stateAt} from './model.mjs';
import {createView} from './view.mjs';

import {audioContract} from './audio-contract.mjs';

export function resolveVariables(root,local,defaults){
  let parent=root.parentElement;
  while(parent&&!parent.documentFlowVariables)parent=parent.parentElement;
  const inherited=parent?.documentFlowVariables??{};
  return Object.fromEntries(Object.keys(defaults).map(key=>[key,local[key]!==undefined&&local[key]!==''?local[key]:inherited[key]??defaults[key]]));
}

export async function mount(root,spec,variables={},gsap,{expectedAudio=audioContract(compile(spec)),instanceId}={}){
  if(root.documentFlow)throw new Error('Document Flow root is already mounted; dispose its instance before mounting again.');
  const parse=(name,fallback)=>{const v=variables[name];return v===undefined?fallback:typeof v==='string'?JSON.parse(v):v;};
  const recipe={...spec,brand:parse('brand',spec.brand),content:parse('content',spec.content)};
  const plan=compile(recipe);
  const host=root.closest('[data-composition-src]')??root.closest('[data-composition-id]');
  // Generated native aliases pass their scoped host ID explicitly. Manual
  // consumers can instead give their root a unique ID.
  const id=instanceId??(root.id||host?.getAttribute('data-composition-id'));
  if(!id)throw new Error('Document Flow requires an explicit instance ID or a native composition host.');
  if(audioContract(plan)!==expectedAudio)throw new Error(`DOCUMENT_FLOW_AUDIO_STALE: ${id} has changed semantic events or sound settings. Rebuild from the edited recipe before export so native audio matches the picture.`);
  root.dataset.dfInstance=id;
  const view=await createView(root,plan);
  let state=stateAt(plan,0);view.draw(state);
  const clock={get time(){return state.time;},set time(t){state=stateAt(plan,t);view.draw(state);}};
  const timeline=gsap.timeline({paused:true}).to(clock,{time:plan.duration,duration:plan.duration,ease:'none'},0);
  const instance={id,root,plan,get state(){return state;},audit:()=>view.audit(),audioCurrent:true,
    contentEdited:JSON.stringify(plan.recipe.content)!==JSON.stringify(compile(spec).recipe.content),
    dispose(){timeline.kill();view.dispose();if(root.documentFlow===instance)delete root.documentFlow;},
  };
  root.documentFlow=instance;
  return {timeline,instance};
}
