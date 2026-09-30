#ifndef MUMU_SHADOW_NIGHT_COMMON
#define MUMU_SHADOW_NIGHT_COMMON

CBUFFER_START(UnityPerMaterial)
float4 _Top, _Horizon, _Below, _MoonDir, _MoonColor;
float _MoonSize, _StarDensity, _StarBrightness;
CBUFFER_END

float NightHash(float3 p)
{
    p = frac(p * 0.3183099 + float3(0.1, 0.2, 0.3));
    p *= 17.0;
    return frac(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float3 NightSky(float3 d)
{
    float t = smoothstep(-0.05, 0.62, clamp(d.y, -0.15, 1.0));
    float3 c = lerp(_Horizon.rgb, _Top.rgb, t);
    c = lerp(c, _Below.rgb, saturate(-d.y * 3.0));
    float3 g = d * _StarDensity;
    float3 cell = floor(g);
    float3 f = frac(g) - 0.5;
    float h = NightHash(cell);
    float3 jitter = (float3(NightHash(cell + 7.1), NightHash(cell + 3.7), NightHash(cell + 9.3)) - 0.5) * 0.5;
    float star = step(0.992, h) * smoothstep(0.32, 0.0, length(f - jitter)) * saturate(d.y * 5.0 + 0.1);
    c += star * _StarBrightness * (0.45 + 0.55 * NightHash(cell + 1.3));
    float3 m = normalize(_MoonDir.xyz);
    float md = acos(clamp(dot(d, m), -1.0, 1.0));
    float disc = smoothstep(_MoonSize, _MoonSize * 0.86, md);
    float glow = exp(-md * md / (_MoonSize * _MoonSize * 30.0)) * 0.28;
    c = lerp(c, _MoonColor.rgb * 1.5, disc) + _MoonColor.rgb * glow;
    return c;
}

#endif
