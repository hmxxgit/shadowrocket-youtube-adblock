const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),cp=require('node:child_process');
const {field,feed,section}=require('./fixtures.cjs');
const original=fs.readFileSync('vendor/youtube.response.upstream.js','utf8');
const current=fs.readFileSync('scripts/youtube.response.compat.js','utf8');
const historical=cp.execFileSync('git',['show','1c1184a:scripts/youtube.response.compat.js'],{encoding:'utf8'});
function execute(source,body,endpoint='browse',store={},argument='diagnostic=false'){
 const results=[],logs=[];
 const ctx={Uint8Array,ArrayBuffer,TextEncoder,TextDecoder,console:{log:x=>logs.push(String(x))},
  $request:{url:'https://youtubei.googleapis.com/youtubei/v1/'+endpoint,headers:{'User-Agent':'com.google.ios.youtube'}},$response:{body},
  $argument:argument,$done:x=>results.push(x),$notification:{post:()=>{}},
  $persistentStore:{read:k=>store[k]??null,write:(v,k)=>{store[k]=v;return true;}},
  $httpClient:new Proxy({},{get(){throw Error('No external network allowed');}})};
 const hook='globalThis.api={player:oe,item:te,browse:qr,d,options:ai};try{Ki()}';
 vm.runInNewContext(source.replace('try{Ki()}',hook),ctx,{timeout:2000});
 assert.equal(results.length,1);return {result:results[0],api:ctx.api,logs};
}
const api=execute(current,new Uint8Array()).api;
function extract(source,name,next){return source.slice(source.indexOf('function '+name+'('),source.indexOf('function '+next+'(',source.indexOf('function '+name+'(')));}
test('default compatibility Ni and Br are verbatim upstream, not borrowed custom replacements',()=>{
 assert.equal(extract(current,'Ni','Si'),extract(original,'Ni','Si'));
 assert.equal(extract(current,'Br','ni'),extract(original,'Br','ni'));
});
test('v1.4 Ni cleanup was semantically equal on known ad fields, not evidence of missing deletion',()=>{
 const message=api.player.create({adPlacements:[{}],adSlots:[{}],playabilityStatus:{}});
 const bytes=api.player.toBinary(message);
 for(const source of [original,historical,current]){
   const out=execute(source,bytes,'player',{},'{}');const decoded=api.player.fromBinary(out.result.body);
   assert.equal(decoded.adPlacements.length,0);assert.equal(decoded.adSlots.length,0);
 }
});
test('reproduce historical stale whitelist bypass; compatibility cache isolation restores upstream recognition',()=>{
 const payload=Buffer.concat([Buffer.from('Sponsored https://googleads.g.doubleclick.net/pagead/ads '),Buffer.alloc(1500,32)]);
 const ad=field(999,payload),normal=field(888,Buffer.from('Normal recommendation'));
 const bytes=new Uint8Array(feed([section([normal,ad])]));
 const cache=JSON.stringify({version:'1.0',whiteNo:[999],blackNo:[],whiteEml:[],blackEml:['inline_injection_entrypoint_layout.eml']});
 const oldStore={SRYouTubeAdblockAdvertiseInfo:cache};
 const before=execute(historical,bytes,'browse',oldStore);
 assert.equal(Object.keys(before.result).length,0,'historical cached whitelist bypasses this ad');
 const store={SRYouTubeAdblockAdvertiseInfo:cache};
 const after=execute(current,bytes,'browse',store);
 assert.ok(after.result.body);
 assert.deepEqual(Buffer.from(after.result.body),feed([section([normal])]));
 assert.equal(store.SRYouTubeAdblockAdvertiseInfo,cache,'leave legacy cache untouched');
 assert.ok(JSON.parse(store.SRYouTubeCompatAdCacheV1).blackNo.includes(999));
});
test('empty, malformed and diagnostic arguments never disable Ni or throw JSON EOF',()=>{
 const bytes=api.player.toBinary(api.player.create({adSlots:[{}],playabilityStatus:{}}));
 for(const argument of ['', '{', 'diagnostic=false','diagnostic=true','{{{unresolved}}}','null','[]']){
   const out=execute(current,bytes,'player',{},argument);
   assert.equal(api.player.fromBinary(out.result.body).adSlots.length,0);
 }
});
test('valid upstream options are restored with type checks instead of being discarded',()=>{
 const parsed=execute(current,new Uint8Array(),'browse',{},'{"captionLang":"zh-Hans","blockUpload":false,"blockImmersive":false,"blockShorts":true}').api.options();
 assert.equal(parsed.captionLang,'zh-Hans');assert.equal(parsed.blockUpload,false);assert.equal(parsed.blockImmersive,false);assert.equal(parsed.blockShorts,true);
 const invalid=execute(current,new Uint8Array(),'browse',{},'{"captionLang":42,"blockUpload":"false"}').api.options();
 assert.equal(invalid.captionLang,'off');assert.equal(invalid.blockUpload,true);
});
test('oad is exactly upstream, ctier retains only its documented init exclusion, no bare reject or UMP',()=>{
 const baseline=fs.readFileSync('vendor/yfamilys.YouTubeAd.sgmodule','utf8');
 const lines=text=>text.split('[URL Rewrite]')[1].split('[Script]')[0].split('\n').map(x=>x.trim()).filter(x=>x&&!x.startsWith('#'));
 const module=fs.readFileSync('youtube-adblock.module','utf8');
 const reference=lines(baseline),actual=lines(module);
 assert.deepEqual(actual.slice(1),reference.slice(1));
 assert.equal(actual[0],reference[0].replace('(?!dclk_video_ads)','(?!dclk_video_ads|initplayback(?:[/?]|$))'));
 assert.ok(actual[1].endsWith('_ reject-200'));
 assert.ok(!module.includes('youtube.ump.js'));assert.ok(module.includes('engine=jsc,timeout=60'));
});
