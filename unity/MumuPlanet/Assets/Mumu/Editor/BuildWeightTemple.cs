using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.SceneManagement;
using UnityEngine.InputSystem.UI;
using UnityEngine.EventSystems;
using TMPro;
using Mumu.Planet;

namespace Mumu.Editor
{
    public static class BuildWeightTemple
    {
        const string Root="Assets/Mumu/",Output=Root+"Generated/Balance/";
        [Serializable] class MaterialInfo { public string name;public float[] color;public float metal; }
        [Serializable] class Palette { public MaterialInfo[] materials; }
        internal static Dictionary<string,Material> materials;
        static TMP_FontAsset font;
        static Color Ink=new Color(.025f,.075f,.09f,.96f),Gold=new Color(.93f,.78f,.46f),Paper=new Color(.97f,.94f,.84f);
        internal static Material Material(string name,Color color,float metal=0)
        {
            string path=Output+name+".mat";var mat=AssetDatabase.LoadAssetAtPath<Material>(path);
            if(mat==null){mat=new Material(Shader.Find("Universal Render Pipeline/Lit"));AssetDatabase.CreateAsset(mat,path);}
            mat.color=color;mat.SetFloat("_Metallic",metal);mat.SetFloat("_Smoothness",.3f);EditorUtility.SetDirty(mat);return mat;
        }
        internal static void Prepare()
        {
            Directory.CreateDirectory(Output);AssetDatabase.Refresh();
            if(Resources.Load<TMP_Settings>("TMP Settings")==null)throw new InvalidOperationException("TMP essentials must finish importing before scene generation. Use RunBatch.");
            font=AssetDatabase.LoadAssetAtPath<TMP_FontAsset>(Output+"TempleKorean.asset");
            if(font==null)
            {
                font=TMP_FontAsset.CreateFontAsset(AssetDatabase.LoadAssetAtPath<Font>(Root+"Fonts/NanumGothic-Regular.ttf"),48,5,UnityEngine.TextCore.LowLevel.GlyphRenderMode.SDFAA,2048,2048,AtlasPopulationMode.Dynamic);
                font.name="Temple Korean";AssetDatabase.CreateAsset(font,Output+"TempleKorean.asset");
                var text=string.Join("",Directory.GetFiles(Root,"*.cs",SearchOption.AllDirectories).Select(File.ReadAllText))+"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789·→←◇○△☆☽";
                string glyphs=new string(text.Where(c=>!char.IsControl(c)).Distinct().ToArray());
                font.TryAddCharacters(glyphs,out string missing);Debug.Log("TEMPLE_FONT_MISSING "+missing);
                font.atlasPopulationMode=AtlasPopulationMode.Static;
                foreach(var atlas in font.atlasTextures)AssetDatabase.AddObjectToAsset(atlas,font);
                AssetDatabase.AddObjectToAsset(font.material,font);EditorUtility.SetDirty(font);
            }
            // Extend the existing atlas when later rooms add Korean instructions.
            font.atlasPopulationMode=AtlasPopulationMode.Dynamic;
            var authored=string.Join("",Directory.GetFiles(Root,"*.cs",SearchOption.AllDirectories).Select(File.ReadAllText));
            font.TryAddCharacters(new string(authored.Where(c=>!char.IsControl(c)).Distinct().ToArray()),out string unavailable);
            font.atlasPopulationMode=AtlasPopulationMode.Static;EditorUtility.SetDirty(font);
            foreach(var atlas in font.atlasTextures)EditorUtility.SetDirty(atlas);
            materials=new Dictionary<string,Material>();
            var palette=JsonUtility.FromJson<Palette>(File.ReadAllText(Root+"Models/Balance/materials.json"));
            foreach(var info in palette.materials)
            {
                var color=new Color(info.color[0],info.color[1],info.color[2],1).gamma;
                var mat=Material(info.name,color,info.metal);
                if(info.name.StartsWith("Turquoise")){mat.EnableKeyword("_EMISSION");mat.SetColor("_EmissionColor",color*.7f);}
                materials[info.name]=mat;
            }
        }
        internal static Transform Part(string name,Vector3 position,Transform parent=null)
        {
            var root=(GameObject)PrefabUtility.InstantiatePrefab(AssetDatabase.LoadAssetAtPath<GameObject>(Root+"Models/Balance/"+name+".fbx"));
            PrefabUtility.UnpackPrefabInstance(root,PrefabUnpackMode.Completely,InteractionMode.AutomatedAction);
            var wrapper=new GameObject(name+" Unity pivot").transform;wrapper.SetParent(parent,false);wrapper.localPosition=position;
            root.name=name;root.transform.SetParent(wrapper,false);
            foreach(var renderer in root.GetComponentsInChildren<Renderer>())
            {
                renderer.sharedMaterials=renderer.sharedMaterials.Select(m=>materials.TryGetValue(m.name,out var replacement)?replacement:materials["Carved limestone"]).ToArray();
                renderer.receiveShadows=true;renderer.shadowCastingMode=ShadowCastingMode.On;
            }
            return wrapper;
        }
        static Transform Pivot(string name,Transform visual,Transform parent)
        {
            var pivot=new GameObject(name).transform;pivot.position=visual.position;pivot.SetParent(parent,true);visual.SetParent(pivot,true);return pivot;
        }
        static Transform Find(Transform root,string name)=>root.GetComponentsInChildren<Transform>().First(t=>t.name==name);
        internal static GameObject Block(string name,Vector3 position,Vector3 size,Material material,bool solid=true)
        {
            var obj=GameObject.CreatePrimitive(PrimitiveType.Cube);obj.name=name;obj.transform.position=position;obj.transform.localScale=size;obj.GetComponent<Renderer>().sharedMaterial=material;
            if(solid)obj.layer=8;else UnityEngine.Object.DestroyImmediate(obj.GetComponent<Collider>());return obj;
        }
        internal static RectTransform Rect(string name,Transform parent,Vector2 anchor,Vector2 pivot,Vector2 position,Vector2 size)
        {
            var rect=new GameObject(name,typeof(RectTransform)).GetComponent<RectTransform>();rect.SetParent(parent,false);rect.anchorMin=rect.anchorMax=anchor;rect.pivot=pivot;rect.anchoredPosition=position;rect.sizeDelta=size;return rect;
        }
        internal static Transform Canvas(string name)
        {
            var root=new GameObject(name,typeof(Canvas),typeof(UnityEngine.UI.CanvasScaler),typeof(UnityEngine.UI.GraphicRaycaster));root.GetComponent<Canvas>().renderMode=RenderMode.ScreenSpaceOverlay;
            var scaler=root.GetComponent<UnityEngine.UI.CanvasScaler>();scaler.uiScaleMode=UnityEngine.UI.CanvasScaler.ScaleMode.ScaleWithScreenSize;scaler.referenceResolution=new Vector2(1440,900);scaler.matchWidthOrHeight=.5f;return root.transform;
        }
        internal static TextMeshProUGUI Text(Transform parent,string name,string content,Vector2 anchor,Vector2 pivot,Vector2 pos,Vector2 size,int textSize=22)
        {
            var rect=Rect(name,parent,anchor,pivot,pos,size);var text=rect.gameObject.AddComponent<TextMeshProUGUI>();text.font=font;text.fontSize=textSize;text.color=Paper;text.alignment=TextAlignmentOptions.Center;text.text=content;text.raycastTarget=false;
            text.margin=new Vector4(12,6,12,6);return text;
        }
        internal static Transform Panel(Transform parent,string name,Vector2 anchor,Vector2 pivot,Vector2 pos,Vector2 size)
        {
            var rect=Rect(name,parent,anchor,pivot,pos,size);rect.gameObject.AddComponent<UnityEngine.UI.Image>().color=Ink;return rect;
        }
        internal static UnityEngine.UI.Button Button(Transform parent,string label,Vector2 anchor,Vector2 pos,Vector2 size)
        {
            var rect=Rect(label,parent,anchor,anchor,pos,size);var image=rect.gameObject.AddComponent<UnityEngine.UI.Image>();image.color=new Color(.08f,.20f,.22f);var button=rect.gameObject.AddComponent<UnityEngine.UI.Button>();button.targetGraphic=image;
            Text(rect,label+" text",label,new Vector2(.5f,.5f),new Vector2(.5f,.5f),Vector2.zero,size,20);return button;
        }
        internal static void WorldText(Transform parent,string content,Vector3 position,float width=1.2f,float height=.5f,float size=3.5f)
        {
            var obj=new GameObject("Inscription "+content,typeof(TextMeshPro));obj.transform.SetParent(parent,false);obj.transform.localPosition=position;obj.transform.localRotation=Quaternion.identity;
            var text=obj.GetComponent<TextMeshPro>();text.font=font;text.text=content;text.fontSize=size;text.color=Gold;text.alignment=TextAlignmentOptions.Center;text.rectTransform.sizeDelta=new Vector2(width,height);
        }
        [MenuItem("Mumu/Build weight temple first room")]
        public static void Create()
        {
            Prepare();
            var exploration=EditorSceneManager.OpenScene(Root+"Scenes/PlanetExploration.unity");
            var sourcePlayer=UnityEngine.Object.FindFirstObjectByType<PlanetExplorer>();var sourceCamera=UnityEngine.Object.FindFirstObjectByType<OrbitCamera>();
            var existing=UnityEngine.Object.FindFirstObjectByType<TempleEntrance>();
            if(existing==null)
            {
                var ground=UnityEngine.Object.FindFirstObjectByType<PlanetSurface>();
                var marker=Part("plinth",Vector3.zero);marker.name="Weight temple entrance";
                marker.position=ground.Point(sourcePlayer.transform.position+sourcePlayer.transform.forward*6);
                marker.rotation=Quaternion.LookRotation(Vector3.ProjectOnPlane(sourcePlayer.transform.forward,marker.position.normalized).normalized,marker.position.normalized);marker.localScale=Vector3.one*1.5f;
                WorldText(marker,"무게의 신전",new Vector3(0,2,0),3,.6f,4);
                var canvas=Canvas("Temple entrance HUD");var panel=Panel(canvas,"Entrance",new Vector2(.5f,0),new Vector2(.5f,0),new Vector2(0,24),new Vector2(620,58));
                var text=Text(panel,"Prompt","무게의 신전",new Vector2(.5f,.5f),new Vector2(.5f,.5f),Vector2.zero,new Vector2(610,55));
                marker.gameObject.AddComponent<TempleEntrance>().Configure(sourcePlayer,text);
                EditorSceneManager.SaveScene(exploration);
            }
            BuildTempleExterior.Populate(UnityEngine.Object.FindFirstObjectByType<TempleEntrance>());
            BuildNotebook.Populate();
            EditorSceneManager.SaveScene(exploration);
            var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Additive);SceneManager.SetActiveScene(scene);
            var player=UnityEngine.Object.Instantiate(sourcePlayer.gameObject).GetComponent<PlanetExplorer>();player.name="Temple navigator";SceneManager.MoveGameObjectToScene(player.gameObject,scene);
            var camera=UnityEngine.Object.Instantiate(sourceCamera.gameObject).GetComponent<OrbitCamera>();SceneManager.MoveGameObjectToScene(camera.gameObject,scene);
            UnityEngine.Object.DestroyImmediate(player.GetComponent<ExplorationSmoke>());
            var floor=new GameObject("Flat temple floor").transform;
            player.transform.SetPositionAndRotation(new Vector3(0,0,-7.2f),Quaternion.identity);
            player.ConfigureFlat(floor,camera.transform,player.GetComponentInChildren<Animator>());
            EditorSceneManager.CloseScene(exploration,true);
            Part("hall_order",Vector3.zero);Part("hall_corridor",new Vector3(0,0,11));Part("hall_corridor",new Vector3(0,0,-11));
            var stone=materials["Carved limestone"];var dark=materials["Midnight teal"];var brass=materials["Aged brass"];
            Block("West wall",new Vector3(-7.1f,3,0),new Vector3(.4f,6,18),dark);
            Block("East wall",new Vector3(7.1f,3,0),new Vector3(.4f,6,18),dark);
            foreach(int side in new[]{-1,1})Block("Entry pier",new Vector3(side*4.85f,3,-9.1f),new Vector3(4.6f,6,.4f),dark);
            Block("Entry corridor west",new Vector3(-2.6f,2,-11),new Vector3(.3f,4,4),dark);Block("Entry corridor east",new Vector3(2.6f,2,-11),new Vector3(.3f,4,4),dark);
            Block("Entry backdrop",new Vector3(0,2,-13.2f),new Vector3(5.2f,4,.3f),dark);
            foreach(int side in new[]{-1,1})Block("Gate pier",new Vector3(side*4.85f,3,8.85f),new Vector3(4.6f,6,.45f),stone);
            Block("Gate lintel",new Vector3(0,5.6f,8.85f),new Vector3(5.2f,1.2f,.5f),stone);
            Block("Corridor west",new Vector3(-2.6f,2,11),new Vector3(.3f,4,4),dark);Block("Corridor east",new Vector3(2.6f,2,11),new Vector3(.3f,4,4),dark);
            Block("End of first room",new Vector3(0,2,13),new Vector3(5.2f,4,.3f),dark);
            var room=new GameObject("Weight order trial").AddComponent<BalanceRoom>();
            var boxes=new Transform[5];var pads=new Transform[5];string[] symbols={"D","A","E","B","C"};
            for(int i=0;i<5;i++)
            {
                boxes[i]=Part("crate",Vector3.zero,room.transform);WorldText(boxes[i],symbols[i],new Vector3(0,.4f,-.412f),.5f,.4f,3.5f);
                pads[i]=Part("plinth",new Vector3((i-2)*2,0,5.3f));pads[i].localScale=new Vector3(1,.5f,1);
                WorldText(pads[i],(i+1).ToString(),new Vector3(0,1.1f,-.86f),.8f,.55f,4.5f);
            }
            var scale=Part("scale",Vector3.zero);var beamArt=Find(scale,"scale_beam");var panArt=new[]{Find(scale,"pan_left"),Find(scale,"pan_right")}.OrderBy(p=>p.position.x).ToArray();
            var beam=Pivot("Scale Unity rotation",beamArt,room.transform);
            var left=Pivot("Left pan Unity rotation",panArt[0],beam);var right=Pivot("Right pan Unity rotation",panArt[1],beam);
            var panSlots=new Transform[2];for(int i=0;i<2;i++){panSlots[i]=new GameObject("Pan slot").transform;panSlots[i].SetParent(i==0?left:right,false);panSlots[i].localPosition=new Vector3(0,-.88f,0);}
            Block("Scale pedestal collider",new Vector3(0,.5f,0),new Vector3(.75f,1,.75f),dark).GetComponent<Renderer>().enabled=false;
            var leaves=new[]{Part("door_leaf",new Vector3(-1.25f,0,8.65f)),Part("door_leaf",new Vector3(1.25f,0,8.65f))};
            var blocker=Block("Closed gate collision",new Vector3(0,2.4f,8.65f),new Vector3(5,4.8f,.5f),dark);blocker.GetComponent<Renderer>().enabled=false;
            WorldText(floor,"두 판의 균형으로",new Vector3(0,2.3f,12.7f),4,.6f,4);
            var hud=Canvas("Temple HUD");
            var top=Panel(hud,"Objective",new Vector2(.5f,1),new Vector2(.5f,1),new Vector2(0,-20),new Vector2(790,96));
            var goal=Text(top,"Goal","무게의 회랑",new Vector2(.5f,.5f),new Vector2(.5f,.5f),Vector2.zero,new Vector2(780,90),24);
            var bottom=Panel(hud,"Guidance",new Vector2(.5f,0),new Vector2(.5f,0),new Vector2(0,22),new Vector2(870,122));
            var prompt=Text(bottom,"Interaction","E 상자 들기",new Vector2(.5f,1),new Vector2(.5f,1),new Vector2(0,-4),new Vector2(840,46),24);prompt.color=Gold;
            var info=Text(bottom,"Feedback","",new Vector2(.5f,0),new Vector2(.5f,0),new Vector2(0,6),new Vector2(845,68),20);
            var sidePanel=Panel(hud,"Difficulty",Vector2.zero,Vector2.zero,new Vector2(22,190),new Vector2(210,228));
            Text(sidePanel,"Difficulty heading","상자 수 선택\n선택하면 배치 초기화",new Vector2(.5f,1),new Vector2(.5f,1),new Vector2(0,-8),new Vector2(205,68),18);
            var choices=new UnityEngine.UI.Button[3];for(int i=0;i<3;i++)choices[i]=Button(sidePanel,(i+3)+"개 도전",new Vector2(.5f,1),new Vector2(0,-83-i*47),new Vector2(176,39));
            var reset=Button(hud,"다시 놓기",new Vector2(1,1),new Vector2(-22,-20),new Vector2(150,48));
            var exit=Button(hud,"행성으로",new Vector2(1,1),new Vector2(-22,-78),new Vector2(150,48));
            var events=new GameObject("Temple input",typeof(EventSystem),typeof(InputSystemUIInputModule));events.GetComponent<InputSystemUIInputModule>().AssignDefaultActions();
            room.Configure(player,boxes,pads,panSlots,beam,left,right,leaves,blocker.GetComponent<Collider>(),goal,info,prompt,choices,reset,exit);
            new GameObject("Temple validation").AddComponent<TempleSmoke>().Configure(room,camera,player.GetComponentInChildren<Animator>());
            var light=new GameObject("Temple skylight").AddComponent<Light>();light.type=LightType.Directional;light.color=new Color(1,.87f,.67f);light.intensity=1.5f;light.shadows=LightShadows.Soft;light.transform.rotation=Quaternion.Euler(48,-25,0);RenderSettings.sun=light;
            RenderSettings.ambientMode=AmbientMode.Trilight;RenderSettings.ambientSkyColor=new Color(.40f,.53f,.58f);RenderSettings.ambientEquatorColor=new Color(.32f,.37f,.36f);RenderSettings.ambientGroundColor=new Color(.18f,.19f,.18f);RenderSettings.fog=false;
            camera.GetComponent<Camera>().backgroundColor=new Color(.035f,.085f,.12f);camera.Configure(player.transform);
            BuildNotebook.Populate();AssetDatabase.SaveAssets();EditorSceneManager.SaveScene(scene,Root+"Scenes/WeightTemple.unity");
            EditorBuildSettings.scenes=new[]{new EditorBuildSettingsScene(Root+"Scenes/PlanetExploration.unity",true),new EditorBuildSettingsScene(Root+"Scenes/WeightTemple.unity",true)};
            Debug.Log("WEIGHT_TEMPLE_READY scaleBeam="+beam.position+" leftPan="+panSlots[0].position);
        }
        public static void CreateAndBuild(){Create();BuildTwinTemple.Create();BuildLeverTemple.Create();BuildExploration.BuildWindows();}
        static double importDeadline;
        public static void RunBatch()
        {
            if(Resources.Load<TMP_Settings>("TMP Settings")!=null){FinishBatch();return;}
            importDeadline=EditorApplication.timeSinceStartup+180;
            EditorApplication.update+=WaitForResources;
            TMP_PackageResourceImporter.ImportResources(true,false,false);
        }
        static void WaitForResources()
        {
            if(Resources.Load<TMP_Settings>("TMP Settings")==null)
            {
                if(EditorApplication.timeSinceStartup>importDeadline){EditorApplication.update-=WaitForResources;Debug.LogError("TMP resource import timed out");EditorApplication.Exit(1);}return;
            }
            EditorApplication.update-=WaitForResources;EditorApplication.delayCall+=FinishBatch;
        }
        static void FinishBatch()
        {
            try{CreateAndBuild();EditorApplication.Exit(0);}catch(Exception e){Debug.LogException(e);EditorApplication.Exit(1);}
        }
    }
}
