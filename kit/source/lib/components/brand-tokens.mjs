// Exact brand roles shared by the recipe compiler and native variable edits.
const roles = ['background', 'foreground', 'accent', 'accent2'];
const chromatic = ['lime', 'sage', 'peach', 'electric', 'coral', 'lilac', 'butter', 'sky'];
const warm = new Set(['coral', 'peach', 'butter']);
const resolveColour = (value, palette) => palette[value] ?? (/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(value ?? '') ? value : undefined);
function luminance(hex) {
  const raw=hex.replace('#',''),six=raw.length===3?raw.replace(/./g,c=>c+c):raw;
  const [r,g,b]=[0,2,4].map(i=>{const v=parseInt(six.slice(i,i+2),16)/255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;});
  return .2126*r+.7152*g+.0722*b;
}
const contrast=(a,b)=>{const [hi,lo]=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (hi+.05)/(lo+.05);};
function foregroundOn(background, palette) {
  if(background==='sky')return '#ffffff';
  const light=palette.paper&&luminance(palette.paper)>.5?palette.paper:'#ffffff';
  const dark=palette.ink&&luminance(palette.ink)<.2?palette.ink:'#111111';
  return contrast(dark,background)>=contrast(light,background)?dark:light;
}
function brandTokens(value) {
  if(value===undefined)return {};
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('brand.tokens must be an object');
  for(const [name,colour]of Object.entries(value)){
    if(!roles.includes(name))throw new Error(`brand.tokens has no field "${name}"`);
    if(typeof colour!=='string'||!/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(colour))throw new Error(`brand.tokens.${name} must be a #hex colour`);
  }
  return value;
}
function applyBrandPalette(palette, value) {
  const tokens=brandTokens(value),out={...palette};
  if(tokens.background){out.paper=tokens.background;out.sky=tokens.background;out.ink=tokens.foreground??foregroundOn(tokens.background,palette);}
  if(tokens.foreground)out.ink=tokens.foreground;
  if(tokens.accent){
    for(const name of chromatic)out[name]=warm.has(name)?tokens.accent2??tokens.accent:tokens.accent;
    out.brand=tokens.accent;out.brand2=tokens.accent2??tokens.accent;
    if(tokens.background)out.sky=tokens.background;
  }else if(tokens.accent2){
    for(const name of warm)out[name]=tokens.accent2;
    out.brand2=tokens.accent2;
  }
  return out;
}
function resolveBrandStyle(base, value, scene={}) {
  const tokens=brandTokens(value);
  if(!Object.keys(tokens).length)return {...base};
  const palette=applyBrandPalette(base.palette,tokens);
  const bg=resolveColour(scene.bg,palette)??tokens.background??base.bg;
  const fg=resolveColour(scene.fg,palette)??tokens.foreground??(tokens.background?foregroundOn(bg,base.palette):base.fg);
  const named=scene.type==='highlight'?scene.mark:scene.type==='swap'?scene.pill:undefined;
  const accent=resolveColour(named,palette)??tokens.accent??base.accent;
  return {...base,palette,bg,fg,accent};
}
// Component materials own their local ink. This does not change a declared
// film foreground: callers retain that role and expose this surface role too.
function surfaceForeground(surface, background, palette, foreground, {explicit=false}={}) {
  if(explicit||!surface)return foreground;
  if(surface==='sky')return background==='sky'?foregroundOn(palette.sky,palette):foreground;
  if(surface!=='glass')return foreground;
  const ground=background==='sky'?palette.sky:background;
  const channels=hex=>{const raw=hex.replace('#',''),six=raw.length===3?raw.replace(/./g,c=>c+c):raw;return [0,2,4].map(i=>parseInt(six.slice(i,i+2),16));};
  const blend=(a,b,alpha)=>'#'+channels(a).map((v,i)=>Math.round(v+(channels(b)[i]-v)*alpha).toString(16).padStart(2,'0')).join('');
  // Evaluate both ends of the actual white glass sheen. Labels use 62% ink,
  // so a value that merely contrasts before that fade is not sufficient.
  const stops=luminance(ground)<.4?[.06,.22]:[.44,.82];
  const surfaces=stops.map(alpha=>blend(ground,'#ffffff',alpha));
  const score=ink=>Math.min(...surfaces.map(bg=>contrast(blend(bg,ink,.62),bg)));
  if(score(foreground)>=3)return foreground;
  return ['#111111','#ffffff'].sort((a,b)=>score(b)-score(a))[0];
}
export {applyBrandPalette,resolveBrandStyle,surfaceForeground};
