using System;
using System.Collections;
using System.IO;
using UnityEngine;

namespace Mumu.Planet
{
    // Runs only when an explicit validation command-line flag is present.
    public sealed class ExplorationSmoke : MonoBehaviour
    {
        [SerializeField] PlanetExplorer explorer;
        [SerializeField] OrbitCamera orbit;
        [SerializeField] Camera gameCamera;
        [SerializeField] Animator animator;
        public void Configure(PlanetExplorer player, OrbitCamera cameraRig, Camera camera, Animator body)
        { explorer=player;orbit=cameraRig;gameCamera=camera;animator=body; }
        IEnumerator Start()
        {
            string[] args=Environment.GetCommandLineArgs();int index=Array.IndexOf(args,"-mumu-smoke");
            if(index<0)yield break;
            string output=index+1<args.Length?args[index+1]:Application.persistentDataPath;
            Directory.CreateDirectory(output);
            explorer.enabled=false;orbit.enabled=false;
            for(int i=0;i<20;i++)yield return null;
            string failure=null;
            var validation=Validate(output);
            while(true)
            {
                bool more=false;
                try { more=validation.MoveNext(); } catch(Exception e) { failure=e.ToString();Debug.LogException(e); }
                if(!more||failure!=null)break;
                yield return validation.Current;
            }
            File.WriteAllText(Path.Combine(output,"result.json"),JsonUtility.ToJson(new Result{passed=failure==null,error=failure??"",unity=Application.unityVersion},true));
            Application.Quit(failure==null?0:1);
        }
        [Serializable] class Result { public bool passed;public string error,unity; }
        Transform Bone(string name)
        {
            foreach(var t in animator.GetComponentsInChildren<Transform>())if(t.name==name)return t;
            throw new InvalidOperationException("Missing joint: "+name);
        }
        void CheckRestPose()
        {
            foreach(string side in new[]{"Left","Right"})
            {
                var shoulder=Bone(side+"Arm");var elbow=Bone(side+"ForeArm");var hand=Bone(side+"Hand");
                Check(Vector3.Angle(elbow.position-shoulder.position,-explorer.Up)<25f,side+" upper arm hangs below shoulder");
                Check(Vector3.Dot(elbow.position-hand.position,explorer.Up)>.13f,side+" hand hangs below elbow");
                var before=hand.position;
                for(int i=0;i<100;i++)animator.GetComponent<NavigatorPose>().Apply();
                Check(Vector3.Distance(before,hand.position)<.001f,side+" idle pose does not accumulate rotation");
            }
        }
        void Check(bool condition,string message) { if(!condition)throw new InvalidOperationException(message);Debug.Log("MUMU_CHECK "+message); }
        [Serializable] class LocomotionWindow { public string phase;public float normalizedTime,legSwing,speed; }
        [Serializable] class LocomotionResult { public LocomotionWindow[] windows; }
        IEnumerator CheckLocomotionCycles(string output)
        {
            var start=explorer.transform.position;var heading=explorer.transform.forward;
            var leg=Bone("LeftUpLeg");
            var windows=new System.Collections.Generic.List<LocomotionWindow>();
            string[] names={"initial idle","walk forward","turn right","stop for three seconds","restart in reverse","turn and run","stop again","restart left"};
            for(int phase=0;phase<names.Length;phase++)
            {
                explorer.Respawn(start,heading);
                bool idle=phase==0||phase==3||phase==6;
                var first=Quaternion.identity;float swing=0;
                for(int frame=0;frame<180;frame++)
                {
                    var direction=Quaternion.AngleAxis(phase*90,explorer.Up)*Vector3.ProjectOnPlane(heading,explorer.Up).normalized;
                    explorer.Step(idle?Vector3.zero:direction,phase==5,false,1f/60);
                    animator.Update(1f/60);animator.GetComponent<NavigatorPose>().Apply();
                    if(frame==90)first=leg.localRotation;
                    if(frame>90)swing=Mathf.Max(swing,Quaternion.Angle(first,leg.localRotation));
                    if(phase==4&&(frame==105||frame==120))Capture(Path.Combine(output,frame==105?"turn-walk-a.png":"turn-walk-b.png"),true,true);
                    if(frame%15==0)yield return null;
                }
                float time=animator.GetCurrentAnimatorStateInfo(0).normalizedTime;
                windows.Add(new LocomotionWindow{phase=names[phase],normalizedTime=time,legSwing=swing,speed=explorer.Speed});
                File.WriteAllText(Path.Combine(output,"locomotion.json"),JsonUtility.ToJson(new LocomotionResult{windows=windows.ToArray()},true));
                Check(!float.IsNaN(time)&&!float.IsInfinity(time)&&Mathf.Abs(time)<1000,"Bounded animation time after "+names[phase]);
                if(!idle)
                {
                    Check(explorer.Speed>2,"Player keeps moving during "+names[phase]);
                    Check(swing>10,"Legs keep cycling during "+names[phase]);
                }
            }
            explorer.Respawn(start,heading);explorer.Step(Vector3.zero,false,false,1f/60);
        }
        void Capture(string path, bool portrait=false, bool sideView=false)
        {
            animator.GetComponent<NavigatorPose>().Apply();
            orbit.Snap();
            if(portrait)
            {
                var focus=explorer.transform.position+explorer.Up*.8f;
                gameCamera.transform.position=focus+(sideView?explorer.transform.right:explorer.transform.forward)*3.2f+explorer.Up*.1f;
                gameCamera.transform.rotation=Quaternion.LookRotation(focus-gameCamera.transform.position,explorer.Up);
            }
            Check(Vector3.Distance(gameCamera.transform.position,explorer.transform.position)>3f,"Camera keeps exploration distance");
            var rt=new RenderTexture(1440,900,24,RenderTextureFormat.ARGB32);rt.Create();
            var previous=RenderTexture.active;gameCamera.targetTexture=rt;
            gameCamera.Render();RenderTexture.active=rt;
            var image=new Texture2D(1440,900,TextureFormat.RGB24,false);image.ReadPixels(new Rect(0,0,1440,900),0,0);image.Apply();
            File.WriteAllBytes(path,image.EncodeToPNG());gameCamera.targetTexture=null;RenderTexture.active=previous;rt.Release();Destroy(rt);Destroy(image);
        }
        IEnumerator Validate(string output)
        {
            var start=explorer.transform.position;var heading=explorer.transform.forward;
            Check(animator.runtimeAnimatorController!=null,"Animator controller is connected");
            Check(animator.GetComponentsInChildren<Renderer>().Length==1,"No Blender bone-handle meshes are exported");
            Check(animator.GetComponent<NavigatorPose>().HasRequiredBones,"Procedural jump bones are connected");
            animator.Update(.02f);yield return null;Capture(Path.Combine(output,"landing.png"));
            CheckRestPose();
            var initialSkin=animator.GetComponentInChildren<SkinnedMeshRenderer>();var measured=new Mesh();initialSkin.BakeMesh(measured,true);
            float low=float.PositiveInfinity,high=float.NegativeInfinity;
            foreach(var v in measured.vertices){float y=Vector3.Dot(initialSkin.transform.TransformPoint(v)-explorer.transform.position,explorer.Up);low=Mathf.Min(low,y);high=Mathf.Max(high,y);}
            Destroy(measured);
            Check(Mathf.Abs(high-low-1.5f)<.03f,"Evaluated character skin is 1.5 units tall");
            Check(Mathf.Abs(low)<.025f,"Evaluated character feet touch ground");
            yield return null;Capture(Path.Combine(output,"idle-front.png"),true);Capture(Path.Combine(output,"idle-side.png"),true,true);
            for(int i=0;i<120;i++)explorer.Step(Vector3.zero,false,false,1f/60);
            Check(Vector3.Distance(start,explorer.transform.position)<.025f,"Idle feet stay on surface");
            float peak=0;explorer.Step(Vector3.zero,false,true,1f/60);
            for(int i=0;i<80;i++)
            {
                explorer.Step(Vector3.zero,false,false,1f/60);peak=Mathf.Max(peak,Vector3.Distance(start,explorer.transform.position));
                if(i==16)
                {
                    animator.Update(1f/60);yield return null;yield return null;Capture(Path.Combine(output,"jump.png"));
                    foreach(var side in new[]{"Left","Right"})
                    {
                        float bend=Vector3.Angle(Bone(side+"Leg").position-Bone(side+"UpLeg").position,Bone(side+"Foot").position-Bone(side+"Leg").position);
                        Check(bend>30f&&bend<100f,side+" jump knee bends within anatomical range");
                    }
                    Capture(Path.Combine(output,"jump-side.png"),true,true);
                }
            }
            Check(peak>.65f&&peak<1.3f,"Jump height is bounded");
            Check(explorer.Grounded&&Vector3.Distance(start,explorer.transform.position)<.025f,"Jump lands at original ground level");
            var locomotion=CheckLocomotionCycles(output);
            while(locomotion.MoveNext())yield return locomotion.Current;
            // Follow the same authored ridge waypoints as the existing web game.
            float[,] points={{9,-13},{13,-10},{17,-6},{20,-3},{22,0}};
            for(int waypoint=0;waypoint<points.GetLength(0);waypoint++)
            {
                float lat=points[waypoint,0]*Mathf.Deg2Rad,lon=points[waypoint,1]*Mathf.Deg2Rad;
                var target=new Vector3(Mathf.Cos(lat)*Mathf.Cos(lon),Mathf.Sin(lat),-Mathf.Cos(lat)*Mathf.Sin(lon));
                int frames=0;
                while(Vector3.Angle(explorer.Up,target)*Mathf.Deg2Rad*68f>.5f&&frames++<1800)
                {
                    explorer.Step(Vector3.ProjectOnPlane(target,explorer.Up).normalized,false,false,1f/60);
                    animator.Update(1f/60);
                }
                Check(frames<1800,"Ridge waypoint "+waypoint+" is reachable");
                Check(Vector3.Dot(explorer.transform.up,explorer.Up)>.999f,"Character up follows planet gravity");
            }
            yield return null;Capture(Path.Combine(output,"overlook.png"));
            explorer.Respawn(start,heading);animator.SetFloat("Speed",0);animator.Update(.1f);
            var skin=animator.GetComponentInChildren<SkinnedMeshRenderer>();var a=new Mesh();var b=new Mesh();skin.BakeMesh(a);
            animator.SetFloat("Speed",5.8f);animator.Update(.3f);skin.BakeMesh(b);
            Check(a.vertexCount==b.vertexCount&&a.vertices[0]!=b.vertices[0],"Run animation deforms the skinned mesh");Destroy(a);Destroy(b);
            Check(Shader.Find("Mumu/World Vertex")!=null,"World shader is included");
            Debug.Log("MUMU_SMOKE_PASS jumpPeak="+peak);
        }
    }
}
