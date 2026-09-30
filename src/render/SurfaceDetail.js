import { quality } from './Quality.js';

// Colour-only grain: ground height, grass lift and map coordinates stay intact.
// The pattern uses sphere-local 3D coordinates, with no polar texture seam.
export function addSurfaceDetail(material, grass = false) {
  const amount = { value: 0 };
  const apply = () => { amount.value = quality.name === 'high' || quality.name === 'mid' ? (grass ? .13 : .09) : 0; };
  apply(); quality.onChange(apply);
  const previous = material.onBeforeCompile;
  material.extensions = { ...material.extensions, derivatives: true };
  material.onBeforeCompile = shader => {
    previous?.(shader);
    shader.uniforms.uSurfaceGrain = amount;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSurfaceDetail;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSurfaceDetail = position;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vSurfaceDetail;
      uniform float uSurfaceGrain;
      float grainHash(vec3 p) { p=fract(p*.1031); p+=dot(p,p.yzx+33.33); return fract((p.x+p.y)*p.z); }
      float surfaceNoise(vec3 p) {
        vec3 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(mix(grainHash(i),grainHash(i+vec3(1,0,0)),f.x),
          mix(grainHash(i+vec3(0,1,0)),grainHash(i+vec3(1,1,0)),f.x),f.y),
          mix(mix(grainHash(i+vec3(0,0,1)),grainHash(i+vec3(1,0,1)),f.x),
          mix(grainHash(i+vec3(0,1,1)),grainHash(i+vec3(1,1,1)),f.x),f.y),f.z);
      }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float detailFade = 1.0-smoothstep(.15,.65,length(fwidth(vSurfaceDetail)));
        if(uSurfaceGrain>0.0 && detailFade>0.001) {
          float grain=surfaceNoise(vSurfaceDetail*3.6);
          diffuseColor.rgb *= 1.0+(grain-.5)*uSurfaceGrain*detailFade;
        }`);
  };
}
