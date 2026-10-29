import * as THREE from 'three';
import { landmarkSpec } from './LandmarkAssets.js';
const foliageFocus={value:new THREE.Vector3()},foliageFocusEnabled={value:0};
export function setFoliageFocus(player){if(!player){foliageFocusEnabled.value=0;return;}player.getFootPosition(foliageFocus.value).addScaledVector(player.up,.9);foliageFocusEnabled.value=1;}


// Same phase and speed as the meadow. Leaves keep their roots and only small
// tips/sprays move; the woody geometry remains a truthful camera collider.
export function injectWoodlandWind(material,time){
  const previous=material.onBeforeCompile;
  material.onBeforeCompile=shader=>{
    previous?.(shader);shader.uniforms.uWoodlandTime=time;
    const tree=landmarkSpec.trees||{height:6.1,branchStartHeight:2.3,wind:{speed:1.25,phaseX:.4,phaseZ:.3}},wind=tree.wind;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float uWoodlandTime;')
      .replace('#include <begin_vertex>',`#include <begin_vertex>
        float phase=instanceMatrix[3].x*${wind.phaseX.toFixed(2)}+instanceMatrix[3].z*${wind.phaseZ.toFixed(2)};
        float gust=sin(uWoodlandTime*${wind.speed.toFixed(2)}+phase)+.35*sin(uWoodlandTime*.57+phase*.31);
        float weight=pow(clamp((transformed.y-${tree.branchStartHeight.toFixed(2)})/${(tree.height-tree.branchStartHeight).toFixed(2)},0.,1.),2.);
        vec3 wind=normalize(vec3(.85,.1,.4));
        vec3 localWind=vec3(dot(instanceMatrix[0].xyz,wind),0.,dot(instanceMatrix[2].xyz,wind));
        transformed+=localWind*gust*.18*weight;`);
  };
}

export function injectFoliageFade(material){
  const previous=material.onBeforeCompile;
  material.onBeforeCompile=shader=>{
    previous?.(shader);shader.uniforms.uFoliageFocus=foliageFocus;shader.uniforms.uFoliageFocusEnabled=foliageFocusEnabled;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vFoliageWorld;')
      .replace('#include <project_vertex>',`#include <project_vertex>
        vec4 foliagePoint=vec4(transformed,1.);
        #ifdef USE_INSTANCING
          foliagePoint=instanceMatrix*foliagePoint;
        #endif
        vFoliageWorld=(modelMatrix*foliagePoint).xyz;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vFoliageWorld; uniform vec3 uFoliageFocus; uniform float uFoliageFocusEnabled;')
      .replace('#include <alphatest_fragment>',`#include <alphatest_fragment>
        float visibility=smoothstep(.45,1.8,distance(vFoliageWorld,cameraPosition));
        vec3 focusRay=uFoliageFocus-cameraPosition;
        float focusT=dot(vFoliageWorld-cameraPosition,focusRay)/max(.01,dot(focusRay,focusRay));
        float distanceToView=length(vFoliageWorld-cameraPosition-focusRay*clamp(focusT,0.,1.));
        float focusVisibility=smoothstep(.38,.78,distanceToView);
        if(focusT>0.&&focusT<1.02)visibility*=mix(1.,focusVisibility,uFoliageFocusEnabled);
        float dither=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
        if(dither>visibility)discard;`);
  };
  material.userData.cameraFade=true;
}

export function woodlandMaterials(trunk,canopy,time){
  if(!trunk||!canopy)return null;
  const bark=new THREE.MeshStandardMaterial({color:0xffffff,map:trunk.material.map,roughness:.96,vertexColors:true});
  const leaves=new THREE.MeshLambertMaterial({color:0xffffff,map:canopy.material.map,alphaTest:canopy.material.alphaTest||.45,side:THREE.DoubleSide,vertexColors:true});
  const depth=new THREE.MeshDepthMaterial({map:canopy.material.map,alphaTest:leaves.alphaTest,side:THREE.DoubleSide,depthPacking:THREE.RGBADepthPacking});
  injectWoodlandWind(leaves,time);injectFoliageFade(leaves);injectWoodlandWind(depth,time);
  for(const m of[bark,leaves])m.userData.outlineParameters={visible:false};
  // Leaf-only low-energy sky scattering. It remains albedo/map/instance tinted,
  // contributes before AO/fog/output and fades away from already lit surfaces.
  // Existing alpha discard, wind, camera fade and cast-shadow depth stay intact.
  const beforeScatter=leaves.onBeforeCompile;
  leaves.onBeforeCompile=shader=>{
    beforeScatter(shader);
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
      float mumuAlbedoLuma=max(.001,dot(diffuseColor.rgb,vec3(.2126,.7152,.0722)));
      float mumuIrradiance=dot(reflectedLight.directDiffuse+reflectedLight.indirectDiffuse,vec3(.2126,.7152,.0722))/mumuAlbedoLuma;
      float mumuShade=1.-smoothstep(.18,.85,mumuIrradiance);
      reflectedLight.indirectDiffuse+=diffuseColor.rgb*vec3(.94,1.0,.80)*(.40*mumuShade);
    `);
  };
  leaves.userData.mumuLeafScatter={gain:.40,shadeFade:[.18,.85],emissive:false};
  return{bark,leaves,depth};
}
