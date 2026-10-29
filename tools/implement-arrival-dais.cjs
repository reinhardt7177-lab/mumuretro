const fs=require('node:fs'),assert=require('node:assert/strict');
const A='art/arrival-dais/v01',B='reports/2026-10-26/evidence/arrival-dais';
for(const view of ['front','side','rear'])assert(fs.existsSync(A+'/reference-'+view+'.png'),'Need the revised matched-view target '+view);
function output(file,source){const filename=A+'/preview-'+file.replaceAll('/','__');assert(!fs.existsSync(filename),'Preserve existing preview');fs.writeFileSync(filename,source);}
let source=fs.readFileSync(B+'/before-src__world__LandmarkAssets.js','utf8');
assert(source.includes("['observatory','woodland']"));source=source.replace("['observatory','woodland']","['observatory','woodland','arrival']");
source=source.replace('`assets/models/adventure/${id}-v03.glb`',"(id==='arrival'?'assets/models/adventure/arrival-dais-v01.glb':`assets/models/adventure/${id}-v03.glb`)");
source+=`
// The asset stays editable with local floor0. Bake each source world transform,
// then seat the whole foundation/stone/glass on the exact native height field.
export function arrivalPart(planet,frame){
  const source=models.get('arrival');if(!source)return null;
  source.updateMatrixWorld(true);
  const group=new THREE.Group();group.name='Mumu authored arrival dais';
  const transform=new THREE.Matrix4().compose(frame.position,frame.quaternion,new THREE.Vector3(1,1,1)),inverse=transform.clone().invert();
  const direction=new THREE.Vector3(),point=new THREE.Vector3();
  source.traverse(o=>{if(!o.isMesh)return;
    const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld),positions=geometry.attributes.position;
    for(let i=0;i<positions.count;i++){
      const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
      direction.set(x,0,z).applyMatrix4(transform).normalize();
      planet.surfaceAt(direction,point).addScaledVector(direction,y-.22+.006).applyMatrix4(inverse);
      positions.setXYZ(i,point.x,point.y,point.z);
    }
    geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const material=o.material.clone();material.userData.outlineParameters={visible:false};
    const mesh=new THREE.Mesh(geometry,material);mesh.name=o.name;mesh.castShadow=mesh.receiveShadow=true;
    group.add(mesh);
  });
  group.userData={asset:'arrival-dais-v01',sourceFloor:0,sourceWalkHeight:.22,conformed:true,surfaceOffset:.006,meshes:group.children.length};
  return group;
}
`;
output('src/world/LandmarkAssets.js',source);
source=fs.readFileSync(B+'/before-src__world__Landing.js','utf8');
source=source.replace("import { naturePart } from './NatureAssets.js';","import { naturePart } from './NatureAssets.js';\nimport {arrivalPart} from './LandmarkAssets.js';");
const start=source.indexOf('  // 낮은 돌판'),end=source.indexOf('  // 기둥 —');assert(start>0&&end>start);
const block=source.slice(start,end).replace('  const ringMat = basic(LAB.glow, 0.55);\r\n','').replace('  const ringMat = basic(LAB.glow, 0.55);\n','');
source=source.slice(0,start)+`  const authored=arrivalPart(planet,fr);
  const ringMat=basic(LAB.glow,.55);
  if(authored)group.add(authored);
  else {
${block}  }

`+source.slice(end);
assert(!source.includes('const ringMat = basic'),'Remove the fallback duplicate material declaration');
source=source.replace('burst.position.y = 0.218;','burst.position.y = authored ? .028 : .218;');
source=source.replace('ringMat.opacity = 0.45 + Math.sin(t * 1.8) * 0.16;','ringMat.opacity = 0.45 + Math.sin(t * 1.8) * 0.16;\n      if(authored)for(const mesh of authored.children)if(mesh.name===\'Arrival_Seated\')mesh.material.emissiveIntensity=.14+Math.sin(t*1.8)*.025;');
output('src/world/Landing.js',source);
fs.copyFileSync(B+'/before-src__boot.js',A+'/preview-src__boot.js');
console.log('Created landing and asset-loader previews; other gameplay and all terrain remain unchanged.');
