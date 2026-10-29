import * as THREE from 'three';

// Authored relief, not a claim about the original game's height algorithm.
// Placement IDs are chosen on the legacy field before this deformation is enabled.
export function createLandscape(planet,peaks,spec,protectedSites,trailSamples){
  const R=planet.R,deg=Math.PI/180;
  const profiles=peaks.map((p,i)=>{
    const dir=planet.latLonToPos(p.lat,p.lon).normalize(),east=new THREE.Vector3(0,1,0).cross(dir).normalize(),north=dir.clone().cross(east).normalize(),angle=i*2.399963;
    return{...p,dir,east,north,cos:Math.cos(p.r*deg*1.35),rad:p.r*deg,ca:Math.cos(angle),sa:Math.sin(angle),phase:i*.73};
  });
  const protections=protectedSites.map(d=>({dir:d.clone(),inner:spec.preserveSiteInner,outer:spec.preserveSiteOuter,cos:Math.cos(spec.preserveSiteOuter/R)}));
  const trailCos=Math.cos(spec.preserveFirstTrailOuter/R);
  function protection(d){
    let amount=0;
    for(const p of protections){const dot=d.x*p.dir.x+d.y*p.dir.y+d.z*p.dir.z;if(dot>p.cos){const distance=Math.acos(Math.min(1,dot))*R;amount=Math.max(amount,1-THREE.MathUtils.smoothstep(distance,p.inner,p.outer));if(amount===1)return 1;}}
    let best=-1;for(const p of trailSamples){const dot=d.x*p.x+d.y*p.y+d.z*p.z;if(dot>best)best=dot;}
    if(best>trailCos)amount=Math.max(amount,1-THREE.MathUtils.smoothstep(Math.acos(Math.min(1,best))*R,spec.preserveFirstTrailInner,spec.preserveFirstTrailOuter));
    return amount;
  }
  function delta(d){
    const protect=protection(d);if(protect>=1)return 0;
    let change=0;
    for(const p of profiles){
      const dot=d.x*p.dir.x+d.y*p.dir.y+d.z*p.dir.z;if(dot<=p.cos)continue;
      const angle=Math.acos(Math.min(1,dot)),old=angle<p.rad?p.h*Math.pow(1-angle/p.rad,p.s):0;
      const u=Math.atan2(d.x*p.east.x+d.y*p.east.y+d.z*p.east.z,dot)/p.rad;
      const v=Math.atan2(d.x*p.north.x+d.y*p.north.y+d.z*p.north.z,dot)/p.rad;
      const x=u*p.ca-v*p.sa,z=u*p.sa+v*p.ca;
      const q=Math.hypot(x/spec.ridgeAspect,z*(1+.15*Math.sin(p.phase)));
      let shape=Math.max(0,1-q);
      // A broad cap and two unequal shoulders replace the symmetric point.
      shape=Math.min(1,Math.pow(shape,.83)/(1-spec.capRadius));
      shape+=.11*Math.sin(x*3.4+p.phase)*Math.max(0,1-q)*Math.max(0,1-q);
      const gully=Math.pow(.5+.5*Math.sin(Math.atan2(z,x)*7+p.phase+q*2.1),8);
      shape-=gully*spec.gullyAmplitude*THREE.MathUtils.smoothstep(q,.14,.8);
      let authored=p.h*Math.max(0,shape);
      authored+=Math.sin(authored*.94+x*2.7+p.phase)*spec.terraceAmplitude*THREE.MathUtils.smoothstep(q,.10,.45)*Math.max(0,1-q);
      change+=authored-old;
    }
    return THREE.MathUtils.clamp(change,-spec.maximumHeightDelta,spec.maximumHeightDelta)*(1-protect);
  }
  return{spec,profiles,delta,protection};
}
