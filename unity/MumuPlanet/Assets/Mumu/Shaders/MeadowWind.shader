Shader "Mumu/Meadow Wind"
{
    Properties
    {
        _WindStrength("Wind bend", Range(0, .8)) = .48
        _WindSpeed("Wind speed", Float) = .85
        _FadeStart("Fade start", Float) = 27
        _FadeEnd("Fade end", Float) = 36
    }
    SubShader
    {
        Tags { "RenderPipeline"="UniversalPipeline" "RenderType"="Opaque" }
        Cull Off
        HLSLINCLUDE
        #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
        CBUFFER_START(UnityPerMaterial)
        float _WindStrength, _WindSpeed, _FadeStart, _FadeEnd;
        CBUFFER_END
        // Only the explicit visual test overrides time; normal play uses _Time.
        float _MumuGrassTestTime, _MumuGrassTestEnabled;
        struct A { float4 position:POSITION; float3 normal:NORMAL; half4 color:COLOR; float2 uv:TEXCOORD0; float3 root:TEXCOORD1; float4 detail:TEXCOORD2; };
        struct V { float4 position:SV_POSITION; half4 color:COLOR; float3 normal:TEXCOORD0; float3 world:TEXCOORD1; half fog:TEXCOORD2; float4 detail:TEXCOORD3; half gust:TEXCOORD4; };
        float Hash(float2 p) { return frac(sin(dot(p,float2(127.1,311.7)))*43758.5453); }
        float Noise(float2 p)
        {
            float2 i=floor(p),f=frac(p);f=f*f*(3-2*f);
            return lerp(lerp(Hash(i),Hash(i+float2(1,0)),f.x),lerp(Hash(i+float2(0,1)),Hash(i+1),f.x),f.y);
        }
        V Vert(A a)
        {
            V v;
            float3 root=TransformObjectToWorld(a.root);
            float3 up=normalize(root);
            float3 breeze=normalize(float3(.73,.21,.65)-up*dot(float3(.73,.21,.65),up));
            float time=lerp(_Time.y,_MumuGrassTestTime,_MumuGrassTestEnabled)*_WindSpeed;
            float phase=dot(root,float3(.26,.13,.23));
            float broad=Noise(float2(phase-time*.8,dot(root,float3(-.08,.19,.07))));
            float gust=.24+.85*broad+.12*sin(phase*3.2-time*2.4)+.055*sin(a.uv.x*6.283+time*3.1);
            float weight=a.uv.y*a.uv.y;
            float bend=gust*_WindStrength*a.detail.w;
            float3 world=TransformObjectToWorld(a.position.xyz)+breeze*(bend*weight)-up*(bend*bend*.35*weight);
            float fade=1-smoothstep(_FadeStart,_FadeEnd,distance(root,_WorldSpaceCameraPos));
            v.world=root+(world-root)*fade;
            v.position=TransformWorldToHClip(v.world);
            v.color=a.color;
            v.normal=a.detail.z>1.5?normalize(up*.8+TransformObjectToWorldNormal(a.normal)*.2):up;
            v.detail=a.detail;v.gust=broad;
            v.fog=ComputeFogFactor(v.position.z);
            return v;
        }
        half FeatherAlpha(V v)
        {
            if(v.detail.z<.5||v.detail.z>1.5)return 1;
            float x=abs(v.detail.x),y=saturate(v.detail.y);
            float envelope=pow(saturate(sin(y*3.14159265)),.65);
            // Diagonal paired filaments with a continuous central stalk.
            float phase=y*110-x*18;
            float fibers=.5+.5*sin(phase);
            float edge=envelope*(.70+.30*fibers)-x;
            float aa=max(fwidth(edge),.015);
            float filament=saturate((sin(phase)-.08)/max(fwidth(phase),.35)+.5);
            float core=1-smoothstep(.055,.16,x);
            half alpha=saturate(edge/aa+.5)*max(filament,core);
            clip(alpha-.35);
            return alpha;
        }
        ENDHLSL
        Pass
        {
            Tags { "LightMode"="UniversalForward" }
            AlphaToMask On
            HLSLPROGRAM
            #pragma vertex Vert
            #pragma fragment Frag
            #pragma multi_compile_fog
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE
            #pragma multi_compile_fragment _ _SHADOWS_SOFT
            half4 Frag(V v):SV_Target
            {
                half alpha=FeatherAlpha(v);
                half3 normal=normalize(v.normal);
                Light light=GetMainLight(TransformWorldToShadowCoord(v.world));
                half diffuse=saturate(dot(normal,light.direction)*.75+.25);
                half3 color=v.color.rgb*(SampleSH(normal)+light.color*diffuse*lerp(.45,1,light.shadowAttenuation));
                half rim=pow(saturate(dot(normalize(_WorldSpaceCameraPos-v.world),-light.direction)),3);
                color+=v.color.rgb*light.color*(.10+rim*.28)*lerp(.6,1,light.shadowAttenuation);
                color*=lerp(.93,1.08,v.gust);
                if(v.detail.z>.5&&v.detail.z<1.5)color*=lerp(.72,1.08,1-abs(v.detail.x))*(.9+.1*v.detail.y);
                if(v.detail.z>1.5)color*=1-.045*abs(v.detail.x);
                return half4(MixFog(color,v.fog),alpha);
            }
            ENDHLSL
        }
        Pass
        {
            Tags { "LightMode"="DepthOnly" }
            ColorMask R
            HLSLPROGRAM
            #pragma vertex Vert
            #pragma fragment Depth
            half4 Depth(V v):SV_Target { FeatherAlpha(v);return 0; }
            ENDHLSL
        }
    }
}
