using UnityEngine;

namespace Mumu.Planet
{
    public sealed class NotebookPresentation : MonoBehaviour
    {
        [SerializeField] Camera bookCamera;
        [SerializeField] UnityEngine.UI.RawImage display;
        [SerializeField] MeshFilter leaf;
        Mesh runtimeLeaf;
        Vector3[] source,curled;
        RenderTexture target;
        public bool Rendering=>bookCamera!=null&&bookCamera.enabled;
        public bool LeafVisible=>leaf!=null&&leaf.gameObject.activeSelf;
        public Camera BookCamera=>bookCamera;
        public void Configure(Camera camera,UnityEngine.UI.RawImage image,MeshFilter page){bookCamera=camera;display=image;leaf=page;}
        void Awake()
        {
            runtimeLeaf=Instantiate(leaf.sharedMesh);runtimeLeaf.name="Notebook turning leaf instance";runtimeLeaf.MarkDynamic();leaf.sharedMesh=runtimeLeaf;
            source=runtimeLeaf.vertices;curled=new Vector3[source.Length];leaf.gameObject.SetActive(false);bookCamera.enabled=false;
        }
        public void Show(bool visible)
        {
            if(visible)
            {
                if(target==null){target=new RenderTexture(1240,820,24,RenderTextureFormat.ARGB32){name="Notebook presentation",antiAliasing=2};target.Create();}
                bookCamera.targetTexture=target;display.texture=target;bookCamera.enabled=true;
            }
            else
            {
                bookCamera.enabled=false;leaf.gameObject.SetActive(false);bookCamera.targetTexture=null;display.texture=null;
                if(target!=null){target.Release();Destroy(target);target=null;}
            }
        }
        public void Turn(float fraction,bool forward)
        {
            leaf.gameObject.SetActive(fraction>0&&fraction<1);
            float t=Mathf.SmoothStep(0,1,fraction);
            leaf.transform.localRotation=Quaternion.Euler(0,(forward?t:1-t)*180,0);
            // Bend around the binding before rotating. Both sides are real Blender geometry.
            float bend=Mathf.Sin(fraction*Mathf.PI)*.48f;
            for(int i=0;i<source.Length;i++)
            {
                var p=source[i];float u=Mathf.Clamp01(p.x/4.43f);
                float edgeLift=u*u;float height=p.y/2.9f;
                p.z-=(Mathf.Sin(u*Mathf.PI)+edgeLift*.45f)*bend*(1+.35f*height);
                p.y+=edgeLift*bend*.28f*(.35f+.65f*height);curled[i]=p;
            }
            runtimeLeaf.vertices=curled;runtimeLeaf.RecalculateNormals();runtimeLeaf.RecalculateBounds();
        }
        void OnDisable(){if(bookCamera!=null)Show(false);}
        void OnDestroy(){if(runtimeLeaf!=null)Destroy(runtimeLeaf);if(target!=null){target.Release();Destroy(target);}}
    }
}
