// Scene-independent film presentation. HyperFrames owns all component clocks.
import {createContext,applyTypography,loadEmoji} from './context.mjs';
import {createTransitions} from './transitions.mjs';
import {waitForScenes} from './registry.mjs';

function createSparks(context,built,stage,opts={}) {
  const {W,H,S,plan,safe,helpers}=context;
  const {hash}=helpers.maths;
  const canvasLayer=(root,z)=>helpers.moves.canvasLayer(root,z,W,H);
  let sparks=null;
	const LANDS = { endcard: 0.62, logo3d: 0.3 };
	const OWN_BURST = new Set(["gather", "impact", "pack", "particles", "scatter", "countdown"]);
	const buildSparks = () => {
		sparks = null;
		if (!plan.sparks || opts.sparks === false) return;
		const hits = [];
		for (const cue of plan.cues) {
			if (cue.kind !== "hit" || (cue.strength ?? 1) < 1) continue;
			const b = built.find((x) => cue.t >= x.ps.start - 1e-3 && cue.t < x.ps.start + x.ps.dur) ?? null;
			if (!b || OWN_BURST.has(b.ps.scene.type)) continue;
			// Round the scene's text as the fit measured it; round the middle of the safe area without it.
			const box = b.box ?? [safe.x + safe.w * 0.2, safe.y + safe.h * 0.4, safe.x + safe.w * 0.8, safe.y + safe.h * 0.6];
			hits.push({ t: cue.t + (LANDS[b.ps.scene.type] ?? 0), cx: (box[0] + box[2]) / 2, cy: (box[1] + box[3]) / 2, rx: (box[2] - box[0]) / 2, ry: (box[3] - box[1]) / 2, colours: [b.ps.accent, b.ps.fg], seed: hits.length * 17.3 });
		}
		if (!hits.length) return;
		const layer = canvasLayer(stage, 40);
		layer.c.id = "sparks";
		const LIFE = 0.5;
		const unit = Math.min(W, H);
		sparks = (t) => {
			layer.clear();
			for (const hit of hits) {
				const u = (t - hit.t) / LIFE;
				if (u < 0 || u >= 1) continue;
				// Fast out of the word, then slowing: most of the way in the first third.
				const out = 1 - (1 - u) ** 3;
				for (let i = 0; i < 34; i++) {
					const angle = (i / 34) * Math.PI * 2 + (hash(hit.seed + i * 1.9) - 0.5) * 0.3;
					const [dx, dy] = [Math.cos(angle), Math.sin(angle)];
					// From an oval round the text's box, outward: dots that left the box's own edge drew a rectangle.
					const edge = 1 / Math.hypot(dx / Math.max(1, hit.rx * 1.12), dy / Math.max(1, hit.ry * 1.3));
					const reach = edge + unit * (0.02 + (0.07 + hash(hit.seed + i * 3.7) * 0.2) * out);
					const size = (7 + hash(hit.seed + i * 5.3) * 15) * S * (1 - u * 0.75);
					layer.g.globalAlpha = Math.max(0, 1 - u * u);
					layer.g.fillStyle = hit.colours[hash(hit.seed + i * 7.1) < 0.6 ? 0 : 1];
					layer.g.beginPath();
					layer.g.arc(hit.cx + dx * reach, hit.cy + dy * reach, size, 0, Math.PI * 2);
					layer.g.fill();
				}
			}
			layer.g.globalAlpha = 1;
		};
	};

  buildSparks();
  return sparks;
}

function noiseTile(document,hash){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=220;
  const g=canvas.getContext('2d'),data=g.createImageData(220,220);
  for(let i=0;i<data.data.length;i+=4){const value=Math.floor(hash(i*.37+11)*255);data.data[i]=data.data[i+1]=data.data[i+2]=value;data.data[i+3]=255;}
  g.putImageData(data,0,0);return canvas.toDataURL();
}

/** Parent presentation only: scene clocks and media remain native HyperFrames tracks. */
export async function mountFilm(root,config,gsap){
  const {plan,sceneIds,options={}}=config;
  const errors=[];
  const sceneReady=waitForScenes(sceneIds);
  let resolveReady,rejectReady;
  const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
  // The native build promise reports the same failure. Keep inspector readiness
  // safe even when no inspector is listening while the project mounts.
  ready.catch(()=>{});
  const state={id:config.id??'main',plan,ready,errors,sceneIds,scenes:[],time:0};
  window.__pkFilm=state;
  try{
    const instances=await sceneReady;state.scenes=instances;
    state.rebuildRequired=instances.filter(instance=>instance.rebuildRequired).map(instance=>({id:instance.id,...instance.rebuildRequired}));
    const overlay=root.ownerDocument.createElement('div');overlay.className='pk-stage pk-film-overlays';root.append(overlay);
    const ctx=createContext({stage:overlay,plan,emoji:await loadEmoji(options),options,id:`${state.id}-presentation`});
    const {W,H,S,M,helpers}=ctx,{el,set,px}=helpers.dom,{hash}=helpers.maths;
    set(overlay,{width:px(W),height:px(H)});applyTypography(overlay,plan.look);
    root.style.filter=plan.look?.post?.grade??'none';
    const built=instances.map(instance=>({...instance,root:instance.sceneRoot}));
    const sparks=createSparks(ctx,built,overlay,options);
    let grain=null;
    if(plan.grain){grain=el('div','pk-grain',overlay);set(grain,{backgroundImage:`url(${noiseTile(root.ownerDocument,hash)})`,opacity:String(plan.look?.deco?.grain??.11)});}
    const decoration=helpers.decor.of({W,H,S,plan,stage:overlay,get M(){return M;}});
    const overlays=decoration.buildOverlays();
    const wipebar=el('div','pk-wipebar',overlay),dotsCanvas=el('canvas','',overlay);
    dotsCanvas.width=W;dotsCanvas.height=H;
    set(dotsCanvas,{position:'absolute',left:'0',top:'0',width:px(W),height:px(H),pointerEvents:'none',zIndex:'900',visibility:'hidden'});
    const {applyTransition}=createTransitions({W,H,S,plan,stage:root,wipebar,dotsCanvas,helpers});
    function drawPresentation(time){
      if(state.disposed)return;
      const t=Math.max(0,Math.min(plan.duration,Number(time)));state.time=t;
      for(const [index,b] of built.entries()){
        // Native hosts also own visibility. This inner gate prevents a child with
        // visibility:visible from leaking through a hidden future scene host.
        const visible=t>=b.clipStart&&(t<b.clipStart+b.clipDuration||index===built.length-1);
        b.root.style.visibility=visible?'visible':'hidden';b.root.classList.toggle('on',visible);
        instances[index].lastVisible=visible;
        set(b.root,{transform:'none',clipPath:'none',filter:'none',opacity:'1',maskImage:'none',webkitMaskImage:'none',maskSize:'auto',webkitMaskSize:'auto',maskPosition:'0% 0%',webkitMaskPosition:'0% 0%'});
        b.root.style.removeProperty('--pk-transition-ab');b.blur.setAttribute('stdDeviation','0 0');
      }
      wipebar.style.visibility='hidden';
      // Invisible transition surfaces have a canonical state too: otherwise a
      // reverse seek retains the last wipe polygon/mask or hidden pixel buffer.
      if(dotsCanvas.style.visibility!=='hidden')dotsCanvas.getContext('2d').clearRect(0,0,W,H);
      dotsCanvas.style.visibility='hidden';
      set(wipebar,{background:'',clipPath:'none',opacity:'1',maskImage:'none',webkitMaskImage:'none',maskSize:'auto',webkitMaskSize:'auto',maskPosition:'0% 0%',webkitMaskPosition:'0% 0%'});
      set(root,{background:''});
      for(let i=1;i<built.length;i++){
        const b=built[i],a=built[i-1],tr=b.ps.trDur;if(!tr)continue;
        const start=b.ps.start-tr/2;if(t<start||t>start+tr)continue;
        const p=(t-start)/tr;applyTransition(b.ps.transition,a,b,M.curve?M.curve(p):p);
      }
      const current=built.find(b=>t>=b.ps.start&&t<b.ps.start+b.ps.dur)??built.at(-1);
      if(current)for(const draw of overlays)draw(t,current.ps);
      sparks?.(t);
      if(grain){const frame=Math.floor(t*24);set(grain,{transform:`translate(${px((hash(frame)-.5)*200)}, ${px((hash(frame+.5)-.5)*200)})`});}
    }
    // A function, never an accessor: see the scene's clock in runtime.mjs.
    const clock={time(value){if(value===undefined)return state.time;drawPresentation(value);}};
    const timeline=gsap.timeline({paused:true}).to(clock,{time:plan.duration,duration:plan.duration,ease:'none'},0);
    state.drawPresentation=drawPresentation;
    state.audit=()=>({time:state.time,scenes:instances.map(instance=>instance.audit()),errors:[...errors]});
    state.dispose=()=>{
      if(state.disposed)return;state.disposed=true;
      timeline.kill();ctx.dispose();overlay.remove();for(const instance of instances)instance.dispose();
      for(const [key,value]of Object.entries(window.__timelines??{}))if(value===timeline)delete window.__timelines[key];
      if(window.__pkFilm===state)delete window.__pkFilm;
    };
    drawPresentation(0);
    resolveReady(state);
    return {timeline,instance:state};
  }catch(error){errors.push(String(error?.stack??error));rejectReady(error);throw error;}
}
