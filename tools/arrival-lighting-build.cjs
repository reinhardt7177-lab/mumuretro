const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const A='art/arrival-coherence/v01/lighting';fs.mkdirSync(A,{recursive:true});
const files=['src/core/Engine.js','src/render/Sky.js','src/render/Post.js','src/data/lighting.js','src/world/WoodlandStyle.js'];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const release=JSON.parse(fs.readFileSync('reports/2026-10-26/evidence/arrival-dais/build-release.json'));
const manifest=Object.entries(release.files).map(([f,h])=>{const raw=fs.readFileSync(f),canonical=!f.startsWith('vendor/')&&/\.(?:html|js|css|json|svg|txt|md)$/.test(f)?Buffer.from(raw.toString('utf8').replace(/\r\n/g,'\n')):raw;assert.equal(hash(canonical),h,f);return{file:f,sha256:hash(raw),canonicalSha256:h};});
assert.equal(manifest.length,466);
const record={createdUtc:new Date().toISOString(),runtimeFiles:manifest,files,rootFive:manifest.filter(r=>['src/boot.js','src/world/Landing.js','src/world/LandmarkAssets.js','src/world/MeadowField.js','src/sphere/Planet.js'].includes(r.file)),scope:'routing preview only; no root mutation'};
if(!fs.existsSync(A+'/baseline.json'))fs.writeFileSync(A+'/baseline.json',JSON.stringify(record,null,2));
function replace(source,a,b){assert(source.includes(a),'Missing patch anchor: '+a.slice(0,90));return source.replace(a,b);}
for(const file of files){
 const id=file.replaceAll('/','__'),raw=fs.readFileSync(file,'utf8');if(!fs.existsSync(A+'/before-'+id))fs.writeFileSync(A+'/before-'+id,raw);let s=raw.replace(/\r\n/g,'\n');
 if(file==='src/data/lighting.js'){
  s=replace(s,'sun:    0xffe8b8','sun:    0xffe6b0');
  s=replace(s,'shadow: 0x5e7396','shadow: 0xb8c9d6');
  s=replace(s,'air:    0xc2dce6','air:    0xa9cde5');
  s=replace(s,'top:     0x4e9bd4','top:     0x4b9fdf');
  s=replace(s,'export const SUN_ELEV_DEG = 42;','export const SUN_ELEV_DEG = 46;');
  s=replace(s,'hemi:  1.05,','hemi:  1.15,');
  s=replace(s,'fill:  0.28,','fill:  0.35,');
  s+='\n// Preview values authored for Mumu; not measured from another game.\nexport const OUTDOOR = Object.freeze({fogNear:12,fogFar:100,skyTransition:.22,ground:0xb2a98a,environmentGain:.18,environmentKey:.20,environmentWidth:256,environmentHeight:128,planetBloom:.035,planetSaturation:1.02,planetContrast:1.015,planetVignette:.14});\n';
 }
 if(file==='src/render/Sky.js'){
  s=replace(s,"import { SKY, LIGHT } from '../data/lighting.js';","import { SKY, LIGHT, OUTDOOR } from '../data/lighting.js';");
  s=replace(s,'uniform float uSkyTime;','uniform float uSkyTime, uSkyTransition;');
  s=replace(s,'smoothstep(0.0, 0.62, t)','smoothstep(0.0, uSkyTransition, t)');
  s=replace(s,'uSkyTime: { value: 0 },','uSkyTime: { value: 0 },\n      uSkyTransition: { value: OUTDOOR.skyTransition },');
 }
 if(file==='src/render/Post.js'){
  s=replace(s,"import { LOOKS } from './LookProfiles.js';","import { LOOKS } from './LookProfiles.js';\nimport { OUTDOOR } from '../data/lighting.js';");
  s=replace(s,"const look=LOOKS[key]||LOOKS.planet;this.lookKey=key;","const look=key==='planet'?{saturation:OUTDOOR.planetSaturation,contrast:OUTDOOR.planetContrast,vignette:OUTDOOR.planetVignette,bloom:OUTDOOR.planetBloom}:(LOOKS[key]||LOOKS.planet);this.lookKey=key;");
 }
 if(file==='src/core/Engine.js'){
  s=replace(s,'FOG_DENSITY, SUN_ELEV_DEG, SUN_AZIM_DEG','FOG_DENSITY, SUN_ELEV_DEG, SUN_AZIM_DEG, OUTDOOR');
  s=replace(s,'scene.fog = new THREE.FogExp2(SKY, FOG_DENSITY);','scene.fog = new THREE.Fog(SKY, OUTDOOR.fogNear, OUTDOOR.fogFar);\n    this.outdoorScene = scene;');
  s=replace(s,'// ── 대기 원근 (§3) ──────────────────────────────────────────────────\n    // 구버전엔 이게 사실상 없어서 근경과 원경의 채도가 같았다 — 화면이 납작해 보인 진짜 원인.\n    // 선형 안개 대신 지수 안개를 쓴다: 1 − exp(−(d·k)²)라 근경은 거의 손대지 않고\n    // 원경만 빠르게 대기색으로 간다. k는 "지평선 28u에서 0.60 수렴"에서 역산한 값이다.','// Preview: keep the platform/near path clear, then separate middle and distant layers.');
  s=replace(s,'this.hemi = new THREE.HemisphereLight(LIGHT.air, 0x8a8560, INTENSITY.hemi);','this.hemi = new THREE.HemisphereLight(LIGHT.air, OUTDOOR.ground, INTENSITY.hemi);');
  s=replace(s,'scene.add(fill);','scene.add(fill); scene.add(fill.target);');
  s=replace(s,'this.sun.target.updateMatrixWorld();','this.sun.target.updateMatrixWorld();\n    // All exterior lights use the same spherical local frame as the ground.\n    this.hemi.position.copy(up);\n    this.fill.position.copy(player.position).addScaledVector(up,38).addScaledVector(_north,24).addScaledVector(_east,-28);\n    this.fill.target.position.copy(player.position);this.fill.target.updateMatrixWorld();\n    this._updateOutdoorEnvironment(up, _sunDir);');
  s=replace(s,'  // 후처리를 붙이면 컴포저가',`  // Low frequency, linear radiance from sky and ground; no geometry or texture edits.
  // PMREM is reused until local up changes by 8 degrees. Direct sun remains a light.
  _updateOutdoorEnvironment(up,sunDir) {
    if(this._environmentUp&&this._environmentUp.dot(up)>.9903)return;
    this._environmentUp??=new THREE.Vector3();this._environmentUp.copy(up);
    const w=OUTDOOR.environmentWidth,h=OUTDOOR.environmentHeight;
    const top=new THREE.Color(SKY_C.top),air=new THREE.Color(SKY),ground=new THREE.Color(OUTDOOR.ground),key=new THREE.Color(LIGHT.sun),c=new THREE.Color(),d=new THREE.Vector3(),data=new Float32Array(w*h*4);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const phi=(x+.5)/w*Math.PI*2,theta=(y+.5)/h*Math.PI;
      // DataTexture flipY=false; invert equirectUv(u,v), whose v=0 is -Y.
      d.set(-Math.sin(theta)*Math.cos(phi),-Math.cos(theta),-Math.sin(theta)*Math.sin(phi));
      const altitude=d.dot(up),skyMix=THREE.MathUtils.smoothstep(altitude,-.18,.24);
      c.copy(ground).lerp(air,skyMix).lerp(top,THREE.MathUtils.smoothstep(altitude,.18,.92)*.55).multiplyScalar(OUTDOOR.environmentGain);
      const glow=Math.pow(Math.max(0,d.dot(sunDir)),12)*OUTDOOR.environmentKey;
      c.r+=key.r*glow;c.g+=key.g*glow;c.b+=key.b*glow;
      const i=(y*w+x)*4;data[i]=c.r;data[i+1]=c.g;data[i+2]=c.b;data[i+3]=1;
    }
    const texture=new THREE.DataTexture(data,w,h,THREE.RGBAFormat,THREE.FloatType);
    texture.mapping=THREE.EquirectangularReflectionMapping;texture.colorSpace=THREE.LinearSRGBColorSpace;texture.needsUpdate=true;
    this._outdoorPmrem??=new THREE.PMREMGenerator(this.renderer);
    const previous=this._outdoorEnvironment;this._outdoorEnvironment=this._outdoorPmrem.fromEquirectangular(texture);texture.dispose();
    this.outdoorScene.environment=this._outdoorEnvironment.texture;previous?.dispose();
    this.outdoorScene.userData.outdoorLighting={localUp:up.toArray(),linearEnvironment:[w,h],environmentGain:OUTDOOR.environmentGain,key:OUTDOOR.environmentKey,lights:3,additionalRealtimeLights:0};
  }

  // 후처리를 붙이면 컴포저가`);
 }
 if(file==='src/world/WoodlandStyle.js'){
  s=replace(s,'  return{bark,leaves,depth};',`  // Leaf-only low-energy sky scattering. It remains albedo/map/instance tinted,
  // contributes before AO/fog/output and fades away from already lit surfaces.
  // Existing alpha discard, wind, camera fade and cast-shadow depth stay intact.
  const beforeScatter=leaves.onBeforeCompile;
  leaves.onBeforeCompile=shader=>{
    beforeScatter(shader);
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',\`#include <lights_fragment_end>
      float mumuAlbedoLuma=max(.001,dot(diffuseColor.rgb,vec3(.2126,.7152,.0722)));
      float mumuIrradiance=dot(reflectedLight.directDiffuse+reflectedLight.indirectDiffuse,vec3(.2126,.7152,.0722))/mumuAlbedoLuma;
      float mumuShade=1.-smoothstep(.18,.85,mumuIrradiance);
      reflectedLight.indirectDiffuse+=diffuseColor.rgb*vec3(.94,1.0,.80)*(.40*mumuShade);
    \`);
  };
  leaves.userData.mumuLeafScatter={gain:.40,shadeFade:[.18,.85],emissive:false};
  return{bark,leaves,depth};`);
 }
 fs.writeFileSync(A+'/preview-'+id,s);
}
fs.writeFileSync(A+'/preview-files.json',JSON.stringify({files:files.map(file=>({file,beforeSha256:hash(fs.readFileSync(file)),previewSha256:hash(fs.readFileSync(A+'/preview-'+file.replaceAll('/','__')))}))},null,2));
console.log(JSON.stringify({pass:true,rootCanonicalFiles:466,previewFiles:files.length,output:A}));
