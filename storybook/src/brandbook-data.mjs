import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {TEMPLATE} from './catalog-data.mjs';

const require=createRequire(import.meta.url);
const defaultFile=fileURLToPath(new URL('../brandbooks.json',import.meta.url));
const roles=['background','foreground','accent','accent2'];
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);

// Project the existing art directions into complete demo brands at build time.
// The production compiler owns colour contrast and accent selection; only its
// colours and font enter the book, never its layout, motion or material.
function readLookBrandbooks(){
  const {compile,looks,metalVariants}=require(path.join(TEMPLATE,'source/lib/compiler/plan.cjs'));
  const books={};
  for(const [style,look] of Object.entries(looks)){
    for(const variant of style==='metal'?metalVariants:[undefined]){
      const film={aspect:'16:9',style,brand:{name:'Nook',url:'nook.app'},
        ...(variant?{metalVariant:variant}:{}),
        scenes:[{type:'title',text:'Nook',beats:4,bg:look.rhythm[0]}]};
      const plan=compile(film),scene=plan.scenes[0];
      const background=scene.bg==='sky'?plan.palette.sky:scene.bg;
      const accent2=['coral','electric','peach','lilac','butter']
        .map(role=>plan.palette[role])
        .find(color=>color&&![background,scene.fg,scene.accent].includes(color))??scene.accent;
      const id=variant&&variant!=='silver'?`${style}-${variant}`:style;
      const label=variant?variant[0].toUpperCase()+variant.slice(1):look.name;
      books[id]={label:`${label} · demo`,brand:{...film.brand,
        font:look.display.family.split(',')[0].trim().replace(/^['"]|['"]$/g,''),
        tokens:{background,foreground:scene.fg,accent:scene.accent,accent2}}};
    }
  }
  return books;
}

// A complete production brand is the only source of preview colours and font.
// Replacing this manifest connects a real brandbook without creating UI overrides.
export function readBrandbooks(file=process.env.PURE_KINETIC_BRANDBOOKS??defaultFile){
  const resolvedFile=path.resolve(file);
  const books=JSON.parse(fs.readFileSync(resolvedFile,'utf8'));
  if(!object(books)||!Object.keys(books).length)throw new Error('Brandbooks must be a nonempty object keyed by stable IDs');
  if(resolvedFile===defaultFile){
    for(const [id,book] of Object.entries(readLookBrandbooks())){
      if(!Object.hasOwn(books,id))books[id]=book;
    }
  }
  const {problems}=require(path.join(TEMPLATE,'source/lib/film.cjs'));
  for(const [id,book] of Object.entries(books)){
    if(!/^[a-z][a-z0-9-]*$/.test(id)||!object(book)||typeof book.label!=='string'||!book.label.trim())throw new Error(`Invalid brandbook ${id}: expected a URL-safe ID and label`);
    if(!object(book.brand)||!book.brand.font||!object(book.brand.tokens)||roles.some(role=>!/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(book.brand.tokens[role]??'')))throw new Error(`Brandbook ${id} needs a font and all four colour roles: ${roles.join(', ')}`);
    const errors=problems({aspect:'16:9',style:'glass',brand:book.brand,scenes:[{type:'title',text:'Brand',beats:4}]});
    if(errors.length)throw new Error(`Brandbook ${id}: ${errors.join('; ')}`);
    const media=[...(typeof book.brand.font==='object'?[['font',book.brand.font.src]]:[]),...(book.brand.logo!==undefined?[['logo',book.brand.logo]]:[])];
    for(const [kind,src] of media){
      if(typeof src!=='string'||!/^assets\/[\w./-]+$/.test(src)||src.split('/').includes('..'))throw new Error(`Brandbook ${id}: ${kind} must be a local path in source/assets`);
      const asset=path.resolve(TEMPLATE,'source',src);
      if(!fs.existsSync(asset)||!fs.statSync(asset).isFile())throw new Error(`Brandbook ${id}: ${kind} must exist in the selected template's source/assets`);
    }
  }
  return books;
}
