"""Reproducible local-only YouTube runtime. Never fetch at build/runtime."""
from pathlib import Path
import hashlib, re
ROOT = Path(__file__).resolve().parent.parent
DIGESTS = {
    'response': 'f98483d5f5017514f82502253c0db5ce2d4ffb7839887aa2cadc22666f5a7f12',
    'request': 'add9d94d712367b929b42a804bc1bf8e42542021e6f6f5e8f412c287c8ef7010',
    'ump': '0694f1ec6ae1cd3406b8032777dbefaa1dc7a30bbb51f5c9de42cda4d5b246d4',
}
def load(kind):
    data = (ROOT / f'vendor/youtube.{kind}.upstream.js').read_bytes()
    assert hashlib.sha256(data).hexdigest() == DIGESTS[kind], 'Review and pin upstream before building'
    return data.decode()
def patch(source, old, new):
    assert source.count(old) == 1, f'Upstream changed: {old[:90]}'
    return source.replace(old, new)
def function(source, name, following, replacement):
    start = source.index(f'function {name}(')
    end = source.index(f'function {following}(', start)
    if source[start-6:start] == 'async ': start -= 6
    if source[end-6:end] == 'async ': end -= 6
    return source[:start] + replacement + source[end:]
def common(source, platform):
    source = patch(source, 'config:"YouTubeConfig",advertiseInfo:"YouTubeAdvertiseInfo"',
                   'config:"SRYouTubeAdblockConfig",advertiseInfo:"SRYouTubeAdblockAdvertiseInfo"')
    source = patch(source, f'({platform}.request.headers["user-agent"]??{platform}.request.headers["User-Agent"]).includes("music")',
                   f'({platform}.request.headers["user-agent"]??{platform}.request.headers["User-Agent"]??"").includes("music")')
    # Diagnostics use a simple non-JSON argument. Do not pass that string to the
    # upstream JSON options parser; all playback/subtitle defaults stay fixed.
    source = patch(source, 'decodeParams(e){return typeof $argument=="string"&&!$argument.includes("{{{")&&Object.assign(e,JSON.parse($argument)),e}', 'decodeParams(e){return e}')
    # All live cache readers (including both bundles in UMP) use a guarded,
    # shape-checked adapter. Binary response parsing stays fromBinary.
    pattern=r'getJSON\(e,t=\{\}\)\{let ([nr])=this.getVal\(e\);return \1\?JSON.parse\(\1\):t\}'
    assert len(re.findall(pattern,source))==1, 'Upstream cache reader changed'
    source=re.sub(pattern,'getJSON(e,t={}){return srReadCache(this,e,t)}',source)
    return source
source = common(load('response'), 'F')
# Record only field presence/cleanup booleans, never payload values.
source = function(source, 'Ni', 'Si', """function Ni(l){
 const found=!!(l.adPlacements?.length||l.adSlots?.length||l.playbackTracking?.pageadViewthroughconversion);
 if(l.adPlacements?.length)l.adPlacements.length=0;
 if(l.adSlots?.length)l.adSlots.length=0;
 if(l.playbackTracking)delete l.playbackTracking.pageadViewthroughconversion;
 srAd(found,found);
}""")
# Restore upstream background/PiP flags, retaining pre-existing/unknown fields.
source = patch(source, 'function Br(l,e){Ni(l),Si(l),Pi(l,e)}', 'function Br(l,e){Ni(l),Si(l)}')
source = function(source, 'Si', 'ce', '''function Si(l){
  const e=l.playabilityStatus;
  if(!e)return;
  e.pictureInPictureRender ??= me.create({pictureInPictureAbility:{active:true,f4:0,f6:0,f8:1}});
  e.pictureInPictureRender.pictureInPictureAbility ??= {active:true,f4:0,f6:0,f8:1};
  Object.assign(e.pictureInPictureRender.pictureInPictureAbility,{active:true,f4:0,f6:0,f8:1});
  e.backgroundPlayerRender ??= ge.create({backgroundAbility:{active:true}});
  e.backgroundPlayerRender.backgroundAbility ??= {active:true};
  e.backgroundPlayerRender.backgroundAbility.active=true;
}
''')
source = patch(source, 'Mi.find(r=>l.url.includes(r.path))', 'Mi.find(r=>l.url.split("?")[0].endsWith("/"+r.path))')
# Replace text/URL heuristics with structural renderer paths and wire-preserving
# list pruning, including containers unknown to the pinned generated schema.
start = source.index('function ni(')
end = source.index('function Tr(', start)
source = source[:start] + (ROOT / 'tools/feed-filter.js').read_text() + source[end:]
source = patch(source, 'try{Ki()}catch(l){console.log(String(l)),F.exit()}',
               'try{srRunResponse()}catch(l){srFailure(srState.reason!=="none"?srState.reason:"protobuf_invalid");F.exit()}')
source = patch(source, 'l.entries.splice(n,1),e=!0', 'l.entries.splice(n,1),srAd(true,true),e=!0')
# Expose only background settings; leave download and unrelated account options alone.
source = function(source, 'ji', 'Vi', '''function ji(l){
 if(!Array.isArray(l.settingItems))return{bodyChanged:false,stateChanged:false};
 let found=false;
 ce(l.settingItems,"backgroundPlayBackSettingRenderer",n=>{
   n.backgroundPlayBackSettingRenderer.backgroundPlayback=true;found=true;return false;
 });
 if(!found)l.settingItems.push(_.create({backgroundPlayBackSettingRenderer:{backgroundPlayback:true}}));
 return{bodyChanged:true,stateChanged:false};
}''')
start = source.index('function ri(')
end = source.index('var Mi=',start)
source = source[:start]+"""function ri(l,{state:e,platformKey:t}){
 const n=l.responseContext?.globalConfigGroup?.hotConfigGroup?.mediaHotConfig?.onesieHotConfig;
 if(!n?.clientKey?.length||!n?.encryptKey?.length){srReason("config_key_unavailable");return{bodyChanged:false,stateChanged:false}}
 const clientKey=Q(n.clientKey),encryptKey=Q(n.encryptKey),prior=e.config[t];
 srReason("key_cached");
 if(prior?.clientKey===clientKey&&prior?.encryptKey===encryptKey)return{bodyChanged:false,stateChanged:false};
 e.config[t]={clientKey,encryptKey};return{bodyChanged:false,stateChanged:true};
}"""+source[end:]
# The same current Protobuf transforms are used for API and encrypted UMP responses.
core = patch(source, 'try{srRunResponse()}catch(l){srFailure(srState.reason!=="none"?srState.reason:"protobuf_invalid");F.exit()}', '''globalThis.__srYouTubeTransform=function(bytes){
 const state={adCache:si(),config:ci()};
 const filtered=srRewriteFeed(bytes);
 if(filtered.cards)srAd(true,true);
 let message;
 try{message=Wi.fromBinary(filtered.bytes)}catch(error){throw srFailure("protobuf_invalid")}
 Vi(message,{params:ai(),state});
 return Wi.toBinary(message);
}''')
ump = common(load('ump'), 'O')
ump = function(ump, 'ns', 'rs', """async function ns(o,e){
 srTrace("ump_enter",{entered:true});
 let t,plain;
 try{t=sn.fromBinary(o)}catch(error){throw srFailure("ump_invalid")}
 try{plain=e.decrypt(t)}catch(error){
   const reason=error?.message==="HMAC verification failed"?"hmac_failed":"crypto_failed";
   srTrace("ump_decrypt",{success:false,reason});throw srFailure(reason);
 }
 srTrace("ump_decrypt",{success:true});
 let decoded;
 if(t.compressionAlgorithm===0)decoded=plain;
 else if(t.compressionAlgorithm===1){
   if(plain.length<18)throw srFailure("decompression_failed");
   const n=plain.length,size=(plain[n-4]|plain[n-3]<<8|plain[n-2]<<16|plain[n-1]<<24)>>>0;
   if(size>16777216)throw srFailure("body_limit");
   try{decoded=Zo(plain)}catch(error){throw srFailure("decompression_failed")}
 }else throw srFailure("compression_unsupported");
 const rewritten=globalThis.__srYouTubeTransform(decoded);
 try{
   const output=t.compressionAlgorithm===1?Xo(rewritten,{level:0,mtime:0}):rewritten;
   const encrypted=e.encrypt(output);
   t.encryptedContent=encrypted.encryptedContent;t.hmac=encrypted.hmac;
   const result=sn.toBinary(t);srTrace("ump_reencrypt",{success:true});return result;
 }catch(error){srTrace("ump_reencrypt",{success:false,reason:"reencryption_failed"});throw srFailure("reencryption_failed")}
}""")
# No protocol-field additions: classify existing failure paths and preserve keys
# unless a cryptographic mismatch actually implicates the cached key.
start = ump.index('async function rs(')
end = ump.index('rs().then(',start)
ump = ump[:start]+"""async function rs(){
 const config=Ui();
 if(!config.clientKey)throw srFailure("missing_key");
 let key;
 try{key=nt(config.clientKey)}catch(error){throw srFailure("invalid_key")}
 if(key.length<=16)throw srFailure("invalid_key");
 const bytes=O.response.bodyBytes;
 if(!bytes)throw srFailure("missing_body");
 const crypto=new Tt(key),reader=new Bt(bytes),writer=new xt(bytes.length);
 let encrypted=false,processed=false;
 srState.stage="ump_invalid";
 while(reader.hasNext()){
   const part=reader.readPart();
   if(part.type===10)encrypted=ea.fromBinary(part.data).type===ts;
   else if(part.type===11&&encrypted){part.data=await ns(part.data,crypto);encrypted=false;processed=true;}
   writer.writePart(part);
 }
 if(!processed){srReason("no_encrypted_part");return null}
 return writer.getBuffer();
}
"""+ump[end:]
# Validate UMP part boundaries instead of silently truncating malformed frames.
ump = patch(ump, 'readU8(){let e=this.buffer[this.offset];', 'readU8(){if(this.offset>=this.buffer.length)throw Error("Truncated UMP varint");let e=this.buffer[this.offset];')
ump = patch(ump, 'readBytes(e){let t=this.buffer.subarray(this.offset,this.offset+e);', 'readBytes(e){if(e<0||this.offset+e>this.buffer.length)throw Error("Truncated UMP part");let t=this.buffer.subarray(this.offset,this.offset+e);')
ump = patch(ump, 'rs().then(o=>{O.done({bodyBytes:o})}).catch(o=>{console.log(o.toString()),jo(),O.done({status:200,headers:{"Content-Type":"text/plain"},bodyBytes:new Uint8Array})});',
            'rs().then(o=>{if(o)O.done({bodyBytes:o});else O.exit()}).catch(()=>{if(srState.reason==="none")srFailure(srState.stage);if(["hmac_failed","invalid_key"].includes(srState.reason))jo();O.exit()});')
request = common(load('request'), 'F')
# Keep original initplayback traffic on device. No redirect, blank response or worker.
start = request.index('function Nt(){')
end = request.index('var rt=F.request.url;', start)
request = request[:start]+"""function Nt(){
 const {encryptKey}=Se(),body=F.request.bodyBytes;
 if(!encryptKey){srReason("missing_key");F.exit();return}
 // Absence of request bytes or an unfamiliar shape does not invalidate a key.
 if(!(body instanceof Uint8Array)){srReason("request_body_unavailable");F.exit();return}
 let key;
 try{key=tt.fromBinary(body).encryptedInnertubeRequest?.encryptedClientKey}catch(error){srFailure("request_invalid");F.exit();return}
 if(!key?.length){srReason("request_key_absent");F.exit();return}
 if(!wt(key,v(encryptKey))){Ue();srReason("request_key_mismatch")}
 else srReason("request_unchanged");
 F.exit();
}"""+request[end:]
request = function(request,'It','Nt',"""function It(){
 const config=Se();
 if(config.clientKey&&config.encryptKey){srReason("request_unchanged");F.exit();return}
 const headers={...F.request.headers};let removed=false;
 for(const name of Object.keys(headers))if(name.toLowerCase()===De){delete headers[name];removed=true}
 srReason(removed?"key_refresh_requested":"missing_key");
 if(removed)F.done({headers});else F.exit();
}""")
# Remove content-encoding only when the body has already been decoded by the engine;
# log_event itself is unmodified, so keep its original encoding header here.
prefix = (ROOT / 'tools/runtime-prefix.js').read_text().replace('DIAGNOSTICS_SOURCE',(ROOT / 'tools/diagnostics.js').read_text()).replace('CACHE_SOURCE',(ROOT / 'tools/cache.js').read_text())
suffix = '\n}catch(error){srFailure(srState.reason!=="none"?srState.reason:"script_error");$done({});}\n})(console);\n'
for kind, body in [('response', source), ('request', request), ('ump', core+'\n'+ump)]:
    output = prefix.replace('SCRIPT_KIND',kind).replace('REQUIRE_BINARY', 'false' if kind=='request' else 'true').replace('IS_REQUEST', 'true' if kind=='request' else 'false')
    (ROOT / f'scripts/youtube.{kind}.js').write_text(output + body + suffix)
    print(f'Built scripts/youtube.{kind}.js')

# Default compatibility profile: the exact reviewed response bundle referenced
# by the user's device-tested module, not the experimental UMP/feed processor.
baseline = common(load('response'), 'F')
baseline = function(baseline,'Ni','Si',source[source.index('function Ni('):source.index('function Si(')])
baseline = patch(baseline, 'let e=l.playabilityStatus;e.pictureInPictureRender', 'let e=l.playabilityStatus;if(!e)return;e.pictureInPictureRender')
# Keep normal Shorts shelves and tabs; retain upstream ad classification otherwise.
baseline = patch(baseline, 'e.blackEml.includes(i)||/shorts(?!_pivot_item)/.test(i)', 'e.blackEml.includes(i)')
baseline = patch(baseline, 'Mi.find(r=>l.url.includes(r.path))', 'Mi.find(r=>l.url.split("?")[0].endsWith("/"+r.path))')
baseline = patch(baseline, 'function Tr(l,{state:e}){return{bodyChanged:Ir(l,e.adCache),stateChanged:e.adCache.dirty}}',
 'function Tr(l,{state:e}){const changed=Ir(l,e.adCache);srAd(changed,changed);return{bodyChanged:changed,stateChanged:e.adCache.dirty}}')
baseline = patch(baseline, 'try{Ki()}catch(l){console.log(String(l)),F.exit()}', 'try{Ki()}catch(l){srFailure("protobuf_invalid");F.exit()}')
output=prefix.replace('SCRIPT_KIND','response').replace('REQUIRE_BINARY','true').replace('IS_REQUEST','false')
(ROOT/'scripts/youtube.response.compat.js').write_text(output+baseline+suffix)
print('Built scripts/youtube.response.compat.js (default baseline profile)')
