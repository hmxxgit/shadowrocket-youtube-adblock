"""Reproducible local-only YouTube runtime. Never fetch at build/runtime."""
from pathlib import Path
import hashlib
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
    return source
source = common(load('response'), 'F')
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
               'try{srRunResponse()}catch(l){console.log("YouTube Adblock: response unchanged");F.exit()}')
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
# The same current Protobuf transforms are used for API and encrypted UMP responses.
core = patch(source, 'try{srRunResponse()}catch(l){console.log("YouTube Adblock: response unchanged");F.exit()}', '''globalThis.__srYouTubeTransform=function(bytes){
 const state={adCache:si(),config:ci()};
 const filtered=srRewriteFeed(bytes);
 const message=Wi.fromBinary(filtered.bytes);
 Vi(message,{params:ai(),state});
 return Wi.toBinary(message);
}''')
ump = common(load('ump'), 'O')
ump = function(ump, 'ns', 'rs', '''async function ns(o,e){
 const t=sn.fromBinary(o),plain=e.decrypt(t);
 let decoded;
 if(t.compressionAlgorithm===0)decoded=plain;
 else if(t.compressionAlgorithm===1){
   if(plain.length<18)throw Error("Invalid gzip");
   const n=plain.length,size=(plain[n-4]|plain[n-3]<<8|plain[n-2]<<16|plain[n-1]<<24)>>>0;
   if(size>16777216)throw Error("UMP decompressed body exceeds limit");
   decoded=Zo(plain);
 }else throw Error("Unsupported UMP compression");
 const rewritten=globalThis.__srYouTubeTransform(decoded);
 const output=t.compressionAlgorithm===1?Xo(rewritten,{level:0,mtime:0}):rewritten;
 const encrypted=e.encrypt(output);
 t.encryptedContent=encrypted.encryptedContent;t.hmac=encrypted.hmac;
 return sn.toBinary(t);
}''')
# Validate UMP part boundaries instead of silently truncating malformed frames.
ump = patch(ump, 'readU8(){let e=this.buffer[this.offset];', 'readU8(){if(this.offset>=this.buffer.length)throw Error("Truncated UMP varint");let e=this.buffer[this.offset];')
ump = patch(ump, 'readBytes(e){let t=this.buffer.subarray(this.offset,this.offset+e);', 'readBytes(e){if(e<0||this.offset+e>this.buffer.length)throw Error("Truncated UMP part");let t=this.buffer.subarray(this.offset,this.offset+e);')
ump = patch(ump, 'rs().then(o=>{O.done({bodyBytes:o})}).catch(o=>{console.log(o.toString()),jo(),O.done({status:200,headers:{"Content-Type":"text/plain"},bodyBytes:new Uint8Array})});',
            'rs().then(o=>{O.done({bodyBytes:o})}).catch(()=>{jo();console.log("YouTube Adblock: UMP unchanged; key or format unavailable");O.exit()});')
request = common(load('request'), 'F')
# Keep original initplayback traffic on device. No redirect, blank response or worker.
start = request.index('function Nt(){')
end = request.index('var rt=F.request.url;', start)
request = request[:start] + '''function Nt(){
 const {encryptKey}=Se(),body=F.request.bodyBytes;
 if(!encryptKey||!(body instanceof Uint8Array)){Ue();F.exit();return}
 const key=tt.fromBinary(body).encryptedInnertubeRequest?.encryptedClientKey;
 if(!key||!wt(key,v(encryptKey)))Ue();
 F.exit();
}''' + request[end:]
# Remove content-encoding only when the body has already been decoded by the engine;
# log_event itself is unmodified, so keep its original encoding header here.
prefix = (ROOT / 'tools/runtime-prefix.js').read_text()
suffix = '\n}catch(error){console.log("YouTube Adblock: unsupported input; unchanged");$done({});}\n})();\n'
for kind, body in [('response', source), ('request', request), ('ump', core+'\n'+ump)]:
    output = prefix.replace('REQUIRE_BINARY', 'false' if kind=='request' else 'true').replace('IS_REQUEST', 'true' if kind=='request' else 'false')
    (ROOT / f'scripts/youtube.{kind}.js').write_text(output + body + suffix)
    print(f'Built scripts/youtube.{kind}.js')
