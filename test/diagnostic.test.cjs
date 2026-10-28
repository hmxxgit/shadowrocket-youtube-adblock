const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),zlib=require('node:zlib');
const {api,run}=require('./helpers.cjs');
const keyName='SRYouTubeAdblockConfig',key=Buffer.alloc(32,5),iv=Buffer.alloc(16,2);
const cache=()=>({[keyName]:JSON.stringify({youtube:{clientKey:key.toString('base64'),encryptKey:'AQID'},youtubeMusic:{clientKey:'preserve-other-platform',encryptKey:'AQID'}})});
const frames=(type,bytes)=>{const length=bytes.length;const size=length<128?[length]:[(length&63)|128,length>>6];return Buffer.concat([Buffer.from([type,...size]),Buffer.from(bytes)]);};
function encrypted(body,compression=0,badHmac=false){
  const c=crypto.createCipheriv('aes-128-ctr',key.subarray(0,16),iv);
  const ciphertext=Buffer.concat([c.update(body),c.final()]);
  const hmac=badHmac?Buffer.alloc(32):crypto.createHmac('sha256',key.subarray(16)).update(ciphertext).update(iv).digest();
  const message=api.encrypted.create({encryptedContent:new Uint8Array(ciphertext),iv:new Uint8Array(iv),hmac:new Uint8Array(hmac),compressionAlgorithm:compression});
  return new Uint8Array(Buffer.concat([frames(10,[8,25]),frames(11,api.encrypted.toBinary(message))]));
}
function events(logs){return logs.map(line=>{assert.ok(line.startsWith('[YTAD] '));return JSON.parse(line.slice(7));});}
function find(logs,event){return events(logs).find(e=>e.event===event);}
async function execute(kind,{body,requestBody=body,endpoint='initplayback',diagnostic=true,argument,store=cache(),headers={},responseHeaders={}}={}){
  const logs=[],results=[];
  const url=endpoint==='initplayback'?'https://rr1.googlevideo.com/initplayback?ack=1&token=SECRET_QUERY':'https://youtubei.googleapis.com/youtubei/v1/'+endpoint+'?token=SECRET_QUERY';
  const context={Uint8Array,ArrayBuffer,TextEncoder,TextDecoder,
    console:{log:x=>logs.push(String(x))},$argument:argument??('diagnostic='+diagnostic),
    $request:{url,body:requestBody,headers:{'User-Agent':'com.google.ios.youtube',Cookie:'SECRET_COOKIE',Authorization:'SECRET_AUTHORIZATION',...headers}},
    $response:{body,headers:responseHeaders},$notification:{post:()=>{}},
    $persistentStore:{read:k=>store[k]??null,write:(v,k)=>{store[k]=v;return true;}},
    $httpClient:new Proxy({}, {get(){throw Error('Forbidden network');}})};
  const result=await new Promise((resolve,reject)=>{
    context.$done=value=>{results.push(value);resolve(value);};
    try{vm.runInNewContext(fs.readFileSync('scripts/youtube.'+kind+'.js','utf8'),context,{timeout:2000});}catch(error){reject(error);}
  });
  assert.equal(results.length,1);return {result,logs,store};
}
test('diagnostics default/off is silent even for processing failures',async()=>{
  for(const diagnostic of [false]){
    const out=await execute('ump',{body:encrypted(new Uint8Array([0]),0,true),diagnostic});
    assert.equal(out.logs.length,0);assert.equal(Object.keys(out.result).length,0);
  }
  const noArgument=run(Uint8Array.from([255]),'player');assert.equal(noArgument.logs.length,0);
});
test('player diagnostic argument does not break upstream JSON parsing and reports actual field cleanup',()=>{
  const bytes=api.player.toBinary(api.player.create({adSlots:[{}],adPlacements:[{}],playabilityStatus:{}}));
  const off=run(bytes,'player'),on=run(bytes,'player',{$argument:'diagnostic=true'});
  assert.deepEqual(Buffer.from(on.result.body),Buffer.from(off.result.body));
  assert.equal(find(on.logs,'start').endpoint,'player');
  assert.equal(find(on.logs,'ad_fields').found,true);
  assert.equal(find(on.logs,'ad_cleanup').cleaned,true);
  assert.equal(find(on.logs,'finish').pass,false);
  assert.equal(find(on.logs,'finish').success,true);
  const clean=run(api.player.toBinary(api.player.create({playabilityStatus:{}})),'player',{$argument:'diagnostic=true'});
  assert.equal(find(clean.logs,'ad_fields').found,false);assert.equal(find(clean.logs,'ad_cleanup').cleaned,false);
});
test('request without readable bytes preserves cached key instead of deleting it',async()=>{
  for(const requestBody of [undefined,new Uint8Array(),Uint8Array.from([255])]){
    const store=cache(),before=store[keyName];
    const out=await execute('request',{requestBody,store});
    assert.equal(store[keyName],before);assert.equal(Object.keys(out.result).length,0);
    const reason=find(out.logs,'finish').reason;
    assert.ok(['request_body_unavailable','request_key_absent','request_invalid'].includes(reason));
    assert.equal(find(out.logs,'finish').pass,true);
  }
});
test('explicit request-key mismatch invalidates only the affected platform cache',async()=>{
  const store=cache();
  const out=await execute('request',{requestBody:Uint8Array.from([26,5,42,3,4,5,6]),store});
  const saved=JSON.parse(store[keyName]);
  assert.equal(saved.youtube,undefined);assert.ok(saved.youtubeMusic);
  assert.equal(find(out.logs,'finish').reason,'request_key_mismatch');
});
test('partial key cache requests log_event refresh while preserving original request encoding',async()=>{
  const store={[keyName]:JSON.stringify({youtube:{clientKey:key.toString('base64')}})};
  const out=await execute('request',{endpoint:'log_event',store,headers:{'X-Youtube-Hot-Hash-Data':'old','Content-Encoding':'gzip'}});
  assert.equal(out.result.headers['X-Youtube-Hot-Hash-Data'],undefined);
  assert.equal(out.result.headers['Content-Encoding'],'gzip');
  assert.equal(out.result.headers.Cookie,'SECRET_COOKIE');
  assert.equal(find(out.logs,'finish').reason,'key_refresh_requested');
});
test('missing UMP key is reported before entering decryption and original body passes',async()=>{
  const out=await execute('ump',{body:frames(20,[1,2,3]),store:{}});
  // Buffer is a Uint8Array, accepted by runtime.
  assert.equal(find(out.logs,'ump_enter'),undefined);
  assert.equal(find(out.logs,'finish').reason,'missing_key');
  assert.equal(find(out.logs,'finish').pass,true);
  assert.equal(Object.keys(out.result).length,0);
});
for(const compression of [0,1])test(`UMP diagnostic observes HMAC/AES success, cleanup and re-encryption (${compression})`,async()=>{
  const message=api.onesie.toBinary(api.onesie.create({contents:[{player:{adSlots:[{}],playabilityStatus:{}}}]}));
  const input=encrypted(compression===1?zlib.gzipSync(message):message,compression);
  const on=await execute('ump',{body:input}),off=await execute('ump',{body:input,diagnostic:false});
  assert.deepEqual(Buffer.from(on.result.body),Buffer.from(off.result.body));
  assert.equal(find(on.logs,'ump_enter').entered,true);
  assert.equal(find(on.logs,'ump_decrypt').success,true);
  assert.equal(find(on.logs,'ump_reencrypt').success,true);
  assert.equal(find(on.logs,'ad_fields').found,true);
  assert.equal(find(on.logs,'ad_cleanup').cleaned,true);
  assert.equal(find(on.logs,'finish').pass,false);
});
test('HMAC mismatch is distinguished from other errors and invalidates cached key',async()=>{
  const store=cache();const out=await execute('ump',{body:encrypted(new Uint8Array([0]),0,true),store});
  assert.equal(find(out.logs,'ump_enter').entered,true);
  assert.equal(find(out.logs,'ump_decrypt').success,false);
  assert.equal(find(out.logs,'ump_decrypt').reason,'hmac_failed');
  assert.equal(find(out.logs,'finish').reason,'hmac_failed');
  assert.equal(find(out.logs,'finish').pass,true);
  assert.equal(find(out.logs,'ad_cleanup').cleaned,false);
  assert.equal(JSON.parse(store[keyName]).youtube,undefined);assert.ok(JSON.parse(store[keyName]).youtubeMusic);
});
for(const [name,body,reason] of [
  ['unsupported compression',encrypted(new Uint8Array([0]),2),'compression_unsupported'],
  ['bad gzip',encrypted(new Uint8Array([1,2]),1),'decompression_failed'],
  ['bad protobuf',encrypted(new Uint8Array([255]),0),'protobuf_invalid'],
  ['truncated UMP',new Uint8Array([10,255]),'ump_invalid']
])test(`${name} passes through and preserves a potentially valid key`,async()=>{
  const store=cache(),before=store[keyName];const out=await execute('ump',{body,store});
  assert.equal(store[keyName],before);
  assert.equal(find(out.logs,'finish').reason,reason);
  assert.equal(find(out.logs,'finish').success,false);assert.equal(find(out.logs,'finish').pass,true);
  assert.equal(find(out.logs,'ad_cleanup').cleaned,false);
  assert.equal(Object.keys(out.result).length,0);
});
test('unrelated UMP parts pass unchanged with a specific reason',async()=>{
  const out=await execute('ump',{body:new Uint8Array(frames(20,[1,2,3]))});
  assert.equal(Object.keys(out.result).length,0);
  assert.equal(find(out.logs,'finish').reason,'no_encrypted_part');
  assert.equal(find(out.logs,'ump_enter'),undefined);
});
test('diagnostic serialization is strictly allowlisted and never forwards secrets or exception text',async()=>{
  const secret='SECRET_KEY_BODY_TEXT';
  const store={[keyName]:secret};
  const out=await execute('ump',{body:new Uint8Array([255]),store,argument:'diagnostic=true&extra='+secret});
  for(const entry of events(out.logs)){
    for(const key of Object.keys(entry))assert.ok(['version','script','endpoint','event','success','entered','found','cleaned','pass','reason','script_ms','parse_ms','rewrite_ms','encode_ms','decrypt_ms','request_to_response_ms'].includes(key));
    assert.equal(entry.version,'1.5.1');
  }
  const text=out.logs.join('\n');
  for(const value of [secret,'SECRET_COOKIE','SECRET_QUERY','SECRET_AUTHORIZATION',key.toString('base64')])assert.ok(!text.includes(value));
  assert.equal(find(out.logs,'finish').reason,'missing_key');
  assert.ok(events(out.logs).some(x=>x.event==='cache_recovery'&&x.reason==='cache_json_invalid'));
});
test('default module has only the baseline response script and no UMP interception',()=>{
  for(const name of ['youtube-adblock.module','youtube-adblock-diagnostic.module']){
    const module=fs.readFileSync(name,'utf8');
    const lines=module.split('\n').filter(x=>x.includes(' = type=http-'));
    assert.equal(lines.length,name.includes('-diagnostic')?3:1);
    assert.ok(lines[0].includes('type=http-response'));
    assert.ok(lines[0].includes('binary-body-mode=1'));
    assert.ok(lines[0].includes('max-size=-1'));
    assert.ok(lines[0].includes('youtube.response.compat.js'));
    if(!name.includes('-diagnostic'))assert.ok(!module.includes('type=http-request'));
    assert.ok(!module.includes('/youtube.ump.js'));
  }
});
test('published modules pin the exact tested script commit instead of mutable main',()=>{
  const ref=JSON.parse(fs.readFileSync('release.json','utf8')).script_ref;
  assert.match(ref,/^[0-9a-f]{40}$/);
  const exec=require('node:child_process').execFileSync;
  for(const kind of ['request','response','ump','response.compat','timing']){
    const path='scripts/youtube.'+kind+'.js';
    assert.deepEqual(exec('git',['show',ref+':'+path]),fs.readFileSync(path),'pinned script must match tested working file');
  }
  for(const name of ['youtube-adblock.module','youtube-adblock-diagnostic.module']){
    const module=fs.readFileSync(name,'utf8');
    for(const match of module.matchAll(/script-path=(https:\/\/[^\s,]+)/g))assert.ok(match[1].includes('/'+ref+'/scripts/'));
    assert.ok(!module.includes('/main/scripts/'));
  }
});

const adCacheName='SRYouTubeAdblockAdvertiseInfo';
const goodAdCache=()=>JSON.stringify({version:'1.0',whiteNo:[],blackNo:[],whiteEml:[],blackEml:[]});
const adPlayer=()=>api.player.toBinary(api.player.create({adSlots:[{}],adPlacements:[{}],playabilityStatus:{}}));
for(const corruptKey of [keyName,adCacheName])test(`player survives corrupt JSON and invalid object shapes in ${corruptKey}`,async()=>{
  for(const raw of [' ', '{', '{"version":', 'null', '[]', '"cached string"', '42', '{"version":"1.0","whiteNo":false,"blackNo":[],"whiteEml":[],"blackEml":[]}']){
    const store=cache();store[adCacheName]=goodAdCache();store[corruptKey]=raw;
    // An ad-cache shape object is a harmless config dictionary, so use a bad
    // platform record when specifically testing config shape validation.
    if(corruptKey===keyName&&raw.startsWith('{"version"'))store[corruptKey]='{"youtube":{"clientKey":42}}';
    const otherKey=corruptKey===keyName?adCacheName:keyName,before=store[otherKey];
    const out=await execute('response',{endpoint:'player',body:adPlayer(),store});
    const result=api.player.fromBinary(out.result.body);
    assert.equal(result.adSlots.length,0);assert.equal(result.adPlacements.length,0);
    assert.equal(result.playabilityStatus.backgroundPlayerRender.backgroundAbility.active,true);
    assert.equal(store[otherKey],before,'repair must affect only the corrupt cache entry');
    assert.ok(events(out.logs).some(x=>x.event==='cache_recovery'));
    assert.equal(find(out.logs,'finish').success,true);assert.equal(find(out.logs,'ad_cleanup').cleaned,true);
    assert.doesNotThrow(()=>JSON.parse(store[corruptKey]));
  }
});
test('config repairs only a malformed platform record and preserves the other platform',async()=>{
  const store=cache(),validOther=JSON.parse(store[keyName]).youtubeMusic;
  store[keyName]=JSON.stringify({youtube:{clientKey:42},youtubeMusic:validOther});
  await execute('response',{endpoint:'player',body:adPlayer(),store});
  assert.deepEqual(JSON.parse(store[keyName]),{youtubeMusic:validOther});
});
test('request cache recovery still allows key refresh, without changing playback requests',async()=>{
  const store={[keyName]:'{"youtube":'};
  const out=await execute('request',{endpoint:'log_event',store,headers:{'X-Youtube-Hot-Hash-Data':'old'}});
  assert.equal(out.result.headers['X-Youtube-Hot-Hash-Data'],undefined);
  assert.equal(find(out.logs,'finish').reason,'key_refresh_requested');
  assert.equal(out.result.response,undefined);assert.equal(out.result.url,undefined);
});
test('fresh config after corrupt cache restores the local UMP path',async()=>{
  const store={[keyName]:' { ',[adCacheName]:'null'};
  const bytes=api.config.toBinary(api.config.create({responseContext:{globalConfigGroup:{hotConfigGroup:{mediaHotConfig:{onesieHotConfig:{clientKey:new Uint8Array(key),encryptKey:new Uint8Array([1,2,3])}}}}}}));
  const refreshed=await execute('response',{endpoint:'config',body:bytes,store});
  assert.equal(find(refreshed.logs,'finish').reason,'key_cached');
  assert.equal(JSON.parse(store[keyName]).youtube.clientKey,key.toString('base64'));
  const message=api.onesie.toBinary(api.onesie.create({contents:[{player:{adSlots:[{}],playabilityStatus:{}}}]}));
  const decrypted=await execute('ump',{body:encrypted(message),store});
  assert.equal(find(decrypted.logs,'ump_decrypt').success,true);
  assert.equal(find(decrypted.logs,'ad_cleanup').cleaned,true);
});
test('corrupt ad cache cannot abort UMP when its separate key cache is valid',async()=>{
  const store=cache(),before=store[keyName];store[adCacheName]='{"version":';
  const message=api.onesie.toBinary(api.onesie.create({contents:[{player:{adSlots:[{}],playabilityStatus:{}}}]}));
  const out=await execute('ump',{body:encrypted(message),store});
  assert.equal(store[keyName],before);assert.equal(find(out.logs,'ump_decrypt').success,true);
  assert.equal(find(out.logs,'ad_cleanup').cleaned,true);assert.ok(out.result.body instanceof Uint8Array);
});
test('cache storage read/write failures never abort independent player cleanup or log exception text',()=>{
  for(const readFails of [true,false]){
    const out=run(adPlayer(),'player',{$argument:'diagnostic=true',$persistentStore:{read(){if(readFails)throw Error('SECRET_STORAGE_VALUE');return '{';},write(){throw Error('SECRET_STORAGE_VALUE');}}});
    assert.equal(api.player.fromBinary(out.result.body).adSlots.length,0);
    assert.equal(find(out.logs,'finish').success,true);
    assert.ok(events(out.logs).some(x=>x.reason===(readFails?'cache_read_failed':'cache_write_failed')));
    assert.ok(!out.logs.join('\n').includes('SECRET_STORAGE_VALUE'));
  }
});
test('cache recovery remains silent by default and empty legacy arguments cannot cause JSON EOF',async()=>{
  const store={[keyName]:'{',[adCacheName]:' '};
  const out=await execute('response',{endpoint:'player',body:adPlayer(),store,diagnostic:false});
  assert.equal(out.logs.length,0);assert.equal(api.player.fromBinary(out.result.body).adSlots.length,0);
  for(const argument of ['','{']){
    const response=run(adPlayer(),'player',{$argument:argument});
    assert.equal(api.player.fromBinary(response.result.body).adSlots.length,0);
  }
});
test('baseline oad uses an empty successful response rather than the old v1.0 network reject',()=>{
  const exec=require('node:child_process').execFileSync;
  const historic=exec('git',['show','f66c322:youtube-adblock.module'],{encoding:'utf8'});
  assert.ok(historic.includes('oad(?:=[^&#]*)?(?:&|$) - reject'));
  for(const name of ['youtube-adblock.module','youtube-adblock-diagnostic.module']){
    const module=fs.readFileSync(name,'utf8');
    const lines=module.split('[URL Rewrite]')[1].split('[Script]')[0].split('\n').filter(x=>x.includes('oad'));
    assert.equal(lines.length,1);assert.ok(lines[0].endsWith('_ reject-200'));
    assert.ok(!module.includes('URL-REGEX,'));
    const pattern=new RegExp(lines[0].split(' ')[0]);
    assert.ok(pattern.test('https://rr1.googlevideo.com/initplayback?ack=1&oad=1'));
    assert.ok(pattern.test('https://rr1.googlevideo.com/other_init?ack=1&oad=1'));
    assert.ok(!pattern.test('https://rr1.googlevideo.com/videoplayback?ack=1&oad=1'));
    assert.ok(!pattern.test('https://rr1.googlevideo.com/dclk_video_ads?ack=1&oad=1'));
  }
});
