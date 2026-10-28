// Feed renderer paths from app2smile/rules (MIT) and layout names from
// Maasea/sgmodule and dayanch96/YTLite. See NOTICE.md for pinned sources.
// No display-label matching; all decisions are scoped to renderer/metadata paths.
const srAdMetadataPaths = [
  [454362329,8,4,2], [224457493,2,3], [461080918,7,4,2],
  [472329933,7,4,2], [478840678,7,4,2], [224590612,2,3],
  [224590612,2,9], [394770629,8,4,2], [491441836,8,4,2],
  [232954548,19,3], [456430508,7,4,2]
];
const srAdLayouts = new Set([
  'inline_injection_entrypoint_layout.eml', 'brand_promo.eml',
  'text_search_ad.eml', 'feed_ad_metadata.eml'
]);
function srVarint(bytes, offset, max=5) {
  let value=0, scale=1;
  for(let i=0;i<max&&offset<bytes.length;i++) {
    const byte=bytes[offset++];value+=(byte&127)*scale;
    if(!(byte&128))return {value,offset};
    scale*=128;
  }
  throw Error('Invalid feed varint');
}
function srParseFeed(bytes, budget) {
  const fields=[];let offset=0;
  try {
    while(offset<bytes.length) {
      if(--budget.fields<0)throw Error('Feed inspection budget');
      const start=offset,tag=srVarint(bytes,offset);offset=tag.offset;
      const no=Math.floor(tag.value/8),wire=tag.value%8,tagEnd=offset;
      if(no<1||no>536870911)return null;
      let dataStart=offset;
      if(wire===2) {const size=srVarint(bytes,offset);offset=size.offset;dataStart=offset;offset+=size.value;}
      else if(wire===0) {let count=0;while(true){if(offset>=bytes.length||count++>=10)return null;if(!(bytes[offset++]&128))break;}}
      else if(wire===1)offset+=8;
      else if(wire===5)offset+=4;
      else return null;
      if(offset>bytes.length)return null;
      fields.push({no,wire,start,tagEnd,dataStart,end:offset,data:bytes.subarray(dataStart,offset)});
    }
    return fields;
  } catch(error) {
    if(budget.fields<0)throw error;
    return null;
  }
}
function srChildren(field,budget) {
  if(field.wire!==2)return null;
  if(field.children===undefined)field.children=srParseFeed(field.data,budget);
  return field.children;
}
function srPath(fields,path,budget) {
  if(!fields)return [];
  let matches=fields.filter(f=>f.no===path[0]&&f.wire===2);
  for(let i=1;i<path.length;i++)matches=matches.flatMap(f=>(srChildren(f,budget)||[]).filter(x=>x.no===path[i]&&x.wire===2));
  return matches;
}
function srLabel(field) {
  if(!field||field.data.length===0||field.data.length>512)return false;
  const text=new TextDecoder().decode(field.data);
  return text.trim().length>0&&!/[\u0000-\u0008\u000e-\u001f\ufffd]/.test(text);
}
function srMetadataAd(fields,budget) {
  return srAdMetadataPaths.some(path=>srPath(fields,path,budget).some(srLabel));
}
function srIsFeedAd(fields,budget) {
  if(!fields)return false;
  // VideoWithContext -> Element -> VideoInfo -> VideoContext -> VideoContent.
  for(const content of srPath(fields,[153515154,172660663,1,168777401,5],budget)) {
    if(srMetadataAd(srChildren(content,budget),budget))return true;
  }
  for(const layout of srPath(fields,[153515154,172660663,2,183314536,1],budget)) {
    const name=new TextDecoder().decode(layout.data).split('|')[0];
    if(srAdLayouts.has(name))return true;
  }
  // Promoted renderer and multi-image carousel structures documented upstream.
  if(srPath(fields,[166487981,1,83537025,3,83784541,1,1,1],budget).some(srLabel))return true;
  return srPath(fields,[153515154,172660663,3,3,3,3,3,1,158796380,1,1],budget).some(srLabel);
}
function srEncodeVarint(number) {
  const bytes=[];
  do {let b=number%128;number=Math.floor(number/128);bytes.push(b|(number?128:0));}while(number);
  return Uint8Array.from(bytes);
}
function srConcat(chunks) {
  const output=new Uint8Array(chunks.reduce((n,x)=>n+x.length,0));let offset=0;
  for(const chunk of chunks){output.set(chunk,offset);offset+=chunk.length;}return output;
}
function srRewriteFeed(bytes) {
  const budget={fields:200000},stats={cards:0,sections:0};
  function visit(data,fields,owner=0,depth=0) {
    if(!fields||depth>32)return {bytes:data,changed:false,drop:false};
    const chunks=[];let changed=false,removedItems=0,removedRenderer=false;
    const kept=[];
    for(const field of fields) {
      const children=srChildren(field,budget);
      // Delete the repeated list MEMBER, including thumbnail, sponsor and CTA.
      // Never recursively classify an entire shelf from one advertising child.
      if(field.no===1&&children&&srIsFeedAd(children,budget)) {
        changed=true;removedItems++;stats.cards++;continue;
      }
      const child=visit(field.data,children,field.no,depth+1);
      if(child.drop) {
        changed=true;
        if(field.no===1)removedItems++;
        if(field.no===50195462||field.no===51431404||field.no===51845067||(owner===51845067&&field.no===5))removedRenderer=true;
        continue;
      }
      kept.push(field);
      if(child.changed) {
        changed=true;chunks.push(data.subarray(field.start,field.tagEnd),srEncodeVarint(child.bytes.length),child.bytes);
      } else chunks.push(data.subarray(field.start,field.end));
    }
    const emptiedList=(owner===50195462||owner===51431404)&&removedItems>0&&!kept.some(f=>f.no===1);
    const emptiedWrapper=removedRenderer&&!kept.some(f=>f.no>=10000000);
    const drop=emptiedList||emptiedWrapper;
    if(drop)stats.sections++;
    return {bytes:changed?srConcat(chunks):data,changed,drop};
  }
  try {
    const fields=srParseFeed(bytes,budget);
    if(!fields)return {bytes,changed:false,cards:0,sections:0,recognized:false};
    const result=visit(bytes,fields);
    return {...result,...stats,recognized:true};
  } catch(error) {
    return {bytes,changed:false,cards:0,sections:0,recognized:false};
  }
}
// For the decoded UMP Next handler and legacy unit-level callers. Serialize only
// known rich-item unions, then reuse the same structural classifier.
function Fi(node) {
  const layout=node?.renderInfo?.layoutRender?.eml?.split('|')[0];
  if(srAdLayouts.has(layout))return true;
  const content=node?.videoInfo?.videoContext?.videoContent;
  if(!content)return false;
  const fields=d.list(content).filter(f=>f.wireType===2).map(f=>{
    const size=srVarint(f.data,0);return {no:f.no,wire:2,data:f.data.subarray(size.offset)};
  });
  return srMetadataAd(fields,{fields:200000});
}
function Li(item) {
  const budget={fields:200000};
  return srIsFeedAd(srParseFeed(te.toBinary(item),budget),budget);
}
function Ir(root) {
  let changed=false;
  function walk(node) {
    if(!node||typeof node!=='object'||ArrayBuffer.isView(node))return;
    for(const [key,value] of Object.entries(node)) {
      if(key==='richItemContents'&&Array.isArray(value)) {
        for(let i=value.length-1;i>=0;i--) {
          if(Li(value[i])){value.splice(i,1);srAd(true,true);changed=true;}else walk(value[i]);
        }
      }else if(Array.isArray(value))for(const child of value)walk(child);
      else walk(value);
    }
  }
  walk(root);return changed;
}
function srRunResponse() {
  const endpoint=F.request.url.split('?')[0].split('/').pop();
  if(['browse','next','search'].includes(endpoint)) {
    const result=srRewriteFeed(F.response.bodyBytes);
    if(result.cards)srAd(true,true);
    if(!result.recognized)srReason('feed_unsupported');
    if(result.changed)F.done({bodyBytes:result.bytes});else F.exit();
  }else {
    if(endpoint==='get_watch') {
      const filtered=srRewriteFeed(F.response.bodyBytes);
      if(filtered.cards)srAd(true,true);
      if(filtered.changed)F.response.bodyBytes=filtered.bytes;
    }
    Ki();
  }
}
