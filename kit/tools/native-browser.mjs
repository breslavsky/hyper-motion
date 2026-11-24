// Shared native HyperFrames browser harness for the migration, picture audit
// and contact sheets. Production code does not import this test adapter.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {loadNativeHyperframes} from './native-hyperframes-adapter.mjs';

const HERE=path.dirname(fileURLToPath(import.meta.url));
export const TEMPLATE=path.resolve(HERE,'..');
export const SOURCE=path.join(TEMPLATE,'source');
const require=createRequire(import.meta.url);
const packageRoot=path.join(TEMPLATE,'node_modules/hyperframes');
const {bundleWithLocalizedFonts,serveStaticProjectHtml,openSettledCompositionPage,seekCompositionTimeline}=await loadNativeHyperframes(packageRoot);
export const sharp=createRequire(path.join(fs.realpathSync(packageRoot),'package.json'))('sharp');
export const compiler=()=>require(path.join(SOURCE,'lib/compiler/plan.cjs'));
export function sourceHashes(source=SOURCE){
  const hashes={};
  for(const relative of fs.readdirSync(path.join(source,'lib'),{recursive:true}).filter(file=>/\.(?:m?js|cjs|css)$/.test(file)).sort()){
    hashes[`lib/${relative}`]=createHash('sha256').update(fs.readFileSync(path.join(source,'lib',relative))).digest('hex');
  }
  return {algorithm:'sha256',aggregate:createHash('sha256').update(JSON.stringify(hashes)).digest('hex'),files:hashes};
}

// What a component needs beyond its code (a Lens Wall's example videos) comes
// from our public CDN in a film too, so a check lets that one address through.
const COMPONENT_FILES='https://motion-fab-share.b-cdn.net/components/';
export async function createNativeBrowser({source=SOURCE,blockExternal=true,keepProjects=false,legacy=false,options:defaultOptions={}}={}) {
  let browser;
  const pages=new Set(),receipts=[];
  return {
    receipts,
    async newPage(){
      const folder=fs.mkdtempSync(path.join(os.tmpdir(),'pk-native-audit-'));
      const project=path.join(folder,'source');
      // A test project must not inherit the live project's history identity.
      // Otherwise CLI checks in a clone can close/overwrite the editor's turn.
      fs.cpSync(source,project,{recursive:true,filter:file=>path.basename(file)!=='.hyperframes'});
      let page,server,closed=false;
      const handlers=[];
      const facade={
        project,sourceHashes:sourceHashes(project),errors:[],externalRequests:[],
        on(event,fn){handlers.push([event,fn]);if(page)page.on(event,fn);return facade;},
        async setViewport(){}, // Native composition dimensions come from the film.
        async play(film,{transformProject,options=defaultOptions}={}){
          if(closed)throw new Error('Cannot reopen a closed native audit page');
          if(browser&&!browser.connected)throw new Error('Native audit browser disconnected; stop and restart the run');
          if(page){await page.close();page=null;}
          if(server){await server.close();server=null;}
          facade.errors.length=0;facade.externalRequests.length=0;
          fs.writeFileSync(path.join(project,'film.json'),`${JSON.stringify(film,null,2)}\n`);
          execFileSync(process.execPath,[path.join(project,'lib/film.cjs'),'fit'],{cwd:project,encoding:'utf8',timeout:60000,stdio:['ignore','pipe','pipe']});
          const plan=require(path.join(project,legacy?'lib/engine/plan.js':'lib/compiler/plan.cjs')).compile(film);
          if(!legacy&&Object.keys(options).length)require(path.join(project,'lib/build.cjs')).buildProject(project,film,plan,{options});
          if(transformProject)await transformProject(project,plan);
          const html=await bundleWithLocalizedFonts(project);
          server=await serveStaticProjectHtml(project,html);
          const opened=await openSettledCompositionPage(html,server.url,{
            renderReadyTimeoutMs:60000,browserGpuMode:'hardware',
            prelaunched:browser?{take:async()=>({browser,softwareWebGpu:false})}:undefined,
            beforeNavigate:async p=>{
              for(const [event,fn]of handlers)p.on(event,fn);
              p.on('pageerror',error=>facade.errors.push(error.message));
              if(blockExternal){
                await p.setRequestInterception(true);
                p.on('request',request=>{
                  const u=new URL(request.url());
                  if(request.url().startsWith(COMPONENT_FILES))request.continue();
                  else if(['http:','https:'].includes(u.protocol)&&!['127.0.0.1','localhost'].includes(u.hostname)){
                    facade.externalRequests.push(request.url());request.abort();
                  }else request.continue();
                });
              }
            },
          });
          page=opened.page;browser=opened.browser;
          if(opened.renderReadyTimedOut)throw new Error('Native render readiness timed out');
          if(!legacy){
            await page.waitForFunction(()=>window.__pkFilm?.ready||window.__pkFilm?.errors?.length,{timeout:60000});
            await page.evaluate(async()=>{
              await window.__pkFilm.ready;
              if(window.__pkFilm.errors?.length)throw new Error(window.__pkFilm.errors.join('\n'));
              window.texts=()=>Object.values(window.__pkScenes??{}).flatMap(instance=>instance.textBoxes());
            });
          }
          await seekCompositionTimeline(page,0,{exactTime:true});
          return {duration:plan.duration,width:plan.width,height:plan.height,scenes:plan.scenes.map(s=>[s.start,s.dur]),plan};
        },
        async shoot(time){
          if(!page)throw new Error('Call play(film) before seeking');
          await seekCompositionTimeline(page,time,{exactTime:true});
          const errors=await page.evaluate(()=>window.__pkFilm?.errors??window.__film?.errors??[]);
          if(errors.length)throw new Error(errors.join('\n'));
        },
        async evaluate(fn,...args){if(!page)throw new Error('Call play(film) before evaluating');return page.evaluate(fn,...args);},
        async screenshot(options){if(!page)throw new Error('Call play(film) before capture');return page.screenshot(options);},
        async unload(){
          if(page&&!page.isClosed()&&browser?.connected)await page.close();
          page=null;
          if(server)await server.close();
          server=null;
        },
        async close(){
          if(closed)return;closed=true;
          await facade.unload();
          if(!keepProjects)fs.rmSync(folder,{recursive:true,force:true});
          pages.delete(facade);
        },
      };
      receipts.push({project,sourceHashes:facade.sourceHashes});
      pages.add(facade);return facade;
    },
    async recycle(){for(const page of pages)await page.unload();if(browser?.connected)await browser.close();browser=null;},
    async close(){for(const page of [...pages])await page.close();if(browser?.connected)await browser.close();browser=null;},
  };
}
