const assert=require('node:assert/strict');
const files=['src/world/MeadowDetail.js','src/world/MeadowField.js','src/world/LandmarkAssets.js','src/boot.js'];exports.files=files;
function swap(body,from,to){assert(body.includes(from),'Groundcover source marker missing: '+from);return body.replace(from,to);}
exports.transform=(file,raw)=>{
 let s=raw.replace(/\r\n/g,'\n');
 if(file==='src/world/MeadowField.js'){
   s=swap(s,"import {terrainColor} from '../sphere/Planet.js';","import {terrainColor} from '../sphere/Planet.js';\nimport {MEADOW_LAYERS} from './MeadowLayers.js';");
   s=swap(s,'const data={','const data={plantLayers:MEADOW_LAYERS,');
   s=s.replaceAll('arrival-meadow-v01.json','arrival-groundcover-v01.json').replaceAll('meadow-clusters-v01.glb','arrival-groundcover-v01.glb');
   const before="for(let j=0;j<weights.length;j++)weights[j]=THREE.MathUtils.clamp(flipped?1-uv.getY(j):uv.getY(j),0,1);geometry.setAttribute('bendWeight',new THREE.BufferAttribute(weights,1));clusters.push(geometry);";
   const after="const accents=new Float32Array(uv.count);for(let j=0;j<weights.length;j++){weights[j]=THREE.MathUtils.clamp(flipped?1-uv.getY(j):uv.getY(j),0,1);accents[j]=uv.getX(j)>1.5?1:0;}geometry.setAttribute('bendWeight',new THREE.BufferAttribute(weights,1));geometry.setAttribute('plantAccent',new THREE.BufferAttribute(accents,1));geometry.userData.nativeHeight=meta.variants[i].height;clusters.push(geometry);";
   s=swap(s,before,after);
 }else if(file==='src/world/MeadowDetail.js'){
   s=swap(s,"import {MEADOW} from '../data/lighting.js';","import {MEADOW} from '../data/lighting.js';\nimport {MEADOW_LAYERS,plantPatchAt} from './MeadowLayers.js';");
   s=swap(s,"    mat.onBeforeCompile=shader=>{","    const height=geo.userData.nativeHeight||.42;mat.userData.meadowWindAmplitude=authored?Math.min(.075,.18*height):.16;mat.userData.meadowBodyBend=authored?Math.min(.14,.4*height):.4;\n    mat.onBeforeCompile=shader=>{");
   s=swap(s,"      shader.uniforms.meadowTime=clock;","      if(authored)shader.vertexShader=shader.vertexShader.replace('#include <color_vertex>','#include <color_vertex>\\nvColor.xyz=mix(vColor.xyz,color.xyz,plantAccent);');\n      shader.uniforms.meadowWind={value:mat.userData.meadowWindAmplitude};shader.uniforms.meadowBodyBend={value:mat.userData.meadowBodyBend};\n      shader.uniforms.meadowTime=clock;");
   s=swap(s,'uniform float meadowTime; uniform vec3 meadowPlayer; attribute float bendWeight;','uniform float meadowTime; uniform vec3 meadowPlayer; uniform float meadowWind; uniform float meadowBodyBend; attribute float bendWeight; attribute float plantAccent;');
   s=swap(s,"gust*${authored?'.075':'.16'}*bend","gust*meadowWind*bend");
   s=swap(s,"distanceToPlayer))*${authored?'.14':'.4'}*bend","distanceToPlayer))*meadowBodyBend*bend");
   const marker="sample.valid=!opts.exclude(sample.dir)&&opts.grassAt(sample.dir)>=.45;if(sample.valid){const p=planet.surfaceAt(sample.dir).addScaledVector(sample.dir,carpet.liftAt(sample.dir)-.015)";
   const replacement="sample.rim=!!opts.landingDir&&sample.dir.angleTo(opts.landingDir)*planet.R>MEADOW_LAYERS.nearPadInner&&sample.dir.angleTo(opts.landingDir)*planet.R<MEADOW_LAYERS.nearPadOuter;sample.valid=(!opts.exclude(sample.dir)||(sample.rim&&(opts.pathAt?.(sample.dir)||0)<.25))&&opts.grassAt(sample.dir)>=.45&&plantPatchAt(sample.dir,planet.R)>=MEADOW_LAYERS.patchThreshold;if(sample.valid){const p=(planet.groundSurfaceAt?planet.groundSurfaceAt(sample.dir):planet.surfaceAt(sample.dir)).addScaledVector(sample.dir,carpet.liftAt(sample.dir)-.015)";
   s=swap(s,marker,replacement);
   const assign="const mesh=meshes[(r+c+i)%meshes.length];if(mesh.count>=capacity)continue;\n      const rnd=k=>hash(r,c,i*7+k);";
   const changed="const rnd=k=>hash(r,c,i*7+k),choice=rnd(6);\n      const variant=!authored?(r+c+i)%meshes.length:sample.rim?0:choice<MEADOW_LAYERS.creamWeight?2:choice<MEADOW_LAYERS.creamWeight+MEADOW_LAYERS.goldWeight?3:choice<.48?0:1;\n      const mesh=meshes[variant];if(mesh.count>=capacity)continue;";
   s=swap(s,assign,changed);
   s=swap(s,"return authored?'meadow-clusters-v01':'legacy-leaf-profiles';","return authored?'arrival-groundcover-v01':'legacy-leaf-profiles';");
   s=swap(s,'placements,clock,playerUniform,cacheStats,','placements,clock,playerUniform,cacheStats,layerContract:MEADOW_LAYERS,');
 }else if(file==='src/world/LandmarkAssets.js'){
   const marker='const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld),positions=geometry.attributes.position;';
   s=swap(s,marker,"const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld),positions=geometry.attributes.position;\n    // The artist-painted stone tones are exported in the second colour slot.\n    if(o.name==='Arrival_Weathered'&&geometry.getAttribute('color_1'))geometry.setAttribute('color',geometry.getAttribute('color_1'));");
 }else if(file==='src/boot.js'){
   s=swap(s,'{grassAt:scatter.grassAt,exclude:nearGrass}', '{grassAt:scatter.grassAt,exclude:nearGrass,landingDir,pathAt:planetPathAt}');
 }
 return s;
};
