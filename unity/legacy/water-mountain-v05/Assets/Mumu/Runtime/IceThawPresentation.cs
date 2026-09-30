using UnityEngine;

namespace Mumu.Planet
{
    // Fixed-size receiver collision belongs to the trial; these are presentation-only pieces.
    public sealed class IceThawPresentation : MonoBehaviour
    {
        [SerializeField] Transform[] pieces,ribbons;
        [SerializeField] LineRenderer warmth;
        [SerializeField] Renderer seal;
        MaterialPropertyBlock sealProperties;
        static readonly int ThawId=Shader.PropertyToID("_Thaw"),LightId=Shader.PropertyToID("_Illuminated");
        public float SurfaceMelt=>melt;
        public bool SealVisible=>seal!=null&&seal.enabled&&seal.gameObject.activeInHierarchy;
        public Renderer Seal=>seal;
        public void ConfigureSeal(Renderer value){seal=value;}
        Vector3[] sizes,waterSizes;
        float melt;
        bool illuminated;
        public int VisiblePieces {get;private set;}
        public void Configure(Transform[] ice,Transform[] water,LineRenderer glow)
        {pieces=ice;ribbons=water;warmth=glow;}
        void EnsureSizes()
        {
            if(sizes!=null)return;
            sizes=new Vector3[pieces.Length];waterSizes=new Vector3[ribbons.Length];
            for(int i=0;i<pieces.Length;i++)sizes[i]=pieces[i].localScale;
            for(int i=0;i<ribbons.Length;i++)waterSizes[i]=ribbons[i].localScale;
        }
        public void Present(float progress,bool hit)
        {
            EnsureSizes();melt=Mathf.Clamp01(progress);illuminated=hit;VisiblePieces=0;
            if(seal!=null)
            {
                if(sealProperties==null)sealProperties=new MaterialPropertyBlock();
                sealProperties.SetFloat(ThawId,melt);sealProperties.SetFloat(LightId,hit?1:0);
                seal.SetPropertyBlock(sealProperties);seal.enabled=melt<1;
            }
            for(int i=0;i<pieces.Length;i++)
            {
                var p=pieces[i].localPosition;
                float distance=new Vector2(p.x/1.7f,p.y/2.1f).magnitude;
                float start=.03f+Mathf.Clamp01(distance/1.42f)*.55f;
                float remaining=1-Mathf.SmoothStep(0,1,Mathf.InverseLerp(start,Mathf.Min(.98f,start+.32f),melt));
                pieces[i].gameObject.SetActive(remaining>.015f);
                pieces[i].localScale=Vector3.Scale(sizes[i],new Vector3(remaining,remaining,Mathf.Sqrt(remaining)));
                if(remaining>.015f)VisiblePieces++;
            }
            if(ribbons.Length>0)ribbons[0].parent.gameObject.SetActive(melt>.04f);
            warmth.enabled=seal==null&&hit&&melt<1;
            if(warmth.enabled)
            {
                float radius=.12f+melt*2.4f;
                for(int i=0;i<warmth.positionCount;i++)
                {
                    float angle=i*Mathf.PI*2/(warmth.positionCount-1);
                    warmth.SetPosition(i,new Vector3(Mathf.Cos(angle)*radius,Mathf.Sin(angle)*radius,-.34f));
                }
            }
        }
        void Update()
        {
            if(sizes==null||melt<=.04f)return;
            for(int i=0;i<ribbons.Length;i++)
            {
                float pulse=.85f+.15f*Mathf.Sin(Time.time*3.5f-i*1.8f);
                ribbons[i].localScale=Vector3.Scale(waterSizes[i],new Vector3(pulse,1,Mathf.Lerp(.15f,1,melt)));
            }
            if(illuminated&&warmth.enabled)warmth.widthMultiplier=.035f+.014f*Mathf.Sin(Time.time*7);
        }
    }
}
