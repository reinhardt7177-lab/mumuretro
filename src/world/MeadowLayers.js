import {fbm} from '../util/noise.js';
import {MathUtils} from 'three';

export const MEADOW_LAYERS=Object.freeze({version:2,samplesPerCell:70,capacities:[900,900,300,300],patchFrequency:.85,patchThreshold:.43,creamWeight:.06,goldWeight:.035,fieldCoverMinimum:.35,fieldCoverLow:.38,fieldCoverHigh:.60,nearPadInner:2.72,nearPadOuter:3.2});
export function plantPatchAt(direction,radius){
  const f=radius*MEADOW_LAYERS.patchFrequency;
  return Math.max(0,Math.min(1,.5+.5*fbm(direction.x*f,direction.y*f,direction.z*f,2)));
}

// Colour and actual plant clumps share one deterministic patch field.
export function fieldCoverAt(direction,radius,height,slope){
 const patch=plantPatchAt(direction,radius),s= MathUtils.smoothstep(patch,MEADOW_LAYERS.fieldCoverLow,MEADOW_LAYERS.fieldCoverHigh);
 return (1-MathUtils.smoothstep(slope,18,34))*(1-MathUtils.smoothstep(height,6.5,8))*(MEADOW_LAYERS.fieldCoverMinimum+(1-MEADOW_LAYERS.fieldCoverMinimum)*s);
}
