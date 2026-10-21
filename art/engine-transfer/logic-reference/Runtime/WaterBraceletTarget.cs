using UnityEngine;

namespace Mumu.Planet
{
    public sealed class WaterBraceletTarget : MonoBehaviour
    {
        public string displayName;
        public bool collector;
        public float initialWater = 2;
        public bool initiallyFrozen;
        public bool acceptsPower = true;
        public float supportWater;
        public Renderer surface;
        public Collider iceSupport;
        public WaterPhaseState Water { get; private set; }
        public float Cold { get; private set; }
        MaterialPropertyBlock appearance;
        Vector3 originalScale;
        Vector3 originalPosition;
        public void Initialize()
        {
            if (Water != null) return;
            Water = new WaterPhaseState(initialWater);
            if(initiallyFrozen){Water.ice=initialWater;Water.liquid=0;}
            appearance = new MaterialPropertyBlock();
            if(surface != null){originalScale = surface.transform.localScale;originalPosition=surface.transform.localPosition;}
        }
        void Awake() { Initialize(); }
        public void CoolPlate(bool heating,float dt) { Cold = Mathf.Clamp01(Cold + (heating ? -1 : 1) * dt / 2); }
        public void Restore(float ice,float liquid,float vapour,float cold)
        {Initialize();Water.ice=ice;Water.liquid=liquid;Water.vapour=vapour;Cold=cold;Present(false);}
        public void Present(bool selected)
        {
            Initialize();
            float required=supportWater>0?supportWater:initialWater;
            if(iceSupport != null) iceSupport.enabled = Water.ice >= required - .001f && required > 0;
            if(surface == null) return;
            Color color = collector ? Color.Lerp(new Color(.45f,.32f,.16f),new Color(.6f,.94f,1),Cold) :
                Color.Lerp(new Color(.04f,.45f,.55f),new Color(.68f,.94f,1),Water.ice/Mathf.Max(.001f,required));
            appearance.SetColor("_BaseColor",color);
            appearance.SetFloat("_Frozen",Mathf.Clamp01(Water.ice/Mathf.Max(.001f,required)));
            appearance.SetFloat("_IsCrossing",iceSupport!=null?1:0);
            appearance.SetFloat("_SolidReady",iceSupport!=null&&iceSupport.enabled?1:0);
            appearance.SetColor("_EmissionColor", selected ? color * .6f : color * .06f);
            surface.SetPropertyBlock(appearance);
            if(!collector)
            {
                surface.enabled=Water.ice + Water.liquid > .001f;
                var scale=originalScale;scale.y=originalScale.y*Mathf.Clamp((Water.ice+Water.liquid)/Mathf.Max(required,.001f),.05f,1);
                surface.transform.localScale=scale;
                surface.transform.localPosition=originalPosition-Vector3.up*(originalScale.y-scale.y)*.5f;
            }
        }
    }
}

