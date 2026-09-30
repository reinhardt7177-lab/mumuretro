Shader "Mumu/Glacial Seal"
{
    Properties
    {
        _BaseColor("Ice", Color) = (0.22,0.62,0.73,1)
        _Thaw("Thaw", Range(0,1)) = 0
        _Illuminated("Sunlight", Float) = 0
    }
    SubShader
    {
        Tags { "RenderPipeline"="UniversalPipeline" "RenderType"="TransparentCutout" "Queue"="AlphaTest" }
        Pass
        {
            Tags { "LightMode"="UniversalForward" }
            Cull Off
            HLSLPROGRAM
            #pragma vertex Vert
            #pragma fragment Frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
            CBUFFER_START(UnityPerMaterial)
                half4 _BaseColor;
                float _Thaw, _Illuminated;
            CBUFFER_END
            struct Attributes { float4 positionOS:POSITION; float3 normalOS:NORMAL; float2 uv:TEXCOORD0; };
            struct Varyings { float4 positionCS:SV_POSITION; float3 normalWS:TEXCOORD0; float2 uv:TEXCOORD1; };
            Varyings Vert(Attributes v)
            {
                Varyings o; o.positionCS=TransformObjectToHClip(v.positionOS.xyz);
                o.normalWS=TransformObjectToWorldNormal(v.normalOS);o.uv=v.uv;return o;
            }
            half4 Frag(Varyings i):SV_Target
            {
                float2 uv=i.uv;
                float ripple=sin(uv.x*24+sin(uv.y*17))*sin(uv.y*21)*.024;
                float edge=length(uv)+ripple-(_Thaw*1.65-.04);
                clip(edge);
                float veins=pow(saturate(1-abs(sin(uv.x*13+uv.y*9+sin(uv.y*11)))*12),3);
                half3 base=lerp(_BaseColor.rgb,half3(.75,.91,.94),veins*.5+saturate(uv.y)*.15);
                Light sun=GetMainLight();half diffuse=saturate(dot(normalize(i.normalWS),sun.direction));
                half3 color=base*(SampleSH(normalize(i.normalWS))+.28+sun.color*diffuse*.65);
                float rim=(1-smoothstep(0,.055,edge))*step(.015,_Thaw);
                color+=rim*lerp(half3(.25,.65,.8),half3(1,.75,.28),_Illuminated)*.7;
                return half4(color,1);
            }
            ENDHLSL
        }
    }
}
