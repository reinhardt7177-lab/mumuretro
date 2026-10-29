import * as T from 'three';

// Select geometry by the size it actually occupies in the drawing buffer. The
// authored reference box belongs to this object's local coordinate system.
export class ScreenSizeLOD extends T.LOD {
  constructor(levels,referenceBox,viewport){
    super();this.name='Screen size detail';this.referenceBox=referenceBox.clone();this.viewport=viewport;this.projectedPixels=Infinity;
    if(referenceBox.isEmpty()||levels.length<2||levels[0].maxPixels!==Infinity)throw Error('Invalid detail reference');
    levels.forEach((level,i)=>{if(i&&(!(level.maxPixels>0)||!Number.isFinite(level.maxPixels)||level.maxPixels>=levels[i-1].maxPixels))throw Error('Unordered detail sizes');});
    this.pixelLevels=levels.map((level,i)=>{
      super.addLevel(level.object,i,level.hysteresis??.1);level.object.visible=i===0;return level;
    });
    this._corners=Array.from({length:8},()=>new T.Vector3());this._point=new T.Vector3();
    for(let i=0;i<8;i++)this._corners[i].set(i&1?referenceBox.max.x:referenceBox.min.x,i&2?referenceBox.max.y:referenceBox.min.y,i&4?referenceBox.max.z:referenceBox.min.z);
  }
  screenPixels(camera){
    const size=this.viewport();
    if(!size||!Number.isFinite(size.width)||!Number.isFinite(size.height)||size.width<=0||size.height<=0)return Infinity;
    this.updateWorldMatrix(true,false);camera.updateWorldMatrix(true,false);
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(const corner of this._corners){
      const p=this._point.copy(corner).applyMatrix4(this.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
      // Near-plane intersection and unknown projections keep full geometry.
      if(p.z>=-camera.near||(!camera.isPerspectiveCamera&&!camera.isOrthographicCamera))return Infinity;
      p.applyMatrix4(camera.projectionMatrix);
      if(![p.x,p.y,p.z].every(Number.isFinite))return Infinity;
      minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);
    }
    return Math.max((maxX-minX)*size.width/2,(maxY-minY)*size.height/2);
  }
  update(camera){
    const pixels=this.projectedPixels=this.screenPixels(camera),levels=this.pixelLevels;
    let index=this._currentLevel;
    while(index>0&&pixels>levels[index].maxPixels*(1+(levels[index].hysteresis??.1)))index--;
    while(index+1<levels.length&&pixels<=levels[index+1].maxPixels)index++;
    this._currentLevel=index;
    for(let i=0;i<levels.length;i++)levels[i].object.visible=i===index;
  }
}
