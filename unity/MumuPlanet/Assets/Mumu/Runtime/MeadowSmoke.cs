using System;
using System.Collections;
using System.IO;
using UnityEngine;

namespace Mumu.Planet
{
    // Opt-in rendered test; absent command-line flag leaves gameplay untouched.
    public sealed class MeadowSmoke : MonoBehaviour
    {
        [Serializable] sealed class Result { public bool passed,toggleValidated,persistenceValidated;public int blades,blenderLeaves,plumes,chunks,changedPixels;public string error; }
        IEnumerator Start()
        {
            var args=Environment.GetCommandLineArgs();int index=Array.IndexOf(args,"-mumu-meadow-smoke");
            if(index<0)yield break;
            string output=args[index+1];Directory.CreateDirectory(output);
            bool hadPreference=PlayerPrefs.HasKey(MeadowGrass.PreferenceKey);int oldPreference=PlayerPrefs.GetInt(MeadowGrass.PreferenceKey,0);
            var meadow=GetComponent<MeadowGrass>();meadow.SetVisible(false,false);
            var player=FindFirstObjectByType<PlanetExplorer>();player.enabled=false;
            var camera=Camera.main;var orbit=camera.GetComponent<OrbitCamera>();orbit.enabled=false;orbit.Snap();
            for(int i=0;i<20;i++)yield return null;
            foreach(var animator in FindObjectsByType<Animator>(FindObjectsSortMode.None))animator.enabled=false;
            foreach(var pose in FindObjectsByType<NavigatorPose>(FindObjectsSortMode.None))pose.enabled=false;
            var result=new Result();
            try
            {
                foreach(var renderer in GetComponentsInChildren<MeshRenderer>())
                    if(renderer.enabled)throw new Exception("Hidden grass was re-enabled by distance culling");
                var ui=FindFirstObjectByType<MeadowSettingsUI>();
                var events=UnityEngine.EventSystems.EventSystem.current;
                if(ui==null||events==null)throw new Exception("Missing grass toggle UI/input");
                var pointer=new UnityEngine.EventSystems.PointerEventData(events);
                var buttonRect=(RectTransform)ui.ToggleButton.transform;
                pointer.position=RectTransformUtility.WorldToScreenPoint(null,buttonRect.TransformPoint(buttonRect.rect.center));
                var hits=new System.Collections.Generic.List<UnityEngine.EventSystems.RaycastResult>();events.RaycastAll(pointer,hits);
                if(!hits.Exists(hit=>hit.gameObject==ui.ToggleButton.gameObject))throw new Exception("Grass button is not clickable");
                void Click()=>UnityEngine.EventSystems.ExecuteEvents.Execute(ui.ToggleButton.gameObject,pointer,UnityEngine.EventSystems.ExecuteEvents.pointerClickHandler);
                Click();
                if(!meadow.IsVisible||PlayerPrefs.GetInt(MeadowGrass.PreferenceKey,-1)!=1)throw new Exception("Toggle on was not persisted");
                meadow.SetVisible(false,false);meadow.ReloadPreference();
                if(!meadow.IsVisible)throw new Exception("Saved grass choice was not restored");
                Click();
                if(meadow.IsVisible||PlayerPrefs.GetInt(MeadowGrass.PreferenceKey,-1)!=0)throw new Exception("Toggle off failed");
                foreach(var renderer in GetComponentsInChildren<MeshRenderer>())if(renderer.enabled)throw new Exception("Toggle off left visible foliage");
                Capture(camera,Path.Combine(output,"grass-off.png"));
                Click();result.toggleValidated=true;result.persistenceValidated=true;
                var meshes=GetComponentsInChildren<MeshFilter>();result.chunks=meshes.Length;
                foreach(var filter in meshes)
                {
                    var mesh=filter.sharedMesh;var uv=mesh.uv;
                    var detail=new System.Collections.Generic.List<Vector4>();mesh.GetUVs(2,detail);
                    if(detail.Count!=uv.Length)throw new Exception("Missing foliage metadata");
                    for(int i=0;i<uv.Length;)
                    {
                        if(detail[i].z>1.5f)
                        {
                            if(i+18>=uv.Length||uv[i].y!=0||uv[i+1].y!=0||uv[i+2].y!=0||uv[i+18].y!=1)throw new Exception("Blender leaf root/tip weights invalid");
                            for(int j=0;j<19;j++)if(detail[i+j].z!=2)throw new Exception("Broken Blender leaf mesh");
                            result.blenderLeaves++;result.blades++;i+=19;
                        }
                        else if(detail[i].z<.5f)
                        {
                            if(i+6>=uv.Length||uv[i].y!=0||uv[i+1].y!=0||uv[i+6].y!=1)throw new Exception("Grass root/tip weights invalid");
                            result.blades++;i+=7;
                        }
                        else
                        {
                            if(i+7>=uv.Length)throw new Exception("Incomplete feather cross");
                            for(int j=0;j<8;j++)if(detail[i+j].z!=1||uv[i+j].y<.5f||uv[i+j].y>1.001f)throw new Exception("Invalid plume attachment");
                            result.plumes++;i+=8;
                        }
                    }
                }
                if(result.blades<10000)throw new Exception("Missing meadow coverage");
                if(result.plumes<1000)throw new Exception("Missing pampas clusters");
                if(result.blenderLeaves<10000)throw new Exception("Blender grass assets were not integrated");
                if(GetComponentsInChildren<Collider>().Length!=0)throw new Exception("Grass must not block traversal");
                if(!GetComponentInChildren<MeshRenderer>().sharedMaterial.shader.isSupported)throw new Exception("Unsupported wind shader");
                Shader.SetGlobalFloat("_MumuGrassTestEnabled",1);
                Shader.SetGlobalFloat("_MumuGrassTestTime",0);
                var a=Capture(camera,Path.Combine(output,"wind-a.png"));
                Shader.SetGlobalFloat("_MumuGrassTestTime",1.4f);
                var b=Capture(camera,Path.Combine(output,"wind-b.png"));
                for(int i=0;i<a.Length;i++)
                    if(Mathf.Abs(a[i].r-b[i].r)+Mathf.Abs(a[i].g-b[i].g)+Mathf.Abs(a[i].b-b[i].b)>18)result.changedPixels++;
                if(result.changedPixels<2000)throw new Exception("Wind is not visibly animating in rendered frames");
                // Shared time must be deterministic: rendering it again must match.
                var repeat=Capture(camera,Path.Combine(output,"wind-b-repeat.png"));
                int unexpected=0;
                for(int i=0;i<b.Length;i++)if(Mathf.Abs(b[i].r-repeat[i].r)+Mathf.Abs(b[i].g-repeat[i].g)+Mathf.Abs(b[i].b-repeat[i].b)>18)unexpected++;
                if(unexpected>100)throw new Exception("Scene changed independently of grass wind");
                result.passed=true;
            }
            catch(Exception e){result.error=e.ToString();Debug.LogException(e);}
            finally
            {
                Shader.SetGlobalFloat("_MumuGrassTestEnabled",0);
                if(hadPreference)PlayerPrefs.SetInt(MeadowGrass.PreferenceKey,oldPreference);else PlayerPrefs.DeleteKey(MeadowGrass.PreferenceKey);
                PlayerPrefs.Save();
            }
            File.WriteAllText(Path.Combine(output,"result.json"),JsonUtility.ToJson(result,true));
            Application.Quit(result.passed?0:1);
        }
        static Color32[] Capture(Camera camera,string path)
        {
            var target=new RenderTexture(1440,900,24);var previous=camera.targetTexture;var active=RenderTexture.active;
            var image=new Texture2D(1440,900,TextureFormat.RGB24,false);
            var canvases=FindObjectsByType<Canvas>(FindObjectsSortMode.None);
            var overlays=new System.Collections.Generic.List<Canvas>();
            try
            {
                foreach(var canvas in canvases)if(canvas.renderMode==RenderMode.ScreenSpaceOverlay)
                {overlays.Add(canvas);canvas.renderMode=RenderMode.ScreenSpaceCamera;canvas.worldCamera=camera;canvas.planeDistance=.5f;}
                camera.targetTexture=target;camera.Render();RenderTexture.active=target;
                image.ReadPixels(new Rect(0,0,1440,900),0,0);image.Apply();
                File.WriteAllBytes(path,image.EncodeToPNG());return image.GetPixels32();
            }
            finally
            {
                foreach(var canvas in overlays){canvas.renderMode=RenderMode.ScreenSpaceOverlay;canvas.worldCamera=null;}
                camera.targetTexture=previous;RenderTexture.active=active;target.Release();Destroy(target);Destroy(image);
            }
        }
    }
}
