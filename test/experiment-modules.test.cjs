const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const production=read('youtube-adblock.module');
const variants={
  A:read('youtube-test-a-baseline.module'),
  B:read('youtube-test-b-no-feed.module'),
  C:read('youtube-test-c-no-udp.module'),
  D:read('youtube-test-d-no-rewrite.module'),
  E:read('youtube-test-e-no-script.module'),
};
const definitions={
  A:['youtube-test-a-baseline.module','YT Test A - Baseline','Controlled experiment A; exact active production behavior.'],
  B:['youtube-test-b-no-feed.module','YT Test B - No Feed Script','Controlled experiment B; browse/search response script excluded.'],
  C:['youtube-test-c-no-udp.module','YT Test C - No UDP Block','Controlled experiment C; module UDP rejection rules removed.'],
  D:['youtube-test-d-no-rewrite.module','YT Test D - No Rewrite','Controlled experiment D; URL Rewrite section removed.'],
  E:['youtube-test-e-no-script.module','YT Test E - No Response Script','Controlled experiment E; YouTube response script disabled.'],
};
const udpRules=[
  'AND,((DOMAIN-SUFFIX,googlevideo.com), (PROTOCOL,UDP)),REJECT',
  'AND,((DOMAIN,youtubei.googleapis.com), (PROTOCOL,UDP)),REJECT',
];
const fullEndpoints='(browse|next|player|search|reel\\/reel_watch_sequence|guide|account\\/get_setting|get_watch)';
const noFeedEndpoints='(next|player|reel\\/reel_watch_sequence|guide|account\\/get_setting|get_watch)';

function normalizeMetadata(text){
  const sourceName=production.match(/^#!name=(.*)$/m)?.[1];
  const sourceDescription=production.match(/^#!desc=(.*)$/m)?.[1];
  assert.ok(sourceName&&sourceDescription,'production module needs display metadata');
  return text.replace(/^#!name=.*$/m,`#!name=${sourceName}`)
    .replace(/^#!desc=.*$/m,`#!desc=${sourceDescription}`);
}
function removeSection(text,section,next){
  const expression=new RegExp(`^\\[${section}\\]\\n[\\s\\S]*?(?=^\\[${next}\\]\\n)`,'m');
  assert.match(text,expression);
  return text.replace(expression,'');
}
function responseDeclaration(module){
  return module.split('\n').find(line=>line.startsWith('youtube.adblock.response = '));
}
function responsePattern(module){
  const line=responseDeclaration(module);
  assert.ok(line,'expected response script declaration');
  const value=line.match(/pattern=(.*?),requires-body=/)?.[1];
  assert.ok(value,'expected parseable response pattern');
  assert.doesNotThrow(()=>new RegExp(value));
  return value;
}
function sections(module){
  return [...module.matchAll(/^\[([^\]]+)\]$/gm)].map(match=>match[1]);
}

test('A is production byte-for-byte apart from permitted display metadata',()=>{
  assert.equal(normalizeMetadata(variants.A),production);
});

test('B changes only response matching by excluding browse and search',()=>{
  const normalized=normalizeMetadata(variants.B);
  const expected=normalizeMetadata(variants.A).replace(fullEndpoints,noFeedEndpoints);
  assert.equal(normalized,expected);
  assert.doesNotMatch(responsePattern(variants.B),/browse|search/);
  for(const endpoint of ['next','player','reel\\/reel_watch_sequence','guide','account\\/get_setting','get_watch'])
    assert.ok(responsePattern(variants.B).includes(endpoint));
});

test('C removes only the two module UDP rejection rules',()=>{
  let restored=normalizeMetadata(variants.C);
  assert.ok(restored.includes('[Rule]\n'));
  restored=restored.replace('[Rule]\n','[Rule]\n'+udpRules.join('\n')+'\n');
  assert.equal(restored,normalizeMetadata(variants.A));
  for(const rule of udpRules)assert.equal(variants.C.split(rule).length-1,0);
});

test('D removes only URL Rewrite',()=>{
  assert.equal(removeSection(normalizeMetadata(variants.A),'URL Rewrite','Script'),normalizeMetadata(variants.D));
});

test('E removes only the HTTP response Script section',()=>{
  assert.equal(removeSection(normalizeMetadata(variants.A),'Script','MITM'),normalizeMetadata(variants.E));
  assert.doesNotMatch(variants.E,/type=http-response/);
});

test('module sections and rewrite/script regexes remain structurally valid',()=>{
  for(const key of ['A','B','C','D']){
    assert.deepEqual(sections(variants[key]),key==='D'?['Rule','Script','MITM']:['Rule','URL Rewrite','Script','MITM']);
    const pattern=responsePattern(variants[key]);
    assert.ok(pattern.startsWith('^https'));
    const rewriteText=key==='D'?'':variants[key].split('[URL Rewrite]\n')[1].split('[Script]')[0];
    for(const line of rewriteText.split('\n')){
      const trimmed=line.trim();
      if(!trimmed||trimmed.startsWith('#'))continue;
      assert.doesNotThrow(()=>new RegExp(trimmed.split(/\s+/)[0]));
    }
  }
  assert.deepEqual(sections(variants.E),['Rule','URL Rewrite','MITM']);
});

test('test modules preserve production MITM scope, version, and pinned script URL',()=>{
  const release=JSON.parse(read('release.json'));
  const version=JSON.parse(read('package.json')).version;
  const mitm=production.split('[MITM]\n')[1].trim();
  for(const [key,module] of Object.entries(variants)){
    const [filename,name,description]=definitions[key];
    assert.ok(module.startsWith(`#!name=${name}\n#!desc=${description}\n`));
    assert.equal(module.match(/^#!version=(.+)$/m)?.[1],version);
    assert.equal(module.split('[MITM]\n')[1].trim(),mitm);
    assert.equal(filename,path.basename(filename));
    if(key==='E')continue;
    const declaration=responseDeclaration(module);
    const urls=[...declaration.matchAll(/script-path=(https:\/\/[^\s,]+)/g)].map(match=>match[1]);
    assert.equal(urls.length,1);
    const url=new URL(urls[0]);
    assert.equal(url.hostname,'raw.githubusercontent.com');
    assert.equal(url.pathname,`/hmxxgit/shadowrocket-youtube-adblock/${release.script_ref}/scripts/youtube.response.compat.js`);
    assert.ok(fs.existsSync(path.join(root,'scripts/youtube.response.compat.js')));
  }
});

test('README contains one standalone raw URL code block for each generated module',()=>{
  const readme=read('README.md');
  for(const [filename] of Object.values(definitions)){
    const url=`https://raw.githubusercontent.com/hmxxgit/shadowrocket-youtube-adblock/main/${filename}`;
    assert.equal(readme.split(url).length-1,1,url);
    assert.ok(readme.includes(`\`\`\`text\n${url}\n\`\`\``),url);
  }
});
