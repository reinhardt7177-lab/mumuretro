// Standard glTF byte-normalized vertex tone; positions/normals/indices stay exact.
const fs=require('node:fs'),crypto=require('node:crypto'),{A,B}=require('./world-horizon-fixture.cjs'),file=A+'/exports/world-horizon-v03.glb',raw=A+'/exports/world-horizon-v03-raw.glb';
if(fs.existsSync(raw))throw Error('Preserve the original packing result');
const blob=fs.readFileSync(file),jsonLength=blob.readUInt32LE(12),doc=JSON.parse(blob.subarray(20,20+jsonLength)),binStart=20+jsonLength+8,bin=blob.subarray(binStart),colourIds=new Set(doc.meshes.flatMap(m=>m.primitives.map(p=>p.attributes.COLOR_0))),replacements=new Map();
let error=0;
for(const id of colourIds){
 const a=doc.accessors[id],view=doc.bufferViews[a.bufferView],users=doc.accessors.filter(x=>x.bufferView===a.bufferView);
 const components={VEC3:3,VEC4:4}[a.type];
 if(a.componentType!==5126||!components||users.length!==1||a.byteOffset)throw Error('Unsupported source colour layout');
 const bytes=Buffer.alloc(a.count*components),stride=view.byteStride||components*4;
 for(let i=0;i<a.count;i++)for(let k=0;k<components;k++){const original=bin.readFloatLE(view.byteOffset+i*stride+k*4);if(original<0||original>1)throw Error('Tone outside normalized colour range');const value=Math.round(original*255);bytes[i*components+k]=value;error=Math.max(error,Math.abs(value/255-original));}
 replacements.set(a.bufferView,bytes);a.componentType=5121;a.normalized=true;delete a.min;delete a.max;
}
let offset=0;const chunks=[],preserved=[];const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
doc.bufferViews.forEach((view,i)=>{const original=bin.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength),bytes=replacements.get(i)||original,padding=(4-offset%4)%4;if(padding){chunks.push(Buffer.alloc(padding));offset+=padding;}view.byteOffset=offset;view.byteLength=bytes.length;if(replacements.has(i))delete view.byteStride;else preserved.push({view:i,bytes:bytes.length,sha256:hash(bytes),unchanged:bytes.equals(original)});chunks.push(bytes);offset+=bytes.length;});
if(offset%4){chunks.push(Buffer.alloc(4-offset%4));offset+=4-offset%4;}doc.buffers[0].byteLength=offset;
let json=Buffer.from(JSON.stringify(doc));if(json.length%4)json=Buffer.concat([json,Buffer.alloc(4-json.length%4,32)]);const binary=Buffer.concat(chunks),header=Buffer.alloc(20),binHeader=Buffer.alloc(8);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(20+json.length+8+binary.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);binHeader.writeUInt32LE(binary.length,0);binHeader.writeUInt32LE(0x004e4942,4);const packed=Buffer.concat([header,json,binHeader,binary]);
const result={pass:error<=.5/255+1e-8&&preserved.every(x=>x.unchanged)&&packed.length<blob.length,rawBytes:blob.length,webBytes:packed.length,maximumToneError:error,quantizedColourAccessors:colourIds.size,unchangedOtherViews:preserved,scope:'Only per-vertex grey tone quantized to standard normalized UNSIGNED_BYTE. Geometry, topology, normals, UVs, transforms and material constants remain byte-exact.'};
if(!result.pass)throw Error('Packing audit failed');fs.copyFileSync(file,raw);fs.writeFileSync(file,packed);fs.writeFileSync(B+'/packing.json',JSON.stringify(result,null,2));console.log(JSON.stringify({...result,unchangedOtherViews:preserved.length}));
