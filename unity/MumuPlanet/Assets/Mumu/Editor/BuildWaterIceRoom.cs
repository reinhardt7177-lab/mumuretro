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
    public static class BuildWaterIceRoom
    {
        const string ScenePath="Assets/Mumu/Scenes/WaterIceRoom.unity";
        static Material stone,gold,water;
        static GameObject Solid(string name,Vector3 p,Vector3 size,bool ground=false)
        {var go=Block(name,p,size,stone);if(ground)go.layer=9;return go;}
        static WaterBraceletTarget Target(string name,Vector3 p,Vector3 size,float mass,bool frozen=false)
        {
            var root=new GameObject(name);root.transform.position=p;
            var target=root.AddComponent<WaterBraceletTarget>();target.displayName=name;target.initialWater=mass;target.initiallyFrozen=frozen;target.supportWater=4;
            var selection=root.AddComponent<BoxCollider>();selection.size=size+Vector3.up*.25f;selection.isTrigger=true;
            var visual=Block(name+" surface",p,size,water,false);visual.transform.SetParent(root.transform,true);
            target.surface=visual.GetComponent<Renderer>();visual.layer=9;target.iceSupport=visual.AddComponent<BoxCollider>();target.iceSupport.enabled=false;
            return target;
        }
        [MenuItem("Mumu/Build water temple ice crossing")]
        public static void Create()
        {
            BuildWaterBraceletLab.Create();
            var scene=SceneManager.GetActiveScene();var ability=UnityEngine.Object.FindFirstObjectByType<WaterBraceletLab>();
            UnityEngine.Object.DestroyImmediate(ability.GetComponent<WaterBraceletSmoke>());
            foreach(var go in scene.GetRootGameObjects())
            {
                if(go==ability.gameObject||go==ability.player.gameObject||go==ability.view.gameObject||go==ability.cuff.gameObject||go==ability.pedestal.gameObject||
                    go.name=="Floor datum Y=0"||go.GetComponent<Canvas>()!=null||go.GetComponent<Light>()!=null||go.GetComponent<UnityEngine.EventSystems.EventSystem>()!=null||go.name.Contains("notebook")||go.name.Contains("Notebook"))continue;
                UnityEngine.Object.DestroyImmediate(go);
            }
            stone=Material("Ice crossing stone",new Color(.37f,.46f,.47f));gold=Material("Ice crossing brass",new Color(.73f,.53f,.22f),.6f);water=Material("Ice crossing water",new Color(.03f,.48f,.62f));water.EnableKeyword("_EMISSION");
            Solid("Entrance bank",new Vector3(0,-.4f,-3.5f),new Vector3(14,.8f,7),true);
            Solid("Far bank",new Vector3(0,-.4f,8.5f),new Vector3(14,.8f,7),true);
            foreach(float x in new[]{-7f,7f})Solid("Continuous side wall",new Vector3(x,1.5f,2.5f),new Vector3(.4f,3,19));
            Solid("Entrance boundary",new Vector3(0,1,-7),new Vector3(14,2,.3f));
            Solid("Rear boundary",new Vector3(0,2,12),new Vector3(14,4,.4f));
            foreach(float x in new[]{-4.25f,4.25f})Solid("Exit facade",new Vector3(x,2,10),new Vector3(5.5f,4,.5f));
            var room=ability.gameObject.AddComponent<WaterIceRoom>();ability.iceRoom=room;room.ability=ability;
            room.supply=Target("얼음 저수조",new Vector3(-3,.82f,-1.7f),new Vector3(1.5f,.25f,1.5f),4,true);
            Solid("Reservoir plinth",new Vector3(-3,.34f,-1.7f),new Vector3(1.8f,.68f,1.8f));
            room.trough=Target("얼음길 도랑",new Vector3(0,-.12f,2.5f),new Vector3(2.8f,.24f,5),0);
            room.recovery=Target("회수조",new Vector3(-5,.65f,-3.7f),new Vector3(1.2f,.2f,1.2f),0);
            Solid("Recovery base",new Vector3(-5,.27f,-3.7f),new Vector3(1.5f,.54f,1.5f));
            foreach(float x in new[]{-1.55f,1.55f})Solid("Trough supporting lip",new Vector3(x,-.5f,2.5f),new Vector3(.25f,.6f,5));
            Block("Deep receiving basin",new Vector3(0,-3.8f,2.5f),new Vector3(13,.2f,5),water,false);
            var hinge=new GameObject("Return bridge hinge").transform;hinge.position=new Vector3(-4,0,5);
            var deck=Solid("Permanent return bridge",new Vector3(-4,-.15f,2.5f),new Vector3(1.8f,.3f,5),true);deck.transform.SetParent(hinge,true);room.bridge=hinge;room.bridgeSupport=deck.GetComponent<Collider>();room.bridgeSupport.enabled=false;hinge.localRotation=Quaternion.Euler(90,0,0);
            var gate=Solid("Water exit gate",new Vector3(0,1.5f,10),new Vector3(3,3,.4f));gate.GetComponent<Renderer>().sharedMaterial=gold;room.gate=gate.transform;room.gateBlock=gate.GetComponent<Collider>();
            room.pump=room.recovery.transform;
            ability.targets=new[]{room.supply,room.trough,room.recovery};ability.recovery=room.recovery;ability.collector=null;ability.receiver=null;
            room.feed=Path("Supply water channel",water,.1f,new[]{new Vector3(-3,.8f,-1),new Vector3(-3,.1f,-.5f),new Vector3(0,-.1f,-.5f),new Vector3(0,-.1f,0)});
            room.returnLine=Path("Captured vapour return",water,.06f,new[]{new Vector3(0,1,2.5f),new Vector3(-5,2,2.5f),new Vector3(-5,2,-3.7f),room.recovery.transform.position});
            Path("Supported bronze capture pipe",gold,.12f,new[]{new Vector3(-5,0,2.5f),new Vector3(-5,2,2.5f),new Vector3(-5,2,-3.7f),new Vector3(-5,0,-3.7f)}).enabled=true;
            ability.beam=Path("Bracelet ray",water,.025f,new[]{Vector3.zero,Vector3.one});ability.flow=Path("Unused lab flow",water,.025f,new[]{Vector3.zero,Vector3.one});
            WorldText(room.supply.transform,"얼음 저수조",new Vector3(0,.8f,0),3,.5f,3);
            WorldText(room.recovery.transform,"회수 펌프 [E]",new Vector3(0,.8f,0),3,.5f,3);
            var sign=new GameObject("Exit inscription frame").transform;sign.position=new Vector3(0,3.4f,9.6f);
            WorldText(sign,"수문 [E]",Vector3.zero,3,.5f,3);
            ability.player.EnableFlatCollisions();ability.player.Respawn(new Vector3(0,0,-5),Vector3.forward);
            ability.gameObject.AddComponent<WaterIceRoomSmoke>();
            EditorSceneManager.SaveScene(scene,ScenePath);AssetDatabase.SaveAssets();
        }
        static LineRenderer Path(string name,Material m,float width,Vector3[] points)
        {var line=new GameObject(name).AddComponent<LineRenderer>();line.sharedMaterial=m;line.positionCount=points.Length;line.SetPositions(points);line.widthMultiplier=width;line.enabled=false;return line;}
        public static void Build()
        {
            Create();string path="Builds/WaterIceRoom/WaterIceRoom.exe";Directory.CreateDirectory(System.IO.Path.GetDirectoryName(path));
            var report=BuildPipeline.BuildPlayer(new BuildPlayerOptions{scenes=new[]{ScenePath,"Assets/Mumu/Scenes/PlanetExploration.unity"},locationPathName=path,target=BuildTarget.StandaloneWindows64,options=BuildOptions.None});
            if(report.summary.result!=UnityEditor.Build.Reporting.BuildResult.Succeeded)throw new Exception("Ice room build failed");
        }
    }
}
