using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.Rendering;
using Mumu.Planet;
using static Mumu.Editor.BuildWeightTemple;

namespace Mumu.Editor
{
    public static class BuildWaterBraceletLab
    {
        const string Root="Assets/Mumu/";
        const string ScenePath=Root+"Scenes/WaterBraceletLab.unity";
        static Material stone,gold,water,ice;
        static Transform Shape(PrimitiveType type,string name,Vector3 p,Vector3 scale,Material m,Transform parent=null)
        {
            var go=GameObject.CreatePrimitive(type);go.name=name;go.transform.SetParent(parent,false);
            go.transform.localPosition=p;go.transform.localScale=scale;go.GetComponent<Renderer>().sharedMaterial=m;
            UnityEngine.Object.DestroyImmediate(go.GetComponent<Collider>());return go.transform;
        }
        static WaterBraceletTarget Basin(string name,Vector3 p,float amount,bool plate=false)
        {
            var root=new GameObject(name);root.transform.position=p;
            var t=root.AddComponent<WaterBraceletTarget>();t.displayName=name;t.initialWater=amount;t.collector=plate;
            var hit=root.AddComponent<BoxCollider>();hit.size=new Vector3(1.8f,.4f,1.4f);hit.isTrigger=true;
            var surface=Shape(PrimitiveType.Cube,"Water surface",Vector3.zero,new Vector3(1.65f,.15f,1.25f),plate?gold:water,root.transform);
            t.surface=surface.GetComponent<Renderer>();
            if(!plate)
            {
                var support=surface.gameObject.AddComponent<BoxCollider>();surface.gameObject.layer=9;support.enabled=false;t.iceSupport=support;
                foreach(float x in new[]{-1f,1f})Block(name+" stone rim",p+new Vector3(x,-.1f,0),new Vector3(.2f,.4f,1.7f),stone);
                foreach(float z in new[]{-.8f,.8f})Block(name+" stone rim",p+new Vector3(0,-.1f,z),new Vector3(2.2f,.4f,.15f),stone);
                Block(name+" grounded base",new Vector3(p.x,(p.y-.22f)/2,p.z),new Vector3(2.2f,Mathf.Max(.1f,p.y-.22f),1.7f),stone);
            }
            else Block("Collector supported pedestal",new Vector3(p.x,p.y/2,p.z),new Vector3(.3f,p.y,.3f),gold);
            WorldText(root.transform,name,new Vector3(0,.65f,0),3,.5f,3);
            return t;
        }
        static LineRenderer Line(string name,Material material,int count,float width)
        {
            var l=new GameObject(name).AddComponent<LineRenderer>();l.sharedMaterial=material;l.positionCount=count;l.widthMultiplier=width;l.enabled=false;return l;
        }
        [MenuItem("Mumu/Build water bracelet test room")]
        public static void Create()
        {
            Prepare();
            var source=EditorSceneManager.OpenScene(Root+"Scenes/PlanetExploration.unity");
            var actor=UnityEngine.Object.FindFirstObjectByType<PlanetExplorer>();var camera=UnityEngine.Object.FindFirstObjectByType<OrbitCamera>();
            var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Additive);SceneManager.SetActiveScene(scene);
            var player=UnityEngine.Object.Instantiate(actor.gameObject).GetComponent<PlanetExplorer>();SceneManager.MoveGameObjectToScene(player.gameObject,scene);
            var orbit=UnityEngine.Object.Instantiate(camera.gameObject).GetComponent<OrbitCamera>();SceneManager.MoveGameObjectToScene(orbit.gameObject,scene);
            foreach(var c in player.GetComponents<MonoBehaviour>())if(c!=player)UnityEngine.Object.DestroyImmediate(c);
            var frame=new GameObject("Floor datum Y=0").transform;
            player.transform.SetPositionAndRotation(new Vector3(0,0,-5),Quaternion.identity);
            player.ConfigureFlat(frame,orbit.transform,player.GetComponentInChildren<Animator>());
            orbit.ConfigureClimbing(null);orbit.Configure(player.transform);orbit.ConfigureFraming(25,7);
            EditorSceneManager.CloseScene(source,true);
            stone=Material("Water lab limestone",new Color(.40f,.48f,.48f));
            gold=Material("Water lab bronze",new Color(.70f,.46f,.17f),.65f);
            water=Material("Water lab turquoise",new Color(.05f,.55f,.65f));water.EnableKeyword("_EMISSION");
            ice=Material("Water lab frost",new Color(.55f,.88f,1));
            var floor=Block("Foundation top Y=0",new Vector3(0,-.25f,1),new Vector3(16,.5f,16),stone);floor.layer=9;
            foreach(float x in new[]{-8f,8f})Block("Side wall",new Vector3(x,2,1),new Vector3(.4f,4,16),stone);
            Block("Rear wall",new Vector3(0,2,9),new Vector3(16,4,.4f),stone);
            Block("Entrance wall",new Vector3(0,1,-7),new Vector3(16,2,.4f),stone);
            for(int z=-5;z<=7;z+=4)foreach(float x in new[]{-7f,7f})
            {Shape(PrimitiveType.Cylinder,"Grounded column",new Vector3(x,2,z),new Vector3(.65f,2,.65f),stone);Shape(PrimitiveType.Cylinder,"Column plinth",new Vector3(x,.12f,z),new Vector3(1,.12f,1),gold);}
            var altar=Block("Bracelet altar",new Vector3(-3,.55f,-3),new Vector3(1.3f,1.1f,1.3f),stone).transform;
            var cuff=new GameObject("Water bracelet prototype").transform;cuff.position=altar.position+Vector3.up*.7f;
            for(int i=0;i<20;i++)
            {float a=i*Mathf.PI*2/20;var part=Shape(PrimitiveType.Cube,"Bronze cuff band",new Vector3(Mathf.Cos(a)*.6f,0,Mathf.Sin(a)*.5f),new Vector3(.20f,.22f,.08f),gold,cuff);part.localRotation=Quaternion.Euler(0,-a*Mathf.Rad2Deg,0);}
            Shape(PrimitiveType.Sphere,"Water jewel",new Vector3(0,.07f,-.53f),new Vector3(.22f,.30f,.12f),water,cuff);cuff.localScale=Vector3.one*.35f;
            var lab=new GameObject("Water bracelet ability trial").AddComponent<WaterBraceletLab>();
            lab.player=player;lab.view=orbit.GetComponent<Camera>();lab.pose=player.GetComponentInChildren<NavigatorPose>();
            lab.wrist=player.GetComponentsInChildren<Transform>().First(t=>t.name=="LeftHand");lab.cuff=cuff;lab.pedestal=altar;
            var pool=Basin("학습 수조",new Vector3(-3,.8f,1),2);
            var trough=Basin("지지턱 도랑",new Vector3(0,.4f,2),2);
            lab.collector=Basin("냉기를 저장하는 집수판",new Vector3(3,1.7f,3),0,true);
            lab.receiver=Basin("집수 수조",new Vector3(3,.7f,5.4f),0);
            lab.recovery=Basin("회수 펌프",new Vector3(-3,.7f,5.4f),0);
            // Surface fullness is visual capacity; initial mass of the two receivers remains zero.
            lab.targets=new[]{pool,trough,lab.collector,lab.receiver,lab.recovery};
            lab.collectorDrop=new GameObject("Collector outlet").transform;lab.collectorDrop.position=new Vector3(3,2.1f,5.4f);
            lab.returnDrop=new GameObject("Return outlet").transform;lab.returnDrop.position=new Vector3(-3,2.1f,5.4f);
            foreach(float x in new[]{-3f,3f})Shape(PrimitiveType.Cylinder,"Supported return pipe",new Vector3(x,1.3f,5.4f),new Vector3(.10f,1.3f,.10f),gold);
            Shape(PrimitiveType.Cube,"Overhead capture conduit",new Vector3(0,2.6f,5.4f),new Vector3(6.1f,.12f,.12f),gold);
            lab.beam=Line("Bracelet connection",water,2,.025f);lab.flow=Line("Captured water path",ice,4,.055f);
            var canvas=Canvas("Water ability HUD");
            var heading=Panel(canvas,"Objective",new Vector2(.5f,1),new Vector2(.5f,1),new Vector2(0,-20),new Vector2(1000,65));
            lab.instruction=Text(heading,"Objective text","물의 팔찌 시험실",new Vector2(.5f,.5f),new Vector2(.5f,.5f),Vector2.zero,new Vector2(970,60),26);
            var footer=Panel(canvas,"Ability instructions",new Vector2(.5f,0),new Vector2(.5f,0),new Vector2(0,20),new Vector2(1100,130));
            lab.status=Text(footer,"Instructions","",new Vector2(.5f,.5f),new Vector2(.5f,.5f),Vector2.zero,new Vector2(1080,125),22);
            var light=new GameObject("Cold daylight",typeof(Light)).GetComponent<Light>();light.type=LightType.Directional;light.intensity=2;light.transform.rotation=Quaternion.Euler(45,-25,0);light.shadows=LightShadows.Soft;
            RenderSettings.ambientMode=AmbientMode.Flat;RenderSettings.ambientLight=new Color(.38f,.48f,.55f);
            BuildNotebook.Populate();
            lab.gameObject.AddComponent<WaterBraceletSmoke>();
            EditorSceneManager.SaveScene(scene,ScenePath);AssetDatabase.SaveAssets();
        }
        public static void Build()
        {
            Create();
            string path="Builds/WaterBraceletLab/WaterBraceletLab.exe";Directory.CreateDirectory(Path.GetDirectoryName(path));
            var report=BuildPipeline.BuildPlayer(new BuildPlayerOptions{scenes=new[]{ScenePath},locationPathName=path,target=BuildTarget.StandaloneWindows64,options=BuildOptions.None});
            if(report.summary.result!=UnityEditor.Build.Reporting.BuildResult.Succeeded)throw new Exception("Water bracelet build failed");
        }
    }
}
