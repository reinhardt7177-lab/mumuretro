import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {installStaticRaycastTree} from '../render/StaticRaycastTree.js';

let pending;
function assets(){
  return pending??=fetch('assets/models/adventure/chronicle-shaft-v02.json').then(async response=>{
    if(!response.ok)throw Error('Shaft manifest unavailable');
    const spec=await response.json(),source=(await new GLTFLoader().loadAsync(spec.model)).scene;
    return {spec,source};
  }).catch(error=>{console.warn('[shaft] original gallery retained',error);return null;});
}

export function registerChronicleShaft(room){
  if(room.spec.id!=='strata')return room;
  const entry=room.gates.find(e=>e.gate.rocks),gate=entry?.gate;
  if(!gate)return room;
  const art=room.shaftArt={loaded:false,models:[],cameraMeshes:[],colliders:[],stones:[],hidden:[]};
  art.ready=Promise.all([room.ready,assets()]).then(([,asset])=>{
    if(!asset)return false;
    const {spec,source}=asset,parts={};source.updateMatrixWorld(true);
    for(const name of ['ShaftFrame','GalleryFloor','FallingStone','StoneChip']){
      parts[name]=source.getObjectByName(name);if(!parts[name])throw Error('Missing '+name);
    }
    const stoneBox=new T.Box3().setFromObject(parts.FallingStone,true),floorBox=new T.Box3().setFromObject(parts.GalleryFloor,true);
    if(['x0','x1','z0','z1'].some(k=>gate.seg[k]!==spec.contract.seg[k])||Math.abs(stoneBox.min.y)>.001||Math.abs(stoneBox.max.y-1.7)>.001||Math.abs(floorBox.max.y)>.001)throw Error('Shaft spatial contract changed');
    const mid=(gate.seg.z0+gate.seg.z1)/2,rects=room.dungeon.rects;
    const materials=new Map();
    function add(name,position,dynamic=false){
      const root=parts[name].clone(true);root.name='Shaft '+name;root.position.fromArray(position);room.scene.add(root);art.models.push(root);
      root.traverse(mesh=>{if(mesh.isMesh){if(!materials.has(mesh.material)){const mat=mesh.material.clone();mat.envMapIntensity=.65;mat.userData.outlineParameters={visible:false};materials.set(mesh.material,mat);}mesh.material=materials.get(mesh.material);mesh.castShadow=name!=='GalleryFloor';mesh.receiveShadow=true;
        if(name!=='GalleryFloor'){if(!dynamic)installStaticRaycastTree(mesh);art.cameraMeshes.push(mesh);}
      }});return root;
    }
    art.frame=add('ShaftFrame',[0,0,mid]);art.floor=add('GalleryFloor',[0,0,mid]);
    for(const body of spec.parts.ShaftFrame.solids){
      const [x,y,z]=body.position,[w,h,d]=body.size;
      art.colliders.push({shape:'box',x0:x-w/2,x1:x+w/2,z0:mid+z-d/2,z1:mid+z+d/2,minY:y-h/2,maxY:y+h/2,padding:.28,escapeX:-Math.sign(x),shaftArt:true});
    }
    room.obstacles.push(...art.colliders);(rects.cameraOccluders??=[]).push(...art.cameraMeshes);
    const previousFloor=rects.floorAt?.bind(rects);
    rects.floorAt=(x,z,y=0)=>{let h=previousFloor?.(x,z,y)??0;for(const b of art.colliders)if(x>=b.x0&&x<=b.x1&&z>=b.z0&&z<=b.z1&&y+.26>=b.maxY)h=Math.max(h,b.maxY);return h;};
    for(const mesh of room.scene.children){
      if(mesh.userData.openFieldFloor==='r2'){mesh.position.y-=.15;art.oldFloor=mesh;}
      if(mesh.userData.openFieldFloorMark==='r2'){mesh.geometry=mesh.geometry.clone();mesh.geometry.setDrawRange(0,0);art.hidden.push(mesh);}
    }
    const footprintGeometry=new T.CircleGeometry(1,64),rimGeometry=new T.RingGeometry(.965,1,64);
    const dustCanvas=document.createElement('canvas');dustCanvas.width=dustCanvas.height=32;const ctx=dustCanvas.getContext('2d'),gradient=ctx.createRadialGradient(16,16,0,16,16,16);gradient.addColorStop(0,'rgba(255,255,255,.8)');gradient.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,32,32);const dustTexture=new T.CanvasTexture(dustCanvas);
    const chip=parts.StoneChip.children.find(o=>o.isMesh),chips=new T.InstancedMesh(chip.geometry,chip.material,gate.rocks.length*6);chips.name='Shaft impact fragments';chips.frustumCulled=false;chips.castShadow=false;room.scene.add(chips);art.chips=chips;
    const transform=new T.Object3D();
    for(const [index,rock] of gate.rocks.entries()){
      // Keep all original saved nodes and material slots; only stop their draw.
      for(const mesh of [rock.mesh,rock.shadow]){mesh.geometry=mesh.geometry.clone();mesh.geometry.setDrawRange(0,0);art.hidden.push(mesh);}
      const model=add('FallingStone',[0,0,0],true);model.visible=false;
      const warning=new T.Group();warning.name='Exact impact footprint';warning.rotation.x=-Math.PI/2;room.scene.add(warning);
      const disc=new T.Mesh(footprintGeometry,new T.MeshBasicMaterial({color:0x151b1d,transparent:true,opacity:.42,depthWrite:false}));
      const rim=new T.Mesh(rimGeometry,new T.MeshBasicMaterial({color:0xc9ae72,transparent:true,opacity:.58,depthWrite:false}));
      const progress=new T.Mesh(rimGeometry.clone(),new T.MeshBasicMaterial({color:0xf0cf88,depthWrite:false}));progress.position.z=.001;warning.add(disc,rim,progress);
      warning.traverse(o=>{if(o.material)o.material.userData.outlineParameters={visible:false};});
      const dustGeometry=new T.BufferGeometry();dustGeometry.setAttribute('position',new T.BufferAttribute(new Float32Array(30),3));
      const dust=new T.Points(dustGeometry,new T.PointsMaterial({color:0xc9bda3,map:dustTexture,size:.14,transparent:true,opacity:.26,depthWrite:false}));dust.frustumCulled=false;room.scene.add(dust);
      art.stones.push({rock,model,warning,progress,dust,index});
    }
    // The stones were registered after the frame: include their live surfaces.
    for(const mesh of art.cameraMeshes)if(!rects.cameraOccluders.includes(mesh))rects.cameraOccluders.push(mesh);
    art.sync=()=>{
      for(const hidden of art.hidden)hidden.geometry.setDrawRange(0,0);
      for(const item of art.stones){
        const {rock,model,warning,progress,dust,index}=item,active=!entry.solved&&rock.state!=='off';
        model.visible=warning.visible=active;dust.visible=active&&rock.state!=='fall';
        const tell=Math.min(1,rock.t/(gate.tell||1)),fall=Math.min(1,rock.t/spec.motion.fallDuration),settle=Math.min(1,rock.t/.5);
        let base=spec.motion.sourceY-.85;
        if(rock.state==='fall')base*=1-fall*fall;
        if(rock.state==='land')base=0;
        model.position.set(rock.x,base,rock.z);model.scale.setScalar(rock.state==='land'?Math.max(0,1-settle*2):1);
        model.rotation.set(rock.state==='tell'?Math.sin(rock.t*31+index)*.014:0,0,rock.state==='tell'?Math.cos(rock.t*27+index)*.014:0);
        warning.position.set(rock.x,.025,rock.z);warning.scale.setScalar(rock.r);
        progress.geometry.setDrawRange(0,Math.floor((rock.state==='tell'?tell:1)*64)*6);
        warning.visible=active&&rock.state!=='land';
        const positions=dust.geometry.attributes.position;
        for(let j=0;j<10;j++){
          const angle=j*2.39996+index,phase=(rock.t*.8+j*.113)%1;
          const radius=rock.state==='land'?.18+settle*.9:.28+phase*.12;
          positions.setXYZ(j,rock.x+Math.cos(angle)*radius,rock.state==='land'?.1+Math.sin(settle*Math.PI)*.4:7.3-phase*1.8,rock.z+Math.sin(angle)*radius);
        }
        positions.needsUpdate=true;dust.material.opacity=rock.state==='land'?.3*(1-settle):.22;
        for(let j=0;j<6;j++){
          const angle=j*1.0472+index,on=active&&rock.state==='land',radius=.3+settle*.65;
          transform.position.set(rock.x+Math.cos(angle)*radius,.05+Math.sin(settle*Math.PI)*.45,rock.z+Math.sin(angle)*radius);
          transform.rotation.set(settle*4,j,settle*3);transform.scale.setScalar(on?(1-settle)*1.2:0);transform.updateMatrix();chips.setMatrixAt(index*6+j,transform.matrix);
        }
      }
      chips.instanceMatrix.needsUpdate=true;
    };
    const update=gate.update.bind(gate);gate.update=(dt,actor)=>{const result=entry.solved?{}:update(dt,actor);art.sync();return result;};
    const restart=gate.restart.bind(gate);gate.restart=()=>{restart();art.sync();};
    const complete=gate.complete?.bind(gate);gate.complete=()=>{complete?.();art.sync();};
    const restore=room.importState.bind(room);room.importState=s=>{const ok=restore(s);if(ok)art.sync();return ok;};
    const resume=room.resume.bind(room);room.resume=actor=>{const result=resume(actor);actor._camPlaced=false;art.sync();return result;};
    art.spec=spec;art.loaded=true;art.sync();return true;
  }).catch(error=>{art.reason=error.message;console.warn('[shaft] native gallery not applied',error);return false;});
  room.ready=Promise.all([room.ready,art.ready]);return room;
}
