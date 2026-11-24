import {islandIcons as symbols} from './upstream/lucide-static/icons.mjs';

const aliases=Object.freeze({'✅':'check','✓':'check','✔':'check','☑':'check','ℹ':'info','⚠':'alert','❌':'close','✕':'close','➕':'plus','⭐':'star','★':'star','❤':'heart','♥':'heart','🔔':'bell','✨':'sparkles','✦':'sparkles','→':'arrow-right','➡':'arrow-right'});

export function islandIconName(value){
  const key=String(value??'').replace(/[\uFE0E\uFE0F]/gu,'').trim();
  return Object.hasOwn(symbols,key)?key:aliases[key]??null;
}

// The artwork of a named icon, as the source of an image.
export function islandIconSource(name){
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(symbols[name])}`;
}
// The same artwork with its outline filled in: the pressed state of a button's icon.
export function islandIconFilledSource(name){
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(symbols[name].replace('fill="none"','fill="currentColor"'))}`;
}

export function createIslandIcon(K,parent,value,size){
  const name=islandIconName(value);
  // Keep explicitly supplied, unrecognised legacy artwork instead of silently
  // changing its meaning. The catalogue and recognised status emoji use SVGs.
  const badge=K.el('div','pk-island-icon',parent,name?'':value);
  K.set(badge,{display:'grid',placeItems:'center',width:K.px(size),height:K.px(size),flex:'none',lineHeight:'1',fontSize:K.px(size),color:'inherit'});
  if(name){
    badge.dataset.icon=name;
    badge.setAttribute('role','img');badge.setAttribute('aria-label',name);
    badge.dataset.iconLibrary='lucide';
    // Resolve the original SVG as an alpha mask before the glass card's 3D
    // projection. Its strokes keep their weight while the ink follows text.
    const source=islandIconSource(name);
    const art=K.el('span','pk-island-icon-art',badge);
    art.setAttribute('aria-hidden','true');
    K.set(art,{display:'block',width:'100%',height:'100%',backgroundColor:'currentColor',maskImage:`url("${source}")`,maskMode:'alpha',maskSize:'100% 100%',maskRepeat:'no-repeat'});
    const image=new badge.ownerDocument.defaultView.Image();
    image.src=source;K.defer(image.decode());
  }
  return badge;
}
