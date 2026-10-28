// Keep upstream defaults, but accept well-typed upstream options without making
// empty/truncated arguments or diagnostic=true strings throw JSON exceptions.
function srCompatParams(defaults){
 let options;
 if(typeof $argument==='object'&&$argument&&!Array.isArray($argument))options=$argument;
 else if(typeof $argument==='string'){
   const text=$argument.trim();
   if(!text.startsWith('{')||text.includes('{{{'))return defaults;
   try{options=JSON.parse(text)}catch(error){return defaults;}
 }
 if(!options||typeof options!=='object'||Array.isArray(options))return defaults;
 for(const key of Object.keys(defaults)){
   if(!Object.prototype.hasOwnProperty.call(options,key)||typeof options[key]!==typeof defaults[key])continue;
   if(key==='captionLang'&&!/^(?:off|[a-z]{2,3}(?:-[A-Za-z0-9]+)*)$/.test(options[key]))continue;
   defaults[key]=options[key];
 }
 return defaults;
}
