// Opt-in, allowlisted local diagnostics. Never forward native console/error text.
const srVersion = '1.5.0';
const srScript = 'SCRIPT_KIND';
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
