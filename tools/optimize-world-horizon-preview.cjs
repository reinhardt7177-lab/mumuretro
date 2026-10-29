const fs=require('node:fs'),{A,B}=require('./world-horizon-fixture.cjs');
const original=fs.readFileSync(B+'/fragment-original-src__render__HorizonBackdrop.js','utf8');
const vert=`
uniform vec3 uSun,uUp;
uniform float uShade;
varying vec3 vHorizonLocal,vHorizonShade;
void main(){
  vHorizonLocal=position;
  vec3 worldNormal=normalize(mat3(modelMatrix)*normal);
  float light=max(0.,dot(worldNormal,uSun));
  float top=max(0.,dot(worldNormal,uUp));
  vHorizonShade=(.60+.24*top+light*uShade*1.65)*color.rgb;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
}`;
const frag=`
uniform vec3 uAir,uCliff;
uniform vec2 uFade;
uniform float uHaze;
varying vec3 vHorizonLocal,vHorizonShade;
void main(){
  float altitude=smoothstep(uFade.x,uFade.y,vHorizonLocal.y);
  vec3 cliff=uCliff*vHorizonShade;
  float haze=clamp(uHaze+(1.-smoothstep(5.,42.,vHorizonLocal.y))*.22,0.,.98);
  gl_FragColor=vec4(mix(cliff,uAir,haze),altitude);
}`;
let source=original.replace(/const VERT=`[\s\S]*?`;/,'const VERT=`'+vert+'`;').replace(/const FRAG=`[\s\S]*?`;/,'const FRAG=`'+frag+'`;');
fs.writeFileSync(A+'/preview-src__render__HorizonBackdrop.js',source);
const oldStyle=fs.readFileSync(B+'/fragment-original-src__world__WoodlandStyle.js','utf8'),start=oldStyle.indexOf('        vec3 focusRay='),end=oldStyle.indexOf('        float dither=',start);if(start<0||end<0)throw Error('Focus fragment marker changed');
const oldBlock=oldStyle.slice(start,end),newBlock=`        if(uFoliageFocusEnabled>.5){
          vec3 focusRay=uFoliageFocus-cameraPosition;
          float focusT=dot(vFoliageWorld-cameraPosition,focusRay)/max(.01,dot(focusRay,focusRay));
          if(focusT>0.&&focusT<1.02){
            float distanceToView=length(vFoliageWorld-cameraPosition-focusRay*clamp(focusT,0.,1.));
            visibility*=smoothstep(.38,.78,distanceToView);
          }
        }
`;
fs.writeFileSync(A+'/preview-src__world__WoodlandStyle.js',oldStyle.slice(0,start)+newBlock+oldStyle.slice(end));
fs.writeFileSync(B+'/shader-study-proposal.json',JSON.stringify({vertexShader:vert,fragmentShader:frag,oldBlock,newBlock,choice:'Flat exported face normals/tone allow vertex lighting; only view-relevant leaves compute ray distance. No geometry, depth, palette or physical change.'},null,2));
console.log('Prepared pixel-equivalent shader cost proposal; product unchanged');
