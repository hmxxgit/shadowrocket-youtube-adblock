const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('scripts/youtube.response.js', 'utf8');
function run(body, endpoint = 'player', extra = {}, expose = false) {
  const results = [], logs = [], store = {};
  const ctx = { Uint8Array, ArrayBuffer, TextEncoder, TextDecoder, console: {log: x => logs.push(x)},
    $request: {url: 'https://youtubei.googleapis.com/youtubei/v1/' + endpoint, headers: {}},
    $response: {body}, $done: x => results.push(x),
    $persistentStore: { read: k => store[k] ?? null, write: (v,k) => {store[k] = v; return true;} },
    $notification: {post: () => {}}, ...extra };
  vm.runInNewContext(expose ? source.replace('try{Ki()}', 'globalThis.api={player:oe,shorts:zr,browse:qr,getWatch:ei,Ir,Fi,d};try{Ki()}') : source, ctx, {timeout: 2000});
  assert.equal(results.length, 1, 'script must finish exactly once');
  return {result: results[0], api: ctx.api, logs};
}
const api = run(new Uint8Array(), 'browse', {}, true).api;
test('player removes pre-roll/mid-roll slots and preserves unknown stream fields', () => {
  const message = api.player.create({adPlacements:[{}],adSlots:[{}]});
  api.d.onRead('', message, 1000, 2, Uint8Array.from([3, 1, 2, 3]));
  const {result, logs} = run(api.player.toBinary(message));
  assert.equal(logs.length, 0);
  const decoded = api.player.fromBinary(result.body);
  assert.equal(decoded.adPlacements.length, 0);
  assert.equal(decoded.adSlots.length, 0);
  assert.deepEqual(Array.from(api.d.list(decoded)[0].data), [3,1,2,3]);
  assert.equal(decoded.playabilityStatus, undefined, 'no Premium/PiP changes');
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
test('home/recommendation ads are removed, ordinary entries retained', () => {
  const ad = {}, normal = {};
  const payload = new Uint8Array(1100); payload.set(new TextEncoder().encode('pagead'), 20);
  api.d.onRead('', ad, 999, 2, payload);
  api.d.onRead('', normal, 998, 2, new Uint8Array([1,0]));
  const fixture = {richItemContents:[normal, ad]};
  const cache = {whiteNo:[],blackNo:[],whiteEml:[],blackEml:['inline_injection_entrypoint_layout.eml'],dirty:false};
  assert.equal(api.Ir(fixture, cache), true);
  assert.equal(fixture.richItemContents.length, 1);
  assert.equal(fixture.richItemContents[0], normal);
  assert.equal(api.Fi({renderInfo:{layoutRender:{eml:'shorts_video_layout.eml'}}}, cache), false);
});
test('get_watch nested player slots are removed', () => {
  const bytes = api.getWatch.toBinary(api.getWatch.create({contents:[{player:{adPlacements:[{}],adSlots:[{}]}}]}));
  const out = run(bytes, 'get_watch');
  assert.equal(out.logs.length, 0);
  assert.equal(api.getWatch.fromBinary(out.result.body).contents[0].player.adSlots.length, 0);
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
test('init fallback affects acknowledged initialization only', () => {
  const script = fs.readFileSync('scripts/youtube.request.js','utf8');
  for (const [path, match] of [['initplayback?ack=1',true],['initplayback?a=1&ack=1&x=2',true],['videoplayback?ack=1',false],['initplayback?notack=1',false],['initplayback?a=1',false]]) {
    const results = [];
    vm.runInNewContext(script, {Uint8Array,console,$request:{url:'https://rr1---sn-a.googlevideo.com/'+path},$done:x=>results.push(x)});
    assert.equal(results.length,1);
    assert.equal(!!results[0].response,match);
  }
});
test('module limits script and reject rules to intended endpoints', () => {
  const module = fs.readFileSync('youtube-adblock.module','utf8');
  const pattern = module.match(/type=http-response,pattern=(.*?),requires-body/)[1];
  const re = new RegExp(pattern);
  assert.ok(re.test('https://youtubei-att.googleapis.com/youtubei/v1/player?x=1'));
  for (const url of ['https://example.com/youtubei/v1/player','https://youtubei.googleapis.com/youtubei/v1/player_extra','https://youtubei.googleapis.com/youtubei/v1/account/get_setting']) assert.ok(!re.test(url));
  const rules = module.split('[URL Rewrite]')[1].split('[Script]')[0].split('\n').filter(x=>x.startsWith('^')).map(x=>new RegExp(x.split(' ')[0]));
  assert.ok(rules.some(r=>r.test('https://rr1.googlevideo.com/initplayback?oad=1')));
  for (const url of ['https://rr1.googlevideo.com/videoplayback?oad=1','https://rr1.googlevideo.com/initplayback?notoad=1']) assert.ok(!rules.some(r=>r.test(url)));
  for (const path of module.matchAll(/script-path=https:\/\/raw\.githubusercontent\.com\/[^/]+\/shadowrocket-youtube-adblock\/main\/([^\s,]+)/g)) assert.ok(fs.existsSync(path[1]));
  assert.equal((module.match(/script-path=/g)||[]).length,2);
});
