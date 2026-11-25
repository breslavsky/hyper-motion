import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const P=require('../source/lib/compiler/plan.cjs');
const F=require('../source/lib/film.cjs');

const brand={name:'Nook',font:{family:'Nook Sans',src:'assets/nook.woff2',weight:600},
  tokens:{background:'#102138',foreground:'#f7f5ef',accent:'#f15a37',accent2:'#80c4fb'}};
const recipe=more=>({aspect:'16:9',style:'glass',pace:'normal',brand,
  music:{bpm:108,kit:'soft'},scenes:[
    {type:'title',text:'Your next idea',beats:4},
    {type:'glass-controls',title:'Ready to go',toggles:['Save ideas','Share notes'],slider:'Volume',beats:4,look:'editorial'},
    {type:'glass-island',title:'All in one place',body:'Keep your words',beats:4,look:'metal'},
    {type:'glass-flow',title:'First idea',nextTitle:'Next chapter',beats:16,look:'scifi'},
  ],...more});
const withoutMaterial=plan=>{
  const copy=structuredClone(plan);
  delete copy.look.material;
  for(const scene of copy.scenes)if(scene.look)delete scene.look.material;
  return copy;
};

test('material is an independent validated film choice, including scene look overrides',()=>{
  assert.deepEqual(P.materials,['glass','dark-glass','metal']);
  for(const material of P.materials){
    const film=recipe({material});
    assert.deepEqual(F.problems(film),[]);
    const plan=P.compile(film),finish={type:material,...(material==='metal'?{variant:'silver'}:{}),branded:true};
    assert.equal(plan.style,'glass');
    assert.deepEqual(plan.look.material,finish);
    for(const scene of plan.scenes)assert.deepEqual((scene.look??plan.look).material,finish);
  }
});

test('changing material preserves the complete brand, layout, typography and timing plan in every look and format',()=>{
  const originalLooks=JSON.stringify(P.looks);
  for(const style of Object.keys(P.looks))for(const aspect of Object.keys(P.aspects)){
    const film=recipe({style,aspect}),before=structuredClone(film),base=withoutMaterial(P.compile(film));
    for(const material of P.materials){
      const plan=P.compile({...film,material});
      assert.deepEqual(withoutMaterial(plan),base,`${style} / ${aspect} / ${material}`);
      assert.deepEqual(plan.brand,brand);
      for(const scene of plan.scenes){
        assert.deepEqual([scene.bg,scene.fg,scene.accent],[brand.tokens.background,brand.tokens.foreground,brand.tokens.accent]);
        assert.equal(scene.palette.coral,brand.tokens.accent2);
      }
    }
    assert.deepEqual(film,before,'compilation must not rewrite the supplied recipe');
  }
  assert.equal(JSON.stringify(P.looks),originalLooks,'materials must not mutate shared look definitions');
});

test('material does not introduce a replacement palette when brand roles are absent',()=>{
  for(const style of ['glass','poster','metal']){
    const film=recipe({style,brand:{name:'Nook',font:'Archivo'}}),base=withoutMaterial(P.compile(film));
    for(const material of P.materials)assert.deepEqual(withoutMaterial(P.compile({...film,material})),base);
  }
});

test('omitted material retains legacy Metal variants and scene inheritance',()=>{
  const film=recipe({style:'metal',metalVariant:'gold',scenes:[
    {type:'title',text:'Inherited finish',beats:4},
    {type:'title',text:'Own finish',beats:4,metalVariant:'chromatic'},
    {type:'title',text:'Glass look',beats:4,look:'glass'},
  ]});
  const plan=P.compile(film);
  assert.deepEqual(F.problems(film),[]);
  assert.deepEqual(plan.look.material,{type:'metal',variant:'gold'});
  assert.equal(plan.scenes[0].look,undefined);
  assert.deepEqual(plan.scenes[1].look.material,{type:'metal',variant:'chromatic'});
  assert.equal(plan.scenes[2].look.material,undefined);
  assert.notDeepEqual(plan.scenes[1].brandBase.palette,plan.scenes[0].brandBase.palette);
  for(const material of P.materials)P.compile(recipe({material}));
  assert.deepEqual(P.compile(film),plan,'an explicit material cannot leak into a later legacy recipe');
});

test('invalid materials and all explicit material/variant conflicts reject before compilation',()=>{
  for(const material of [null,{},[],1,true,'gold','Glass','']){
    const film=recipe({material});
    assert.match(F.problems(film).join('\n'),/"material" must be one of glass, dark-glass, metal/);
    assert.throws(()=>P.compile(film),/"material" must be one of glass, dark-glass, metal/);
  }
  for(const material of P.materials)for(const metalVariant of P.metalVariants){
    const film=recipe({style:'metal',material,metalVariant});
    assert.match(F.problems(film).join('\n'),/"material" cannot be combined with "metalVariant"/);
    assert.throws(()=>P.compile(film),/"material" cannot be combined with "metalVariant"/);
    const sceneFilm=recipe({material,scenes:[{type:'title',text:'Own look',beats:4,look:'metal',metalVariant}]});
    assert.match(F.problems(sceneFilm).join('\n'),/scenes\[0\]\.metalVariant cannot be combined with film.material/);
    assert.throws(()=>P.compile(sceneFilm),/scenes\[0\]\.metalVariant cannot be combined with film.material/);
  }
  const sceneMaterial=recipe({scenes:[{type:'title',text:'Unsupported field',beats:4,material:'metal'}]});
  assert.match(F.problems(sceneMaterial).join('\n'),/has no field "material"/);
});
