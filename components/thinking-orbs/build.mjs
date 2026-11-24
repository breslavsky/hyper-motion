import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {ORB_STATES} from './orb.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const escape = value => String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll("'",'&#39;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const json = value => JSON.stringify(value).replaceAll('<','\\u003c');
const FORMATS = {'16:9':[1920,1080], '9:16':[1080,1920], '1:1':[1080,1080]};

export function buildProject(destination, spec={}) {
  const aspect = spec.aspect ?? '16:9';
  if (!FORMATS[aspect]) throw new Error('aspect must be 16:9, 9:16 or 1:1');
  const [width,height] = FORMATS[aspect];
  const duration = spec.duration ?? 8;
  if (!Number.isFinite(duration) || duration < 1 || duration > 60) throw new Error('duration must be 1–60 seconds');
  const layout = spec.layout ?? 'gallery';
  if (!['gallery','single'].includes(layout)) throw new Error('layout must be gallery or single');
  const dark = spec.dark ?? true;
  if (typeof dark !== 'boolean') throw new Error('dark must be a boolean');
  const color = spec.color ?? '';
  if (color && !/^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(color)) throw new Error('color must be a hex RGB color');
  const speed = spec.speed ?? 1;
  if (!Number.isFinite(speed) || speed < 0 || speed > 10) throw new Error('speed must be 0–10');
  const presetSize = spec.presetSize ?? 64;
  if (![20,32,64].includes(presetSize)) throw new Error('presetSize must be 20, 32 or 64');
  const state = spec.state ?? 'searching';
  if (!ORB_STATES.includes(state)) throw new Error(`Unknown state: ${state}`);
  const title = spec.title ?? 'Thinking Orbs';
  const subtitle = spec.subtitle ?? (layout==='gallery' ? 'Nine ways to think.' : `${state[0].toUpperCase()}${state.slice(1)}.`);
  if (typeof title !== 'string' || title.length > 36 || typeof subtitle !== 'string' || subtitle.length > 60) throw new Error('Use a title up to 36 and subtitle up to 60 characters');

  const out = path.resolve(destination);
  if (fs.existsSync(out) && fs.readdirSync(out).length) throw new Error(`Destination must be fresh or empty: ${out}`);
  fs.mkdirSync(path.join(out,'assets/orbs'), {recursive:true});
  fs.mkdirSync(path.join(out,'assets/fonts'), {recursive:true});
  fs.mkdirSync(path.join(out,'compositions'), {recursive:true});
  for (const f of ['orb.mjs','native.mjs']) fs.copyFileSync(path.join(HERE,f), path.join(out,'assets/orbs',f));
  fs.mkdirSync(path.join(out,'assets/orbs/vendor'));
  for (const name of fs.readdirSync(path.join(HERE,'vendor'))) {
    if (name.endsWith('.js') || name==='LICENSE' || name==='SOURCE.json' || name==='INTEGRITY.json' || name==='package.json') {
      fs.copyFileSync(path.join(HERE,'vendor',name),path.join(out,'assets/orbs/vendor',name));
    }
  }
  fs.copyFileSync(path.join(HERE,'../pure-kinetic/vendor/gsap-3.14.2.min.js'), path.join(out,'assets/gsap.min.js'));
  fs.copyFileSync(path.join(REPO,'kit/source/lib/fonts/Geist-Variable.woff2'), path.join(out,'assets/fonts/Geist.woff2'));
  fs.copyFileSync(path.join(HERE,'licenses/Geist-OFL.txt'),path.join(out,'assets/fonts/Geist-OFL.txt'));
  const digest = filename => crypto.createHash('sha256').update(fs.readFileSync(path.join(out,filename))).digest('hex');
  fs.writeFileSync(path.join(out,'assets/SHARED-SOURCES.json'),JSON.stringify({sources:[
    {name:'GSAP',version:'3.14.2',url:'https://github.com/greensock/GSAP',license:'Standard GreenSock License',
      file:'assets/gsap.min.js',sha256:digest('assets/gsap.min.js'),note:'Unmodified existing harness distribution; upstream copyright and license URL remain in its header.'},
    {name:'Geist',url:'https://github.com/vercel/geist-font',license:'OFL-1.1',
      file:'assets/fonts/Geist.woff2',sha256:digest('assets/fonts/Geist.woff2'),licenseFile:'assets/fonts/Geist-OFL.txt',
      note:'Unmodified existing harness Geist-Variable.woff2; source provenance: kit/source/lib/fonts/SOURCE.json.'},
  ]},null,2)+'\n');

  const portrait = height > width;
  const margin = Math.round(width * (portrait ? .085 : .065));
  const top = portrait ? 360 : 240;
  const bottom = portrait ? 160 : 92;
  const columns = 3;
  const cellWidth = (width - margin*2)/columns;
  const cellHeight = (height-top-bottom)/3;
  const size = layout==='single' ? Math.round(Math.min(width*.62, (height-top-bottom)*.8))
    : Math.floor(Math.min(cellWidth*.61, cellHeight*.68));
  const labelSize = portrait ? 29 : width===1080 ? 28 : 30;
  const states = layout==='single' ? [state] : [...ORB_STATES];
  const scenes = states.map((state,i) => ({
    id:`orb-${state}`, state, size, presetSize, pixelRatio:1, speed, dark, color,
    x: layout==='single' ? (width-size)/2 : Math.round(margin + (i%3)*cellWidth + (cellWidth-size)/2),
    y: layout==='single' ? Math.round(top+(height-top-bottom-size-labelSize-18)/2) : Math.round(top+Math.floor(i/3)*cellHeight),
    label:state[0].toUpperCase()+state.slice(1), labelSize, duration, start:0,
  }));
  const variableDefinitions = [
    {id:'state', type:'enum', label:'State', default:state, options:ORB_STATES.map(value=>({value,label:value}))},
    {id:'size',type:'number',label:'Size',default:size,min:20,max:1000,step:1},
    {id:'presetSize',type:'enum',label:'Original density',default:String(presetSize),options:[20,32,64].map(n=>({value:String(n),label:`${n}px preset`}))},
    {id:'speed',type:'number',label:'Speed',default:speed,min:0,max:10,step:.1},
    {id:'dark',type:'boolean',label:'Light ink on dark background',default:dark},
    {id:'color',type:'string',label:'Tint (blank = original monochrome)',default:color},
    {id:'x',type:'number',label:'Left',default:0,min:-width,max:width,step:1},
    {id:'y',type:'number',label:'Top',default:0,min:-height,max:height,step:1},
    {id:'label',type:'string',label:'Caption',default:state},
    {id:'labelSize',type:'number',label:'Caption size',default:labelSize,min:12,max:120,step:1},
  ];
  fs.writeFileSync(path.join(out,'compositions/orb.html'), `<!doctype html><html data-composition-id="orb" data-composition-duration="${duration}" data-composition-variables='${escape(JSON.stringify(variableDefinitions))}'><body><template>
<style>#root{position:absolute;inset:0}#root *{box-sizing:border-box}canvas{display:block}</style>
<div id="root" data-composition-id="orb" data-duration="${duration}">
  <div id="orb-mount" data-orb-mount class="clip" data-start="0" data-duration="${duration}" data-track-index="0" style="position:absolute;inset:0">
    <div data-orb-placement><canvas aria-label="Animated thinking orb"></canvas><div data-orb-label></div></div>
  </div>
  <script>(function(){
    const root=document.getElementById('orb-mount');
    const host=root.closest('[data-composition-src],[data-composition-file]');
    const instanceId=host?.dataset.compositionId||'orb';
    const variables=window.__hyperframes?.getVariables?.()||{};
    const setup=import('./assets/orbs/native.mjs').then(({mount})=>mount(root,{duration:${duration},start:Number(host?.dataset.start||0)},variables,window.gsap)).then(({timeline})=>{
      window.__timelines=window.__timelines||{};window.__timelines.orb=timeline;
    });
    window.__hf=window.__hf||{};window.__hf.buildReady=window.__hf.buildReady||{};
    window.__hf.buildReady['orbs:'+instanceId]=setup;
    setup.catch(error=>console.error('Thinking Orbs failed:',error));
  })();</script>
</div></template></body></html>`);

  const background = dark ? '#101216' : '#f6f7f9';
  const foreground = dark ? '#f4f5f7' : '#141821';
  const muted = dark ? '#9da5b2' : '#59616e';
  const rule = dark ? '#292e37' : '#dce0e6';
  const titleSize = portrait ? 68 : width===1080 ? 58 : 72;
  const hosts = scenes.map((scene,i)=>{
    const {id,duration,start,...values}=scene;
    return `<div id="${id}" class="clip" data-composition-id="${id}" data-composition-src="compositions/orb.html" data-variable-values='${escape(JSON.stringify(values))}' data-start="${start}" data-duration="${duration}" data-track-index="${i+1}" data-track-kind="graphics" data-width="${width}" data-height="${height}" style="position:absolute;inset:0"></div>`;
  }).join('\n');
  fs.writeFileSync(path.join(out,'index.html'), `<!doctype html><html><head><meta charset="utf-8"><title>${escape(title)}</title>
<style>
@font-face{font-family:"Orb Demo";src:url('assets/fonts/Geist.woff2');font-weight:100 900;font-display:block}
html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;font-family:"Orb Demo",sans-serif;color:${foreground};background:${background}}
#main{position:relative;width:${width}px;height:${height}px}*{box-sizing:border-box}
.backdrop{position:absolute;inset:0;background:${background}}
.heading{position:absolute;left:${margin}px;right:${margin}px;top:${portrait?130:64}px}
h1{margin:0;font-weight:500;font-size:${titleSize}px;line-height:1.1;letter-spacing:-.045em}
p{margin:18px 0 0;font-size:${portrait?32:28}px;color:${muted};line-height:1.25}
.rule{position:absolute;left:${margin}px;right:${margin}px;top:${top-38}px;height:1px;background:${rule}}
.credit{position:absolute;left:${margin}px;bottom:${portrait?85:38}px;font-size:28px;color:${muted}}
</style></head><body>
<script src="assets/gsap.min.js"></script>
<div id="main" data-composition-id="main" data-width="${width}" data-height="${height}" data-duration="${duration}" data-fps="30">
<div class="backdrop"></div><div class="heading"><h1>${escape(title)}</h1><p>${escape(subtitle)}</p></div><div class="rule"></div>
${hosts}
<div class="credit">Thinking Orbs · Libraries.dev / Jakub Antalik</div>
</div>
<script>window.__timelines=window.__timelines||{};window.__timelines.main=gsap.timeline({paused:true}).to({},{duration:${duration}});</script>
</body></html>`);
  const receipt = {schemaVersion:1,layout,aspect,width,height,duration,background,scenes};
  fs.writeFileSync(path.join(out,'orbs-project.json'), JSON.stringify(receipt,null,2)+'\n');
  return {project:out,...receipt};
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [destination, specPath] = process.argv.slice(2);
  if (!destination) throw new Error('Usage: node build.mjs <fresh-output-directory> [spec.json]');
  const result = buildProject(destination,specPath ? JSON.parse(fs.readFileSync(specPath,'utf8')) : {});
  console.log(JSON.stringify({project:result.project,width:result.width,height:result.height,duration:result.duration,states:result.scenes.map(s=>s.state)}));
}
