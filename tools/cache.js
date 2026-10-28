// Cache corruption must not abort independent playback-response processing.
// Repair only our own cache entry; never print raw values or exception text.
function srReadCache(adapter, key, fallback={}) {
  const owned=key==='SRYouTubeAdblockConfig'||key==='SRYouTubeAdblockAdvertiseInfo';
  let raw;
  try{raw=adapter.getVal(key)}catch(error){srTrace('cache_recovery',{success:false,reason:'cache_read_failed'});return fallback;}
  if(raw==null||raw==='')return fallback;
  const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  function recover(reason, value=fallback) {
    srTrace('cache_recovery',{success:true,reason});
    if(owned) {
      try{adapter.setVal(JSON.stringify(value),key)}catch(error){srTrace('cache_recovery',{success:false,reason:'cache_write_failed'});}
    }
    return value;
  }
  let value;
  try{value=JSON.parse(raw)}catch(error){return recover('cache_json_invalid');}
  if(!object(value))return recover('cache_shape_invalid');
  if(key==='SRYouTubeAdblockConfig') {
    let repaired=false;
    for(const platform of ['youtube','youtubeMusic']) {
      if(!Object.prototype.hasOwnProperty.call(value,platform))continue;
      const record=value[platform];
      if(!object(record)||['clientKey','encryptKey'].some(name=>record[name]!==undefined&&typeof record[name]!=='string')) {
        delete value[platform];repaired=true;
      }
    }
    if(repaired)return recover('cache_shape_invalid',value);
  }else if(key==='SRYouTubeAdblockAdvertiseInfo'&&value.version!==undefined) {
    const numbers=list=>Array.isArray(list)&&list.every(n=>Number.isInteger(n)&&n>0);
    const strings=list=>Array.isArray(list)&&list.every(s=>typeof s==='string');
    if(typeof value.version!=='string'||!numbers(value.whiteNo)||!numbers(value.blackNo)||!strings(value.whiteEml)||!strings(value.blackEml))
      return recover('cache_shape_invalid');
  }
  return value;
}
