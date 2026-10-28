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
