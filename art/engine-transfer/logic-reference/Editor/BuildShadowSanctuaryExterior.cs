using System;
using System.Collections.Generic;
using System.Linq;
using TMPro;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.SceneManagement;
using Mumu.Planet;
using static Mumu.Editor.BuildWeightTemple;

namespace Mumu.Editor
{
    // The shadow temple's moon gate on the planet (idempotent: re-runs keep the saved pose and restore hidden nature).
    public static class BuildShadowSanctuaryExterior
    {
        public const string ExteriorName="Shadow sanctuary exterior",HudName="Shadow sanctuary HUD";
        // Site in the saved spawn frame: 31.5 m ahead and 26.4 m left (about 44 m on the surface).
        public const float SiteForward=31.5f,SiteLeft=26.4f;
        static readonly Color Ink=new Color(.025f,.075f,.09f,.96f),Paper=new Color(.97f,.94f,.84f);

        [MenuItem("Mumu/Build shadow temple (exterior, interior, players)")]
        public static void CreateAndBuild()
        {
            var scene=EditorSceneManager.OpenScene("Assets/Mumu/Scenes/PlanetExploration.unity");
            Populate();EditorSceneManager.SaveScene(scene);
            BuildShadowTemple.Create();
            BuildWaterEnding.BuildExisting();
            Debug.Log("MUMU_SHADOW_TEMPLE_BUILDS_OK");
        }
        public static void CreateOnly()
        {
            var scene=EditorSceneManager.OpenScene("Assets/Mumu/Scenes/PlanetExploration.unity");
            Populate();EditorSceneManager.SaveScene(scene);
            BuildShadowTemple.Create();
            Debug.Log("MUMU_SHADOW_TEMPLE_SCENES_OK");
        }

        public static void Populate()
        {
            Prepare();ShadowTempleArt.Prepare();
            var surface=UnityEngine.Object.FindFirstObjectByType<PlanetSurface>();
            var player=UnityEngine.Object.FindFirstObjectByType<PlanetExplorer>();
            var orbit=UnityEngine.Object.FindFirstObjectByType<OrbitCamera>();
            if(surface==null||player==null||orbit==null)throw new InvalidOperationException("Planet exploration scene must be open.");
            var scene=SceneManager.GetActiveScene();
            int restored=0;Pose? saved=null;
            var previous=scene.GetRootGameObjects().FirstOrDefault(g=>g.name==ExteriorName);
            if(previous!=null)
            {
                saved=new Pose(previous.transform.position,previous.transform.rotation);
                var frame=previous.transform;
                restored=SetNature(p=>ShadowSanctuaryEntrance.InsideFootprint(frame.InverseTransformPoint(p)),true);
                UnityEngine.Object.DestroyImmediate(previous);
            }
            foreach(var hud in scene.GetRootGameObjects().Where(g=>g.name==HudName).ToArray())UnityEngine.Object.DestroyImmediate(hud);
            var computed=GatePose(surface,player,out float lowest);
            if(saved.HasValue)Debug.Log("SHADOW_EXTERIOR_POSE_DELTA position="+Vector3.Distance(saved.Value.position,computed.position).ToString("0.0000")+" angle="+Quaternion.Angle(saved.Value.rotation,computed.rotation).ToString("0.0000"));
            var pose=saved??computed;
            var gate=new GameObject(ExteriorName).transform;gate.SetPositionAndRotation(pose.position,pose.rotation);

            var art=ShadowTempleArt.Import("shadow-gate-exterior-v01",gate,ShadowCastingMode.On);
            var portal=ShadowTempleArt.Shaded("Shadow planet night portal","Mumu/Shadow Night Portal");
            foreach(var r in art.GetComponentsInChildren<Renderer>())if(r.name=="Shadow portal night"){r.sharedMaterial=portal;r.shadowCastingMode=ShadowCastingMode.Off;}
            // Colliders (layer 8): gate body with plinth, lantern obelisks.
            Solid(gate,"Moon gate body collision",new Vector3(0,2.3f,0),new Vector3(6.6f,6.6f,1.5f));
            Solid(gate,"Moon gate plinth collision",new Vector3(0,-.35f,0),new Vector3(7.0f,1.3f,2.4f));
            foreach(int s in new[]{-1,1})
            {
                Solid(gate,"Lantern obelisk collision",new Vector3(s*3.9f,1.3f,-.9f),new Vector3(.6f,2.6f,.6f));
                var lamp=new GameObject("Moon gate lantern light").AddComponent<Light>();lamp.transform.SetParent(gate,false);
                lamp.transform.localPosition=new Vector3(s*3.9f,2.35f,-.9f);lamp.type=LightType.Point;lamp.color=new Color(1,.8f,.52f);lamp.range=6;lamp.intensity=2;lamp.shadows=LightShadows.None;
            }
            var doorway=new GameObject("Moon gate doorway").transform;doorway.SetParent(gate,false);doorway.localPosition=new Vector3(0,0,-1.2f);
            // Seal after completion: the bronze eclipse disc covers the night portal.
            var seal=new GameObject("Shadow wisdom completion seal");seal.transform.SetParent(gate,false);
            ShadowTempleArt.Import("shadow-gate-seal-v01",seal.transform,ShadowCastingMode.On,new Vector3(0,2.3f,-.47f));
            seal.SetActive(false);
            // Bone-white light pillar: the planet is small (radius 68), so a 44 m site sits below the horizon without it.
            var beamMaterial=ShadowTempleArt.Transparent("Shadow beacon",new Color(.93f,.91f,.84f,.34f),true);
            var beacon=GameObject.CreatePrimitive(PrimitiveType.Cylinder);beacon.name="Shadow temple beacon";
            UnityEngine.Object.DestroyImmediate(beacon.GetComponent<Collider>());beacon.transform.SetParent(gate,false);
            beacon.transform.localPosition=new Vector3(0,9.4f,.3f);beacon.transform.localScale=new Vector3(.9f,9f,.9f);
            var beaconRenderer=beacon.GetComponent<Renderer>();beaconRenderer.sharedMaterial=beamMaterial;beaconRenderer.shadowCastingMode=ShadowCastingMode.Off;beaconRenderer.receiveShadows=false;
            var core=GameObject.CreatePrimitive(PrimitiveType.Cylinder);core.name="Shadow temple beacon core";
            UnityEngine.Object.DestroyImmediate(core.GetComponent<Collider>());core.transform.SetParent(beacon.transform,false);core.transform.localScale=new Vector3(.35f,1,.35f);
            var coreRenderer=core.GetComponent<Renderer>();coreRenderer.sharedMaterial=ShadowTempleArt.Transparent("Shadow beacon core",new Color(1,.98f,.92f,.5f),true);coreRenderer.shadowCastingMode=ShadowCastingMode.Off;
            Forecourt(surface,gate);

            // Bottom prompt in the same place and style as the other temples.
            var canvas=Canvas(HudName);canvas.GetComponent<Canvas>().sortingOrder=30;
            var panel=Rect("Shadow sanctuary prompt",canvas,new Vector2(.5f,0),new Vector2(.5f,0),new Vector2(0,24),new Vector2(620,58));
            var backing=panel.gameObject.AddComponent<UnityEngine.UI.Image>();backing.color=Ink;backing.raycastTarget=false;
            var label=Text(panel,"Shadow sanctuary prompt text",ShadowSanctuaryEntrance.PromptApproach,new Vector2(.5f,.5f),new Vector2(.5f,.5f),Vector2.zero,new Vector2(610,55),22);
            panel.gameObject.SetActive(false);

            var entrance=gate.gameObject.AddComponent<ShadowSanctuaryEntrance>();
            entrance.Configure(player,orbit,doorway,seal,panel.gameObject,label,beaconRenderer);
            gate.gameObject.AddComponent<ShadowEntranceSmoke>();
            var weight=UnityEngine.Object.FindFirstObjectByType<TempleEntrance>();
            if(weight!=null){weight.ConfigureShadowContext(entrance);EditorUtility.SetDirty(weight);}
            var quest=UnityEngine.Object.FindFirstObjectByType<QuestGuide>();
            if(quest!=null)
            {
                quest.ConfigureShadow(entrance);
                string questSource=System.IO.File.ReadAllText("Assets/Mumu/Runtime/QuestGuide.cs");
                foreach(var font in quest.GetComponentsInChildren<TextMeshProUGUI>(true).Select(t=>t.font).Where(f=>f!=null).Distinct())
                {
                    string path=AssetDatabase.GetAssetPath(font);
                    ShadowFonts.Extend(font,questSource,"SHADOW_QUEST_FONT_MISSING");
                    font.atlasPopulationMode=AtlasPopulationMode.Static;
                    foreach(var atlas in font.atlasTextures){if(AssetDatabase.GetAssetPath(atlas)!=path)AssetDatabase.AddObjectToAsset(atlas,font);EditorUtility.SetDirty(atlas);}
                    EditorUtility.SetDirty(font);
                    Debug.Log("SHADOW_QUEST_FONT "+font.name+" missingHangul=["+ShadowFonts.MissingHangul(font,new[]{questSource})+"]");
                }
                EditorUtility.SetDirty(quest);
            }
            int hidden=SetNature(p=>ShadowSanctuaryEntrance.InsideFootprint(gate.InverseTransformPoint(p)),false);
            AssetDatabase.SaveAssets();
            Debug.Log("SHADOW_EXTERIOR_READY position="+gate.position.ToString("F3")+" doorway="+doorway.position.ToString("F3")+
                " surfaceFromSpawn="+(Vector3.Angle(player.transform.position,gate.position)*Mathf.Deg2Rad*gate.position.magnitude).ToString("0.0")+
                " restored="+restored+" hidden="+hidden+" footprintDrop="+lowest.ToString("0.00"));
        }

        // Faces the saved spawn (gate front = local -Z). The plinth top sits 0.3 m above the highest ground under it.
        static Pose GatePose(PlanetSurface surface,PlanetExplorer player,out float lowest)
        {
            var spawn=player.transform;
            var ground=surface.TerrainPoint(spawn.position+spawn.forward*SiteForward-spawn.right*SiteLeft);
            var up=ground.normalized;
            var rotation=Quaternion.LookRotation(Vector3.ProjectOnPlane(ground-spawn.position,up).normalized,up);
            float high=float.MinValue,low=float.MaxValue;
            for(float x=-3.5f;x<=3.5f;x+=.5f)for(float z=-1.2f;z<=1.2f;z+=.4f)
            {
                float h=Height(surface,ground,rotation,x,z);high=Mathf.Max(high,h);low=Mathf.Min(low,h);
            }
            lowest=high-low;
            if(high-low>1.25f)Debug.LogWarning("SHADOW_EXTERIOR plinth may float: ground drops "+(high-low).ToString("0.00")+" m under the gate");
            return new Pose(ground+up*high,rotation);
        }
        static float Height(PlanetSurface surface,Vector3 origin,Quaternion rotation,float x,float z)
        {
            var ray=new Ray(origin+rotation*new Vector3(x,40,z),-(rotation*Vector3.up));
            if(!surface.RaycastTerrain(ray,out var hit,90))throw new InvalidOperationException("No terrain below the moon gate");
            return (Quaternion.Inverse(rotation)*(hit.point-origin)).y;
        }
        // Two-tone flagstones that follow the ground in front of the gate (visual only).
        static void Forecourt(PlanetSurface surface,Transform gate)
        {
            var verts=new List<Vector3>();var colors=new List<Color>();var tris=new List<int>();
            var light=new Color(.78f,.74f,.62f);var dark=new Color(.69f,.65f,.55f);
            for(int ix=0;ix<6;ix++)for(int iz=0;iz<4;iz++)
            {
                float x0=-3+ix+.03f,x1=-3+ix+.97f,z0=-5.2f+iz+.03f,z1=-5.2f+iz+.97f;
                int s=verts.Count;
                foreach(var (x,z) in new[]{(x0,z0),(x0,z1),(x1,z1),(x1,z0)})
                {
                    var ray=new Ray(gate.TransformPoint(new Vector3(x,40,z)),-gate.up);
                    float y=surface.RaycastTerrain(ray,out var hit,90)?gate.InverseTransformPoint(hit.point).y+.04f:0;
                    verts.Add(new Vector3(x,y,z));colors.Add((ix+iz)%2==0?light:dark);
                }
                tris.AddRange(new[]{s,s+1,s+2,s,s+2,s+3});
            }
            string path=ShadowTempleArt.Output+"Moon gate forecourt.asset";
            var mesh=AssetDatabase.LoadAssetAtPath<Mesh>(path);
            if(mesh==null){mesh=new Mesh{name="Moon gate forecourt"};AssetDatabase.CreateAsset(mesh,path);}else mesh.Clear();
            mesh.SetVertices(verts);mesh.SetColors(colors);mesh.SetTriangles(tris,0);mesh.RecalculateNormals();mesh.RecalculateBounds();EditorUtility.SetDirty(mesh);
            var material=ShadowTempleArt.Shaded("Shadow forecourt","Mumu/World Vertex");material.SetColor("_BaseColor",Color.white);EditorUtility.SetDirty(material);
            var go=new GameObject("Moon gate forecourt",typeof(MeshFilter),typeof(MeshRenderer));go.transform.SetParent(gate,false);
            go.GetComponent<MeshFilter>().sharedMesh=mesh;var r=go.GetComponent<MeshRenderer>();r.sharedMaterial=material;r.shadowCastingMode=ShadowCastingMode.Off;
        }
        static void Solid(Transform parent,string name,Vector3 centre,Vector3 size)
        {
            var obj=new GameObject(name);obj.layer=8;obj.transform.SetParent(parent,false);obj.transform.localPosition=centre;obj.AddComponent<BoxCollider>().size=size;
        }
        static int SetNature(Func<Vector3,bool> inside,bool active)
        {
            int changed=0;
            foreach(var name in ShadowSanctuaryEntrance.NatureGroups)
            {
                var group=GameObject.Find(name);if(group==null)continue;
                foreach(Transform item in group.transform)
                    if(item.gameObject.activeSelf!=active&&inside(item.position)){item.gameObject.SetActive(active);changed++;}
            }
            return changed;
        }
    }
}
