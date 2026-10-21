using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Mumu.Planet
{
    // Opt-in planet check of the moon gate: -mumu-shadow-entrance-smoke <dir> [-mumu-shadow-entrance-mode fresh|sealed]
    public sealed class ShadowEntranceSmoke : MonoBehaviour
    {
        [Serializable] sealed class Result {public bool passed;public string mode,error;public List<string> checks=new List<string>();public List<string> measurements=new List<string>();}
        Result result=new Result();string output,mode;
        ShadowSanctuaryEntrance entrance;PlanetExplorer player;OrbitCamera orbit;PlanetSurface surface;Camera view;QuestGuide quest;

        IEnumerator Start()
        {
            var args=Environment.GetCommandLineArgs();int index=Array.IndexOf(args,"-mumu-shadow-entrance-smoke");
            if(index<0||index+1>=args.Length)yield break;
            output=args[index+1];Directory.CreateDirectory(output);
            int m=Array.IndexOf(args,"-mumu-shadow-entrance-mode");mode=m>=0&&m+1<args.Length?args[m+1]:"fresh";result.mode=mode;
            for(int i=0;i<25;i++)yield return null;
            entrance=GetComponent<ShadowSanctuaryEntrance>();player=FindFirstObjectByType<PlanetExplorer>();orbit=FindFirstObjectByType<OrbitCamera>();
            surface=FindFirstObjectByType<PlanetSurface>();view=orbit.GetComponent<Camera>();quest=FindFirstObjectByType<QuestGuide>();
            player.enabled=false;
            var run=mode=="sealed"?Sealed():Fresh();
            bool handoff=false;
            while(true)
            {
                object current;
                try{if(!run.MoveNext())break;current=run.Current;}
                catch(Exception e){result.error=e.ToString();Debug.LogError(e);break;}
                if(current is string s&&s=="handoff"){handoff=true;break;}
                yield return current;
            }
            if(handoff&&result.error==null)yield break; // the observer finishes in the temple scene
            Finish();
        }
        void Finish()
        {
            result.passed=result.error==null;
            File.WriteAllText(Path.Combine(output,"result.json"),JsonUtility.ToJson(result,true));
            Application.Quit(result.passed?0:1);
        }
        void Check(bool ok,string name){if(!ok)throw new Exception(name);result.checks.Add(name);Debug.Log("SHADOW_ENTRANCE_CHECK "+name);}
        void Measure(string text){result.measurements.Add(text);Debug.Log("SHADOW_ENTRANCE_MEASURE "+text);}
        void Capture(string name,Vector3? eye=null,Vector3? target=null,Vector3? up=null)
        {
            var canvases=FindObjectsByType<Canvas>(FindObjectsSortMode.None).Where(c=>c.renderMode==RenderMode.ScreenSpaceOverlay&&c.enabled).ToArray();
            foreach(var c in canvases){c.renderMode=RenderMode.ScreenSpaceCamera;c.worldCamera=view;c.planeDistance=.5f;}
            view.transform.GetPositionAndRotation(out var p0,out var r0);
            if(eye.HasValue){view.transform.position=eye.Value;view.transform.rotation=Quaternion.LookRotation(target.Value-eye.Value,up??eye.Value.normalized);}else orbit.Snap();
            Canvas.ForceUpdateCanvases();
            var rt=new RenderTexture(1440,900,24);rt.Create();view.targetTexture=rt;view.Render();
            var active=RenderTexture.active;RenderTexture.active=rt;var image=new Texture2D(1440,900,TextureFormat.RGB24,false);
            image.ReadPixels(new Rect(0,0,1440,900),0,0);image.Apply();File.WriteAllBytes(Path.Combine(output,name+".png"),image.EncodeToPNG());
            view.targetTexture=null;RenderTexture.active=active;rt.Release();Destroy(rt);Destroy(image);
            foreach(var c in canvases){c.renderMode=RenderMode.ScreenSpaceOverlay;c.worldCamera=null;}
            if(eye.HasValue)view.transform.SetPositionAndRotation(p0,r0);
        }
        IEnumerator Frames(int n){for(int i=0;i<n;i++){entrance.RefreshPrompt();yield return null;}}

        // Grid A* on the planet surface (same rule as WaterEntranceSmoke): open cells fit a fattened capsule, rises <= 0.5 m.
        List<Vector3> PlanRoute(Vector3 start,Vector3 goal,out int cells,out int blocked)
        {
            const float cell=.5f,margin=10f,half=22f;
            var up0=(start.normalized+goal.normalized).normalized;
            var e1=Vector3.ProjectOnPlane(goal-start,up0).normalized;var e2=Vector3.Cross(up0,e1);
            float span=Vector3.Dot(goal-start,e1);
            int nu=Mathf.CeilToInt((span+2*margin)/cell)+1,nv=Mathf.CeilToInt(2*half/cell)+1;cells=nu*nv;blocked=0;
            var ground=new Vector3[cells];var open=new bool[cells];
            for(int i=0;i<nu;i++)for(int j=0;j<nv;j++)
            {
                int k=i*nv+j;var g=surface.Point(start+e1*(-margin+i*cell)+e2*(-half+j*cell));ground[k]=g;var n=g.normalized;
                open[k]=!Physics.CheckCapsule(g+n*.35f,g+n*1.25f,.32f,1<<8,QueryTriggerInteraction.Ignore);if(!open[k])blocked++;
            }
            int CellOf(Vector3 p){var d=p-start;int i=Mathf.Clamp(Mathf.RoundToInt((Vector3.Dot(d,e1)+margin)/cell),0,nu-1),j=Mathf.Clamp(Mathf.RoundToInt((Vector3.Dot(d,e2)+half)/cell),0,nv-1);return i*nv+j;}
            int from=CellOf(start),to=CellOf(goal);open[from]=open[to]=true;
            float H(int k)=>new Vector2(k/nv-to/nv,k%nv-to%nv).magnitude*cell;
            var cost=new float[cells];var parent=new int[cells];var closed=new bool[cells];
            for(int k=0;k<cells;k++){cost[k]=float.MaxValue;parent[k]=-1;}
            cost[from]=0;var frontier=new SortedSet<(float,int)>{(H(from),from)};bool found=false;
            while(frontier.Count>0)
            {
                var best=frontier.Min;frontier.Remove(best);int k=best.Item2;if(closed[k])continue;closed[k]=true;
                if(k==to){found=true;break;}
                int ci=k/nv,cj=k%nv;
                for(int di=-1;di<=1;di++)for(int dj=-1;dj<=1;dj++)
                {
                    if(di==0&&dj==0)continue;int ni=ci+di,nj=cj+dj;if(ni<0||nj<0||ni>=nu||nj>=nv)continue;
                    int mm=ni*nv+nj;if(!open[mm]||closed[mm])continue;bool diagonal=di!=0&&dj!=0;
                    if(Mathf.Abs(ground[mm].magnitude-ground[k].magnitude)>(diagonal?.6f:.5f))continue;
                    float next=cost[k]+cell*(diagonal?1.4142f:1f);
                    if(next<cost[mm]){cost[mm]=next;parent[mm]=k;frontier.Add((next+H(mm),mm));}
                }
            }
            if(!found)return null;
            var points=new List<Vector3>();for(int k=to;k>=0;k=parent[k]){points.Add(ground[k]);if(k==from)break;}
            points.Reverse();points[points.Count-1]=goal;return points;
        }
        IEnumerator FollowRoute(List<Vector3> route,Action<bool,float,float> done)
        {
            const float dt=1f/60;int closest=0,last=route.Count-1;float sinceAdvance=0,length=0,time=0;bool reached=false;
            float Flat(Vector3 a,Vector3 b)=>Vector3.ProjectOnPlane(a-b,player.Up).magnitude;
            for(int frame=0;frame<90/dt;frame++)
            {
                var here=player.transform.position;int bestK=closest;float bestD=Flat(route[closest],here);
                for(int k=closest+1;k<Mathf.Min(closest+9,route.Count);k++){float d=Flat(route[k],here);if(d<bestD){bestD=d;bestK=k;}}
                if(bestK>closest){closest=bestK;sinceAdvance=0;}else sinceAdvance+=dt;
                if(closest==last&&Flat(route[last],here)<.35f){reached=true;break;}
                if(sinceAdvance>3f)break;
                var toward=Vector3.ProjectOnPlane(route[Mathf.Min(closest+3,last)]-here,player.Up);
                player.Step(toward.normalized,false,false,dt);length+=Vector3.Distance(here,player.transform.position);time+=dt;
                if(frame%120==119)yield return null;
            }
            done(reached,length,time);
        }
        bool Visible(Vector3 eye,Vector3 point)
        {
            var d=point-eye;return !surface.RaycastTerrain(new Ray(eye,d.normalized),out _,d.magnitude-.2f);
        }

        IEnumerator Fresh()
        {
            var gate=entrance.transform;var landing=player.transform.position;
            Check(!entrance.Sealed&&!entrance.SealVisible,"Fresh record: the moon gate is open and unsealed");
            Check(!entrance.ContextActive&&!entrance.PromptVisible,"The landing is outside the gate's prompt range");
            Check(quest!=null&&quest.Goal.Contains("무게의 신전"),"The first quest stays the weight temple ("+quest?.Goal+")");
            float surfaceDistance=Vector3.Angle(landing,entrance.EntranceTarget.position)*Mathf.Deg2Rad*landing.magnitude;
            Measure("landing to the moon gate: "+surfaceDistance.ToString("0.0")+" m along the surface");
            orbit.Snap();var eye=view.transform.position;
            bool beaconSeen=Visible(eye,gate.position+gate.up*17f),gateSeen=Visible(eye,gate.position+gate.up*5.5f);
            Measure("from the landing camera: beacon top visible "+beaconSeen+", gate crest visible "+gateSeen);
            Check(beaconSeen,"The bone-white beacon clears the horizon from the landing");
            // Nature: nothing active inside the footprint; everything hidden by the gate lies inside it.
            int activeInside=0,hiddenInside=0;
            foreach(var name in ShadowSanctuaryEntrance.NatureGroups)
            {
                var group=GameObject.Find(name);if(group==null)continue;
                foreach(Transform item in group.transform)
                {
                    bool inside=ShadowSanctuaryEntrance.InsideFootprint(gate.InverseTransformPoint(item.position));
                    if(inside&&item.gameObject.activeSelf)activeInside++;if(inside&&!item.gameObject.activeSelf)hiddenInside++;
                }
            }
            Check(activeInside==0,"No tree or rock stands in the gate footprint ("+hiddenInside+" hidden)");
            var toGate=gate.position-view.transform.position;
            Capture("landing-view",landing+landing.normalized*2.6f-Vector3.ProjectOnPlane(toGate,landing.normalized).normalized*5,gate.position+gate.up*4,landing.normalized);
            // Walk from the landing to the forecourt with the ordinary movement code.
            var route=PlanRoute(player.transform.position,entrance.ArrivalPoint,out int cells,out int blocked);
            Check(route!=null,"A walkable route exists from the landing to the moon gate ("+cells+" cells, "+blocked+" blocked)");
            bool reached=false;float length=0,time=0;
            yield return FollowRoute(route,(r,l,t)=>{reached=r;length=l;time=t;});
            Measure("landing -> moon gate: walked "+length.ToString("0.0")+" m in "+time.ToString("0.0")+" s (surface "+surfaceDistance.ToString("0.0")+" m)");
            Check(reached,"Ordinary walking reaches the forecourt");
            yield return Frames(3);
            Check(entrance.ContextActive&&entrance.PromptVisible,"The moon gate prompt appears on the forecourt");
            Check(quest.Goal==QuestGuide.ShadowEnterGoal,"The quest names the shadow temple at its gate ("+quest.Goal+")");
            var weight=FindFirstObjectByType<TempleEntrance>();
            Check(weight==null||!weight.PromptVisible,"The weight temple prompt steps aside at the moon gate");
            // Walk up to the portal.
            var doorway=entrance.EntranceTarget;
            for(int i=0;i<240&&!entrance.InDoorway;i++){var d=Vector3.ProjectOnPlane(doorway.TransformPoint(new Vector3(0,0,-1.6f))-player.transform.position,player.Up);player.Step(d.normalized*Mathf.Min(1,d.magnitude*8),false,false,1f/60);if(i%30==0)yield return null;}
            yield return Frames(3);
            Check(entrance.InDoorway&&entrance.CanEnter&&entrance.PromptText==ShadowSanctuaryEntrance.PromptEnter,"E enters from the portal forecourt ("+entrance.PromptText+")");
            var missing=ShadowSanctuaryEntrance.PromptTexts.Concat(new[]{QuestGuide.ShadowEnterGoal,QuestGuide.ShadowFindGoal,QuestGuide.ShadowHint}).SelectMany(t=>t)
                .Where(c=>!char.IsWhiteSpace(c)&&entrance.PromptFont!=null&&!entrance.PromptFont.characterLookupTable.ContainsKey(c)).Distinct().ToArray();
            Check(missing.Length==0,"Moon gate prompt glyphs exist ("+new string(missing)+")");
            var questFont=quest.GetComponentsInChildren<TMPro.TextMeshProUGUI>(true).First().font;
            var questMissing=(QuestGuide.ShadowEnterGoal+QuestGuide.ShadowFindGoal+QuestGuide.ShadowHint+"세 신전 탐사 완료").Where(c=>!char.IsWhiteSpace(c)&&!questFont.characterLookupTable.ContainsKey(c)).Distinct().ToArray();
            Check(questMissing.Length==0,"Quest card glyphs exist for the shadow temple ("+new string(questMissing)+")");
            var notebook=FindFirstObjectByType<NotebookUI>();
            if(notebook!=null){Check(notebook.TryOpen()&&!entrance.CanEnter,"An open notebook blocks the gate");notebook.Close();yield return null;Check(entrance.CanEnter,"Closing the notebook restores the gate");}
            orbit.Snap();Capture("moon-gate-prompt");
            Capture("moon-gate-front",gate.TransformPoint(new Vector3(0,2.2f,-9)),gate.TransformPoint(new Vector3(0,2.6f,0)),gate.up);
            Capture("moon-gate-three-quarter",gate.TransformPoint(new Vector3(6,3.2f,-7.5f)),gate.TransformPoint(new Vector3(0,2.6f,0)),gate.up);
            // Enter and return: the observer survives the scene changes.
            var observer=new GameObject("Shadow entrance observer").AddComponent<ShadowEntranceObserver>();
            DontDestroyOnLoad(observer.gameObject);observer.Begin(output,result,entrance.ArrivalPoint);
            Check(entrance.TryEnter(),"E at the portal loads the shadow temple");
            yield return "handoff";
        }
        IEnumerator Sealed()
        {
            yield return Frames(2);
            Check(entrance.Sealed&&entrance.SealVisible,"A completed record shows the bronze seal");
            player.Respawn(entrance.ArrivalPoint,entrance.EntranceTarget.forward);yield return Frames(3);
            Check(entrance.PromptText==ShadowSanctuaryEntrance.PromptSealed,"The prompt says the temple is sealed ("+entrance.PromptText+")");
            for(int i=0;i<200&&!entrance.InDoorway;i++){var d=Vector3.ProjectOnPlane(entrance.EntranceTarget.TransformPoint(new Vector3(0,0,-1.6f))-player.transform.position,player.Up);player.Step(d.normalized*Mathf.Min(1,d.magnitude*8),false,false,1f/60);}
            Check(!entrance.TryEnter()&&SceneManager.GetActiveScene().name=="PlanetExploration","The sealed gate refuses entry");
            var notebook=FindFirstObjectByType<NotebookUI>();
            if(notebook!=null){Check(notebook.TryOpen(),"Notebook opens");Check(notebook.BodyText.Contains("그림자"),"The notebook shows the shadow wisdom");notebook.Close();}
            orbit.Snap();Capture("moon-gate-sealed",entrance.transform.TransformPoint(new Vector3(0,2.2f,-8)),entrance.transform.TransformPoint(new Vector3(0,2.6f,0)),entrance.transform.up);
        }
    }

    // Created before the temple loads: checks the temple scene, leaves it, and checks the return on the planet.
    public sealed class ShadowEntranceObserver : MonoBehaviour
    {
        string output;object result;Vector3 arrival;
        public void Begin(string folder,object report,Vector3 arrivalPoint){output=folder;result=report;arrival=arrivalPoint;StartCoroutine(Run());}
        void Add(string list,string text)
        {
            var field=result.GetType().GetField(list);((List<string>)field.GetValue(result)).Add(text);Debug.Log("SHADOW_ENTRANCE_CHECK "+text);
        }
        void Fail(string text){result.GetType().GetField("error").SetValue(result,text);Finish();}
        void Finish()
        {
            result.GetType().GetField("passed").SetValue(result,result.GetType().GetField("error").GetValue(result)==null);
            File.WriteAllText(Path.Combine(output,"result.json"),JsonUtility.ToJson(result,true));
            Application.Quit((bool)result.GetType().GetField("passed").GetValue(result)?0:1);
        }
        IEnumerator Run()
        {
            float deadline=Time.realtimeSinceStartup+30;
            while(SceneManager.GetActiveScene().name!=ShadowTemple.SceneName){if(Time.realtimeSinceStartup>deadline){Fail("The shadow temple scene did not load");yield break;}yield return null;}
            for(int i=0;i<25;i++)yield return null;
            var temple=FindFirstObjectByType<ShadowTemple>();
            if(temple==null){Fail("No ShadowTemple in the loaded scene");yield break;}
            Add("checks","The shadow temple scene loads from the moon gate");
            if(!ShadowApproachProgress.Current.EntranceOpen){Fail("The first visit was not recorded");yield break;}
            Add("checks","The first visit is recorded on the planet record");
            if(!temple.SpeechActive){Fail("The keeper did not greet on the first visit");yield break;}
            Add("checks","Inside, the keeper greets the first visit");
            for(int i=0;i<40&&temple.SpeechActive;i++){temple.AdvanceSpeech();yield return new WaitForSecondsRealtime(.35f);}
            temple.Leave();
            deadline=Time.realtimeSinceStartup+30;
            while(SceneManager.GetActiveScene().name!="PlanetExploration"){if(Time.realtimeSinceStartup>deadline){Fail("Leaving the temple did not return to the planet");yield break;}yield return null;}
            for(int i=0;i<25;i++)yield return null;
            var player=FindFirstObjectByType<PlanetExplorer>();
            float distance=Vector3.Distance(player.transform.position,arrival);
            if(distance>.6f){Fail("The player did not return in front of the moon gate ("+distance.ToString("0.00")+" m away)");yield break;}
            Add("checks","Leaving the temple returns the player to the moon gate forecourt ("+distance.ToString("0.00")+" m)");
            var record=new ShadowTempleStore(ShadowTempleProgress.SavePath);
            if(record.Current==null||!record.Current.active){Fail("The temple journey record was not saved on leaving");yield break;}
            Add("checks","The temple journey record was saved on leaving (stage "+record.Current.stage+")");
            Finish();
        }
    }
}
