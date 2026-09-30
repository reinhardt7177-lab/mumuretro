using UnityEngine;

namespace Mumu.Planet
{
    public sealed class WaterGateCeremony : MonoBehaviour
    {
        public AudioSource source;
        public int CueCount { get; private set; }
        public float Progress { get; private set; }
        Renderer[] surfaces;
        MaterialPropertyBlock properties;
        bool begun,paused;
        static readonly int Wake = Shader.PropertyToID("_Wake");
        void Initialize()
        {
            if(properties!=null)return;
            properties=new MaterialPropertyBlock();
            surfaces=GetComponentsInChildren<Renderer>();
        }
        public void Present(float progress, bool restoring=false)
        {
            Initialize();Progress=Mathf.Clamp01(progress);
            if(restoring){begun=Progress>0;if(source)source.Stop();paused=false;}
            else if(Progress>0&&!begun)
            {
                begun=true;CueCount++;
                if(source&&source.clip)source.Play();
            }
            foreach(var surface in surfaces)
            {
                if(!surface)continue;
                surface.GetPropertyBlock(properties);properties.SetFloat(Wake,Progress);surface.SetPropertyBlock(properties);
            }
        }
        public void SetPaused(bool value)
        {
            if(value==paused)return;
            paused=value;if(!source)return;
            if(value)source.Pause();else source.UnPause();
        }
    }
}
