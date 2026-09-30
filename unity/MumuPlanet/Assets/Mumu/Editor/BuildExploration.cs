using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Animations;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using Mumu.Planet;

namespace Mumu.Editor
{
    public static class BuildExploration
    {
        const string Root = "Assets/Mumu/";
        [Serializable] class Geometry { public float[] positions, normals, colors; public int[] indices; }
        [Serializable] class Instance { public float[] position, rotation, scale, tint; }
        [Serializable] class Group { public string name; public Geometry geometry; public float[] tint; public Instance[] instances; }
        [Serializable] class Obstacle { public float[] position; public float radius, height; }
        [Serializable] class World { public float radius; public float[] spawn, target; public Geometry terrain, grass; public Group[] groups; public Obstacle[] colliders; }
        static Vector3 V(float[] a) => new Vector3(a[0], a[1], -a[2]);
        static Quaternion Q(float[] a) => new Quaternion(-a[0], -a[1], a[2], a[3]);
        static T Store<T>(T asset, string path) where T : UnityEngine.Object
        {
            var existing = AssetDatabase.LoadAssetAtPath<T>(path);
            if (existing != null) { EditorUtility.CopySerialized(asset, existing); UnityEngine.Object.DestroyImmediate(asset); return existing; }
            AssetDatabase.CreateAsset(asset, path); return asset;
        }
        static Mesh Mesh(Geometry g, string name)
        {
            var m = new Mesh { name = name, indexFormat = IndexFormat.UInt32 };
            var vertices = new Vector3[g.positions.Length / 3]; var normals = new Vector3[vertices.Length]; var colors = new Color[vertices.Length];
            for (int i=0; i<vertices.Length; i++)
            {
                int k=i*3; vertices[i]=new Vector3(g.positions[k],g.positions[k+1],-g.positions[k+2]);
                normals[i]=new Vector3(g.normals[k],g.normals[k+1],-g.normals[k+2]);
                colors[i]=g.colors.Length>k+2?new Color(g.colors[k],g.colors[k+1],g.colors[k+2]):Color.white;
            }
            var triangles=(int[])g.indices.Clone();
            for(int i=0;i<triangles.Length;i+=3) { int a=triangles[i];triangles[i]=triangles[i+2];triangles[i+2]=a; }
            m.vertices=vertices;m.normals=normals;m.colors=colors;m.triangles=triangles;m.RecalculateBounds();
            return Store(m,Root+"Generated/"+name+".asset");
        }
        static GameObject MeshObject(string name, Mesh mesh, Material material, Transform parent)
        {
            var go=new GameObject(name);go.transform.SetParent(parent,false);
            go.AddComponent<MeshFilter>().sharedMesh=mesh;go.AddComponent<MeshRenderer>().sharedMaterial=material;
            return go;
        }
        static AnimationClip Clip(string name)
        {
            string path=Root+"Models/"+name+".fbx";
            var importer=(ModelImporter)AssetImporter.GetAtPath(path);
            importer.animationType=ModelImporterAnimationType.Generic;
            importer.avatarSetup=ModelImporterAvatarSetup.CreateFromThisModel;
            var clips=importer.defaultClipAnimations;
            foreach(var c in clips) { c.loopTime=true;c.lockRootPositionXZ=true;c.lockRootHeightY=true;c.lockRootRotation=true;c.keepOriginalPositionXZ=true; }
            importer.clipAnimations=clips;importer.SaveAndReimport();
            return AssetDatabase.LoadAllAssetsAtPath(path).OfType<AnimationClip>().First(c=>!c.name.StartsWith("__"));
        }
        // A single-frame imported idle has zero effective duration in a blend
        // tree, even when AnimationClip.length reports 1. Give every pose curve
        // an explicit one-second span so damped transitions cannot explode time.
        public static AnimationClip EnsureIdleClip(AnimationClip source)
        {
            var idle=new AnimationClip{name="Navigator Idle",frameRate=30};
            var model=UnityEngine.Object.Instantiate(AssetDatabase.LoadAssetAtPath<GameObject>(Root+"Models/Navigator.fbx"));
            try
            {
                source.SampleAnimation(model,0);
                foreach(var joint in model.GetComponentsInChildren<Transform>())
                {
                    if(joint==model.transform)continue;
                    string path=AnimationUtility.CalculateTransformPath(joint,model.transform);
                    var p=joint.localPosition;var q=joint.localRotation;var s=joint.localScale;
                    string[] properties={"m_LocalPosition.x","m_LocalPosition.y","m_LocalPosition.z","m_LocalRotation.x","m_LocalRotation.y","m_LocalRotation.z","m_LocalRotation.w","m_LocalScale.x","m_LocalScale.y","m_LocalScale.z"};
                    float[] values={p.x,p.y,p.z,q.x,q.y,q.z,q.w,s.x,s.y,s.z};
                    for(int i=0;i<properties.Length;i++)
                        AnimationUtility.SetEditorCurve(idle,EditorCurveBinding.FloatCurve(path,typeof(Transform),properties[i]),AnimationCurve.Constant(0,1,values[i]));
                }
            }
            finally { UnityEngine.Object.DestroyImmediate(model); }
            idle.EnsureQuaternionContinuity();
            var settings=AnimationUtility.GetAnimationClipSettings(idle);
            settings.startTime=0;settings.stopTime=1;settings.loopTime=true;
            AnimationUtility.SetAnimationClipSettings(idle,settings);
            return Store(idle,Root+"Generated/NavigatorIdle.anim");
        }
        public static void RepairLocomotion()
        {
            var source=AssetDatabase.LoadAllAssetsAtPath(Root+"Models/Navigator.fbx").OfType<AnimationClip>().First(c=>!c.name.StartsWith("__"));
            var idle=EnsureIdleClip(source);
            var controller=AssetDatabase.LoadAssetAtPath<AnimatorController>(Root+"Generated/Navigator.controller");
            var blend=(BlendTree)controller.layers[0].stateMachine.states.First(s=>s.state.name=="Explore").state.motion;
            var children=blend.children;children[0].motion=idle;blend.children=children;
            EditorUtility.SetDirty(blend);AssetDatabase.SaveAssets();
        }
        [MenuItem("Mumu/Build exploration scene")]
        public static void Create()
        {
            Directory.CreateDirectory(Root+"Generated");Directory.CreateDirectory(Root+"Scenes");AssetDatabase.Refresh();
            var world=JsonUtility.FromJson<World>(File.ReadAllText(Root+"Source/world.json"));
            var idle=EnsureIdleClip(Clip("Navigator"));var walk=Clip("Walk");var run=Clip("Run");
            var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
            var groundMaterial=Store(new Material(Shader.Find("Mumu/World Vertex")){name="Meadow stone and leaves"},Root+"Generated/World.mat");
            var planet=new GameObject("Mumu Planet · radius 68");
            var surface=planet.AddComponent<PlanetSurface>();
            var ground=MeshObject("Authored terrain",Mesh(world.terrain,"Terrain"),groundMaterial,planet.transform);ground.layer=9;
            var groundCollider=ground.AddComponent<MeshCollider>();groundCollider.sharedMesh=ground.GetComponent<MeshFilter>().sharedMesh;
            var grass=MeshObject("Grass surface",Mesh(world.grass,"Grass"),groundMaterial,planet.transform);grass.layer=9;
            grass.GetComponent<MeshRenderer>().shadowCastingMode=ShadowCastingMode.Off;
            var grassCollider=grass.AddComponent<MeshCollider>();grassCollider.sharedMesh=grass.GetComponent<MeshFilter>().sharedMesh;surface.Configure(groundCollider,grassCollider);
            var nature=new GameObject("Blender nature · original placement");
            foreach(var group in world.groups)
            {
                var mesh=Mesh(group.geometry,group.name);
                var material=Store(new Material(groundMaterial){name=group.name},Root+"Generated/"+group.name+".mat");
                material.SetColor("_BaseColor",new Color(group.tint[0],group.tint[1],group.tint[2]));material.enableInstancing=true;
                var palette=new System.Collections.Generic.Dictionary<string,Material>();
                foreach(var instance in group.instances)
                {
                    var painted=material;
                    if(instance.tint!=null&&instance.tint.Length==3)
                    {
                        int r=Mathf.RoundToInt(instance.tint[0]*32),g=Mathf.RoundToInt(instance.tint[1]*32),b=Mathf.RoundToInt(instance.tint[2]*32);
                        string key=r+"_"+g+"_"+b;
                        if(!palette.TryGetValue(key,out painted))
                        {
                            painted=Store(new Material(material){name=group.name+key},Root+"Generated/"+group.name+key+".mat");
                            painted.SetColor("_BaseColor",new Color(r/32f*group.tint[0],g/32f*group.tint[1],b/32f*group.tint[2]).gamma);palette.Add(key,painted);
                        }
                    }
                    var go=MeshObject(group.name,mesh,painted,nature.transform);
                    go.transform.SetPositionAndRotation(V(instance.position),Q(instance.rotation));
                    go.transform.localScale=new Vector3(instance.scale[0],instance.scale[1],instance.scale[2]);
                    GameObjectUtility.SetStaticEditorFlags(go,StaticEditorFlags.BatchingStatic);
                }
            }
            var obstacles=new GameObject("Nature collisions");
            foreach(var obstacle in world.colliders)
            {
                var go=new GameObject("Tree or rock");go.layer=8;go.transform.SetParent(obstacles.transform);
                go.transform.SetPositionAndRotation(V(obstacle.position),Quaternion.FromToRotation(Vector3.up,V(obstacle.position).normalized));
                var collider=go.AddComponent<CapsuleCollider>();collider.radius=obstacle.radius;collider.height=Mathf.Max(obstacle.height,obstacle.radius*2);collider.center=Vector3.up*obstacle.height*.5f;
            }
            var player=new GameObject("Sky navigator");
            var spawn=surface.Point(V(world.spawn));var up=spawn.normalized;var forward=Vector3.ProjectOnPlane(V(world.target)-spawn,up).normalized;
            player.transform.SetPositionAndRotation(spawn,Quaternion.LookRotation(forward,up));
            var visual=(GameObject)PrefabUtility.InstantiatePrefab(AssetDatabase.LoadAssetAtPath<GameObject>(Root+"Models/Navigator.fbx"));
            visual.transform.SetParent(player.transform,false);
            // Measure in the model's own unrotated frame, then place the feet on y=0.
            visual.transform.SetParent(null);visual.transform.SetPositionAndRotation(Vector3.zero,Quaternion.identity);
            var bounds=new Bounds();bool first=true;
            foreach(var r in visual.GetComponentsInChildren<Renderer>()) { if(first){bounds=r.bounds;first=false;}else bounds.Encapsulate(r.bounds); }
            float scale=1.5f/bounds.size.y;
            visual.transform.SetParent(player.transform,false);visual.transform.localScale=Vector3.one*scale;
            visual.transform.localPosition=new Vector3(-bounds.center.x,-bounds.min.y,-bounds.center.z)*scale;
            var skin=Store(new Material(Shader.Find("Universal Render Pipeline/Lit")){name="Navigator cloth and brass"},Root+"Generated/Navigator.mat");
            skin.SetTexture("_BaseMap",AssetDatabase.LoadAssetAtPath<Texture2D>(Root+"Models/NavigatorTexture0.png"));skin.SetFloat("_Smoothness",.28f);skin.SetFloat("_Metallic",.05f);
            foreach(var r in visual.GetComponentsInChildren<Renderer>()) { r.sharedMaterial=skin; if(r is SkinnedMeshRenderer skinned)skinned.updateWhenOffscreen=true; }
            var animator=visual.GetComponent<Animator>();if(animator==null)animator=visual.AddComponent<Animator>();animator.applyRootMotion=false;
            animator.cullingMode=AnimatorCullingMode.AlwaysAnimate;
            var controllerPath=Root+"Generated/Navigator.controller";
            var controller=AssetDatabase.LoadAssetAtPath<AnimatorController>(controllerPath);
            if(controller==null)
            {
                controller=AnimatorController.CreateAnimatorControllerAtPath(controllerPath);controller.AddParameter("Speed",AnimatorControllerParameterType.Float);
                var blend=new BlendTree{name="Locomotion",blendType=BlendTreeType.Simple1D,blendParameter="Speed",useAutomaticThresholds=false};
                AssetDatabase.AddObjectToAsset(blend,controller);blend.AddChild(idle,0);blend.AddChild(walk,3.2f);blend.AddChild(run,5.8f);
                controller.layers[0].stateMachine.AddState("Explore").motion=blend;
            }
            RepairLocomotion();
            animator.runtimeAnimatorController=controller;
            NormalizeNavigator(animator,player.transform);
            var cameraObject=new GameObject("Main Camera");cameraObject.tag="MainCamera";
            var camera=cameraObject.AddComponent<Camera>();camera.fieldOfView=48;camera.nearClipPlane=.1f;camera.farClipPlane=240;
            camera.clearFlags=CameraClearFlags.SolidColor;camera.backgroundColor=new Color(.36f,.57f,.66f);cameraObject.AddComponent<AudioListener>();
            cameraObject.AddComponent<UniversalAdditionalCameraData>().renderPostProcessing=true;
            var motor=player.AddComponent<PlanetExplorer>();motor.Configure(surface,camera.transform,animator);
            visual.AddComponent<NavigatorPose>().Configure(motor);
            var orbit=cameraObject.AddComponent<OrbitCamera>();orbit.Configure(player.transform);
            player.AddComponent<ExplorationSmoke>().Configure(motor,orbit,camera,animator);
            var sun=new GameObject("Warm daylight").AddComponent<Light>();sun.type=LightType.Directional;sun.color=new Color(1,.91f,.76f);sun.intensity=1.25f;sun.shadows=LightShadows.Soft;
            sun.transform.rotation=Quaternion.LookRotation((-up-forward*.4f+player.transform.right*.5f).normalized,forward);
            RenderSettings.sun=sun;RenderSettings.ambientMode=AmbientMode.Trilight;RenderSettings.ambientSkyColor=new Color(.46f,.59f,.66f);RenderSettings.ambientEquatorColor=new Color(.32f,.39f,.32f);RenderSettings.ambientGroundColor=new Color(.18f,.22f,.19f);
            RenderSettings.fog=true;RenderSettings.fogColor=camera.backgroundColor;RenderSettings.fogMode=FogMode.ExponentialSquared;RenderSettings.fogDensity=.009f;
            var volume=new GameObject("Exploration grade").AddComponent<Volume>();volume.isGlobal=true;
            var profile=ScriptableObject.CreateInstance<VolumeProfile>();
            var tone=profile.Add<Tonemapping>(true);tone.mode.Override(TonemappingMode.ACES);
            var bloom=profile.Add<Bloom>(true);bloom.intensity.Override(.12f);bloom.threshold.Override(1.2f);
            volume.sharedProfile=Store(profile,Root+"Generated/ExplorationGrade.asset");
            PlayerSettings.companyName="Mumuclass";PlayerSettings.productName="Mumu Planet";PlayerSettings.defaultScreenWidth=1440;PlayerSettings.defaultScreenHeight=900;PlayerSettings.fullScreenMode=FullScreenMode.Windowed;
            QualitySettings.shadows=UnityEngine.ShadowQuality.All;QualitySettings.shadowDistance=65f;
            BuildMeadow.Populate();
            BuildNotebook.Populate();
            AssetDatabase.SaveAssets();
            string scenePath=Root+"Scenes/PlanetExploration.unity";EditorSceneManager.SaveScene(scene,scenePath);
            EditorBuildSettings.scenes=new[]{new EditorBuildSettingsScene(scenePath,true)};
            Debug.Log("MUMU_SCENE_READY instances="+world.groups.Sum(g=>g.instances.Length)+" colliders="+world.colliders.Length+" height="+1.5f);
        }
        public static void NormalizeNavigator(Animator animator,Transform actor)
        {
            animator.Rebind();animator.Update(0);
            var skin=animator.GetComponentInChildren<SkinnedMeshRenderer>();var baked=new Mesh();skin.BakeMesh(baked,true);
            var points=baked.vertices.Select(v=>actor.InverseTransformPoint(skin.transform.TransformPoint(v))).ToArray();
            float height=points.Max(v=>v.y)-points.Min(v=>v.y);
            if(height<.01f)throw new Exception("Navigator skin has invalid height");
            animator.transform.localScale*=1.5f/height;
            skin.BakeMesh(baked,true);
            float foot=baked.vertices.Min(v=>actor.InverseTransformPoint(skin.transform.TransformPoint(v)).y);
            animator.transform.localPosition-=Vector3.up*foot;
            UnityEngine.Object.DestroyImmediate(baked);
        }
        public static void BuildWindows()
        {
            PlayerSettings.SetScriptingBackend(UnityEditor.Build.NamedBuildTarget.Standalone,ScriptingImplementation.Mono2x);
            var scenes=new[]{Root+"Scenes/StarsailIntro.unity",Root+"Scenes/PlanetExploration.unity",Root+"Scenes/WeightTemple.unity",Root+"Scenes/TwinBalanceTemple.unity",Root+"Scenes/LeverBalanceTemple.unity",Root+"Scenes/WaterJourneyIce.unity",Root+"Scenes/WaterJourneyCollection.unity",Root+"Scenes/WaterJourneyCycle.unity",Root+"Scenes/WaterSanctuary.unity",Root+"Scenes/ShadowTemple.unity"};
            foreach(var scene in scenes)if(!File.Exists(scene))throw new FileNotFoundException("The integrated game needs every temple scene.",scene);
            var result=BuildPipeline.BuildPlayer(new BuildPlayerOptions{scenes=scenes,locationPathName="Builds/Windows/MumuPlanet.exe",target=BuildTarget.StandaloneWindows64,options=BuildOptions.Development});
            if(result.summary.result!=UnityEditor.Build.Reporting.BuildResult.Succeeded)throw new Exception("Build failed: "+result.summary.result);
            Debug.Log("MUMU_WINDOWS_BUILD_OK");
        }
    }
}
