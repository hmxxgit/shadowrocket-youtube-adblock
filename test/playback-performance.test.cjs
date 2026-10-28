const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('scripts/youtube.response.compat.js','utf8');
const observer=fs.readFileSync('scripts/youtube.timing.js','utf8');
function execute({body,endpoint='player',diagnostic=false,store={},id,phase,now=1000,storage,throwClock=false}={}){
 const logs=[],done=[],counts={reads:0,writes:0};let clock=now;
 const ctx={Uint8Array,ArrayBuffer,TextDecoder,TextEncoder,
   Date:class extends Date{static now(){if(throwClock)throw Error('Normal mode should not read timers');return clock;}},
   console:{log:x=>logs.push(String(x))},
   $request:{url:(endpoint==='initplayback'?'https://rr1.googlevideo.com/initplayback':'https://youtubei.googleapis.com/youtubei/v1/'+endpoint)+'?token=PRIVATE_QUERY',id,headers:{Cookie:'PRIVATE_COOKIE','User-Agent':'com.google.ios.youtube'}},
   $response:{body},$argument:'diagnostic='+diagnostic+(phase?'&phase='+phase:''),$done:x=>done.push(x),
   $persistentStore:storage??{read:k=>{counts.reads++;return store[k]??null;},write:(v,k)=>{counts.writes++;store[k]=v;return true;}},
   $notification:{post:()=>{}},$httpClient:new Proxy({},{get(){throw Error('No network I/O allowed');}}),
   tick:n=>{clock+=n;}};
 let code=source.replace('try{Ki()}',`globalThis.api={player:oe,watch:ei,browse:qr,d};globalThis.operations={parse:0,encode:0};
 for(const codec of [oe,ei,qr]){const decode=codec.fromBinary.bind(codec),encode=codec.toBinary.bind(codec);
 codec.fromBinary=function(...args){operations.parse++;tick(4);return decode(...args)};
 codec.toBinary=function(...args){operations.encode++;tick(3);return encode(...args)};}
 for(const entry of Mi){const handler=entry.handler;entry.handler=function(...args){tick(2);return handler(...args)}}
 try{Ki()}`);
 vm.runInNewContext(phase?observer:code,ctx,{timeout:2000});
 assert.equal(done.length,1);return{result:done[0],logs,counts,api:ctx.api,operations:ctx.operations,store};
}
const api=execute({body:new Uint8Array(),endpoint:'browse'}).api;
const player=(overrides={})=>api.player.create({playabilityStatus:{pictureInPictureRender:{pictureInPictureAbility:{active:true,f4:0,f6:0,f8:1}},backgroundPlayerRender:{backgroundAbility:{active:true}}},...overrides});
const events=logs=>logs.map(x=>JSON.parse(x.slice('[YTAD] '.length)));
const timing=logs=>events(logs).find(x=>x.event==='timing');
test('player already clean and enabled: one decode, zero encode, zero cache I/O',()=>{
 const message=player({captions:{}});api.d.onRead('',message.captions,99,2,Uint8Array.from([3,97,98,99]));
 const bytes=api.player.toBinary(message);
 const out=execute({body:bytes,throwClock:true});
 assert.equal(out.operations.parse,1);assert.equal(out.operations.encode,0);
 assert.equal(Object.keys(out.result).length,0);
 assert.equal(out.counts.reads,0);assert.equal(out.counts.writes,0);assert.equal(out.logs.length,0);
});
test('player with ads still removes fields, keeps captions/unknown abilities and encodes once',()=>{
 const message=player({adSlots:[{}],adPlacements:[{}],captions:{}});
 api.d.onRead('',message.playabilityStatus.backgroundPlayerRender,199,0,Uint8Array.from([1]));
 api.d.onRead('',message.captions,99,2,Uint8Array.from([3,97,98,99]));
 const out=execute({body:api.player.toBinary(message)}),decoded=api.player.fromBinary(out.result.body);
 assert.equal(out.operations.parse,1);assert.equal(out.operations.encode,1);
 assert.equal(decoded.adSlots.length,0);assert.equal(decoded.adPlacements.length,0);
 assert.equal(decoded.playabilityStatus.backgroundPlayerRender.backgroundAbility.active,true);
 assert.equal(decoded.playabilityStatus.pictureInPictureRender.pictureInPictureAbility.active,true);
 assert.deepEqual(Array.from(api.d.list(decoded.captions)[0].data),[3,97,98,99]);
 assert.deepEqual(Array.from(api.d.list(decoded.playabilityStatus.backgroundPlayerRender)[0].data),[1]);
});
test('missing/disabled abilities are enabled once; second run is byte-preserving pass-through',()=>{
 const first=execute({body:api.player.toBinary(api.player.create({playabilityStatus:{}}))});
 assert.equal(first.operations.encode,1);
 const second=execute({body:first.result.body});
 assert.equal(second.operations.encode,0);assert.equal(Object.keys(second.result).length,0);
});
test('clean get_watch is decoded once and not re-encoded; dirty nested player is encoded once',()=>{
 const clean=api.watch.toBinary(api.watch.create({contents:[{player:player()}]}));
 const one=execute({body:clean,endpoint:'get_watch'});
 assert.equal(one.operations.parse,1);assert.equal(one.operations.encode,0);assert.equal(one.counts.reads,0);assert.equal(Object.keys(one.result).length,0);
 const dirty=api.watch.toBinary(api.watch.create({contents:[{player:player({adSlots:[{}]})}]}));
 const two=execute({body:dirty,endpoint:'get_watch'});
 assert.equal(two.operations.parse,1);assert.equal(two.operations.encode,1);
 assert.equal(api.watch.fromBinary(two.result.body).contents[0].player.adSlots.length,0);
});
test('malformed/missing responses pass through without synthetic retries, redirects or blank responses',()=>{
 for(const body of [new Uint8Array([255]),undefined,'not binary']){
   const out=execute({body,diagnostic:true});
   assert.equal(Object.keys(out.result).length,0);assert.equal(out.operations?.encode??0,0);
   assert.equal(out.result.url,undefined);assert.equal(out.result.response,undefined);
   assert.equal(timing(out.logs).request_to_response_ms,null);
 }
});
test('diagnostic marker measures request-to-response separately from parse/rewrite/encode',()=>{
 const store={},id='PRIVATE_REQUEST_ID';
 const request=execute({phase:'request',diagnostic:true,id,store,now:1000});
 assert.equal(Object.keys(request.result).length,0);
 assert.ok(!JSON.stringify(store).includes(id));assert.ok(!JSON.stringify(store).includes('PRIVATE_QUERY'));
 const response=execute({body:api.player.toBinary(player()),diagnostic:true,id,store,now:1018});
 const metric=timing(response.logs);
 assert.equal(metric.request_to_response_ms,18);assert.equal(metric.script_ms,6);
 assert.equal(metric.parse_ms,4);assert.equal(metric.rewrite_ms,2);assert.equal(metric.encode_ms,0);assert.equal(metric.decrypt_ms,0);
 assert.equal(JSON.parse(store.SRYouTubeTiming)[Object.keys(JSON.parse(store.SRYouTubeTiming))[0]],undefined);
 for(const secret of [id,'PRIVATE_COOKIE','PRIVATE_QUERY'])assert.ok(!response.logs.join('\n').includes(secret));
});
test('initplayback observer passes request/response unchanged and performs no body processing',()=>{
 const store={},id='init-only';
 const request=execute({phase:'request',endpoint:'initplayback',diagnostic:true,id,store,now:2000});
 const response=execute({phase:'response',endpoint:'initplayback',diagnostic:true,id,store,now:2030});
 assert.equal(Object.keys(request.result).length,0);assert.equal(Object.keys(response.result).length,0);
 assert.equal(timing(response.logs).request_to_response_ms,30);
 assert.equal(timing(response.logs).parse_ms,0);assert.equal(timing(response.logs).decrypt_ms,0);
});
test('absent/ambiguous ids and storage failures report unknown, never guessed network time',()=>{
 const bytes=api.player.toBinary(player());
 const missing=execute({body:bytes,diagnostic:true});
 assert.equal(timing(missing.logs).request_to_response_ms,null);
 assert.equal(timing(missing.logs).reason,'request_id_unavailable');
 const store={},id='duplicate';execute({phase:'request',diagnostic:true,id,store});execute({phase:'request',diagnostic:true,id,store});
 const duplicate=execute({body:bytes,diagnostic:true,id,store});
 assert.equal(timing(duplicate.logs).request_to_response_ms,null);assert.equal(timing(duplicate.logs).reason,'timing_duplicate');
 const failed=execute({body:bytes,diagnostic:true,id,storage:{read(){throw Error('PRIVATE_STORAGE')},write(){throw Error('PRIVATE_STORAGE')}}});
 assert.equal(Object.keys(failed.result).length,0);assert.equal(timing(failed.logs).request_to_response_ms,null);
 assert.equal(timing(failed.logs).reason,'timing_storage_unavailable');assert.ok(!failed.logs.join('\n').includes('PRIVATE_STORAGE'));
});
test('timing cache is bounded/expired and disabled diagnostics never touches it',()=>{
 const store={SRYouTubeTiming:JSON.stringify(Object.fromEntries(Array.from({length:100},(_,i)=>['entry-'+i,{at:1000,endpoint:'player'}])))};
 execute({phase:'request',diagnostic:true,id:'new',store,now:1001});assert.ok(Object.keys(JSON.parse(store.SRYouTubeTiming)).length<=64);
 execute({phase:'request',diagnostic:true,id:'after-expiry',store,now:130000});assert.equal(Object.keys(JSON.parse(store.SRYouTubeTiming)).length,1);
 const off=execute({phase:'request',diagnostic:false,id:'off',store});assert.equal(off.counts.reads,0);assert.equal(off.counts.writes,0);
});
test('all initplayback variants bypass rewrite/redirect; normal mode has no observer or UMP',()=>{
 for(const name of ['youtube-adblock.module','youtube-adblock-diagnostic.module']){
   const module=fs.readFileSync(name,'utf8');
   const rewriteLines=module.split('[URL Rewrite]')[1].split('[Script]')[0].split('\n').map(x=>x.trim()).filter(x=>x.startsWith('^')||x.startsWith('(^'));
   for(const query of ['', '?oad=1','?ack=1&oad=1','?id=123&ctier=L&x=1,ctier,tail','?ack=1&oad=1&ctier=L&x=1,ctier,tail']){
     const url='https://rr1.googlevideo.com/initplayback'+query;
     assert.ok(!rewriteLines.some(line=>new RegExp(line.split(' ')[0]).test(url)),url);
   }
   assert.ok(!module.includes('youtube.ump.js'));assert.ok(!module.includes('youtube.request.js'));
   assert.ok(module.includes('engine=jsc,timeout=60'));
   if(!name.includes('-diagnostic'))assert.ok(!module.includes('type=http-request'));
   else for(const line of module.split('\n').filter(x=>x.startsWith('youtube.timing.'))){assert.ok(line.includes('requires-body=0'));assert.ok(line.includes('youtube.timing.js'));}
 }
});
