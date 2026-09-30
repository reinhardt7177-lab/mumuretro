Shader "Mumu/Fractured Glacier"
{
    Properties { _BaseColor("Ice colour",Color)=(.12,.42,.58,1) }
    SubShader
    {
        Tags { "RenderPipeline"="UniversalPipeline" "RenderType"="Opaque" }
        Pass
        {
            Tags { "LightMode"="UniversalForward" }
            HLSLPROGRAM
            #pragma vertex Vert
            #pragma fragment Frag
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE
            #pragma multi_compile_fragment _ _SHADOWS_SOFT
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
            CBUFFER_START(UnityPerMaterial)
            half4 _BaseColor;
            CBUFFER_END
            struct A { float4 vertex:POSITION;float3 normal:NORMAL; };
            struct V {float4 pos:SV_POSITION;float3 local:TEXCOORD0;float3 world:TEXCOORD1;float3 normal:TEXCOORD2;float3 localNormal:TEXCOORD3;};
            V Vert(A a)
            {
                V o;o.pos=TransformObjectToHClip(a.vertex.xyz);o.local=a.vertex.xyz;
                o.world=TransformObjectToWorld(a.vertex.xyz);o.normal=TransformObjectToWorldNormal(a.normal);o.localNormal=a.normal;return o;
            }
            float2 Hash(float2 p){return frac(sin(float2(dot(p,float2(127.1,311.7)),dot(p,float2(269.5,183.3))))*43758.5453);}
            float Noise(float2 p)
            {
                float2 a=floor(p),b=frac(p);b=b*b*(3-2*b);
                return lerp(lerp(Hash(a).x,Hash(a+float2(1,0)).x,b.x),lerp(Hash(a+float2(0,1)).x,Hash(a+1).x,b.x),b.y);
            }
            half4 Frag(V i):SV_Target
            {
                float3 n=normalize(i.normal),ln=normalize(i.localNormal);
                float2 uv=abs(ln.y)>.65?i.local.xz:(abs(ln.x)>abs(ln.z)?i.local.zy:i.local.xy);
                uv*=1.7;uv+=.13*sin(uv.yx*4.1);
                float2 cell=floor(uv),f=frac(uv);float nearest=8,second=8;
                for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++)
                {
                    float2 g=float2(x,y),d=g+Hash(cell+g)-f;float v=dot(d,d);
                    if(v<nearest){second=nearest;nearest=v;}else second=min(second,v);
                }
                float fracture=(1-smoothstep(.003,.016,second-nearest))*smoothstep(.25,.6,Noise(uv*.55));
                float grain=Hash(floor(uv*37)).x;
                float frost=saturate((ln.y-.35)*1.7);
                half3 color=_BaseColor.rgb*lerp(.87,1.09,Noise(uv*.8));
                color=lerp(color,half3(.73,.88,.91),saturate(fracture*.17+frost*.70));
                color*=.97+grain*.06;
                Light sun=GetMainLight(TransformWorldToShadowCoord(i.world));color*=SampleSH(n)+.23+sun.color*saturate(dot(n,sun.direction))*.67*lerp(.45,1,sun.shadowAttenuation);
                color+=pow(saturate(dot(n,normalize(sun.direction+normalize(GetWorldSpaceViewDir(i.world))))),64)*sun.color*.12*sun.shadowAttenuation;
                color+=pow(1-saturate(dot(n,normalize(GetWorldSpaceViewDir(i.world)))),4)*half3(.05,.10,.13);
                return half4(color,1);
            }
            ENDHLSL
        }
        UsePass "Universal Render Pipeline/Lit/ShadowCaster"
        UsePass "Universal Render Pipeline/Lit/DepthOnly"
    }
}
