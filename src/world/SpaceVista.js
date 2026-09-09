import * as THREE from 'three';

// 배경은 한 번 구운 구면 텍스처. 매 프레임 성운 노이즈를 계산하지 않는다.
function nebulaTexture() {
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
  const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(1024,512);
  const hash=(x,y,z)=>{const v=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453;return v-Math.floor(v);};
  const noise=(x,y,z)=>{
    const a=Math.floor(x),b=Math.floor(y),c=Math.floor(z);x-=a;y-=b;z-=c;
    const u=x*x*(3-2*x),v=y*y*(3-2*y),w=z*z*(3-2*z),mix=(a,b,t)=>a+(b-a)*t;
    return mix(mix(mix(hash(a,b,c),hash(a+1,b,c),u),mix(hash(a,b+1,c),hash(a+1,b+1,c),u),v),mix(mix(hash(a,b,c+1),hash(a+1,b,c+1),u),mix(hash(a,b+1,c+1),hash(a+1,b+1,c+1),u),v),w);
  };
  for(let y=0;y<512;y++)for(let x=0;x<1024;x++){
    const theta=x/1024*Math.PI*2,phi=y/512*Math.PI;
    const dx=Math.sin(phi)*Math.cos(theta),dy=Math.cos(phi),dz=Math.sin(phi)*Math.sin(theta);
    let n=0,amp=.55,f=3;
    for(let k=0;k<5;k++){n+=noise(dx*f+17,dy*f+31,dz*f+9)*amp;f*=2.03;amp*=.5;}
    const band=Math.exp(-Math.pow((dy+.32*dx-.17*dz+(n-.5)*.5)/.4,2));
    const cloud=band*Math.pow(Math.max(0,n-.23)*2,2),dust=1-.65*noise(dx*19+3,dy*19,dz*19);
    const teal=(Math.sin(theta*2+.8)+1)*.5,i=(y*1024+x)*4;
    pixels.data[i]=30+cloud*dust*(145-teal*85);
    pixels.data[i+1]=36+cloud*dust*(65+teal*105);
    pixels.data[i+2]=60+cloud*dust*190;pixels.data[i+3]=255;
  }
  ctx.putImageData(pixels,0,0);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=THREE.RepeatWrapping;return texture;
}

const noiseGLSL=`
float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
 mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float n=0.,a=.5;for(int i=0;i<5;i++){n+=noise(p)*a;p=p*2.03+vec3(7.1,3.7,1.9);a*=.5;}return n;}
`;

export function buildSpaceVista(scene) {
  const background=nebulaTexture();background.mapping=THREE.EquirectangularReflectionMapping;scene.background=background;
  const sky=new THREE.Object3D();sky.name='별바다 — 청록과 보랏빛 성운';sky.userData.sky=true;scene.add(sky);
  const positions=[],colors=[],color=new THREE.Color();
  for(let i=0;i<2600;i++){
    const a=i*2.399963,y=1-2*(i+.5)/2600,r=Math.sqrt(1-y*y);
    positions.push(Math.cos(a)*r*145,y*145,Math.sin(a)*r*145);
    color.set(i%7===0?0xffd5a1:i%3===0?0x9acfff:0xe5e9ff).multiplyScalar(.35+(i%11)/15);colors.push(color.r,color.g,color.b);
  }
  const dot=document.createElement('canvas');dot.width=dot.height=32;const ctx=dot.getContext('2d');
  const glow=ctx.createRadialGradient(16,16,0,16,16,16);glow.addColorStop(0,'white');glow.addColorStop(.12,'rgba(255,255,255,.95)');glow.addColorStop(.35,'rgba(180,215,255,.25)');glow.addColorStop(1,'rgba(180,215,255,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,32,32);
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  const stars=new THREE.Points(geo,new THREE.PointsMaterial({map:new THREE.CanvasTexture(dot),vertexColors:true,size:1.1,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));stars.userData.sky=true;scene.add(stars);
  const material=new THREE.ShaderMaterial({uniforms:{cloudTurn:{value:0}},vertexShader:`varying vec3 p;varying vec3 world;void main(){p=position;world=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);}`,
    fragmentShader:`varying vec3 p;varying vec3 world;uniform float cloudTurn;${noiseGLSL}
void main(){vec3 n=normalize(p),sun=normalize(vec3(-.7,.65,.8)),view=normalize(cameraPosition-world);
 float land=fbm(n*3.8+vec3(5.,1.,8.));float coast=smoothstep(.49,.525,land);
 vec3 ocean=mix(vec3(.012,.065,.16),vec3(.035,.32,.39),smoothstep(.35,.51,land));
 vec3 ground=mix(vec3(.08,.23,.14),vec3(.38,.43,.19),smoothstep(.52,.7,land));
 ground=mix(ground,vec3(.74,.81,.78),smoothstep(.76,.91,abs(n.y)+land*.14));
 vec3 base=mix(ocean,ground,coast);
 float c=cos(cloudTurn),s=sin(cloudTurn);vec3 cn=vec3(c*n.x+s*n.z,n.y,-s*n.x+c*n.z);
 float cloud=smoothstep(.51,.69,fbm(cn*6.+vec3(12.,4.,1.))+.045*sin(cn.y*32.+cn.x*8.));
 base=mix(base,vec3(.85,.92,1.),cloud*.86);
 float light=smoothstep(-.18,.85,dot(n,sun));vec3 rgb=base*(.11+light*1.3);
 float spec=pow(max(0.,dot(reflect(-sun,n),view)),38.)*(1.-coast)*(1.-cloud);
 rgb+=vec3(.55,.77,.85)*spec*.4;
 float rim=pow(1.-max(0.,dot(n,view)),3.);rgb+=vec3(.06,.32,.58)*rim*(.3+light*.7);
 gl_FragColor=vec4(rgb,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`});
  material.userData.outlineParameters={visible:false};
  const planet=new THREE.Mesh(new THREE.SphereGeometry(9,64,40),material);planet.position.set(-27,1,-65);planet.userData.sky=true;planet.name='무무 행성 — 바다·대륙·구름';scene.add(planet);
  const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(9.35,48,32),new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.BackSide,
    vertexShader:`varying vec3 n;varying vec3 v;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`varying vec3 n;varying vec3 v;void main(){float rim=pow(max(0.,1.-abs(dot(normalize(n),normalize(v)))),3.);gl_FragColor=vec4(.12,.48,1.,rim*.48);}`}));
  atmosphere.material.userData.outlineParameters={visible:false};
  atmosphere.position.copy(planet.position);atmosphere.userData.sky=true;scene.add(atmosphere);
  return {sky,planet,update(dt){material.uniforms.cloudTurn.value+=dt*.003;}};
}
