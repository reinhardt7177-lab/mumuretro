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
    public static class BuildWaterCollectionRoom
    {
        const string ScenePath="Assets/Mumu/Scenes/WaterCollectionRoom.unity";
        static Material stone,bronze,water;
        static GameObject Solid(string name,Vector3 p,Vector3 size,Material material,bool floor=false)
        {var go=Block(name,p,size,material);if(floor)go.layer=9;return go;}
        static WaterBraceletTarget Target(string name,Vector3 p,Vector3 size,float mass,bool plate=false)
        {
            var go=new GameObject(name);go.transform.position=p;var t=go.AddComponent<WaterBraceletTarget>();t.displayName=name;t.initialWater=mass;t.supportWater=4;t.collector=plate;
            var trigger=go.AddComponent<BoxCollider>();trigger.size=size+Vector3.up*.2f;trigger.isTrigger=true;
            var visual=Block(name+" surface",p,size,plate?bronze:water,false);visual.transform.SetParent(go.transform,true);t.surface=visual.GetComponent<Renderer>();return t;
        }
        static LineRenderer Line(string name,Material material,float width,params Vector3[] points)
        {var line=new GameObject(name).AddComponent<LineRenderer>();line.sharedMaterial=material;line.widthMultiplier=width;line.positionCount=points.Length;line.SetPositions(points);return line;}
        [MenuItem("Mumu/Build water temple collection room")]
        public static void Create()
        {
            BuildWaterBraceletLab.Create();var scene=SceneManager.GetActiveScene();var ability=UnityEngine.Object.FindFirstObjectByType<WaterBraceletLab>();
            UnityEngine.Object.DestroyImmediate(ability.GetComponent<WaterBraceletSmoke>());
            foreach(var go in scene.GetRootGameObjects())
            {
                if(go==ability.gameObject||go==ability.player.gameObject||go==ability.view.gameObject||go==ability.cuff.gameObject||go==ability.pedestal.gameObject||go.name=="Floor datum Y=0"||go.GetComponent<Canvas>()!=null||go.GetComponent<Light>()!=null||go.GetComponent<UnityEngine.EventSystems.EventSystem>()!=null||go.name.Contains("Notebook")||go.name.Contains("notebook"))continue;
                UnityEngine.Object.DestroyImmediate(go);
            }
            stone=Material("Collection limestone",new Color(.39f,.49f,.5f));bronze=Material("Collection brass",new Color(.7f,.51f,.21f),.55f);water=Material("Collection turquoise",new Color(.03f,.52f,.65f));water.EnableKeyword("_EMISSION");
            Solid("Lower working floor",new Vector3(0,-.4f,-.45f),new Vector3(18,.8f,13.1f),stone,true);
            foreach(float x in new[]{-9f,9f})Solid("Outer stone wall",new Vector3(x,3,3.55f),new Vector3(.3f,6,21.1f),stone);
            Solid("Entry boundary",new Vector3(0,1,-7),new Vector3(18,2,.3f),stone);
            Solid("Exit boundary",new Vector3(0,4,14.1f),new Vector3(18,8,.3f),stone);
            for(int i=0;i<16;i++)
            {float top=(i+1)*.15f;Solid("Fixed stair "+i,new Vector3(-6,top*.5f,-3+(i+.5f)*.32f),new Vector3(2,top,.32f),stone,true);}
            Solid("Management gallery",new Vector3(-2,2.25f,4.11f),new Vector3(10,.3f,3.98f),stone,true);
            foreach(float x in new[]{-6f,2f})Solid("Gallery grounded column",new Vector3(x,1.1f,5.6f),new Vector3(.5f,2.2f,.5f),stone);
            Solid("Far exit landing",new Vector3(0,2,12.6f),new Vector3(6,.8f,3),stone,true);
            foreach(float x in new[]{-2.7f,2.7f})Solid("Exit landing footing",new Vector3(x,.5f,12.6f),new Vector3(.5f,3,3),stone);
            var room=ability.gameObject.AddComponent<WaterCollectionRoom>();room.ability=ability;ability.collectionRoom=room;
            room.boiler=Target("가열 용기",new Vector3(1,.85f,-2.2f),new Vector3(1.6f,.3f,1.6f),4);
            Solid("Boiler footing",new Vector3(1,.32f,-2.2f),new Vector3(1.9f,.64f,1.9f),stone);
            room.recovery=Target("회수 펌프",new Vector3(4,.8f,-2.2f),new Vector3(1.5f,.3f,1.5f),0);
            Solid("Recovery footing",new Vector3(4,.30f,-2.2f),new Vector3(1.8f,.60f,1.8f),stone);
            room.collector=Target("이동 냉각판",new Vector3(-2.5f,4.2f,5.1f),new Vector3(1.2f,.2f,.9f),0,true);
            foreach(float x in new[]{-.4f,.4f})
            {var rod=Block("Sliding hanger",room.collector.transform.position+new Vector3(x,.25f,0),new Vector3(.04f,.5f,.04f),bronze,false);rod.transform.SetParent(room.collector.transform,true);}
            Line("Fixed collector rail",bronze,.10f,new Vector3(-3.6f,4.7f,5.1f),new Vector3(2.6f,4.7f,5.1f));
            foreach(float x in new[]{-3.6f,2.6f})Solid("Rail support",new Vector3(x,3.55f,5.1f),new Vector3(.13f,2.3f,.13f),bronze);
            room.tank=Target("부표 물받이",new Vector3(1,3.1f,5.1f),new Vector3(1.1f,.6f,1.1f),0);room.tank.acceptsPower=false;
            Solid("Upper tank plinth",new Vector3(1,2.6f,5.1f),new Vector3(1.4f,.4f,1.4f),stone);
            foreach(float x in new[]{.32f,1.68f})Solid("Receiver side",new Vector3(x,3.1f,5.1f),new Vector3(.12f,.7f,1.4f),stone);
            room.floatMarker=Block("Floating brass gauge",room.tank.transform.position+new Vector3(0,-.25f,0),new Vector3(.16f,.12f,.16f),bronze,false).transform;room.floatMarker.SetParent(room.tank.transform,true);
            room.railControl=new GameObject("Collector control handle").transform;room.railControl.position=new Vector3(-4,2.4f,4.2f);
            Solid("Handle support",new Vector3(-4.6f,2.75f,4.2f),new Vector3(.3f,.7f,.3f),bronze);
            WorldText(room.railControl,"집수판 손잡이 [E]",new Vector3(0,1.1f,0),4,.5f,3);
            WorldText(room.boiler.transform,"가열 용기",new Vector3(0,.8f,0),3,.5f,3);WorldText(room.recovery.transform,"회수 펌프 [E]",new Vector3(0,.8f,0),3,.5f,3);
            var bridge=Solid("Float-operated exit bridge",new Vector3(0,-2.15f,8.6f),new Vector3(2.8f,.3f,5),stone,true);room.exitBridge=bridge.transform;room.bridgeSupport=bridge.GetComponent<Collider>();room.bridgeSupport.enabled=false;
            foreach(float x in new[]{-1.65f,1.65f})foreach(float z in new[]{6.15f,11.05f})Solid("Bridge lifting guide",new Vector3(x,1,z),new Vector3(.18f,6,.18f),bronze).GetComponent<Collider>().enabled=false;
            Line("Steam conduit",bronze,.14f,new Vector3(1,.9f,-2.2f),new Vector3(1,4.9f,-2.2f),new Vector3(7,4.9f,-2.2f),new Vector3(7,4.9f,5.1f),new Vector3(-3.6f,4.9f,5.1f));
            foreach(float z in new[]{-2.2f,2,5.1f})Solid("Conduit grounded post",new Vector3(7,2.45f,z),new Vector3(.12f,4.9f,.12f),bronze);
            Line("Condensate catch gutter",bronze,.13f,new Vector3(-3.3f,2.65f,5.1f),new Vector3(3,2.65f,5.1f),new Vector3(4,2.65f,5.1f),new Vector3(4,.8f,-2.2f));
            room.preview=Line("Predicted drop location",bronze,.025f,Vector3.zero,Vector3.one);room.preview.enabled=false;
            room.steam=Line("Vapour transfer",water,.05f,new Vector3(1,.9f,-2.2f),new Vector3(1,4.9f,-2.2f),new Vector3(7,4.9f,-2.2f),new Vector3(7,4.9f,5.1f),new Vector3(-3.6f,4.9f,5.1f));
            room.drops=Line("Condensed falling water",water,.06f,Vector3.zero,Vector3.one);
            room.returnFlow=Line("Recovered water",water,.05f,new Vector3(4,2.65f,5.1f),new Vector3(4,.8f,-2.2f));room.steam.enabled=room.drops.enabled=room.returnFlow.enabled=false;
            ability.targets=new[]{room.boiler,room.collector,room.tank,room.recovery};ability.collector=room.collector;ability.recovery=room.recovery;ability.receiver=room.tank;
            ability.beam=Line("Bracelet ray",water,.025f,Vector3.zero,Vector3.one);ability.beam.enabled=false;
            ability.flow=Line("Unused default flow",water,.025f,Vector3.zero,Vector3.one);ability.flow.enabled=false;
            ability.player.EnableFlatCollisions();ability.player.Respawn(new Vector3(0,0,-5),Vector3.forward);
            ability.gameObject.AddComponent<WaterCollectionRoomSmoke>();
            EditorSceneManager.SaveScene(scene,ScenePath);AssetDatabase.SaveAssets();
        }
        public static void Build()
        {
            Create();string path="Builds/WaterCollectionRoom/WaterCollectionRoom.exe";Directory.CreateDirectory(Path.GetDirectoryName(path));
            var report=BuildPipeline.BuildPlayer(new BuildPlayerOptions{scenes=new[]{ScenePath,"Assets/Mumu/Scenes/WaterBraceletLab.unity","Assets/Mumu/Scenes/PlanetExploration.unity"},locationPathName=path,target=BuildTarget.StandaloneWindows64,options=BuildOptions.None});
            if(report.summary.result!=UnityEditor.Build.Reporting.BuildResult.Succeeded)throw new Exception("Collection room build failed");
        }
    }
}
