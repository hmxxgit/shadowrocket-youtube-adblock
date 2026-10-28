(function(console){
// Opt-in, allowlisted local diagnostics. Never forward native console/error text.
const srVersion = '1.5.1';
const srScript = 'timing';
const srNativeLog = typeof console.log === 'function' ? console.log.bind(console) : () => {};
console = {log(){},info(){},debug(){},warn(){},error(){}};
const srEndpoints = new Set(['browse','next','search','player','get_watch','initplayback','config','log_event','get_setting','reel_watch_sequence']);
const srName = String($request.url || '').split('?')[0].split('/').pop();
const srEndpoint = srEndpoints.has(srName) ? srName : 'unknown';
let srDiagnostic = false;
if (typeof $argument === 'string') srDiagnostic = /(?:^|&)diagnostic=true(?:&|$)/.test($argument);
else if (typeof $argument === 'object' && $argument) srDiagnostic = $argument.diagnostic === true || $argument.diagnostic === 'true';
const srReasons = new Set([
  'none','missing_body','invalid_body','script_error','protobuf_invalid','missing_key',
  'key_cached','config_key_unavailable','key_refresh_requested','request_unchanged',
  'request_body_unavailable','request_key_absent','request_key_mismatch','request_invalid',
  'hmac_failed','crypto_failed','invalid_key','decompression_failed','compression_unsupported',
  'body_limit','ump_invalid','no_encrypted_part','reencryption_failed','feed_unsupported','cache_json_invalid','cache_shape_invalid','cache_read_failed','cache_write_failed','timing_missing','request_id_unavailable','timing_duplicate','timing_storage_unavailable','timing_clock_invalid'
]);
const srEvents = new Set(['start','ump_enter','ump_decrypt','ump_reencrypt','ad_fields','ad_cleanup','finish','cache_recovery','timing']);
const srState = {success:true,reason:'none',found:false,cleaned:false,stage:'script_error'};
function srReason(reason) { srState.reason = srReasons.has(reason) ? reason : 'script_error'; }
function srFailure(reason) { srReason(reason);srState.success=false;return Error('YouTube processing failed'); }
function srTrace(event, fields={}) {
  if(!srDiagnostic || !srEvents.has(event))return;
  const entry={version:srVersion,script:srScript,endpoint:srEndpoint,event};
  for(const key of ['success','entered','found','cleaned','pass'])if(typeof fields[key]==='boolean')entry[key]=fields[key];
  for(const key of ['script_ms','parse_ms','rewrite_ms','encode_ms','decrypt_ms','request_to_response_ms'])if((typeof fields[key]==='number'&&Number.isFinite(fields[key])&&fields[key]>=0&&fields[key]<=600000)||(key==='request_to_response_ms'&&fields[key]===null))entry[key]=fields[key];
  if(srReasons.has(fields.reason))entry.reason=fields.reason;
  srNativeLog('[YTAD] '+JSON.stringify(entry));
}
function srAd(found,cleaned=false) {srState.found ||= !!found;srState.cleaned ||= !!cleaned;}
function srFinish(modified) {
  srFinishTiming();
  srTrace('ad_fields',{found:srState.found});
  // A successful in-memory edit is not a cleanup unless the modified body is returned.
  srTrace('ad_cleanup',{cleaned:srState.cleaned && modified && srState.success});
  srTrace('finish',{success:srState.success,pass:!modified,reason:srState.reason});
}
srTrace('start',{success:true});

// Diagnostics only. No URL/headers/body are stored; request ids are never logged.
const srTimingStart=srDiagnostic?Date.now():0;
const srDurations={parse_ms:0,rewrite_ms:0,encode_ms:0,decrypt_ms:0};
let srBeforeResponse=null,srTimingReason='timing_missing';
function srMeasure(name,fn){
 if(!srDiagnostic)return fn();
 const started=Date.now();
 try{return fn();}finally{if(Object.prototype.hasOwnProperty.call(srDurations,name))srDurations[name]+=Math.max(0,Date.now()-started);}
}
function srTimingKey(){
 const id=$request.id;
 if((typeof id==='number'&&!Number.isFinite(id))||(typeof id!=='string'&&typeof id!=='number')||String(id).length===0||String(id).length>256)return null;
 let a=2166136261,b=2246822519;
 for(const c of String(id)){a=Math.imul(a^c.charCodeAt(0),16777619)>>>0;b=Math.imul(b^c.charCodeAt(0),3266489917)>>>0;}
 return a.toString(16)+':'+b.toString(16);
}
function srTimingStore(update){
 if(!srDiagnostic)return null;
 try{
   const raw=$persistentStore.read('SRYouTubeTiming');let records={};
   try{records=raw?JSON.parse(raw):{};}catch(error){}
   if(!records||typeof records!=='object'||Array.isArray(records))records={};
   const now=Date.now();
   for(const k of Object.keys(records)){
     const record=records[k];
     if(!/^[0-9a-f]{1,8}:[0-9a-f]{1,8}$/.test(k)||!record||!Number.isFinite(record.at)||!srEndpoints.has(record.endpoint)||now-record.at>120000||now<record.at)delete records[k];
     else records[k]={at:record.at,endpoint:record.endpoint,duplicate:record.duplicate===true};
   }
   const result=update(records,now);
   const keys=Object.keys(records).sort((a,b)=>records[b].at-records[a].at);
   for(const k of keys.slice(64))delete records[k];
   if($persistentStore.write(JSON.stringify(records),'SRYouTubeTiming')===false)throw Error('Timing storage unavailable');
   return result;
 }catch(error){srTimingReason='timing_storage_unavailable';return null;}
}
function srMarkTiming(){
 if(!srDiagnostic)return;
 const key=srTimingKey();if(!key){srTimingReason='request_id_unavailable';return;}
 srTimingStore((records,now)=>{records[key]={at:now,endpoint:srEndpoint,duplicate:!!records[key]};return true;});
}
function srTakeTiming(){
 if(!srDiagnostic)return;
 const key=srTimingKey();if(!key){srTimingReason='request_id_unavailable';return;}
 const result=srTimingStore((records,now)=>{
   const record=records[key];delete records[key];
   if(!record||record.endpoint!==srEndpoint)return {reason:'timing_missing'};
   if(record.duplicate)return {reason:'timing_duplicate'};
   const elapsed=srTimingStart-record.at;
   return elapsed>=0&&elapsed<=120000?{ms:elapsed,reason:'none'}:{reason:'timing_clock_invalid'};
 });
 if(result){srBeforeResponse=result.ms??null;srTimingReason=result.reason;}
}
function srFinishTiming(){
 if(!srDiagnostic)return;
 srTrace('timing',{...srDurations,script_ms:Math.max(0,Date.now()-srTimingStart),request_to_response_ms:srBeforeResponse,reason:srTimingReason});
}

const phase=typeof $argument==='string'&&/(?:^|&)phase=request(?:&|$)/.test($argument)?'request':'response';
if(phase==='request')srMarkTiming();else srTakeTiming();
srFinish(false);$done({});
})(console);
