using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEngine;
using UnityEngine.Rendering;

namespace Mumu.Planet
{
    // Opt-in validation of the shadow temple: -mumu-shadow-temple-smoke <dir> [-mumu-shadow-temple-mode full|stage-a..stage-e|unreadable]
    // Walking uses PlanetExplorer.Step every frame (no teleports), devices are used through ShadowTemple.Interact.
    public sealed class ShadowTempleSmoke : MonoBehaviour
    {
        [Serializable] sealed class Result {public bool passed;public string mode;public string error;public List<string> checks=new List<string>();public List<string> measurements=new List<string>();}
        const float Dt=1f/60f;
        readonly Result result=new Result();
        string output,mode;
        ShadowTemple temple;PlanetExplorer player;OrbitCamera orbit;Camera view;Animator animator;
        ShadeWalkRoom shade;MirrorRoom mirror;SilhouetteRoom silhouette;ShadowSanctum sanctum;
        int presses;

        IEnumerator Start()
        {
            var args=Environment.GetCommandLineArgs();int index=Array.IndexOf(args,"-mumu-shadow-temple-smoke");
            if(index<0||index+1>=args.Length)yield break;
            output=args[index+1];Directory.CreateDirectory(output);
            int m=Array.IndexOf(args,"-mumu-shadow-temple-mode");mode=m>=0&&m+1<args.Length?args[m+1]:"full";result.mode=mode;
            temple=GetComponent<ShadowTemple>();temple.ManualDrive=true;temple.SuppressDeparture=true;
            for(int i=0;i<20;i++)yield return null;
            player=temple.Player;orbit=temple.Orbit;view=orbit.GetComponent<Camera>();animator=player.GetComponentInChildren<Animator>();
            player.enabled=false;
            shade=(ShadeWalkRoom)temple.Rooms[0];mirror=(MirrorRoom)temple.Rooms[1];silhouette=(SilhouetteRoom)temple.Rooms[2];sanctum=(ShadowSanctum)temple.Rooms[3];
            IEnumerator run=mode=="unreadable"?Unreadable():mode.StartsWith("stage-")?Stage(mode):Full();
            var stack=new Stack<IEnumerator>();stack.Push(run);
            while(stack.Count>0)
            {
                object current;
                try{if(!stack.Peek().MoveNext()){stack.Pop();continue;}current=stack.Peek().Current;}
                catch(Exception e){result.error=e.ToString();Debug.LogError(e);break;}
                if(current is IEnumerator nested){stack.Push(nested);continue;}
                yield return current;
            }
            result.passed=result.error==null;
            File.WriteAllText(Path.Combine(output,"result.json"),JsonUtility.ToJson(result,true));
            Application.Quit(result.passed?0:1);
        }
        void Check(bool ok,string name){if(!ok)throw new Exception(name);result.checks.Add(name);Debug.Log("SHADOW_CHECK "+name);}
        // Measurement checks: a failure is recorded and the run continues, so one run shows every problem.
        readonly List<string> failures=new List<string>();
        void Expect(bool ok,string name){if(ok){result.checks.Add(name);Debug.Log("SHADOW_CHECK "+name);}else{failures.Add(name);result.measurements.Add("FAILED: "+name);Debug.LogWarning("SHADOW_FAILED "+name);}}
        void Measure(string text){result.measurements.Add(text);Debug.Log("SHADOW_MEASURE "+text);}

        // ---------------- simulation helpers ----------------
        void Tick(Vector3 desired,float dt=Dt)
        {
            player.Step(desired,false,false,dt);
            if(animator!=null)animator.Update(dt);
            temple.Step(dt,false);
            Physics.SyncTransforms();
        }
        IEnumerator Wait(float seconds)
        {
            for(float t=0;t<seconds;t+=Dt){Tick(Vector3.zero);if(((int)(t/Dt))%40==0)yield return null;}
        }
        IEnumerator Walk(Vector3 target,float seconds=25,float arrive=.12f)
        {
            float t=0;int frames=0;
            while(t<seconds)
            {
                var delta=Vector3.ProjectOnPlane(target-player.transform.position,Vector3.up);
                if(delta.magnitude<arrive)break;
                Tick(delta.normalized*Mathf.Min(1,delta.magnitude*12));t+=Dt;
                if(++frames%40==0)yield return null;
            }
            var left=Vector3.ProjectOnPlane(target-player.transform.position,Vector3.up).magnitude;
            if(left>=arrive+.05f)throw new Exception("Walk did not reach "+target.ToString("F2")+" (left "+left.ToString("F2")+" m, at "+player.transform.position.ToString("F2")+")");
            Tick(Vector3.zero);
        }
        IEnumerator Route(params Vector3[] points){foreach(var p in points)yield return Go(p);}
        IEnumerator WaitGate(int gate)
        {
            float t=0;while(!temple.GateOpen(gate)&&t<4){Tick(Vector3.zero);t+=Dt;}
            Check(temple.GateOpen(gate),"Gate "+(gate+1)+" opened ("+t.ToString("0.00")+" s)");
            yield return null;
        }
        // Grid A* over the temple floor (0.25 m cells, capsule clearance on layer 8, support on layer 9).
        const float GridStep=.25f;
        static bool Free(Vector2 p)
        {
            var w=new Vector3(p.x,0,p.y);
            if(!Physics.Raycast(w+Vector3.up*.3f,Vector3.down,.7f,1<<9,QueryTriggerInteraction.Ignore))return false;
            return !Physics.CheckCapsule(w+Vector3.up*.35f,w+Vector3.up*1.2f,.3f,1<<8,QueryTriggerInteraction.Ignore);
        }
        List<Vector3> Plan(Vector3 from,Vector3 to)
        {
            Physics.SyncTransforms();
            Vector2Int Cell(Vector3 p)=>new Vector2Int(Mathf.RoundToInt(p.x/GridStep),Mathf.RoundToInt(p.z/GridStep));
            Vector2 Centre(Vector2Int c)=>new Vector2(c.x*GridStep,c.y*GridStep);
            var start=Cell(from);var goal=Cell(to);
            var free=new Dictionary<Vector2Int,bool>();
            bool IsFree(Vector2Int c){if(c==start||c==goal)return true;if(!free.TryGetValue(c,out bool f)){f=Free(Centre(c));free[c]=f;}return f;}
            var open=new SortedSet<(float,int,Vector2Int)>(Comparer<(float,int,Vector2Int)>.Create((a,b)=>a.Item1!=b.Item1?a.Item1.CompareTo(b.Item1):a.Item2!=b.Item2?a.Item2.CompareTo(b.Item2):a.Item3.x!=b.Item3.x?a.Item3.x.CompareTo(b.Item3.x):a.Item3.y.CompareTo(b.Item3.y)));
            var cost=new Dictionary<Vector2Int,float>{[start]=0};var from2=new Dictionary<Vector2Int,Vector2Int>();int order=0;
            open.Add((Vector2Int.Distance(start,goal),order++,start));
            while(open.Count>0&&order<60000)
            {
                var current=open.Min;open.Remove(current);var c=current.Item3;
                if(c==goal)
                {
                    var path=new List<Vector3>();
                    for(var k=goal;k!=start;k=from2[k]){var q=Centre(k);path.Add(new Vector3(q.x,0,q.y));}
                    path.Reverse();if(path.Count>0)path[path.Count-1]=new Vector3(to.x,0,to.z);return path;
                }
                for(int dx=-1;dx<=1;dx++)for(int dz=-1;dz<=1;dz++)
                {
                    if(dx==0&&dz==0)continue;var n=new Vector2Int(c.x+dx,c.y+dz);
                    if(!IsFree(n))continue;
                    if(dx!=0&&dz!=0&&(!IsFree(new Vector2Int(c.x+dx,c.y))||!IsFree(new Vector2Int(c.x,c.y+dz))))continue;
                    float g=cost[c]+(dx!=0&&dz!=0?1.4142f:1);
                    if(cost.TryGetValue(n,out float old)&&old<=g)continue;
                    cost[n]=g;from2[n]=c;open.Add((g+Vector2Int.Distance(n,goal),order++,n));
                }
            }
            return null;
        }
        IEnumerator Go(Vector3 target)
        {
            var path=Plan(player.transform.position,target);
            if(path==null)throw new Exception("No walkable route from "+player.transform.position.ToString("F2")+" to "+target.ToString("F2"));
            for(int i=0;i<path.Count;i++)yield return Walk(path[i],10,i==path.Count-1?.12f:.2f);
        }
        // Walks to the reachable free spot within [min,max] of a device that is nearer to it than to any other device.
        IEnumerator GoNear(Vector2 device,float min,float max,params Vector2[] others)
        {
            Physics.SyncTransforms();
            var here=ShadowOptics.Flat(player.transform.position);
            Vector2? best=null;float bestDistance=float.MaxValue;
            for(float r=min;r<=max+1e-3f;r+=.1f)for(int k=0;k<36;k++)
            {
                float a=k*Mathf.PI*2/36;var p=device+new Vector2(Mathf.Cos(a),Mathf.Sin(a))*r;
                if(!Free(p))continue;
                if(others.Any(o=>Vector2.Distance(p,o)<=r+.35f))continue;
                float d=Vector2.Distance(p,here);if(d<bestDistance){bestDistance=d;best=p;}
            }
            if(!best.HasValue)throw new Exception("No free standing spot near "+device.ToString("F2"));
            yield return Go(new Vector3(best.Value.x,0,best.Value.y));
        }
        Vector2[] RailAndDevices()
        {
            var list=new List<Vector2>(MirrorDevices(4));
            for(int i=0;i<MirrorRoom.Stops;i++)list.Add(new Vector2(MirrorRoom.StopX(i),mirror.RailZ));
            return list.ToArray();
        }
        Vector2[] MirrorDevices(int except)
        {
            var list=new List<Vector2>();
            for(int i=0;i<(mirror.FirstLock?4:3);i++)if(i!=except)list.Add(mirror.MirrorCentre(i));
            if(mirror.FirstLock&&except!=4)list.Add(mirror.LeverCentre);
            return list.ToArray();
        }
        void ClearSpeech()
        {
            for(int i=0;i<600&&temple.SpeechActive;i++){Tick(Vector3.zero);temple.AdvanceSpeech();}
        }
        bool Press(int direction){presses++;bool changed=temple.Interact(direction);Tick(Vector3.zero);return changed;}

        // ---------------- room 1: time-expanded plan through the moving shadows ----------------
        const float Cell=.3f,StepTime=.1f;
        const float GridX0=-6.3f,GridZ0=-3.4f;const int NX=43,NZ=44;
        static bool Blocked(Vector2 p)
        {
            foreach(var c in ShadeWalkRoom.Pillars)if(Vector2.Distance(p,c)<1.08f)return true;
            return Mathf.Abs(p.x)>6.4f;
        }
        static bool SafeAt(float phase,Vector2 p)
        {
            if(p.y<=ShadeWalkRoom.SafeIn||p.y>=ShadeWalkRoom.SafeOut)return true;
            var polys=ShadeWalkRoom.ShadowsAt(phase);
            foreach(var o in new[]{Vector2.zero,new Vector2(.12f,0),new Vector2(-.12f,0),new Vector2(0,.12f),new Vector2(0,-.12f)})
                if(!ShadowOptics.InsideAny(polys,p+o))return false;
            return true;
        }
        // BFS over (cell, time). Returns cell centres per 0.1 s step, or null.
        public static List<Vector2> PlanCrossing(float phase,float speed,Vector2 start,int horizon,out int expanded)
        {
            expanded=0;
            Vector2 C(int ix,int iz)=>new Vector2(GridX0+ix*Cell,GridZ0+iz*Cell);
            int sx=Mathf.RoundToInt((start.x-GridX0)/Cell),sz=Mathf.RoundToInt((start.y-GridZ0)/Cell);
            int n=NX*NZ;var parent=new int[(horizon+1)*n];var seen=new bool[(horizon+1)*n];
            var safeCache=new Dictionary<int,bool>();
            bool Safe(int t,int cell){int key=t*n+cell;if(safeCache.TryGetValue(key,out bool v))return v;var p=C(cell%NX,cell/NX);v=SafeAt(phase+speed*StepTime*t,p)&&SafeAt(phase+speed*StepTime*(t+1),p);safeCache[key]=v;return v;}
            var frontier=new List<int>{sz*NX+sx};seen[sz*NX+sx]=true;
            for(int t=0;t<horizon;t++)
            {
                var next=new List<int>();
                foreach(int cell in frontier)
                {
                    expanded++;
                    int ix=cell%NX,iz=cell/NX;
                    if(C(ix,iz).y>=ShadeWalkRoom.SafeOut+.1f)
                    {
                        var path=new List<Vector2>();int at=t*n+cell;
                        for(int k=t;k>=0;k--){path.Add(C((at%n)%NX,(at%n)/NX));if(k>0)at=parent[at];}
                        path.Reverse();return path;
                    }
                    foreach(var (dx,dz) in new[]{(0,0),(1,0),(-1,0),(0,1),(0,-1)})
                    {
                        int jx=ix+dx,jz=iz+dz;if(jx<0||jz<0||jx>=NX||jz>=NZ)continue;
                        int nc=jz*NX+jx;int key=(t+1)*n+nc;if(seen[key])continue;
                        var p=C(jx,jz);if(Blocked(p)||!Safe(t+1,nc))continue;
                        seen[key]=true;parent[key]=t*n+cell;next.Add(nc);
                    }
                }
                frontier=next;if(frontier.Count==0)return null;
            }
            return null;
        }
        IEnumerator CrossShade(string label)
        {
            var start=new Vector2(0,-3.4f);
            yield return Go(new Vector3(start.x,0,start.y));
            List<Vector2> path=null;int expanded=0;
            // Wait in the safe practice yard until a crossing exists (usually immediate).
            for(int attempt=0;attempt<40&&path==null;attempt++)
            {
                path=PlanCrossing(shade.Phase,shade.LampSpeed,start,900,out expanded);
                if(path==null)yield return Wait(.5f);
            }
            Check(path!=null,label+": a shadow-only crossing exists from the practice yard");
            int failsBefore=shade.Fails;float maxExpose=0,time=0;
            foreach(var cell in path)
            {
                var target=new Vector3(cell.x,0,cell.y);
                for(int k=0;k<6;k++)
                {
                    var d=Vector3.ProjectOnPlane(target-player.transform.position,Vector3.up);
                    Tick(d.magnitude>.01f?d.normalized*Mathf.Min(1,d.magnitude*12):Vector3.zero);time+=Dt;
                    if(player.transform.position.z>ShadeWalkRoom.SafeIn)maxExpose=Mathf.Max(maxExpose,shade.Exposure);
                }
                if(shade.Solved)break;
                yield return null;
            }
            for(int k=0;k<120&&!shade.Solved;k++){Tick(Vector3.forward*.6f);time+=Dt;maxExpose=Mathf.Max(maxExpose,shade.Exposure);}
            Check(shade.Solved&&shade.Fails==failsBefore,label+": walked through the lit band in shadow without a failure");
            Measure(label+": crossing "+time.ToString("0.0")+" s, "+path.Count+" plan steps, max exposure "+maxExpose.ToString("0.00")+" s of "+shade.ExposeMax.ToString("0.0")+", BFS states "+expanded);
        }

        // ---------------- pixel agreement between engine shadows and ShadowOptics ----------------
        struct Probe {public Color32[] shadowed,open;public int w,h;}
        Probe Render(Camera cam,int w,int h,Renderer[] casters)
        {
            var rt=new RenderTexture(w,h,24,RenderTextureFormat.ARGB32){antiAliasing=1};rt.Create();
            var image=new Texture2D(w,h,TextureFormat.RGBA32,false);var probe=new Probe{w=w,h=h};
            cam.targetTexture=rt;var active=RenderTexture.active;
            // Casters cast but are not drawn, so they never hide the receiving surface from the probe camera.
            var modes=casters.Select(c=>c.shadowCastingMode).ToArray();
            foreach(var c in casters)c.shadowCastingMode=ShadowCastingMode.ShadowsOnly;
            cam.Render();RenderTexture.active=rt;image.ReadPixels(new Rect(0,0,w,h),0,0);image.Apply();probe.shadowed=image.GetPixels32();
            foreach(var c in casters)c.shadowCastingMode=ShadowCastingMode.Off;
            cam.Render();RenderTexture.active=rt;image.ReadPixels(new Rect(0,0,w,h),0,0);image.Apply();probe.open=image.GetPixels32();
            for(int i=0;i<casters.Length;i++)casters[i].shadowCastingMode=modes[i];
            RenderTexture.active=active;cam.targetTexture=null;rt.Release();Destroy(rt);Destroy(image);
            return probe;
        }
        static float Lum(Color32 c)=>.2126f*c.r+.7152f*c.g+.0722f*c.b;
        // Isolates one light and the given visible renderers, then compares ratio<0.5 with the analytic shadow.
        (int mismatch,int edge,int total,Probe probe) Agreement(Light light,Renderer[] visible,Renderer[] casters,Vector3 centre,Vector2 half,float edgeBand,
            Func<Vector2,bool> analytic,Func<Vector2,float> edgeDistance,Func<Vector2,bool> exclude,string png)
        {
            var renderers=FindObjectsByType<Renderer>(FindObjectsSortMode.None);var enabled=renderers.Select(r=>r.enabled).ToArray();
            var lights=FindObjectsByType<Light>(FindObjectsSortMode.None);var lightOn=lights.Select(l=>l.enabled).ToArray();
            var ambient=RenderSettings.ambientMode;var ambientColor=RenderSettings.ambientLight;bool fog=RenderSettings.fog;var sky=RenderSettings.skybox;
            var shadows=light.shadows;
            try
            {
                foreach(var r in renderers)r.enabled=visible.Contains(r)||casters.Contains(r);
                foreach(var l in lights)l.enabled=l==light;light.shadows=LightShadows.Soft;
                RenderSettings.ambientMode=AmbientMode.Flat;RenderSettings.ambientLight=Color.black;RenderSettings.fog=false;RenderSettings.skybox=null;
                var cam=new GameObject("Shadow agreement probe").AddComponent<Camera>();
                cam.orthographic=true;cam.orthographicSize=half.y;cam.aspect=half.x/half.y;cam.clearFlags=CameraClearFlags.SolidColor;cam.backgroundColor=Color.black;
                cam.transform.SetPositionAndRotation(centre+Vector3.up*20,Quaternion.Euler(90,0,0));cam.nearClipPlane=.1f;cam.farClipPlane=40;
                var data=cam.gameObject.AddComponent<UnityEngine.Rendering.Universal.UniversalAdditionalCameraData>();data.renderPostProcessing=false;data.renderShadows=true;
                int w=Mathf.RoundToInt(half.x*2/.0125f),h=Mathf.RoundToInt(half.y*2/.0125f);
                var probe=Render(cam,w,h,casters);Destroy(cam.gameObject);
                int mismatch=0,edge=0,total=0;
                var mask=new Color32[w*h];
                // Grout joints and dark trims are dark in both renders; a ratio test there says nothing.
                var lit=new List<float>();
                for(int i=0;i<w*h;i+=7){float v=Lum(probe.open[i]);if(v>12)lit.Add(v);}
                lit.Sort();float floorLevel=lit.Count>0?lit[lit.Count/2]*.55f:12;
                // Shadow is judged half way between the darkest shadow ratio and full light (see ScreenShadowWidth).
                var ratios=new List<float>();
                for(int i=0;i<w*h;i+=5){float v=Lum(probe.open[i]);if(v>=floorLevel)ratios.Add(Lum(probe.shadowed[i])/v);}
                ratios.Sort();float dark=ratios.Count>0?ratios[ratios.Count/100]:0;float threshold=(Mathf.Min(dark,.6f)+1)*.5f;
                Measure("  probe "+png+": shadow floor ratio "+dark.ToString("0.00")+", threshold "+threshold.ToString("0.00"));
                for(int y=0;y<h;y++)for(int x=0;x<w;x++)
                {
                    int i=y*w+x;var p=new Vector2(centre.x+(x+.5f-w*.5f)*(half.x*2/w),centre.z+(y+.5f-h*.5f)*(half.y*2/h));
                    float open=Lum(probe.open[i]);
                    if(open<floorLevel||exclude(p)){mask[i]=new Color32(0,0,0,255);continue;}
                    bool real=Lum(probe.shadowed[i])/open<threshold,want=analytic(p);
                    total++;
                    if(real==want){mask[i]=real?new Color32(40,50,90,255):new Color32(200,195,170,255);continue;}
                    if(edgeDistance(p)<edgeBand){edge++;mask[i]=new Color32(255,200,0,255);}
                    else{mismatch++;mask[i]=new Color32(255,0,0,255);}
                }
                var tex=new Texture2D(w,h,TextureFormat.RGBA32,false);tex.SetPixels32(mask);tex.Apply();File.WriteAllBytes(Path.Combine(output,png),tex.EncodeToPNG());
                tex.SetPixels32(probe.shadowed);tex.Apply();File.WriteAllBytes(Path.Combine(output,png.Replace(".png","-render.png")),tex.EncodeToPNG());
                tex.SetPixels32(probe.open);tex.Apply();File.WriteAllBytes(Path.Combine(output,png.Replace(".png","-open.png")),tex.EncodeToPNG());Destroy(tex);
                return (mismatch,edge,total,probe);
            }
            finally
            {
                for(int i=0;i<renderers.Length;i++)if(renderers[i]!=null)renderers[i].enabled=enabled[i];
                for(int i=0;i<lights.Length;i++)if(lights[i]!=null)lights[i].enabled=lightOn[i];
                light.shadows=shadows;RenderSettings.ambientMode=ambient;RenderSettings.ambientLight=ambientColor;RenderSettings.fog=fog;RenderSettings.skybox=sky;
            }
        }
        Renderer[] Named(Transform root,params string[] names)=>root.GetComponentsInChildren<Renderer>(true).Where(r=>names.Contains(r.name)).ToArray();
        Transform ArtRoot(string file)=>FindObjectsByType<Transform>(FindObjectsSortMode.None).First(t=>t.name==file+" art");
        Renderer[] ShadeCasters()=>shade.GetComponentsInChildren<Renderer>(true).Where(r=>r.shadowCastingMode==ShadowCastingMode.ShadowsOnly&&r.transform.parent.name.StartsWith("Shade pillar")).ToArray();
        void ShadeAgreement(float phase,string label,bool planted=false)
        {
            shade.SetPhaseForValidation(phase);
            var floor=Named(ArtRoot("shadow-room1-v01"),"Shadow floor warm","Shadow floor warm alt","Shadow grout");
            var casters=ShadeCasters();
            var polys=ShadeWalkRoom.ShadowsAt(phase);
            Vector3 offset=planted?new Vector3(.6f,0,0):Vector3.zero;
            if(planted)foreach(var c in casters)c.transform.position+=offset;
            try
            {
                var (mismatch,edge,total,_)=Agreement(shade.Lamp,floor,casters,new Vector3(0,0,3),new Vector2(7f,5.8f),.08f,
                    p=>ShadowOptics.InsideAny(polys,p),p=>ShadowOptics.EdgeDistance(polys,p),
                    p=>ShadeWalkRoom.Pillars.Any(c=>Vector2.Distance(p,c)<.85f)||p.y<=ShadeWalkRoom.SafeIn+.02f||p.y>=ShadeWalkRoom.SafeOut-.02f||Mathf.Abs(p.x)>6.95f,
                    "shade-agreement-"+label+".png");
                float rate=total>0?mismatch*100f/total:100;
                Measure("shade agreement "+label+" phase "+phase.ToString("0.00")+": "+total+" floor pixels, "+mismatch+" disagree outside the 8 cm edge band ("+rate.ToString("0.00")+"%), "+edge+" in the band");
                if(planted)Expect(rate>3,"Pixel agreement detects a 0.6 m shifted caster ("+rate.ToString("0.0")+"% disagree)");
                else Expect(rate<.5f,"Engine shadows match the judged shadow at phase "+phase.ToString("0.00")+" ("+rate.ToString("0.00")+"% outside the edge band)");
            }
            finally{if(planted)foreach(var c in casters)c.transform.position-=offset;}
        }

        // ---------------- captures ----------------
        void Capture(string name,Vector3? eye=null,Vector3? target=null)
        {
            var canvases=FindObjectsByType<Canvas>(FindObjectsSortMode.None).Where(c=>c.renderMode==RenderMode.ScreenSpaceOverlay&&c.enabled).ToArray();
            foreach(var c in canvases){c.renderMode=RenderMode.ScreenSpaceCamera;c.worldCamera=view;c.planeDistance=.5f;}
            view.transform.GetPositionAndRotation(out var p0,out var r0);
            if(eye.HasValue){view.transform.position=eye.Value;view.transform.rotation=Quaternion.LookRotation(target.Value-eye.Value,Vector3.up);}
            else orbit.Snap();
            Canvas.ForceUpdateCanvases();
            var rt=new RenderTexture(1440,900,24);rt.Create();view.targetTexture=rt;view.Render();
            var active=RenderTexture.active;RenderTexture.active=rt;var image=new Texture2D(1440,900,TextureFormat.RGB24,false);
            image.ReadPixels(new Rect(0,0,1440,900),0,0);image.Apply();File.WriteAllBytes(Path.Combine(output,name+".png"),image.EncodeToPNG());
            view.targetTexture=null;RenderTexture.active=active;rt.Release();Destroy(rt);Destroy(image);
            foreach(var c in canvases){c.renderMode=RenderMode.ScreenSpaceOverlay;c.worldCamera=null;}
            if(eye.HasValue)view.transform.SetPositionAndRotation(p0,r0);
        }
        IEnumerator Settle(float seconds=.4f){for(float t=0;t<seconds;t+=Dt)Tick(Vector3.zero);orbit.Snap();yield return null;yield return null;}

        // ---------------- room drivers ----------------
        Vector3 Approach(Vector2 device,Vector2 toward,float distance)
        {
            var d=(toward-device).normalized;var p=device+d*distance;return new Vector3(p.x,0,p.y);
        }
        IEnumerator TurnMirror(int i,int wanted)
        {
            var c=mirror.MirrorCentre(i);
            yield return GoNear(c,1.1f,1.9f,MirrorDevices(i));
            Check(temple.PromptText.Contains(i<3?"거울 "+(i+1):"넷째 거울"),"Prompt names mirror "+(i+1)+" at its pedestal ("+temple.PromptText+")");
            int guard=0;
            while(mirror.Step(i)!=wanted&&guard++<8)
            {
                int diff=(wanted-mirror.Step(i)+8)%8;
                Press(diff<=4?-1:1); // Q adds one step (counter-clockwise), E removes one (clockwise)
            }
            for(int k=0;k<30;k++)Tick(Vector3.zero);
            Check(mirror.Step(i)==wanted,"Mirror "+(i+1)+" turned to step "+wanted);
        }
        IEnumerator SolveMirrors(bool stopAfterFirstMirror=false)
        {
            yield return WaitGate(0);
            yield return Route(new Vector3(0,0,14),new Vector3(0,0,19));
            var answer=mirror.FirstAnswer;
            yield return TurnMirror(0,answer[0]);
            if(stopAfterFirstMirror)yield break;
            yield return TurnMirror(1,answer[1]);
            yield return TurnMirror(2,answer[2]);
            Check(mirror.FirstLock,"First target locks after the three mirrors");
        }
        IEnumerator SolveSecondStage()
        {
            yield return Wait(1.8f);
            yield return GoNear(mirror.LeverCentre,.8f,1.15f,RailAndDevices());
            Check(temple.PromptText==MirrorRoom.PromptLever,"Rail lever prompt offers both directions");
            int guard=0;
            while(mirror.CartStop!=mirror.SecondStop&&guard++<8)Press(mirror.SecondStop>mirror.CartStop?1:-1);
            yield return Wait(2.2f);
            Check(mirror.CartStop==mirror.SecondStop,"Cart rolled to the second target's line (stop "+mirror.SecondStop+")");
            yield return GoNear(mirror.MirrorCentre(3),1.0f,1.9f,MirrorDevices(3));
            guard=0;
            while(mirror.Step(3)!=MirrorRoom.SecondAnswer&&mirror.Step(3)!=MirrorRoom.SecondAnswer+4&&guard++<8)
            {int diff=(MirrorRoom.SecondAnswer-mirror.Step(3)+8)%8;Press(diff<=4?-1:1);}
            yield return Wait(.6f);
            Check(mirror.Solved&&temple.Stage>=2,"Fourth mirror sends the beam into the second target; the mirror room is solved");
        }
        IEnumerator DragTo(int device,float targetZ,string label)
        {
            var handle=device==1?silhouette.PanelHandle:silhouette.LampHandle;
            yield return Go(new Vector3(-1.2f,0,handle.z));
            yield return Walk(new Vector3(handle.x+.6f,0,handle.z));
            Check(Press(1)&&silhouette.Held==device,label+": grabbed the "+(device==1?"panel":"lamp")+" handle");
            int round=silhouette.Round;float offset=player.transform.position.z-(device==1?silhouette.PanelZ:silhouette.LampZ);
            var goal=new Vector3(player.transform.position.x,0,targetZ+offset);
            float t=0;
            while(silhouette.Round==round&&t<20)
            {
                var d=Vector3.ProjectOnPlane(goal-player.transform.position,Vector3.up);
                Tick(d.magnitude>.02f?d.normalized*Mathf.Min(1,d.magnitude*6):Vector3.zero);t+=Dt;
                if(((int)(t/Dt))%40==0)yield return null;
            }
            Check(silhouette.Round==round+1&&silhouette.Held==0,label+": the shadow filled the outline and the handle let go by itself");
        }
        IEnumerator SolveSilhouette()
        {
            yield return WaitGate(1);
            yield return Route(new Vector3(0,0,33),new Vector3(0,0,38.5f));
            float startSize=silhouette.Size;float hole0=silhouette.HoleFor(0);
            Check(hole0>startSize*1.2f,"Round 1 asks for a larger shadow ("+startSize.ToString("0.00")+" -> "+hole0.ToString("0.00")+" m)");
            yield return DragTo(1,silhouette.PanelAnswer(0),"Round 1 (enlarge)");
            Check(silhouette.HoleFor(1)<silhouette.Size*.8f,"Round 2 asks for a smaller shadow");
            yield return DragTo(1,silhouette.PanelAnswer(1),"Round 2 (shrink)");
            Check(silhouette.Round==2&&Mathf.Abs(silhouette.PanelZ-silhouette.PanelAnswer(1))<1e-3f,"Round 3 locks the panel at its place");
            yield return Go(new Vector3(-1.2f,0,silhouette.PanelHandle.z));
            yield return Walk(new Vector3(silhouette.PanelHandle.x+.6f,0,silhouette.PanelHandle.z));
            Check(!Press(1)&&silhouette.Held==0&&temple.PromptText==SilhouetteRoom.PromptPanelLocked,"Round 3: the locked panel refuses to be grabbed and says why");
            yield return DragTo(2,silhouette.LampAnswer,"Round 3 (move the lamp)");
            Check(silhouette.Solved&&temple.Stage>=3,"Three rounds solve the silhouette room");
        }
        IEnumerator SetSanctum(int a,int h)
        {
            var wheelSpot=new Vector3(ShadowSanctum.Wheel.x+1.25f,0,ShadowSanctum.Wheel.y);
            var gripSpot=new Vector3(ShadowSanctum.Grip.x-1.25f,0,ShadowSanctum.Grip.y);
            if(sanctum.Direction!=a)
            {
                yield return Go(wheelSpot);
                Check(temple.PromptText==ShadowSanctum.PromptWheel,"Direction wheel prompt offers both ways ("+temple.PromptText+" at "+player.transform.position.ToString("F2")+", room "+temple.CurrentRoom+")");
                int guard=0;while(sanctum.Direction!=a&&guard++<8){int diff=(a-sanctum.Direction+8)%8;Press(diff<=4?1:-1);}
                yield return Wait(.8f);
            }
            if(sanctum.Height!=h)
            {
                yield return Go(gripSpot);
                Check(temple.PromptText==ShadowSanctum.PromptGrip,"Height grip prompt offers up and down ("+temple.PromptText+")");
                int guard=0;while(sanctum.Height!=h&&guard++<4)Press(h>sanctum.Height?1:-1);
                yield return Wait(.8f);
            }
        }

        // ---------------- modes ----------------
        IEnumerator Full()
        {
            var args=Environment.GetCommandLineArgs();
            Check(temple.Rooms.Length==4&&!temple.GateOpen(0)&&!temple.GateOpen(1)&&!temple.GateOpen(2),"Four rooms, three closed gates on a fresh record");
            Check(temple.SpeechActive&&temple.SpeechText.Contains(ShadowTemple.LineWelcome),"The keeper greets on the first visit");
            yield return Settle();Capture("01-entry-greeting");
            ClearSpeech();
            Check(!temple.SpeechActive,"Greeting closes with E");
            var font=temple.Font;
            var texts=new List<string>{ShadowTemple.LineWelcome,ShadowTemple.LineSanctum,ShadowTemple.ClosingAll,ShadowTemple.ClosingRemaining,ShadowTemple.HintLocked,ShadowTemple.PromptLeave,
                ShadeWalkRoom.PromptPractice,ShadeWalkRoom.PromptDanger,ShadeWalkRoom.NoteFail,MirrorRoom.PromptLever,MirrorRoom.NoteLock,SilhouetteRoom.PromptPanelLocked,SilhouetteRoom.NoteLampTurn,
                ShadowSanctum.PromptWheel,ShadowSanctum.PromptGrip,ShadowSanctum.PromptOrb};
            texts.AddRange(ShadowTemple.EndingLines);
            foreach(var room in temple.Rooms){texts.Add(room.Title);texts.Add(room.Goal);for(int h=1;h<=3;h++)texts.Add(room.Hint(h));}
            var missing=texts.SelectMany(t=>t).Where(c=>!char.IsWhiteSpace(c)&&!font.characterLookupTable.ContainsKey(c)).Distinct().ToArray();
            Check(missing.Length==0,"Every temple text has glyphs in the static atlas ("+new string(missing)+")");
            foreach(var text in texts)Check(!text.TrimEnd('.','!','?',' ').EndsWith("요"),"No 해요체 ending: "+text);

            // Room 1 -------------------------------------------------------------
            ShadeAgreement(1.6f,"a");ShadeAgreement(2.9f,"b");ShadeAgreement(4.4f,"c");ShadeAgreement(5.6f,"d");
            ShadeAgreement(2.9f,"planted",true);
            yield return Route(new Vector3(0,0,-9),new Vector3(-2.2f,0,-6.2f));
            // Practice yard: exposure shows but never fails.
            float practiceMax=0;int fails0=shade.Fails;
            for(int i=0;i<60*4;i++){Tick(Vector3.zero);practiceMax=Mathf.Max(practiceMax,shade.Exposure);if(i%40==0)yield return null;}
            Check(shade.Fails==fails0&&practiceMax<shade.ExposeMax,"Practice yard never fails (max exposure "+practiceMax.ToString("0.00")+" < "+shade.ExposeMax.ToString("0.0")+")");
            Capture("02-practice-yard");
            int analyticSolvable=0;
            for(int k=0;k<8;k++)if(PlanCrossing(Mathf.PI*.5f+k*.8f,ShadeWalkRoom.Speed,new Vector2(0,-3.4f),900,out _)!=null)analyticSolvable++;
            Check(analyticSolvable>=6,"Shadow-only crossings exist from "+analyticSolvable+"/8 lamp phases");
            // A deliberate failure: stand in the light.
            yield return Walk(new Vector3(0,0,-3.4f));
            Vector3 lit=Vector3.zero;bool found=false;
            for(int k=0;k<40&&!found;k++){for(float x=-5;x<=5&&!found;x+=.5f)for(float z=-2f;z<=2f&&!found;z+=.5f){var p=new Vector2(x,z);if(!ShadeWalkRoom.Pillars.Any(c=>Vector2.Distance(p,c)<1.3f)&&!shade.Shaded(p)&&!ShadeWalkRoom.ShadedAt(shade.Phase+.6f,p)){lit=new Vector3(x,0,z);found=true;}}if(!found)yield return Wait(.3f);}
            Check(found,"Found a lit spot for the failure test");
            int failsBefore=shade.Fails;
            var toLight=Plan(player.transform.position,lit);
            Check(toLight!=null,"A walkable route to the lit spot exists");
            foreach(var waypoint in toLight)
            {
                for(int k=0;k<600&&shade.Fails==failsBefore;k++)
                {
                    var d=Vector3.ProjectOnPlane(waypoint-player.transform.position,Vector3.up);if(d.magnitude<.15f)break;
                    Tick(d.normalized*Mathf.Min(1,d.magnitude*12));if(k%40==0)yield return null;
                }
                if(shade.Fails!=failsBefore)break;
            }
            float waited=0;while(shade.Fails==failsBefore&&waited<6){Tick(Vector3.zero);waited+=Dt;if(((int)(waited/Dt))%40==0)yield return null;}
            Check(shade.Fails==failsBefore+1,"Standing in light fails after the exposure budget ("+waited.ToString("0.00")+" s after arrival)");
            var retry=player.transform.position;
            float nearest=ShadeWalkRoom.Pillars.Min(c=>Vector2.Distance(ShadowOptics.Flat(retry),c));
            Check(retry.z>ShadeWalkRoom.SafeIn&&Mathf.Abs(nearest-ShadeWalkRoom.RetryDistance)<.05f&&shade.Shaded(ShadowOptics.Flat(retry))||retry.z<=ShadeWalkRoom.SafeIn,
                "Retry starts behind a pillar in its shadow ("+nearest.ToString("0.00")+" m from it) instead of the room start");
            Check(shade.InGrace&&temple.NoteText==ShadeWalkRoom.NoteFail,"Retry has a grace second and says why");
            Check(Mathf.Abs(shade.ExposeMax-(ShadeWalkRoom.ExposeBase+ShadeWalkRoom.ExposeStep))<1e-4f,"Exposure budget grows after a failure ("+shade.ExposeMax.ToString("0.0")+" s)");
            Check(temple.HintTime(0)>=ShadowTemple.FailHintBonus,"A failure adds hint time");
            Measure("room 1 failure: retry at "+retry.ToString("F2")+", exposure budget now "+shade.ExposeMax.ToString("0.0")+" s");
            yield return Settle();Capture("03-retry-behind-pillar");
            shade.SetFailsForValidation(0);
            yield return CrossShade("room 1");
            yield return Settle();Capture("04-shade-crossed");
            yield return Wait(1.4f);
            Check(temple.GateOpen(0)&&temple.Stage==1,"Room 1 gate opens after the crossing");

            // Room 2 -------------------------------------------------------------
            var start=new int[]{mirror.Step(0),mirror.Step(1),mirror.Step(2),mirror.Step(3)};
            Check(mirror.CurrentHit<0,"Fresh mirrors do not reach a target");
            int solutions=0;bool allUseThree=true;var segs=new List<ShadowOptics.Segment>();
            for(int a=0;a<8;a++)for(int b=0;b<8;b++)for(int c=0;c<8;c++)
            {
                int hit=mirror.TraceWith(new[]{a,b,c,2},0,false,segs);
                if(hit==0){solutions++;if(segs.Count(s=>s.end==ShadowOptics.End.Mirror)<3)allUseThree=false;}
                foreach(var s in segs)if(!MirrorRoom.Walls.Contains(s.b,.001f))throw new Exception("Beam left the room");
            }
            Check(solutions==8&&allUseThree,"Exactly 8 of 512 mirror settings reach the first target and each uses all three mirrors ("+solutions+")");
            int second=0;
            for(int k=0;k<8;k++)for(int stop=0;stop<MirrorRoom.Stops;stop++)if(mirror.TraceWith(new[]{mirror.FirstAnswer[0],mirror.FirstAnswer[1],mirror.FirstAnswer[2],k},stop,true,null)==1)second++;
            Check(second==2,"Second stage: exactly 2 of 40 cart settings reach the second target ("+second+")");
            Check(mirror.SecondStop!=mirror.StartStop,"The cart starts away from the answer stop");
            yield return SolveMirrors();
            yield return Settle();Capture("05-first-target-locked");
            // Planted fault: breaking one reflection must lose the target.
            var ks=new[]{mirror.FirstAnswer[0],mirror.FirstAnswer[1],(mirror.FirstAnswer[2]+1)%8,2};
            Check(mirror.TraceWith(ks,0,false,null)!=0,"Detector: a mirror one step off loses the first target");
            // Both directions: E then Q returns to the same step.
            int before=mirror.Step(2);Press(1);int afterE=mirror.Step(2);Press(-1);
            Check(afterE==(before+7)%8&&mirror.Step(2)==before,"E turns clockwise and Q turns back");
            yield return SolveSecondStage();
            yield return Settle();Capture("06-second-target");
            Capture("06b-mirror-room-overview",new Vector3(0,3.2f,15.5f),new Vector3(0,1.6f,25));
            Measure("room 2: layout side "+mirror.Side+", second stop "+mirror.SecondStop+", E/Q presses so far "+presses);

            // Room 3 -------------------------------------------------------------
            yield return SolveSilhouette();
            yield return Settle();Capture("07-silhouette-solved");
            // Engine shadow width against the formula, measured on the screen.
            foreach(float distance in new[]{2.4f,4.4f,7.2f})
            {
                silhouette.PlaceForValidation(SilhouetteRoom.LampHome+distance,SilhouetteRoom.LampHome);
                var paper=silhouette.GetComponentsInChildren<Renderer>(true).Where(r=>r.name=="Silhouette screen face").ToArray();
                var casters=silhouette.GetComponentsInChildren<Renderer>(true).Where(r=>r.shadowCastingMode!=ShadowCastingMode.Off&&r.transform.IsChildOf(silhouette.transform.Find("Silhouette panel carriage"))).ToArray();
                float width=ScreenShadowWidth(silhouette.Lamp,paper,casters,out int pixels);
                float want=ShadowOptics.ShadowWidth(SilhouetteRoom.Panel,SilhouetteRoom.LampHome,SilhouetteRoom.LampHome+distance,SilhouetteRoom.ScreenZ);
                Measure("silhouette at "+distance.ToString("0.0")+" m: engine shadow "+width.ToString("0.000")+" m, formula "+want.ToString("0.000")+" m ("+pixels+" px)");
                Expect(Mathf.Abs(width-Mathf.Min(want,4f))<Mathf.Max(.05f,want*.03f),"Engine shadow width matches the formula at "+distance.ToString("0.0")+" m");
            }
            silhouette.PlaceForValidation(silhouette.PanelAnswer(1),silhouette.LampAnswer);

            // Sanctum ------------------------------------------------------------
            yield return WaitGate(2);
            yield return Route(new Vector3(0,0,51),new Vector3(0,0,56.5f));
            for(int i=0;i<10&&!temple.SpeechActive;i++)Tick(Vector3.zero);
            Check(temple.SpeechActive&&temple.SpeechText.Contains(ShadowTemple.LineSanctum),"The keeper speaks on entering the sanctum");
            ClearSpeech();
            var shapes=new List<string>();int answers=0;bool shorter=true;
            for(int a=0;a<8;a++)
            {
                float previous=float.MaxValue;
                for(int h=0;h<3;h++)
                {
                    var polys=sanctum.ShadowFor(a,h);
                    float area=polys.Sum(p=>Mathf.Abs(ShadowOptics.Area2(p)));
                    var centroid=polys.SelectMany(p=>p).Aggregate(Vector2.zero,(s,v)=>s+v)/Mathf.Max(1,polys.Sum(p=>p.Count));
                    shapes.Add(area.ToString("0.00")+"/"+centroid.x.ToString("0.0")+"/"+centroid.y.ToString("0.0"));
                    float reach=polys.SelectMany(p=>p).Max(v=>Vector2.Distance(v,ShadowSanctum.Centre));
                    if(reach>previous+1e-3f)shorter=false;previous=reach;
                    if(a==sanctum.AnswerDirection&&h==sanctum.AnswerHeight)answers++;
                }
            }
            Check(shapes.Distinct().Count()==24&&answers==1,"All 24 lamp states cast different shadows and one of them is the answer");
            Check(shorter,"Raising the lamp shortens the shadow in every direction");
            Check(!sanctum.Solved&&(sanctum.Direction!=sanctum.AnswerDirection||sanctum.Height!=sanctum.AnswerHeight),"The sanctum does not start solved");
            // A wrong height first, so no direction change below can land on the answer by accident.
            int wrongH=(sanctum.AnswerHeight+1)%3;
            yield return SetSanctum(sanctum.Direction,wrongH);
            // Ghost of the previous shadow after one change.
            yield return SetSanctum((sanctum.Direction+1)%8,wrongH);
            Press(1);Tick(Vector3.zero);
            Check(sanctum.GhostAlpha>.8f,"A change leaves the previous shadow's outline (alpha "+sanctum.GhostAlpha.ToString("0.00")+")");
            yield return Settle(.5f);Capture("08-sanctum-ghost");
            yield return Wait(1.6f);
            Check(sanctum.GhostAlpha<=0,"The outline fades within 1.5 s");
            Check(!sanctum.Solved,"Changing only the direction at a wrong height never solves");
            // Solve: direction first, then height.
            yield return SetSanctum(sanctum.AnswerDirection,wrongH);
            Check(!sanctum.Solved,"Direction alone does not solve");
            // The last change is the height; the eyes are timed from the moment the lamp settles on the answer.
            yield return Go(new Vector3(ShadowSanctum.Grip.x-1.25f,0,ShadowSanctum.Grip.y));
            {int guard=0;while(sanctum.Height!=sanctum.AnswerHeight&&guard++<4)Press(sanctum.AnswerHeight>sanctum.Height?1:-1);}
            float solveTime=0;while(!sanctum.Solved&&solveTime<3){Tick(Vector3.zero);solveTime+=Dt;}
            Check(sanctum.Solved&&sanctum.OrbRevealed,"Direction and height together solve the sanctum ("+solveTime.ToString("0.00")+" s after the last turn)");
            float eyesAtSolve=sanctum.Eyes;for(float t=0;t<.75f;t+=Dt)Tick(Vector3.zero);float halfway=sanctum.Eyes;
            Check(eyesAtSolve<.05f&&halfway>.35f&&halfway<.65f,"The guardian's eyes open over 1.5 s ("+eyesAtSolve.ToString("0.00")+" at the solve, "+halfway.ToString("0.00")+" after 0.75 s)");
            // Engine shadow of the guardian against the analytic outline at the answer state.
            {
                var polys=sanctum.ShadowFor(sanctum.AnswerDirection,sanctum.AnswerHeight);
                var floor=Named(ArtRoot("shadow-sanctum-v01"),"Shadow floor sanctum","Shadow floor sanctum rim","Shadow grout");
                var casters=sanctum.GetComponentsInChildren<Renderer>(true).Where(r=>r.transform.IsChildOf(sanctum.transform.Find("Mirror guardian"))&&r.shadowCastingMode==ShadowCastingMode.On).ToArray();
                var (mismatch,edge,total,_)=Agreement(sanctum.Lamp,floor,casters,new Vector3(0,0,63),new Vector2(7.6f,7.6f),.08f,
                    p=>ShadowOptics.InsideAny(polys,p),p=>ShadowOptics.EdgeDistance(polys,p),p=>Vector2.Distance(p,ShadowSanctum.Centre)<1.3f,"sanctum-agreement.png");
                float rate=total>0?mismatch*100f/total:100;
                Measure("sanctum agreement: "+total+" floor pixels, "+mismatch+" disagree outside the 8 cm band ("+rate.ToString("0.00")+"%), "+edge+" in the band");
                Expect(rate<1f,"The guardian's engine shadow lies on the gold outline ("+rate.ToString("0.00")+"%)");
            }
            yield return Wait(1.2f);
            Check(sanctum.Eyes>=1&&sanctum.Drop>=1,"Eyes fully open and the wisdom orb has landed");
            yield return Walk(new Vector3(0,0,58.2f));
            Check(temple.PromptText==ShadowSanctum.PromptOrb,"The orb prompt appears in reach");
            yield return Settle(.3f);Capture("09-orb-and-eyes");
            Capture("09b-sanctum-overview",new Vector3(0,4,52.5f),new Vector3(0,2,64));
            Press(1);
            for(int i=0;i<5;i++)Tick(Vector3.zero);
            Check(sanctum.OrbTaken&&temple.SpeechActive&&temple.SpeechText.Contains(ShadowTemple.EndingLines[0]),"Picking up the orb starts the keeper's farewell");
            yield return Settle(.2f);Capture("10-keeper-farewell");
            ClearSpeech();
            for(int i=0;i<10;i++)Tick(Vector3.zero);
            Check(temple.DepartureRequested&&temple.CompletedThisSession,"The farewell ends with the departure");
            Check(ShadowApproachProgress.Current.Completed&&ShadowApproachProgress.Current.Saved,"Completion is saved to the planet record");
            var reread=new ShadowTempleStore(temple.Store.FilePath);
            Check(reread.Current!=null&&!reread.Current.active&&reread.Current.stage==4,"The journey record is closed as finished");
            Measure("total E/Q presses "+presses+", hint levels "+string.Join(",",Enumerable.Range(0,4).Select(i=>temple.HintLevel(i))));
            // Notebook pages in the temple after completion must not overflow.
            var notebook=FindFirstObjectByType<NotebookUI>();
            if(notebook!=null)
            {
                Check(notebook.TryOpen(),"Notebook opens in the temple");
                for(int page=0;page<3;page++)
                {
                    if(page>0){notebook.SelectPage(page);for(int f=0;f<50&&notebook.Turning;f++)yield return null;}
                    yield return null;
                    var overflow=notebook.GetComponentsInChildren<TMPro.TextMeshProUGUI>(true).Where(t=>t.gameObject.activeInHierarchy&&t.isTextOverflowing).Select(t=>t.name).ToArray();
                    Check(overflow.Length==0,"Notebook page "+(page+1)+" fits ("+string.Join(",",overflow)+")");
                    if(page==0)Check(notebook.BodyText.Contains("그림자"),"Notebook records the shadow wisdom");
                }
                Capture("11-notebook-shadow");
                notebook.Close();
            }
        }
        float ScreenShadowWidth(Light light,Renderer[] visible,Renderer[] casters,out int pixels)
        {
            var renderers=FindObjectsByType<Renderer>(FindObjectsSortMode.None);var enabled=renderers.Select(r=>r.enabled).ToArray();
            var lights=FindObjectsByType<Light>(FindObjectsSortMode.None);var lightOn=lights.Select(l=>l.enabled).ToArray();
            var ambient=RenderSettings.ambientMode;var ambientColor=RenderSettings.ambientLight;bool fog=RenderSettings.fog;var sky=RenderSettings.skybox;
            try
            {
                foreach(var r in renderers)r.enabled=visible.Contains(r)||casters.Contains(r);
                foreach(var l in lights)l.enabled=l==light;
                RenderSettings.ambientMode=AmbientMode.Flat;RenderSettings.ambientLight=Color.black;RenderSettings.fog=false;RenderSettings.skybox=null;
                var cam=new GameObject("Screen probe").AddComponent<Camera>();cam.orthographic=true;cam.orthographicSize=2f;cam.aspect=1;
                cam.clearFlags=CameraClearFlags.SolidColor;cam.backgroundColor=Color.black;
                cam.transform.SetPositionAndRotation(new Vector3(SilhouetteRoom.AxisX,SilhouetteRoom.BeamY,SilhouetteRoom.ScreenZ-3),Quaternion.identity);
                cam.nearClipPlane=.05f;cam.farClipPlane=6;
                // Hide the panel from this camera by culling it behind the near plane: the camera sits past the panel's range.
                var data=cam.gameObject.AddComponent<UnityEngine.Rendering.Universal.UniversalAdditionalCameraData>();data.renderPostProcessing=false;
                var probe=Render(cam,640,640,casters);Destroy(cam.gameObject);
                int row=320;pixels=0;
                float Ratio(int x){int i=row*640+x;float open=Lum(probe.open[i]);return open>12?Lum(probe.shadowed[i])/open:1;}
                // The shadow floor is not black (environment reflection adds a constant), so the edge is where the
                // ratio crosses half way between the shadow floor and full light, not a fixed 0.5.
                float floor=1;for(int x=0;x<640;x++)floor=Mathf.Min(floor,Ratio(x));
                float threshold=(floor+1)*.5f;
                for(int x=0;x<640;x++)if(Ratio(x)<threshold)pixels++;
                int left=-1,right=-1;for(int x=0;x<640;x++){if(Ratio(x)<threshold){if(left<0)left=x;right=x;}}
                string profile="";
                if(left>0)for(int x=Mathf.Max(0,left-10);x<=Mathf.Min(639,left+10);x+=2)profile+=Ratio(x).ToString("0.00")+" ";
                Measure("  screen row: shadow from x "+(left*4f/640-2).ToString("0.000")+" to "+((right+1)*4f/640-2).ToString("0.000")+" m (centre ratio "+Ratio(320).ToString("0.00")+"), left edge ratios "+profile);
                var tex=new Texture2D(640,640,TextureFormat.RGBA32,false);tex.SetPixels32(probe.shadowed);tex.Apply();
                File.WriteAllBytes(Path.Combine(output,"screen-probe-"+pixels+".png"),tex.EncodeToPNG());Destroy(tex);
                return pixels*4f/640;
            }
            finally
            {
                for(int i=0;i<renderers.Length;i++)if(renderers[i]!=null)renderers[i].enabled=enabled[i];
                for(int i=0;i<lights.Length;i++)if(lights[i]!=null)lights[i].enabled=lightOn[i];
                RenderSettings.ambientMode=ambient;RenderSettings.ambientLight=ambientColor;RenderSettings.fog=fog;RenderSettings.skybox=sky;
            }
        }

        // Multi-process resume: each stage expects the files written by the previous one.
        IEnumerator Stage(string stage)
        {
            var record=temple.Record;
            if(stage=="stage-a")
            {
                ClearSpeech();
                yield return Route(new Vector3(0,0,-9),new Vector3(0,0,-3.6f));
                yield return CrossShade("stage a");
                yield return SolveMirrors(true);
                yield return Walk(new Vector3(7.2f,0,18.9f));
                Check(Press(1)&&temple.HintLevel(1)==1,"Hint post gives the first mirror hint on request");
                yield return Walk(new Vector3(2,0,22));
                Check(temple.SaveNow()||temple.Saved,"Stage a saved");
                Measure("stage a: seed "+record.seed+" mirror 1 step "+mirror.Step(0)+" at "+player.transform.position.ToString("F2"));
                File.WriteAllText(Path.Combine(output,"stage-a-position.txt"),player.transform.position.x.ToString("R")+" "+player.transform.position.z.ToString("R"));
            }
            else if(stage=="stage-b")
            {
                var saved=File.ReadAllText(Path.Combine(output,"stage-a-position.txt")).Split(' ').Select(float.Parse).ToArray();
                Check(record.stage==1&&temple.GateOpen(0)&&!temple.GateOpen(1),"Resume: room 1 stays solved and its gate open");
                Check(Vector2.Distance(ShadowOptics.Flat(player.transform.position),new Vector2(saved[0],saved[1]))<.1f,"Resume: the player returns to the saved spot in room 2");
                Check(mirror.Step(0)==mirror.FirstAnswer[0]&&temple.HintLevel(1)==1,"Resume: mirror 1 and the requested hint are restored");
                Check(!temple.SpeechActive,"Resume: the greeting is not repeated");
                yield return TurnMirror(1,mirror.FirstAnswer[1]);yield return TurnMirror(2,mirror.FirstAnswer[2]);
                Check(mirror.FirstLock,"Resume: finishing the three mirrors locks the first target");
                yield return Wait(1.8f);
                yield return GoNear(mirror.LeverCentre,.8f,1.15f,RailAndDevices());
                Press(mirror.SecondStop>mirror.CartStop?1:-1);
                File.WriteAllText(Path.Combine(output,"stage-b-cart.txt"),mirror.CartStop.ToString());
                temple.SaveNow();
            }
            else if(stage=="stage-c")
            {
                int cart=int.Parse(File.ReadAllText(Path.Combine(output,"stage-b-cart.txt")));
                Check(mirror.FirstLock&&mirror.CartStop==cart,"Resume: first lock and the cart stop are restored ("+cart+")");
                yield return Wait(.5f);
                yield return SolveSecondStage();
                yield return SolveSilhouetteFirstRoundAndHold();
            }
            else if(stage=="stage-d")
            {
                float z=float.Parse(File.ReadAllText(Path.Combine(output,"stage-c-panel.txt")));
                Check(silhouette.Round==1&&Mathf.Abs(silhouette.PanelZ-z)<1e-3f&&silhouette.Held==0,"Resume: round 2 continues with the panel where it was, released");
                yield return DragTo(1,silhouette.PanelAnswer(1),"Resume round 2");
                yield return DragTo(2,silhouette.LampAnswer,"Resume round 3");
                Check(silhouette.Solved,"Resume: the silhouette room is solved");
                yield return WaitGate(2);
                yield return Route(new Vector3(0,0,51),new Vector3(0,0,56.5f));
                ClearSpeech();
                int wrongH=(sanctum.AnswerHeight+1)%3;
                yield return SetSanctum(sanctum.Direction,wrongH);
                yield return SetSanctum(sanctum.AnswerDirection,wrongH);
                File.WriteAllText(Path.Combine(output,"stage-d-sanctum.txt"),sanctum.Direction+" "+sanctum.Height);
                temple.SaveNow();
            }
            else if(stage=="stage-e")
            {
                var s=File.ReadAllText(Path.Combine(output,"stage-d-sanctum.txt")).Split(' ').Select(int.Parse).ToArray();
                Check(sanctum.Direction==s[0]&&sanctum.Height==s[1]&&!sanctum.Solved,"Resume: the lamp direction and height are restored, still unsolved");
                Check(!temple.SpeechActive,"Resume: the sanctum greeting is not repeated");
                yield return SetSanctum(sanctum.AnswerDirection,sanctum.AnswerHeight);
                yield return Wait(3.2f);
                yield return Walk(new Vector3(0,0,58.2f));
                Press(1);ClearSpeech();for(int i=0;i<10;i++)Tick(Vector3.zero);
                Check(ShadowApproachProgress.Current.Completed&&new ShadowTempleStore(temple.Store.FilePath).Current.active==false,"Resume: the final stage completes and closes the record");
            }
            yield return null;
        }
        IEnumerator SolveSilhouetteFirstRoundAndHold()
        {
            yield return WaitGate(1);
            yield return Route(new Vector3(0,0,33),new Vector3(0,0,38.5f));
            yield return DragTo(1,silhouette.PanelAnswer(0),"Stage c round 1");
            var handle=silhouette.PanelHandle;
            yield return Go(new Vector3(-1.2f,0,handle.z));yield return Walk(new Vector3(handle.x+.6f,0,handle.z));
            Check(Press(1)&&silhouette.Held==1,"Stage c grabs the panel for round 2");
            var goal=player.transform.position+Vector3.forward*.9f;
            for(int i=0;i<60*2;i++){var d=Vector3.ProjectOnPlane(goal-player.transform.position,Vector3.up);Tick(d.magnitude>.02f?d.normalized*Mathf.Min(1,d.magnitude*6):Vector3.zero);}
            Check(silhouette.Held==1&&silhouette.Round==1,"Stage c is holding the panel mid-round");
            temple.SaveNow();
            File.WriteAllText(Path.Combine(output,"stage-c-panel.txt"),silhouette.PanelZ.ToString("R"));
        }
        IEnumerator Unreadable()
        {
            string path=temple.Store.FilePath;
            Check(File.Exists(path),"The corrupt fixture exists");
            string before=File.ReadAllText(path);
            Check(temple.Store.Protected&&!string.IsNullOrEmpty(temple.Problem),"Unreadable record is reported and protected");
            Check(temple.NoteText==ShadowTemple.NoteUnreadable||temple.SpeechActive,"The player is told the record could not be read");
            ClearSpeech();
            yield return Route(new Vector3(0,0,-9),new Vector3(0,0,-4f));
            temple.SaveNow();
            Check(File.ReadAllText(path)==before,"The unreadable file is kept byte for byte");
            Check(temple.Record!=null&&temple.Stage==0,"Play continues in memory from a fresh layout");
        }
    }
}
