const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {run,api}=require('./helpers.cjs');
const {card,section,feed,field,path,concat,metadataPaths}=require('./fixtures.cjs');
const normal=card({title:'Normal recommendation'});
const ad=card({ad:true});
for(const endpoint of ['browse','next','search'])test(`${endpoint}: remove entire Sponsored cards and emptied sections, keep mixed sections`,()=>{
  const input=feed([section([ad]),section([normal,ad,normal])],endpoint,field(1000,Buffer.from('unknown metadata')));
  const expected=feed([section([normal,normal])],endpoint,field(1000,Buffer.from('unknown metadata')));
  const out=run(new Uint8Array(input),endpoint);
  assert.deepEqual(Buffer.from(out.result.body),expected);
  assert.ok(out.logs.some(x=>/cards=2; sections=/.test(x)));
  assert.ok(!out.logs.some(x=>/Normal recommendation|Sponsored|pagination-token/.test(x)));
});
for(let variant=0;variant<metadataPaths.length;variant++)test(`metadata variant ${variant} recognized without Sponsored/pagead string`,()=>{
  const input=feed([section([normal,card({ad:true,variant,label:'广告'})])]);
  const out=run(new Uint8Array(input),'browse');
  assert.deepEqual(Buffer.from(out.result.body),feed([section([normal])]));
});
test('promoted renderer and multi-image product carousel remove whole parent cards',()=>{
  const promoted=path([166487981,1,83537025,3,83784541,1,1,1],Buffer.from('Advertiser'));
  const carousel=path([153515154,172660663,3,3,3,3,3,1,158796380,1,1],Buffer.from('Product campaign'));
  const out=run(new Uint8Array(feed([section([promoted,normal,carousel])])),'browse');
  assert.deepEqual(Buffer.from(out.result.body),feed([section([normal])]));
});
test('exact ad layouts are recognized, product layouts alone remain organic',()=>{
  for(const layout of ['inline_injection_entrypoint_layout.eml','brand_promo.eml','text_search_ad.eml','feed_ad_metadata.eml']) {
    const out=run(new Uint8Array(feed([section([card({layout}),normal])])),'browse');
    assert.deepEqual(Buffer.from(out.result.body),feed([section([normal])]));
  }
  for(const layout of ['product_carousel.eml','product_item.eml','shorts_video_cell.eml','shorts_shelf.eml']) {
    const input=feed([section([card({layout})])]);
    assert.equal(Object.keys(run(new Uint8Array(input),'browse').result).length,0);
  }
});
test('unknown wrappers and repeated continuation actions do not depend on generated schema',()=>{
  const action=feed([section([ad,normal])]);
  const input=concat(path([999,777],action),path([999,777],action),field(998,Buffer.from('unknown untouched')));
  const expected=concat(path([999,777],feed([section([normal])])),path([999,777],feed([section([normal])])),field(998,Buffer.from('unknown untouched')));
  assert.deepEqual(Buffer.from(run(new Uint8Array(input),'browse').result.body),expected);
});
test('mixed Shorts shelf retains normal Shorts and removes only its ad child',()=>{
  const short=card({layout:'shorts_video_cell.eml',title:'A normal Short'});
  const shelf=items=>path([51845067,5,51431404],concat(items.map(x=>field(1,x))));
  const out=run(new Uint8Array(feed([shelf([short,ad]),section([normal])])),'browse');
  assert.deepEqual(Buffer.from(out.result.body),feed([shelf([short]),section([normal])]));
});
test('all-ad product shelf is pruned without an empty outer shelf',()=>{
  const shelf=path([51845067,5,51431404],field(1,ad));
  const out=run(new Uint8Array(feed([shelf,section([normal])])),'browse');
  assert.deepEqual(Buffer.from(out.result.body),feed([section([normal])]));
});
test('normal Sponsored titles/descriptions, history and watch-later entries preserved byte-for-byte',()=>{
  const cards=[card({title:'Sponsored tutorial and pagead explained'}),card({title:'Watch later'}),card({title:'Watch history'}),card({title:'https://googleads.g.doubleclick.net/pagead/ads'})];
  const input=feed([section(cards)],'browse',field(888,Buffer.from('Sponsored')));
  assert.equal(Object.keys(run(new Uint8Array(input),'browse').result).length,0);
  const mixed=feed([section([...cards,ad])],'browse',field(888,Buffer.from('Sponsored')));
  assert.deepEqual(Buffer.from(run(new Uint8Array(mixed),'browse').result.body),input);
});
test('metadata at an unrelated path and empty ad metadata do not remove normal videos',()=>{
  for(const item of [concat(normal,path([500,...metadataPaths[0]],Buffer.from('Sponsored'))),card({ad:true,label:''}),card({title:'brand_promo.eml feed_ad_metadata'})]) {
    assert.equal(Object.keys(run(new Uint8Array(feed([section([item])])),'browse').result).length,0);
  }
});
test('empty initial sections and continuation data retained when no ad was removed',()=>{
  const input=feed([section([]),section([normal])]);
  assert.equal(Object.keys(run(new Uint8Array(input),'browse').result).length,0);
});
test('malformed wire payload and excessive nesting do not corrupt responses',()=>{
  for(const input of [Buffer.from([82,255]),Buffer.from([0]),Buffer.from([15])]) {
    assert.equal(Object.keys(run(new Uint8Array(input),'browse').result).length,0);
  }
  let nested=feed([section([ad])]);for(let i=0;i<40;i++)nested=field(100,nested);
  assert.equal(Object.keys(run(new Uint8Array(nested),'browse').result).length,0);
});
test('feed bodyBytes path uses the same structural filter',()=>{
  const input=new Uint8Array(feed([section([ad,normal])]));
  const out=run(undefined,'browse',{$response:{bodyBytes:input.buffer,headers:{}}});
  assert.deepEqual(Buffer.from(out.result.bodyBytes),feed([section([normal])]));
});
test('MITM remains limited and cache version is consistent for all script references',()=>{
  const module=fs.readFileSync('youtube-adblock.module','utf8');
  assert.equal(module.match(/^hostname = (.*)$/m)[1],'%APPEND% youtubei.googleapis.com, youtubei-att.googleapis.com, *.googlevideo.com');
  const version=module.match(/#!version=(\S+)/)[1];
  for(const match of module.matchAll(/script-path=(\S+)/g))assert.ok(match[1].endsWith('?v='+version));
  const pattern=new RegExp(module.match(/type=http-response,pattern=(.*?),requires-body/)[1]);
  for(const host of ['youtubei.googleapis.com','youtubei-att.googleapis.com'])for(const endpoint of ['browse','next','search'])assert.ok(pattern.test('https://'+host+'/youtubei/v1/'+endpoint+'?prettyPrint=false'));
});
test('local diagnostics distinguish inspected and nonbinary feeds without logging user data',()=>{
  const marker='private_cookie_or_account_marker';
  const first=run(new Uint8Array(feed([section([normal])])),'browse',{$request:{url:'https://youtubei.googleapis.com/youtubei/v1/browse?key='+marker,headers:{Cookie:marker}}});
  assert.ok(first.logs.some(x=>/feed inspected; cards=0/.test(x)));
  assert.ok(!first.logs.some(x=>x.includes(marker)));
  const skipped=run('a non-binary response','browse');
  assert.ok(skipped.logs.some(x=>/feed skipped \(no binary body\)/.test(x)));
});
