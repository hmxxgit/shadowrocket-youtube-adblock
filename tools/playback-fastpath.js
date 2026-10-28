// Playback updates are idempotent: no second traversal or full-body equality scan.
function Ni(l){
 const changed=!!(l.adPlacements?.length||l.adSlots?.length||l.playbackTracking?.pageadViewthroughconversion);
 if(l.adPlacements?.length)l.adPlacements.length=0;
 if(l.adSlots?.length)l.adSlots.length=0;
 if(l.playbackTracking)delete l.playbackTracking.pageadViewthroughconversion;
 srAd(changed,changed);return changed;
}
function Si(l){
 const status=l.playabilityStatus;if(!status)return false;
 let changed=false;
 if(!status.pictureInPictureRender){status.pictureInPictureRender=me.create({pictureInPictureAbility:{active:true,f4:0,f6:0,f8:1}});changed=true;}
 const pip=status.pictureInPictureRender;
 if(!pip.pictureInPictureAbility){pip.pictureInPictureAbility=me.create({pictureInPictureAbility:{active:true,f4:0,f6:0,f8:1}}).pictureInPictureAbility;changed=true;}
 for(const [key,value] of Object.entries({active:true,f4:0,f6:0,f8:1}))if(pip.pictureInPictureAbility[key]!==value){pip.pictureInPictureAbility[key]=value;changed=true;}
 if(!status.backgroundPlayerRender){status.backgroundPlayerRender=ge.create({backgroundAbility:{active:true}});changed=true;}
 if(!status.backgroundPlayerRender.backgroundAbility){status.backgroundPlayerRender.backgroundAbility=ge.create({backgroundAbility:{active:true}}).backgroundAbility;changed=true;}
 if(status.backgroundPlayerRender.backgroundAbility.active!==true){status.backgroundPlayerRender.backgroundAbility.active=true;changed=true;}
 return changed;
}
function Br(l){const ads=Ni(l),abilities=Si(l);return ads||abilities;}
function Ai(l){return{bodyChanged:Br(l),stateChanged:false};}
function Vi(l,{state}){
 let changed=false,cacheLoaded=false;
 for(const content of l.contents){
   if(content.player)changed=Br(content.player)||changed;
   if(content.next){if(!cacheLoaded){state.adCache=si();cacheLoaded=true;}const ads=Ir(content.next,state.adCache);srAd(ads,ads);changed=ads||changed;}
 }
 return{bodyChanged:changed,stateChanged:cacheLoaded&&state.adCache.dirty};
}
function ii(input){
 const entry=Mi.find(item=>input.url.split('?')[0].endsWith('/'+item.path));
 if(!entry||input.bodyBytes==null)return{action:'exit',state:input.state,changed:false};
 const message=srMeasure('parse_ms',()=>entry.msgType.fromBinary(input.bodyBytes));
 const result=srMeasure('rewrite_ms',()=>entry.handler(message,{params:input.params,state:input.state,platformKey:input.platformKey}));
 const bytes=result.bodyChanged?srMeasure('encode_ms',()=>entry.msgType.toBinary(message)):undefined;
 return{action:result.bodyChanged?'body':'exit',bodyBytes:bytes,state:input.state,changed:result.stateChanged};
}
function Ki(){
 const endpoint=F.request.url.split('?')[0].split('/').pop();
 // No key cache is required by this profile. Player-only responses need no ad cache.
 const state={adCache:['browse','next','search'].includes(endpoint)?si():Gi(),config:{}};
 const result=ii({url:F.request.url,bodyBytes:F.response.bodyBytes,state,params:ai(),platformKey:Wr()});
 if(result.changed)li(result.state.adCache);
 if(result.action==='body')F.done({bodyBytes:result.bodyBytes});else F.exit();
}
