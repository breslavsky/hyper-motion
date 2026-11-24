// Lifecycle rendezvous only. Components remain independently clocked by HyperFrames.
const instances=new Map(),failures=new Map(),listeners=new Set();
const notify=()=>{for(const fn of listeners)fn();};
export const sceneInstances=instances;
export function registerScene(id,instance) {
  if(instances.has(id))throw new Error(`Duplicate mounted component id: ${id}`);
  failures.delete(id);
  instances.set(id,instance);
  if(typeof window!=='undefined'){window.__pkScenes??={};window.__pkScenes[id]=instance;}
  notify();
}
export function rejectScene(id,error){failures.set(id,error);notify();}
export function unregisterScene(id,instance){
  if(instances.get(id)!==instance)return;instances.delete(id);
  if(typeof window!=='undefined'&&window.__pkScenes?.[id]===instance)delete window.__pkScenes[id];
}
export function waitForScenes(ids,timeout=15000){
  return new Promise((resolve,reject)=>{
    let timer;
    const cleanup=()=>{listeners.delete(check);clearTimeout(timer);};
    const check=()=>{
      const failed=ids.find(id=>failures.has(id));
      if(failed){cleanup();reject(failures.get(failed));return;}
      if(ids.every(id=>instances.has(id))){cleanup();resolve(ids.map(id=>instances.get(id)));}
    };
    listeners.add(check);
    timer=setTimeout(()=>{cleanup();reject(new Error(`Components did not become ready: ${ids.filter(id=>!instances.has(id)).join(', ')}`));},timeout);
    check();
  });
}
