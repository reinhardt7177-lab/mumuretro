const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const A='art/arrival-coherence/v01/combined',file='src/world/GrassCarpet.js',out=A+'/preview-'+file.replaceAll('/','__');assert(!fs.existsSync(out),'Preserve prior carpet preview');
let s=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
const attr="geo.setAttribute('aGrass', new THREE.BufferAttribute(grassAmt, 1));";assert(s.includes(attr));s=s.replace(attr,attr+"\n  // Exposed rock has a single soil surface; the raised meadow cannot cross its faces.\n  if(!geo.getAttribute('aExposedRock'))geo.setAttribute('aExposedRock',new THREE.Float32BufferAttribute(new Float32Array(n),1));");
s=s.replace("attribute float aGrass;')","attribute float aGrass;\\nattribute float aExposedRock;\\nvarying float vExposedRock;')");
s=s.replace('float gw = aGrass;','vExposedRock=aExposedRock;\n        float gw = 0.0;');
const end="      `);\n  };";assert(s.includes(end));s=s.replace(end,"      `);\n    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\\nvarying float vExposedRock;').replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\\nif(vExposedRock>.5)discard;');\n  };");
s=s.replace('// 흐물거림 — 표면 법선 방향으로 흐르는 파도. 풀이 없는 곳(aGrass=0)은 움직이지 않는다.','// 토양과 잔디 바탕은 고정한다. 바람은 별도의 실제 풀잎에서만 표현한다.');
fs.writeFileSync(out,s);const m=JSON.parse(fs.readFileSync(A+'/manifest.json')),sha=b=>crypto.createHash('sha256').update(b).digest('hex');m.files.push({file,preview:out,beforeSha256:sha(fs.readFileSync(file)),previewSha256:sha(s)});fs.writeFileSync(A+'/manifest.json',JSON.stringify(m,null,2));console.log('Prepared rigid fallback ground and exposed-rock carpet mask. Await matching actual triangle flags.');
