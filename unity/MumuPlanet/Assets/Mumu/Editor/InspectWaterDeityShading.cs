using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using Mumu.Planet;

namespace Mumu.Editor
{
    // Temporary editor captures isolate shading; never saves scene/material changes.
    public static class InspectWaterDeityShading
    {
        public static void Run()
        {
            Capture(Path.GetFullPath("../../reports/2026-09-26/water-deity-v03/shading"));
        }
        public static void Capture(string output)
        {
            EditorSceneManager.OpenScene("Assets/Mumu/Scenes/WaterSanctuary.unity");
            var room=Object.FindFirstObjectByType<WaterSanctuary>();var camera=room.orbit.GetComponent<Camera>();
            camera.transform.SetPositionAndRotation(new Vector3(.32f,3.35f,10.6f),Quaternion.LookRotation(new Vector3(-.32f,-.2f,1.4f)));
            foreach(var canvas in Object.FindObjectsByType<Canvas>(FindObjectsSortMode.None))canvas.enabled=false;
            var renderer=room.deity.GetComponentInChildren<MeshRenderer>();var original=renderer.sharedMaterial;var temporary=new Material(original);renderer.sharedMaterial=temporary;
            var lights=Object.FindObjectsByType<Light>(FindObjectsSortMode.None);var shadows=new LightShadows[lights.Length];for(int i=0;i<lights.Length;i++)shadows[i]=lights[i].shadows;
            Directory.CreateDirectory(output);
            try
            {
                foreach(var mode in new[]{"default","no-normal","no-shadow","neither"})
                {
                    bool normal=mode=="default"||mode=="no-shadow";
                    if(normal)temporary.EnableKeyword("_NORMALMAP");else temporary.DisableKeyword("_NORMALMAP");
                    for(int i=0;i<lights.Length;i++)lights[i].shadows=mode=="no-shadow"||mode=="neither"?LightShadows.None:shadows[i];
                    var rt=new RenderTexture(1024,1024,24);rt.Create();camera.targetTexture=rt;camera.Render();
                    var old=RenderTexture.active;RenderTexture.active=rt;var image=new Texture2D(1024,1024,TextureFormat.RGB24,false);image.ReadPixels(new Rect(0,0,1024,1024),0,0);image.Apply();
                    File.WriteAllBytes(Path.Combine(output,mode+".png"),image.EncodeToPNG());camera.targetTexture=null;RenderTexture.active=old;rt.Release();Object.DestroyImmediate(rt);Object.DestroyImmediate(image);
                }
            }
            finally{renderer.sharedMaterial=original;Object.DestroyImmediate(temporary);for(int i=0;i<lights.Length;i++)lights[i].shadows=shadows[i];}
            Debug.Log("DEITY_SHADING_REVIEW "+output);
        }
    }
}
