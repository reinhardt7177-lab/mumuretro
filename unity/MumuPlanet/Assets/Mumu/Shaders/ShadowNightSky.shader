Shader "Mumu/Shadow Night Sky"
{
    // Night sky of the shadow temple (web lighting.js open.shadow): gradient, hashed stars and a moon disc.
    Properties
    {
        _Top ("Top", Color) = (0.027, 0.043, 0.102, 1)
        _Horizon ("Horizon", Color) = (0.122, 0.165, 0.282, 1)
        _Below ("Below", Color) = (0.035, 0.04, 0.07, 1)
        _MoonDir ("Moon direction", Vector) = (-0.35, 0.42, 0.84, 0)
        _MoonColor ("Moon", Color) = (0.84, 0.89, 1, 1)
        _MoonSize ("Moon radius (rad)", Float) = 0.03
        _StarDensity ("Star cells", Float) = 150
        _StarBrightness ("Star brightness", Float) = 1.4
    }
    SubShader
    {
        Tags { "Queue"="Background" "RenderType"="Background" "PreviewType"="Skybox" "RenderPipeline"="UniversalPipeline" }
        Cull Off ZWrite Off
        Pass
        {
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "ShadowNightCommon.hlsl"
            struct Attributes { float4 positionOS : POSITION; };
            struct Varyings { float4 positionCS : SV_POSITION; float3 dir : TEXCOORD0; };
            Varyings vert(Attributes i)
            {
                Varyings o;
                o.positionCS = TransformObjectToHClip(i.positionOS.xyz);
                o.dir = i.positionOS.xyz;
                return o;
            }
            half4 frag(Varyings i) : SV_Target
            {
                return half4(NightSky(normalize(i.dir)), 1);
            }
            ENDHLSL
        }
    }
}
