// One-time source-preserving migration from the frozen Kinetic scene snapshot.
// Usage: node tools/migration-components.mjs <old-engine-directory> <fresh-output-directory>
// New component files are subsequently maintained directly. metadata.mjs is the
// generated browser counterpart of canonical components/metadata.cjs.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE=path.resolve(HERE,'..');
if(process.argv.length!==4)throw new Error('Usage: migration-components.mjs <old-engine-directory> <fresh-output-directory>. Maintained components must never be overwritten.');
const source=path.resolve(process.argv[2]);
const destination=path.resolve(process.argv[3]);
if(!fs.statSync(source,{throwIfNoEntry:false})?.isDirectory())throw new Error('The old-engine-directory must exist. Use the frozen reference, not shipped source.');
if(fs.existsSync(destination))throw new Error('The output directory already exists. Choose a fresh directory; migrated source must never be overwritten.');
const require=createRequire(path.join(fs.realpathSync(path.join(TEMPLATE,'node_modules/hyperframes')),'package.json'));
const {parse}=require('acorn');
const read=name=>fs.readFileSync(path.join(source,name),'utf8');
const write=(name,text)=>{fs.mkdirSync(path.dirname(path.join(destination,name)),{recursive:true});fs.writeFileSync(path.join(destination,name),text);};
const program=text=>parse(text,{ecmaVersion:'latest',sourceType:'module'});
const iife=text=>program(text).body.find(n=>n.type==='ExpressionStatement'&&n.expression.type==='CallExpression').expression.callee.body.body;
const deindent=text=>text.replace(/^\t/gm,'');
const replaceHelpers=text=>text.replaceAll('root.PureMaths','maths').replaceAll('root.PureDom','dom').replaceAll('root.PureMoves','moves').replaceAll('root.PureUi','ui').replaceAll('root.PureType','type').replaceAll('root.PureLayers','layers').replaceAll('root.PureEmoji','emoji');
const objectNames=node=>node.properties.map(p=>p.key.name??p.key.value);
const declarationName=node=>node.type==='VariableDeclaration'?node.declarations[0].id.name:null;
const header='// Independent component support. Adapted with preserved source mathematics; see SOURCE.json.\n';

{
  const text=read('maths.js');
  const call=program(text).body.find(n=>n.type==='ExpressionStatement').expression;
  const body=call.arguments.at(-1).body.body;
  const ret=body.at(-1),names=objectNames(ret.argument);
  write('maths.mjs',header+deindent(text.slice(body[0].start,ret.start))+`\nexport { ${names.join(', ')} };\nexport default { ${names.join(', ')} };\n`);
}

for(const [name,creator,deps] of [
  ['dom','createDom','document = globalThis.document, emoji = null, scale = null'],
  ['moves','createMoves','maths, dom'],['ui','createUi','maths, dom'],['type','createType','maths, dom'],
  ['layers','createLayers','maths, dom, moves'],['decor','createDecor','maths, dom, moves, layers'],
]){
  const text=read(`${name}.js`),body=iife(text),last=body.at(-1);
  let code=replaceHelpers(text.slice(body[0].start,last.start));
  const exports=replaceHelpers(text.slice(last.expression.right.start,last.expression.right.end));
  if(name==='dom')code=`const getComputedStyle = document.defaultView.getComputedStyle.bind(document.defaultView);\nconst NodeFilter = document.defaultView.NodeFilter;\n${code}`;
  write(`${name}.mjs`,header+`export function ${creator}({ ${deps} }) {\n${code}\n${name==='dom'?'useScale(scale);\n':''}return ${exports};\n}\n`);
}

{
  const text=read('own.js'),body=iife(text);
  const start=body.find(n=>declarationName(n)==='panel');
  const end=body.find(n=>n.type==='ExpressionStatement'&&n.expression.type==='AssignmentExpression'&&n.expression.left.property?.name==='PureKit');
  write('own-kit.mjs',header+`export function createOwnKit({dom}) {\n${replaceHelpers(text.slice(start.start,end.start))}\nreturn ${text.slice(end.expression.right.start,end.expression.right.end)};\n}\n`);
}

let builtinTypes;
{
  const text=read('builtin.js'),body=iife(text);
  const of=body.find(n=>declarationName(n)==='of').declarations[0].init;
  const dependencies=body.filter(n=>n.type==='VariableDeclaration'&&declarationName(n)!=='of');
  const ofCode=text.slice(of.body.start+1,of.body.end-1).replace('= film;','= K;');
  builtinTypes=of.body.body.filter(n=>n.type==='ExpressionStatement'&&n.expression.type==='AssignmentExpression'&&n.expression.left.object?.name==='SCENES').map(n=>n.expression.left.property.name??n.expression.left.property.value);
  write('builtin.mjs',header+`export function createBuiltin(K) {\nconst {maths,dom,moves,ui}=K.helpers;\n${dependencies.map(n=>replaceHelpers(text.slice(n.start,n.end))).join('\n')}\n${ofCode}\n}\n`);
}

// Evaluate only registration and metadata. No scene builder runs in this VM.
const definitions={};
const registration={PureDefine:(name,def)=>{definitions[name]=def;},PureKit:{}};
const context=vm.createContext(registration);
const ownFamilies=['glass','words','cards','bursts'];
for(const family of ownFamilies)vm.runInContext(read(`scenes/${family}.js`),context);
const literal=value=>{
  if(typeof value!=='function')return JSON.stringify(value,null,2);
  const text=value.toString();
  return /^\w+\s*\(/.test(text)?`function ${text}`:text;
};
const metadataBody=`// Canonical component metadata and action timing. Browser metadata.mjs is generated from this file.\nconst spread=(n,from,to)=>Array.from({length:n},(_,i)=>n<2?from:from+(to-from)*i/(n-1));\nconst definitions={\n${Object.entries(definitions).map(([name,def])=>`${JSON.stringify(name)}:{\n${Object.entries(def).filter(([key])=>key!=='build').map(([key,value])=>`${JSON.stringify(key)}:${literal(value)}`).join(',\n')}\n}`).join(',\n')}\n};\n`;
write('metadata.cjs',metadataBody+'module.exports = definitions;\n');
write('metadata.mjs',metadataBody+'export {definitions};\nexport default definitions;\n');

const renderMode=type=>['trail','particles','gather'].includes(type)?'canvas':'dom';
const catalog=Object.fromEntries(builtinTypes.map(type=>[type,{family:'builtin',renderMode:renderMode(type)}]));
const ordinaryFamilies=['text','data','ui','flow','hands','reel','studio'];
for(const family of ordinaryFamilies){
  const text=read(`scenes/${family}.js`),body=iife(text);
  const names=body.filter(n=>n.type==='ExpressionStatement'&&n.expression.type==='AssignmentExpression'&&n.expression.left.object?.name==='S_').map(n=>n.expression.left.property.name??n.expression.left.property.value);
  let code=deindent(text.slice(body[0].start,body.at(-1).end));
  code=code.replace('const S_ = (window.PureScenes ??= {});','const sceneFactories = {};').replaceAll('S_.','sceneFactories.').replaceAll('S_[','sceneFactories[');
  write(`scenes/${family}.mjs`,header+code+'\nexport {sceneFactories};\nexport default sceneFactories;\n');
  for(const type of names)catalog[type]={family,renderMode:renderMode(type)};
}
for(const family of ownFamilies){
  const text=read(`scenes/${family}.js`),body=iife(text);
  let code='';
  const names=[];
  for(const node of body){
    if(declarationName(node)==='define')continue;
    if(node.type==='ExpressionStatement'&&node.expression.type==='CallExpression'&&node.expression.callee.name==='define'){
      const [name,obj]=node.expression.arguments,build=obj.properties.find(p=>p.key.name==='build');
      const value=build.value;
      code+=`const definition_${name.value.replaceAll('-','_')}={...metadata[${JSON.stringify(name.value)}],build(${value.params.map(p=>text.slice(p.start,p.end)).join(',')})${text.slice(value.body.start,value.body.end)}};\n`;
      code+=`sceneFactories[${JSON.stringify(name.value)}]=given=>definition_${name.value.replaceAll('-','_')}.build(given);\n`;
      names.push(name.value);
    }else code+=text.slice(node.start,node.end)+'\n';
  }
  code=code.replaceAll('root.PureKit','kit').replaceAll('root.PureMoves','K.helpers.moves');
  write(`scenes/${family}.mjs`,header+`import metadata from '../metadata.mjs';\nimport {createOwnKit} from '../own-kit.mjs';\nexport function createFamily(K) {\nconst kit=createOwnKit({dom:K.helpers.dom});\nconst sceneFactories={};\n${code}\nreturn {sceneFactories};\n}\n`);
  for(const type of names)catalog[type]={family,renderMode:renderMode(type),owned:true};
}
{
  let text=read('scenes/three.js');
  const names=program(text).body.filter(n=>n.type==='ExpressionStatement'&&n.expression.type==='AssignmentExpression'&&n.expression.left.object?.name==='S_').map(n=>n.expression.left.property.name??n.expression.left.property.value);
  text=text.replace('import * as THREE from "three";','import * as THREE from "../../vendor/three/three.module.min.js";')
    .replace('const S_ = (window.PureScenes ??= {});','const sceneFactories = {};').replaceAll('S_.','sceneFactories.').replaceAll('S_[','sceneFactories[')
    .replace('window.__pure3d?.();','');
  write('scenes/three.mjs',text+'\nexport {sceneFactories};\nexport default sceneFactories;\n');
  for(const type of names)catalog[type]={family:'three',renderMode:'webgl'};
}
write('catalog.json',JSON.stringify(catalog,null,2)+'\n');
write('catalog.mjs',`export const catalog=${JSON.stringify(catalog,null,2)};\nexport default catalog;\n`);
write('index.mjs',header+`import {createBuiltin} from './builtin.mjs';\nimport metadata from './metadata.mjs';\nimport catalog from './catalog.mjs';\n${ordinaryFamilies.map(f=>`import {sceneFactories as ${f}} from './scenes/${f}.mjs';`).join('\n')}\n${ownFamilies.map(f=>`import {createFamily as create_${f}} from './scenes/${f}.mjs';`).join('\n')}\n\nexport {catalog};\nexport function createComponentLibrary(K){\n const builtin=createBuiltin(K);\n const factories={...builtin.SCENES,${ordinaryFamilies.map(f=>`...${f}`).join(',')},${ownFamilies.map(f=>`...create_${f}(K).sceneFactories`).join(',')}};\n const types=Object.keys(catalog);\n return {types,selfCamera:new Set(builtin.SELF_CAMERA),logoNode:builtin.logoNode,definitions:metadata,has:type=>Object.hasOwn(catalog,type),\n  async get(type){\n   if(!Object.hasOwn(catalog,type))throw new Error('Unknown component: '+type);\n   if(catalog[type].family==='three'){const {sceneFactories}=await import('./scenes/three.mjs');return sceneFactories[type];}\n   const factory=factories[type];if(typeof factory!=='function')throw new Error('Missing component factory: '+type);return factory;\n  }\n };\n}\n`);
const provenance=JSON.parse(read('SOURCE.json'));
provenance.note='Independent instance-local HyperFrames component factories and helper modules. Scene mathematics and visual construction are adapted from the existing licensed source; no film player, shared scene registry or old engine clock is included. Component metadata owns fields, examples, action timing and sound hooks. DOM state, emoji, typography and scene context belong to each instance; the Three renderer/environment cache alone is shared.';
write('SOURCE.json',JSON.stringify(provenance,null,2)+'\n');
console.log(JSON.stringify({destination,types:Object.keys(catalog).length,builtin:builtinTypes.length,own:Object.keys(definitions).length}));
