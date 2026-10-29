const fs=require('node:fs'),A='art/landing-arrival/v01',B='reports/2026-10-26/evidence/landing-arrival';
exports.A=A;exports.B=B;
exports.prepare=async(page,phase='after')=>{
  for(const [url,suffix] of[['src/world/Landing.js','Landing'],['src/boot.js','boot']]){
    if(phase==='after'||phase==='dark')continue;
    const file=phase==='before'||phase==='legacy'?B+'/before-'+url.replaceAll('/','__'):A+'/'+suffix+'-preview.js';
    await page.route('**/'+url,route=>route.fulfill({contentType:'text/javascript',body:fs.readFileSync(file,'utf8')}));
  }
  await page.addInitScript(()=>{let seed=20261026;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};});
  await page.goto('http://127.0.0.1:5512/?q=mid');
  await page.waitForFunction(()=>window.game&&document.getElementById('load').style.display==='none',null,{timeout:120000,polling:100});
  await page.evaluate(()=>game.loop.stop());await page.locator('#title .go').click({force:true});
  // Isolate the world effect from the existing white transition overlay. Lab
  // completion and camera positions are fixtures, not a tutorial playthrough.
  await page.addStyleTag({content:'#flash{display:none!important}'});
  await page.evaluate(async()=>{
    game.loop.stop();game.dialogue.close();game.brief.hide();
    if(!game.lab.importState({version:1,dials:[3,5,8],hasNote:true,read:true,open:true,done:false,sent:false,parcelRecovered:true}))throw Error('Lab fixture rejected');
    game.notebook.setHas(true);game.landOnPlanet();game.dialogue.close();game.brief.hide();game.input.setTestIntent({});
    const T=await import('three');window.arrival={T,elapsed:0};
    arrival.up=game.landing.dir.clone();arrival.origin=game.landing.pos.clone();
    arrival.forward=game.player.heading.clone().normalize();
    arrival.fx=game.landing.group.children.filter(o=>o.isPointLight||o.isPoints||(o.isMesh&&(
      o.geometry.type==='CylinderGeometry'&&o.geometry.parameters.height===9||
      o.geometry.type==='RingGeometry'&&o.geometry.parameters.innerRadius===.82||
      o.geometry.type==='BoxGeometry'&&o.geometry.parameters.width===.1&&o.geometry.parameters.height===.34)));
    arrival.advance=time=>{while(arrival.elapsed<time-1e-8){const dt=Math.min(1/60,time-arrival.elapsed);game.step(dt);arrival.elapsed+=dt;}};
    arrival.pose=(yaw=0,far=false)=>{
      const c=game.engine.camera,back=arrival.forward.clone().negate().applyAxisAngle(arrival.up,yaw);
      const target=game.player.mesh.position.clone().addScaledVector(arrival.up,far?4.2:1.05);
      c.fov=62;c.aspect=innerWidth/innerHeight;c.up.copy(arrival.up);
      c.position.copy(arrival.origin).addScaledVector(back,far?22:6.0).addScaledVector(arrival.up,far?7:3.5);
      c.lookAt(target);c.updateProjectionMatrix();c.updateMatrixWorld(true);
      game.landing.update(0,game.player.position,c.position);game.questGuide.update(0,false);game.engine.render();game.engine.render();
      return{camera:c.position.toArray(),target:target.toArray(),up:c.up.toArray(),quaternion:c.quaternion.toArray(),fov:c.fov,aspect:c.aspect,actor:game.player.position.toArray(),elapsed:arrival.elapsed};
    };
    arrival.bodyMask=()=>{
      const{T}=arrival,scene=game.engine.scene,c=game.engine.camera,r=game.engine.renderer;
      const material=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false}),target=new T.WebGLRenderTarget(innerWidth,innerHeight),data=new Uint8Array(innerWidth*innerHeight*4),changed=[];
      scene.traverse(o=>{if(o.isMesh||o.isPoints||o.isLine){let actor=false;for(let p=o;p;p=p.parent)if(p===game.player.mesh){actor=true;break;}changed.push([o,o.visible,o.material]);if(actor)o.material=material;else o.visible=false;}});
      const bg=scene.background,fog=scene.fog,renderTarget=r.getRenderTarget(),clear=r.getClearColor(new T.Color()),alpha=r.getClearAlpha(),shadowUpdate=r.shadowMap.autoUpdate;
      r.shadowMap.autoUpdate=false;
      scene.background=new T.Color(0);scene.fog=null;r.setRenderTarget(target);r.setClearColor(0,1);r.clear();r.render(scene,c);r.readRenderTargetPixels(target,0,0,innerWidth,innerHeight,data);
      const mask=[];for(let y=0;y<innerHeight;y++)for(let x=0;x<innerWidth;x++){const i=((innerHeight-1-y)*innerWidth+x)*4;if(data[i]>220&&data[i+1]>220&&data[i+2]>220)mask.push((y*innerWidth+x)*4);}
      scene.background=bg;scene.fog=fog;for(const[o,visible,old]of changed){o.visible=visible;o.material=old;}r.setRenderTarget(renderTarget);r.setClearColor(clear,alpha);r.shadowMap.autoUpdate=shadowUpdate;target.dispose();material.dispose();
      return mask;
    };
    arrival.roadPixels=()=>{
      const pixels=[],patches=[],c=game.engine.camera;
      for(const distance of[3.5,5,7]){
        const angle=distance/game.planet.R,dir=arrival.up.clone().multiplyScalar(Math.cos(angle)).addScaledVector(arrival.forward,Math.sin(angle));
        const world=game.planet.surfaceAt(dir).addScaledVector(dir,.12),screen=world.clone().project(c);
        if(Math.abs(screen.x)>.95||Math.abs(screen.y)>.95)continue;
        const x=Math.round((screen.x+1)*innerWidth/2),y=Math.round((1-screen.y)*innerHeight/2);patches.push({distance,world:world.toArray(),screen:[x,y]});
        for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++)pixels.push(((y+dy)*innerWidth+x+dx)*4);
      }return{pixels,patches};
    };
    arrival.beaconRect=()=>{
      const c=game.engine.camera,right=new T.Vector3().crossVectors(arrival.up,c.position.clone().sub(arrival.origin)).normalize(),corners=[];
      for(const height of[2,7])for(const side of[-.45,.45]){const p=arrival.origin.clone().addScaledVector(arrival.up,height).addScaledVector(right,side).project(c);corners.push([(p.x+1)*innerWidth/2,(1-p.y)*innerHeight/2]);}
      return{x0:Math.floor(Math.min(...corners.map(v=>v[0]))),x1:Math.ceil(Math.max(...corners.map(v=>v[0]))),y0:Math.floor(Math.min(...corners.map(v=>v[1]))),y1:Math.ceil(Math.max(...corners.map(v=>v[1])))};
    };
  });
  if(phase==='dark')await page.evaluate(()=>{game.landing.group.getObjectByName('Landing return beacon').visible=false;});
};
