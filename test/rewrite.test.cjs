const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {run,api}=require('./helpers.cjs');
const fixtureBytes=require('./fixtures.cjs');
test('player removes pre-roll/mid-roll slots and preserves unknown stream fields', () => {
  const message = api.player.create({adPlacements:[{}],adSlots:[{}]});
  api.d.onRead('', message, 1000, 2, Uint8Array.from([3, 1, 2, 3]));
  const {result, logs} = run(api.player.toBinary(message));
  assert.equal(logs.length, 0);
  const decoded = api.player.fromBinary(result.body);
  assert.equal(decoded.adPlacements.length, 0);
  assert.equal(decoded.adSlots.length, 0);
  assert.deepEqual(Array.from(api.d.list(decoded)[0].data), [3,1,2,3]);
  assert.equal(decoded.playabilityStatus, undefined, 'missing playability is not fabricated');
});
test('Shorts removes ad entries while retaining ordinary Shorts', () => {
  const input = api.shorts.create({entries: [
    {command:{reelWatchEndpoint:{adClientParams:{isAd:true}}}},
    {command:{reelWatchEndpoint:{adClientParams:{isAd:false}}}}
  ]});
  const {result, logs} = run(api.shorts.toBinary(input), 'reel/reel_watch_sequence');
  assert.equal(logs.length, 0);
  assert.equal(api.shorts.fromBinary(result.body).entries.length, 1);
});
test('home/recommendation structured cards removed while normal entries retained', () => {
  const ad=api.item.fromBinary(fixtureBytes.card({ad:true}));
  const normal=api.item.fromBinary(fixtureBytes.card({title:'Sponsored is a title'}));
  const fixture={richItemContents:[normal,ad]};
  assert.equal(api.Ir(fixture,{}),true);
  assert.equal(fixture.richItemContents.length,1);
  assert.equal(fixture.richItemContents[0],normal);
  assert.equal(api.Fi({renderInfo:{layoutRender:{eml:'shorts_video_layout.eml'}}}),false);
});
test('get_watch nested player slots and whole sponsored sections are removed', () => {
  const message=api.getWatch.create({contents:[{player:{adPlacements:[{}],adSlots:[{}]}}]});
  message.contents[0].next=api.next.fromBinary(fixtureBytes.feed([fixtureBytes.section([fixtureBytes.card({ad:true})]),fixtureBytes.section([fixtureBytes.card()])],'next'));
  const bytes=api.getWatch.toBinary(message);
  const out = run(bytes, 'get_watch');
  assert.equal(out.logs.length, 0);
  assert.equal(api.getWatch.fromBinary(out.result.body).contents[0].player.adSlots.length, 0);
  assert.deepEqual(Buffer.from(api.next.toBinary(api.getWatch.fromBinary(out.result.body).contents[0].next)),fixtureBytes.feed([fixtureBytes.section([fixtureBytes.card()])],'next'));
});
test('malformed and non-binary responses pass through', () => {
  for (const body of [undefined, '<html>error</html>', '{"error":"retry"}', Uint8Array.from([255])]) {
    assert.equal(Object.keys(run(body).result).length, 0);
  }
});
test('ArrayBuffer is supported; query parameters cannot select wrong handler', () => {
  const body = api.player.toBinary(api.player.create({adSlots:[{}]}));
  const out = run(body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength), 'player?browse=1');
  assert.equal(api.player.fromBinary(out.result.body).adSlots.length, 0);
});
test('module limits script and reject rules to intended endpoints', () => {
  const module = fs.readFileSync('youtube-adblock.module','utf8');
  const pattern = module.match(/type=http-response,pattern=(.*?),requires-body/)[1];
  const re = new RegExp(pattern);
  assert.ok(re.test('https://youtubei-att.googleapis.com/youtubei/v1/player?x=1'));
  for (const url of ['https://example.com/youtubei/v1/player','https://youtubei.googleapis.com/youtubei/v1/player_extra']) assert.ok(!re.test(url));
  const rules = module.split('[URL Rewrite]')[1].split('[Script]')[0].split('\n').filter(x=>x.startsWith('^')).map(x=>new RegExp(x.split(' ')[0]));
  assert.ok(rules.some(r=>r.test('https://rr1.googlevideo.com/dclk_video_ads?id=1')));
  assert.ok(!rules.some(r=>r.test('https://rr1.googlevideo.com/initplayback?oad=1')));
  for (const url of ['https://rr1.googlevideo.com/videoplayback?oad=1','https://rr1.googlevideo.com/initplayback?notoad=1']) assert.ok(!rules.some(r=>r.test(url)));
  for (const path of module.matchAll(/script-path=https:\/\/raw\.githubusercontent\.com\/[^/]+\/shadowrocket-youtube-adblock\/main\/([^\s,]+)/g)) assert.ok(fs.existsSync(path[1].split("?")[0]));
  assert.equal((module.match(/script-path=/g)||[]).length,4);
});

test('background/PiP flags restored without altering subtitle or unknown permission data', () => {
  const message = api.player.create({playabilityStatus:{backgroundPlayerRender:{backgroundAbility:{active:false}}},captions:{},adSlots:[{}]});
  api.d.onRead('', message.playabilityStatus, 100, 0, Uint8Array.from([1]));
  api.d.onRead('', message.captions, 500, 2, Uint8Array.from([3, 97,98,99]));
  api.d.onRead('', message.playabilityStatus.backgroundPlayerRender, 101, 0, Uint8Array.from([1]));
  const bytes = api.player.toBinary(message);
  const result = api.player.fromBinary(run(bytes).result.body);
  assert.equal(result.playabilityStatus.backgroundPlayerRender.backgroundAbility.active,true);
  assert.equal(result.playabilityStatus.pictureInPictureRender.pictureInPictureAbility.active,true);
  assert.deepEqual(Array.from(api.d.list(result.playabilityStatus)[0].data),[1]);
  assert.deepEqual(Array.from(api.d.list(result.playabilityStatus.backgroundPlayerRender)[0].data),[1]);
  assert.deepEqual(Array.from(api.d.list(result.captions)[0].data),[3,97,98,99]);
});
test('mixed cards with stale cache are inspected structurally, unrelated ad URL text retained', () => {
  const normal=api.item.fromBinary(fixtureBytes.card({title:'https://googleads.g.doubleclick.net/pagead/ads'}));
  const ad=api.item.fromBinary(fixtureBytes.card({ad:true,variant:6,label:'广告'}));
  const fixture={richItemContents:[normal,ad]};
  api.Ir(fixture,{whiteNo:[224590612],blackNo:[],whiteEml:['video_card.eml'],blackEml:[]});
  assert.equal(fixture.richItemContents.length,1);
  assert.equal(fixture.richItemContents[0],normal);
});
test('bodyBytes and typed array views are accepted without stale encoding/length', () => {
  const bytes=api.player.toBinary(api.player.create({adSlots:[{}],playabilityStatus:{}}));
  const {result}=run(undefined,'player',{$response:{bodyBytes:bytes.buffer,headers:{'Content-Encoding':'gzip','content-length':'999','x-keep':'yes'}}});
  assert.ok(result.bodyBytes instanceof Uint8Array);
  assert.equal(result.body,undefined);
  assert.deepEqual(Object.keys(result.headers),['x-keep']);
  assert.equal(api.player.fromBinary(result.bodyBytes).adSlots.length,0);
  assert.ok(run(new DataView(bytes.buffer)).result.body);
});
test('background setting updated without enabling downloads or deleting account settings', () => {
  const input=api.settings.create({settingItems:[{backgroundPlayBackSettingRenderer:{backgroundPlayback:false,download:false}}]});
  api.d.onRead('',input,300,0,Uint8Array.from([1]));
  const result=run(api.settings.toBinary(input),'account/get_setting');
  const decoded=api.settings.fromBinary(result.result.body);
  assert.equal(decoded.settingItems[0].backgroundPlayBackSettingRenderer.backgroundPlayback,true);
  assert.equal(decoded.settingItems[0].backgroundPlayBackSettingRenderer.download,false);
  assert.equal(decoded.settingItems.length,1);
  assert.equal(api.d.list(decoded)[0].no,300);
});

const configKey='SRYouTubeAdblockConfig';
function runtimeContext(body,endpoint='initplayback?ack=1',store={}) {
  return {Uint8Array,ArrayBuffer,TextEncoder,TextDecoder,console:{log:()=>{}},
    $request:{url:'https://rr1.googlevideo.com/'+endpoint,body,headers:{'User-Agent':'com.google.ios.youtube','Cookie':'never-forward-me'}},
    $response:{body,headers:{}},$notification:{post:()=>{}},
    $persistentStore:{read:k=>store[k]??null,write:(v,k)=>{store[k]=v;return true;}},
    $httpClient:new Proxy({}, {get(){throw Error('Network calls are forbidden');}})};
}
function requestRun(body,endpoint,store={},headers={}) {
  const ctx=runtimeContext(body,endpoint,store);Object.assign(ctx.$request.headers,headers);
  const results=[];ctx.$done=x=>results.push(x);
  vm.runInNewContext(fs.readFileSync('scripts/youtube.request.js','utf8'),ctx,{timeout:2000});
  assert.equal(results.length,1);return {result:results[0],ctx};
}
test('config/log_event caches keys locally and leaves original response unchanged', () => {
  for(const endpoint of ['config','log_event']) {
    const store={};const bytes=api.config.toBinary(api.config.create({responseContext:{globalConfigGroup:{hotConfigGroup:{mediaHotConfig:{onesieHotConfig:{clientKey:new Uint8Array(32).fill(7),encryptKey:new Uint8Array([1,2,3])}}}}}}));
    const ctx=runtimeContext(bytes,'',store);
    const result=run(bytes,endpoint,{$persistentStore:ctx.$persistentStore});
    assert.equal(Object.keys(result.result).length,0);
    assert.equal(JSON.parse(store[configKey]).youtube.clientKey,Buffer.alloc(32,7).toString('base64'));
    assert.equal(JSON.parse(store[configKey]).youtube.encryptKey,'AQID');
  }
});
test('log_event refreshes missing key while preserving Cookie and encoding locally', () => {
  const headers={'X-Youtube-Hot-Hash-Data':'stale','Content-Encoding':'gzip'};
  const out=requestRun(undefined,'log_event',{},headers);
  assert.equal(out.result.headers['X-Youtube-Hot-Hash-Data'],undefined);
  assert.equal(out.result.headers.Cookie,'never-forward-me');
  assert.equal(out.result.headers['Content-Encoding'],'gzip');
  assert.equal(out.result.url,undefined);
});
test('initplayback never returns empty media or redirects, whether keys match or not', () => {
  // OnesieRequest field 3 -> encrypted request field 5 -> client key bytes.
  const body=Uint8Array.from([26,5,42,3,1,2,3]);
  for(const key of ['AQID','BAUG',null]) {
    const store=key?{[configKey]:JSON.stringify({youtube:{clientKey:Buffer.alloc(32).toString('base64'),encryptKey:key}})}:{};
    const {result}=requestRun(body,'initplayback?ack=1',store);
    assert.equal(Object.keys(result).length,0);
    assert.equal(result.response,undefined);
    if(key==='BAUG')assert.equal(JSON.parse(store[configKey]).youtube,undefined);
  }
});
const crypto=require('node:crypto'), zlib=require('node:zlib');
function umpInt(value) {
  if(value<128)return Buffer.from([value]);
  if(value<16384)return Buffer.from([(value&63)|128,value>>6]);
  if(value<2097152)return Buffer.from([(value&31)|192,(value>>5)&255,value>>13]);
  throw Error('fixture too large');
}
function frame(type,data){return Buffer.concat([umpInt(type),umpInt(data.length),Buffer.from(data)]);}
function readFrames(data){
  let offset=0;function read(){const b=data[offset++];let n=b<128?1:b<192?2:b<224?3:b<240?4:5;
    let value=n===5?0:b&((1<<(8-n))-1),shift=n===5?0:8-n;
    for(let i=1;i<n;i++){value|=data[offset++]<<shift;shift+=8;}return value;}
  const frames=[];while(offset<data.length){const type=read(),size=read();frames.push({type,data:data.subarray(offset,offset+size)});offset+=size;}return frames;
}
function seal(plain,key,iv){const c=crypto.createCipheriv('aes-128-ctr',key.subarray(0,16),iv);const encryptedContent=Buffer.concat([c.update(plain),c.final()]);
  return {encryptedContent:new Uint8Array(encryptedContent),iv:new Uint8Array(iv),hmac:new Uint8Array(crypto.createHmac('sha256',key.subarray(16)).update(encryptedContent).update(iv).digest())};}
async function umpRun(body,store){
  const ctx=runtimeContext(body,'initplayback?ack=1',store);let calls=0;
  const result=await new Promise((resolve,reject)=>{
    ctx.$done=x=>{calls++;resolve(x);};
    try{vm.runInNewContext(fs.readFileSync('scripts/youtube.ump.js','utf8'),ctx,{timeout:2000});}catch(e){reject(e);}
  });
  assert.equal(calls,1);return result;
}
for(const compression of [0,1])test(`local encrypted UMP round trip removes ads/restores background (compression ${compression})`,async()=>{
  const key=Buffer.alloc(32,5),iv=Buffer.alloc(16,2);
  const container=api.onesie.create({contents:[{player:{adSlots:[{}],adPlacements:[{}],playabilityStatus:{}}}]});
  container.contents[0].next=api.next.fromBinary(fixtureBytes.feed([fixtureBytes.section([fixtureBytes.card({ad:true}),fixtureBytes.card({title:'Preserved recommendation'})])],'next'));
  const onesie=api.onesie.toBinary(container);
  const plain=compression===1?zlib.gzipSync(onesie):onesie;
  const envelope=api.encrypted.toBinary(api.encrypted.create({...seal(plain,key,iv),compressionAlgorithm:compression}));
  const untouched=Buffer.from([9,8,7,6]);
  const body=Buffer.concat([frame(10,[8,25]),frame(11,envelope),frame(20,untouched)]);
  const store={[configKey]:JSON.stringify({youtube:{clientKey:key.toString('base64'),encryptKey:'AQID'}})};
  const result=await umpRun(new Uint8Array(body),store);
  assert.ok(result.body instanceof Uint8Array);
  const frames=readFrames(result.body);
  assert.deepEqual(Buffer.from(frames[2].data),untouched);
  const env=api.encrypted.fromBinary(frames[1].data);
  const hmac=crypto.createHmac('sha256',key.subarray(16)).update(env.encryptedContent).update(env.iv).digest();
  assert.deepEqual(Buffer.from(env.hmac),hmac);
  const cipher=crypto.createDecipheriv('aes-128-ctr',key.subarray(0,16),env.iv);
  const plaintext=Buffer.concat([cipher.update(env.encryptedContent),cipher.final()]);
  const content=api.onesie.fromBinary(compression===1?zlib.gunzipSync(plaintext):plaintext).contents[0];
  const decoded=content.player;
  assert.deepEqual(Buffer.from(api.next.toBinary(content.next)),fixtureBytes.feed([fixtureBytes.section([fixtureBytes.card({title:'Preserved recommendation'})])],'next'));
  assert.equal(decoded.adSlots.length,0);assert.equal(decoded.adPlacements.length,0);
  assert.equal(decoded.playabilityStatus.backgroundPlayerRender.backgroundAbility.active,true);
  assert.equal(decoded.playabilityStatus.pictureInPictureRender.pictureInPictureAbility.active,true);
});
test('missing keys, bad HMAC and truncated UMP pass through without replacing playback',async()=>{
  const key=Buffer.alloc(32,5),iv=Buffer.alloc(16,2);
  const bad=api.encrypted.toBinary(api.encrypted.create({...seal(new Uint8Array(),key,iv),hmac:new Uint8Array(32),compressionAlgorithm:0}));
  for(const [body,store] of [
    [frame(10,[8,25]),{}],
    [Buffer.concat([frame(10,[8,25]),frame(11,bad)]),{[configKey]:JSON.stringify({youtube:{clientKey:key.toString('base64')}})}],
    [Buffer.from([10,100,8]),{[configKey]:JSON.stringify({youtube:{clientKey:key.toString('base64')}})}]
  ]) {
    const out=await umpRun(new Uint8Array(body),store);
    assert.equal(Object.keys(out).length,0);
  }
});
