// The content contract is shared by installation, native variables and runtime validation.
const string = (label, maxLength, defaultValue = '') => ({type:'string', role:'content', label, maxLength, default:defaultValue});
const list = (label, maxLength, defaults, minItems=2, maxItems=4) => ({type:'array', role:'content', label, minItems, maxItems, items:{type:'string', maxLength}, default:defaults});
export const components = {
  title: {description:'A headline rises letter by letter; *marked words* use the accent.', fields:{text:string('Headline',70,'Meet *Nook*.'),sub:string('Subtitle',48,'A calmer way to work')}},
  stack: {description:'Two to four words arrive in sequence; earlier lines dim.', fields:{words:list('Words',24,['Less','noise.','More','focus.'])}},
  chart: {description:'Two to six rising bars; long labels switch to horizontal rows.', fields:{title:string('Title',52,'Room to grow'),labels:list('Labels',32,['Mon','Tue','Wed','Thu'],2,6),values:{type:'array',role:'content',label:'Values',minItems:2,maxItems:6,items:{type:'number',minimum:0,maximum:1000000},default:[24,48,62,90]},suffix:string('Value suffix',6,'%')}},
  controls: {description:'A glass panel of spring switches and one optional slider.', fields:{title:string('Title',42,'Make it yours'),toggles:list('Toggle labels',32,['Focus mode','Smart reminders','Quiet hours']),slider:string('Slider label',32,'Intensity')}},
  phone3d: {description:'A real Three.js device rotates beside a caption and a fitted app name.', fields:{caption:string('Caption',65,'Your day.\nIn one place.'),appName:string('App name',32,'Nook')}}
};
export const formats = ['9:16','1:1','16:9'];
export const durationRange = {minimum:2, maximum:8};
export const looks = {
  editorial:{font:'Geist',accentFont:'Instrument Serif',weight:900,tracking:-0.055,bg:'#f4f0e6',fg:'#111111',accent:'#d94f3d',palette:['#c6f36b','#ff6b57','#ec9f78','#2b3cff']},
  loud:{font:'Archivo',accentFont:'Archivo',weight:900,tracking:-0.035,bg:'#2b3bff',fg:'#f6e4c6',accent:'#ff7dc7',palette:['#ff7dc7','#ff5a1f','#f6e4c6','#0e0f1f']}
};
const fail = (path, message) => {throw new Error(`${path}: ${message}`);};
function check(value, field, path) {
  if (field.type === 'array') {
    if (!Array.isArray(value) || value.length < field.minItems || value.length > field.maxItems) fail(path,`supply ${field.minItems}–${field.maxItems} items`);
    value.forEach((v,i)=>check(v,field.items,`${path}[${i}]`));
  } else if (field.type === 'string') {
    if (typeof value !== 'string' || [...value].length > field.maxLength) fail(path,`supply text of at most ${field.maxLength} characters`);
  } else if (!Number.isFinite(value) || value < field.minimum || value > field.maximum) fail(path,`supply a finite number in ${field.minimum}–${field.maximum}`);
}
export function validateContent(kind, input={}) {
  const component=components[kind]; if (!component) fail('component',`unknown component ${kind}`);
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail(kind,'supply a content object');
  for (const key of Object.keys(input)) if (!component.fields[key]) fail(`${kind}.${key}`,'unsupported content field');
  const data={};
  for (const [key,field] of Object.entries(component.fields)) {data[key]=structuredClone(input[key] ?? field.default);check(data[key],field,`${kind}.${key}`);}
  if (kind==='chart' && data.labels.length!==data.values.length) fail('chart.values','supply one value for each label');
  for (const key of ['text','caption','appName']) if (key in data && !data[key].trim()) fail(`${kind}.${key}`,'supply nonempty text');
  for (const key of ['words','labels','toggles']) if (data[key]?.some(v=>!v.trim())) fail(`${kind}.${key}`,'remove empty items');
  return data;
}
export function validateStyle(input={}) {
  const allowed=Object.keys(looks.editorial);
  for(const k of Object.keys(input)) if(!allowed.includes(k)) fail(`style.${k}`,'unsupported style field');
  const style={...looks.editorial,...input};
  if(!['Geist','Archivo'].includes(style.font)) fail('style.font','use bundled Geist or Archivo');
  if(!['Geist','Archivo','Instrument Serif'].includes(style.accentFont)) fail('style.accentFont','use bundled Geist, Archivo or Instrument Serif');
  if(!Number.isFinite(style.weight)||style.weight<100||style.weight>900) fail('style.weight','use a weight from 100 to 900');
  if(!Number.isFinite(style.tracking)||style.tracking<-.08||style.tracking>.1) fail('style.tracking','use em tracking from -0.08 to 0.1');
  for(const key of ['fg','bg','accent']) if(!/^#[0-9a-f]{6}$/i.test(style[key])) fail(`style.${key}`,'use a six-digit hex color');
  if(!Array.isArray(style.palette)||!style.palette.length||style.palette.some(c=>!/^#[0-9a-f]{6}$/i.test(c))) fail('style.palette','use a nonempty array of six-digit hex colors');
  style.palette=[...style.palette];
  return style;
}
export function validateDuration(duration) {
  if(!Number.isFinite(duration)||duration<durationRange.minimum||duration>durationRange.maximum) fail('duration','supply 2–8 seconds');
  return duration;
}
export function nativeVariables(kind, data, style, duration) {
  return [
    ...Object.entries(components[kind].fields).map(([id,f])=>({id,type:f.type==='array'?'string':f.type,role:f.role,label:f.label,default:f.type==='array'?JSON.stringify(data[id]):data[id]})),
    {id:'style',type:'string',role:'style',label:'Style context (JSON)',default:JSON.stringify(style)},
    {id:'duration',type:'number',role:'timing',label:'Duration',default:duration,min:2,max:8,step:1/30}
  ];
}
