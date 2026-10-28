const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source = fs.readFileSync('scripts/youtube.response.js', 'utf8');
function run(body, endpoint = 'player', extra = {}, expose = false) {
  const results = [], logs = [], store = {};
  const ctx = { Uint8Array, ArrayBuffer, TextEncoder, TextDecoder, console: {log: x => logs.push(x)},
    $request: {url: 'https://youtubei.googleapis.com/youtubei/v1/' + endpoint, headers: {}},
    $response: {body}, $done: x => results.push(x),
    $persistentStore: { read: k => store[k] ?? null, write: (v,k) => {store[k] = v; return true;} },
    $notification: {post: () => {}}, ...extra };
  vm.runInNewContext(expose ? source.replace('try{srRunResponse()}', 'globalThis.api={player:oe,shorts:zr,browse:qr,getWatch:ei,Ir,Fi,d,onesie:Wi,encrypted:xi,config:kr,settings:Qr,next:re,item:te,feed:srRewriteFeed};try{srRunResponse()}') : source, ctx, {timeout: 2000});
  assert.equal(results.length, 1, 'script must finish exactly once');
  return {result: results[0], api: ctx.api, logs};
}
const api = run(new Uint8Array(), 'browse', {}, true).api;
module.exports={run,api};
