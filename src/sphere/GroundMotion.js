import * as THREE from 'three';

// Our own movement design, not inferred constants from a reference game.
// Velocity lives in the current ground tangent; displacement uses the average
// of old/new velocities so start and stop distances stay stable across frames.
export class GroundMotion {
  constructor({acceleration=24,brake=32,airControl=.45}={}){
    this.acceleration=acceleration;this.brake=brake;this.airControl=airControl;
    this.velocity=new THREE.Vector3();this.average=new THREE.Vector3();
    this.target=new THREE.Vector3();this.delta=new THREE.Vector3();
  }
  reset(){this.velocity.set(0,0,0);this.average.set(0,0,0);return this;}
  update(dt,direction,strength,maxSpeed,up,grounded=true){
    this.velocity.addScaledVector(up,-this.velocity.dot(up));this.average.copy(this.velocity);
    this.target.copy(direction).multiplyScalar(Math.min(1,Math.max(0,strength))*maxSpeed);
    this.delta.subVectors(this.target,this.velocity);
    const rate=(strength>1e-3?this.acceleration:this.brake)*(grounded?1:this.airControl),limit=rate*Math.max(0,dt);
    if(this.delta.length()>limit)this.delta.setLength(limit);
    this.velocity.add(this.delta);this.average.add(this.velocity).multiplyScalar(.5);
    return this.average;
  }
}
