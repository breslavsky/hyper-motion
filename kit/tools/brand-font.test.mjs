import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import {createContext} from '../source/lib/components/context.mjs';
const require=createRequire(import.meta.url);
const {compile,looks,materials}=require('../source/lib/compiler/plan.cjs');

// Glyph construction needs node ownership and classes, not browser layout.
function documentStub(){
  return {
    defaultView:{getComputedStyle(){return {};},NodeFilter:{SHOW_TEXT:4}},
    createTextNode(text){return {textContent:text};},
    createElement(){
      const node={style:{},dataset:{},children:[],className:'',textContent:'',
        setAttribute(){},appendChild(child){this.children.push(child);return child;}};
      node.classList={add(value){node.className=`${node.className} ${value}`.trim();},contains(value){return node.className.split(/\s+/).includes(value);}};
      return node;
    },
  };
}
function context(font,style='glass',sceneLook){
  const plan=compile({aspect:'16:9',style,material:'glass',brand:{name:'Nook',...(font?{font}:{})},
    scenes:[{type:'title',text:'A *clear* idea',beats:4,...(sceneLook?{look:sceneLook}:{})}]});
  const document=documentStub(),stage={ownerDocument:document,dataset:{}};
  return {source:plan,stage,ctx:createContext({stage,plan,ps:plan.scenes[0]}),document};
}

test('brand fonts keep marked words in one brand face across look and scene-look presets',()=>{
  for(const font of ['Geist','Archivo',{family:'Nook Sans',src:'assets/nook.woff2',weight:600}]){
    for(const [style,sceneLook] of [['glass'],['editorial'],['metal','glass']]){
      const {ctx,source,stage,document}=context(font,style,sceneLook);
      const authoredLook=source.scenes[0].look??source.look,before=structuredClone(authoredLook);
      const {words,glyphs}=ctx.K.glyphText(document.createElement('div'),'A *clear* idea');
      assert.equal(words.find(word=>word.accent).text,'clear','authored emphasis is retained');
      assert.ok(words.every(word=>!word.node.classList.contains('serif')),'the look cannot inject its serif typography');
      assert.equal(glyphs.map(glyph=>glyph.ch).join(''),'Aclearidea');
      assert.equal(ctx.plan.look.display.accent,'color','manual emphasis paths also receive the brand-safe policy');
      if(typeof font==='string')assert.equal(ctx.plan.look.display.family,`${JSON.stringify(font)}, sans-serif`);
      else assert.equal(ctx.plan.look.display.weight,600);
      assert.equal(stage.dataset.brandFont,'');
      assert.deepEqual(ctx.plan.look.feel,authoredLook.feel,'font choice does not change motion');
      assert.deepEqual(ctx.plan.look.material,authoredLook.material,'font choice does not change the selected material');
      assert.deepEqual(authoredLook,before,'native context cannot rewrite compiled defaults');
    }
  }
});

test('recipes without a brand font retain their authored look emphasis',()=>{
  const {ctx,document,stage}=context(undefined);
  const {words}=ctx.K.glyphText(document.createElement('div'),'A *clear* idea');
  assert.equal(ctx.plan.look.display.accent,'serif');
  assert.equal(words.find(word=>word.accent).node.classList.contains('serif'),true);
  assert.equal(stage.dataset.brandFont,undefined);
});

test('native look updates preserve an omitted independent material and honor explicit overrides',()=>{
  for(const material of materials){
    const source=compile({aspect:'16:9',style:'glass',material,brand:{name:'Nook',font:'Geist'},
      scenes:[{type:'title',text:'Brand',beats:4}]});
    const nativeContext=look=>createContext({stage:{ownerDocument:documentStub(),dataset:{}},plan:source,ps:{...source.scenes[0],look}});
    const rawLook=structuredClone(looks.editorial),ctx=nativeContext(rawLook);
    assert.equal(ctx.plan.look.id,'editorial','the supplied native look still applies');
    assert.deepEqual(ctx.plan.look.material,source.look.material,'omission must retain the compiled material and branded marker');
    assert.equal(rawLook.material,undefined,'restoring the material must not rewrite the variable');
    for(const override of [{type:'glass'},{type:'dark-glass'},{type:'metal',variant:'gold'},null]){
      assert.deepEqual(nativeContext({...rawLook,material:override}).plan.look.material,override,'explicit native material wins');
    }
  }
});

test('native look updates retain legacy material behavior when no independent choice was compiled',()=>{
  const source=compile({aspect:'16:9',style:'metal',metalVariant:'gold',brand:{name:'Nook'},
    scenes:[{type:'title',text:'Legacy',beats:4}]});
  const ctx=createContext({stage:{ownerDocument:documentStub(),dataset:{}},plan:source,ps:{...source.scenes[0],look:looks.glass}});
  assert.equal(ctx.plan.look.id,'glass');
  assert.equal(ctx.plan.look.material,undefined,'a legacy look switch must still remove Metal');
});
