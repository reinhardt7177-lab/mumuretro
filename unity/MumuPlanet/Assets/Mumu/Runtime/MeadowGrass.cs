using UnityEngine;

namespace Mumu.Planet
{
    // One controller for the meadow. Individual blades animate entirely on GPU.
    public sealed class MeadowGrass : MonoBehaviour
    {
        public const string PreferenceKey="Mumu.Meadow.Visible";
        public bool IsVisible { get; private set; }
        public event System.Action<bool> VisibilityChanged;
        MeshRenderer[] chunks;
        Camera view;
        float nextUpdate;
        void Awake() { chunks=GetComponentsInChildren<MeshRenderer>();view=Camera.main;ReloadPreference(); }
        public void ReloadPreference() { SetVisible(PlayerPrefs.GetInt(PreferenceKey,0)==1,false); }
        public void SetVisible(bool visible,bool persist=true)
        {
            IsVisible=visible;
            if(persist){PlayerPrefs.SetInt(PreferenceKey,visible?1:0);PlayerPrefs.Save();}
            RefreshChunks();VisibilityChanged?.Invoke(visible);
        }
        void RefreshChunks()
        {
            if(chunks==null)return;
            if(view==null)view=Camera.main;
            foreach(var chunk in chunks)
                chunk.enabled=IsVisible && view!=null && chunk.bounds.SqrDistance(view.transform.position)<38f*38f;
        }
        void Update()
        {
            if(!IsVisible)return;
            if(Time.unscaledTime<nextUpdate)return;
            nextUpdate=Time.unscaledTime+.2f;
            RefreshChunks();
        }
    }
}
