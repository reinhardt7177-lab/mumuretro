Shader "Mumu/Temple Weathered Stone"
{
 Properties { _BaseColor("Limestone",Color)=(.55,.55,.5,1) }
 SubShader
 {
  Tags {"RenderPipeline"="UniversalPipeline" "RenderType"="Opaque"}
  Pass
  {
   Tags {"LightMode"="UniversalForward"}
   HLSLPROGRAM
   #pragma vertex vert
   #pragma fragment frag
   #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE
   #pragma multi_compile _ _ADDITIONAL_LIGHTS_VERTEX _ADDITIONAL_LIGHTS
   #pragma multi_compile _ _FORWARD_PLUS
   #pragma multi_compile_fragment _ _SHADOWS_SOFT
   #pragma multi_compile_fog
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
   CBUFFER_START(UnityPerMaterial)
   half4 _BaseColor;
   CBUFFER_END
   struct A {float4 p:POSITION;float3 n:NORMAL;};
   struct V {float4 p:SV_POSITION;float3 w:TEXCOORD0;float3 n:TEXCOORD1;float fog:TEXCOORD2;};
   V vert(A i){V o;o.w=TransformObjectToWorld(i.p.xyz);o.p=TransformWorldToHClip(o.w);o.n=TransformObjectToWorldNormal(i.n);o.fog=ComputeFogFactor(o.p.z);return o;}
   float hash(float2 p){return frac(sin(dot(p,float2(127.1,311.7)))*43758.5453);}
   float noise(float2 p){float2 a=floor(p),f=frac(p);f=f*f*(3-2*f);return lerp(lerp(hash(a),hash(a+float2(1,0)),f.x),lerp(hash(a+float2(0,1)),hash(a+1),f.x),f.y);}
   half4 frag(V i):SV_Target
   {
    float3 n=normalize(i.n);
    float2 uv=abs(n.y)>.65?i.w.xz:(abs(n.x)>abs(n.z)?i.w.zy:i.w.xy);
    float broad=noise(uv*.8),grain=noise(uv*34),pore=smoothstep(.73,.9,noise(uv*85));
    float damp=smoothstep(.50,.72,noise(i.w.xz*.65+noise(i.w.xz*2.1)*.3))*smoothstep(.75,.98,n.y);
    // Wet patches live on upward facing stone, never on vertical walls.
    float3 relief=float3(ddx(grain),0,ddy(grain))*.055*(1-damp);
    InputData input=(InputData)0;
    input.positionWS=i.w;input.normalWS=normalize(n+relief);input.viewDirectionWS=GetWorldSpaceNormalizeViewDir(i.w);
    input.shadowCoord=TransformWorldToShadowCoord(i.w);input.bakedGI=SampleSH(input.normalWS)+half3(.035,.045,.05);
    input.vertexLighting=VertexLighting(i.w,input.normalWS);
    input.normalizedScreenSpaceUV=GetNormalizedScreenSpaceUV(i.p);input.shadowMask=half4(1,1,1,1);
    SurfaceData surface=(SurfaceData)0;
    surface.albedo=_BaseColor.rgb*(.76+broad*.27+grain*.045-pore*.10)*lerp(1,.62,damp);
    surface.alpha=1;surface.metallic=0;surface.specular=half3(.04,.04,.04);
    surface.smoothness=lerp(.23,.87,damp);surface.normalTS=half3(0,0,1);surface.occlusion=1-pore*.12;
    half4 color=UniversalFragmentPBR(input,surface);color.rgb=MixFog(color.rgb,i.fog);return color;
   }
   ENDHLSL
  }
  UsePass "Universal Render Pipeline/Lit/ShadowCaster"
  UsePass "Universal Render Pipeline/Lit/DepthOnly"
 }
}
