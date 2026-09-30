using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Mumu.Planet
{
    // Explicit Windows-player check; dormant in normal play.
    public sealed class TempleExteriorSmoke : MonoBehaviour
    {
        [SerializeField] TempleEntrance entrance;
        [SerializeField] PlanetExplorer player;
        [SerializeField] OrbitCamera orbit;
        [SerializeField] PlanetSurface ground;
        readonly List<string> checks=new List<string>();
        string output;
        static bool running;
        [Serializable] class Result{public bool passed;public string error;public string[] checks;}
        public void Configure(TempleEntrance entry,PlanetExplorer explorer,OrbitCamera camera,PlanetSurface surface)
        {entrance=entry;player=explorer;orbit=camera;ground=surface;}
        void Check(bool value,string label){if(!value)throw new InvalidOperationException(label);checks.Add(label);Debug.Log("EXTERIOR_CHECK "+label);}
        IEnumerator Start()
        {
            var args=Environment.GetCommandLineArgs();int index=Array.IndexOf(args,"-mumu-exterior-smoke");if(index<0||running)yield break;running=true;
            output=args[index+1];Directory.CreateDirectory(output);DontDestroyOnLoad(gameObject);
            for(int i=0;i<20;i++)yield return null;
            player.enabled=false;orbit.enabled=false;Application.SetStackTraceLogType(LogType.Log,StackTraceLogType.None);
            var run=Validate();string error=null;
            while(true){bool more=false;try{more=run.MoveNext();}catch(Exception e){error=e.ToString();Debug.LogException(e);}if(!more||error!=null)break;yield return run.Current;}
            File.WriteAllText(Path.Combine(output,"result.json"),JsonUtility.ToJson(new Result{passed=error==null,error=error??"",checks=checks.ToArray()},true));Application.Quit(error==null?0:1);
        }
        void Capture(string name,bool overview=false)
        {
            orbit.Snap();var camera=orbit.GetComponent<Camera>();
            if(overview)
            {
                camera.transform.position=entrance.transform.TransformPoint(new Vector3(8,5.8f,-10));
                camera.transform.rotation=Quaternion.LookRotation(entrance.transform.TransformPoint(new Vector3(0,2.6f,1))-camera.transform.position,entrance.transform.up);
            }
            var canvases=FindObjectsByType<Canvas>(FindObjectsSortMode.None);
            foreach(var canvas in canvases){canvas.renderMode=RenderMode.ScreenSpaceCamera;canvas.worldCamera=camera;canvas.planeDistance=.5f;}
            Canvas.ForceUpdateCanvases();var rt=new RenderTexture(1440,900,24);rt.Create();camera.targetTexture=rt;camera.Render();var previous=RenderTexture.active;RenderTexture.active=rt;
            var texture=new Texture2D(1440,900,TextureFormat.RGB24,false);texture.ReadPixels(new Rect(0,0,1440,900),0,0);texture.Apply();File.WriteAllBytes(Path.Combine(output,name+".png"),texture.EncodeToPNG());
            camera.targetTexture=null;RenderTexture.active=previous;rt.Release();Destroy(rt);Destroy(texture);foreach(var canvas in canvases)canvas.renderMode=RenderMode.ScreenSpaceOverlay;
        }
        void Respawn(Vector3 local){player.Respawn(ground.Point(entrance.transform.TransformPoint(local)),entrance.transform.forward);Physics.SyncTransforms();}
        IEnumerator Validate()
        {
            Check(SceneManager.GetActiveScene().name=="PlanetExploration","Exterior lives in the exploration scene");
            Check(!entrance.CanEnter&&!entrance.TryEnter(),"Distant spawn cannot enter temple");
            var art=entrance.transform.Find("Blender weight sanctuary exterior");Check(art!=null,"Authored Blender exterior is present");
            var renderers=art.GetComponentsInChildren<MeshRenderer>();int triangles=0;
            foreach(var renderer in renderers)
            {
                foreach(var material in renderer.sharedMaterials)Check(material!=null&&material.shader.isSupported,"Supported exterior material: "+material.name);
                var mesh=renderer.GetComponent<MeshFilter>().sharedMesh;var indices=mesh.triangles;var vertices=mesh.vertices;var normals=mesh.normals;triangles+=indices.Length/3;
                bool facing=true;
                for(int i=0;i<indices.Length;i+=3)
                {
                    int a=indices[i],b=indices[i+1],c=indices[i+2];
                    if(Vector3.Dot(Vector3.Cross(vertices[b]-vertices[a],vertices[c]-vertices[a]),normals[a]+normals[b]+normals[c])< -0.000001f){facing=false;break;}
                }
                Check(facing,"Exterior faces point outward: "+renderer.name);
            }
            Check(triangles>1000&&triangles<26000,"Exterior and hinged doors stay below 26k triangles including paving");
            Check(entrance.Door!=null&&entrance.Door.Progress==0,"Blender double door starts closed");
            Capture("exterior-gameplay");Capture("exterior-overview",true);
            Respawn(new Vector3(0,0,4.5f));Check(!entrance.CanEnter&&!entrance.TryEnter(),"Rear wall cannot trigger temple entry");
            Respawn(new Vector3(3.9f,0,0));Check(!entrance.CanEnter&&!entrance.TryEnter(),"Side wall cannot trigger temple entry");
            foreach(int side in new[]{-1,1})
            {
                Respawn(new Vector3(side*2.5f,0,-3));
                for(int i=0;i<180;i++)player.Step(entrance.transform.forward,false,false,1f/60);
                Check(entrance.transform.InverseTransformPoint(player.transform.position).z< -.8f,"Pier blocks walking through it: "+side);
            }
            Respawn(new Vector3(0,0,-4));var target=ground.Point(entrance.transform.TransformPoint(new Vector3(0,0,-1.1f)));int steps=0;
            while(Vector3.Distance(player.transform.position,target)>.10f&&steps++<400)
            {
                var delta=target-player.transform.position;player.Step(delta.normalized*Mathf.Min(1,delta.magnitude*12),false,false,1f/60);
                player.GetComponentInChildren<Animator>().Update(1f/60);if(steps%30==0)yield return null;
            }
            Check(steps<400&&entrance.CanEnter,"Walking along the paved approach reaches the entrance");
            Check(Vector3.Distance(player.transform.position,ground.Point(player.transform.position))<.025f,"Player stays grounded on the approach");
            for(int i=0;i<180;i++)player.Step(entrance.transform.forward,false,false,1f/60);
            Check(entrance.transform.InverseTransformPoint(player.transform.position).z<1.15f,"Solid door blocks walking before the front panel");
            Check(entrance.CanEnter,"Entry remains available when standing against the closed portal");
            Respawn(new Vector3(0,0,-1.1f));yield return null;Capture("exterior-entrance");
            var returnPosition=player.transform.position;Check(entrance.TryEnter(),"Front entrance accepts the same action used by E");
            Check(entrance.IsOpening&&!entrance.TryEnter(),"Repeated entry is blocked during the opening animation");
            Check(!player.enabled,"Movement is held while the heavy door opens");
            float deadline=Time.realtimeSinceStartup+8;
            while(entrance!=null&&entrance.Door.Progress<.5f&&Time.realtimeSinceStartup<deadline)yield return null;
            Check(entrance!=null&&entrance.Door.Progress>=.5f&&entrance.Door.Progress<1,"Opening plays before the scene transition");
            Check(entrance.Door.LeftAngle>10&&Mathf.Abs(entrance.Door.LeftAngle-entrance.Door.RightAngle)<.01f,"Both leaves open symmetrically at their outer hinges");
            Capture("door-half-open");
            while(entrance!=null&&entrance.Door.Progress<1&&Time.realtimeSinceStartup<deadline)yield return null;
            Check(entrance!=null&&Mathf.Abs(entrance.Door.LeftAngle-94)<.05f,"Heavy doors reach their full opening angle");
            Check(Vector3.Distance(player.transform.position,returnPosition)<.001f,"Entry animation does not move the saved return position");
            Capture("door-open");
            while(SceneManager.GetActiveScene().name=="PlanetExploration"&&Time.realtimeSinceStartup<deadline)yield return null;
            Check(SceneManager.GetActiveScene().name=="WeightTemple"&&FindFirstObjectByType<BalanceRoom>()!=null,"Exterior entry loads the first weight puzzle");
            FindFirstObjectByType<BalanceRoom>().Leave();for(int i=0;i<20;i++)yield return null;
            var restored=FindFirstObjectByType<PlanetExplorer>();
            Check(SceneManager.GetActiveScene().name=="PlanetExploration"&&Vector3.Distance(restored.transform.position,returnPosition)<.1f,"Leaving the temple restores the exterior approach position");
            Check(FindFirstObjectByType<TempleEntrance>().transform.Find("Blender weight sanctuary exterior")!=null,"Exterior survives the return to the planet");
            var returnedEntry=FindFirstObjectByType<TempleEntrance>();
            Check(restored.enabled&&returnedEntry.Door.Progress==0&&!returnedEntry.IsOpening,"Returning restores movement and closes the doors");
            Check(returnedEntry.TryEnter(),"The same door supports a second visit");
            deadline=Time.realtimeSinceStartup+8;
            while(SceneManager.GetActiveScene().name=="PlanetExploration"&&Time.realtimeSinceStartup<deadline)yield return null;
            Check(SceneManager.GetActiveScene().name=="WeightTemple","Second visit completes without a stuck input lock");
        }
    }
}
