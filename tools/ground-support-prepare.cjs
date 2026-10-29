const fs=require('node:fs'),path=require('node:path');
const A='art/arrival-coherence/v01/ground-support';fs.mkdirSync(A,{recursive:true});
function planetPreview(source){
 let s=fs.readFileSync(source,'utf8').replace("import * as THREE from 'three';","import * as THREE from 'three';\nimport { PlanetSurfaceIndex } from './PlanetSurfaceIndex.js';");
 s=s.replace('  rebuildTerrain(){','  rebuildTerrain(){\n    this._groundIndex?.dispose(); this._groundIndex=null;');
 const before='  // 제자리에서 표면으로 투영 — SurfaceTransform이 매 이동마다 부른다.\n  projectToSurface(v) {\n    v.normalize();\n    return v.multiplyScalar(R + this.heightAt(v));\n  }';
 const after=`  // Authoring heightAt/surfaceAt remain analytic, so site choice, RNG,
  // static anchors and source GLB conforming do not silently change.
  enableMeshGround(options={}) {
    this._meshGroundEnabled=true;this._groundOptions=options;
    this._groundIndex?.dispose();this._groundIndex=new PlanetSurfaceIndex(this.mesh,options);
    return this._groundIndex;
  }
  get meshGroundActive() { return !!this._meshGroundEnabled; }
  meshGroundIndex() {
    if(!this._meshGroundEnabled)return null;
    if(!this._groundIndex?.isCurrent()) {
      this._groundIndex?.dispose();this._groundIndex=new PlanetSurfaceIndex(this.mesh,this._groundOptions);
    }
    return this._groundIndex;
  }
  groundHeightAt(dir) {
    const index=this.meshGroundIndex();if(!index)return this.heightAt(dir);
    const radius=index.radiusAt(dir);
    if(!Number.isFinite(radius))throw Error('Rendered terrain contact missing');
    return radius-this.R+(this.arrivalSupport?.delta(dir)||0);
  }
  groundSurfaceAt(dir,out=new THREE.Vector3()) {
    out.copy(dir).normalize();return out.multiplyScalar(this.R+this.groundHeightAt(out));
  }
  // Existing SurfaceTransform.moveOnSphere already calls this for every move,
  // including climb probes and collision recovery; jumpH remains independent.
  projectToSurface(v) {
    v.normalize();return v.multiplyScalar(this.R+this.groundHeightAt(v));
  }`;
 if(!s.includes(before))throw Error('Planet projection block changed: '+source);return s.replace(before,after);
}
for(const [name,source]of[['root','src/sphere/Planet.js'],['terraces','art/wayfarer-terraces/v02/preview-src__sphere__Planet.js']])fs.writeFileSync(path.join(A,'preview-'+name+'-src__sphere__Planet.js'),planetPreview(source));
fs.writeFileSync(path.join(A,'preview-src__sphere__SurfaceTransform.js'),fs.readFileSync('src/sphere/SurfaceTransform.js'));
console.log('Prepared isolated Planet previews; Root untouched.');
