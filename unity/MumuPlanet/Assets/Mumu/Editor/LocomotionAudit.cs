using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using UnityEditor.SceneManagement;
using UnityEngine;
using Mumu.Planet;

namespace Mumu.Editor
{
    public static class LocomotionAudit
    {
        public static void FixAndBuild() { BuildExploration.RepairLocomotion();Run();ValidateResult();BuildExploration.BuildWindows(); }
        static void ValidateResult()
        {
            var report=JsonUtility.FromJson<Report>(File.ReadAllText(Path.GetFullPath("../../reports/2026-09-20/unity-sliding/audit.json")));
            if(report.samples.Any(s=>float.IsNaN(s.time)||float.IsInfinity(s.time)||Mathf.Abs(s.time)>1000))
                throw new InvalidOperationException("Animation time became unbounded after idle.");
            foreach(string phase in new[]{"1","2","4","5","6"})
                if(!report.samples.Any(s=>s.phase==phase&&s.frame%180>90&&s.legChange>1))
                    throw new InvalidOperationException("Locomotion froze in phase "+phase);
            Debug.Log("LOCOMOTION_AUDIT_PASS");
        }
        [Serializable] class Sample { public int frame; public string phase; public float speed,parameter,time,legChange; public bool loop; }
        [Serializable] class Report { public Sample[] samples; }
        public static void Run()
        {
            EditorSceneManager.OpenScene("Assets/Mumu/Scenes/PlanetExploration.unity");
            var player=UnityEngine.Object.FindFirstObjectByType<PlanetExplorer>();
            var animator=player.GetComponentInChildren<Animator>();
            var pose=animator.GetComponent<NavigatorPose>();pose.Configure(player);
            var leg=animator.GetComponentsInChildren<Transform>().First(t=>t.name=="LeftUpLeg");
            animator.Rebind();animator.Update(0);
            foreach(var clip in animator.runtimeAnimatorController.animationClips)
                Debug.Log($"LOCOMOTION_CLIP {clip.name} length={clip.length} loop={clip.isLooping}");
            var samples=new List<Sample>();var previous=leg.localRotation;
            var start=player.transform.position;var heading=player.transform.forward;
            for(int frame=0;frame<1200;frame++)
            {
                int phase=frame/180;
                var desired=phase==0||phase==3?Vector3.zero:Quaternion.AngleAxis(phase*90,player.Up)*Vector3.ProjectOnPlane(heading,player.Up).normalized;
                player.Step(desired,phase==5,false,1f/60);
                animator.Update(1f/60);pose.Apply();
                if(frame%15==0)
                {
                    var state=animator.GetCurrentAnimatorStateInfo(0);
                    samples.Add(new Sample{frame=frame,phase=phase.ToString(),speed=player.Speed,parameter=animator.GetFloat("Speed"),time=state.normalizedTime,loop=state.loop,legChange=Quaternion.Angle(previous,leg.localRotation)});
                    previous=leg.localRotation;
                }
                if(frame%180==179)player.Respawn(start,heading);
            }
            string output=Path.GetFullPath("../../reports/2026-09-20/unity-sliding");Directory.CreateDirectory(output);
            File.WriteAllText(Path.Combine(output,"audit.json"),JsonUtility.ToJson(new Report{samples=samples.ToArray()},true));
            Debug.Log("LOCOMOTION_AUDIT_DONE");
        }
    }
}
