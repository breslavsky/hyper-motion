// A live Paper liquidMetal texture, clipped by the browser to native text and
// surface borders. Typography, shaping, wrapping and component motion remain DOM
// work; no text rasterization or additional animation clock is introduced.
import {createMetal} from './metal/metal.mjs';

const TITLES=['hero','display','sceneTitle','cardTitle','metric'];
const titleSelector=TITLES.map(role=>`[data-design-role="${role}"]`).join(',');
const surfaceSelector='.glass,[data-design-surface="card"]:not([data-surface-layout="frame"]),[data-design-surface="badge"],[data-design-control="button"]';

export function createMetalMaterial({root,K,bg,fg,preset}) {
  const document=root.ownerDocument,canvas=document.createElement('canvas');
  canvas.hidden=true;canvas.setAttribute('aria-hidden','true');
  canvas.dataset.metal=preset;canvas.dataset.metalKind='fill';root.append(canvas);
  // The upstream shader sheet is 96px at DPR 1. A 192x144 texture retains its
  // complete crop without bloating each CSS image with an upscaled PNG (large
  // inherited data URLs can stall native multi-scene readiness). Glyphs and
  // borders are still clipped by the browser at full output resolution.
  const renderer=createMetal({canvas,width:192,height:144,preset,
    theme:K.lum(bg)<.4?'dark':'light',kind:'fill',radius:0,pixelRatio:1});
  root.classList.add('pk-metal');
  root.dataset.metalTheme=K.lum(bg)<.4?'dark':'light';
  root.style.setProperty('--pk-metal-rim',`${Math.max(1.5,2.5*K.S)}px`);
  const textNodes=new Set(),surfaces=new Set();
  let previousTime,disposed=false;
  const offset=node=>{
    let x=0,y=0;
    for(let current=node;current;current=current.offsetParent){x+=current.offsetLeft;y+=current.offsetTop;}
    return {x,y};
  };

  function decorate() {
    for(const title of root.querySelectorAll(titleSelector)) {
      if(title.closest('.ghost,[data-metal-exclude]'))continue;
      const leaves=[...title.querySelectorAll('.glyph,.word:not(:has(.glyph)),[data-typing-unit]')];
      for(const node of leaves.length?leaves:[title]) {
        // Images/logos/emoji keep their original colours. Nested text gets its
        // own mask only when its measured semantic role asks for this material.
        if(node.querySelector('svg,img,canvas')||!node.textContent.trim())continue;
        node.classList.add('pk-metal-fill');textNodes.add(node);
        // Align neighbouring glyphs on one material sheet without reading
        // transformed screen coordinates (entrance motions may rotate/scale).
        const width=Math.max(title.offsetWidth,1),height=Math.max(title.offsetHeight,1);
        const origin=offset(title),position=offset(node),x=position.x-origin.x,y=position.y-origin.y;
        node.style.setProperty('--pk-metal-text-size',`${width}px ${Math.max(height, width*.45)}px`);
        node.style.setProperty('--pk-metal-text-position',`${-x}px ${-y}px`);
      }
    }
    for(const node of root.querySelectorAll(surfaceSelector)) {
      if(node.closest('[data-metal-exclude]'))continue;
      if(getComputedStyle(node).position==='static')node.style.position='relative';
      node.classList.add('pk-metal-surface');node.dataset.metalKind='ring';surfaces.add(node);
      // Glass panels become a neutral metal housing. Controls retain their
      // branded centre and contrasting label; the finish occupies their rim.
      if(node.classList.contains('glass')){
        node.classList.add('pk-metal-panel');
        // The compiler may choose dark ink on a mid-tone branded background.
        // A metal housing must contrast that ink instead of forcing the dark
        // shader tuning's housing beneath it. Exact supplied ink stays intact.
        node.dataset.metalPanelTheme=K.lum(fg)<.18?'light':'dark';
      }
    }
    for(const node of textNodes)if(!root.contains(node))textNodes.delete(node);
    for(const node of surfaces)if(!root.contains(node))surfaces.delete(node);
  }
  function draw(seconds) {
    if(disposed)return;
    decorate();
    if(previousTime===seconds)return;
    renderer.draw(seconds);
    root.style.setProperty('--pk-metal-image',`url("${canvas.toDataURL('image/png')}")`);
    canvas.dataset.metalTime=String(seconds);previousTime=seconds;
  }
  function dispose() {
    if(disposed)return;disposed=true;renderer.dispose();canvas.remove();
    root.classList.remove('pk-metal');root.style.removeProperty('--pk-metal-image');
    for(const node of textNodes){node.classList.remove('pk-metal-fill');node.style.removeProperty('--pk-metal-text-size');node.style.removeProperty('--pk-metal-text-position');}
    for(const node of surfaces){node.classList.remove('pk-metal-surface','pk-metal-panel');delete node.dataset.metalKind;delete node.dataset.metalPanelTheme;}
    textNodes.clear();surfaces.clear();
  }
  K.onDispose(dispose);
  return {draw,dispose,canvas,renderer};
}
