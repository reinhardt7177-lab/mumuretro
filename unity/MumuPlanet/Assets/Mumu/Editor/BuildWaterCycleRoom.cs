using System;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
using Mumu.Planet;
using static Mumu.Editor.BuildWeightTemple;

namespace Mumu.Editor
{
    public static class BuildWaterCycleRoom
    {
        const string ScenePath="Assets/Mumu/Scenes/WaterCycleRoom.unity";
        static Material stone,bronze,water;
        static GameObject BlockAt(string name,Vector3 p,Vector3 size,Material mat,bool floor=false)
        {var go=Block(name,p,size,mat);if(floor)go.layer=9;return go;}
        static WaterBraceletTarget Target(string name,Vector3 p,Vector3 size,bool plate=false)
        {
            var root=new GameObject(name);root.transform.position=p;var t=root.AddComponent<WaterBraceletTarget>();t.displayName=name;t.initialWater=0;t.supportWater=6;t.collector=plate;
            var hit=root.AddComponent<BoxCollider>();hit.size=size+Vector3.up*.3f;hit.isTrigger=true;
            var surface=Block(name+" surface",p,size,plate?bronze:water,false);surface.transform.SetParent(root.transform,true);t.surface=surface.GetComponent<Renderer>();
            return t;
        }
        static LineRenderer Pipe(string name,Material mat,float width,params Vector3[] points)
        {var l=new GameObject(name).AddComponent<LineRenderer>();l.sharedMaterial=mat;l.widthMultiplier=width;l.positionCount=points.Length;l.SetPositions(points);return l;}
        static void Ramp()
        {
            var mesh=new Mesh{name="Fixed maintenance ramp"};
            mesh.vertices=new[]{new Vector3(4.5f,0,5.7f),new Vector3(6,0,5.7f),new Vector3(4.5f,2.4f,8.7f),new Vector3(6,2.4f,8.7f)};
            mesh.triangles=new[]{0,2,1,1,2,3};mesh.RecalculateNormals();mesh.RecalculateBounds();
            const string path="Assets/Mumu/Generated/Balance/WaterCycleRamp.asset";
            var existing=AssetDatabase.LoadAssetAtPath<Mesh>(path);if(existing==null)AssetDatabase.CreateAsset(mesh,path);else {EditorUtility.CopySerialized(mesh,existing);UnityEngine.Object.DestroyImmediate(mesh);mesh=existing;}
            var go=new GameObject("Fixed upper-gallery ramp",typeof(MeshFilter),typeof(MeshRenderer),typeof(MeshCollider));go.layer=9;
            go.GetComponent<MeshFilter>().sharedMesh=mesh;go.GetComponent<MeshRenderer>().sharedMaterial=stone;go.GetComponent<MeshCollider>().sharedMesh=mesh;
            // Side supports meet the floor; the ramp is never a floating access path.
            for(int i=1;i<=3;i++)BlockAt("Ramp support",new Vector3(5.25f,i*.4f,5.7f+i),new Vector3(1.5f,i*.8f,.18f),stone).GetComponent<Collider>().enabled=false;
        }
        [MenuItem("Mumu/Build water temple circulation room")]
        public static void Create()
        {
            BuildWaterIceRoom.Create();var scene=SceneManager.GetActiveScene();var crossing=UnityEngine.Object.FindFirstObjectByType<WaterIceRoom>();var ability=crossing.ability;
            UnityEngine.Object.DestroyImmediate(ability.GetComponent<WaterIceRoomSmoke>());
            var cycle=ability.gameObject.AddComponent<WaterCycleRoom>();cycle.crossing=crossing;crossing.cycle=cycle;
            crossing.supply.initialWater=6;crossing.supply.initiallyFrozen=false;crossing.supply.displayName="공급 저수조";
            foreach(var text in crossing.supply.GetComponentsInChildren<TMPro.TextMeshPro>())text.text="공급 저수조";

            stone=Material("Cycle room limestone",new Color(.36f,.45f,.47f));bronze=Material("Cycle room bronze",new Color(.65f,.42f,.16f),.5f);water=Material("Cycle room water",new Color(.04f,.5f,.63f));water.EnableKeyword("_EMISSION");
            cycle.boiler=Target("가열 용기",new Vector3(3,.85f,-2),new Vector3(1.4f,.25f,1.4f));
            BlockAt("Boiler foundation",new Vector3(3,.34f,-2),new Vector3(1.7f,.68f,1.7f),stone);
            cycle.routingLever=new GameObject("Water routing lever").transform;cycle.routingLever.position=new Vector3(0,0,-2.4f);
            BlockAt("Routing pedestal",new Vector3(.7f,.3f,-2.4f),new Vector3(.35f,.6f,.35f),bronze);
            WorldText(cycle.routingLever,"물길 전환·이송 펌프 [E]",new Vector3(0,1.5f,0),4,.5f,3);
            var platform=BlockAt("Upper management gallery",new Vector3(2.75f,2.25f,8.4f),new Vector3(3.5f,.3f,2.4f),stone,true);
            BlockAt("Ramp top landing",new Vector3(5.25f,2.25f,9.15f),new Vector3(1.5f,.3f,.9f),stone,true);
            foreach(float x in new[]{1.4f,5.4f})BlockAt("Gallery grounded pillar",new Vector3(x,1.1f,9.3f),new Vector3(.5f,2.2f,.5f),stone);
            Ramp();
            BlockAt("Gallery rear safety wall",new Vector3(3.4f,3.4f,9.55f),new Vector3(5,.2f+2,.15f),stone);
            cycle.upperValve=new GameObject("Upper sluice control").transform;cycle.upperValve.position=new Vector3(2,2.4f,8f);
            var valve=BlockAt("Upper valve pedestal",new Vector3(2,2.85f,8f),new Vector3(.4f,.9f,.4f),bronze);cycle.valveLamp=valve.GetComponent<Renderer>();
            WorldText(cycle.upperValve,"성소 수문 [E]",new Vector3(0,1.5f,0),3,.5f,3);
            cycle.collector=Target("냉각 집수판",new Vector3(3.7f,3.2f,8.6f),new Vector3(1.8f,.2f,1),true);
            BlockAt("Collector pillar",new Vector3(3.7f,2.75f,8.6f),new Vector3(.3f,.7f,.3f),bronze);
            cycle.sanctum=Target("성소 수조",new Vector3(-3,1.1f,8.3f),new Vector3(2,.8f,1.5f));cycle.sanctum.acceptsPower=false;
            BlockAt("Sanctum basin footing",new Vector3(-3,.3f,8.3f),new Vector3(2.4f,.6f,1.9f),stone);
            foreach(float x in new[]{-4.15f,-1.85f})BlockAt("Sanctum basin side",new Vector3(x,.9f,8.3f),new Vector3(.18f,1.2f,1.9f),stone);
            WorldText(cycle.sanctum.transform,"물의 순환 · 성소",new Vector3(0,1,0),4,.5f,3);
            var basePipe=Pipe("Supported steam riser",bronze,.14f,new Vector3(3,0,-2),new Vector3(3,3.8f,-2),new Vector3(6.5f,3.8f,-2),new Vector3(6.5f,3.8f,8.6f),new Vector3(3.7f,3.8f,8.6f));
            foreach(float z in new[]{-2f,3f,7f,8.6f})BlockAt("Steam pipe support",new Vector3(6.5f,1.9f,z),new Vector3(.14f,3.8f,.14f),bronze);
            cycle.steam=Pipe("Steam movement",water,.05f,new Vector3(3,.9f,-2),new Vector3(3,3.8f,-2),new Vector3(6.5f,3.8f,-2),new Vector3(6.5f,3.8f,8.6f),new Vector3(3.7f,3.8f,8.6f));
            cycle.condensation=Pipe("Condensed water to sanctuary",water,.06f,new Vector3(3.7f,3.2f,8.6f),new Vector3(-3,3.2f,8.6f),new Vector3(-3,1.2f,8.3f));
            cycle.drain=Pipe("Meltwater route to boiler",water,.08f,new Vector3(0,-.1f,2.5f),new Vector3(0,-.1f,-.3f),new Vector3(3,.6f,-2));
            cycle.steam.enabled=cycle.condensation.enabled=cycle.drain.enabled=false;
            ability.targets=new[]{crossing.supply,crossing.trough,crossing.recovery,cycle.boiler,cycle.collector,cycle.sanctum};
            ability.gameObject.AddComponent<WaterCycleRoomSmoke>();
            EditorSceneManager.SaveScene(scene,ScenePath);AssetDatabase.SaveAssets();
        }
        public static void Build()
        {
            Create();string path="Builds/WaterCycleRoom/WaterCycleRoom.exe";Directory.CreateDirectory(System.IO.Path.GetDirectoryName(path));
            var report=BuildPipeline.BuildPlayer(new BuildPlayerOptions{scenes=new[]{ScenePath,"Assets/Mumu/Scenes/WaterIceRoom.unity"},locationPathName=path,target=BuildTarget.StandaloneWindows64,options=BuildOptions.None});
            if(report.summary.result!=UnityEditor.Build.Reporting.BuildResult.Succeeded)throw new Exception("Cycle room build failed");
        }
    }
}

