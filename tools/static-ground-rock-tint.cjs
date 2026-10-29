const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict'),vm=require('node:vm');
const A='art/arrival-coherence/v01/static-ground',source=A+'/preview-src__world__Scatter.js',out=A+'/preview-rock-tint-src__world__Scatter.js';
let body=fs.readFileSync(source,'utf8');
const helper=`
// Only the new authored limestone uses this tint correction. The stored
// instance colours, seeded placement and legacy tier materials stay intact.
export function applyNewBoulderTint(material){
  if(material?.name!=='Wayfarer limestone mineral')return false;
  const previous=material.onBeforeCompile;
  material.onBeforeCompile=shader=>{
    previous?.(shader);
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',\`
      #if defined(USE_COLOR_ALPHA)
        diffuseColor*=vec4(mix(vColor.rgb,vec3(1.0),.8),vColor.a);
      #elif defined(USE_COLOR)
        diffuseColor.rgb*=mix(vColor,vec3(1.0),.8);
      #endif
    \`);
  };
  material.customProgramCacheKey=()=> 'mumu-wayfarer-limestone-instance-white80-v1';
  material.needsUpdate=true;return true;
}
`;
const marker="import { fieldBoulderPart } from './WorldArt.js';";assert(body.includes(marker));body=body.replace(marker,marker+'\n'+helper);
const rock='const rockStyle=boulders.rockA?.material.clone();if(rockStyle){rockStyle.color.set(0xffffff);rockStyle.userData.outlineParameters={visible:false};}';assert(body.includes(rock));body=body.replace(rock,rock+'\n  applyNewBoulderTint(rockStyle);');
new vm.SourceTextModule(body,{identifier:out});fs.writeFileSync(out,body);
console.log(JSON.stringify({alternative:out,sha256:crypto.createHash('sha256').update(body).digest('hex'),storedInstanceColoursChanged:false,fallbackChanged:false,scope:'new material named Wayfarer limestone mineral only; optional preview'}));
