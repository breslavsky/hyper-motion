import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const P = require('../source/lib/compiler/plan.cjs');
const F = require('../source/lib/film.cjs');
const film = more => ({aspect:'9:16',style:'metal',brand:{name:'Studio'},
  scenes:[{type:'title',text:'Metal',beats:4}],...more});

test('Metal variants compile across formats, with independent looks and palette roles',()=>{
  assert.deepEqual(P.metalVariants,['silver','gold','chromatic']);
  const original=JSON.stringify(P.looks);
  const palettes=[];
  for(const metalVariant of P.metalVariants)for(const aspect of ['9:16','16:9','1:1']){
    const recipe=film({aspect,metalVariant}),plan=F.planOf(recipe);
    assert.equal(plan.style,'metal');
    assert.deepEqual(plan.look.material,{type:'metal',variant:metalVariant});
    assert.equal(plan.sparks,false);
    assert.equal(F.summary(recipe,plan).kit,'soft');
    assert.notEqual(plan.scenes[0].bg,plan.scenes[0].fg);
    if(aspect==='9:16')palettes.push(plan.palette);
  }
  assert.equal(new Set(palettes.map(x=>JSON.stringify(x))).size,3);
  assert.deepEqual(F.planOf(film()).look.material,{type:'metal',variant:'silver'});
  assert.equal(JSON.stringify(P.looks),original,'compilation cannot change shared look defaults');
});

test('scene variants inherit or override without changing surrounding scene styles',()=>{
  const recipe=film({metalVariant:'gold',scenes:[
    {type:'title',text:'Inherit',beats:4},
    {type:'title',text:'Override',beats:4,metalVariant:'chromatic'},
    {type:'title',text:'Glass',beats:4,look:'glass'},
    {type:'title',text:'Same look',beats:4,look:'metal',metalVariant:'silver'},
  ]});
  const plan=F.planOf(recipe),look=i=>plan.scenes[i].look??plan.look;
  assert.deepEqual([0,1,3].map(i=>look(i).material.variant),['gold','chromatic','silver']);
  assert.equal(look(2).id,'glass');assert.equal(look(2).material,undefined);
  assert.notDeepEqual(plan.scenes[1].palette,plan.palette);
  const mixed=F.planOf(film({style:'glass',scenes:[{type:'title',text:'Accent',beats:4,look:'metal'}]}));
  assert.deepEqual(mixed.scenes[0].look.material,{type:'metal',variant:'silver'});
});

test('invalid and misplaced material variants fail before build',()=>{
  for(const metalVariant of ['bronze','Gold',null,1,{},[]]){
    assert.match(F.problems(film({metalVariant})).join('\n'),/metalVariant/);
    assert.match(F.problems(film({scenes:[{type:'title',text:'Bad',beats:4,metalVariant}]})).join('\n'),/metalVariant/);
  }
  assert.match(F.problems(film({style:'glass',metalVariant:'gold'})).join('\n'),/needs "style": "metal"/);
  assert.match(F.problems(film({scenes:[{type:'title',text:'Bad',beats:4,look:'glass',metalVariant:'gold'}]})).join('\n'),/needs the Metal look/);
});

test('material variants never become visible copy in review or the film storybook',()=>{
  const recipe=film({scenes:[
    {type:'title',text:'Точный свет',sub:'На каждой грани',beats:4,metalVariant:'silver'},
    {type:'glass-island',title:'Новая поверхность',body:'Сохраняем ваши слова.',beats:4,metalVariant:'gold'},
    {type:'endcard',tagline:'Создано для вас.',cta:'Начать',beats:5,metalVariant:'chromatic'},
  ]});
  const plan=F.planOf(recipe),review=F.review(recipe,plan),book=F.book(recipe,plan);
  assert.deepEqual(review.scenes.map(s=>s.words),[
    ['Точный свет','На каждой грани'],['Новая поверхность','Сохраняем ваши слова.'],['Создано для вас.','Начать'],
  ]);
  assert.equal(book.lang,'ru');
  assert.deepEqual(book.episodes[0].shots.map(s=>[s.title,s.text]),[
    ['Точный свет','На каждой грани'],['Новая поверхность','Сохраняем ваши слова.'],['Создано для вас.','Начать'],
  ]);
  // Field insertion order cannot turn an enum into the shot's title.
  const reordered=film({scenes:[{type:'endcard',beats:5,metalVariant:'gold',cta:'Начать'}]});
  const reorderedPlan=F.planOf(reordered);
  assert.deepEqual(F.review(reordered,reorderedPlan).scenes[0].words,['Начать']);
  assert.equal(F.book(reordered,reorderedPlan).episodes[0].shots[0].title,'Начать');
});

test('Metal preserves explicit brand roles and other requested looks',()=>{
  const tokens={background:'#121212',foreground:'#eeeeee',accent:'#f4b400',accent2:'#0af'};
  for(const metalVariant of P.metalVariants){
    const plan=F.planOf(film({metalVariant,brand:{name:'Studio',tokens}}));
    const scene=plan.scenes[0];
    assert.equal(scene.bg,tokens.background);assert.equal(scene.fg,tokens.foreground);
    assert.equal(scene.accent,tokens.accent);
    assert.equal(plan.look.material.variant,metalVariant);
  }
  for(const style of ['glass','chrome']){
    const plan=F.planOf(film({style}));
    assert.equal(plan.style,style);assert.equal(plan.look.material,undefined);
  }
});

test('panel material changes preserve copy, brand and order and clean up when switching looks',()=>{
  const original=film({metalVariant:'silver',scenes:[
    {type:'title',text:'First',beats:4,metalVariant:'gold'},
    {type:'title',text:'Second',beats:4,look:'metal',metalVariant:'chromatic'},
  ]});
  const changed=F.changed(original,{metalVariant:'gold'});
  assert.equal(changed.error,undefined);assert.equal(changed.film.metalVariant,'gold');
  assert.deepEqual(changed.film.scenes,original.scenes);assert.deepEqual(changed.film.brand,original.brand);
  assert.equal(original.metalVariant,'silver');
  const glass=F.changed(changed.film,{style:'glass'});
  assert.equal(glass.error,undefined);assert.equal(glass.film.metalVariant,undefined);
  assert.equal(glass.film.scenes[0].metalVariant,undefined);
  assert.equal(glass.film.scenes[1].metalVariant,'chromatic');
  assert.deepEqual(glass.film.scenes.map(s=>s.text),['First','Second']);
  assert.ok(F.changed(glass.film,{metalVariant:'gold'}).error);
  assert.equal(F.changed(glass.film,{metalVariant:'gold',style:'metal'}).error,undefined);
});

test('automatic authoring guidance distinguishes finish requests from generic premium and colour matches',()=>{
  const guide=fs.readFileSync(new URL('../AGENTS.md',import.meta.url),'utf8');
  for(const token of ['style:"metal"','metalVariant:"silver"','"gold"','"chromatic"','жидкий металл','explicit requested style'])assert.ok(guide.includes(token),token);
  assert.ok(guide.includes('"Premium" alone'));
  const pixels=Uint8Array.from(Array.from({length:16},()=>[32,36,44]).flat());
  assert.ok(!F.paletteOf(pixels).looks.includes('metal'),'a grey screenshot does not request animated metal');
});
