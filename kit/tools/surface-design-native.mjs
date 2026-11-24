// Exercise the production surface API inside the real HyperFrames renderer.
// Negative controls change painted CSS while leaving every recipe annotation
// intact, so matching metadata alone cannot make this acceptance gate pass.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createNativeBrowser,SOURCE,sourceHashes} from './migration-browser.mjs';
import {measureDesign} from './design-audit.mjs';
import {surfaceFindings} from './surface-audit.mjs';

export const FORMATS=['9:16','1:1','16:9'];
export const FONTS=['Geist','Archivo'];
export const MUTATIONS=[
  {id:'card-padding',node:'flow',property:'paddingLeft',value:'0px',expected:'surface-padding-drift'},
  {id:'card-gap',node:'flow',property:'rowGap',value:'0px',expected:'surface-gap-drift'},
  {id:'card-inert-gap',node:'flow',property:'display',value:'block',expected:'surface-gap-inert'},
  {id:'flow-negative-margin',node:'flow-body',property:'marginLeft',value:'-100px',expected:'surface-content-inset'},
  {id:'field-padding',node:'field',property:'paddingTop',value:'0px',expected:'surface-padding-drift'},
  {id:'badge-corner',node:'badge',property:'borderBottomRightRadius',value:'0px',expected:'surface-radius-drift'},
  {id:'content-inset',node:'centered-content',property:'left',value:'0px',expected:'surface-content-inset'},
  {id:'child-translation',node:'centered-content',property:'transform',value:'translateY(-200%)',expected:'surface-content-inset'},
  {id:'sibling-anchor',node:'sibling-content',property:'left',value:'0px',expected:'surface-content-inset'},
  {id:'nested-inset',node:'inner',property:'top',value:'0px',expected:'nested-surface-inset-drift'},
  {id:'nested-corner',node:'inner',property:'borderTopLeftRadius',value:'0px',expected:'surface-radius-drift'},
  {id:'independent-gap',node:'field-group',property:'columnGap',value:'0px',expected:'layout-gap-drift'},
];

async function installFixtures(){
  const {createDesignSystem}=await import(new URL('lib/components/design-system.mjs',document.baseURI));
  const instance=window.__pkScenes.s1,{width:W,height:H}=instance.plan;
  const root=document.createElement('div');root.dataset.surfaceFixtureRoot='';instance.sceneRoot.append(root);
  Object.assign(root.style,{position:'absolute',inset:'0',background:'#101820',color:'#f6f6ef'});
  const K={S:Math.min(W,H)/1080,set:(node,styles)=>Object.assign(node.style,styles),uid:name=>`native-${name}`};
  const D=createDesignSystem(K),u=D.unit,px=n=>`${n*u}px`,cols=W>=H?2:1;
  const width=Math.min(280,(W/u-48-(cols-1)*16)/cols),height=100,rows=Math.ceil(5/cols);
  const boardW=cols*width+(cols-1)*16,boardH=rows*height+(rows-1)*16;
  const board=document.createElement('div');root.append(board);
  Object.assign(board.style,{position:'absolute',left:`${(W-boardW*u)/2}px`,top:`${(H-boardH*u)/2}px`,width:px(boardW),height:px(boardH),transform:'translate(5px, 3px) rotate(1deg) scale(.96)'});
  const element=(name,parent=board,text='')=>{
    const node=document.createElement('div');node.dataset.surfaceFixture=name;node.textContent=text;parent.append(node);return node;
  };
  const slot=(node,index)=>Object.assign(node.style,{position:'absolute',left:px((index%cols)*(width+16)),top:px(Math.floor(index/cols)*(height+16)),width:px(width),height:px(height)});
  const label=(name,parent,text,role='body',design=D)=>{const node=element(name,parent,text);design.apply(node,role);return node;};

  const flow=element('flow');slot(flow,0);
  Object.assign(flow.style,{display:'flex',flexDirection:'column',background:'#1b2a35'});D.surface(flow,'card');
  label('flow-title',flow,'Card','cardTitle');label('flow-body',flow,'Shared spacing');

  const group=element('field-group');slot(group,1);Object.assign(group.style,{display:'flex',flexDirection:'column',alignItems:'flex-start'});D.surfaceGap(group,2);
  const field=element('field',group);Object.assign(field.style,{display:'flex',alignItems:'center',width:'100%',background:'#233945'});D.surface(field,'field');label('field-label',field,'Input','controlLabel');
  const badgeDesign=D.forSurface(.85),badge=element('badge',group);Object.assign(badge.style,{display:'inline-flex',alignItems:'center',background:'#b9f24a',color:'#101820'});badgeDesign.surface(badge,'badge');label('badge-label',badge,'Ready','label',badgeDesign);

  const outer=element('outer');slot(outer,2);outer.style.background='#415262';D.surface(outer,'card',{layout:'frame',purpose:'window'});
  const inner=element('inner',outer);const inset=D.space(2);
  Object.assign(inner.style,{position:'absolute',inset:`${inset}px`,background:'#1b2a35',display:'grid',placeItems:'center'});D.surface(inner,'card',{layout:'frame',purpose:'window'});D.nest(inner,outer,{inset});label('nested-label',inner,'Nested frame','controlLabel');

  const centered=element('centered');slot(centered,3);centered.style.background='#1b2a35';const centeredBox=D.surface(centered,'card',{layout:'absolute'});
  const content=label('centered-content',centered,'Centered','body');
  Object.assign(content.style,{position:'absolute',left:`${centeredBox.paddingX}px`,top:'50%',width:`${width*u-2*centeredBox.paddingX}px`,transform:'translateY(-50%)'});D.surfaceContent(centered,content);

  const sibling=element('sibling');slot(sibling,4);sibling.style.background='#1b2a35';const siblingBox=D.surface(sibling,'card',{layout:'absolute'});
  const siblingText=label('sibling-content',board,'Sibling anchor','body');
  Object.assign(siblingText.style,{position:'absolute',left:`${(4%cols)*(width+16)*u+siblingBox.paddingX}px`,top:`${Math.floor(4/cols)*(height+16)*u+siblingBox.paddingY}px`,width:`${width*u-2*siblingBox.paddingX}px`});D.surfaceContent(sibling,siblingText);

  // Redeclaration must remove derived rules without invalidating existing
  // content references. Read browser CSS after the new default recipe applies.
  const canary=element('redeclare-canary',outer);Object.assign(canary.style,{position:'absolute',inset:`${inset}px`});
  D.surface(canary,'card',{layout:'frame',purpose:'window'});D.nest(canary,outer,{inset});
  D.surfaceRadius(canary,{from:'square',to:'rounded',progress:.5});D.surfaceGap(canary,1);
  const anchor=element('redeclare-content',canary);D.surfaceContent(canary,anchor);
  const derived=['surfaceRadiusMotion','surfaceParent','surfaceInset','surfaceGapStep','surfaceGapUnit'];
  const oldId=canary.dataset.surfaceId,oldAnchor=anchor.dataset.surfaceContent;
  const initialized=derived.every(key=>canary.dataset[key]!==undefined);
  D.surface(canary,'card');
  const style=getComputedStyle(canary),redeclare={initialized,idStable:oldId===canary.dataset.surfaceId,
    anchorsPreserved:oldAnchor===anchor.dataset.surfaceContent,derivedCleared:derived.every(key=>canary.dataset[key]===undefined)&&canary.dataset.surfacePurpose===undefined,
    layout:canary.dataset.surfaceLayout,density:canary.dataset.surfaceDensity,shape:canary.dataset.surfaceShape,
    padding:[style.paddingTop,style.paddingRight,style.paddingBottom,style.paddingLeft].map(parseFloat),
    radii:[style.borderTopLeftRadius,style.borderTopRightRadius,style.borderBottomRightRadius,style.borderBottomLeftRadius].map(parseFloat),
    gap:[style.rowGap,style.columnGap].map(parseFloat)};
  canary.remove();
  return {unit:u,localUnit:badgeDesign.unit,surfaces:7,gaps:1,redeclare};
}

async function read(page){
  return page.evaluate(measure=>{
    const root=document.querySelector('[data-surface-fixture-root]');
    const metadata=[...root.querySelectorAll('[data-surface-fixture]')].map(n=>({id:n.dataset.surfaceFixture,data:{...n.dataset}}));
    const transforms=[...root.querySelectorAll('*')].map(n=>n.getAttribute('style'));
    const measured=(0,eval)(`(${measure})`)(root);
    const restored=[...root.querySelectorAll('*')].map(n=>n.getAttribute('style'));
    return {measured,metadata,stylesRestored:JSON.stringify(transforms)===JSON.stringify(restored)};
  },measureDesign.toString());
}

export async function run({out,source=SOURCE,aspects=FORMATS,fonts=FONTS}={}){
  assert.ok(!fs.existsSync(out),'Use a fresh output directory');fs.mkdirSync(out,{recursive:true});
  const browser=await createNativeBrowser({source}),page=await browser.newPage();
  const report={schema:'pure-kinetic.surface-design-native.v1',harnessSha256:createHash('sha256').update(fs.readFileSync(fileURLToPath(import.meta.url))).digest('hex'),sourceReceipt:page.sourceHashes,total:fonts.length*aspects.length,results:[]};
  const write=()=>{report.completed=report.results.length;report.failed=report.results.filter(r=>!r.passed).length;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');};
  try{
    for(const font of fonts)for(const aspect of aspects){
      const row={id:`surface-${aspect.replace(':','x')}-${font}`,aspect,font,errors:[],negativeControls:[]};
      try{
        const {plan}=await page.play({aspect,style:'noir',pace:'normal',grain:false,sparks:false,brand:{name:'Surface tests',font},music:{bpm:108,track:'none'},scenes:[{type:'title',text:'Surface tests',beats:4}]});
        await page.shoot(plan.scenes[0].start+plan.scenes[0].dur*.6);
        row.fixture=await page.evaluate(installFixtures);
        const redeclare=row.fixture.redeclare;
        for(const key of ['initialized','idStable','anchorsPreserved','derivedCleared'])assert.equal(redeclare[key],true,`Surface redeclaration: ${key}`);
        assert.deepEqual([redeclare.layout,redeclare.density,redeclare.shape],['flow','normal','rounded']);
        for(const [key,value]of [['padding',16],['radii',16],['gap',12]])assert.ok(redeclare[key].every(actual=>Math.abs(actual-value*row.fixture.unit)<.01),`Redeclared card must use default ${key}`);
        const clean=await read(page);assert.ok(clean.stylesRestored,'Measurement must restore actual authored CSS');
        assert.equal(clean.measured.surfaces.length,row.fixture.surfaces);assert.equal(clean.measured.gaps.length,row.fixture.gaps);
        assert.equal(new Set(clean.measured.surfaces.map(s=>s.id)).size,row.fixture.surfaces,'Production API must assign distinct surface ids');
        assert.equal(new Set(clean.measured.surfaces.map(s=>s.unit)).size,2,'Surface ids must remain unique across D and D.forSurface');
        assert.ok(clean.measured.brandFont.toLowerCase().includes(font.toLowerCase()),'Native fixture must inherit the requested real brand font');
        assert.deepEqual(surfaceFindings(clean.measured),[],'Valid production surfaces must pass actual browser measurements');
        const centered=clean.metadata.find(n=>n.id==='centered').data.surfaceId;
        const actual=clean.measured.surfaces.find(s=>s.id===centered),child=actual.content[0];
        assert.ok(Math.abs(child.y-(actual.height-child.h)/2)<.1,'Static child translateY(-50%) must survive camera normalization');
        for(const mutation of MUTATIONS){
          const saved=await page.evaluate(({node,property,value})=>{const target=document.querySelector(`[data-surface-fixture="${node}"]`),style=target.getAttribute('style');target.style[property]=value;return style;},mutation);
          const changed=await read(page),findings=surfaceFindings(changed.measured);
          assert.ok(changed.stylesRestored,'Measurement must restore CSS even on a broken fixture');
          assert.deepEqual(changed.metadata,clean.metadata,'Negative controls must leave recipe metadata untouched');
          assert.ok(findings.some(f=>f.kind===mutation.expected),`${mutation.id}: expected ${mutation.expected}, found ${JSON.stringify(findings)}`);
          await page.evaluate(({node,style})=>{const target=document.querySelector(`[data-surface-fixture="${node}"]`);if(style===null)target.removeAttribute('style');else target.setAttribute('style',style);},{node:mutation.node,style:saved});
          const restored=await read(page);assert.deepEqual(restored,clean,`${mutation.id}: restoration must reproduce every measured value`);
          assert.deepEqual(surfaceFindings(restored.measured),[]);
          row.negativeControls.push({id:mutation.id,rejectedAs:mutation.expected,metadataUnchanged:true,restoredExact:true});
        }
        row.image=`${row.id}.png`;await page.screenshot({path:path.join(out,row.image)});
        row.design=clean.measured;row.staticCenteringPreserved=true;row.uniqueSurfaceIds=true;
        assert.deepEqual(page.errors,[]);assert.deepEqual(page.externalRequests,[]);row.passed=true;
      }catch(error){row.passed=false;row.errors.push(String(error.stack??error));await browser.recycle();}
      report.results.push(row);write();console.log(row.id,row.passed?'pass':row.errors[0].split('\n')[0]);
    }
  }finally{await browser.close();}
  report.sourceAfter=sourceHashes(source);report.sourceStable=report.sourceReceipt.aggregate===report.sourceAfter.aggregate;
  report.passed=report.sourceStable&&report.results.every(row=>row.passed);write();return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),option=(name,otherwise)=>args.includes('--'+name)?args[args.indexOf('--'+name)+1]:otherwise;
  const report=await run({out:path.resolve(option('out','/tmp/pk-surface-native')),source:path.resolve(option('source',SOURCE)),
    ...(option('aspects')?{aspects:option('aspects').split(',')}:{ }),...(option('fonts')?{fonts:option('fonts').split(',')}:{ })});
  if(!report.passed)process.exitCode=1;
}
