using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using Mumu.Planet;

namespace Mumu.Editor
{
    public static class NavigatorRigAudit
    {
        [Serializable] class Joint { public string name; public Vector3 position, scale; }
        [Serializable] class Sample { public string mode;public Joint[] joints;public float skinHeight,footHeight; }
        [Serializable] class Audit { public Sample[] samples; }
        public static void FixAndBuild() { FixScene();BuildExploration.BuildWindows(); }
        public static void FixScene()
        {
            var scene=EditorSceneManager.OpenScene("Assets/Mumu/Scenes/PlanetExploration.unity");
            var player=UnityEngine.Object.FindFirstObjectByType<PlanetExplorer>();
            BuildExploration.NormalizeNavigator(player.GetComponentInChildren<Animator>(),player.transform);
            EditorSceneManager.SaveScene(scene);
            Run();
        }
        public static void Run()
        {
            EditorSceneManager.OpenScene("Assets/Mumu/Scenes/PlanetExploration.unity");
            var player=UnityEngine.Object.FindFirstObjectByType<PlanetExplorer>();
            var animator=player.GetComponentInChildren<Animator>();
            var pose=animator.GetComponent<NavigatorPose>();
            pose.Configure(player);animator.Rebind();animator.Update(0);
            var initialSkin=animator.GetComponentInChildren<SkinnedMeshRenderer>();var initialMesh=new Mesh();initialSkin.BakeMesh(initialMesh,true);
            float initialFoot=initialMesh.vertices.Min(v=>player.transform.InverseTransformPoint(initialSkin.transform.TransformPoint(v)).y);
            animator.transform.position-=player.transform.up*initialFoot;UnityEngine.Object.DestroyImmediate(initialMesh);
            var samples=new System.Collections.Generic.List<Sample>();
            foreach(var mode in new[]{"idle-source","idle-corrected","walk-source","run-source"})
            {
                animator.Rebind();animator.SetFloat("Speed",mode.StartsWith("walk")?3.2f:mode.StartsWith("run")?5.8f:0);animator.Update(.2f);
                if(mode=="idle-corrected")pose.Apply();
                var skin=animator.GetComponentInChildren<SkinnedMeshRenderer>();var mesh=new Mesh();skin.BakeMesh(mesh,true);
                var points=mesh.vertices.Select(v=>player.transform.InverseTransformPoint(skin.transform.TransformPoint(v))).ToArray();
                samples.Add(new Sample{mode=mode,footHeight=points.Min(v=>v.y),skinHeight=points.Max(v=>v.y)-points.Min(v=>v.y),
                    joints=animator.GetComponentsInChildren<Transform>().Where(t=>new[]{"Hips","Head","LeftArm","LeftForeArm","LeftHand","RightArm","RightForeArm","RightHand","LeftUpLeg","LeftLeg","LeftFoot"}.Contains(t.name)).Select(t=>new Joint{name=t.name,position=player.transform.InverseTransformPoint(t.position),scale=t.lossyScale}).ToArray()});
                UnityEngine.Object.DestroyImmediate(mesh);
            }
            var output=Path.GetFullPath("../../reports/2026-09-20/unity-rig");Directory.CreateDirectory(output);
            File.WriteAllText(Path.Combine(output,"audit.json"),JsonUtility.ToJson(new Audit{samples=samples.ToArray()},true));
            Debug.Log("MUMU_RIG_AUDIT "+output);
        }
    }
}
