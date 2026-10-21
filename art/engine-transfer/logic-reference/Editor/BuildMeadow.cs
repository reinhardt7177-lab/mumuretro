using System;
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using Mumu.Planet;

namespace Mumu.Editor
{
    public static class BuildMeadow
    {
        const string Root="Assets/Mumu/Generated/Meadow/";
        [Serializable] sealed class LeafLibrary { public LeafProfile[] profiles; }
        [Serializable] sealed class LeafProfile { public string name;public float[] positions,normals,weights;public int[] indices; }
        sealed class Patch
        {
            public readonly List<Vector3> vertices=new(),normals=new(),roots=new();
            public readonly List<Vector2> uv=new();
            public readonly List<Vector4> detail=new();
            public readonly List<Color> colors=new();
            public readonly List<int> indices=new();
        }
        static T Store<T>(T asset,string name) where T:UnityEngine.Object
        {
            var existing=AssetDatabase.LoadAssetAtPath<T>(Root+name);
            if(existing!=null){EditorUtility.CopySerialized(asset,existing);UnityEngine.Object.DestroyImmediate(asset);return existing;}
            AssetDatabase.CreateAsset(asset,Root+name);return asset;
        }
        public static void Populate()
        {
            var old=GameObject.Find("Wind meadow");if(old!=null)UnityEngine.Object.DestroyImmediate(old);
            Directory.CreateDirectory(Root);AssetDatabase.Refresh();
            var shader=Shader.Find("Mumu/Meadow Wind");if(shader==null)throw new Exception("Missing grass shader");
            var material=Store(new Material(shader){name="Living meadow"},"Wind.mat");
            var library=JsonUtility.FromJson<LeafLibrary>(File.ReadAllText("Assets/Mumu/Models/Meadow/leaf-profiles.json"));
            if(library.profiles==null||library.profiles.Length!=4)throw new Exception("Generate the Blender meadow leaf library first");
            foreach(var profile in library.profiles)
                if(profile.weights.Length!=19||profile.positions.Length!=57||profile.normals.Length!=57)throw new Exception("Invalid Blender leaf profile "+profile.name);
            var grass=GameObject.Find("Grass surface").GetComponent<MeshFilter>().sharedMesh;
            var ground=GameObject.Find("Authored terrain").GetComponent<MeshFilter>().sharedMesh;
            var actor=UnityEngine.Object.FindFirstObjectByType<PlanetExplorer>();
            var origin=actor.transform.position;var heading=actor.transform.forward;
            var portal=UnityEngine.Object.FindFirstObjectByType<TempleEntrance>();
            var entrance=portal!=null?portal.transform.position:origin+heading*6;
            var vertices=grass.vertices;var terrain=ground.vertices;var triangles=grass.triangles;var colors=grass.colors;
            var random=new System.Random(57219);float Rand()=> (float)random.NextDouble();
            var patches=new Dictionary<Vector3Int,Patch>();
            var overlaps=new Collider[8];int blades=0,plumes=0;
            Physics.SyncTransforms();
            for(int t=0;t<triangles.Length;t+=3)
            {
                int ia=triangles[t],ib=triangles[t+1],ic=triangles[t+2];
                var a=vertices[ia];var b=vertices[ib];var c=vertices[ic];
                // The authored carpet sinks below bare soil and paths; keep it authoritative.
                if(Mathf.Max(a.magnitude-terrain[ia].magnitude,Mathf.Max(b.magnitude-terrain[ib].magnitude,c.magnitude-terrain[ic].magnitude))<.025f)continue;
                if(Vector3.Distance((a+b+c)/3,origin)>42f)continue;
                float area=Vector3.Cross(b-a,c-a).magnitude*.5f;
                int count=Mathf.FloorToInt(area*58+Rand());
                for(int i=0;i<count;i++)
                {
                    float u=Mathf.Sqrt(Rand()),v=Rand();
                    var point=a*(1-u)+b*(u*(1-v))+c*(u*v);
                    var soil=terrain[ia]*(1-u)+terrain[ib]*(u*(1-v))+terrain[ic]*(u*v);
                    float cover=Mathf.SmoothStep(0,1,Mathf.InverseLerp(.025f,.10f,point.magnitude-soil.magnitude));
                    if(Rand()>cover)continue;
                    float extent=Vector3.Distance(point,origin);
                    if(extent>40||Rand()<Mathf.SmoothStep(0,1,Mathf.InverseLerp(35,40,extent)))continue;
                    var up=point.normalized;
                    var toPortal=Vector3.ProjectOnPlane(entrance-origin,origin.normalized);
                    var local=Vector3.ProjectOnPlane(point-origin,origin.normalized);
                    float along=Vector3.Dot(local,toPortal.normalized);
                    float side=(local-toPortal.normalized*Mathf.Clamp(along,0,toPortal.magnitude)).magnitude;
                    float edge=Mathf.Min(side-.95f,Vector3.Distance(point,entrance)-2.15f);
                    if(Rand()>Mathf.SmoothStep(0,1,Mathf.Clamp01(edge/.65f)))continue;
                    if(Physics.OverlapSphereNonAlloc(point+up*.15f,.15f,overlaps,1<<8,QueryTriggerInteraction.Ignore)>0)continue;
                    var key=new Vector3Int(Mathf.FloorToInt(point.x/6),Mathf.FloorToInt(point.y/6),Mathf.FloorToInt(point.z/6));
                    if(!patches.TryGetValue(key,out var patch)){patch=new Patch();patches.Add(key,patch);}
                    var tangent=Vector3.Cross(up,Mathf.Abs(up.y)<.95f?Vector3.up:Vector3.right).normalized;
                    var across=Quaternion.AngleAxis(Rand()*360,up)*tangent;
                    float cluster=Mathf.PerlinNoise(Vector3.Dot(point,new Vector3(.19f,.13f,.07f))+21,Vector3.Dot(point,new Vector3(-.05f,.09f,.21f))+37);
                    float lush=Mathf.SmoothStep(0,1,Mathf.InverseLerp(.30f,.68f,cluster));
                    bool plume=Rand()<lush*.12f && edge>.55f;
                    float h=(plume?Mathf.Lerp(.78f,1.12f,Rand()):Mathf.Lerp(.30f,.63f,Rand())*Mathf.Lerp(.85f,1.15f,lush))*Mathf.Lerp(.6f,1,cover);
                    float width=plume?.008f:Mathf.Lerp(.015f,.032f,Rand());
                    var bend=Vector3.Cross(across,up)*h*Mathf.Lerp(.18f,.38f,Rand());
                    var root=point-up*.012f;
                    var lower=root+up*h*.35f+bend*.1225f;
                    var middle=root+up*h*.72f+bend*.5184f;
                    var tip=root+up*h+bend;
                    Color color=(colors[ia]*(1-u)+colors[ib]*(u*(1-v))+colors[ic]*(u*v))*Mathf.Lerp(.94f,1.06f,Rand());
                    color=Color.Lerp(color,new Color(.12f,.25f,.045f),.38f);
                    color.r*=Mathf.Lerp(.85f,1.05f,lush);color.b*=.85f;
                    int start=patch.vertices.Count;float phase=Rand();
                    void Vertex(Vector3 p,float height)
                    {
                        patch.vertices.Add(p);patch.normals.Add(up);patch.roots.Add(root);patch.uv.Add(new Vector2(phase,height));
                        patch.detail.Add(new Vector4(0,0,0,h));
                        var tint=Color.Lerp(color*.58f,color*1.12f,height);tint.a=1;patch.colors.Add(tint);
                    }
                    if(plume)
                    {
                        Vertex(root-across*width,0);Vertex(root+across*width,0);
                        Vertex(lower-across*width*.80f,.35f);Vertex(lower+across*width*.80f,.35f);
                        Vertex(middle-across*width*.38f,.72f);Vertex(middle+across*width*.38f,.72f);Vertex(tip,1);
                        foreach(int j in new[]{0,2,1,1,2,3,2,4,3,3,4,5,4,6,5})patch.indices.Add(start+j);
                    }
                    else
                    {
                        var profile=library.profiles[(int)(phase*library.profiles.Length)];
                        var forward=Vector3.Cross(across,up);float broadness=Mathf.Lerp(1.15f,1.65f,Rand());
                        for(int j=0;j<profile.weights.Length;j++)
                        {
                            int k=j*3;float weight=profile.weights[j];
                            var pointOnLeaf=root+(across*(profile.positions[k]*broadness)+up*profile.positions[k+1]+forward*profile.positions[k+2])*h;
                            var normal=(across*(profile.normals[k]/broadness)+up*profile.normals[k+1]+forward*profile.normals[k+2]).normalized;
                            patch.vertices.Add(pointOnLeaf);patch.normals.Add(normal);patch.roots.Add(root);patch.uv.Add(new Vector2(phase,weight));
                            patch.detail.Add(new Vector4(j==18?0:(j%3)-1,weight,2,h));
                            var tint=Color.Lerp(color*.78f,color*1.04f,weight);tint.a=1;patch.colors.Add(tint);
                        }
                        foreach(int j in profile.indices)patch.indices.Add(start+j);
                    }
                    blades++;
                    if(plume)
                    {
                        // Crossed, tapered feather cards share the stalk's root, height and wind phase.
                        // Their silhouette/fine fibers are analytic in the shader; no copied game art.
                        var cream=Color.Lerp(new Color(.36f,.32f,.22f),new Color(.67f,.65f,.52f),Rand());
                        float length=h*Mathf.Lerp(.30f,.40f,Rand()),halfWidth=Mathf.Lerp(.033f,.055f,Rand());
                        for(int plane=0;plane<2;plane++)
                        {
                            var axis=Quaternion.AngleAxis(plane*90,up)*across;
                            int first=patch.vertices.Count;
                            void Feather(float x,float y)
                            {
                                float height=1-length/h+y*length/h;
                                patch.vertices.Add(root+up*(h*height)+bend*(height*height)+axis*x*halfWidth);
                                patch.normals.Add(up);patch.roots.Add(root);patch.uv.Add(new Vector2(phase,height));
                                patch.detail.Add(new Vector4(x,y,1,h));patch.colors.Add(cream);
                            }
                            Feather(-1,0);Feather(1,0);Feather(-1,1);Feather(1,1);
                            foreach(int j in new[]{0,2,1,1,2,3})patch.indices.Add(first+j);
                        }
                        plumes++;
                    }
                }
            }
            var meadow=new GameObject("Wind meadow");meadow.AddComponent<MeadowGrass>();meadow.AddComponent<MeadowSmoke>();
            foreach(var pair in patches)
            {
                var p=pair.Value;var mesh=new Mesh{name="Meadow "+pair.Key,indexFormat=IndexFormat.UInt32};
                mesh.SetVertices(p.vertices);mesh.SetNormals(p.normals);mesh.SetColors(p.colors);mesh.SetUVs(0,p.uv);mesh.SetUVs(1,p.roots);mesh.SetUVs(2,p.detail);mesh.SetTriangles(p.indices,0);mesh.RecalculateBounds();
                var bounds=mesh.bounds;bounds.Expand(1.5f);mesh.bounds=bounds;
                string key=pair.Key.x+"_"+pair.Key.y+"_"+pair.Key.z;
                var go=new GameObject("Grass "+key);go.transform.SetParent(meadow.transform,false);
                go.AddComponent<MeshFilter>().sharedMesh=Store(mesh,key+".asset");
                var renderer=go.AddComponent<MeshRenderer>();renderer.sharedMaterial=material;renderer.shadowCastingMode=ShadowCastingMode.Off;
                renderer.receiveShadows=true;renderer.lightProbeUsage=LightProbeUsage.Off;renderer.reflectionProbeUsage=ReflectionProbeUsage.Off;
            }
            BuildMeadowSettings.Populate(meadow.GetComponent<MeadowGrass>());
            AssetDatabase.SaveAssets();Debug.Log($"MUMU_MEADOW_READY blades={blades} plumes={plumes} chunks={patches.Count} radius=40");
        }
        [MenuItem("Mumu/Add wind meadow")]
        public static void Create()
        {
            var scene=EditorSceneManager.OpenScene("Assets/Mumu/Scenes/PlanetExploration.unity");
            Populate();EditorSceneManager.SaveScene(scene);
            if(UnityEditor.ShaderUtil.ShaderHasError(Shader.Find("Mumu/Meadow Wind")))throw new Exception("Grass shader compilation failed");
        }
        public static void CreateAndBuild(){Create();BuildExploration.BuildWindows();}
    }
}
