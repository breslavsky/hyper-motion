// A bounded template-level authoring controller. The writer only returns data;
// it never receives a renderer-editing tool or chooses whether a turn is done.
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import readline from 'node:readline';

export const AUTHORING_LIMITS = Object.freeze({attempts:2, requestBytes:16000, responseBytes:16000});
const canonical = value => JSON.stringify(value, (_key, entry) => entry && typeof entry === 'object' && !Array.isArray(entry)
  ? Object.fromEntries(Object.keys(entry).sort().map(key => [key,entry[key]])) : entry);
const hash = value => createHash('sha256').update(canonical(value)).digest('hex');
const copy = value => JSON.parse(JSON.stringify(value));

function normalizer(normalize) {
  if(typeof normalize!=='function')throw new Error('A production recipe normalizer is required');
  return normalize;
}
function checkContract(contract) {
  if(contract?.schema!=='document-flow.authoring-contract.v1'||hash(contract.recipe)!==contract.sha256)
    throw new Error('Missing or changed frozen brief contract');
}

/** Construct this from trusted brief data, never from the writer's answer. */
export function freezeContract(reference,{normalize}={}) {
  const recipe=copy(normalizer(normalize)(copy(reference)));
  return {schema:'document-flow.authoring-contract.v1',recipe,sha256:hash(recipe)};
}

function differences(actual,expected,at='recipe',out=[]) {
  if(canonical(actual)===canonical(expected))return out;
  if(Array.isArray(expected)&&Array.isArray(actual)) {
    if(actual.length!==expected.length)out.push({path:at,code:'count',expected:expected.length,actual:actual.length});
    for(let i=0;i<Math.min(actual.length,expected.length);i++)differences(actual[i],expected[i],`${at}[${i}]`,out);
  }else if(expected&&actual&&typeof expected==='object'&&typeof actual==='object'&&!Array.isArray(expected)&&!Array.isArray(actual)){
    for(const key of new Set([...Object.keys(expected),...Object.keys(actual)]))differences(actual[key],expected[key],`${at}.${key}`,out);
  }else out.push({path:at,code:'changed',expected:expected??null,actual:actual??null});
  return out;
}

export function checkCandidate(text,contract,{normalize}={}) {
  checkContract(contract);normalizer(normalize);
  if(typeof text!=='string'||Buffer.byteLength(text)>AUTHORING_LIMITS.responseBytes)
    return {ok:false,owner:'recipe',errors:[{code:'response_size',path:'recipe',message:'Return one bounded JSON object'}]};
  let candidate;
  try{candidate=JSON.parse(text);}catch{return {ok:false,owner:'recipe',errors:[{code:'json',path:'recipe',message:'Return JSON only, without fences or explanatory text'}]};}
  let recipe;
  try{recipe=normalize(candidate);}catch(error){return {ok:false,owner:'recipe',errors:[{code:'schema',path:'recipe',message:String(error.message)}]};}
  const errors=differences(recipe,contract.recipe);
  return {ok:errors.length===0,owner:'recipe',errors,...(errors.length?{}:{recipe:copy(recipe)})};
}

/** One proposal and at most one repair. Render/craft diagnostics are not inputs. */
export async function authorRecipe({brief,guide,contract,normalize,generate,maxAttempts=2,maxCostUsd=.02,reservationUsd=.006,timeoutMs=90000}) {
  checkContract(contract);normalizer(normalize);
  if(typeof generate!=='function')throw new Error('A data-only generation adapter is required');
  if(!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>AUTHORING_LIMITS.attempts)throw new Error('At most one proposal and one repair are allowed');
  if(!Number.isFinite(maxCostUsd)||maxCostUsd<0||!Number.isFinite(reservationUsd)||reservationUsd<=0)throw new Error('Use finite positive request reservations and a non-negative budget');
  if(!Number.isFinite(timeoutMs)||timeoutMs<=0||timeoutMs>180000)throw new Error('Use a bounded authoring timeout');
  const messages=[{role:'system',content:String(guide)},{role:'user',content:String(brief)}];
  const attempts=[];let costUsd=0;
  const result=(status,extra={})=>({schema:'document-flow.authoring-result.v1',status,accepted:status==='accepted',contractSha256:contract.sha256,calls:attempts.length,costUsd,attempts,...extra});
  for(let attempt=1;attempt<=maxAttempts;attempt++){
    if(costUsd+reservationUsd>maxCostUsd+1e-12)return result('budget-stop');
    if(Buffer.byteLength(JSON.stringify(messages))>AUTHORING_LIMITS.requestBytes)return result('input-limit');
    const abort=new AbortController();let timer;
    const record={attempt,request:copy(messages)};attempts.push(record);
    let reply;
    try{
      reply=await Promise.race([
        Promise.resolve().then(()=>generate({attempt,messages:copy(messages),signal:abort.signal})),
        new Promise((_,reject)=>{timer=setTimeout(()=>{abort.abort();reject(new Error('authoring timeout'));},timeoutMs);}),
      ]);
    }catch(error){record.error=String(error.message);record.costUnknown=true;return result(abort.signal.aborted?'timeout':'provider-error',{costIncomplete:true});}
    finally{clearTimeout(timer);}
    // Archive the user-visible answer and token/cost metadata, never reasoning.
    record.response={text:reply?.text,model:reply?.model,generationId:reply?.generationId,usage:reply?.usage,costUsd:reply?.costUsd,finishReason:reply?.finishReason};
    if(!Number.isFinite(reply?.costUsd)||reply.costUsd<0){record.costUnknown=true;return result('unmetered',{costIncomplete:true});}
    costUsd+=reply.costUsd;
    if(costUsd>maxCostUsd+1e-12)return result('budget-stop');
    record.validation=checkCandidate(reply.text,contract,{normalize});
    if(record.validation.ok)return result('accepted',{recipe:record.validation.recipe});
    if(attempt<maxAttempts){
      messages.push({role:'assistant',content:reply.text});
      messages.push({role:'user',content:`The fixed brief contract rejected this recipe. Repair only these data errors and return the entire JSON object. Do not add actions or modify the renderer.\n${JSON.stringify(record.validation.errors)}`});
    }
  }
  return result('rejected');
}

// JSONL bridge: the process emits an explicit generation request, the caller
// supplies one provider response. The controller owns all further attempts.
async function session(){
  const lines=readline.createInterface({input:process.stdin,crlfDelay:Infinity})[Symbol.asyncIterator]();
  const read=async()=>{const next=await lines.next();if(next.done)throw new Error('Provider bridge closed');return JSON.parse(next.value);};
  const config=await read();
  const {compile}=await import('../source/lib/sequences/document-flow/model.mjs');
  const normalize=recipe=>compile(recipe).recipe;
  const contract=freezeContract(config.reference,{normalize});
  process.stdout.write(JSON.stringify({type:'contract',contract})+'\n');
  if(config.validateOnly){
    process.stdout.write(JSON.stringify({type:'result',result:{schema:'document-flow.authoring-result.v1',status:'contract-validated',accepted:false,calls:0,costUsd:0,attempts:[],contractSha256:contract.sha256}})+'\n');
    process.stdin.destroy();return;
  }
  const result=await authorRecipe({...config,contract,normalize,generate:async request=>{
    process.stdout.write(JSON.stringify({type:'generate',attempt:request.attempt,messages:request.messages})+'\n');
    const response=await read();
    if(response.type==='error')throw new Error(response.message??'Provider adapter failed');
    return response;
  }});
  process.stdout.write(JSON.stringify({type:'result',result})+'\n');
  process.stdin.destroy();
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv[2]!=='session')throw new Error('Usage: node sequence-authoring.mjs session < JSONL');
  session().catch(error=>{process.stderr.write(`${error.message}\n`);process.exitCode=1;process.stdin.destroy();});
}
