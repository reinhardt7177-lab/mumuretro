using UnityEngine;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine.SceneManagement;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using Mumu.Planet;
using static Mumu.Editor.BuildWeightTemple;

namespace Mumu.Editor
{
    public static class BuildWaterSanctuary
    {
        public static void CreateAndBuild(){Create();BuildWaterTempleJourney.BuildExisting();}
        public static void CreateReviewAndBuild()
        {
            Create();
            InspectWaterDeityShading.Capture(System.IO.Path.GetFullPath("../../reports/2026-09-27/water-deity-v03/shading-fixed"));
            BuildWaterTempleJourney.BuildExisting();
        }
        public static void Create()
        {
            Prepare();
            var source=EditorSceneManager.OpenScene("Assets/Mumu/Scenes/PlanetExploration.unity");
            var actor=Object.FindFirstObjectByType<PlanetExplorer>();var camera=Object.FindFirstObjectByType<OrbitCamera>();
            var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Additive);SceneManager.SetActiveScene(scene);
            var player=Object.Instantiate(actor.gameObject).GetComponent<PlanetExplorer>();SceneManager.MoveGameObjectToScene(player.gameObject,scene);
            var orbit=Object.Instantiate(camera.gameObject).GetComponent<OrbitCamera>();SceneManager.MoveGameObjectToScene(orbit.gameObject,scene);
            foreach(var c in player.GetComponents<MonoBehaviour>())if(c!=player)Object.DestroyImmediate(c);
            var frame=new GameObject("Sanctuary floor datum").transform;
            player.ConfigureFlat(frame,orbit.transform,player.GetComponentInChildren<Animator>());player.EnableFlatCollisions();
            player.transform.SetPositionAndRotation(new Vector3(0,0,1),Quaternion.identity);
            orbit.ConfigureClimbing(null);orbit.Configure(player.transform);orbit.ConfigureFraming(20,5);
            EditorSceneManager.CloseScene(source,true);
            var room=new GameObject("Water sanctuary audience").AddComponent<WaterSanctuary>();room.player=player;room.orbit=orbit;
            WaterInteriorArt.Import("water-sanctuary-v01");room.deity=WaterDeityV03Art.Create();room.deity.position=new Vector3(0,.45f,12);
            WaterInteriorArt.Import("water-deity-halo-v03",room.deity);
            var droplet=WaterInteriorArt.Import("water-deity-droplet-v03",room.deity);droplet.localPosition=new Vector3(0,2.08f,-.88f);
            WaterDeityOfferingArt.Configure(droplet);
            var stone=Material("Sanctuary collision stone",new Color(.4f,.43f,.42f));
            var floor=Block("Sanctuary solid floor",new Vector3(0,-.3f,7),new Vector3(12,.6f,14),stone);floor.layer=9;floor.GetComponent<Renderer>().enabled=false;
            foreach(float x in new[]{-6f,6f})HiddenBlock(new Vector3(x,3,7),new Vector3(.2f,6,14),stone);
            foreach(float z in new[]{0f,14f})HiddenBlock(new Vector3(0,3,z),new Vector3(12,6,.2f),stone);
            foreach(float x in new[]{-1.6f,1.6f})HiddenBlock(new Vector3(x,.18f,6),new Vector3(.18f,.6f,8),stone);
            for(int i=0;i<3;i++){var step=HiddenBlock(new Vector3(0,.075f*(i+1),10.15f+i*.42f),new Vector3(3.8f,.15f*(i+1),.84f),stone);step.layer=9;}
            var dais=HiddenBlock(new Vector3(0,.225f,12),new Vector3(4,.45f,3),stone);dais.layer=9;
            var water=AssetDatabase.LoadAssetAtPath<Material>("Assets/Mumu/Generated/WaterInteriorV05/Living water and ice.mat");
            foreach(float x in new[]{-3.75f,3.75f})Block("Still sanctuary pool",new Vector3(x,-.04f,6),new Vector3(4.1f,.03f,7.8f),water,false);
            var canvas=Canvas("Sanctuary HUD");
            var top=Panel(canvas,"Sanctuary objective",new Vector2(.5f,1),new Vector2(.5f,1),new Vector2(0,-20),new Vector2(1100,65));
            room.heading=Text(top,"Heading","물의 성소",new Vector2(.5f,.5f),new Vector2(.5f,.5f),Vector2.zero,new Vector2(1080,60),25);
            var bottom=Panel(canvas,"Sanctuary dialogue",new Vector2(.5f,0),new Vector2(.5f,0),new Vector2(0,20),new Vector2(1100,130));
            room.speech=Text(bottom,"Speech","",new Vector2(.5f,.5f),new Vector2(.5f,.5f),new Vector2(-45,0),new Vector2(950,120),24);
            room.next=Button(bottom,"다음",new Vector2(1,.5f),new Vector2(-12,0),new Vector2(90,42));
            var fadeObject=new GameObject("Water wisdom departure fade",typeof(RectTransform),typeof(UnityEngine.UI.Image));
            fadeObject.transform.SetParent(canvas.transform,false);
            var fadeRect=(RectTransform)fadeObject.transform;fadeRect.anchorMin=Vector2.zero;fadeRect.anchorMax=Vector2.one;
            fadeRect.offsetMin=Vector2.zero;fadeRect.offsetMax=Vector2.zero;
            room.fade=fadeObject.GetComponent<UnityEngine.UI.Image>();room.fade.color=new Color(.015f,.13f,.18f,0);room.fade.raycastTarget=false;fadeObject.SetActive(false);
            var light=new GameObject("Sanctuary daylight").AddComponent<Light>();light.type=LightType.Directional;light.color=new Color(1,.88f,.73f);light.intensity=.85f;light.transform.rotation=Quaternion.Euler(45,-25,0);light.shadows=LightShadows.Soft;
            RenderSettings.ambientMode=UnityEngine.Rendering.AmbientMode.Trilight;RenderSettings.ambientSkyColor=new Color(.25f,.36f,.46f);RenderSettings.ambientEquatorColor=new Color(.18f,.24f,.28f);RenderSettings.ambientGroundColor=new Color(.10f,.14f,.15f);
            foreach(float x in new[]{-3f,3f}){var l=new GameObject("Sanctuary soft light").AddComponent<Light>();l.type=LightType.Point;l.transform.position=new Vector3(x,4,10);l.range=12;l.intensity=6;l.color=new Color(.76f,.86f,1);}
            var probe=new GameObject("Sanctuary metal reflections").AddComponent<ReflectionProbe>();
            probe.transform.position=new Vector3(0,3,11);probe.size=new Vector3(12,8,14);probe.boxProjection=true;
            probe.mode=UnityEngine.Rendering.ReflectionProbeMode.Realtime;probe.refreshMode=UnityEngine.Rendering.ReflectionProbeRefreshMode.ViaScripting;
            probe.timeSlicingMode=UnityEngine.Rendering.ReflectionProbeTimeSlicingMode.IndividualFaces;probe.resolution=128;probe.intensity=.7f;probe.nearClipPlane=.2f;probe.farClipPlane=25;
            probe.gameObject.AddComponent<TempleReflectionCapture>();
            var volume=new GameObject("Sanctuary highlight grading").AddComponent<Volume>();volume.isGlobal=true;
            const string gradePath="Assets/Mumu/Generated/SanctuaryGrade.asset";
            var grade=AssetDatabase.LoadAssetAtPath<VolumeProfile>(gradePath);
            if(grade==null){grade=ScriptableObject.CreateInstance<VolumeProfile>();AssetDatabase.CreateAsset(grade,gradePath);}
            if(!grade.TryGet<Tonemapping>(out var tone)){tone=grade.Add<Tonemapping>(true);AssetDatabase.AddObjectToAsset(tone,grade);}
            tone.mode.Override(TonemappingMode.ACES);
            if(!grade.TryGet<Bloom>(out var bloom)){bloom=grade.Add<Bloom>(true);AssetDatabase.AddObjectToAsset(bloom,grade);}
            bloom.intensity.Override(.10f);bloom.threshold.Override(1.3f);volume.sharedProfile=grade;EditorUtility.SetDirty(grade);
            BuildNotebook.Populate();room.gameObject.AddComponent<WaterSanctuarySmoke>();
            EditorSceneManager.SaveScene(scene,"Assets/Mumu/Scenes/WaterSanctuary.unity");AssetDatabase.SaveAssets();
        }
        static GameObject HiddenBlock(Vector3 p,Vector3 s,Material m){var go=Block("Sanctuary collision",p,s,m);go.GetComponent<Renderer>().enabled=false;return go;}
    }
}
