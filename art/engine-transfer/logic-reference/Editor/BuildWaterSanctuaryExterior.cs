using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.SceneManagement;
using TMPro;
using Mumu.Planet;

namespace Mumu.Editor
{
    // The water sanctuary on the planet, without the retired sandstone cliff chapter (climb, sun mirror, thaw).
    // Keeps the 2026-09-27 site, facing, Blender art, terrain-fitted footing and completion seal.
    // The doorway is open from the start. The cliff generator is archived under unity/legacy/water-mountain-v05.
    public static class BuildWaterSanctuaryExterior
    {
        const string Root="Assets/Mumu/",Output=Root+"Generated/WaterMountain/";
        public const string ExteriorName="Water sanctuary exterior",HudName="Water sanctuary HUD";
        const string RetiredChapter="Water mountain chapter",RetiredHud="Water mountain HUD",RetiredStandalone="Frozen water sanctuary";
        [Serializable] class SurfaceInfo {public string name;public float[] color;public float metal;}
        [Serializable] class GeometryInfo {public string material;public float[] vertices,normals,uv;public int[] triangles;}
        [Serializable] class ArtExport {public SurfaceInfo[] materials;public GeometryInfo[] meshes;}
        static readonly Color Ink=new Color(.025f,.075f,.09f,.96f),Paper=new Color(.97f,.94f,.84f);

        // The retired chapter hid nature inside these chapter-local rectangles (cliff body and sanctuary plot).
        static bool InsideRetiredChapter(Vector3 local)=>
            local.x> -10&&local.x<11&&local.z> -11&&local.z<15||local.x>=10&&local.x<26&&local.z>0&&local.z<14;

        [MenuItem("Mumu/Build water sanctuary exterior (direct entry)")]
        public static void CreateAndBuild()
        {
            var scene=EditorSceneManager.OpenScene(Root+"Scenes/PlanetExploration.unity");
            Populate();EditorSceneManager.SaveScene(scene);
            BuildWaterEnding.BuildExisting();
        }
        // Scene regeneration only; no player build.
        public static void CreateOnly()
        {
            var scene=EditorSceneManager.OpenScene(Root+"Scenes/PlanetExploration.unity");
            Populate();EditorSceneManager.SaveScene(scene);
        }

        public static void Populate()
        {
            var surface=UnityEngine.Object.FindFirstObjectByType<PlanetSurface>();
            var player=UnityEngine.Object.FindFirstObjectByType<PlanetExplorer>();
            var orbit=UnityEngine.Object.FindFirstObjectByType<OrbitCamera>();
            if(surface==null||player==null||orbit==null)throw new InvalidOperationException("Planet exploration scene must be open.");
            Directory.CreateDirectory(Output);AssetDatabase.Refresh();
            var scene=SceneManager.GetActiveScene();
            int inactiveBefore=InactiveNature();int restored=0;
            Pose? chapterFrame=null,sanctuaryPose=null;

            // 1. Retire the cliff chapter and older generated copies, returning the nature they covered.
            var chapter=RootNamed(scene,RetiredChapter);
            if(chapter!=null)
            {
                chapterFrame=new Pose(chapter.transform.position,chapter.transform.rotation);
                var old=chapter.transform.Find(RetiredStandalone);
                if(old!=null)sanctuaryPose=new Pose(old.position,old.rotation);
                var frame=chapter.transform;
                restored+=SetNature(p=>InsideRetiredChapter(frame.InverseTransformPoint(p)),true);
                Retire(surface,chapter);
            }
            var standalone=RootNamed(scene,RetiredStandalone);
            if(standalone!=null)
            {
                if(sanctuaryPose==null)sanctuaryPose=new Pose(standalone.transform.position,standalone.transform.rotation);
                Retire(surface,standalone);
            }
            var previous=RootNamed(scene,ExteriorName);
            if(previous!=null)
            {
                if(sanctuaryPose==null)sanctuaryPose=new Pose(previous.transform.position,previous.transform.rotation);
                var plot=previous.transform;var footing=plot.Find(WaterSanctuaryEntrance.FootingName)?.GetComponent<Collider>();
                Physics.SyncTransforms();
                restored+=SetNature(p=>WaterSanctuaryEntrance.ShouldHideNature(plot,footing,p),true);
                Retire(surface,previous);
            }
            foreach(var hud in scene.GetRootGameObjects().Where(g=>g.name==RetiredHud||g.name==HudName).ToArray())
                UnityEngine.Object.DestroyImmediate(hud);
            surface.RemoveElevated(null); // prune references to destroyed colliders

            // 2. Same placement rule as the retired chapter: the site frame follows the saved spawn.
            var site=ChapterFrame(surface,player);
            if(chapterFrame.HasValue)Debug.Log("WATER_SANCTUARY_SITE_DELTA position="+Vector3.Distance(chapterFrame.Value.position,site.position).ToString("0.0000")+
                " angle="+Quaternion.Angle(chapterFrame.Value.rotation,site.rotation).ToString("0.0000"));
            var computed=SanctuaryPose(surface,site);
            if(sanctuaryPose.HasValue)Debug.Log("WATER_SANCTUARY_POSE_DELTA position="+Vector3.Distance(sanctuaryPose.Value.position,computed.position).ToString("0.0000")+
                " angle="+Quaternion.Angle(sanctuaryPose.Value.rotation,computed.rotation).ToString("0.0000"));
            var pose=sanctuaryPose??computed;
            var temple=new GameObject(ExteriorName).transform;
            temple.SetPositionAndRotation(pose.position,pose.rotation);

            // 3. Sanctuary, open doorway, prompt and wiring.
            var entrance=BuildSanctuary(surface,player,orbit,temple,site);
            Physics.SyncTransforms();
            var footingCollider=temple.Find(WaterSanctuaryEntrance.FootingName).GetComponent<Collider>();
            int hidden=SetNature(p=>WaterSanctuaryEntrance.ShouldHideNature(temple,footingCollider,p),false);
            AssetDatabase.SaveAssets();
            Debug.Log("WATER_SANCTUARY_READY position="+temple.position.ToString("F3")+" doorway="+entrance.EntranceTarget.position.ToString("F3")+
                " formerIce="+temple.TransformPoint(new Vector3(0,3.17f,-.1f)).ToString("F3")+" elevated="+surface.Elevated.Count+
                " natureInactiveBefore="+inactiveBefore+" restored="+restored+" hiddenInPlot="+hidden+" natureInactiveAfter="+InactiveNature());
        }

        static GameObject RootNamed(Scene scene,string name)=>scene.GetRootGameObjects().FirstOrDefault(g=>g.name==name);
        static void Retire(PlanetSurface surface,GameObject root)
        {
            foreach(var collider in root.GetComponentsInChildren<MeshCollider>(true))surface.RemoveElevated(collider);
            UnityEngine.Object.DestroyImmediate(root);
        }
        static int SetNature(Func<Vector3,bool> inside,bool active)
        {
            int changed=0;
            foreach(var name in WaterSanctuaryEntrance.NatureGroups)
            {
                var group=GameObject.Find(name);if(group==null)continue;
                foreach(Transform item in group.transform)
                    if(item.gameObject.activeSelf!=active&&inside(item.position)){item.gameObject.SetActive(active);changed++;}
            }
            return changed;
        }
        static int InactiveNature()
        {
            int count=0;
            foreach(var name in WaterSanctuaryEntrance.NatureGroups)
            {
                var group=GameObject.Find(name);if(group==null)continue;
                foreach(Transform item in group.transform)if(!item.gameObject.activeSelf)count++;
            }
            return count;
        }
        // Retired BuildWaterMountain.Populate: 24m ahead and 13m right of the spawn, seated at its first grip.
        static Pose ChapterFrame(PlanetSurface surface,PlanetExplorer player)
        {
            var basePoint=surface.Point(player.transform.position+player.transform.forward*24+player.transform.right*13);
            var up=basePoint.normalized;var forward=Vector3.ProjectOnPlane(player.transform.forward,up).normalized;
            var rotation=Quaternion.LookRotation(forward,up);
            var probe=surface.Point(basePoint+rotation*new Vector3(-5.2f,0,-5.4f));
            float seat=(Quaternion.Inverse(rotation)*(probe-basePoint)).y;
            return new Pose(basePoint+up*seat,rotation);
        }
        // Retired AddTemple: 19m right and 7m ahead in the site frame, doorway (-Z) facing the site, level plot.
        static Pose SanctuaryPose(PlanetSurface surface,Pose site)
        {
            var ground=surface.TerrainPoint(site.position+site.rotation*new Vector3(19,0,7));
            var up=ground.normalized;
            var rotation=Quaternion.LookRotation(Vector3.ProjectOnPlane(ground-site.position,up).normalized,up);
            float plot=0;
            for(int x=-6;x<=6;x+=2)for(int z=-3;z<=7;z+=2)plot=Mathf.Max(plot,PlotGround(surface,ground,rotation,x,z));
            return new Pose(ground+up*(plot+.04f),rotation);
        }
        static float PlotGround(PlanetSurface surface,Vector3 origin,Quaternion rotation,float x,float z)
        {
            var ray=new Ray(origin+rotation*new Vector3(x,40,z),-(rotation*Vector3.up));
            if(!surface.RaycastTerrain(ray,out var hit,90))throw new InvalidOperationException("No terrain below sanctuary footprint");
            return (Quaternion.Inverse(rotation)*(hit.point-origin)).y;
        }

        static WaterSanctuaryEntrance BuildSanctuary(PlanetSurface surface,PlanetExplorer player,OrbitCamera orbit,Transform temple,Pose site)
        {
            var pale=Material("Cut limestone",new Color(.69f,.72f,.67f));
            var water=Material("Melted flowing water",new Color(.12f,.63f,.77f,.82f),.2f,true,true);
            var apronMaterial=Material("Glacier grounded apron",new Color(.38f,.59f,.63f));
            apronMaterial.shader=Shader.Find("Mumu/World Vertex");apronMaterial.SetColor("_BaseColor",Color.white);EditorUtility.SetDirty(apronMaterial);
            var apron=MeshObject(WaterSanctuaryEntrance.FootingName,temple,GlacierFooting(surface,temple),apronMaterial,9);
            surface.AddElevated(apron.GetComponent<MeshCollider>());
            var architecture=new GameObject("Blender glacier sanctuary").transform;architecture.SetParent(temple,false);
            ImportArt("glacier-temple-v03.json",architecture,"Glacier sanctuary v03");

            // Walkable plinth and stairs (layer 9, stepped traversal).
            TempleFloor(surface,temple,"Sanctuary foundation collision",new Vector3(0,.55f,1.925f),new Vector3(7.2f,1.1f,5.75f),pale);
            for(int i=0;i<3;i++)TempleFloor(surface,temple,"Approach stair collision "+i,
                new Vector3(0,(i+1)*.275f/2,-2.4f+i*.6f),new Vector3(2.4f,(i+1)*.275f,.64f),pale);
            // Walkable boxes taller than a step are ignored by the elevated walk once its foot ray starts inside them,
            // so their exposed faces also need walls: the plinth front beside the stairs and the sides of stairs 1-2.
            // Tops sit flush with each walking surface, bottoms well below the sloping footing.
            for(int side=-1;side<=1;side+=2)
            {
                Solid(temple,"Plinth front wall",new Vector3(side*2.2f,-1.95f,-.875f),new Vector3(2f,6.1f,.15f));
                Solid(temple,"Stair side wall 1",new Vector3(side*1.275f,-2.225f,-1.8f),new Vector3(.15f,5.55f,.64f));
                Solid(temple,"Stair side wall 2",new Vector3(side*1.275f,-2.0875f,-1.2f),new Vector3(.15f,5.825f,.64f));
            }
            // Stone walls (unchanged from the chapter).
            for(int side=-1;side<=1;side+=2)Solid(temple,"Sanctuary side collision",new Vector3(side*2.95f,3.35f,2.4f),new Vector3(1.3f,4.5f,4.8f));
            Solid(temple,"Sanctuary rear collision",new Vector3(0,3.3f,4.65f),new Vector3(5.7f,4.3f,.3f));
            // Glacier volume at body height, measured from glacier-temple-v03.json; the art itself has no collision.
            Span(temple,"Glacier west buttress collision",-6.45f,-3.0f,-1.55f,1.15f);
            Span(temple,"Glacier west front collision",-5.9f,-3.25f,-2.45f,-1.55f);
            Span(temple,"Glacier west wall collision",-5.9f,-3.0f,1.15f,6.3f);
            Span(temple,"Glacier east buttress collision",3.0f,6.45f,-1.55f,1.15f);
            Span(temple,"Glacier east front collision",3.0f,5.4f,-2.45f,-1.55f);
            Span(temple,"Glacier east wall collision",3.0f,5.9f,1.15f,6.3f);
            Span(temple,"Glacier rear collision",-4.4f,4.4f,4.8f,7.3f);
            foreach(var column in new[]{new Vector2(-3.12f,-.35f),new Vector2(-2.5f,-.48f),new Vector2(2.5f,-.48f),new Vector2(3.12f,-.35f)})
            {
                var obj=new GameObject("Sanctuary column collision");obj.layer=8;obj.transform.SetParent(temple,false);
                obj.transform.localPosition=new Vector3(column.x,3.15f,column.y);
                var capsule=obj.AddComponent<CapsuleCollider>();capsule.direction=1;capsule.radius=.4f;capsule.height=4.1f;
            }
            // The arch is the only way in: jambs close the gap to the side walls, and a full-width threshold
            // keeps the player under the arch. The dark hall behind it is not a walkable room.
            for(int side=-1;side<=1;side+=2)Solid(temple,"Doorway jamb collision",new Vector3(side*1.99f,3.15f,-.13f),new Vector3(.63f,4.1f,.58f));
            Solid(temple,"Doorway threshold collision",new Vector3(0,3.15f,.8f),new Vector3(4.7f,4.1f,.3f));
            var doorway=Marker("Sanctuary doorway",temple,new Vector3(0,1.12f,-.45f));

            // Permanent seal shown after the water deity is met.
            var completionSeal=new GameObject("Water wisdom completion seal");completionSeal.transform.SetParent(temple,false);
            var sealedStone=Material("Water wisdom sealed stone",new Color(.055f,.18f,.22f),.34f);
            var sealedPanel=Shape(PrimitiveType.Cube,"Sealed water doorway",completionSeal.transform,
                new Vector3(0,3,-.29f),new Vector3(2.9f,4f,.12f),sealedStone);
            sealedPanel.gameObject.layer=8;sealedPanel.gameObject.AddComponent<BoxCollider>();
            var sealRing=WaterInteriorArt.Import("water-deity-halo-v03",completionSeal.transform);
            sealRing.localPosition=new Vector3(0,.36f,-1.02f);
            completionSeal.SetActive(false);

            // Water running out of the open doorway beside the stairs.
            var flow=new GameObject("Doorway water ribbons");flow.transform.SetParent(temple,false);
            var ribbons=new List<Transform>();
            for(int side=-1;side<=1;side+=2)
            {
                ribbons.Add(Shape(PrimitiveType.Cube,"Side water channel",flow.transform,new Vector3(side*1.85f,1.13f,-.5f),new Vector3(.22f,.025f,1f),water));
                ribbons.Add(Shape(PrimitiveType.Cube,"Threshold cascade",flow.transform,new Vector3(side*1.85f,.65f,-1f),new Vector3(.20f,.95f,.035f),water));
                ribbons.Add(Shape(PrimitiveType.Cube,"Basin runoff",flow.transform,new Vector3(side*1.85f,.24f,-2f),new Vector3(.22f,.025f,2.7f),water));
            }

            // Bottom prompt in the same place and style as the weight temple prompt.
            var font=WaterFont();
            var canvas=BuildWeightTemple.Canvas(HudName);canvas.GetComponent<Canvas>().sortingOrder=30;
            var panel=BuildWeightTemple.Rect("Water sanctuary prompt",canvas,new Vector2(.5f,0),new Vector2(.5f,0),new Vector2(0,24),new Vector2(620,58));
            var backing=panel.gameObject.AddComponent<UnityEngine.UI.Image>();backing.color=Ink;backing.raycastTarget=false;
            var labelRect=BuildWeightTemple.Rect("Water sanctuary prompt text",panel,new Vector2(.5f,.5f),new Vector2(.5f,.5f),Vector2.zero,new Vector2(610,55));
            var label=labelRect.gameObject.AddComponent<TextMeshProUGUI>();
            label.font=font;label.fontSize=22;label.color=Paper;label.alignment=TextAlignmentOptions.Center;
            label.margin=new Vector4(12,6,12,6);label.raycastTarget=false;label.text=WaterSanctuaryEntrance.PromptApproach;
            panel.gameObject.SetActive(false);

            var entrance=temple.gameObject.AddComponent<WaterSanctuaryEntrance>();
            entrance.Configure(player,orbit,doorway,completionSeal,flow,ribbons.ToArray(),panel.gameObject,label);
            temple.gameObject.AddComponent<WaterEntranceSmoke>().Configure(entrance,player,orbit,surface,site.position,site.rotation);
            orbit.ConfigureClimbing(null);EditorUtility.SetDirty(orbit);
            var weight=UnityEngine.Object.FindFirstObjectByType<TempleEntrance>();
            if(weight!=null){weight.ConfigureWaterContext(entrance);EditorUtility.SetDirty(weight);}
            var quest=UnityEngine.Object.FindFirstObjectByType<QuestGuide>();
            if(quest!=null)
            {
                quest.ConfigureWater(entrance);
                foreach(var text in quest.GetComponentsInChildren<TextMeshProUGUI>(true))text.font=font;
                EditorUtility.SetDirty(quest);
            }
            EditorUtility.SetDirty(surface);
            return entrance;
        }

        static Vector3[] Vectors(float[] values)
        {var result=new Vector3[values.Length/3];for(int i=0;i<result.Length;i++)result[i]=new Vector3(values[i*3],values[i*3+1],values[i*3+2]);return result;}
        static void ImportArt(string file,Transform parent,string prefix)
        {
            var data=JsonUtility.FromJson<ArtExport>(File.ReadAllText(Root+"Models/WaterMountain/"+file));
            var mats=new Dictionary<string,Material>();
            foreach(var item in data.materials)
            {
                var mat=Material(item.name,new Color(item.color[0],item.color[1],item.color[2]).gamma,item.metal);
                if(item.name=="Glacier deep blue ice"||item.name=="Glacier pale frost")
                {
                    mat.shader=Shader.Find("Mumu/Fractured Glacier");
                    mat.SetColor("_BaseColor",item.name.Contains("pale")?new Color(.58f,.76f,.82f):new Color(.24f,.52f,.66f));
                    EditorUtility.SetDirty(mat);
                }
                mats[item.name]=mat;
            }
            for(int i=0;i<data.meshes.Length;i++)
            {
                var item=data.meshes[i];string name=prefix+" "+i,path=Output+name+".asset";
                var asset=AssetDatabase.LoadAssetAtPath<Mesh>(path);
                if(asset==null){asset=new Mesh{name=name};AssetDatabase.CreateAsset(asset,path);}else asset.Clear();
                var vertices=Vectors(item.vertices);asset.indexFormat=vertices.Length>65535?IndexFormat.UInt32:IndexFormat.UInt16;
                asset.vertices=vertices;asset.normals=Vectors(item.normals);asset.triangles=item.triangles;
                if(item.uv!=null&&item.uv.Length==vertices.Length*2)
                {var uv=new Vector2[vertices.Length];for(int j=0;j<uv.Length;j++)uv[j]=new Vector2(item.uv[j*2],item.uv[j*2+1]);asset.uv=uv;}
                asset.RecalculateBounds();EditorUtility.SetDirty(asset);
                var obj=new GameObject(name,typeof(MeshFilter),typeof(MeshRenderer));obj.transform.SetParent(parent,false);
                obj.GetComponent<MeshFilter>().sharedMesh=asset;obj.GetComponent<MeshRenderer>().sharedMaterial=mats[item.material];
            }
        }
        static Material Material(string name,Color color,float metallic=0,bool glow=false,bool transparent=false)
        {
            string path=Output+name+".mat";
            var mat=AssetDatabase.LoadAssetAtPath<Material>(path);
            if(mat==null){mat=new Material(Shader.Find("Universal Render Pipeline/Lit"));AssetDatabase.CreateAsset(mat,path);}
            mat.color=color;mat.SetFloat("_Metallic",metallic);mat.SetFloat("_Smoothness",metallic>.3f?.5f:.27f);
            if(glow){mat.EnableKeyword("_EMISSION");mat.SetColor("_EmissionColor",color*1.7f);}
            else{mat.DisableKeyword("_EMISSION");mat.SetColor("_EmissionColor",Color.black);}
            if(transparent)
            {
                mat.SetFloat("_Surface",1);mat.SetFloat("_SrcBlend",(float)BlendMode.SrcAlpha);
                mat.SetFloat("_DstBlend",(float)BlendMode.OneMinusSrcAlpha);mat.SetFloat("_ZWrite",0);
                mat.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");mat.renderQueue=(int)RenderQueue.Transparent;
            }
            EditorUtility.SetDirty(mat);return mat;
        }
        static Transform Shape(PrimitiveType kind,string name,Transform parent,Vector3 point,Vector3 scale,Material mat)
        {
            var obj=GameObject.CreatePrimitive(kind);obj.name=name;obj.transform.SetParent(parent,false);
            obj.transform.localPosition=point;obj.transform.localScale=scale;
            obj.GetComponent<Renderer>().sharedMaterial=mat;
            UnityEngine.Object.DestroyImmediate(obj.GetComponent<Collider>());
            return obj.transform;
        }
        static Mesh AssetMesh(string name,List<Vector3> verts,List<int> indices)
        {
            string path=Output+name+".asset";var mesh=AssetDatabase.LoadAssetAtPath<Mesh>(path);
            if(mesh==null){mesh=new Mesh{name=name};AssetDatabase.CreateAsset(mesh,path);}else mesh.Clear();
            mesh.indexFormat=verts.Count>65535?IndexFormat.UInt32:IndexFormat.UInt16;
            mesh.SetVertices(verts);mesh.SetTriangles(indices,0);mesh.RecalculateNormals();mesh.RecalculateBounds();
            EditorUtility.SetDirty(mesh);return mesh;
        }
        static GameObject MeshObject(string name,Transform parent,Mesh mesh,Material mat,int layer)
        {
            var obj=new GameObject(name,typeof(MeshFilter),typeof(MeshRenderer),typeof(MeshCollider));
            obj.transform.SetParent(parent,false);obj.layer=layer;
            obj.GetComponent<MeshFilter>().sharedMesh=mesh;obj.GetComponent<MeshRenderer>().sharedMaterial=mat;
            obj.GetComponent<MeshCollider>().sharedMesh=mesh;return obj;
        }
        static Transform Marker(string name,Transform parent,Vector3 position)
        {var point=new GameObject(name).transform;point.SetParent(parent,false);point.localPosition=position;return point;}
        static void Solid(Transform parent,string name,Vector3 center,Vector3 size)
        {
            var obj=new GameObject(name);obj.layer=8;obj.transform.SetParent(parent,false);obj.transform.localPosition=center;
            obj.AddComponent<BoxCollider>().size=size;
        }
        // Full-height block from well below the ground to above the glacier crown (7.49m), so the camera stays out of the ice too.
        // The bottom must sit below the footing: on the east slope the ground is under the datum, and a player
        // meeting a box's bottom edge gets a steep contact normal that the elevated walk treats as a ramp.
        static void Span(Transform parent,string name,float x0,float x1,float z0,float z1)=>
            Solid(parent,name,new Vector3((x0+x1)*.5f,1.3f,(z0+z1)*.5f),new Vector3(x1-x0,12.6f,z1-z0));
        static void TempleFloor(PlanetSurface surface,Transform parent,string name,Vector3 position,Vector3 size,Material material)
        {
            var shape=Shape(PrimitiveType.Cube,name,parent,position,size,material);
            shape.gameObject.layer=9;shape.GetComponent<MeshRenderer>().enabled=false;
            var collider=shape.gameObject.AddComponent<MeshCollider>();
            collider.sharedMesh=shape.GetComponent<MeshFilter>().sharedMesh;surface.AddElevated(collider);
        }
        static float PlotGround(PlanetSurface surface,Transform temple,float x,float z)=>
            PlotGround(surface,temple.position,temple.rotation,x,z);
        static Mesh GlacierFooting(PlanetSurface surface,Transform temple)
        {
            const int nx=36,nz=34;var vertices=new List<Vector3>();var indices=new List<int>();
            var colors=new List<Color>();var cachedColors=new Dictionary<Mesh,Color[]>();var cachedTriangles=new Dictionary<Mesh,int[]>();
            for(int iz=0;iz<=nz;iz++)for(int ix=0;ix<=nx;ix++)
            {
                float x=-9+ix*.5f,z=-7+iz*.5f;
                float ground=PlotGround(surface,temple,x,z);
                float blend=Mathf.Max(Mathf.InverseLerp(6,9,Mathf.Abs(x)),z< -3?Mathf.InverseLerp(-3,-7,z):Mathf.InverseLerp(7,10,z));
                float y=Mathf.Max(ground+.018f,Mathf.Lerp(-.015f,ground+.018f,Mathf.SmoothStep(0,1,blend)));
                vertices.Add(new Vector3(x,y,z));
                var terrainColor=new Color(.3f,.4f,.15f);
                if(surface.RaycastTerrain(new Ray(temple.TransformPoint(new Vector3(x,40,z)),-temple.up),out var sample,90)&&sample.collider is MeshCollider mc)
                {
                    var m=mc.sharedMesh;
                    if(!cachedColors.ContainsKey(m)){cachedColors[m]=m.colors;cachedTriangles[m]=m.triangles;}
                    var cs=cachedColors[m];var ts=cachedTriangles[m];int t=sample.triangleIndex*3;
                    if(cs.Length==m.vertexCount&&t>=0&&t+2<ts.Length)
                        terrainColor=cs[ts[t]]*sample.barycentricCoordinate.x+cs[ts[t+1]]*sample.barycentricCoordinate.y+cs[ts[t+2]]*sample.barycentricCoordinate.z;
                }
                colors.Add(Color.Lerp(new Color(.48f,.65f,.68f),terrainColor,Mathf.SmoothStep(0,1,Mathf.InverseLerp(.12f,.95f,blend))));
            }
            for(int iz=0;iz<nz;iz++)for(int ix=0;ix<nx;ix++)
            {int i=iz*(nx+1)+ix;indices.AddRange(new[]{i,i+nx+1,i+1,i+1,i+nx+1,i+nx+2});}
            var mesh=AssetMesh("Ground conforming glacier footing v02",vertices,indices);mesh.SetColors(colors);EditorUtility.SetDirty(mesh);return mesh;
        }
        // Static Korean atlas shared with the quest card. Extends the existing asset; glyphs are never removed.
        static TMP_FontAsset WaterFont()
        {
            string path=Output+"WaterMountainKoreanV03.asset";
            var font=AssetDatabase.LoadAssetAtPath<TMP_FontAsset>(path);
            if(font==null)
            {
                var fontSource=AssetDatabase.LoadAssetAtPath<Font>(Root+"Fonts/NanumGothic-Regular.ttf");
                font=TMP_FontAsset.CreateFontAsset(fontSource,48,5,UnityEngine.TextCore.LowLevel.GlyphRenderMode.SDFAA,
                    2048,2048,AtlasPopulationMode.Dynamic);
                font.name="Water mountain Korean";AssetDatabase.CreateAsset(font,path);
            }
            font.atlasPopulationMode=AtlasPopulationMode.Dynamic;
            string source=File.ReadAllText(Root+"Editor/BuildWaterSanctuaryExterior.cs")+
                File.ReadAllText(Root+"Runtime/WaterSanctuaryEntrance.cs")+
                File.ReadAllText(Root+"Runtime/QuestGuide.cs");
            string authored=new string(source.Where(char.IsLetterOrDigit).Distinct().ToArray())+" ◀▶°·+-:%/.()";
            ShadowFonts.Extend(font,authored,"WATER_FONT_MISSING");
            font.atlasPopulationMode=AtlasPopulationMode.Static;
            foreach(var atlas in font.atlasTextures)
            {if(AssetDatabase.GetAssetPath(atlas)!=path)AssetDatabase.AddObjectToAsset(atlas,font);EditorUtility.SetDirty(atlas);}
            if(AssetDatabase.GetAssetPath(font.material)!=path)AssetDatabase.AddObjectToAsset(font.material,font);
            EditorUtility.SetDirty(font);return font;
        }
    }
}
