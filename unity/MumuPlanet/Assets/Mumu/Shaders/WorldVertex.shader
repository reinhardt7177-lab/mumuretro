Shader "Mumu/World Vertex"
{
    Properties { _BaseColor("Tint", Color) = (1,1,1,1) }
    SubShader
    {
        Tags { "RenderPipeline"="UniversalPipeline" "RenderType"="Opaque" }
        Pass
        {
            Tags { "LightMode"="UniversalForward" }
            HLSLPROGRAM
            #pragma vertex Vert
            #pragma fragment Frag
            #pragma multi_compile_fog
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE
            #pragma multi_compile_fragment _ _SHADOWS_SOFT
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
            CBUFFER_START(UnityPerMaterial)
            half4 _BaseColor;
            CBUFFER_END
            struct A { float4 position:POSITION; float3 normal:NORMAL; half4 color:COLOR; };
            struct V { float4 position:SV_POSITION; float3 normal:TEXCOORD0; half4 color:COLOR; float3 world:TEXCOORD1; half fog:TEXCOORD2; };
            V Vert(A a) { V v; v.world=TransformObjectToWorld(a.position.xyz); v.position=TransformWorldToHClip(v.world); v.normal=TransformObjectToWorldNormal(a.normal); v.color=a.color*_BaseColor; v.fog=ComputeFogFactor(v.position.z); return v; }
            half4 Frag(V v):SV_Target
            {
                half3 normal=normalize(v.normal);
                Light light=GetMainLight(TransformWorldToShadowCoord(v.world));
                half diffuse=saturate(dot(normal,light.direction)*.75+.25);
                half3 color=v.color.rgb*(SampleSH(normal)+light.color*diffuse*lerp(.45,1,light.shadowAttenuation));
                return half4(MixFog(color,v.fog),1);
            }
            ENDHLSL
        }
        UsePass "Universal Render Pipeline/Lit/ShadowCaster"
        UsePass "Universal Render Pipeline/Lit/DepthOnly"
    }
}
