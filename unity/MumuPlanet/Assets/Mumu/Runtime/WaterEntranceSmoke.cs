using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Mumu.Planet
{
    // Opt-in Windows-player check: the sandstone cliff chapter is gone and the water sanctuary opens directly.
    public sealed class WaterEntranceSmoke : MonoBehaviour
    {
        public const string Flag="-mumu-water-entrance-smoke",ModeFlag="-mumu-water-entrance-mode";
        [SerializeField] WaterSanctuaryEntrance entrance;
        [SerializeField] PlanetExplorer player;
        [SerializeField] OrbitCamera orbit;
        [SerializeField] PlanetSurface surface;
        // Frame of the retired cliff chapter; kept only to validate and photograph the cleared site.
        [SerializeField] Vector3 retiredSite;
        [SerializeField] Quaternion retiredSiteRotation=Quaternion.identity;
        readonly List<string> checks=new List<string>();
        readonly List<string> notes=new List<string>();
        string output,mode="fresh";
        bool handedOff;
        [Serializable] sealed class Result{public bool passed;public string error;public string[] checks;public string[] measurements;}
        public void Configure(WaterSanctuaryEntrance door,PlanetExplorer explorer,OrbitCamera cameraRig,PlanetSurface ground,Vector3 site,Quaternion siteRotation)
        {entrance=door;player=explorer;orbit=cameraRig;surface=ground;retiredSite=site;retiredSiteRotation=siteRotation;}

        // Objects that only existed for the retired climb, mirror and thaw chapter.
        static readonly string[] RetiredNames={"Water mountain chapter","Water mountain HUD","Frozen water sanctuary",
            "Blender sculpted fractured cliff","Controllable sun mirror pivot","Invisible collider fitted to carved cliff path",
            "Glacial gate shell","Golden reflected beam","Sunlight arriving at mirror","Cliff foot grab point"};
        static readonly string[] RetiredPrefixes={"Designed continuous cliff v05","Blender solar altar","Blender engraved solar mirror",
            "Rock handhold","Carved walking shelf","Blender cliff batch","Continuous glacier seal"};
        // Solid glacier volume at body height from glacier-temple-v03.json, shrunk by 0.3m (sanctuary-local metres).
        static bool InsideIceCore(Vector3 p)=>
            p.x< -3.3f&&p.x> -6.1f&&p.z> -2.1f&&p.z<6.0f||p.x>3.3f&&p.x<6.1f&&p.z> -2.1f&&p.z<6.0f||
            Mathf.Abs(p.x)<4.1f&&p.z>5.2f&&p.z<7.0f;
        // Feet inside the stone plinth (top 1.1m) or a stair block below its top: walked into it from the side.
        static bool InsidePlinthBody(Vector3 p)=>
            Mathf.Abs(p.x)<3.45f&&p.z> -.8f&&p.z<4.65f&&p.y<.95f||
            Mathf.Abs(p.x)<1.1f&&(p.z> -2.02f&&p.z< -1.58f&&p.y<.4f||p.z> -1.42f&&p.z< -.98f&&p.y<.68f);

        void Check(bool ok,string label){if(!ok)throw new InvalidOperationException(label);checks.Add(label);Debug.Log("WATER_ENTRANCE_CHECK "+label);}
        void Note(string text){notes.Add(text);Debug.Log("WATER_ENTRANCE_MEASURE "+text);}

        IEnumerator Start()
        {
            var args=Environment.GetCommandLineArgs();int at=Array.IndexOf(args,Flag);
            if(at<0||at+1>=args.Length)yield break;
            output=Path.GetFullPath(args[at+1]);Directory.CreateDirectory(output);
            int m=Array.IndexOf(args,ModeFlag);if(m>=0&&m+1<args.Length)mode=args[m+1];
            for(int i=0;i<18;i++)yield return null;
            string error=null;var stack=new Stack<IEnumerator>();
            stack.Push(mode=="fresh"?Validate():ValidateRecord());
            while(stack.Count>0)
            {
                var run=stack.Peek();bool more=false;
                try{more=run.MoveNext();}catch(Exception e){error=e.ToString();Debug.LogException(e);}
                if(error!=null)break;
                if(!more){stack.Pop();continue;}
                if(run.Current is IEnumerator nested){stack.Push(nested);continue;}
                yield return run.Current;
            }
            File.WriteAllText(Path.Combine(output,"measurements.json"),JsonUtility.ToJson(new Result{passed=error==null,error=error??"",checks=checks.ToArray(),measurements=notes.ToArray()},true));
            if(handedOff&&error==null)yield break;
            File.WriteAllText(Path.Combine(output,"result.json"),JsonUtility.ToJson(new Result{passed=error==null,error=error??"",checks=checks.ToArray(),measurements=notes.ToArray()},true));
            Application.Quit(error==null?0:1);
        }

        List<Transform> SceneTransforms()
        {
            var all=new List<Transform>();
            foreach(var root in SceneManager.GetActiveScene().GetRootGameObjects())all.AddRange(root.GetComponentsInChildren<Transform>(true));
            return all;
        }
        int RetiredObjects(out string first)
        {
            int count=0;first="";
            foreach(var t in SceneTransforms())
            {
                bool retired=Array.IndexOf(RetiredNames,t.name)>=0;
                foreach(var prefix in RetiredPrefixes)retired|=t.name.StartsWith(prefix,StringComparison.Ordinal);
                if(retired){if(count==0)first=t.name;count++;}
            }
            return count;
        }
        // Wrong state = visible nature the sanctuary would swallow (footprint or buried under the footing),
        // or hidden nature anywhere else.
        int NatureViolations(out int hiddenInPlot,out int shown,out string first)
        {
            int wrong=0;hiddenInPlot=0;shown=0;first="";
            var footing=entrance.transform.Find(WaterSanctuaryEntrance.FootingName)?.GetComponent<Collider>();
            foreach(var name in WaterSanctuaryEntrance.NatureGroups)
            {
                var group=GameObject.Find(name);if(group==null)continue;
                foreach(Transform item in group.transform)
                {
                    bool inside=WaterSanctuaryEntrance.ShouldHideNature(entrance.transform,footing,item.position);
                    bool active=item.gameObject.activeSelf;
                    if(inside&&!active)hiddenInPlot++;
                    if(active)shown++;
                    if(inside==active){if(wrong==0)first=name+"/"+item.name+" "+entrance.transform.InverseTransformPoint(item.position);wrong++;}
                }
            }
            return wrong;
        }
        int ForeignElevated()
        {
            int foreign=0;
            foreach(var collider in surface.Elevated)
                if(collider==null||!collider.transform.IsChildOf(entrance.transform))foreign++;
            return foreign;
        }
        void Capture(string name,Vector3 view,Vector3 look,Vector3 up,bool hud=true)
        {
            var camera=orbit.GetComponent<Camera>();bool enabled=orbit.enabled;orbit.enabled=false;
            camera.transform.SetPositionAndRotation(view,Quaternion.LookRotation(look-view,up));
            var canvases=FindObjectsByType<Canvas>(FindObjectsSortMode.None);var wasEnabled=new bool[canvases.Length];
            for(int i=0;i<canvases.Length;i++)
            {var c=canvases[i];wasEnabled[i]=c.enabled;c.enabled=hud&&c.enabled;c.renderMode=RenderMode.ScreenSpaceCamera;c.worldCamera=camera;c.planeDistance=.5f;}
            Canvas.ForceUpdateCanvases();var rt=new RenderTexture(1440,900,24);rt.Create();camera.targetTexture=rt;camera.Render();
            var old=RenderTexture.active;RenderTexture.active=rt;var picture=new Texture2D(1440,900,TextureFormat.RGB24,false);
            picture.ReadPixels(new Rect(0,0,1440,900),0,0);picture.Apply();File.WriteAllBytes(Path.Combine(output,name+".png"),picture.EncodeToPNG());
            camera.targetTexture=null;RenderTexture.active=old;rt.Release();Destroy(rt);Destroy(picture);
            for(int i=0;i<canvases.Length;i++){canvases[i].renderMode=RenderMode.ScreenSpaceOverlay;canvases[i].enabled=wasEnabled[i];}
            orbit.enabled=enabled;
        }
        // The real follow camera, as a player sees it: behind the explorer's heading.
        void CaptureGameplay(string name)
        {
            bool enabled=orbit.enabled;orbit.enabled=true;orbit.Configure(player.transform);var camera=orbit.GetComponent<Camera>();
            Capture(name,camera.transform.position,camera.transform.position+camera.transform.forward*6,camera.transform.up);
            orbit.enabled=enabled;
        }
        // True when the player capsule (movement shape) intersects a sanctuary wall/glacier blocker.
        bool SanctuaryOverlap(Vector3 feet,Vector3 up,out string name)
        {
            name="";
            foreach(var hit in Physics.OverlapCapsule(feet+up*.3f,feet+up*1.2f,.24f,1<<8,QueryTriggerInteraction.Ignore))
                if(hit.transform.IsChildOf(entrance.transform)){name=hit.name;return true;}
            return false;
        }
        // Footing, stairs and plinth rectangle in sanctuary-local metres (raised surfaces are expected here).
        bool OnSanctuaryPlot(Vector3 world)
        {
            var local=entrance.transform.InverseTransformPoint(world);
            return Mathf.Abs(local.x)<9.3f&&local.z> -7.3f&&local.z<10.3f;
        }

        sealed class Walk{public bool reached,enteredIce,enteredPlinth;public int frames,detours;public float length,terrainGap,straight;public Vector3 end;public string entry="";}
        sealed class Route{public bool found;public int cells,blocked;public float length;public readonly List<Vector3> points=new List<Vector3>();}
        // Grid A* on the planet surface: a cell is open when a slightly fattened player capsule fits there,
        // and neighbours connect only across rises a walk can climb (stairs yes, the 1.1m plinth edge no).
        Route PlanRoute(Vector3 start,Vector3 goal)
        {
            const float cell=.5f,margin=12f,half=25f;
            var route=new Route();
            var up0=(start.normalized+goal.normalized).normalized;
            var e1=Vector3.ProjectOnPlane(goal-start,up0).normalized;var e2=Vector3.Cross(up0,e1);
            float span=Vector3.Dot(goal-start,e1);
            int nu=Mathf.CeilToInt((span+2*margin)/cell)+1,nv=Mathf.CeilToInt(2*half/cell)+1,count=nu*nv;
            var ground=new Vector3[count];var open=new bool[count];
            for(int i=0;i<nu;i++)for(int j=0;j<nv;j++)
            {
                int k=i*nv+j;var g=surface.Point(start+e1*(-margin+i*cell)+e2*(-half+j*cell));ground[k]=g;var n=g.normalized;
                open[k]=!Physics.CheckCapsule(g+n*.35f,g+n*1.25f,.32f,1<<8,QueryTriggerInteraction.Ignore);
                if(!open[k])route.blocked++;
            }
            route.cells=count;
            int CellOf(Vector3 p)
            {
                var d=p-start;
                int i=Mathf.Clamp(Mathf.RoundToInt((Vector3.Dot(d,e1)+margin)/cell),0,nu-1),j=Mathf.Clamp(Mathf.RoundToInt((Vector3.Dot(d,e2)+half)/cell),0,nv-1);
                return i*nv+j;
            }
            int from=CellOf(start),to=CellOf(goal);open[from]=open[to]=true;
            float H(int k)=>new Vector2(k/nv-to/nv,k%nv-to%nv).magnitude*cell;
            var cost=new float[count];var parent=new int[count];var closed=new bool[count];
            for(int k=0;k<count;k++){cost[k]=float.MaxValue;parent[k]=-1;}
            cost[from]=0;var frontier=new SortedSet<(float,int)>{(H(from),from)};
            while(frontier.Count>0)
            {
                var best=frontier.Min;frontier.Remove(best);int k=best.Item2;
                if(closed[k])continue;closed[k]=true;
                if(k==to){route.found=true;break;}
                int ci=k/nv,cj=k%nv;
                for(int di=-1;di<=1;di++)for(int dj=-1;dj<=1;dj++)
                {
                    if(di==0&&dj==0)continue;int ni=ci+di,nj=cj+dj;if(ni<0||nj<0||ni>=nu||nj>=nv)continue;
                    int m=ni*nv+nj;if(!open[m]||closed[m])continue;
                    bool diagonal=di!=0&&dj!=0;
                    if(Mathf.Abs(ground[m].magnitude-ground[k].magnitude)>(diagonal?.6f:.5f))continue;
                    float next=cost[k]+cell*(diagonal?1.4142f:1f);
                    if(next<cost[m]){cost[m]=next;parent[m]=k;frontier.Add((next+H(m),m));}
                }
            }
            if(!route.found)return route;
            for(int k=to;k>=0;k=parent[k]){route.points.Add(ground[k]);if(k==from)break;}
            route.points.Reverse();route.points[route.points.Count-1]=goal;
            for(int i=1;i<route.points.Count;i++)route.length+=Vector3.Distance(route.points[i-1],route.points[i]);
            return route;
        }
        // Walks the planned route with the ordinary movement code (pure pursuit: nearest route point, 1.5m look-ahead).
        // Fails when the nearest route point stops advancing for 3 seconds, i.e. the walker is physically stuck.
        IEnumerator FollowRoute(Route route,Walk report,float seconds=90)
        {
            const float dt=1f/60;int closest=0,last=route.points.Count-1;float sinceAdvance=0;
            var start=player.transform.position;report.straight=Vector3.Angle(start,route.points[last])*Mathf.Deg2Rad*start.magnitude;
            float Flat(Vector3 a,Vector3 b)=>Vector3.ProjectOnPlane(a-b,player.Up).magnitude;
            for(int frame=0;frame<seconds/dt;frame++)
            {
                var here=player.transform.position;
                int bestK=closest;float bestD=Flat(route.points[closest],here);
                for(int k=closest+1;k<Mathf.Min(closest+9,route.points.Count);k++){float d=Flat(route.points[k],here);if(d<bestD){bestD=d;bestK=k;}}
                if(bestK>closest){closest=bestK;sinceAdvance=0;}else sinceAdvance+=dt;
                if(closest==last&&Flat(route.points[last],here)<.35f){report.reached=true;break;}
                if(sinceAdvance>3f)break;
                var toward=Vector3.ProjectOnPlane(route.points[Mathf.Min(closest+3,last)]-here,player.Up);
                entrance.RefreshTraversal();player.Step(toward.normalized,false,false,dt);
                report.length+=Vector3.Distance(here,player.transform.position);
                var local=entrance.transform.InverseTransformPoint(player.transform.position);
                report.enteredIce|=InsideIceCore(local)&&local.y<3f;
                if(!OnSanctuaryPlot(player.transform.position))
                    report.terrainGap=Mathf.Max(report.terrainGap,Mathf.Abs(player.transform.position.magnitude-surface.TerrainPoint(player.transform.position).magnitude));
                report.frames=frame+1;
                if(frame%120==119)yield return null;
            }
            report.end=player.transform.position;
        }
        IEnumerator WalkRoute(string label,Vector3 goal,Walk report)
        {
            var route=PlanRoute(player.transform.position,goal);
            Note($"{label}: planning grid {route.cells} cells, {route.blocked} blocked by trees/rocks/buildings, route found {route.found}, route {route.length:0.0}m");
            if(!route.found)yield break;
            yield return FollowRoute(route,report);
            var local=entrance.transform.InverseTransformPoint(report.end);
            string stuckOn="";
            if(!report.reached)foreach(var hit in Physics.OverlapSphere(report.end+player.Up*.8f,.7f,1<<8,QueryTriggerInteraction.Ignore))
                stuckOn+=(stuckOn.Length>0?", ":"")+(hit.transform.parent!=null?hit.transform.parent.name+"/":"")+hit.name;
            Note($"{label}: walked {report.length:0.0}m in {report.frames/60f:0.0}s (surface distance {report.straight:0.0}m, ratio {report.length/Mathf.Max(.01f,report.straight):0.00}), reached {report.reached}, end sanctuary-local {local:F2}, max terrain gap {report.terrainGap:0.000}m"+(stuckOn.Length>0?", touching "+stuckOn:""));
            if(!report.reached)Capture(label.Replace(">","").Replace(" ","-")+"-stuck",report.end+player.Up*3.5f-player.transform.forward*4.5f,report.end+player.Up*.8f,player.Up);
        }
        // Walks with ordinary locomotion toward a goal. With detours it sidesteps trees and rocks it bumps into.
        IEnumerator WalkTo(Vector3 goal,float seconds,Walk report,float arrive=.35f,bool detours=true)
        {
            const float dt=1f/60;float stuck=0,detour=0;int sign=1;
            var start=player.transform.position;report.straight=Vector3.Angle(start,goal)*Mathf.Deg2Rad*start.magnitude;
            for(int frame=0;frame<seconds/dt;frame++)
            {
                var up=player.Up;var toward=Vector3.ProjectOnPlane(goal-player.transform.position,up);
                if(toward.magnitude<arrive){report.reached=true;break;}
                var direction=toward.normalized;
                if(detour>0){direction=Quaternion.AngleAxis(sign*65f,up)*direction;detour-=dt;}
                var before=player.transform.position;
                // Diagnostic: the wall cast the movement code is about to make (same shape and mask as PlanetExplorer),
                // recorded on the first frame the capsule ends up inside a sanctuary blocker.
                var castUp=player.Up;var castDir=Vector3.ProjectOnPlane(direction,castUp).normalized;
                bool casted=Physics.CapsuleCast(before+castUp*.3f,before+castUp*1.2f,.25f,castDir,out var castHit,3.2f*dt+.035f,1<<8,QueryTriggerInteraction.Ignore);
                bool overlapBefore=SanctuaryOverlap(before,castUp,out _);
                entrance.RefreshTraversal();player.Step(direction,false,false,dt);
                float moved=Vector3.Distance(before,player.transform.position);report.length+=moved;
                if(detours&&moved<.012f){stuck+=dt;if(stuck>.3f){detour=.9f;sign=-sign;stuck=0;report.detours++;}}else stuck=0;
                var local=entrance.transform.InverseTransformPoint(player.transform.position);
                report.enteredIce|=InsideIceCore(local)&&local.y<3f;
                report.enteredPlinth|=InsidePlinthBody(local);
                if(report.entry.Length==0&&!overlapBefore&&SanctuaryOverlap(player.transform.position,player.Up,out string inside))
                    report.entry=$"capsule entered {inside} at frame {frame}: {entrance.transform.InverseTransformPoint(before):F2} -> {local:F2}, elevated {player.ElevatedTraversal}, "+
                        (casted?$"cast hit {castHit.collider.name} normal·up {Vector3.Dot(castHit.normal,castUp):F2} at {castHit.distance:F3}m":"cast hit nothing");
                if(!OnSanctuaryPlot(player.transform.position))
                    report.terrainGap=Mathf.Max(report.terrainGap,Mathf.Abs(player.transform.position.magnitude-surface.TerrainPoint(player.transform.position).magnitude));
                report.frames=frame+1;
                if(frame%120==119)yield return null;
            }
            report.end=player.transform.position;
        }

        IEnumerator Validate()
        {
            Check(SceneManager.GetActiveScene().name=="PlanetExploration","Water sanctuary exterior lives on the planet scene");
            var temple=entrance.transform;var doorway=entrance.EntranceTarget;var up=temple.up;
            var weight=FindFirstObjectByType<TempleEntrance>();var guide=FindFirstObjectByType<QuestGuide>();
            Check(weight!=null&&guide!=null,"Weight temple entrance and quest guide are present");

            // 1. The cliff chapter is gone: objects, components, walkable surfaces and blockers.
            Check(RetiredObjects(out string retiredName)==0,"No object of the retired cliff chapter remains ("+retiredName+")");
            Check(FindObjectsByType<MountainClimbController>(FindObjectsInactive.Include,FindObjectsSortMode.None).Length==0,
                "No climbing controller remains in the planet scene");
            Check(!orbit.ClimbAssistActive,"Follow camera has no cliff assistance");
            Check(surface.Elevated.Count>=5&&ForeignElevated()==0,
                "Every raised walkable surface belongs to the sanctuary ("+surface.Elevated.Count+" colliders)");
            float siteGap=0;int samples=0;
            for(float x=-10;x<=10.01f;x+=2.5f)for(float z=-11;z<=11.01f;z+=2.75f)
            {
                var direction=retiredSite+retiredSiteRotation*new Vector3(x,0,z);
                if(OnSanctuaryPlot(surface.TerrainPoint(direction)))continue;
                siteGap=Mathf.Max(siteGap,surface.Point(direction).magnitude-surface.TerrainPoint(direction).magnitude);samples++;
            }
            Note("retired cliff site: "+samples+" ground samples, max raised surface "+siteGap.ToString("0.0000")+"m");
            Check(samples>=75&&siteGap<.001f,"Former cliff footprint is plain terrain at "+samples+" samples");
            var siteUp=retiredSite.normalized;var blockers=Physics.OverlapBox(retiredSite+siteUp*7f,new Vector3(10,7,11),retiredSiteRotation,(1<<8)|(1<<9),QueryTriggerInteraction.Collide);
            int foreignBlockers=0,natureBlockers=0,sanctuaryBlockers=0;string foreignName="";
            foreach(var hit in blockers)
            {
                if(hit.name=="Authored terrain"||hit.name=="Grass surface")continue;
                if(hit.transform.parent!=null&&hit.transform.parent.name=="Nature collisions"){natureBlockers++;continue;}
                if(hit.transform.IsChildOf(temple)){sanctuaryBlockers++;continue;}
                if(foreignBlockers==0)foreignName=hit.name;foreignBlockers++;
            }
            Note("retired cliff site volume: "+natureBlockers+" restored tree/rock collisions, "+sanctuaryBlockers+" sanctuary edge, "+foreignBlockers+" other");
            Check(foreignBlockers==0,"No invisible cliff collision remains over the former site ("+foreignName+")");

            // 2. Nature returns to the cliff site; only what the sanctuary covers stays hidden.
            Check(NatureViolations(out int hiddenInPlot,out int shownNature,out string wrongNature)==0,
                "Nature is hidden exactly where the sanctuary footprint or raised footing covers it ("+wrongNature+")");
            Note("nature: "+shownNature+" visible, "+hiddenInPlot+" hidden under the sanctuary");

            // 3. The sanctuary kept its site and art; its doorway is open.
            var art=temple.Find("Blender glacier sanctuary");
            Check(art!=null&&art.GetComponentsInChildren<MeshRenderer>().Length>=7,"Blender stone and glacier batches are installed");
            var formerIce=temple.TransformPoint(new Vector3(0,3.17f,-.1f));
            Note("former ice-seal point "+formerIce.ToString("F3")+" (2026-09-27 build: (54.10, 49.62, 17.57))");
            Check(Vector3.Distance(formerIce,new Vector3(54.10f,49.62f,17.57f))<.02f,"Sanctuary keeps the site and facing of the earlier build");
            Check(Vector3.Angle(up,temple.position.normalized)<.1f,"Sanctuary stands on its own planetary ground normal");
            var footing=temple.Find(WaterSanctuaryEntrance.FootingName);
            Check(footing!=null,"Sanctuary keeps the terrain-fitted glacier footing");
            float boundaryGap=0;
            foreach(var v in footing.GetComponent<MeshFilter>().sharedMesh.vertices)
                if(Mathf.Abs(v.x)>8.99f||v.z< -6.99f||v.z>9.99f)
                {var world=footing.TransformPoint(v);boundaryGap=Mathf.Max(boundaryGap,Vector3.Distance(world,surface.TerrainPoint(world)));}
            Check(boundaryGap<.05f,"Footing perimeter meets terrain within 5cm: "+boundaryGap.ToString("0.000"));
            Check(temple.Find("Glacial gate shell")==null&&temple.GetComponentInChildren<LineRenderer>(true)==null,"No ice seal or sunlight beam is built");
            Check(!entrance.SealVisible&&!WaterApproachProgress.Current.EntranceOpen&&!WaterApproachProgress.Current.Completed,
                "Fresh isolated record: doorway open, not yet visited or sealed");

            // 4. Landing: the weight temple remains the first suggestion.
            var landing=player.transform.position;
            player.enabled=false;orbit.enabled=false;entrance.RefreshTraversal();yield return null;
            Check(!entrance.CanEnter&&!entrance.TryEnter()&&!entrance.PromptVisible,"Distant landing cannot enter or see the water prompt");
            Check(weight.PromptVisible&&guide.Goal.Contains("무게의 신전"),"Landing keeps the weight temple as the first quest ("+guide.Goal+")");
            float landingDistance=Vector3.Angle(landing,doorway.position)*Mathf.Deg2Rad*landing.magnitude;
            Note("landing to water doorway: "+landingDistance.ToString("0.0")+"m along the surface");
            var toTemple=Vector3.ProjectOnPlane(doorway.position-landing,landing.normalized).normalized;
            Capture("landing-view",landing-toTemple*6.5f+landing.normalized*2.6f,doorway.position+up*1.5f,landing.normalized);

            // 5. Walk from landing, then across the former cliff site, to the stairs: plan a route, then walk it.
            var approach=surface.Point(temple.TransformPoint(new Vector3(0,0,-4.6f)));
            var first=new Walk();yield return WalkRoute("landing->stairs",approach,first);
            Check(first.reached,"Ordinary walking reaches the sanctuary stairs from the landing");
            Check(first.terrainGap<.01f,"Walk stays on plain terrain until the sanctuary footing");
            player.Respawn(surface.Point(retiredSite),toTemple);Physics.SyncTransforms();
            var across=new Walk();yield return WalkRoute("former cliff centre->stairs",approach,across);
            Check(across.reached&&across.terrainGap<.01f,"The former cliff footprint is open walking ground");
            Capture("water-temple-approach",temple.TransformPoint(new Vector3(7,5,-12)),temple.TransformPoint(new Vector3(0,3,0)),up);
            Capture("water-temple-ground-front",temple.TransformPoint(new Vector3(0,1.6f,-12)),temple.TransformPoint(new Vector3(0,2.7f,0)),up);
            Capture("water-temple-ground-side",temple.TransformPoint(new Vector3(12,1.6f,-6)),temple.TransformPoint(new Vector3(0,2,1)),up);
            Capture("retired-mountain-site",retiredSite+retiredSiteRotation*new Vector3(7,17,-37),retiredSite+retiredSiteRotation*new Vector3(9,4,2),siteUp);

            // 6. Prompts and quest at the foot of the stairs.
            player.Respawn(approach,temple.forward);Physics.SyncTransforms();entrance.RefreshTraversal();yield return null;yield return null;
            Check(player.ElevatedTraversal,"Stepped traversal is active around the sanctuary plinth");
            Check(entrance.ContextActive&&entrance.PromptVisible&&!weight.PromptVisible,"Water prompt replaces the unrelated weight temple prompt");
            Check(guide.Goal=="물의 신전 들어가기"&&guide.HasTarget,"Quest switches to entering the water sanctuary at its stairs ("+guide.Goal+")");
            var font=entrance.PromptFont;var missing=new List<char>();
            foreach(var text in new List<string>(WaterSanctuaryEntrance.PromptTexts){guide.Goal,guide.Hint,"물의 신전 찾아가기"})
                foreach(char c in text)if(!char.IsWhiteSpace(c)&&font!=null&&!font.characterLookupTable.ContainsKey(c)&&!missing.Contains(c))missing.Add(c);
            Check(font!=null&&missing.Count==0,"Korean prompt and quest glyphs exist in the static atlas ("+new string(missing.ToArray())+")");

            // 7. Up the stairs: stop under the arch, never inside the dark hall.
            for(int step=0;step<420;step++){entrance.RefreshTraversal();player.Step(temple.forward,false,false,1f/60);}
            var threshold=temple.InverseTransformPoint(player.transform.position);
            Note("stairs walk stops at sanctuary-local "+threshold.ToString("F3"));
            Check(threshold.z>.1f&&threshold.y>1f,"Player walks up the glacier stairs to the open threshold: "+threshold);
            Check(threshold.z<.85f,"Threshold collision keeps the player under the arch, out of the unfinished hall");
            yield return null;
            Check(entrance.InDoorway&&entrance.CanEnter&&entrance.PromptText==WaterSanctuaryEntrance.PromptEnter,"Threshold offers E entry immediately, with no thaw");
            CaptureGameplay("doorway-prompt");
            var notebook=FindFirstObjectByType<NotebookUI>();
            Check(notebook!=null&&notebook.TryOpen()&&!entrance.CanEnter&&!entrance.TryEnter(),"Open notebook blocks the doorway action");
            notebook.Close();yield return null;
            Check(entrance.CanEnter,"Closing the notebook restores the doorway action");
            Capture("doorway-closeup",temple.TransformPoint(new Vector3(2.4f,2.6f,-6.5f)),temple.TransformPoint(new Vector3(0,2.3f,0)),up);

            // 8. Glacier volume blocks walking into the ice from every side except the stairs.
            // Probes start 8m from the hall centre, mostly inside the cleared plot, and walk straight in.
            var centre=temple.TransformPoint(new Vector3(0,0,2.4f));int blocked=0;var leaks=new List<string>();
            foreach(int angle in new[]{0,45,90,135,225,270,315})
            {
                var local=new Vector3(Mathf.Sin(angle*Mathf.Deg2Rad),0,Mathf.Cos(angle*Mathf.Deg2Rad))*8f+new Vector3(0,0,2.4f);
                player.Respawn(surface.Point(temple.TransformPoint(local)),centre-temple.TransformPoint(local));Physics.SyncTransforms();
                var startLocal=temple.InverseTransformPoint(player.transform.position);
                var probe=new Walk();yield return WalkTo(centre,7,probe,.2f,false);
                var end=temple.InverseTransformPoint(probe.end);
                bool touching=false;
                foreach(var wall in Physics.OverlapSphere(probe.end+up*.8f,.6f,(1<<8)|(1<<9),QueryTriggerInteraction.Ignore))
                    touching|=wall.transform.IsChildOf(temple)&&wall.name!=WaterSanctuaryEntrance.FootingName;
                Note($"glacier approach {angle}deg from sanctuary-local {startLocal:F2} ends at {end:F2}, touching sanctuary collision {touching}"+(probe.entry.Length>0?"; "+probe.entry:""));
                if(probe.enteredIce||probe.enteredPlinth)leaks.Add(angle+"deg "+(probe.enteredIce?"ice":"plinth")+" "+end.ToString("F2"));
                if(touching&&!probe.reached&&!probe.enteredIce&&!probe.enteredPlinth)blocked++;
            }
            Check(leaks.Count==0,"Glacier and plinth block every side and rear walk ("+string.Join("; ",leaks)+")");
            Check(blocked==7,"All seven side and rear walks stop against sanctuary collision ("+blocked+"/7)");
            int shallow=0;
            foreach(var box in temple.GetComponentsInChildren<BoxCollider>())
                if(box.name.StartsWith("Glacier ")&&box.transform.localPosition.y-box.size.y*.5f> -1f)shallow++;
            Check(shallow==0,"Every glacier collision box reaches below the sloping footing ("+shallow+" shallow)");

            // 9. Detectors can fail: plant a retired object, a hidden-plot tree and a foreign walkable surface.
            var decoy=new GameObject("Water mountain chapter");
            Check(RetiredObjects(out _)==1,"Retired-object detector catches a planted cliff chapter");
            DestroyImmediate(decoy);Check(RetiredObjects(out _)==0,"Retired-object detector clears after removing the decoy");
            var group=GameObject.Find(WaterSanctuaryEntrance.NatureGroups[1]).transform;
            var tree=new GameObject("Planted plot tree");tree.transform.SetParent(group,false);tree.transform.position=doorway.position;
            Check(NatureViolations(out _,out _,out _)==1,"Nature detector catches a visible tree in the sanctuary doorway");
            DestroyImmediate(tree);Check(NatureViolations(out _,out _,out _)==0,"Nature detector clears after removing the planted tree");
            var ledge=new GameObject("Planted walkable ledge").AddComponent<MeshCollider>();surface.AddElevated(ledge);
            Check(ForeignElevated()==1,"Walkable-surface detector catches a planted foreign ledge");
            surface.RemoveElevated(ledge);DestroyImmediate(ledge.gameObject);
            Check(ForeignElevated()==0,"Walkable-surface detector clears after removing the ledge");

            // 10. Real entry: press E at the threshold, observed across the scene change.
            player.Respawn(surface.Point(doorway.TransformPoint(new Vector3(0,-1f,-1.6f))),temple.forward);
            player.enabled=true;Physics.SyncTransforms();entrance.RefreshTraversal();yield return null;
            Check(entrance.CanEnter,"Player stands at the doorway for the entry handoff");
            var observer=new GameObject("Water first-room entry validation").AddComponent<WaterEntrySmoke>();
            DontDestroyOnLoad(observer.gameObject);observer.Configure(entrance,checks,output,mode);handedOff=true;
        }

        // Earlier local records: a thaw from the retired cliff (visited) or a damaged file (unreadable).
        IEnumerator ValidateRecord()
        {
            Check(SceneManager.GetActiveScene().name=="PlanetExploration","Record case runs on the planet scene");
            var guide=FindFirstObjectByType<QuestGuide>();var weight=FindFirstObjectByType<TempleEntrance>();
            player.enabled=false;orbit.enabled=false;yield return null;
            Check(!WaterApproachProgress.Current.Completed&&!entrance.SealVisible,"Earlier record does not seal the doorway");
            if(mode=="visited")
            {
                Check(entrance.Visited,"Existing entranceOpen record is read as a visit");
                Check(guide.Goal=="물의 신전 찾아가기"&&guide.HasTarget,"Visited sanctuary is the quest target from the landing ("+guide.Goal+")");
            }
            else if(mode=="unreadable")
            {
                Check(!entrance.Visited&&!string.IsNullOrEmpty(WaterApproachProgress.Current.Problem),"Damaged record is detected without inventing a visit");
                Check(guide.Goal.Contains("무게의 신전")&&weight.PromptVisible,"Damaged record keeps the default weight temple quest");
            }
            else throw new InvalidOperationException("Unknown water entrance mode: "+mode);
            var doorway=entrance.EntranceTarget;
            player.Respawn(surface.Point(doorway.TransformPoint(new Vector3(0,-1f,-1.6f))),entrance.transform.forward);
            player.enabled=true;Physics.SyncTransforms();entrance.RefreshTraversal();yield return null;
            Check(entrance.CanEnter,"Doorway accepts entry with an earlier "+mode+" record");
            var observer=new GameObject("Water first-room entry validation").AddComponent<WaterEntrySmoke>();
            DontDestroyOnLoad(observer.gameObject);observer.Configure(entrance,checks,output,mode);handedOff=true;
        }
    }
}
