Shader "Mumu/Shadow Night Portal"
{
    // The planet moon gate shows the temple's night sky through its disc (view direction, so it reads as depth).
    Properties
    {
        _Top ("Top", Color) = (0.027, 0.043, 0.102, 1)
        _Horizon ("Horizon", Color) = (0.122, 0.165, 0.282, 1)
        _Below ("Below", Color) = (0.035, 0.04, 0.07, 1)
        _MoonDir ("Moon direction", Vector) = (0.2, 0.35, 0.9, 0)
        _MoonColor ("Moon", Color) = (0.84, 0.89, 1, 1)
        _MoonSize ("Moon radius (rad)", Float) = 0.12
        _StarDensity ("Star cells", Float) = 60
        _StarBrightness ("Star brightness", Float) = 2.2
        _Rim ("Rim glow", Color) = (0.55, 0.62, 0.9, 1)
    }
    SubShader
    {
        Tags { "Queue"="Geometry" "RenderType"="Opaque" "RenderPipeline"="UniversalPipeline" }
        Pass
        {
            Tags { "LightMode"="UniversalForward" }
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "ShadowNightCommon.hlsl"
            float4 _Rim;
            struct Attributes { float4 positionOS : POSITION; float3 normalOS : NORMAL; };
            struct Varyings { float4 positionCS : SV_POSITION; float3 world : TEXCOORD0; float3 normal : TEXCOORD1; float3 local : TEXCOORD2; };
            Varyings vert(Attributes i)
            {
                Varyings o;
                o.world = TransformObjectToWorld(i.positionOS.xyz);
                o.positionCS = TransformWorldToHClip(o.world);
                o.normal = TransformObjectToWorldNormal(i.normalOS);
                o.local = i.positionOS.xyz;
                return o;
            }
            half4 frag(Varyings i) : SV_Target
            {
                float3 view = normalize(i.world - _WorldSpaceCameraPos);
                // Look "through" the disc: rotate the view so straight-on shows the upper sky.
                float3 d = normalize(view + float3(0, 0.55, 0));
                float3 c = NightSky(d);
                float edge = saturate(1.0 - abs(dot(normalize(i.normal), -view)));
                c += _Rim.rgb * pow(edge, 3.0) * 0.6;
                return half4(c, 1);
            }
            ENDHLSL
        }
        UsePass "Universal Render Pipeline/Lit/DepthOnly"
    }
}
