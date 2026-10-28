// Synthetic wire fixtures, independently encoded; no user traffic or identifiers.
const v=number=>{const out=[];do{const b=number%128;number=Math.floor(number/128);out.push(b|(number?128:0));}while(number);return Buffer.from(out);};
const field=(no,data)=>{data=Buffer.from(data);return Buffer.concat([v(no*8+2),v(data.length),data]);};
const path=(tags,data)=>tags.reduceRight((bytes,no)=>field(no,bytes),Buffer.from(data));
const concat=(...items)=>Buffer.concat(items.flat());
const metadataPaths=[
  [454362329,8,4,2],[224457493,2,3],[461080918,7,4,2],
  [472329933,7,4,2],[478840678,7,4,2],[224590612,2,3],
  [224590612,2,9],[394770629,8,4,2],[491441836,8,4,2],
  [232954548,19,3],[456430508,7,4,2]
];
function card({label='Sponsored',variant=0,layout='video_card.eml',title='A video',ad=false}={}) {
  const content=ad?path(metadataPaths[variant],Buffer.from(label)):field(900,Buffer.from(title));
  return path([153515154,172660663],concat(path([1,168777401,5],content),path([2,183314536,1],Buffer.from(layout))));
}
const section=cards=>field(50195462,concat(cards.map(c=>field(1,c)),field(2,Buffer.from('section header'))));
const feed=(sections,endpoint='browse',extra=Buffer.alloc(0))=>{
  const list=field(49399797,concat(sections.map(s=>field(1,s)),field(2,Buffer.from('pagination-token'))));
  const root=endpoint==='next'?path([7,51779735,1],list):field(endpoint==='search'?4:10,list);
  return concat(root,extra);
};
function read(bytes) {
  bytes=Buffer.from(bytes);let offset=0;const fields=[];
  function num(){let n=0,m=1;while(true){if(offset>=bytes.length)throw Error('truncated');let b=bytes[offset++];n+=(b&127)*m;if(!(b&128))return n;m*=128;}}
  while(offset<bytes.length){const start=offset,t=num(),no=Math.floor(t/8),wire=t%8;
    if(wire===2){let len=num(),data=bytes.subarray(offset,offset+len);offset+=len;fields.push({no,data,raw:bytes.subarray(start,offset)});}
    else if(wire===0){num();fields.push({no,raw:bytes.subarray(start,offset)});}
    else if(wire===1||wire===5){offset+=wire===1?8:4;fields.push({no,raw:bytes.subarray(start,offset)});}
    else throw Error('unsupported fixture wire');
  }return fields;
}
const at=(bytes,tags)=>tags.reduce((items,no)=>items.flatMap(item=>read(item).filter(f=>f.no===no).map(f=>f.data)),[bytes]);
module.exports={v,field,path,concat,metadataPaths,card,section,feed,read,at};
