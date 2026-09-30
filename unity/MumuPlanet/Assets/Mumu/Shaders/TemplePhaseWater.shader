Shader "Mumu/Temple Phase Water"
{
 Properties { _BaseColor("Water",Color)=(.08,.4,.5,1) _Frozen("Frozen",Range(0,1))=0 _SolidReady("Safe crossing",Range(0,1))=0 _IsCrossing("Crossing",Range(0,1))=0 _EmissionColor("Selection",Color)=(0,0,0,1) }
 SubShader
 {
  Tags {"RenderPipeline"="UniversalPipeline" "RenderType"="Opaque" "Queue"="Geometry"}
  Pass
  {
   Tags {"LightMode"="UniversalForward"}
   HLSLPROGRAM
   #pragma vertex vert
   #pragma fragment frag
   #pragma multi_compile_fog
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
   CBUFFER_START(UnityPerMaterial)
   float4 _BaseColor,_EmissionColor;float _Frozen,_SolidReady,_IsCrossing;
   CBUFFER_END
   struct A{float4 p:POSITION;float3 n:NORMAL;};
   struct V{float4 p:SV_POSITION;float3 w:TEXCOORD0;float3 n:TEXCOORD1;float fog:TEXCOORD2;float3 local:TEXCOORD3;};
   V vert(A i){V o;o.local=i.p.xyz;o.w=TransformObjectToWorld(i.p.xyz);o.p=TransformWorldToHClip(o.w);o.n=TransformObjectToWorldNormal(i.n);o.fog=ComputeFogFactor(o.p.z);return o;}
   float hash(float2 p){return frac(sin(dot(p,float2(127.1,311.7)))*43758.5453);}
   half4 frag(V i):SV_Target
   {
    float2 p=i.w.xz*1.4+float2(sin(i.w.z*3),sin(i.w.x*2))*.12;float2 cell=floor(p);float2 f=frac(p);float d1=9,d2=9;
    for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){float2 off=float2(x,y);float2 q=off+float2(hash(cell+off),hash(cell+off+37))-f;float d=dot(q,q);if(d<d1){d2=d1;d1=d;}else d2=min(d2,d);}
    float crack=(1-smoothstep(.004,.027,d2-d1))*(.25+.75*smoothstep(.25,.7,hash(cell)));
    // The visible front follows conserved ice mass; heating reverses the same front.
    // Object-local coordinates preserve direction if a target is moved or scaled.
    float grainFront=sin(i.local.x*37+i.local.z*16)*.015+sin(i.local.x*17-i.local.z*25)*.02;
    float frontier=i.local.z+.5+grainFront;
    float frozenMask=(1-smoothstep(_Frozen-.035,_Frozen+.025,frontier))*step(.0001,_Frozen);
    frozenMask=lerp(frozenMask,1,step(.99975,_Frozen));
    float rim=exp(-pow((frontier-_Frozen)*55,2))*step(.001,_Frozen)*(1-step(.99975,_Frozen));
    float t=_Time.y;float ripple=sin(i.w.x*9+t*1.8+sin(i.w.z*4-t))*sin(i.w.z*7-t);
    float3 n=normalize(i.n+float3(ripple*.10,0,cos(i.w.x*6+t)*.08)*(1-frozenMask));
    float3 view=normalize(GetWorldSpaceViewDir(i.w));Light main=GetMainLight();
    float fres=pow(1-saturate(dot(n,view)),3);float spec=pow(saturate(dot(n,normalize(main.direction+view))),60);
    float3 water=float3(.025,.22,.28)+ripple*.025+fres*float3(.20,.42,.48);
    float cloud=.5+.5*sin(i.w.x*2.2+sin(i.w.z*1.3))*sin(i.w.z*2.8);
    float3 ice=lerp(float3(.16,.36,.43),float3(.46,.70,.75),cloud*.6)+crack*float3(.35,.51,.53)+fres*.18;
    float top=smoothstep(.7,.95,i.n.y);
    float sparkle=pow(saturate(sin(i.w.x*71+i.w.z*59+t*4)),24)*rim;
    float edge=smoothstep(.475,.49,abs(i.local.x))*top*_IsCrossing;
    float dashed=step(.5,frac((i.local.z+.5)*14));
    float3 guide=lerp(float3(.48,.24,.06)*dashed,float3(.55,.88,.72),_SolidReady);
    float3 col=lerp(water,ice,frozenMask)*( .65+.35*saturate(dot(n,main.direction)))+spec*.45;
    col+=(rim*.22+sparkle*.22)*top*float3(.50,.86,1)+edge*guide*lerp(.65,1,_SolidReady)+_EmissionColor.rgb*.08;
    return half4(MixFog(col,i.fog),1);
   }
   ENDHLSL
  }
 }
}
