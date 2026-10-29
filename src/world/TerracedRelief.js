import * as THREE from 'three';

// Mumu's low limestone contour benches. IDs and scatter are chosen beforehand.
// The protected main path keeps its original heights; short side jumps are optional.
export function createTerracedRelief(planet,spec,protectedSites,trailSamples){
  const radius=planet.R,centre=planet.latLonToPos(...spec.centre).normalize(),cosOuter=Math.cos(spec.outerRadius/radius);
  const protections=protectedSites.map(s=>({dir:s.dir.clone(),inner:s.radius,outer:s.radius+2,cos:Math.cos((s.radius+2)/radius)}));
  const trailCos=Math.cos(spec.trailOuter/radius),smooth=THREE.MathUtils.smoothstep;
  const limestone=new THREE.Color('#d4cbb0'),shadow=new THREE.Color('#96957f');
  const east=new THREE.Vector3(0,1,0).cross(centre).normalize(),north=centre.clone().cross(east).normalize();
  // Erosion cuts long contour lines into unequal outcrops. Broad turf ramps
  // connect their ends; this is deliberately not one staircase round the hill.
  const patches=[{x:10,z:-9,rx:6,rz:4},{x:-3,z:-10,rx:8,rz:4.3},{x:12,z:1,rx:6.5,rz:5},{x:-6,z:0,rx:6,rz:5},{x:8,z:10,rx:7,rz:4},{x:-9,z:11,rx:7,rz:5},{x:-14,z:-13,rx:5,rz:3.6}];
  function outcrop(d){
    const dot=d.dot(centre),x=Math.atan2(d.dot(east),dot)*radius,z=Math.atan2(d.dot(north),dot)*radius;
    let mask=0;for(const p of patches){const u=(x-p.x)/p.rx,v=(z-p.z)/p.rz,q=Math.hypot(u,v),edge=.78+.11*Math.sin(x*.67+z*.43)+.055*Math.sin(x*1.3-z*.79);mask=Math.max(mask,1-smooth(q,edge,edge+.45));}
    return mask;
  }
  function influence(d){
    const dot=centre.dot(d);if(dot<=cosOuter)return 0;
    let weight=1-smooth(Math.acos(Math.min(1,dot))*radius,spec.innerRadius,spec.outerRadius);
    for(const p of protections){const dp=p.dir.dot(d);if(dp>p.cos){weight*=smooth(Math.acos(Math.min(1,dp))*radius,p.inner,p.outer);if(!weight)return 0;}}
    let best=-1;for(const p of trailSamples)best=Math.max(best,p.dot(d));
    if(best>trailCos)weight*=smooth(Math.acos(Math.min(1,best))*radius,spec.trailInner,spec.trailOuter);
    return weight*outcrop(d);
  }
  function refinementDelta(d,height){
    if(height<spec.minimumHeight||d.dot(centre)<=cosOuter)return 0;
    const weight=influence(d)*smooth(height,spec.minimumHeight,spec.minimumHeight+.9);if(!weight)return 0;
    const offset=.11*Math.sin(d.x*34+d.z*53)+.065*Math.sin(d.y*61-d.z*29);
    const level=height/spec.stepHeight+offset,whole=Math.floor(level),fraction=level-whole;
    const stepped=(whole+smooth(fraction,spec.faceStart,spec.faceEnd)-offset)*spec.stepHeight;
    return THREE.MathUtils.clamp(stepped-height,-spec.maximumHeightDelta,spec.maximumHeightDelta)*weight;
  }
  function delta(d,height){
    if(height<spec.minimumHeight||d.dot(centre)<=cosOuter)return 0;
    const weight=influence(d)*smooth(height,spec.minimumHeight,spec.minimumHeight+.9);if(!weight)return 0;
    // Quantize signed distance along a local geological plane normal.
    // Constant radial heights and the previous sine offset made bent caps.
    const denominator=d.dot(centre)+.07*d.dot(east)-.035*d.dot(north);
    const planeHeight=(radius+height)*denominator-radius,offset=.13;
    const level=planeHeight/spec.stepHeight+offset,whole=Math.floor(level),fraction=level-whole;
    const stepped=(radius+(whole+THREE.MathUtils.clamp((fraction-spec.faceStart)/(spec.faceEnd-spec.faceStart),0,1)-offset)*spec.stepHeight)/denominator-radius;
    return THREE.MathUtils.clamp(stepped-height,-spec.maximumHeightDelta,spec.maximumHeightDelta)*weight;
  }
  function colorAt(d,height,slope,out,weight=influence(d)){if(!weight)return out;
    // Faces expose limestone. Benches keep living turf; no contour outline props.
    const exposure=weight*smooth(slope,16,38),strata=.5+.5*Math.sin(height*19+d.x*17+d.z*13);
    out.lerp(limestone,exposure*.98).lerp(shadow,exposure*(.05+.07*strata));return out;
  }
  const refinementSites=patches.map(p=>({dir:centre.clone().addScaledVector(east,p.x/radius).addScaledVector(north,p.z/radius).normalize(),outer:Math.max(p.rx,p.rz)+1,rounds:spec.refinementRounds}));
  return{contract:{version:2,...spec,shapeRevision:6,profile:"local-plane-clamped-linear",planeNormal:{east:.07,north:-.035},phaseOffset:.13,creaseDegrees:25,refinementProfile:"preserved-cubic-reference",adaptiveEdgeError:.012,outcropPatches:patches,limestone:'#d4cbb0',shadow:'#96957f'},delta,refinementDelta,influence,colorAt,refinementSites};
}
