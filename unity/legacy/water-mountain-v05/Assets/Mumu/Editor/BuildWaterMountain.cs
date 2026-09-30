using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.UI;
using TMPro;
using Mumu.Planet;

namespace Mumu.Editor
{
    // Targeted editor generation: keeps the existing planet, nature and weight sanctuary intact.
    public static class BuildWaterMountain
    {
        const string Root="Assets/Mumu/",Output=Root+"Generated/WaterMountain/";
        [Serializable] class SurfaceInfo {public string name;public float[] color;public float metal;}
        [Serializable] class GeometryInfo {public string material;public float[] vertices,normals,uv;public int[] triangles;}
        [Serializable] class Anchors {public Vector3 ground,mirror;public Vector3[] holds,walk;}
        [Serializable] class MountainExport {public SurfaceInfo[] materials;public GeometryInfo[] meshes;public Anchors anchors;}
        static Vector3[] Vectors(float[] values)
        {var result=new Vector3[values.Length/3];for(int i=0;i<result.Length;i++)result[i]=new Vector3(values[i*3],values[i*3+1],values[i*3+2]);return result;}
        static Anchors ImportBlenderMountain(Transform root,PlanetSurface surface)
        {
            string source=Root+"Models/WaterMountain/water-mountain-v03.json";
            if(!File.Exists(source))throw new FileNotFoundException("Generate the authored Blender cliff first.",source);
            var data=JsonUtility.FromJson<MountainExport>(File.ReadAllText(source));
            if(data.anchors==null||data.anchors.holds.Length!=10||data.anchors.walk.Length!=6)
                throw new InvalidDataException("Blender traversal anchors are missing or invalid.");
            var mats=new Dictionary<string,Material>();
            foreach(var item in data.materials)
                mats[item.name]=Material(item.name,new Color(item.color[0],item.color[1],item.color[2]).gamma,item.metal);
            var group=new GameObject("Blender sculpted fractured cliff").transform;group.SetParent(root,false);
            for(int i=0;i<data.meshes.Length;i++)
            {
                var item=data.meshes[i];var vertices=Vectors(item.vertices);
                string name="Blender cliff batch "+i;string path=Output+name+".asset";
                var asset=AssetDatabase.LoadAssetAtPath<Mesh>(path);
                if(asset==null){asset=new Mesh{name=name};AssetDatabase.CreateAsset(asset,path);}else asset.Clear();
                asset.indexFormat=vertices.Length>65535?IndexFormat.UInt32:IndexFormat.UInt16;
                asset.vertices=vertices;asset.normals=Vectors(item.normals);asset.triangles=item.triangles;
                asset.RecalculateBounds();EditorUtility.SetDirty(asset);
                var obj=new GameObject(name,typeof(MeshFilter),typeof(MeshRenderer));obj.transform.SetParent(group,false);
                obj.GetComponent<MeshFilter>().sharedMesh=asset;
                obj.GetComponent<MeshRenderer>().sharedMaterial=mats[item.material];
                obj.GetComponent<MeshRenderer>().enabled=false;
                if(!item.material.Contains("moss")&&!item.material.Contains("grass"))
                {
                    obj.layer=8;
                    var collision=obj.AddComponent<MeshCollider>();collision.sharedMesh=asset;
                    surface.AddElevated(collision);
                }
            }
            ImportArt("water-mountain-v05.json",root,"Designed continuous cliff v05");
            return data.anchors;
        }
        static void ImportArt(string file,Transform parent,string prefix)
        {
            var data=JsonUtility.FromJson<MountainExport>(File.ReadAllText(Root+"Models/WaterMountain/"+file));
            var mats=new Dictionary<string,Material>();
            var texture=AssetDatabase.LoadAssetAtPath<Texture2D>(Root+"Models/WaterMountain/sandstone-detail-v04.png");
            foreach(var item in data.materials)
            {
                var mat=Material(item.name,new Color(item.color[0],item.color[1],item.color[2]).gamma,item.metal);
                if(item.name.Contains("sandstone"))mat.SetTexture("_BaseMap",texture);
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
        static float TerrainY(PlanetSurface surface,Transform root,float x,float z)
            =>root.InverseTransformPoint(surface.Point(root.TransformPoint(new Vector3(x,0,z)))).y;
        static Mesh StonePath(Vector3[] route)
        {
            var verts=new List<Vector3>();var tris=new List<int>();
            for(int i=0;i<route.Length-2;i++)
            {
                Vector3 start=route[i],end=route[i+1];
                Vector3 forward=Vector3.ProjectOnPlane(end-start,Vector3.up).normalized;
                Vector3 side=Vector3.Cross(Vector3.up,forward).normalized;
                float width=.92f;
                int n=verts.Count;
                verts.Add(start-side*width*.5f);verts.Add(start+side*width*.5f);
                verts.Add(end-side*width*.5f);verts.Add(end+side*width*.5f);
                tris.AddRange(new[]{n,n+2,n+1,n+1,n+2,n+3});
            }
            for(int i=0;i<route.Length;i++)
            {
                int n=verts.Count;Vector3 center=route[i];
                verts.Add(center);
                for(int j=0;j<10;j++)
                {
                    float angle=j*Mathf.PI*2/10;float radius=i==route.Length-1?1.45f:.64f;
                    verts.Add(center+new Vector3(Mathf.Cos(angle)*radius,0,Mathf.Sin(angle)*radius));
                }
                for(int j=0;j<10;j++)tris.AddRange(new[]{n,n+1+(j+1)%10,n+1+j});
            }
            return AssetMesh("Narrow ascending stone route",verts,tris);
        }
        static TextMeshProUGUI Label(Transform parent,string name,string value,Vector2 anchor,Vector2 pos,Vector2 size,int fontSize,TMP_FontAsset font)
        {
            var go=new GameObject(name,typeof(RectTransform),typeof(TextMeshProUGUI));go.transform.SetParent(parent,false);
            var rect=(RectTransform)go.transform;rect.anchorMin=rect.anchorMax=anchor;rect.anchoredPosition=pos;rect.sizeDelta=size;
            var text=go.GetComponent<TextMeshProUGUI>();text.font=font;text.fontSize=fontSize;text.color=new Color(.97f,.92f,.80f);
            text.alignment=TextAlignmentOptions.Center;text.enableWordWrapping=true;text.text=value;return text;
        }
        static Button Button(Transform parent,string name,string label,Vector2 pos,Vector2 size,TMP_FontAsset font)
        {
            var go=new GameObject(name,typeof(RectTransform),typeof(Image),typeof(Button));go.transform.SetParent(parent,false);
            var rect=(RectTransform)go.transform;rect.anchorMin=rect.anchorMax=new Vector2(.5f,.5f);rect.anchoredPosition=pos;rect.sizeDelta=size;
            go.GetComponent<Image>().color=new Color(.12f,.30f,.35f,.96f);
            Label(go.transform,"Label",label,new Vector2(.5f,.5f),Vector2.zero,size*.9f,19,font);
            return go.GetComponent<Button>();
        }
        static LineRenderer Line(string name,Material mat,float width,bool active)
        {
            var line=new GameObject(name).AddComponent<LineRenderer>();line.positionCount=2;line.widthMultiplier=width;
            line.sharedMaterial=mat;line.numCornerVertices=4;line.numCapVertices=5;line.shadowCastingMode=ShadowCastingMode.Off;
            line.enabled=active;return line;
        }
        static Transform Marker(string name,Transform parent,Vector3 position)
        {
            var point=new GameObject(name).transform;point.SetParent(parent,false);point.localPosition=position;return point;
        }
        static void SetOccupiedNature(Transform root,bool active)
        {
            // Keep the original nature objects; restore them when the temporary
            // mountain is removed from the playable scene.
            foreach(var groupName in new[]{"Blender nature · original placement","Nature collisions"})
            {
                var group=GameObject.Find(groupName);if(group==null)continue;
                foreach(Transform item in group.transform)
                {
                    var local=root.InverseTransformPoint(item.position);
                    bool inside=(local.x>-10&&local.x<11&&local.z>-11&&local.z<15)||
                        (local.x>=10&&local.x<26&&local.z>0&&local.z<14);
                    if(inside)item.gameObject.SetActive(active);
                }
            }
        }
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
            string source=File.ReadAllText(Root+"Editor/BuildWaterMountain.cs")+
                File.ReadAllText(Root+"Runtime/WaterMountainTrial.cs")+
                File.ReadAllText(Root+"Runtime/MountainClimbController.cs")+
                File.ReadAllText(Root+"Runtime/QuestGuide.cs");
            string authored=new string(source.Where(char.IsLetterOrDigit).Distinct().ToArray())+" ◀▶°·+-:%/.()";
            var glyphs=new string(new HashSet<char>(authored).ToArray());
            font.TryAddCharacters(glyphs,out string missing);
            if(!string.IsNullOrEmpty(missing))Debug.LogWarning("WATER_FONT_MISSING "+missing);
            font.atlasPopulationMode=AtlasPopulationMode.Static;
            foreach(var atlas in font.atlasTextures)
            {if(AssetDatabase.GetAssetPath(atlas)!=path)AssetDatabase.AddObjectToAsset(atlas,font);EditorUtility.SetDirty(atlas);}
            if(AssetDatabase.GetAssetPath(font.material)!=path)AssetDatabase.AddObjectToAsset(font.material,font);
            EditorUtility.SetDirty(font);return font;
        }
        public static void Populate()
        {
            var surface=UnityEngine.Object.FindFirstObjectByType<PlanetSurface>();
            var player=UnityEngine.Object.FindFirstObjectByType<PlanetExplorer>();
            var orbit=UnityEngine.Object.FindFirstObjectByType<OrbitCamera>();
            if(surface==null||player==null||orbit==null)throw new InvalidOperationException("Planet exploration scene must be open.");
            Directory.CreateDirectory(Output);AssetDatabase.Refresh();
            var previous=GameObject.Find("Water mountain chapter");
            if(previous!=null)
            {
                SetOccupiedNature(previous.transform,true);
                foreach(var collider in previous.GetComponentsInChildren<MeshCollider>())surface.RemoveElevated(collider);
                UnityEngine.Object.DestroyImmediate(previous);
            }
            // Removal preserves the sanctuary as a standalone object. Replace
            // that generated copy when rebuilding the complete chapter.
            var sanctuary=GameObject.Find("Frozen water sanctuary");
            if(sanctuary!=null)UnityEngine.Object.DestroyImmediate(sanctuary);
            // HUD canvases are screen-space roots, so remove every older generated copy too.
            GameObject olderHud;
            while((olderHud=GameObject.Find("Water mountain HUD"))!=null)
                UnityEngine.Object.DestroyImmediate(olderHud);
            var basePoint=surface.Point(player.transform.position+player.transform.forward*24+player.transform.right*13);
            var up=basePoint.normalized;var forward=Vector3.ProjectOnPlane(player.transform.forward,up).normalized;
            var root=new GameObject("Water mountain chapter").transform;
            root.SetPositionAndRotation(basePoint,Quaternion.LookRotation(forward,up));
            // The planet has real relief. Seat the authored first grip at the
            // actual terrain height instead of burying it on a nearby ridge.
            root.position+=root.up*TerrainY(surface,root,-5.2f,-5.4f);
            SetOccupiedNature(root,false);
            var anchors=ImportBlenderMountain(root,surface);
            var route=anchors.walk;
            var rock=Material("Mountain layered blue granite",new Color(.31f,.38f,.42f));
            var pale=Material("Cut limestone",new Color(.69f,.72f,.67f));
            var seam=Material("Mountain blue seam",new Color(.23f,.43f,.47f),.19f);
            var bronze=Material("Solar mirror bronze",new Color(.67f,.42f,.16f),.72f);
            var gold=Material("Sun path gold",new Color(1f,.73f,.2f),.16f,true,true);
            var mirrorMetal=Material("Reflective mirror face",new Color(.81f,.72f,.48f),.86f);
            var iceMat=Material("Temple translucent ice",new Color(.27f,.84f,.92f,.84f),.12f,false,true);
            var water=Material("Melted flowing water",new Color(.12f,.63f,.77f,.82f),.2f,true,true);
            var walkway=MeshObject("Invisible collider fitted to carved cliff path",root,StonePath(route),pale,9);
            walkway.GetComponent<MeshRenderer>().enabled=false;
            surface.AddElevated(walkway.GetComponent<MeshCollider>());
            var climb=Marker("Cliff foot grab point",root,anchors.ground);
            var landing=Marker("First cliff mantle",root,route[0]);
            var checkpoint=Marker("Safe middle ledge",root,route[2]);
            var holds=new Transform[anchors.holds.Length];
            for(int i=0;i<holds.Length;i++)holds[i]=Marker("Rock handhold "+i,root,anchors.holds[i]);
            var walkPoints=new Transform[route.Length];
            for(int i=0;i<route.Length;i++)walkPoints[i]=Marker("Carved walking shelf "+i,root,route[i]);
            var summit=route[route.Length-1];
            var pedestalBase=new Vector3(anchors.mirror.x,summit.y,anchors.mirror.z);
            float pedestalHeight=anchors.mirror.y-summit.y;
            ImportArt("solar-altar-v04.json",root,"Blender solar altar");
            var mirror=Marker("Controllable sun mirror pivot",root,anchors.mirror);
            var mirrorFace=Marker("Adjustable reflective surface",mirror,Vector3.zero);
            ImportArt("solar-mirror-v04.json",mirrorFace,"Blender engraved solar mirror");
            AddTemple(surface,root,rock,pale,seam,bronze,gold,iceMat,water,player,orbit,route,climb,landing,checkpoint,mirror,mirrorFace,holds,walkPoints);
        }
        static float PlotGround(PlanetSurface surface,Transform temple,float x,float z)
        {
            var ray=new Ray(temple.TransformPoint(new Vector3(x,40,z)),-temple.up);
            if(!surface.RaycastTerrain(ray,out var hit,90))throw new InvalidOperationException("No terrain below sanctuary footprint");
            return temple.InverseTransformPoint(hit.point).y;
        }
        static Mesh GlacierFooting(PlanetSurface surface,Transform temple)
        {
            const int nx=36,nz=34;var vertices=new List<Vector3>();var indices=new List<int>();
            var colors=new List<Color>();var cachedColors=new Dictionary<Mesh,Color[]>();var cachedTriangles=new Dictionary<Mesh,int[]>();
            for(int iz=0;iz<=nz;iz++)for(int ix=0;ix<=nx;ix++)
            {
                float x=-9+ix*.5f,z=-7+iz*.5f;
                float ground=PlotGround(surface,temple,x,z);
                float blend=Mathf.Max(Mathf.InverseLerp(6,9,Mathf.Abs(x)),z<-3?Mathf.InverseLerp(-3,-7,z):Mathf.InverseLerp(7,10,z));
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
        static void TempleFloor(PlanetSurface surface,Transform parent,string name,Vector3 position,Vector3 size,Material material)
        {
            var shape=Shape(PrimitiveType.Cube,name,parent,position,size,material);
            shape.gameObject.layer=9;shape.GetComponent<MeshRenderer>().enabled=false;
            var collider=shape.gameObject.AddComponent<MeshCollider>();
            collider.sharedMesh=shape.GetComponent<MeshFilter>().sharedMesh;surface.AddElevated(collider);
        }
        static void AddTemple(PlanetSurface surface,Transform root,Material rock,Material pale,Material seam,Material bronze,
            Material gold,Material iceMat,Material water,PlanetExplorer player,OrbitCamera orbit,Vector3[] route,
            Transform climb,Transform landing,Transform checkpoint,Transform mirror,Transform mirrorFace,Transform[] holds,Transform[] walkPoints)
        {
            var temple=new GameObject("Frozen water sanctuary").transform;temple.SetParent(root,false);
            var recess=Material("Revealed deep water portal",new Color(.025f,.13f,.19f),.15f);
            var frost=Material("Glacial bright rim",new Color(.69f,.93f,.95f),.16f);
            var ground=surface.TerrainPoint(root.TransformPoint(new Vector3(19,0,7)));
            var groundUp=ground.normalized;
            temple.SetPositionAndRotation(ground,Quaternion.LookRotation(Vector3.ProjectOnPlane(ground-root.position,groundUp).normalized,groundUp));
            // Level the building plot using its complete footprint, never a single centre sample.
            float plotHeight=0;
            for(int x=-6;x<=6;x+=2)for(int z=-3;z<=7;z+=2)
                plotHeight=Mathf.Max(plotHeight,PlotGround(surface,temple,x,z));
            temple.position+=temple.up*(plotHeight+.04f);
            var apronMaterial=Material("Glacier grounded apron",new Color(.38f,.59f,.63f));
            apronMaterial.shader=Shader.Find("Mumu/World Vertex");apronMaterial.SetColor("_BaseColor",Color.white);EditorUtility.SetDirty(apronMaterial);
            var apron=MeshObject("Terrain fitted glacier footing",temple,GlacierFooting(surface,temple),apronMaterial,9);
            surface.AddElevated(apron.GetComponent<MeshCollider>());
            var architecture=new GameObject("Blender glacier sanctuary").transform;architecture.SetParent(temple,false);
            ImportArt("glacier-temple-v03.json",architecture,"Glacier sanctuary v03");
            TempleFloor(surface,temple,"Sanctuary foundation collision",new Vector3(0,.55f,1.925f),new Vector3(7.2f,1.1f,5.75f),pale);
            for(int i=0;i<3;i++)TempleFloor(surface,temple,"Approach stair collision "+i,
                new Vector3(0,(i+1)*.275f/2,-2.4f+i*.6f),new Vector3(2.4f,(i+1)*.275f,.64f),pale);
            for(int side=-1;side<=1;side+=2)
            {
                var wall=new GameObject("Sanctuary side collision");wall.transform.SetParent(temple,false);
                wall.transform.localPosition=new Vector3(side*2.95f,3.35f,2.4f);wall.layer=8;
                wall.AddComponent<BoxCollider>().size=new Vector3(1.3f,4.5f,4.8f);
            }
            var ice=new GameObject("Glacial gate shell");ice.transform.SetParent(temple,false);
            var rear=new GameObject("Sanctuary rear collision");rear.transform.SetParent(temple,false);
            rear.transform.localPosition=new Vector3(0,3.3f,4.65f);rear.layer=8;
            rear.AddComponent<BoxCollider>().size=new Vector3(5.7f,4.3f,.3f);
            ice.transform.localPosition=new Vector3(0,3.17f,-.1f);ice.layer=8;
            var iceCollider=ice.AddComponent<BoxCollider>();iceCollider.size=new Vector3(3.35f,4.1f,.7f);
            ImportArt("glacier-seal-v03.json",ice.transform,"Continuous glacier seal v03");
            var seal=ice.GetComponentInChildren<MeshRenderer>();
            var sealMaterial=Material("Glacier thaw surface",new Color(.22f,.62f,.73f));
            sealMaterial.shader=Shader.Find("Mumu/Glacial Seal");
            if(sealMaterial.shader==null)throw new InvalidOperationException("Glacial seal shader missing");
            sealMaterial.SetColor("_BaseColor",new Color(.22f,.62f,.73f));EditorUtility.SetDirty(sealMaterial);
            seal.sharedMaterial=sealMaterial;
            var warmth=Line("Sun warmed melt edge",gold,.035f,false);warmth.transform.SetParent(ice.transform,false);
            warmth.useWorldSpace=false;warmth.positionCount=49;warmth.enabled=false;
            var receiver=Marker("Sunlight target in ice",temple,new Vector3(0,3f,-.52f));
            var entrance=Marker("Revealed sanctuary entrance",temple,new Vector3(0,1.12f,-.45f));
            var completionSeal=new GameObject("Water wisdom completion seal");completionSeal.transform.SetParent(temple,false);
            var sealedStone=Material("Water wisdom sealed stone",new Color(.055f,.18f,.22f),.34f);
            var sealedPanel=Shape(PrimitiveType.Cube,"Sealed water doorway",completionSeal.transform,
                new Vector3(0,3,-.29f),new Vector3(2.9f,4f,.12f),sealedStone);
            sealedPanel.gameObject.layer=8;sealedPanel.gameObject.AddComponent<BoxCollider>();
            var sealRing=WaterInteriorArt.Import("water-deity-halo-v03",completionSeal.transform);
            sealRing.localPosition=new Vector3(0,.36f,-1.02f);
            completionSeal.SetActive(false);
            var flow=new GameObject("Melted water ribbons");flow.transform.SetParent(temple,false);
            for(int side=-1;side<=1;side+=2)
            {
                Shape(PrimitiveType.Cube,"Side thaw channel",flow.transform,new Vector3(side*1.85f,1.13f,-.5f),new Vector3(.22f,.025f,1f),water);
                Shape(PrimitiveType.Cube,"Threshold cascade",flow.transform,new Vector3(side*1.85f,.65f,-1f),new Vector3(.20f,.95f,.035f),water);
                Shape(PrimitiveType.Cube,"Basin runoff",flow.transform,new Vector3(side*1.85f,.24f,-2f),new Vector3(.22f,.025f,2.7f),water);
            }
            flow.SetActive(false);
            var reflected=Line("Golden reflected beam",gold,.16f,false);reflected.transform.SetParent(root,false);
            var incident=Line("Sunlight arriving at mirror",gold,.08f,true);incident.transform.SetParent(root,false);
            incident.useWorldSpace=true;incident.SetPosition(0,mirror.position+root.up*13-root.right*8);
            incident.SetPosition(1,mirror.position);
            var canvas=new GameObject("Water mountain HUD",typeof(Canvas),typeof(CanvasScaler),typeof(GraphicRaycaster)).GetComponent<Canvas>();
            canvas.renderMode=RenderMode.ScreenSpaceOverlay;canvas.sortingOrder=32;
            canvas.GetComponent<CanvasScaler>().uiScaleMode=CanvasScaler.ScaleMode.ScaleWithScreenSize;
            canvas.GetComponent<CanvasScaler>().referenceResolution=new Vector2(1440,900);
            var font=WaterFont();
            var mission=new GameObject("Water mission backdrop",typeof(RectTransform),typeof(Image));mission.transform.SetParent(canvas.transform,false);
            var missionRect=(RectTransform)mission.transform;missionRect.anchorMin=missionRect.anchorMax=new Vector2(0,1);
            missionRect.anchoredPosition=new Vector2(219,-190);missionRect.sizeDelta=new Vector2(410,155);
            mission.GetComponent<Image>().color=new Color(.035f,.12f,.16f,.87f);
            var objective=Label(mission.transform,"Water mountain objective","돌산을 올라 태양 거울 찾기",new Vector2(.5f,1),new Vector2(0,-32),new Vector2(390,44),21,font);
            var feedback=Label(mission.transform,"Water mountain hint","",new Vector2(.5f,1),new Vector2(0,-88),new Vector2(390,65),16,font);
            var preparation=new GameObject("Leap preparation track",typeof(RectTransform),typeof(Image));preparation.transform.SetParent(mission.transform,false);
            var prepRect=(RectTransform)preparation.transform;prepRect.anchorMin=prepRect.anchorMax=new Vector2(.5f,0);prepRect.anchoredPosition=new Vector2(0,14);prepRect.sizeDelta=new Vector2(370,8);
            preparation.GetComponent<Image>().color=new Color(.1f,.25f,.29f);
            var fillObject=new GameObject("Leap preparation fill",typeof(RectTransform),typeof(Image));fillObject.transform.SetParent(preparation.transform,false);
            var fillRect=(RectTransform)fillObject.transform;fillRect.anchorMin=Vector2.zero;fillRect.anchorMax=Vector2.one;fillRect.offsetMin=fillRect.offsetMax=Vector2.zero;fillRect.pivot=new Vector2(0,.5f);
            var preparationFill=fillObject.GetComponent<Image>();preparationFill.raycastTarget=false;
            mission.GetComponent<Image>().raycastTarget=false;preparation.GetComponent<Image>().raycastTarget=false;
            var panel=new GameObject("Mirror aiming controls",typeof(RectTransform),typeof(Image));panel.transform.SetParent(canvas.transform,false);
            var rect=(RectTransform)panel.transform;rect.anchorMin=rect.anchorMax=new Vector2(1,0);rect.anchoredPosition=new Vector2(-290,180);rect.sizeDelta=new Vector2(530,220);
            panel.GetComponent<Image>().color=new Color(.035f,.13f,.18f,.92f);
            var angleText=Label(panel.transform,"Mirror angle","",new Vector2(.5f,.5f),new Vector2(0,78),new Vector2(500,40),19,font);
            var left=Button(panel.transform,"Turn mirror left","◀ 좌",new Vector2(-180,8),new Vector2(110,48),font);
            var right=Button(panel.transform,"Turn mirror right","우 ▶",new Vector2(-54,8),new Vector2(110,48),font);
            var fire=Button(panel.transform,"Release sunlight","빛 발사",new Vector2(95,8),new Vector2(152,48),font);
            var close=Button(panel.transform,"Leave mirror","놓기",new Vector2(198,-73),new Vector2(112,42),font);
            Label(panel.transform,"Mirror instructions","A/D 좌우 · W/S 높이 · Space 빛 발사 · E 놓기",new Vector2(.5f,.5f),new Vector2(-48,-72),new Vector2(375,48),17,font);
            panel.SetActive(false);
            var trial=root.gameObject.AddComponent<WaterMountainTrial>();
            trial.Configure(player,orbit,root,climb,landing,checkpoint,mirror,mirrorFace,receiver,entrance,
                iceCollider,ice,flow,reflected,incident,objective,feedback,angleText,panel,fire,left,right,close);
            var climbController=root.gameObject.AddComponent<MountainClimbController>();
            climbController.Configure(player,root,climb,holds,walkPoints,player.GetComponentInChildren<NavigatorPose>());
            trial.ConfigureClimbing(climbController);
            var thaw=root.gameObject.AddComponent<IceThawPresentation>();
            thaw.Configure(Array.Empty<Transform>(),flow.transform.Cast<Transform>().ToArray(),warmth);
            thaw.ConfigureSeal(seal);
            trial.ConfigureThaw(thaw);
            trial.ConfigureCompletionSeal(completionSeal);
            trial.ConfigurePresentation(mission,preparationFill);
            orbit.ConfigureClimbing(climbController);EditorUtility.SetDirty(orbit);
            var entrancePrompt=UnityEngine.Object.FindFirstObjectByType<TempleEntrance>();
            if(entrancePrompt!=null){entrancePrompt.ConfigureWaterContext(trial);EditorUtility.SetDirty(entrancePrompt);}
            root.gameObject.AddComponent<WaterMountainSmoke>().Configure(trial,player,orbit,surface);
            var quest=UnityEngine.Object.FindFirstObjectByType<QuestGuide>();
            if(quest!=null)
            {
                quest.ConfigureWater(trial);
                foreach(var text in quest.GetComponentsInChildren<TextMeshProUGUI>(true))text.font=font;
            }
            EditorUtility.SetDirty(surface);if(quest!=null)EditorUtility.SetDirty(quest);
            AssetDatabase.SaveAssets();
            Debug.Log("WATER_MOUNTAIN_READY route="+route.Length+" mirror="+mirror.position+" ice="+ice.transform.position);
        }
        [MenuItem("Mumu/Build water mountain approach")]
        public static void CreateAndBuild()
        {
            var scene=EditorSceneManager.OpenScene(Root+"Scenes/PlanetExploration.unity");
            Populate();EditorSceneManager.SaveScene(scene);BuildExploration.BuildWindows();
        }
        [MenuItem("Mumu/Temporarily remove water mountain")]
        public static void RemoveAndBuild()
        {
            var scene=EditorSceneManager.OpenScene(Root+"Scenes/PlanetExploration.unity");
            var surface=UnityEngine.Object.FindFirstObjectByType<PlanetSurface>();
            var mountain=scene.GetRootGameObjects().FirstOrDefault(item=>item.name=="Water mountain chapter");
            var sanctuary=scene.GetRootGameObjects().FirstOrDefault(item=>item.name=="Frozen water sanctuary");
            if(mountain==null&&sanctuary==null)
            {
                // Rebuild the generated chapter only in memory to recover the
                // independent sanctuary exterior, then remove its cliff route.
                Populate();
                mountain=scene.GetRootGameObjects().FirstOrDefault(item=>item.name=="Water mountain chapter");
            }
            if(mountain!=null)
            {
                var temple=mountain.transform.Find("Frozen water sanctuary");
                if(temple!=null&&sanctuary==null)temple.SetParent(null,true);
                SetOccupiedNature(mountain.transform,true);
                if(surface!=null)
                    foreach(var collider in mountain.GetComponentsInChildren<MeshCollider>(true))
                        surface.RemoveElevated(collider);
                UnityEngine.Object.DestroyImmediate(mountain);
            }
            foreach(var hud in scene.GetRootGameObjects().Where(item=>item.name=="Water mountain HUD").ToArray())
                UnityEngine.Object.DestroyImmediate(hud);
            var quest=UnityEngine.Object.FindFirstObjectByType<QuestGuide>();
            if(quest!=null){quest.ConfigureWater(null);EditorUtility.SetDirty(quest);}
            if(surface!=null)EditorUtility.SetDirty(surface);
            EditorSceneManager.SaveScene(scene);
            BuildExploration.BuildWindows();
            Debug.Log("WATER_MOUNTAIN_REMOVED_FROM_SCENE sanctuary_preserved=true source_art_preserved=true");
        }
    }
}
