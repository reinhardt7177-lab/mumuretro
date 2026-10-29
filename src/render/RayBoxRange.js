// Slab interval conventions follow the pinned Three r160 Ray.intersectBox.
// This only rejects broad-phase boxes; final triangle near/far tests stay exact.
export class RayBoxRange {
  constructor(){this.ox=NaN;this.oy=NaN;this.oz=NaN;this.dx=NaN;this.dy=NaN;this.dz=NaN;this.far=NaN;this.scaleSq=NaN;this.valid=false;}
  set(ray,far,scaleSq=ray.direction.lengthSq()){
    const o=ray.origin,d=ray.direction;
    if(this.ox===o.x&&this.oy===o.y&&this.oz===o.z&&Object.is(this.dx,d.x)&&Object.is(this.dy,d.y)&&Object.is(this.dz,d.z)&&this.far===far&&this.scaleSq===scaleSq)return this;
    this.ox=o.x;this.oy=o.y;this.oz=o.z;this.dx=d.x;this.dy=d.y;this.dz=d.z;this.far=far;this.scaleSq=scaleSq;
    this.ix=1/d.x;this.iy=1/d.y;this.iz=1/d.z;this.farSq=far*far;
    this.valid=Number.isFinite(o.x)&&Number.isFinite(o.y)&&Number.isFinite(o.z)&&Number.isFinite(d.x)&&Number.isFinite(d.y)&&Number.isFinite(d.z)&&Number.isFinite(scaleSq)&&scaleSq>0&&!Number.isNaN(far);
    // Include a small distance margin for local/world transform roundoff.
    this.margin=1e-8*Math.max(1,this.farSq);
    return this;
  }
  intersects(box){
    let lo=((this.ix>=0?box.min.x:box.max.x)-this.ox)*this.ix;
    let hi=((this.ix>=0?box.max.x:box.min.x)-this.ox)*this.ix;
    const ylo=((this.iy>=0?box.min.y:box.max.y)-this.oy)*this.iy,yhi=((this.iy>=0?box.max.y:box.min.y)-this.oy)*this.iy;
    if(lo>yhi||ylo>hi)return false;
    if(ylo>lo||Number.isNaN(lo))lo=ylo;if(yhi<hi||Number.isNaN(hi))hi=yhi;
    const zlo=((this.iz>=0?box.min.z:box.max.z)-this.oz)*this.iz,zhi=((this.iz>=0?box.max.z:box.min.z)-this.oz)*this.iz;
    if(lo>zhi||zlo>hi)return false;
    if(zlo>lo||Number.isNaN(lo))lo=zlo;if(zhi<hi||Number.isNaN(hi))hi=zhi;
    if(hi<0)return false;
    // An inside origin must not be rejected by a distant box exit.
    if(lo<=0)return true;
    return lo*lo*this.scaleSq<=this.farSq+this.margin;
  }
}
