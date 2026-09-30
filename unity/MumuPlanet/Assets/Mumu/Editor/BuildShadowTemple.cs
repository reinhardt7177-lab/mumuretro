using System.Collections.Generic;
using System.IO;
using System.Linq;
using TMPro;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using UnityEngine.SceneManagement;
using Mumu.Planet;
using static Mumu.Editor.BuildWeightTemple;

namespace Mumu.Editor
{
    // Generates Assets/Mumu/Scenes/ShadowTemple.unity: one night sky island with four rooms
    // (design: art/shadow-temple/DESIGN-v01.md). Colliders are authored here from the same numbers as the art.
    public static class BuildShadowTemple
    {
        public const string ScenePath="Assets/Mumu/Scenes/ShadowTemple.unity";
        static readonly string[] StaticArt={"shadow-entry-v01","shadow-room1-v01","shadow-bridges-v01","shadow-room2-v01","shadow-room3-v01","shadow-sanctum-v01","shadow-island-v01","shadow-horizon-v01"};
        public static readonly Vector3 MoonDirection=new Vector3(-.35f,.42f,.84f).normalized;
        static Transform root;

        [MenuItem("Mumu/Build shadow temple")]
        public static void Create()
        {
            Prepare();ShadowTempleArt.Prepare();
            var source=EditorSceneManager.OpenScene("Assets/Mumu/Scenes/PlanetExploration.unity");
            var actor=Object.FindFirstObjectByType<PlanetExplorer>();var sourceCamera=Object.FindFirstObjectByType<OrbitCamera>();
            var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Additive);SceneManager.SetActiveScene(scene);
            var player=Object.Instantiate(actor.gameObject).GetComponent<PlanetExplorer>();player.name="Shadow temple navigator";SceneManager.MoveGameObjectToScene(player.gameObject,scene);
            var orbit=Object.Instantiate(sourceCamera.gameObject).GetComponent<OrbitCamera>();orbit.name="Main Camera";SceneManager.MoveGameObjectToScene(orbit.gameObject,scene);
            foreach(var c in player.GetComponents<MonoBehaviour>())if(c!=player)Object.DestroyImmediate(c);
            var datum=new GameObject("Floor datum Y=0").transform;
            player.ConfigureFlat(datum,orbit.transform,player.GetComponentInChildren<Animator>());player.EnableFlatCollisions();
            player.transform.SetPositionAndRotation(ShadowTemple.Spawn,Quaternion.identity);
            orbit.ConfigureClimbing(null);orbit.Configure(player.transform);orbit.ConfigureFraming(30,7.5f);
            EditorSceneManager.CloseScene(source,true);
            var view=orbit.GetComponent<Camera>();view.clearFlags=CameraClearFlags.Skybox;view.farClipPlane=420;

            root=new GameObject("Shadow temple").transform;
            var art=Child("Blender shadow temple art",root);
            foreach(var file in StaticArt)ShadowTempleArt.Import(file,art,ShadowCastingMode.Off);
            var collision=Child("Shadow temple collision",root);
            Floors(collision);Walls(collision);
            var gates=Gates(collision,out var blocks,out var glows);

            var temple=root.gameObject.AddComponent<ShadowTemple>();
            var shade=Child("Room 1 shade walk",root).gameObject.AddComponent<ShadeWalkRoom>();
            var mirror=Child("Room 2 mirrors",root).gameObject.AddComponent<MirrorRoom>();
            var silhouette=Child("Room 3 silhouette",root).gameObject.AddComponent<SilhouetteRoom>();
            var sanctum=Child("Sanctum",root).gameObject.AddComponent<ShadowSanctum>();
            var boards=new TextMeshPro[4];
            BuildShade(shade,out boards[0]);BuildMirrors(mirror,out boards[1]);BuildSilhouette(silhouette,out boards[2]);BuildSanctum(sanctum,out boards[3]);

            Lighting(view);
            var hud=Hud(out var title,out var goal,out var prompt,out var note,out var speaker,out var speech,out var promptBox,out var noteBox,out var speechBox,out var fade);
            temple.Configure(player,orbit,new ShadowRoom[]{shade,mirror,silhouette,sanctum},gates,blocks,glows,title,goal,prompt,note,speaker,speech,promptBox,noteBox,speechBox,fade,boards);
            BuildNotebook.Populate();
            root.gameObject.AddComponent<ShadowTempleSmoke>();
            CheckGlyphs(prompt.font);
            EditorSceneManager.SaveScene(scene,ScenePath);AssetDatabase.SaveAssets();
            Debug.Log("SHADOW_TEMPLE_READY scene="+ScenePath+" rooms=4 casters="+Object.FindObjectsByType<MeshRenderer>(FindObjectsSortMode.None).Count(r=>r.shadowCastingMode==ShadowCastingMode.ShadowsOnly));
        }

        static void CheckGlyphs(TMP_FontAsset font)
        {
            var files=new[]{"ShadowTemple","ShadeWalkRoom","MirrorRoom","SilhouetteRoom","ShadowSanctum","ShadowSanctuaryEntrance","NotebookUI","QuestGuide"};
            var texts=files.Select(f=>File.ReadAllText("Assets/Mumu/Runtime/"+f+".cs")).ToArray();
            string missing=ShadowFonts.MissingHangul(font,texts);
            if(missing.Length>0)
            {
                ShadowFonts.Extend(font,string.Join("",texts),"SHADOW_FONT_EXTEND_MISSING");
                font.atlasPopulationMode=AtlasPopulationMode.Static;EditorUtility.SetDirty(font);
                missing=ShadowFonts.MissingHangul(font,texts);
            }
            Debug.Log("SHADOW_FONT_MISSING ["+missing+"]");
            if(missing.Length>0)throw new System.InvalidOperationException("Temple Korean atlas lacks shadow temple glyphs: "+missing);
        }

        // ---------------- helpers ----------------
        static Transform Child(string name,Transform parent,Vector3 position=default)
        {var t=new GameObject(name).transform;t.SetParent(parent,false);t.localPosition=position;return t;}
        static BoxCollider Box(string name,Transform parent,Vector3 centre,Vector3 size,int layer)
        {var t=Child(name,parent,centre);t.gameObject.layer=layer;var c=t.gameObject.AddComponent<BoxCollider>();c.size=size;return c;}
        static BoxCollider Span(string name,Transform parent,float x0,float x1,float z0,float z1,float height,int layer=8,float bottom=0)
            =>Box(name,parent,new Vector3((x0+x1)*.5f,bottom+height*.5f,(z0+z1)*.5f),new Vector3(x1-x0,height,z1-z0),layer);
        static CapsuleCollider Post(string name,Transform parent,Vector3 point,float radius,float height)
        {
            var t=Child(name,parent,point+Vector3.up*height*.5f);t.gameObject.layer=8;
            var c=t.gameObject.AddComponent<CapsuleCollider>();c.radius=radius;c.height=Mathf.Max(height,radius*2);c.direction=1;return c;
        }
        static Transform Device(string file,Transform parent,Vector3 local,ShadowCastingMode cast)
        {
            var t=ShadowTempleArt.Import(file,parent,cast);t.localPosition=local;return t;
        }
        static Renderer Batch(Transform art,string material)=>art.GetComponentsInChildren<Renderer>(true).FirstOrDefault(r=>r.name==material);
        static Mesh SaveMesh(string name,Mesh mesh)
        {
            string path=ShadowTempleArt.Output+name+".asset";
            var existing=AssetDatabase.LoadAssetAtPath<Mesh>(path);
            if(existing==null){mesh.name=name;AssetDatabase.CreateAsset(mesh,path);return mesh;}
            existing.Clear();existing.vertices=mesh.vertices;existing.triangles=mesh.triangles;existing.normals=mesh.normals;existing.RecalculateBounds();
            EditorUtility.SetDirty(existing);return existing;
        }
        static void Outward(List<Vector3> v,List<int> t,Vector3 centre)
        {
            for(int i=0;i<t.Count;i+=3)
            {
                var a=v[t[i]];var b=v[t[i+1]];var c=v[t[i+2]];
                if(Vector3.Dot(Vector3.Cross(b-a,c-a),(a+b+c)/3-centre)<0){int k=t[i+1];t[i+1]=t[i+2];t[i+2]=k;}
            }
        }
        // Exact 16-gon prism for the shadow-only casters (same vertex angles as the Blender pillars and ShadowOptics).
        static Mesh Prism(string name,float radius,float height,int sides)
        {
            var v=new List<Vector3>();var t=new List<int>();
            for(int i=0;i<sides;i++){float a=i*Mathf.PI*2/sides;var p=new Vector3(Mathf.Sin(a)*radius,0,Mathf.Cos(a)*radius);v.Add(p);v.Add(p+Vector3.up*height);}
            int bottom=v.Count;v.Add(Vector3.zero);int top=v.Count;v.Add(Vector3.up*height);
            for(int i=0;i<sides;i++)
            {
                int a=i*2,b=((i+1)%sides)*2;
                t.AddRange(new[]{a,b,a+1,b,b+1,a+1,bottom,b,a,top,a+1,b+1});
            }
            Outward(v,t,Vector3.up*height*.5f);
            var mesh=new Mesh();mesh.SetVertices(v);mesh.SetTriangles(t,0);mesh.RecalculateNormals();mesh.RecalculateBounds();
            return SaveMesh(name,mesh);
        }
        static Mesh Annulus(string name,float inner,float outer,int segments)
        {
            var v=new List<Vector3>();var t=new List<int>();
            for(int i=0;i<segments;i++){float a=i*Mathf.PI*2/segments;var d=new Vector3(Mathf.Cos(a),0,Mathf.Sin(a));v.Add(d*inner);v.Add(d*outer);}
            for(int i=0;i<segments;i++){int a=i*2,b=((i+1)%segments)*2;t.AddRange(new[]{a,a+1,b+1,a,b+1,b});}
            for(int i=0;i<t.Count;i+=3){if(Vector3.Cross(v[t[i+1]]-v[t[i]],v[t[i+2]]-v[t[i]]).y<0){int k=t[i+1];t[i+1]=t[i+2];t[i+2]=k;}}
            var mesh=new Mesh();mesh.SetVertices(v);mesh.SetTriangles(t,0);mesh.RecalculateNormals();mesh.RecalculateBounds();
            return SaveMesh(name,mesh);
        }
        static Mesh Octahedron(string name,float r)
        {
            var p=new[]{Vector3.right,Vector3.left,Vector3.up,Vector3.down,Vector3.forward,Vector3.back};
            var v=new List<Vector3>();var t=new List<int>();
            int[][] faces={new[]{2,0,4},new[]{2,4,1},new[]{2,1,5},new[]{2,5,0},new[]{3,4,0},new[]{3,1,4},new[]{3,5,1},new[]{3,0,5}};
            foreach(var f in faces){int s=v.Count;foreach(int k in f)v.Add(p[k]*r);t.AddRange(new[]{s,s+1,s+2});}
            Outward(v,t,Vector3.zero);
            var mesh=new Mesh();mesh.SetVertices(v);mesh.SetTriangles(t,0);mesh.RecalculateNormals();mesh.RecalculateBounds();
            return SaveMesh(name,mesh);
        }
        static MeshRenderer MeshObject(string name,Transform parent,Mesh mesh,Material material,ShadowCastingMode cast,Vector3 local=default)
        {
            var t=Child(name,parent,local);
            t.gameObject.AddComponent<MeshFilter>().sharedMesh=mesh;
            var r=t.gameObject.AddComponent<MeshRenderer>();r.sharedMaterial=material;r.shadowCastingMode=cast;r.receiveShadows=cast!=ShadowCastingMode.ShadowsOnly;
            return r;
        }
        static Renderer Primitive(PrimitiveType type,string name,Transform parent,Vector3 local,Vector3 scale,Material material,Quaternion? rotation=null)
        {
            var go=GameObject.CreatePrimitive(type);go.name=name;go.transform.SetParent(parent,false);
            go.transform.localPosition=local;go.transform.localScale=scale;go.transform.localRotation=rotation??Quaternion.identity;
            Object.DestroyImmediate(go.GetComponent<Collider>());
            var r=go.GetComponent<Renderer>();r.sharedMaterial=material;r.shadowCastingMode=ShadowCastingMode.Off;return r;
        }
        static Light PointLight(string name,Transform parent,Vector3 local,Color color,float intensity,float range,bool shadows)
        {
            var t=Child(name,parent,local);var l=t.gameObject.AddComponent<Light>();
            l.type=LightType.Point;l.color=color;l.intensity=intensity;l.range=range;l.shadows=shadows?LightShadows.Soft:LightShadows.None;
            if(shadows)
            {
                l.shadowStrength=.92f;
                var data=t.gameObject.GetComponent<UniversalAdditionalLightData>()??t.gameObject.AddComponent<UniversalAdditionalLightData>();
                // The tier property is read-only in URP 17; the inspector writes the serialized field.
                var so=new SerializedObject(data);var tier=so.FindProperty("m_AdditionalLightsShadowResolutionTier");
                if(tier!=null){tier.intValue=UniversalAdditionalLightData.AdditionalLightsShadowResolutionTierHigh;so.ApplyModifiedPropertiesWithoutUndo();}
            }
            return l;
        }
        // Hint post facing the room entrance; the world text sits on the slate (SHADOW_BOARD 0,1.5535,-0.1397, tilted 10 degrees).
        static TextMeshPro HintPost(Transform parent,Vector3 point,Vector2 entrance)
        {
            var post=Child("Hint post",parent,point);
            var toward=new Vector3(entrance.x-point.x,0,entrance.y-point.z);
            post.rotation=Quaternion.LookRotation(-toward.normalized,Vector3.up);
            Device("hint-post-v01",post,Vector3.zero,ShadowCastingMode.Off);
            Post("Hint post collision",post,Vector3.zero,.3f,1.4f).transform.localPosition=new Vector3(0,.7f,0);
            var textObject=new GameObject("Hint board text",typeof(TextMeshPro));textObject.transform.SetParent(post,false);
            textObject.transform.localPosition=new Vector3(0,1.5535f,-.1497f);textObject.transform.localRotation=Quaternion.Euler(10,0,0);
            var text=textObject.GetComponent<TextMeshPro>();
            text.font=AssetDatabase.LoadAssetAtPath<TMP_FontAsset>("Assets/Mumu/Generated/Balance/TempleKorean.asset");
            text.fontSize=1.25f;text.color=new Color(.95f,.9f,.76f);text.alignment=TextAlignmentOptions.TopLeft;
            text.rectTransform.sizeDelta=new Vector2(1.36f,.84f);text.enableWordWrapping=true;text.overflowMode=TextOverflowModes.Truncate;
            text.margin=Vector4.zero;text.text="<b>힌트</b>\n"+ShadowTemple.HintLocked;
            return text;
        }

        // ---------------- structure ----------------
        static void Floors(Transform parent)
        {
            // Walkable tops at y=0 (layer 9), 0.6 thick.
            void F(string n,float x0,float x1,float z0,float z1)=>Span(n,parent,x0,x1,z0,z1,.6f,9,-.6f);
            F("Entry floor",-3.5f,3.5f,-15f,-8f);F("Room 1 floor",-7f,7f,-8f,11f);F("Bridge 1 floor",-2.1f,2.1f,11f,17f);
            F("Room 2 floor",-9f,9f,17f,31f);F("Bridge 2 floor",-2.1f,2.1f,31f,37f);F("Room 3 floor",-7f,7f,37f,49f);
            F("Bridge 3 floor",-2.1f,2.1f,49f,55f);F("Sanctum floor",-11f,11f,55f,71f);
        }
        static void Walls(Transform p)
        {
            // Low walls are 1.25 m tall colliders: they stop the body and let the camera pass over.
            const float h=1.25f;
            foreach(int s in new[]{-1,1})
            {
                Span("Entry side wall",p,s*3.5f,s*3.9f,-15.2f,-8f,h);
                Span("Room 1 side wall",p,s*7f,s*7.6f,-8.3f,11.3f,h);
                Span("Room 1 back wall",p,s*2.4f,s*7.6f,-8.3f,-7.9f,h);
                Span("Room 1 exit wall",p,s*2.9f,s*7.6f,10.95f,11.35f,h);
                Span("Room 2 side wall",p,s*9f,s*9.6f,16.7f,31.3f,h);
                Span("Room 2 entry wall",p,s*2.1f,s*9.6f,16.7f,17.3f,h);
                Span("Room 2 exit wall",p,s*2.65f,s*9.6f,30.7f,31.3f,h);
                Span("Room 3 side wall",p,s*7f,s*7.5f,36.8f,49.4f,h);
                Span("Room 3 entry wall",p,s*2.1f,s*7.5f,36.8f,37.2f,h);
                Span("Room 3 exit wall",p,s*2.9f,s*7.5f,48.95f,49.35f,h);
                Span("Sanctum side wall",p,s*11f,s*11.5f,54.8f,71.5f,h);
                Span("Sanctum entry wall",p,s*2.1f,s*11.5f,54.8f,55.2f,h);
                foreach(var span in new[]{new Vector2(11,17),new Vector2(31,37),new Vector2(49,55)})Span("Bridge rail",p,s*2.0f,s*2.2f,span.x,span.y,h);
                // Gate posts (0.7 x 0.7 centred x=+-2.55 over z[g-0.8,g]).
                foreach(float g in new[]{11f,31f,49f})Span("Gate post",p,s*2.2f,s*2.9f,g-.8f,g,4.3f);
                Post("Sanctum rail support",p,new Vector3(s*6.3f,0,56.7f),.3f,7.8f);Post("Sanctum rail support",p,new Vector3(s*6.3f,0,69.3f),.3f,7.8f);
                Post("Sanctum rear post",p,new Vector3(s*8f,0,69.9f),.4f,7.2f);
                Post("Room 1 tower",p,new Vector3(s*6.1f,0,-4.7f),.4f,6.8f);Post("Room 1 tower",p,new Vector3(s*6.1f,0,10.7f),.4f,6.8f);
                Box("Entry lantern",p,new Vector3(s*2.6f,1.1f,-13.4f),new Vector3(.5f,2.2f,.5f),8);
            }
            Span("Entry moon gate",p,-3.2f,3.2f,-15.2f,-14.15f,5.3f);
            Span("Sanctum rear wall",p,-11.5f,11.5f,71f,71.5f,h);
            Span("Room 3 screen and feet",p,-5.6f,-1.2f,47.62f,48.1f,5f);
        }
        static Renderer[] Gates(Transform p,out Collider[] blocks,out Renderer[] glows)
        {
            var veil=ShadowTempleArt.Transparent("Shadow gate veil",new Color(.06f,.10f,.22f,.78f),false,true);
            var glow=ShadowTempleArt.Lit("Shadow gate glow",new Color(.8f,.75f,.6f),0,.4f,new Color(.35f,.33f,.28f));
            var veils=new Renderer[3];blocks=new Collider[3];glows=new Renderer[3];
            float[] zs={11f,31f,49f};
            for(int i=0;i<3;i++)
            {
                var gate=Child("Gate "+(i+1),p,new Vector3(0,0,zs[i]-.4f));
                veils[i]=Primitive(PrimitiveType.Quad,"Gate veil",gate,new Vector3(0,1.85f,0),new Vector3(4.4f,3.7f,1),veil);
                glows[i]=Primitive(PrimitiveType.Cube,"Gate glow",gate,new Vector3(0,3.72f,-.42f),new Vector3(4.4f,.07f,.07f),glow);
                blocks[i]=Box("Closed gate collision",gate,new Vector3(0,1.6f,0),new Vector3(4.4f,3.2f,.3f),8);
            }
            return veils;
        }

        // ---------------- rooms ----------------
        static void BuildShade(ShadeWalkRoom room,out TextMeshPro board)
        {
            var t=room.transform;
            var caster=ShadowTempleArt.Lit("Shadow caster",Color.gray);
            var prism=Prism("Shade pillar caster 16",ShadeWalkRoom.PillarRadius,ShadeWalkRoom.PillarHeight,16);
            var practicePrism=Prism("Shade practice caster 16",ShadeWalkRoom.PracticeRadius,ShadeWalkRoom.PracticeHeight,16);
            for(int i=0;i<ShadeWalkRoom.Pillars.Length;i++)
            {
                var c=ShadeWalkRoom.Pillars[i];var pillar=Child("Shade pillar "+(i+1),t,new Vector3(c.x,0,c.y));
                Device("shade-pillar-v01",pillar,Vector3.zero,ShadowCastingMode.Off);
                MeshObject("Exact shadow caster",pillar,prism,caster,ShadowCastingMode.ShadowsOnly);
                Post("Pillar collision",pillar,Vector3.zero,ShadeWalkRoom.PillarRadius,ShadeWalkRoom.PillarHeight).transform.localPosition=Vector3.up*ShadeWalkRoom.PillarHeight*.5f;
            }
            var practice=Child("Practice pillar",t,new Vector3(ShadeWalkRoom.Practice.x,0,ShadeWalkRoom.Practice.y));
            Device("shade-practice-pillar-v01",practice,Vector3.zero,ShadowCastingMode.Off);
            MeshObject("Exact shadow caster",practice,practicePrism,caster,ShadowCastingMode.ShadowsOnly);
            Post("Practice collision",practice,Vector3.zero,ShadeWalkRoom.PracticeRadius,ShadeWalkRoom.PracticeHeight).transform.localPosition=Vector3.up*ShadeWalkRoom.PracticeHeight*.5f;
            var rig=Child("Shade lamp",t,ShadeWalkRoom.LampAt(Mathf.PI*.5f));
            Device("shade-lamp-v01",rig,Vector3.zero,ShadowCastingMode.Off);
            var light=PointLight("Shade lamp light",rig,Vector3.zero,new Color(1,.86f,.62f),34,20,true);
            var eyeMaterial=ShadowTempleArt.Lit("Shadow warning eye",new Color(.16f,.13f,.18f),0,.5f,Color.black);
            var eye=Primitive(PrimitiveType.Cylinder,"Warning eye",t,new Vector3(0,5.1f,10.86f),new Vector3(.84f,.02f,.84f),eyeMaterial,Quaternion.Euler(90,0,0));
            var ringMaterial=ShadowTempleArt.Transparent("Shadow foot warning",new Color(1,.47f,.42f,.8f),false,true);
            var ring=MeshObject("Foot warning ring",t,Annulus("Foot warning ring",.34f,.48f,40),ringMaterial,ShadowCastingMode.Off);ring.enabled=false;
            board=HintPost(t,new Vector3(5.9f,0,-6.6f),new Vector2(0,-8));
            room.ConfigureRoom(new ShadowOptics.Area(-7,7,-8,11),board.transform.parent,light,32,8f);
            room.ConfigureDevices(rig,eye,ring);
        }
        static void BuildMirrors(MirrorRoom room,out TextMeshPro board)
        {
            var t=room.transform;
            var stands=new Transform[3];var heads=new Transform[4];
            for(int i=0;i<3;i++)
            {
                stands[i]=Child("Mirror stand "+(i+1),t);
                Device("mirror-pedestal-v01",stands[i],Vector3.zero,ShadowCastingMode.On);
                heads[i]=Child("Mirror head pivot",stands[i],new Vector3(0,.8f,0));
                Device("mirror-head-v01",heads[i],Vector3.zero,ShadowCastingMode.On);
                Post("Mirror collision",stands[i],Vector3.zero,.7f,1.2f).transform.localPosition=new Vector3(0,.6f,0);
            }
            var cart=Child("Mirror cart",t);Device("mirror-cart-v01",cart,Vector3.zero,ShadowCastingMode.On);
            heads[3]=Child("Mirror head pivot",cart,new Vector3(0,.8f,0));Device("mirror-head-small-v01",heads[3],Vector3.zero,ShadowCastingMode.On);
            Box("Cart collision",cart,new Vector3(0,.55f,0),new Vector3(.95f,1.1f,.75f),8);
            var rail=Child("Mirror rail",t);Device("mirror-rail-v01",rail,Vector3.zero,ShadowCastingMode.Off);
            var lever=Child("Rail lever",t);Device("mirror-lever-v01",lever,Vector3.zero,ShadowCastingMode.On);
            Box("Lever collision",lever,new Vector3(0,.55f,0),new Vector3(.6f,1.1f,.9f),8);
            var emitter=Child("Light emitter",t);Device("light-emitter-v01",emitter,Vector3.zero,ShadowCastingMode.On);
            Post("Emitter collision",emitter,Vector3.zero,.7f,1.8f).transform.localPosition=new Vector3(0,.9f,0);
            PointLight("Emitter glow",emitter,new Vector3(.55f,1.55f,0),new Color(1,.78f,.47f),3,4,false);
            var receivers=new Transform[2];var hearts=new Renderer[2];var discs=new Renderer[2];
            for(int i=0;i<2;i++)
            {
                receivers[i]=Child("Target "+(i+1),t);
                var art=Device("mirror-receiver-v01",receivers[i],Vector3.zero,ShadowCastingMode.On);
                hearts[i]=Batch(art,"Shadow lamp glow");discs[i]=Batch(art,"Shadow receiver crystal");
                if(discs[i]!=null)
                {
                    string litPath=ShadowTempleArt.Output+"Shadow receiver crystal lit.mat";
                    var lit=AssetDatabase.LoadAssetAtPath<Material>(litPath);
                    if(lit==null){lit=new Material(discs[i].sharedMaterial);AssetDatabase.CreateAsset(lit,litPath);}
                    else lit.CopyPropertiesFromMaterial(discs[i].sharedMaterial);
                    lit.EnableKeyword("_EMISSION");lit.SetColor("_EmissionColor",Color.black);EditorUtility.SetDirty(lit);
                    discs[i].sharedMaterial=lit;
                }
                Post("Target collision",receivers[i],Vector3.zero,.62f,2.1f).transform.localPosition=new Vector3(0,1.05f,0);
            }
            var beam=Child("Beam",t);
            var core=ShadowTempleArt.Transparent("Shadow beam core",new Color(1,.93f,.73f,1),true);
            var halo=ShadowTempleArt.Transparent("Shadow beam halo",new Color(1,.78f,.47f,.22f),true);
            var sparkle=ShadowTempleArt.Transparent("Shadow beam glint",new Color(1,.92f,.7f,.9f),true);
            var cores=new Transform[12];var halos=new Transform[12];var glints=new Transform[10];
            for(int i=0;i<12;i++){cores[i]=Primitive(PrimitiveType.Cylinder,"Beam core",beam,Vector3.zero,Vector3.one,core).transform;halos[i]=Primitive(PrimitiveType.Cylinder,"Beam halo",beam,Vector3.zero,Vector3.one,halo).transform;cores[i].gameObject.SetActive(false);halos[i].gameObject.SetActive(false);}
            for(int i=0;i<10;i++){glints[i]=Primitive(PrimitiveType.Sphere,"Beam glint",beam,Vector3.zero,Vector3.one*.16f,sparkle).transform;glints[i].gameObject.SetActive(false);}
            board=HintPost(t,new Vector3(7.9f,0,18.4f),new Vector2(0,17));
            room.ConfigureRoom(new ShadowOptics.Area(-9,9,17,31),board.transform.parent,null,30,7.5f);
            room.ConfigureDevices(stands,heads,cart,rail,lever,emitter,receivers,hearts,discs,cores,halos,glints);
        }
        static void BuildSilhouette(SilhouetteRoom room,out TextMeshPro board)
        {
            var t=room.transform;
            var panel=Child("Silhouette panel carriage",t,new Vector3(SilhouetteRoom.AxisX,0,SilhouetteRoom.Home));
            var panelArt=Device("silhouette-panel-cart-v01",panel,Vector3.zero,ShadowCastingMode.On);
            // The 6 cm panel inverts under the light's normal bias at long range; a 0.4 m caster whose front face
            // is the panel face casts the same silhouette (the lamp sits on the axis) and survives the bias.
            foreach(var r in panelArt.GetComponentsInChildren<Renderer>())if(r.name=="Shadow panel ink")r.shadowCastingMode=ShadowCastingMode.Off;
            var panelCaster=Primitive(PrimitiveType.Cube,"Exact panel shadow caster",panel,new Vector3(0,SilhouetteRoom.BeamY,.2f),new Vector3(SilhouetteRoom.Panel,SilhouetteRoom.Panel,.4f),ShadowTempleArt.Lit("Shadow caster",Color.gray));
            panelCaster.shadowCastingMode=ShadowCastingMode.ShadowsOnly;
            Box("Panel carriage collision",panel,new Vector3(0,.6f,.2f),new Vector3(.9f,1.2f,.7f),8);
            var stand=Child("Silhouette lamp stand",t,new Vector3(SilhouetteRoom.AxisX,0,SilhouetteRoom.LampHome));
            Device("silhouette-lamp-stand-v01",stand,Vector3.zero,ShadowCastingMode.Off);
            var light=PointLight("Silhouette lamp light",stand,new Vector3(0,SilhouetteRoom.BeamY,0),new Color(1,.87f,.63f),16,14,true);
            // The screen faces the lamp: no normal bias (it shrinks the square by ~5 cm per side at 2.4 m), small depth bias.
            {
                var data=light.GetComponent<UniversalAdditionalLightData>();var so=new SerializedObject(data);
                var usePipeline=so.FindProperty("m_UsePipelineSettings");if(usePipeline!=null){usePipeline.boolValue=false;so.ApplyModifiedPropertiesWithoutUndo();}
                light.shadowBias=.08f;light.shadowNormalBias=0;
            }
            Post("Lamp stand collision",stand,Vector3.zero,.45f,1.2f).transform.localPosition=new Vector3(0,.6f,0);
            var paper=ShadowTempleArt.Lit("Shadow screen face",new Color(.87f,.84f,.72f),0,.05f);
            var screen=Primitive(PrimitiveType.Quad,"Silhouette screen face",t,new Vector3(SilhouetteRoom.AxisX,SilhouetteRoom.BeamY,SilhouetteRoom.ScreenZ),new Vector3(4,4,1),paper);
            screen.receiveShadows=true;
            var gold=ShadowTempleArt.Lit("Shadow target outline",new Color(.87f,.67f,.33f),.6f,.5f,new Color(.9f,.62f,.25f));
            var bars=new Transform[4];for(int i=0;i<4;i++)bars[i]=Primitive(PrimitiveType.Cube,"Target outline bar",t,Vector3.zero,Vector3.one*.05f,gold).transform;
            var pipMaterial=ShadowTempleArt.Lit("Shadow progress pip",new Color(.33f,.34f,.36f),.5f,.5f,Color.black);
            var pips=new Renderer[3];for(int i=0;i<3;i++)pips[i]=Primitive(PrimitiveType.Cylinder,"Progress pip",t,new Vector3(SilhouetteRoom.AxisX+(i-1)*.34f,5.12f,SilhouetteRoom.ScreenZ-.05f),new Vector3(.18f,.02f,.18f),pipMaterial,Quaternion.Euler(90,0,0));
            board=HintPost(t,new Vector3(5.9f,0,38.4f),new Vector2(0,37));
            room.ConfigureRoom(new ShadowOptics.Area(-7,7,37,49),board.transform.parent,light,24,6.8f);
            room.ConfigureDevices(panel,stand,bars,pips);
        }
        static void BuildSanctum(ShadowSanctum room,out TextMeshPro board)
        {
            var t=room.transform;
            var statue=Child("Mirror guardian",t,new Vector3(ShadowSanctum.Centre.x,0,ShadowSanctum.Centre.y));
            Device("guardian-v01",statue,Vector3.zero,ShadowCastingMode.On);
            Post("Guardian collision",statue,Vector3.zero,1.25f,2.3f).transform.localPosition=new Vector3(0,1.15f,0);
            var eyeMaterial=ShadowTempleArt.Lit("Shadow guardian eye",new Color(.16f,.14f,.19f),0,.6f,Color.black);
            var anchors=ShadowTempleArt.Eyes(out float height);
            var eyes=new Renderer[2];
            for(int i=0;i<2;i++)eyes[i]=Primitive(PrimitiveType.Cylinder,"Guardian eye",statue,anchors[i]+new Vector3(0,0,-.006f),new Vector3(.15f,.004f,.15f),eyeMaterial,Quaternion.Euler(90,0,0));
            var (points,starts)=ShadowTempleArt.Parts("guardian-casters-v01");
            var trolley=Child("Sanctum lamp trolley",t);Device("sanctum-trolley-v01",trolley,Vector3.zero,ShadowCastingMode.Off);
            var hanger=Child("Sanctum lamp hanger",t);Device("sanctum-hanger-v01",hanger,Vector3.zero,ShadowCastingMode.Off);
            var body=Child("Sanctum lamp",t,ShadowSanctum.LampAt(0,ShadowSanctum.Heights[0]));Device("sanctum-lamp-v01",body,Vector3.zero,ShadowCastingMode.Off);
            var light=PointLight("Sanctum lamp light",body,Vector3.zero,new Color(1,.87f,.64f),46,26,true);
            var wheelBase=Child("Direction wheel",t,new Vector3(ShadowSanctum.Wheel.x,0,ShadowSanctum.Wheel.y));Device("direction-wheel-base-v01",wheelBase,Vector3.zero,ShadowCastingMode.Off);
            var rotor=Child("Direction wheel rotor",wheelBase,new Vector3(0,1.17f,0));Device("direction-wheel-rotor-v01",rotor,Vector3.zero,ShadowCastingMode.Off);
            Post("Wheel collision",wheelBase,Vector3.zero,.85f,1.2f).transform.localPosition=new Vector3(0,.6f,0);
            var gripBase=Child("Height grip",t,new Vector3(ShadowSanctum.Grip.x,0,ShadowSanctum.Grip.y));Device("height-grip-base-v01",gripBase,Vector3.zero,ShadowCastingMode.Off);
            var knob=Child("Height grip knob",gripBase,new Vector3(0,.98f,-.2f));Device("height-grip-knob-v01",knob,Vector3.zero,ShadowCastingMode.Off);
            Post("Grip collision",gripBase,Vector3.zero,.85f,1.2f).transform.localPosition=new Vector3(0,.6f,0);
            var outlineMaterial=ShadowTempleArt.Transparent("Shadow sanctum outline",new Color(.84f,.66f,.32f,.95f),false,true);
            var ghostMaterial=ShadowTempleArt.Transparent("Shadow sanctum ghost",new Color(.72f,.8f,1,.75f),false,true);
            var outline=Child("Sanctum target outline",t);var outlineFilter=outline.gameObject.AddComponent<MeshFilter>();var outlineRenderer=outline.gameObject.AddComponent<MeshRenderer>();outlineRenderer.sharedMaterial=outlineMaterial;outlineRenderer.shadowCastingMode=ShadowCastingMode.Off;
            var ghost=Child("Sanctum previous shadow",t);var ghostFilter=ghost.gameObject.AddComponent<MeshFilter>();var ghostRenderer=ghost.gameObject.AddComponent<MeshRenderer>();ghostRenderer.sharedMaterial=ghostMaterial;ghostRenderer.shadowCastingMode=ShadowCastingMode.Off;ghostRenderer.enabled=false;
            var orb=Child("Wisdom orb",t,new Vector3(ShadowSanctum.OrbSpot.x,ShadowSanctum.OrbY,ShadowSanctum.OrbSpot.y));
            var orbGold=ShadowTempleArt.Lit("Shadow wisdom orb",new Color(1,.82f,.48f),.8f,.7f,new Color(2.2f,1.6f,.7f));
            MeshObject("Orb core",orb,Octahedron("Wisdom orb core",.34f),orbGold,ShadowCastingMode.Off);
            Primitive(PrimitiveType.Sphere,"Orb shell",orb,Vector3.zero,Vector3.one*1.32f,ShadowTempleArt.Transparent("Shadow orb shell",new Color(1,.85f,.55f,.22f),true));
            var orbLight=PointLight("Orb glow",orb,Vector3.zero,new Color(1,.82f,.48f),6,8,false);
            orb.gameObject.SetActive(false);
            var ringMaterial=ShadowTempleArt.Lit("Shadow orb ring",new Color(.58f,.46f,.28f),.8f,.5f,Color.black);
            var orbRing=MeshObject("Orb floor ring",t,Annulus("Orb floor ring",.70f,.78f,48),ringMaterial,ShadowCastingMode.Off,new Vector3(ShadowSanctum.OrbSpot.x,.006f,ShadowSanctum.OrbSpot.y));
            board=HintPost(t,new Vector3(9.9f,0,56.4f),new Vector2(0,55));
            room.ConfigureRoom(new ShadowOptics.Area(-11,11,55,71),board.transform.parent,light,34,9f);
            room.ConfigureDevices(statue,trolley,hanger,body,rotor,knob,orb,eyes,outlineFilter,ghostFilter,orbRing,orbLight,points,starts);
        }

        // ---------------- light, sky, HUD ----------------
        static void Lighting(Camera view)
        {
            var moon=new GameObject("Moonlight").AddComponent<Light>();moon.type=LightType.Directional;
            moon.color=new Color(.66f,.74f,1f);moon.intensity=.32f;moon.shadows=LightShadows.None;
            moon.transform.rotation=Quaternion.LookRotation(-MoonDirection,Vector3.up);RenderSettings.sun=moon;
            var sky=ShadowTempleArt.Shaded("Shadow night sky","Mumu/Shadow Night Sky");
            sky.SetVector("_MoonDir",MoonDirection);EditorUtility.SetDirty(sky);
            RenderSettings.skybox=sky;
            RenderSettings.ambientMode=AmbientMode.Trilight;
            RenderSettings.ambientSkyColor=new Color(.12f,.15f,.26f);RenderSettings.ambientEquatorColor=new Color(.08f,.09f,.15f);RenderSettings.ambientGroundColor=new Color(.03f,.03f,.05f);
            RenderSettings.fog=true;RenderSettings.fogMode=FogMode.ExponentialSquared;RenderSettings.fogColor=new Color(.122f,.165f,.282f);RenderSettings.fogDensity=.0075f;
            var lamps=Child("Lanterns",root);
            foreach(int s in new[]{-1,1})
            {
                PointLight("Entry lantern",lamps,new Vector3(s*2.6f,2.0f,-13.4f),new Color(1,.8f,.52f),2.2f,6,false);
                PointLight("Room 2 wall lantern",lamps,new Vector3(s*8.7f,2.9f,25f),new Color(1,.8f,.52f),2.6f,8,false);
                PointLight("Sanctum lantern",lamps,new Vector3(s*7.5f,3.3f,69.4f),new Color(1,.8f,.52f),3f,9,false);
            }
            PointLight("Room 2 moon fill",lamps,new Vector3(0,6.2f,24f),new Color(.72f,.8f,1f),3.5f,16,false);
            var volume=new GameObject("Shadow temple grading").AddComponent<Volume>();volume.isGlobal=true;
            string path=ShadowTempleArt.Output+"ShadowTempleGrade.asset";
            var grade=AssetDatabase.LoadAssetAtPath<VolumeProfile>(path);
            if(grade==null){grade=ScriptableObject.CreateInstance<VolumeProfile>();AssetDatabase.CreateAsset(grade,path);}
            if(!grade.TryGet<Tonemapping>(out var tone)){tone=grade.Add<Tonemapping>(true);AssetDatabase.AddObjectToAsset(tone,grade);}
            tone.mode.Override(TonemappingMode.ACES);
            if(!grade.TryGet<Bloom>(out var bloom)){bloom=grade.Add<Bloom>(true);AssetDatabase.AddObjectToAsset(bloom,grade);}
            bloom.intensity.Override(.32f);bloom.threshold.Override(1.05f);bloom.scatter.Override(.62f);
            if(!grade.TryGet<Vignette>(out var vignette)){vignette=grade.Add<Vignette>(true);AssetDatabase.AddObjectToAsset(vignette,grade);}
            vignette.intensity.Override(.22f);
            if(!grade.TryGet<ColorAdjustments>(out var colour)){colour=grade.Add<ColorAdjustments>(true);AssetDatabase.AddObjectToAsset(colour,grade);}
            colour.postExposure.Override(.35f);colour.saturation.Override(4f);
            volume.sharedProfile=grade;EditorUtility.SetDirty(grade);
            view.GetComponent<UniversalAdditionalCameraData>().renderPostProcessing=true;
        }
        static Transform Hud(out TextMeshProUGUI title,out TextMeshProUGUI goal,out TextMeshProUGUI prompt,out TextMeshProUGUI note,out TextMeshProUGUI speaker,out TextMeshProUGUI speech,
            out GameObject promptBox,out GameObject noteBox,out GameObject speechBox,out UnityEngine.UI.Image fade)
        {
            var hud=Canvas("Shadow temple HUD");hud.GetComponent<Canvas>().sortingOrder=10;
            var top=Panel(hud,"Objective",new Vector2(.5f,1),new Vector2(.5f,1),new Vector2(0,-20),new Vector2(1000,92));
            title=Text(top,"Room title",ShadowTemple.TitleShrine,new Vector2(.5f,1),new Vector2(.5f,1),new Vector2(0,-4),new Vector2(980,40),22);title.color=new Color(.93f,.78f,.46f);
            goal=Text(top,"Goal",ShadowTemple.GoalShrine,new Vector2(.5f,0),new Vector2(.5f,0),new Vector2(0,6),new Vector2(980,46),22);
            var bottom=Panel(hud,"Prompt",new Vector2(.5f,0),new Vector2(.5f,0),new Vector2(0,24),new Vector2(980,56));
            prompt=Text(bottom,"Prompt text","",new Vector2(.5f,.5f),new Vector2(.5f,.5f),Vector2.zero,new Vector2(960,52),23);prompt.color=new Color(.93f,.78f,.46f);
            promptBox=bottom.gameObject;promptBox.SetActive(false);
            var notePanel=Panel(hud,"Note",new Vector2(.5f,0),new Vector2(.5f,0),new Vector2(0,92),new Vector2(860,48));
            note=Text(notePanel,"Note text","",new Vector2(.5f,.5f),new Vector2(.5f,.5f),Vector2.zero,new Vector2(850,46),20);
            noteBox=notePanel.gameObject;noteBox.SetActive(false);
            var speechPanel=Panel(hud,"Keeper speech",new Vector2(.5f,0),new Vector2(.5f,0),new Vector2(0,150),new Vector2(1100,150));
            speaker=Text(speechPanel,"Speaker",ShadowTemple.Keeper,new Vector2(0,1),new Vector2(0,1),new Vector2(16,-6),new Vector2(400,36),20);speaker.alignment=TextAlignmentOptions.Left;speaker.color=new Color(.93f,.78f,.46f);
            speech=Text(speechPanel,"Speech","",new Vector2(.5f,0),new Vector2(.5f,0),new Vector2(0,10),new Vector2(1060,102),25);
            speechBox=speechPanel.gameObject;speechBox.SetActive(false);
            var fadeObject=new GameObject("Shadow departure fade",typeof(RectTransform),typeof(UnityEngine.UI.Image));fadeObject.transform.SetParent(hud,false);
            var rect=(RectTransform)fadeObject.transform;rect.anchorMin=Vector2.zero;rect.anchorMax=Vector2.one;rect.offsetMin=rect.offsetMax=Vector2.zero;
            fade=fadeObject.GetComponent<UnityEngine.UI.Image>();fade.color=new Color(.02f,.03f,.07f,0);fade.raycastTarget=false;fadeObject.SetActive(false);
            var events=Object.FindFirstObjectByType<UnityEngine.EventSystems.EventSystem>();
            if(events==null){var e=new GameObject("Shadow temple input",typeof(UnityEngine.EventSystems.EventSystem),typeof(UnityEngine.InputSystem.UI.InputSystemUIInputModule));e.GetComponent<UnityEngine.InputSystem.UI.InputSystemUIInputModule>().AssignDefaultActions();}
            return hud;
        }
    }
}
