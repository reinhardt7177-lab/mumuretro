  window.horizonMask=function(target){
   const renderer=game.engine.renderer,scene=game.engine.scene,camera=game.engine.camera,W=640,H=400;
   const rt=new T.WebGLRenderTarget(W,H),buffer=new Uint8Array(W*H*4),snapshot=[],clones=[];
   const old={background:scene.background,fog:scene.fog,target:renderer.getRenderTarget(),shadow:renderer.shadowMap.enabled};
   const under=(o,root)=>{for(let p=o;p;p=p.parent)if(p===root)return true;return false;};
   const colours={target:[1,1,1],foliage:[0,1,0],wood:[1,0,0],rock:[0,0,1],hero:[1,0,1],other:[.2,.2,.2]};
   function role(o){if(under(o,target))return'target';if(under(o,game.player.mesh))return'hero';const kind=o.userData.natureKind||'';return kind.startsWith('canopy')?'foliage':kind==='trunk'?'wood':kind.startsWith('rock')?'rock':'other';}
   try{
    scene.background=new T.Color(0);scene.fog=null;renderer.shadowMap.enabled=false;
    scene.traverse(o=>{if(!o.isMesh&&!o.isSprite&&!o.isLine)return;const before={o,visible:o.visible,material:o.material};snapshot.push(before);
     if(!o.isMesh||(Array.isArray(o.material)?o.material:[o.material]).some(m=>m.transparent||m.isShaderMaterial)){o.visible=false;return;}
     const kind=role(o);o.material=(Array.isArray(o.material)?o.material:[o.material]).map(original=>{
      const material=original.clone();material.toneMapped=false;material.fog=false;material.userData.outlineParameters={visible:false};material.onBeforeCompile=(shader,r)=>{original.onBeforeCompile(shader,r);shader.uniforms.uMaskColour={value:new T.Vector3(...colours[kind])};shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 uMaskColour;').replace(/}\s*$/,'gl_FragColor=vec4(uMaskColour,1.);\n}');};material.customProgramCacheKey=()=>original.uuid+'-horizon-mask-'+kind;clones.push(material);return material;
     });if(!Array.isArray(before.material))o.material=o.material[0];
    });
    renderer.setRenderTarget(rt);renderer.render(scene,camera);renderer.readRenderTargetPixels(rt,0,0,W,H,buffer);const full=buffer.slice();
    for(const s of snapshot)if(!under(s.o,target))s.o.visible=false;
    renderer.render(scene,camera);renderer.readRenderTargetPixels(rt,0,0,W,H,buffer);
    const counts={target:0,visible:0,foliage:0,wood:0,rock:0,hero:0,other:0};
    for(let i=0;i<buffer.length;i+=4)if(buffer[i]>250&&buffer[i+1]>250&&buffer[i+2]>250){counts.target++;const r=full[i],g=full[i+1],b=full[i+2];if(r>250&&g>250&&b>250)counts.visible++;else if(g>250&&r<4&&b<4)counts.foliage++;else if(r>250&&g<4&&b<4)counts.wood++;else if(b>250&&r<4&&g<4)counts.rock++;else if(r>250&&b>250&&g<4)counts.hero++;else counts.other++;}
    return{...counts,visibleFraction:counts.visible/Math.max(1,counts.target),width:W,height:H};
   }finally{for(const s of snapshot){s.o.visible=s.visible;s.o.material=s.material;}for(const m of clones)m.dispose();renderer.setRenderTarget(old.target);renderer.shadowMap.enabled=old.shadow;renderer.shadowMap.needsUpdate=true;scene.background=old.background;scene.fog=old.fog;rt.dispose();game.engine.render();}
  };
