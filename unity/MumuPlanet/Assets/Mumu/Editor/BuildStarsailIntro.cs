using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.SceneManagement;
using UnityEngine.UI;
using TMPro;
using Mumu.Planet;
using static Mumu.Editor.BuildWeightTemple;

namespace Mumu.Editor
{
    public static class BuildStarsailIntro
    {
        const string Root="Assets/Mumu/";
        const string Model=Root+"Models/Starsail/";
        const string Output=Root+"Generated/Starsail/";
        [Serializable] sealed class Surface{public string name;public float[] color;public float metal;public bool emission;}
        [Serializable] sealed class Palette{public Surface[] materials;}

        static Material ShipMaterial(Surface source)
        {
            string safe=new string(source.name.Select(c=>char.IsLetterOrDigit(c)?c:'_').ToArray());
            string path=Output+safe+".mat";
            var mat=AssetDatabase.LoadAssetAtPath<Material>(path);
            if(mat==null){mat=new Material(Shader.Find("Universal Render Pipeline/Lit"));AssetDatabase.CreateAsset(mat,path);}
            mat.color=new Color(source.color[0],source.color[1],source.color[2]).gamma;
            mat.SetFloat("_Metallic",source.metal);mat.SetFloat("_Smoothness",.38f);
            if(source.emission){mat.EnableKeyword("_EMISSION");mat.SetColor("_EmissionColor",mat.color*1.8f);}
            EditorUtility.SetDirty(mat);return mat;
        }

        static Material ColorMaterial(string name,Color color,bool glow=false)
        {
            string path=Output+name+".mat";
            var mat=AssetDatabase.LoadAssetAtPath<Material>(path);
            if(mat==null){mat=new Material(Shader.Find("Universal Render Pipeline/Lit"));AssetDatabase.CreateAsset(mat,path);}
            mat.color=color;mat.SetFloat("_Metallic",name.Contains("Gold")?.65f:0);mat.SetFloat("_Smoothness",name.Contains("Gold")?.65f:.28f);
            if(glow){mat.EnableKeyword("_EMISSION");mat.SetColor("_EmissionColor",color*1.2f);}
            EditorUtility.SetDirty(mat);return mat;
        }

        static Transform Shape(PrimitiveType type,string name,Transform parent,Vector3 local,Vector3 scale,Material material)
        {
            var obj=GameObject.CreatePrimitive(type);obj.name=name;obj.transform.SetParent(parent,false);
            obj.transform.localPosition=local;obj.transform.localScale=scale;
            obj.GetComponent<Renderer>().sharedMaterial=material;
            UnityEngine.Object.DestroyImmediate(obj.GetComponent<Collider>());
            return obj.transform;
        }

        static Texture2D PlanetTexture()
        {
            string path=Output+"ObservedPlanet.asset";
            var texture=AssetDatabase.LoadAssetAtPath<Texture2D>(path);
            bool created=texture==null;
            if(created)texture=new Texture2D(256,128,TextureFormat.RGBA32,true){name="Observed planet color",wrapMode=TextureWrapMode.Repeat};
            var pixels=new Color[256*128];
            for(int y=0;y<128;y++)for(int x=0;x<256;x++)
            {
                float u=x/256f,v=y/127f;
                float n=.57f*Mathf.PerlinNoise(u*4.1f+2,v*3.5f+1)+.29f*Mathf.PerlinNoise(u*9.3f,v*8.7f)+.14f*Mathf.PerlinNoise(u*20.2f,v*15.5f);
                float ice=Mathf.SmoothStep(0,1,Mathf.InverseLerp(.76f,.97f,Mathf.Abs(v-.5f)*2));
                Color sea=Color.Lerp(new Color(.005f,.08f,.38f),new Color(.025f,.34f,.72f),Mathf.PerlinNoise(u*13,v*13));
                Color land=Color.Lerp(new Color(.07f,.35f,.19f),new Color(.38f,.46f,.23f),Mathf.PerlinNoise(u*9+11,v*9));
                Color c=Color.Lerp(sea,land,Mathf.SmoothStep(0,1,Mathf.InverseLerp(.51f,.55f,n)));
                c=Color.Lerp(c,Color.white,ice);
                float clouds=Mathf.PerlinNoise(u*16.3f+30,v*12.5f+21);
                c=Color.Lerp(c,new Color(.85f,.94f,.95f),Mathf.SmoothStep(0,1,Mathf.InverseLerp(.74f,.86f,clouds))*.43f);
                pixels[y*256+x]=c;
            }
            texture.SetPixels(pixels);texture.Apply(true,false);
            if(created)AssetDatabase.CreateAsset(texture,path);else EditorUtility.SetDirty(texture);
            return texture;
        }

        static void SpaceSky()
        {
            string texturePath=Output+"StarsailSky.asset";
            var texture=AssetDatabase.LoadAssetAtPath<Texture2D>(texturePath);
            bool created=texture==null;
            if(created)texture=new Texture2D(512,256,TextureFormat.RGBA32,true){name="Starsail blue nebula",wrapMode=TextureWrapMode.Repeat};
                var colors=new Color[512*256];
                for(int y=0;y<256;y++)for(int x=0;x<512;x++)
                {
                    float u=x/512f,v=y/255f;
                    float drift=.54f+.08f*Mathf.Sin(u*11)+.045f*Mathf.Sin(u*27);
                    float band=Mathf.Exp(-Mathf.Pow((v-drift)/.20f,2));
                    float cloud=.58f*Mathf.PerlinNoise(u*7+2,v*5+4)+.42f*Mathf.PerlinNoise(u*18+5,v*13+8);
                    float glow=band*Mathf.SmoothStep(0,1,Mathf.InverseLerp(.43f,.70f,cloud));
                    var baseColor=new Color(.005f,.018f,.055f);
                    colors[y*512+x]=baseColor+new Color(.025f,.10f,.19f)*glow+new Color(.015f,.035f,.10f)*band;
                }
                texture.SetPixels(colors);texture.Apply(true,false);
                if(created)AssetDatabase.CreateAsset(texture,texturePath);else EditorUtility.SetDirty(texture);
            var shader=Shader.Find("Skybox/Panoramic");
            if(shader==null)return;
            string path=Output+"StarsailSky.mat";
            var sky=AssetDatabase.LoadAssetAtPath<Material>(path);
            if(sky==null){sky=new Material(shader);AssetDatabase.CreateAsset(sky,path);}
            sky.SetTexture("_MainTex",texture);sky.SetFloat("_Exposure",.92f);
            sky.SetColor("_Tint",Color.white);EditorUtility.SetDirty(sky);RenderSettings.skybox=sky;
        }

        static void Backdrop()
        {
            var blue=ColorMaterial("PlanetOcean",Color.white);blue.SetTexture("_BaseMap",PlanetTexture());
            blue.EnableKeyword("_EMISSION");blue.SetColor("_EmissionColor",new Color(.02f,.06f,.10f));EditorUtility.SetDirty(blue);
            var planet=Shape(PrimitiveType.Sphere,"Distant blue-green planet",new GameObject("Space vista").transform,
                new Vector3(-25,0,-77),Vector3.one*18,blue);
            planet.GetComponent<Renderer>().shadowCastingMode=ShadowCastingMode.Off;
            var random=new System.Random(877);var vertices=new Vector3[440*4];var triangles=new int[440*6];
            for(int i=0;i<440;i++)
            {
                float yaw=(float)(random.NextDouble()*Math.PI*2),pitch=(float)(random.NextDouble()*1.8-.65);
                var direction=new Vector3(Mathf.Cos(pitch)*Mathf.Sin(yaw),Mathf.Sin(pitch),Mathf.Cos(pitch)*Mathf.Cos(yaw));
                var center=direction*130+new Vector3(0,12,0);
                var right=Vector3.Cross(Vector3.up,direction).normalized;
                if(right.sqrMagnitude<.01f)right=Vector3.right;
                var up=Vector3.Cross(direction,right).normalized;
                float size=i%13==0?.23f:i%4==0?.13f:.07f;
                for(int j=0;j<4;j++)vertices[i*4+j]=center+right*((j==0||j==3)?-size:size)+up*((j<2)?-size:size);
                int a=i*4,b=i*6;triangles[b]=a;triangles[b+1]=a+2;triangles[b+2]=a+1;triangles[b+3]=a;triangles[b+4]=a+3;triangles[b+5]=a+2;
            }
            var mesh=AssetDatabase.LoadAssetAtPath<Mesh>(Output+"Stars.asset");
            if(mesh==null){mesh=new Mesh{name="Space stars"};AssetDatabase.CreateAsset(mesh,Output+"Stars.asset");}else mesh.Clear();
            mesh.vertices=vertices;mesh.triangles=triangles;mesh.RecalculateNormals();mesh.RecalculateBounds();EditorUtility.SetDirty(mesh);
            var starMat=ColorMaterial("Starlight",new Color(.8f,.9f,1),true);
            var field=new GameObject("Batched starfield",typeof(MeshFilter),typeof(MeshRenderer));
            field.GetComponent<MeshFilter>().sharedMesh=mesh;field.GetComponent<MeshRenderer>().sharedMaterial=starMat;
            field.GetComponent<MeshRenderer>().shadowCastingMode=ShadowCastingMode.Off;
        }

        [MenuItem("Mumu/Build Starsail introduction")]
        public static void CreateAndBuild(){Create();BuildExploration.BuildWindows();}

        public static void Create()
        {
            Directory.CreateDirectory(Output);AssetDatabase.Refresh();Prepare();
            var source=EditorSceneManager.OpenScene(Root+"Scenes/PlanetExploration.unity");
            var sourcePlayer=UnityEngine.Object.FindFirstObjectByType<PlanetExplorer>();
            var sourceCamera=UnityEngine.Object.FindFirstObjectByType<OrbitCamera>();
            if(sourcePlayer==null||sourceCamera==null)throw new InvalidOperationException("Planet player and camera are required");
            var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Additive);SceneManager.SetActiveScene(scene);
            var player=UnityEngine.Object.Instantiate(sourcePlayer.gameObject).GetComponent<PlanetExplorer>();player.name="Starsail navigator";SceneManager.MoveGameObjectToScene(player.gameObject,scene);
            var orbit=UnityEngine.Object.Instantiate(sourceCamera.gameObject).GetComponent<OrbitCamera>();SceneManager.MoveGameObjectToScene(orbit.gameObject,scene);
            var oldSmoke=player.GetComponent<ExplorationSmoke>();if(oldSmoke!=null)UnityEngine.Object.DestroyImmediate(oldSmoke);
            var floor=new GameObject("Starsail flat deck frame").transform;
            player.transform.SetPositionAndRotation(new Vector3(0,0,7),Quaternion.LookRotation(Vector3.back,Vector3.up));
            player.ConfigureFlat(floor,orbit.transform,player.GetComponentInChildren<Animator>());
            orbit.Configure(player.transform);
            orbit.ConfigureFraming(14f,7.5f);
            EditorSceneManager.CloseScene(source,true);

            var importer=AssetImporter.GetAtPath(Model+"starsail-v02.fbx") as ModelImporter;
            if(importer==null)throw new InvalidOperationException("Export Starsail v02 FBX from Blender first");
            if(importer.materialImportMode!=ModelImporterMaterialImportMode.None||importer.importAnimation)
            {importer.materialImportMode=ModelImporterMaterialImportMode.None;importer.importAnimation=false;importer.SaveAndReimport();}
            var prefab=AssetDatabase.LoadAssetAtPath<GameObject>(Model+"starsail-v02.fbx");
            var ship=(GameObject)PrefabUtility.InstantiatePrefab(prefab);
            PrefabUtility.UnpackPrefabInstance(ship,PrefabUnpackMode.Completely,InteractionMode.AutomatedAction);
            ship.name="Blender Starsail v02";
            var palette=JsonUtility.FromJson<Palette>(File.ReadAllText(Model+"palette.json"));
            var materials=palette.materials.ToDictionary(m=>m.name,ShipMaterial);
            var fallback=ColorMaterial("ShipFallback",new Color(.34f,.22f,.12f));
            foreach(var r in ship.GetComponentsInChildren<Renderer>())
            {
                var replacement=r.sharedMaterials.Select(m=>m!=null&&materials.TryGetValue(m.name,out var found)?found:fallback).ToArray();
                r.sharedMaterials=replacement;r.receiveShadows=true;
                if(r.name.Contains("sail")||r.name.Contains("Sail"))r.shadowCastingMode=ShadowCastingMode.Off;
            }

            var deck=new GameObject("Walkable deck bounds",typeof(BoxCollider));deck.layer=9;
            deck.transform.position=new Vector3(0,-.16f,0);deck.GetComponent<BoxCollider>().size=new Vector3(12,.25f,27);
            for(int side=-1;side<=1;side+=2)
            {
                var rail=new GameObject("Invisible rail boundary",typeof(BoxCollider));rail.layer=8;
                rail.transform.position=new Vector3(side*5.8f,1,0);rail.GetComponent<BoxCollider>().size=new Vector3(.4f,2,27);
            }
            foreach(float z in new[]{-13.4f,12.5f})
            {var edge=new GameObject("Invisible end rail",typeof(BoxCollider));edge.layer=8;edge.transform.position=new Vector3(0,1,z);edge.GetComponent<BoxCollider>().size=new Vector3(12,2,.4f);}

            SpaceSky();Backdrop();
            var wood=ColorMaterial("ParcelWood",new Color(.58f,.34f,.16f));
            var gold=ColorMaterial("ParcelGold",new Color(.90f,.67f,.29f),true);
            var paper=ColorMaterial("ParcelPaper",new Color(.91f,.85f,.66f));
            var parcel=new GameObject("Mystery parcel").transform;
            Shape(PrimitiveType.Cube,"Bound wooden box",parcel,Vector3.zero,new Vector3(1.05f,.65f,.78f),wood);
            Shape(PrimitiveType.Cube,"Brass horizontal strap",parcel,new Vector3(0,.02f,0),new Vector3(1.08f,.055f,.82f),gold);
            Shape(PrimitiveType.Cube,"Brass vertical strap",parcel,new Vector3(0,.02f,0),new Vector3(.07f,.69f,.82f),gold);
            Shape(PrimitiveType.Cube,"Inward-facing address card",parcel,new Vector3(-.532f,.02f,0),new Vector3(.015f,.30f,.44f),paper);
            var lid=new GameObject("Hinged parcel lid").transform;lid.SetParent(parcel,false);lid.localPosition=new Vector3(0,.36f,-.36f);
            Shape(PrimitiveType.Cube,"Parcel lid",lid,new Vector3(0,.04f,.36f),new Vector3(1.1f,.10f,.82f),wood);
            Shape(PrimitiveType.Cube,"Parcel lid binding",lid,new Vector3(0,.10f,.36f),new Vector3(.09f,.025f,.86f),gold);
            Shape(PrimitiveType.Cube,"Address card",lid,new Vector3(.25f,.096f,.42f),new Vector3(.35f,.01f,.22f),paper);
            var rig=new GameObject("Outboard parcel recovery boom").transform;
            Vector3 root=new Vector3(4.3f,1.35f,4f),tip=new Vector3(5.6f,2.65f,3.2f);
            Vector3 direction=tip-root;
            var arm=Shape(PrimitiveType.Cube,"Recovery boom",rig,(root+tip)*.5f,new Vector3(direction.magnitude,.11f,.13f),wood);
            arm.rotation=Quaternion.FromToRotation(Vector3.right,direction.normalized);
            Shape(PrimitiveType.Sphere,"Brass rope pulley",rig,tip,Vector3.one*.20f,gold);
            var cableGo=new GameObject("Winch retrieval cable");var cable=cableGo.AddComponent<LineRenderer>();
            cable.positionCount=3;cable.widthMultiplier=.035f;
            cable.sharedMaterial=ColorMaterial("RecoveryRope",new Color(.82f,.66f,.38f),true);
            cable.enabled=true;

            // Three individual brass number wheels sit at the stern. Each is reached from
            // its own position, so overlapping interaction radii never turn a neighbour.
            var dialRoot=new GameObject("Three-number star course console").transform;
            var dark=ColorMaterial("CourseObsidian",new Color(.055f,.075f,.10f));
            var glass=ColorMaterial("CourseGlass",new Color(.10f,.32f,.37f),true);
            var faces=new TextMeshPro[3];
            var dialFont=AssetDatabase.LoadAssetAtPath<TMP_FontAsset>(Root+"Generated/Balance/TempleKorean.asset");
            for(int i=0;i<3;i++)
            {
                float x=(1-i)*1.65f;
                Shape(PrimitiveType.Cube,"Carved course pedestal "+(i+1),dialRoot,new Vector3(x,.60f,-5.8f),new Vector3(1.27f,1.02f,.82f),wood);
                Shape(PrimitiveType.Cube,"Brass bezel "+(i+1),dialRoot,new Vector3(x,1.13f,-5.8f),new Vector3(1.34f,.10f,.90f),gold);
                Shape(PrimitiveType.Cube,"Dark digit inset "+(i+1),dialRoot,new Vector3(x,1.09f,-5.31f),new Vector3(.96f,.77f,.055f),dark);
                Shape(PrimitiveType.Cube,"Luminous lower marker "+(i+1),dialRoot,new Vector3(x,.75f,-5.265f),new Vector3(.43f,.035f,.07f),glass);
                var number=new GameObject("Course digit "+(i+1),typeof(TextMeshPro));
                number.transform.SetParent(dialRoot,false);number.transform.localPosition=new Vector3(x,1.12f,-5.266f);
                number.transform.localRotation=Quaternion.Euler(0,180,0);
                faces[i]=number.GetComponent<TextMeshPro>();faces[i].font=dialFont;faces[i].fontSize=6;
                faces[i].color=new Color(1,.85f,.52f);faces[i].alignment=TextAlignmentOptions.Center;
                faces[i].rectTransform.sizeDelta=new Vector2(.8f,.7f);faces[i].text="0";
            }
            var courseIndicator=new GameObject("Solved course lamp").AddComponent<Light>();
            courseIndicator.type=LightType.Point;courseIndicator.range=5;courseIndicator.color=new Color(.4f,.88f,.85f);
            courseIndicator.transform.position=new Vector3(0,1.6f,-5.8f);courseIndicator.enabled=false;

            var sun=new GameObject("Sail sunlight").AddComponent<Light>();sun.type=LightType.Directional;sun.color=new Color(.98f,.87f,.70f);sun.intensity=1.7f;
            sun.shadows=LightShadows.Soft;sun.transform.rotation=Quaternion.Euler(38,-28,0);RenderSettings.sun=sun;
            RenderSettings.ambientMode=AmbientMode.Trilight;RenderSettings.ambientSkyColor=new Color(.25f,.35f,.49f);
            RenderSettings.ambientEquatorColor=new Color(.21f,.28f,.36f);RenderSettings.ambientGroundColor=new Color(.13f,.16f,.23f);
            RenderSettings.fog=false;orbit.GetComponent<Camera>().clearFlags=CameraClearFlags.Skybox;
            orbit.GetComponent<Camera>().backgroundColor=new Color(.018f,.055f,.12f);
            orbit.GetComponent<Camera>().farClipPlane=260;

            BuildNotebook.Populate();
            var notebook=UnityEngine.Object.FindFirstObjectByType<NotebookUI>();
            var hud=Canvas("Starsail journey HUD");hud.GetComponent<Canvas>().sortingOrder=35;
            var scaler=hud.GetComponent<CanvasScaler>();scaler.screenMatchMode=CanvasScaler.ScreenMatchMode.Expand;
            var objectivePanel=Panel(hud,"Starsail objective panel",new Vector2(.5f,1),new Vector2(.5f,1),new Vector2(0,-20),new Vector2(770,80));
            var objective=Text(objectivePanel,"Starsail objective","우주에서 발견한 소포",new Vector2(.5f,.5f),new Vector2(.5f,.5f),Vector2.zero,new Vector2(740,68),28);
            var promptPanel=Panel(hud,"Starsail action panel",new Vector2(.5f,0),new Vector2(.5f,0),new Vector2(0,22),new Vector2(970,74));
            var prompt=Text(promptPanel,"Starsail action","우현 회수 손잡이로",new Vector2(.5f,.5f),new Vector2(.5f,.5f),Vector2.zero,new Vector2(940,60),24);
            var fadeRect=Rect("Departure fade",hud,Vector2.zero,Vector2.zero,Vector2.zero,Vector2.zero);
            fadeRect.anchorMax=Vector2.one;fadeRect.offsetMin=fadeRect.offsetMax=Vector2.zero;
            var fade=fadeRect.gameObject.AddComponent<Image>();fade.color=new Color(.015f,.045f,.09f,0);fade.raycastTarget=false;
            var intro=new GameObject("Starsail opening story").AddComponent<StarsailIntro>();
            intro.Configure(player,orbit,notebook,objective,prompt,parcel,lid,cable,fade,faces,courseIndicator);
            BuildQuestGuide.Populate();
            objectivePanel.gameObject.SetActive(false); // The clickable quest card owns the top objective.
            AssetDatabase.SaveAssets();EditorSceneManager.SaveScene(scene,Root+"Scenes/StarsailIntro.unity");
            Debug.Log("STARSAIL_INTRO_READY shipRenderers="+ship.GetComponentsInChildren<Renderer>().Length);
        }
    }
}
