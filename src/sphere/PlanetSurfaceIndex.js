// Read-only radial queries against the actual rendered triangles. No terrain
// resampling, extra subdivision, authoring heights or per-frame Raycaster.
// This index assumes a star-shaped terrain about the world origin (Mumu R68).
export class PlanetSurfaceIndex {
  constructor(mesh, { step = .025 } = {}) {
    if (!(step >= .008 && step <= .2)) throw Error('Invalid direction grid step');
    const started = performance.now();
    mesh.updateMatrixWorld(true);
    this.mesh = mesh; this.geometry = mesh.geometry;
    this.position = this.geometry.attributes.position;
    this.index = this.geometry.index;
    this.positionVersion = this.position.version; this.indexVersion = this.index?.version;
    this.world = mesh.matrixWorld.clone(); this.inverse = this.world.clone().invert();
    this.step = step; this.n = Math.ceil(2 / step) + 1;
    this.triangles = (this.index?.count || this.position.count) / 3;
    this.valid = true; this.queries = 0; this.misses = 0;
    this.lastCandidates = 0; this.totalCandidates = 0; this.maxCandidates = 0;
    const cells = this.n ** 3, offsets = new Uint32Array(cells + 1);
    const bounds = new Uint16Array(this.triangles * 6), p = this.position, ix = this.index;
    const w = this.world.elements;
    let refs = 0;
    for (let t = 0; t < this.triangles; t++) {
      const units = [];
      for (let j = 0; j < 3; j++) {
        const i = ix ? ix.getX(t * 3 + j) : t * 3 + j;
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const wx = w[0]*x+w[4]*y+w[8]*z+w[12], wy = w[1]*x+w[5]*y+w[9]*z+w[13], wz = w[2]*x+w[6]*y+w[10]*z+w[14];
        const len = Math.hypot(wx,wy,wz);
        if (!(len > 0)) throw Error('Terrain triangle touches radial origin');
        units.push([wx/len,wy/len,wz/len]);
      }
      const c = [units[0][0]+units[1][0]+units[2][0],units[0][1]+units[1][1]+units[2][1],units[0][2]+units[1][2]+units[2][2]];
      const cl = Math.hypot(...c); c[0]/=cl;c[1]/=cl;c[2]/=cl;
      const capDot = Math.min(...units.map(u=>u[0]*c[0]+u[1]*c[1]+u[2]*c[2]));
      if (!(capDot > .5)) throw Error('Triangle exceeds supported radial cap');
      // For any convex combination v of the unit vertices, |v| >= capDot.
      // Normalizing v moves each component by at most 1/capDot-1. This
      // conservatively encloses the curved spherical edges AND the interior.
      const pad = 1/capDot-1+2e-7, base=t*6;
      for(let d=0;d<3;d++) {
        bounds[base+d*2] = this._cell(Math.min(units[0][d],units[1][d],units[2][d])-pad);
        bounds[base+d*2+1] = this._cell(Math.max(units[0][d],units[1][d],units[2][d])+pad);
      }
      for(let x=bounds[base];x<=bounds[base+1];x++)for(let y=bounds[base+2];y<=bounds[base+3];y++)for(let z=bounds[base+4];z<=bounds[base+5];z++) {
        offsets[(x*this.n+y)*this.n+z+1]++; refs++;
      }
    }
    let occupied = 0;
    for(let i=1;i<offsets.length;i++){if(offsets[i])occupied++;offsets[i]+=offsets[i-1];}
    const ids=new Uint32Array(refs),cursor=offsets.slice(0,-1);
    for(let t=0;t<this.triangles;t++) {
      const b=t*6;
      for(let x=bounds[b];x<=bounds[b+1];x++)for(let y=bounds[b+2];y<=bounds[b+3];y++)for(let z=bounds[b+4];z<=bounds[b+5];z++) {
        const key=(x*this.n+y)*this.n+z;ids[cursor[key]++]=t;
      }
    }
    this.offsets=offsets;this.ids=ids;
    this.onDispose=()=>{this.valid=false;};this.geometry.addEventListener('dispose',this.onDispose);
    this.stats={step,triangles:this.triangles,cells,occupied,refs,indexBytes:offsets.byteLength+ids.byteLength,temporaryBuildBytes:bounds.byteLength+cursor.byteLength,buildMs:performance.now()-started};
  }
  _cell(v){return Math.max(0,Math.min(this.n-1,Math.floor((v+1)/this.step)));}
  isCurrent(){
    if(!this.valid||this.mesh.geometry!==this.geometry||this.geometry.attributes.position!==this.position||this.geometry.index!==this.index||this.position.version!==this.positionVersion||this.index?.version!==this.indexVersion)return false;
    const a=this.mesh.matrixWorld.elements,b=this.world.elements;for(let i=0;i<16;i++)if(a[i]!==b[i])return false;
    return true;
  }
  radiusAt(direction, hit) {
    if(!this.isCurrent())throw Error('Stale PlanetSurfaceIndex: rebuild after geometry or world transform changes');
    const len=Math.hypot(direction.x,direction.y,direction.z);
    if(!(len>0))throw Error('Zero terrain query direction');
    const ux=direction.x/len,uy=direction.y/len,uz=direction.z/len;
    const key=(this._cell(ux)*this.n+this._cell(uy))*this.n+this._cell(uz),start=this.offsets[key],end=this.offsets[key+1];
    this.lastCandidates=end-start;this.totalCandidates+=end-start;this.maxCandidates=Math.max(this.maxCandidates,end-start);this.queries++;
    // Inverse-transform the world radial line without normalizing its local
    // direction: Moller t then remains the distance in world metres.
    const e=this.inverse.elements,ox=e[12],oy=e[13],oz=e[14];
    const dx=e[0]*ux+e[4]*uy+e[8]*uz,dy=e[1]*ux+e[5]*uy+e[9]*uz,dz=e[2]*ux+e[6]*uy+e[10]*uz;
    const p=this.position,ix=this.index;let radius=-Infinity,triangle=-1;
    for(let k=start;k<end;k++) {
      const t=this.ids[k],i0=ix?ix.getX(t*3):t*3,i1=ix?ix.getX(t*3+1):t*3+1,i2=ix?ix.getX(t*3+2):t*3+2;
      const ax=p.getX(i0),ay=p.getY(i0),az=p.getZ(i0),e1x=p.getX(i1)-ax,e1y=p.getY(i1)-ay,e1z=p.getZ(i1)-az,e2x=p.getX(i2)-ax,e2y=p.getY(i2)-ay,e2z=p.getZ(i2)-az;
      const px=dy*e2z-dz*e2y,py=dz*e2x-dx*e2z,pz=dx*e2y-dy*e2x,det=e1x*px+e1y*py+e1z*pz;
      if(Math.abs(det)<1e-14)continue;
      const inv=1/det,tx=ox-ax,ty=oy-ay,tz=oz-az,u=(tx*px+ty*py+tz*pz)*inv;
      if(u < -1e-9 || u > 1+1e-9)continue;
      const qx=ty*e1z-tz*e1y,qy=tz*e1x-tx*e1z,qz=tx*e1y-ty*e1x,v=(dx*qx+dy*qy+dz*qz)*inv;
      if(v < -1e-9 || u+v > 1+1e-9)continue;
      const distance=(e2x*qx+e2y*qy+e2z*qz)*inv;
      if(distance>0 && distance>radius){radius=distance;triangle=t;}
    }
    if(triangle<0){this.misses++;if(hit){hit.triangle=-1;hit.radius=NaN;}return NaN;}
    if(hit){hit.triangle=triangle;hit.radius=radius;hit.candidates=end-start;}
    return radius;
  }
  dispose(){this.valid=false;this.geometry.removeEventListener('dispose',this.onDispose);this.offsets=null;this.ids=null;}
}
