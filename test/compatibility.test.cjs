const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const {feed,section,card}=require('./fixtures.cjs');
const upstream=fs.readFileSync('vendor/youtube.response.upstream.js','utf8');
const adapted=fs.readFileSync('scripts/youtube.response.compat.js','utf8');
function run(source,body,endpoint='player',store={},argument){
  const results=[],logs=[];
  const ctx={Uint8Array,ArrayBuffer,TextEncoder,TextDecoder,
    $request:{url:'https://youtubei.googleapis.com/youtubei/v1/'+endpoint,headers:{'User-Agent':'com.google.ios.youtube'}},
    $response:{body},console:{log:x=>logs.push(String(x))},$done:x=>results.push(x),
    $persistentStore:{read:k=>store[k]??null,write:(value,key)=>{store[key]=value;return true;}},
    $notification:{post:()=>{}},$httpClient:new Proxy({},{get(){throw Error('No runtime network allowed');}}),
    $argument:argument??(source===upstream?'{}':'diagnostic=false')};
  const instrumented=source.replace('try{Ki()}','globalThis.api={player:oe,browse:qr,shorts:zr,watch:ei,guide:Zr,d};try{Ki()}');
  vm.runInNewContext(instrumented,ctx,{timeout:2000});
  assert.equal(results.length,1);return {result:results[0],logs,api:ctx.api};
}
const api=run(adapted,new Uint8Array(),'browse').api;
const block=(text,name,next)=>text.split('['+name+']')[1].split('['+next+']')[0].trim().split('\n').map(x=>x.trim()).filter(x=>x&&!x.startsWith('#'));
test('routing/rewrite/MITM and API regex match the user-validated baseline snapshot',()=>{
  const baseline=fs.readFileSync('vendor/yfamilys.YouTubeAd.sgmodule','utf8');
  const module=fs.readFileSync('youtube-adblock.module','utf8');
  for(const [name,next] of [['Rule','URL Rewrite'],['URL Rewrite','Script']])assert.deepEqual(block(module,name,next),block(baseline,name,next));
  assert.equal(module.split('[MITM]')[1].trim(),baseline.split('[MITM]')[1].trim());
  assert.equal(module.match(/pattern=(.*?),requires-body/)[1],baseline.match(/pattern=(.*?),requires-body/)[1]);
});
const rules=block(fs.readFileSync('youtube-adblock.module','utf8'),'URL Rewrite','Script').map(line=>{
  const [pattern,replacement,type]=line.split(/\s+/);return {pattern:new RegExp(pattern),replacement,type};
});
const match=url=>rules.find(r=>r.pattern.test(url));
test('oad empty-200 semantics, query order and excluded normal media agree with baseline',()=>{
  for(const path of ['initplayback?ack=1&oad=1','initplayback?x=1&oad','other_init?x=1&oad=1'])assert.equal(match('https://rr1.googlevideo.com/'+path).type,'reject-200');
  // Preserve the exact reference condition; do not invent a broader first-param filter.
  for(const path of ['initplayback?oad=1','initplayback?ack=1','videoplayback?x=1&oad=1','dclk_video_ads?x=1&oad=1'])assert.equal(match('https://rr1.googlevideo.com/'+path),undefined);
});
test('ctier redirects reproduce upstream replacement and do not reject media',()=>{
  const url='https://rr1.googlevideo.com/videoplayback?id=123&ctier=L&x=1,ctier,tail';
  const rule=match(url);assert.equal(rule.type,'302');
  assert.equal(url.replace(rule.pattern,rule.replacement),'https://rr1.googlevideo.com/videoplayback?id=123&x=1tail');
  assert.equal(match('https://rr1.googlevideo.com/dclk_video_ads?id=123&ctier=L&x=1,ctier,tail'),undefined);
});
test('ad statistics rewrites are confined to the reference www/s YouTube endpoints',()=>{
  for(const url of ['https://www.youtube.com/api/stats/ads?x=1','https://s.youtube.com/pagead/a','https://www.youtube.com/ptracking?a=1','https://s.youtube.com/api/stats/qoe?adcontext=1'])assert.equal(match(url).type,'reject-200');
  for(const url of ['https://s.youtube.com/api/stats/qoe?normal=1','https://www.youtube.com/watch?v=123','https://example.com/pagead'])assert.equal(match(url),undefined);
});
test('default module references only the vendored compatibility script, no Worker or external runtime',()=>{
  for(const name of ['youtube-adblock.module','youtube-adblock-diagnostic.module']){
    const text=fs.readFileSync(name,'utf8');
    const urls=[...text.matchAll(/script-path=(https:\/\/[^\s,]+)/g)].map(x=>x[1]);
    assert.equal(urls.length,1);assert.match(urls[0],/^https:\/\/raw\.githubusercontent\.com\/hmxxgit\/shadowrocket-youtube-adblock\/[0-9a-f]{40}\/scripts\/youtube\.response\.compat\.js/);
    for(const token of ['youtube.request.js','youtube.ump.js','type=http-request','workers.dev','yfamilys.com'])assert.ok(!text.includes(token));
  }
  assert.ok(!adapted.includes('workers.dev'));assert.ok(!adapted.includes('init-stream'));
});
test('vendored module and upstream response byte hashes match recorded provenance',()=>{
  const meta=JSON.parse(fs.readFileSync('vendor/compatibility-baseline.json','utf8'));
  const hash=path=>crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
  assert.equal(hash('vendor/yfamilys.YouTubeAd.sgmodule'),meta.module_sha256);
  assert.equal(hash('vendor/youtube.response.upstream.js'),meta.script_sha256);
  assert.ok(fs.readFileSync('LICENSE','utf8').includes('Apache License'));
});
for(const endpoint of ['player','get_watch','reel/reel_watch_sequence'])test(`compatibility response matches pinned Maasea Protobuf behavior: ${endpoint}`,()=>{
  let bytes=endpoint==='player'?api.player.toBinary(api.player.create({adPlacements:[{}],adSlots:[{}],playabilityStatus:{},captions:{}})):
    endpoint==='get_watch'?api.watch.toBinary(api.watch.create({contents:[{player:{adSlots:[{}],playabilityStatus:{}}}]})):
    api.shorts.toBinary(api.shorts.create({entries:[{command:{reelWatchEndpoint:{adClientParams:{isAd:true}}}},{command:{reelWatchEndpoint:{adClientParams:{isAd:false}}}}]}));
  if(endpoint==='player'){
    const message=api.player.fromBinary(bytes);
    // A nonempty unknown caption field stands in for untouched subtitle metadata.
    api.d.onRead('',message.captions,999,2,Uint8Array.from([3,97,98,99]));
    bytes=api.player.toBinary(message);
  }
  const reference=run(upstream,bytes,endpoint),current=run(adapted,bytes,endpoint);
  assert.ok(current.result.body);assert.deepEqual(Buffer.from(current.result.body),Buffer.from(reference.result.body));
  if(endpoint==='player'){
    const message=api.player.fromBinary(current.result.body);
    assert.equal(message.adSlots.length,0);assert.equal(message.adPlacements.length,0);
    assert.deepEqual(Array.from(api.d.list(message.captions)[0].data),[3,97,98,99]);
    assert.equal(message.playabilityStatus.backgroundPlayerRender.backgroundAbility.active,true);
    assert.equal(message.playabilityStatus.pictureInPictureRender.pictureInPictureAbility.active,true);
  }
});
test('compatibility profile keeps ordinary Shorts feed cells instead of upstream blanket Shorts hiding',()=>{
  const bytes=new Uint8Array(feed([section([card({layout:'shorts_video_cell.eml'})])]));
  const current=run(adapted,bytes,'browse');assert.equal(Object.keys(current.result).length,0);
});
test('compatibility script retains cache-corruption safeguards and diagnostic opt-in',()=>{
  const bytes=api.player.toBinary(api.player.create({adSlots:[{}],playabilityStatus:{}}));
  const store={SRYouTubeAdblockConfig:'{',SRYouTubeAdblockAdvertiseInfo:' '};
  const on=run(adapted,bytes,'player',store,'diagnostic=true');
  assert.equal(api.player.fromBinary(on.result.body).adSlots.length,0);
  assert.ok(on.logs.some(x=>x.includes('cache_recovery')));assert.ok(on.logs.some(x=>x.includes('"cleaned":true')));
  assert.equal(run(adapted,bytes).logs.length,0);
});
