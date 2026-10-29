const fs=require('node:fs'),{A,B}=require('./world-horizon-fixture.cjs'),read=f=>fs.readFileSync(B+'/before-'+f.replaceAll('/','__'),'utf8').replaceAll('\r\n','\n'),save=(f,s)=>fs.writeFileSync(A+'/preview-'+f.replaceAll('/','__'),s);
function replace(s,a,b){if(s.split(a).length!==2)throw Error('Expected one preview marker: '+a.slice(0,90));return s.replace(a,b);}
let source=read('src/data/lighting.js');source+='\n// Original Mumu distant cliff palette; not an original-game parameter.\nexport const HORIZON=Object.freeze({layers:Object.freeze([SKY.mtnFar,SKY.mtnNear,0x697f91]),shade:.24});\n';save('src/data/lighting.js',source);
source=read('src/render/Sky.js');source=source.replace("import { SKY, LIGHT } from '../data/lighting.js';","import { SKY, LIGHT } from '../data/lighting.js';\nimport {buildHorizonBackdrop,horizonAssets} from './HorizonBackdrop.js';");
source=source.replace('    this._up = new THREE.Vector3(0, 1, 0);','    this._up = new THREE.Vector3(0, 1, 0);\n    this._ground = new THREE.Vector3();\n    this.backdrop=null;this._scene=engine.scene;');
source=replace(source,'    for (const m of [this.dome, ...this.ridges]) {',`    if(!this.backdrop&&horizonAssets.loaded){
      this.backdrop=buildHorizonBackdrop();
      if(this.backdrop){for(const old of this.ridges){this._scene.remove(old);old.geometry.dispose();old.material.dispose();}this.ridges=this.backdrop.meshes;this._scene.add(this.backdrop.group);}
    }
    if(this.backdrop){this._ground.copy(this.planet.surfaceAt(up));this.backdrop.update(up,this._ground,q,this.engine.sun);}
    for (const m of this.backdrop?[this.dome]:[this.dome, ...this.ridges]) {`);save('src/render/Sky.js',source);
source=read('src/world/WoodlandStyle.js');source=source.replace("import { landmarkSpec } from './LandmarkAssets.js';","import { landmarkSpec } from './LandmarkAssets.js';\nconst foliageFocus={value:new THREE.Vector3()},foliageFocusEnabled={value:0};\nexport function setFoliageFocus(player){player.getFootPosition(foliageFocus.value).addScaledVector(player.up,.9);foliageFocusEnabled.value=1;}\n");
source=replace(source,'    previous?.(shader);\n    shader.vertexShader=',`    previous?.(shader);shader.uniforms.uFoliageFocus=foliageFocus;shader.uniforms.uFoliageFocusEnabled=foliageFocusEnabled;
    shader.vertexShader=`);
source=replace(source,"'#include <common>\\nvarying vec3 vFoliageWorld;')\n      .replace('#include <alphatest_fragment>'", "'#include <common>\\nvarying vec3 vFoliageWorld; uniform vec3 uFoliageFocus; uniform float uFoliageFocusEnabled;')\n      .replace('#include <alphatest_fragment>'");
source=replace(source,'        float dither=fract(dot(floor(gl_FragCoord.xy),vec2(.754877666,.569840296)));',`        vec3 focusRay=uFoliageFocus-cameraPosition;
        float focusT=dot(vFoliageWorld-cameraPosition,focusRay)/max(.01,dot(focusRay,focusRay));
        float distanceToView=length(vFoliageWorld-cameraPosition-focusRay*clamp(focusT,0.,1.));
        float focusVisibility=smoothstep(.38,.78,distanceToView);
        if(focusT>0.&&focusT<1.02)visibility*=mix(1.,focusVisibility,uFoliageFocusEnabled);
        float dither=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));`);save('src/world/WoodlandStyle.js',source);
source=read('src/world/Scatter.js');source=source.replace('woodlandMaterials, injectFoliageFade','woodlandMaterials, injectFoliageFade, setFoliageFocus');source=replace(source,'  const colliders = [];','  const colliders = [];\n  const treePairs=[];');
source=replace(source,"      colliders.push({ dir: dir.clone(), r: 0.26 * sz + 0.06, height: collisionHeights.tree * sz,kind:'tree',matrix:wood.m });","      const treeBody={ dir: dir.clone(), r: 0.26 * sz + 0.06, height: collisionHeights.tree * sz,kind:'tree',matrix:wood.m };colliders.push(treeBody);");
source=replace(source,"      place(cell, b ? 'canopyA' : 'canopyB', sz, 0.10,","      const crown=place(cell, b ? 'canopyA' : 'canopyB', sz, 0.10,");
source=replace(source,'      counts.tree++;','      treePairs.push({wood,crown,body:treeBody,size:sz,sample:i});\n      counts.tree++;');
source=replace(source,'  // 셀 × 종류마다 InstancedMesh 하나.',`  // Curated physical approach spaces. Consume the original RNG in full first:
  // all untouched trees, rocks and bushes retain their previous transforms.
  const approachClearance={originalTrees:counts.tree,removed:[],corridors:(opts.portalClearings||[]).map(s=>({...s,forward:new THREE.Vector3(0,0,1).applyQuaternion(s.quaternion),right:new THREE.Vector3(1,0,0).applyQuaternion(s.quaternion)}))};
  const tangent=new THREE.Vector3();
  for(const pair of treePairs)for(const corridor of approachClearance.corridors){
    const dot=pair.body.dir.dot(corridor.dir);if(dot<Math.cos(26/R))continue;
    tangent.copy(pair.body.dir).addScaledVector(corridor.dir,-dot).multiplyScalar(R);
    const z=tangent.dot(corridor.forward),x=tangent.dot(corridor.right),allowance=1.7*pair.size;
    if(z<3-allowance||z>18+allowance||Math.abs(x)>THREE.MathUtils.lerp(2.8,4.2,THREE.MathUtils.clamp((z-3)/15,0,1))+allowance)continue;
    pair.wood.approachPruned=pair.crown.approachPruned=pair.body.approachPruned=true;
    approachClearance.removed.push({portal:corridor.id,sample:pair.sample,dir:pair.body.dir.toArray(),size:pair.size,wood:pair.wood.m.toArray(),crown:pair.crown.m.toArray()});counts.tree--;break;
  }
  for(const cell of bins)for(const kind of kinds)cell[kind]=cell[kind].filter(item=>!item.approachPruned);
  for(let i=colliders.length-1;i>=0;i--)if(colliders[i].approachPruned)colliders.splice(i,1);

  // 셀 × 종류마다 InstancedMesh 하나.`);
source=replace(source,'    update(t) { uTime.value = t; },','    update(t) { uTime.value = t; },\n    updateFocus:setFoliageFocus,approachClearance,');save('src/world/Scatter.js',source);
// A fresh actual-route bake proved byte-identical (f352fa1d). Reuse the
// installed field and contract rather than ship duplicate textures.
fs.copyFileSync(B+'/before-src__world__MeadowField.js',A+'/preview-src__world__MeadowField.js');
source=read('src/boot.js');source=source.replace("import { Sky } from './render/Sky.js';","import { Sky } from './render/Sky.js';\nimport {loadHorizonAssets} from './render/HorizonBackdrop.js';");source=replace(source,'loadWorldArt()]);','loadWorldArt(), loadHorizonAssets()]);');source=replace(source,'  samples: 160000, seed: 91, exclude: nearShrine,',`  samples: 160000, seed: 91, exclude: nearShrine,
  portalClearings:worldArtSpec.loaded?shrineSpots.map((s,id)=>({id,dir:s.dir,quaternion:planet.frameAt(planet.surfaceAt(s.dir),0).quaternion})):[],`);
source=source.replaceAll('sky.update(player, engine.camera);','scatter.updateFocus(player); sky.update(player, engine.camera);').replaceAll('sky.update(player, engine.camera,dt);','scatter.updateFocus(player); sky.update(player, engine.camera,dt);');save('src/boot.js',source);
fs.mkdirSync(A+'/exports',{recursive:true});if(!fs.existsSync(A+'/exports/meadow-kit-v02.json'))fs.copyFileSync('assets/models/adventure/meadow-kit-v01.json',A+'/exports/meadow-kit-v02.json');
console.log('PREVIEW prepared; root runtime unchanged');
