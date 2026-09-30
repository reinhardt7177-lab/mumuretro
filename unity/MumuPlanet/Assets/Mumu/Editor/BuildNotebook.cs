using System;
using System.IO;
using System.Collections.Generic;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;
using TMPro;
using Mumu.Planet;
using static Mumu.Editor.BuildWeightTemple;

namespace Mumu.Editor
{
    public static class BuildNotebook
    {
        const string Output="Assets/Mumu/Generated/Notebook/";
        [Serializable] class Surface{public string name;public float[] color;public float metal,roughness;}
        [Serializable] class Geometry{public string name,part,material;public float[] vertices,normals;public int[] triangles;}
        [Serializable] class Export{public Surface[] materials;public Geometry[] meshes;}
        static Vector3[] Vectors(float[] values){var a=new Vector3[values.Length/3];for(int i=0;i<a.Length;i++)a[i]=new Vector3(values[i*3],values[i*3+1],values[i*3+2]);return a;}
        static Color Ink=new Color(.075f,.13f,.12f),Gold=new Color(.8f,.64f,.3f);
        static TextMeshProUGUI Print(Transform parent,string name,string value,Vector2 pos,Vector2 size,int fontSize,TextAlignmentOptions alignment=TextAlignmentOptions.TopLeft)
        {
            var t=Text(parent,name,value,new Vector2(.5f,.5f),new Vector2(.5f,.5f),pos,size,fontSize);t.color=Ink;t.alignment=alignment;t.margin=Vector4.zero;t.lineSpacing=7;return t;
        }
        static UnityEngine.UI.Button Action(Transform parent,string name,Vector2 anchor,Vector2 pos,Vector2 size)
        {
            var button=Button(parent,name,anchor,pos,size);button.navigation=new UnityEngine.UI.Navigation{mode=UnityEngine.UI.Navigation.Mode.None};
            button.GetComponentInChildren<TextMeshProUGUI>().fontSize=24;
            var border=button.gameObject.AddComponent<UnityEngine.UI.Outline>();border.effectColor=Gold;border.effectDistance=new Vector2(1,-1);return button;
        }
        static Texture2D LocalChart()
        {
            string path=Output+"LocalChart.asset";
            var texture=AssetDatabase.LoadAssetAtPath<Texture2D>(path);
            bool fresh=texture==null;
            if(fresh)texture=new Texture2D(256,256,TextureFormat.RGBA32,true){name="Nearby landmark chart"};
            var pixels=new Color[256*256];
            for(int y=0;y<256;y++)for(int x=0;x<256;x++)
            {
                float dx=x-127.5f,dy=y-127.5f,r=Mathf.Sqrt(dx*dx+dy*dy);
                float grain=Mathf.PerlinNoise(x*.075f,y*.075f)*.045f;
                Color color=new Color(.85f+grain,.81f+grain,.69f+grain,1);
                if(Mathf.Abs(r-106)<1.2f||Mathf.Abs(r-72)<.85f||Mathf.Abs(r-38)<.7f||
                   Mathf.Abs(dx)<.65f||Mathf.Abs(dy)<.65f)
                    color=new Color(.52f,.42f,.26f,1);
                if(r>119)color=new Color(.76f,.69f,.54f,1);
                pixels[y*256+x]=color;
            }
            texture.SetPixels(pixels);texture.Apply(true,false);
            if(fresh)AssetDatabase.CreateAsset(texture,path);else EditorUtility.SetDirty(texture);
            return texture;
        }
        static void AddMap(NotebookUI ui)
        {
            if(ui.HasMap)return;
            var overlay=ui.Modal.transform;
            var content=overlay.Find("Printed notebook pages");
            if(content==null)throw new InvalidOperationException("Notebook printed pages are missing");
            var tabs=ui.Tabs;
            for(int i=0;i<3;i++)tabs[i].GetComponent<RectTransform>().anchoredPosition=new Vector2((i-1.5f)*192,20);
            var mapTab=Action(overlay,"주변 지도",new Vector2(.5f,0),new Vector2(288,20),new Vector2(174,48));
            var panel=Rect("Nearby landmark chart",content,new Vector2(.5f,.5f),new Vector2(.5f,.5f),new Vector2(267,-20),new Vector2(430,440));
            panel.gameObject.AddComponent<UnityEngine.UI.Image>().color=new Color(.89f,.84f,.73f,.98f);
            var image=Rect("Chart rings",panel,new Vector2(.5f,.5f),new Vector2(.5f,.5f),new Vector2(0,-6),new Vector2(352,352));
            var chart=image.gameObject.AddComponent<UnityEngine.UI.RawImage>();chart.texture=LocalChart();chart.raycastTarget=false;
            var landing=Rect("Landing point",panel,new Vector2(.5f,.5f),new Vector2(.5f,.5f),Vector2.zero,new Vector2(13,13));
            landing.gameObject.AddComponent<UnityEngine.UI.Image>().color=new Color(.25f,.33f,.29f);landing.localRotation=Quaternion.Euler(0,0,45);
            var temple=Rect("Temple chart marker",panel,new Vector2(.5f,.5f),new Vector2(.5f,.5f),new Vector2(0,90),new Vector2(20,20));
            temple.gameObject.AddComponent<UnityEngine.UI.Image>().color=new Color(.74f,.49f,.19f);temple.localRotation=Quaternion.Euler(0,0,45);
            var player=Rect("Explorer chart marker",panel,new Vector2(.5f,.5f),new Vector2(.5f,.5f),Vector2.zero,new Vector2(17,17));
            player.gameObject.AddComponent<UnityEngine.UI.Image>().color=new Color(.05f,.45f,.48f);player.localRotation=Quaternion.Euler(0,0,45);
            var templeLabel=Print(panel,"Temple chart label","신전",new Vector2(63,94),new Vector2(100,28),19);
            var playerLabel=Print(panel,"Explorer chart label","나",new Vector2(44,-2),new Vector2(65,28),19);
            var status=Print(panel,"Chart status","착륙지 주변",new Vector2(0,181),new Vector2(380,36),21,TextAlignmentOptions.Center);
            Print(panel,"Chart key","● 착륙 지점      ◆ 나      ◆ 무게의 신전",new Vector2(0,-190),new Vector2(395,35),18,TextAlignmentOptions.Center);
            var entrance=UnityEngine.Object.FindFirstObjectByType<TempleEntrance>();
            var explorer=UnityEngine.Object.FindFirstObjectByType<PlanetExplorer>();
            ui.ConfigureMap(panel.gameObject,mapTab,player,temple,playerLabel.rectTransform,templeLabel.rectTransform,
                status,entrance!=null&&explorer!=null?explorer.transform.position:Vector3.zero);
            panel.gameObject.SetActive(false);EditorUtility.SetDirty(ui);
        }
        static NotebookPresentation Model(UnityEngine.UI.RawImage image)
        {
            Directory.CreateDirectory(Output);AssetDatabase.Refresh();
            var data=JsonUtility.FromJson<Export>(File.ReadAllText("Assets/Mumu/Models/Notebook/notebook-v01.json"));
            var palette=new Dictionary<string,UnityEngine.Material>();
            foreach(var m in data.materials)
            {
                string path=Output+m.name+".mat";var mat=AssetDatabase.LoadAssetAtPath<UnityEngine.Material>(path);
                if(mat==null){mat=new UnityEngine.Material(Shader.Find("Universal Render Pipeline/Lit"));AssetDatabase.CreateAsset(mat,path);}
                mat.color=new Color(m.color[0],m.color[1],m.color[2]).gamma;mat.SetFloat("_Metallic",m.metal);mat.SetFloat("_Smoothness",1-m.roughness);
                if(m.name.Contains("paper")){mat.EnableKeyword("_EMISSION");mat.SetColor("_EmissionColor",mat.color*.25f);}
                EditorUtility.SetDirty(mat);palette[m.name]=mat;
            }
            var stage=new GameObject("Notebook isolated presentation");stage.transform.position=new Vector3(0,-1200,0);
            MeshFilter leaf=null;int triangles=0;
            foreach(var g in data.meshes)
            {
                string path=Output+g.name+".asset";var mesh=AssetDatabase.LoadAssetAtPath<Mesh>(path);
                if(mesh==null){mesh=new Mesh{name=g.name};AssetDatabase.CreateAsset(mesh,path);}else mesh.Clear();
                mesh.indexFormat=g.vertices.Length/3>65535?IndexFormat.UInt32:IndexFormat.UInt16;mesh.vertices=Vectors(g.vertices);mesh.normals=Vectors(g.normals);mesh.triangles=g.triangles;mesh.RecalculateBounds();EditorUtility.SetDirty(mesh);
                var part=new GameObject(g.name,typeof(MeshFilter),typeof(MeshRenderer));part.layer=31;part.transform.SetParent(stage.transform,false);
                part.GetComponent<MeshFilter>().sharedMesh=mesh;var renderer=part.GetComponent<MeshRenderer>();renderer.sharedMaterial=palette[g.material];renderer.shadowCastingMode=ShadowCastingMode.Off;
                if(g.part=="Leaf")leaf=part.GetComponent<MeshFilter>();triangles+=g.triangles.Length/3;
            }
            if(leaf==null)throw new InvalidOperationException("Blender notebook turning leaf is missing");
            var camera=new GameObject("Notebook model camera").AddComponent<Camera>();camera.transform.SetParent(stage.transform,false);camera.transform.localPosition=new Vector3(0,0,-12);
            camera.orthographic=true;camera.orthographicSize=3.55f;camera.clearFlags=CameraClearFlags.SolidColor;camera.backgroundColor=new Color(0,0,0,0);camera.cullingMask=1<<31;camera.nearClipPlane=.1f;camera.farClipPlane=20;camera.depth=-10;camera.enabled=false;
            var additional=camera.GetUniversalAdditionalCameraData();additional.renderPostProcessing=false;additional.renderShadows=false;additional.requiresColorOption=CameraOverrideOption.Off;additional.requiresDepthOption=CameraOverrideOption.Off;
            var light=new GameObject("Notebook soft reading light").AddComponent<Light>();light.transform.SetParent(stage.transform,false);light.type=LightType.Directional;light.intensity=.75f;light.color=new Color(1,.94f,.8f);light.cullingMask=1<<31;light.shadows=LightShadows.None;light.transform.localRotation=Quaternion.Euler(18,-18,0);
            var presenter=stage.AddComponent<NotebookPresentation>();presenter.Configure(camera,image,leaf);Debug.Log("NOTEBOOK_MODEL_READY triangles="+triangles+" batches="+data.meshes.Length);return presenter;
        }
        public static void Populate()
        {
            var player=UnityEngine.Object.FindFirstObjectByType<PlanetExplorer>();var orbit=UnityEngine.Object.FindFirstObjectByType<OrbitCamera>();
            var existing=UnityEngine.Object.FindFirstObjectByType<NotebookUI>();
            if(existing!=null)
            {
                existing.BindScene(player,orbit,UnityEngine.Object.FindFirstObjectByType<TempleEntrance>(),UnityEngine.Object.FindFirstObjectByType<TempleAudience>());
                var existingScaler=existing.GetComponent<UnityEngine.UI.CanvasScaler>();existingScaler.screenMatchMode=UnityEngine.UI.CanvasScaler.ScreenMatchMode.Expand;
                if(!existing.HasMap){Prepare();AddMap(existing);}
                EditorUtility.SetDirty(existingScaler);EditorUtility.SetDirty(existing);return;
            }
            if(AssetDatabase.LoadAssetAtPath<TMP_FontAsset>("Assets/Mumu/Generated/Balance/TempleKorean.asset")==null)return;
            Prepare();
            var hud=Canvas("Explorer notebook HUD");hud.GetComponent<UnityEngine.Canvas>().sortingOrder=80;
            hud.GetComponent<UnityEngine.UI.CanvasScaler>().screenMatchMode=UnityEngine.UI.CanvasScaler.ScreenMatchMode.Expand;
            var launcher=Action(hud,"수첩  [N]",Vector2.one,new Vector2(-24,-148),new Vector2(224,78));
            var launcherLabel=launcher.GetComponentInChildren<TextMeshProUGUI>();launcherLabel.rectTransform.anchoredPosition=new Vector2(20,14);launcherLabel.rectTransform.sizeDelta=new Vector2(174,42);launcherLabel.fontSize=27;launcherLabel.margin=Vector4.zero;
            var detail=Text(launcher.transform,"Notebook quick status","탐사 기록 열기",new Vector2(.5f,.5f),new Vector2(.5f,.5f),new Vector2(14,-20),new Vector2(180,28),16);detail.color=new Color(.88f,.82f,.64f);detail.margin=Vector4.zero;
            for(int side=-1;side<=1;side+=2)
            {
                var icon=Rect("Book icon page",launcher.transform,new Vector2(0,.5f),new Vector2(.5f,.5f),new Vector2(28+side*7,10),new Vector2(12,24));icon.gameObject.AddComponent<UnityEngine.UI.Image>().color=new Color(.96f,.90f,.71f);icon.GetComponent<UnityEngine.UI.Image>().raycastTarget=false;icon.localRotation=Quaternion.Euler(0,0,side*-8);
            }
            var overlay=Rect("Notebook modal",hud,Vector2.zero,Vector2.zero,Vector2.zero,Vector2.zero);overlay.anchorMax=Vector2.one;overlay.offsetMin=overlay.offsetMax=Vector2.zero;
            overlay.gameObject.AddComponent<UnityEngine.UI.Image>().color=new Color(.008f,.025f,.023f,.89f);
            var displayRect=Rect("Blender notebook display",overlay,new Vector2(.5f,.5f),new Vector2(.5f,.5f),Vector2.zero,new Vector2(1240,820));
            var display=displayRect.gameObject.AddComponent<UnityEngine.UI.RawImage>();display.raycastTarget=false;
            var content=Rect("Printed notebook pages",overlay,new Vector2(.5f,.5f),new Vector2(.5f,.5f),Vector2.zero,new Vector2(1240,820));var ink=content.gameObject.AddComponent<CanvasGroup>();ink.blocksRaycasts=false;
            Print(content,"Notebook title","탐사 수첩",new Vector2(-265,246),new Vector2(430,60),42,TextAlignmentOptions.Center);
            Print(content,"Notebook subtitle","비교하고 발견한 것을 담다",new Vector2(-265,187),new Vector2(430,36),23,TextAlignmentOptions.Center);
            var place=Print(content,"Notebook location","",new Vector2(-265,78),new Vector2(400,104),29,TextAlignmentOptions.Center);
            var rule=Rect("Left page gold divider",content,new Vector2(.5f,.5f),new Vector2(.5f,.5f),new Vector2(-265,-1),new Vector2(292,2));rule.gameObject.AddComponent<UnityEngine.UI.Image>().color=new Color(.49f,.34f,.13f);rule.GetComponent<UnityEngine.UI.Image>().raycastTarget=false;
            var record=Print(content,"Notebook completion","",new Vector2(-265,-109),new Vector2(405,145),26,TextAlignmentOptions.Center);
            var saveNote=Print(content,"Notebook save note","이 PC의 완료 기록을 읽습니다.",new Vector2(-265,-267),new Vector2(430,44),20,TextAlignmentOptions.Center);
            var title=Print(content,"Notebook page heading","",new Vector2(267,248),new Vector2(443,55),34);
            var body=Print(content,"Notebook body","",new Vector2(267,-12),new Vector2(443,436),25);
            var number=Print(content,"Notebook page number","1 / 3",new Vector2(267,-286),new Vector2(120,35),20,TextAlignmentOptions.Center);
            var close=Action(overlay,"닫기  [Esc]",Vector2.one,new Vector2(-24,-22),new Vector2(174,50));
            var tabs=new UnityEngine.UI.Button[3];string[] names={"탐사일지","실험 노트","조작 안내"};
            for(int i=0;i<3;i++)tabs[i]=Action(overlay,names[i],new Vector2(.5f,0),new Vector2((i-1)*192,20),new Vector2(174,48));
            var previous=Action(overlay,"← 이전",new Vector2(0,0),new Vector2(110,20),new Vector2(160,48));var next=Action(overlay,"다음 →",new Vector2(1,0),new Vector2(-110,20),new Vector2(160,48));
            var ui=hud.gameObject.AddComponent<NotebookUI>();ui.Configure(overlay.gameObject,launcher,close,previous,next,tabs,detail,title,body,record,place,number,saveNote,ink,Model(display));
            ui.BindScene(player,orbit,UnityEngine.Object.FindFirstObjectByType<TempleEntrance>(),UnityEngine.Object.FindFirstObjectByType<TempleAudience>());AddMap(ui);overlay.gameObject.SetActive(false);
            if(UnityEngine.Object.FindFirstObjectByType<EventSystem>()==null){var es=new GameObject("Notebook input",typeof(EventSystem),typeof(InputSystemUIInputModule));es.GetComponent<InputSystemUIInputModule>().AssignDefaultActions();}
        }
        [MenuItem("Mumu/Add Blender explorer notebook")]
        public static void CreateAndBuild()
        {
            Prepare();
            foreach(var name in new[]{"PlanetExploration","WeightTemple","TwinBalanceTemple","LeverBalanceTemple"})
            {
                var scene=EditorSceneManager.OpenScene("Assets/Mumu/Scenes/"+name+".unity");Populate();AssetDatabase.SaveAssets();EditorSceneManager.SaveScene(scene);
            }
            BuildExploration.BuildWindows();
        }
        public static void RefreshFontAndBuild(){Prepare();AssetDatabase.SaveAssets();BuildExploration.BuildWindows();}
    }
}
