Shader "Mumu/Water Gate Seal"
{
 Properties { _BaseColor("Enamel and metal",Color)=(.3,.5,.5,1) _Metallic("Metal",Range(0,1))=.5 _Smoothness("Smoothness",Range(0,1))=.55 _Wake("Awakening",Range(0,1))=0 }
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
   half4 _BaseColor;half _Metallic,_Smoothness,_Wake;
   CBUFFER_END
   struct A {float4 p:POSITION;float3 n:NORMAL;};
   struct V {float4 p:SV_POSITION;float3 w:TEXCOORD0;float3 n:TEXCOORD1;float3 local:TEXCOORD2;float fog:TEXCOORD3;};
   V vert(A i){V o;o.local=i.p.xyz;o.w=TransformObjectToWorld(i.p.xyz);o.p=TransformWorldToHClip(o.w);o.n=TransformObjectToWorldNormal(i.n);o.fog=ComputeFogFactor(o.p.z);return o;}
   half4 frag(V i):SV_Target
   {
    float radius=length(i.local.xy-float2(0,.08));
    float wave=saturate(_Wake/.36)*2.1;
    float pulse=exp(-pow((radius-wave)*7,2))*smoothstep(0,.04,_Wake)*(1-smoothstep(.32,.48,_Wake));
    float awakened=smoothstep(radius-.15,radius+.08,wave)*smoothstep(0,.06,_Wake);
    // Dark backing stays quiet; the existing metal and jewel geometry carries the light.
    float ornament=smoothstep(.32,.55,max(_BaseColor.r,max(_BaseColor.g,_BaseColor.b)));
    float3 glow=lerp(float3(.12,.85,1),float3(1,.76,.25),step(_BaseColor.g,_BaseColor.r));
    InputData input=(InputData)0;input.positionWS=i.w;input.normalWS=normalize(i.n);input.viewDirectionWS=GetWorldSpaceNormalizeViewDir(i.w);
    input.shadowCoord=TransformWorldToShadowCoord(i.w);input.bakedGI=SampleSH(input.normalWS);input.vertexLighting=VertexLighting(i.w,input.normalWS);
    input.normalizedScreenSpaceUV=GetNormalizedScreenSpaceUV(i.p);input.shadowMask=half4(1,1,1,1);
    SurfaceData surface=(SurfaceData)0;surface.albedo=_BaseColor.rgb;surface.alpha=1;surface.metallic=_Metallic;surface.smoothness=_Smoothness;surface.normalTS=half3(0,0,1);surface.occlusion=1;
    surface.emission=glow*ornament*(pulse*2.5+awakened*.20);
    half4 color=UniversalFragmentPBR(input,surface);color.rgb=MixFog(color.rgb,i.fog);return color;
   }
   ENDHLSL
  }
  UsePass "Universal Render Pipeline/Lit/ShadowCaster"
  UsePass "Universal Render Pipeline/Lit/DepthOnly"
 }
}
