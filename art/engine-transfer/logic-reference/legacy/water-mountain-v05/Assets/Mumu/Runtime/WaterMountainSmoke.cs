using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Mumu.Planet
{
    // Opt-in, isolated Windows-player check for the new outdoor water approach.
    public sealed class WaterMountainSmoke : MonoBehaviour
    {
        [SerializeField] WaterMountainTrial trial;
        [SerializeField] PlanetExplorer player;
        [SerializeField] OrbitCamera orbit;
        [SerializeField] PlanetSurface surface;
        readonly List<string> checks=new List<string>();
        string output;
        bool entryObserverOwnsResult;
        [Serializable] class Result {public bool passed;public string error;public string[] checks;}
        public void Configure(WaterMountainTrial chapter,PlanetExplorer explorer,OrbitCamera camera,PlanetSurface ground)
        {trial=chapter;player=explorer;orbit=camera;surface=ground;}
        void Check(bool okay,string label)
        {if(!okay)throw new InvalidOperationException(label);checks.Add(label);Debug.Log("WATER_CHECK "+label);}
        IEnumerator Start()
        {
            var args=Environment.GetCommandLineArgs();int at=Array.IndexOf(args,"-mumu-water-smoke");
            if(at<0)yield break;
            output=args[at+1];Directory.CreateDirectory(output);
            for(int i=0;i<18;i++)yield return null;
            string error=null;var stack=new Stack<IEnumerator>();stack.Push(Validate());
            while(stack.Count>0)
            {
                var run=stack.Peek();bool more=false;
                try{more=run.MoveNext();}catch(Exception e){error=e.ToString();Debug.LogException(e);}
                if(error!=null)break;
                if(!more){stack.Pop();continue;}
                if(run.Current is IEnumerator nested){stack.Push(nested);continue;}
                yield return run.Current;
            }
            if(entryObserverOwnsResult)yield break;
            File.WriteAllText(Path.Combine(output,"result.json"),JsonUtility.ToJson(new Result{passed=error==null,error=error??"",checks=checks.ToArray()},true));
            Application.Quit(error==null?0:1);
        }
        void Capture(string name,Vector3 view,Vector3 look,Vector3? cameraUp=null)
        {
            var camera=orbit.GetComponent<Camera>();bool enabled=orbit.enabled;orbit.enabled=false;
            camera.transform.SetPositionAndRotation(view,Quaternion.LookRotation(look-view,cameraUp??trial.transform.up));
            var canvases=FindObjectsByType<Canvas>(FindObjectsSortMode.None);
            foreach(var canvas in canvases){canvas.renderMode=RenderMode.ScreenSpaceCamera;canvas.worldCamera=camera;canvas.planeDistance=.5f;}
            Canvas.ForceUpdateCanvases();var rt=new RenderTexture(1440,900,24);rt.Create();camera.targetTexture=rt;camera.Render();
            var old=RenderTexture.active;RenderTexture.active=rt;var picture=new Texture2D(1440,900,TextureFormat.RGB24,false);
            picture.ReadPixels(new Rect(0,0,1440,900),0,0);picture.Apply();File.WriteAllBytes(Path.Combine(output,name+".png"),picture.EncodeToPNG());
            camera.targetTexture=null;RenderTexture.active=old;rt.Release();Destroy(rt);Destroy(picture);
            foreach(var canvas in canvases)canvas.renderMode=RenderMode.ScreenSpaceOverlay;
            orbit.enabled=enabled;
        }
        IEnumerator Validate()
        {
            Check(SceneManager.GetActiveScene().name=="PlanetExploration","Approach is on existing planet scene");
            int waterCanvases=0;foreach(var canvas in FindObjectsByType<Canvas>(FindObjectsSortMode.None))
                if(canvas.name=="Water mountain HUD")waterCanvases++;
            Check(waterCanvases==1,"Regeneration leaves one water chapter HUD");
            Check(!trial.EntranceOpen,"Fresh isolated record keeps ice sealed");
            Check(trial.Thaw!=null&&trial.Thaw.SealVisible&&trial.Thaw.SurfaceMelt==0,"Frozen doorway starts with complete ice cover");
            var frozenBounds=trial.IceBounds;
            Check(trial.Thaw.Seal.sharedMaterial.shader.name=="Mumu/Glacial Seal","Continuous seal uses radial thaw shader");
            var sanctuary=trial.transform.Find("Frozen water sanctuary/Blender glacier sanctuary");
            Check(sanctuary!=null&&sanctuary.GetComponentsInChildren<MeshRenderer>().Length>=7,"Blender stone and glacier batches are installed");
            var footing=sanctuary.parent.Find("Terrain fitted glacier footing");
            Check(footing!=null,"Temple has terrain fitted footing instead of floating circular basin");
            Check(Vector3.Angle(sanctuary.parent.up,sanctuary.parent.position.normalized)<.1f,"Temple foundation uses its own planetary ground normal");
            var footingVertices=footing.GetComponent<MeshFilter>().sharedMesh.vertices;
            float boundaryGap=0;
            foreach(var v in footingVertices)
                if(Mathf.Abs(v.x)>8.99f||v.z< -6.99f||v.z>9.99f)
                {
                    var world=footing.TransformPoint(v);
                    boundaryGap=Mathf.Max(boundaryGap,Vector3.Distance(world,surface.TerrainPoint(world)));
                }
            Check(boundaryGap<.05f,"Footing perimeter meets terrain within 5cm: "+boundaryGap);
            Check(!trial.TryAim(),"Summit mirror cannot be used from landing");
            Check(!trial.TryDiscoverSummit(),"Summit discovery cannot start from landing");
            var originalPosition=player.transform.position;
            var entrancePrompt=FindFirstObjectByType<TempleEntrance>();
            trial.RefreshHud();
            Check(!trial.MissionVisible,"Water instructions stay hidden at distant landing");
            var climb=trial.BaseTarget;var summit=trial.MirrorTarget;var ice=trial.IceTarget;var traversal=trial.Climbing;
            Capture("water-temple-frozen",ice.position+(summit.position-ice.position).normalized*12+trial.transform.up*1.2f,ice.position);
            Check(traversal!=null&&traversal.Holds.Length==10&&traversal.Walk.Length==6,"Blender cliff has ten hand contacts and a carved upper trail");
            Check(summit.position.magnitude-climb.position.magnitude>10,"Summit rises above the lower cliff");
            Check(Vector3.Distance(summit.position,ice.position)>10,"Light must cross the valley");
            player.Respawn(climb.position,trial.ClimbLanding.position-climb.position);Physics.SyncTransforms();
            trial.enabled=false;player.enabled=false;orbit.enabled=false;
            Debug.Log("WATER_GRAB_DEBUG distance="+Vector3.Distance(player.transform.position,climb.position)+
                " grounded="+player.Grounded+" uiBlocked="+NotebookUI.BlocksInput);
            Check(trial.TryClimb(),"Climbing grips begin from mountain base");
            yield return new WaitForSeconds(.5f);
            Check(traversal.IsHanging&&traversal.HoldIndex==0,"Grab enters a held cliff state without skipping the wall");
            Check(!traversal.TryAdvance(MountainClimbController.ClimbAction.Mantle),"Cannot mantle through the cliff from a low grip");
            Check(!traversal.TryLeap(Vector2.one,1),"Cannot leap outside the authored gap");
            CheckContacts("first grip");
            trial.RefreshHud();yield return null;
            Check(trial.MissionVisible&&!entrancePrompt.PromptVisible,"Cliff instructions replace unrelated weight temple prompt");
            orbit.Snap();
            Check(orbit.ClimbAssistActive,"Hanging activates outward cliff camera");
            CheckFraming(player.transform.position+trial.transform.up*.8f,"Climber remains framed");
            CheckFraming(traversal.GuidanceTarget,"Next handhold remains framed");
            Capture("climb-assisted-camera",orbit.transform.position,orbit.transform.position+orbit.transform.forward*6);
            orbit.NotifyManualOrbit();Check(!orbit.ClimbAssistActive,"Manual orbit suspends camera assistance");
            yield return new WaitForSecondsRealtime(2.1f);
            Check(orbit.ClimbAssistActive,"Camera assistance resumes after manual orbit pause");
            Capture("climb-contact-close",traversal.Holds[0].position+trial.transform.right*2-trial.transform.forward*3,player.transform.position+trial.transform.up*.85f);
            Capture("water-mountain-first-grip",climb.position+trial.transform.right*5+trial.transform.up*4-trial.transform.forward*9,traversal.Holds[2].position);
            foreach(var action in new[]{MountainClimbController.ClimbAction.Up,MountainClimbController.ClimbAction.Up,
                MountainClimbController.ClimbAction.Right,MountainClimbController.ClimbAction.Right,
                MountainClimbController.ClimbAction.Up})
            {Check(traversal.TryAdvance(action),"Authored contact transition "+action);yield return WaitForMotion();CheckContacts("grip "+traversal.HoldIndex);}
            Check(traversal.HoldIndex==5,"Horizontal overhang traversal reaches the leap contact");
            traversal.PrepareLeap(.175f,true);trial.RefreshHud();
            Check(Mathf.Abs(trial.VisiblePreparation-.5f)<.01f,"Leap bar displays half preparation");
            traversal.PrepareLeap(.175f);trial.RefreshHud();orbit.Snap();
            Check(trial.VisiblePreparation==1,"Leap bar marks fully prepared jump");
            CheckFraming(traversal.GuidanceTarget,"Opposite leap grip remains framed");
            Capture("climb-leap-ready",orbit.transform.position,orbit.transform.position+orbit.transform.forward*6);
            Check(!traversal.TryAdvance(MountainClimbController.ClimbAction.Up),"Broken reach requires a deliberate leap");
            Check(!traversal.TryAdvance(MountainClimbController.ClimbAction.Leap),"Single button leap cannot bypass preparation");
            Check(!traversal.TryLeap(Vector2.left,.6f),"Wrong direction misses the opposite grip");
            yield return new WaitForSeconds(.65f);
            trial.RefreshHud();Check(trial.VisiblePreparation==0&&!orbit.ClimbAssistActive,"Failed leap clears preparation and camera assistance");
            Check(!traversal.IsHanging&&!traversal.ReachedFirstLedge&&Vector3.Distance(player.transform.position,climb.position)<.6f,"Missed leap returns to base without advancing progress");
            yield return ReachGap();
            Check(!traversal.TryLeap(Vector2.one,.1f),"Short preparation fails fairly");
            yield return new WaitForSeconds(.65f);
            Check(!traversal.IsMoving&&player.enabled,"Missed leap restores control");
            yield return ReachGap();
            var leapStart=player.transform.position;
            Check(traversal.TryLeap(Vector2.one,.5f),"Prepared directional jump launches between separated handholds");
            Check(!traversal.TryLeap(Vector2.one,.5f),"Duplicate leap rejected while moving");
            yield return new WaitForSeconds(.20f);
            Check(Vector3.Distance(player.transform.position,leapStart)>.15f&&traversal.IsMoving,"Leap moves through the air instead of snapping to destination");
            yield return new WaitForSeconds(.47f);
            Check(traversal.HoldIndex==6,"Jump catches the opposite rock grip");
            Check(traversal.TryAdvance(MountainClimbController.ClimbAction.Up),"Final first-wall reach advances");yield return WaitForMotion();
            Check(traversal.TryAdvance(MountainClimbController.ClimbAction.Mantle),"Mantle starts only at a safe ledge");
            yield return new WaitForSeconds(.35f);
            Capture("climb-mantle-pull",traversal.Holds[7].position+trial.transform.right*2.5f-trial.transform.forward*3,player.transform.position+trial.transform.up*.8f);
            yield return WaitForMotion();
            Check(traversal.ReachedFirstLedge&&!traversal.IsHanging,"Mantle restores normal walking on first shelf");
            Check(!player.GetComponentInChildren<NavigatorPose>().HasClimbContacts,"Mantle releases the contact pose for normal locomotion");
            Check(Vector3.Distance(player.transform.position,traversal.Walk[0].position)<.5f,"First shelf matches Blender path anchor");
            Check(surface.PointBelow(traversal.Walk[2].position+trial.transform.up*.35f,traversal.Walk[2].position.magnitude+.4f).magnitude>climb.position.magnitude+5,
                "Carved upper path has fitted walkable collision");
            Check(Vector3.Distance(traversal.SafePosition,traversal.Walk[0].position)<.01f,"First mantle records the first shelf, not an unvisited upper checkpoint");
            player.enabled=false;player.ElevatedTraversal=true;
            for(int waypoint=1;waypoint<=4;waypoint++)
            {
                var target=traversal.Walk[waypoint].position;
                for(int frame=0;frame<420;frame++)
                {
                    var delta=Vector3.ProjectOnPlane(target-player.transform.position,player.Up);
                    if(delta.magnitude<.28f)break;
                    player.Step(delta.normalized,false,false,1f/60f);traversal.RecordSafeFooting();
                }
                Debug.Log("WATER_PATH "+waypoint+" local="+trial.transform.InverseTransformPoint(player.transform.position)+" target="+trial.transform.InverseTransformPoint(target));
                Capture("water-path-"+waypoint,trial.transform.TransformPoint(new Vector3(12,12,-9)),player.transform.position+trial.transform.up);
                Check(Vector3.Distance(player.transform.position,target)<.8f,"Physical traversal reaches shelf "+waypoint);
            }
            Check(Vector3.Distance(traversal.SafePosition,traversal.Walk[2].position)<.01f,"Middle checkpoint requires actual arrival");
            Capture("water-mountain-narrow-route",trial.transform.TransformPoint(new Vector3(12,12,-9)),player.transform.position+trial.transform.up);
            player.enabled=false;player.Respawn(traversal.Walk[4].position,traversal.Walk[5].position-traversal.Walk[4].position);
            Check(traversal.TryUpperGrab(),"Summit requires a second jump-to-grab");yield return new WaitForSeconds(.46f);
            Check(traversal.HoldIndex==8,"Upper grip is caught beside the summit");
            CheckContacts("upper wall");
            traversal.Release();
            Check(Vector3.Distance(player.transform.position,traversal.Walk[2].position)<.8f,"Release returns to visited middle shelf without skipping ahead");
            player.enabled=false;player.Respawn(traversal.Walk[4].position,trial.transform.forward);
            Check(traversal.TryUpperGrab(),"Upper grip remains retryable");yield return new WaitForSeconds(.46f);
            Check(traversal.TryAdvance(MountainClimbController.ClimbAction.Up),"Upper wall needs another climb contact");yield return WaitForMotion();
            CheckContacts("summit lip");
            Check(traversal.TryAdvance(MountainClimbController.ClimbAction.Mantle),"Summit pull-up begins");yield return WaitForMotion();
            Check(traversal.ReachedSummit&&!traversal.IsHanging,"Summit pull-up restores exploration control");
            player.enabled=false;orbit.enabled=true;
            Check(trial.TryDiscoverSummit()&&orbit.RevealActive,"First summit arrival reveals the solar mirror");
            Check(!trial.TryDiscoverSummit(),"Discovery cannot restart while already presented");
            yield return new WaitForSecondsRealtime(1.1f);
            trial.RefreshHud();CheckFraming(summit.position,"Discovery frames the solar mirror");
            // The capture keeps this pose; disabling the component must cancel its reveal state.
            Capture("summit-discovery",orbit.transform.position,orbit.transform.position+orbit.transform.forward*6);
            Check(!orbit.RevealActive,"Disabling the camera cancels discovery safely");
            orbit.RevealLandmark(orbit.transform.position,summit.position,ice.position);
            yield return new WaitForSecondsRealtime(3.3f);
            Check(!orbit.RevealActive,"Discovery returns to normal camera automatically");
            orbit.RevealLandmark(orbit.transform.position,summit.position,ice.position);
            player.transform.position+=trial.transform.right*.25f;yield return null;
            Check(!orbit.RevealActive,"Player movement cancels discovery without locking control");
            player.transform.position-=trial.transform.right*.25f;
            Check(!trial.TryDiscoverSummit()&&trial.SummitDiscovered,"Returning to summit does not repeat discovery this visit");
            orbit.RevealLandmark(orbit.transform.position,summit.position,ice.position);
            var up=summit.position.normalized;
            player.enabled=false;Physics.SyncTransforms();
            Check(trial.TryAim(),"Mirror becomes controllable at summit");
            Check(!orbit.RevealActive,"Mirror interaction immediately ends discovery camera");
            Capture("water-mountain-overview",trial.transform.TransformPoint(new Vector3(7,17,-37)),trial.transform.TransformPoint(new Vector3(9,4,2)));
            trial.RotateAim(34,-10);trial.ToggleBeam();Physics.SyncTransforms();trial.TickBeam(.2f);
            Check(trial.BeamHitsIce,"Correct mirror angle sends beam into glacial gate (hit: "+trial.BeamObstacle+")");
            Check(trial.Melt>0,"Sunlight begins changing ice to water");
            trial.TickBeam(.9f);
            Check(trial.Thaw.SealVisible&&trial.Thaw.SurfaceMelt>.3f&&trial.Thaw.SurfaceMelt<.8f,"Melt opens the center before the outer ice disappears");
            Check(Vector3.Distance(frozenBounds.size,trial.IceBounds.size)<.001f,"Melting visuals preserve the sunlight receiver area");
            Capture("water-thaw-midway",ice.position+(summit.position-ice.position).normalized*10+up*1.2f,ice.position);
            Capture("water-mirror-beam",summit.position+up*4-trial.transform.right*8-trial.transform.forward*9,
                Vector3.Lerp(summit.position,ice.position,.55f));
            trial.TickBeam(2.5f);
            Check(trial.EntranceOpen,"Sustained sunlight reveals temple entrance");
            Check(!trial.Thaw.SealVisible,"Completed thaw hides the continuous doorway ice");
            Check(orbit.RevealActive,"Thaw completion reveals the newly opened entrance");
            Check(sanctuary!=null&&sanctuary.gameObject.activeInHierarchy,"Outer glacier remains after doorway thaw");
            Check(WaterApproachProgress.Current.EntranceOpen,"Melted entrance is stored locally");
            Capture("water-temple-thawed",ice.position+up*1.2f+(summit.position-ice.position).normalized*9,ice.position);
            player.enabled=false;player.ElevatedTraversal=true;
            var temple=sanctuary.parent;
            player.Respawn(temple.TransformPoint(new Vector3(0,0,-3.2f)),temple.forward);
            Physics.SyncTransforms();
            for(int step=0;step<240&&temple.InverseTransformPoint(player.transform.position).z<.3f;step++)
                player.Step(temple.forward,false,false,1f/60f);
            var entered=temple.InverseTransformPoint(player.transform.position);
            Check(entered.z>.1f&&entered.y>1f,"Player walks up glacier stairs to opened threshold: "+entered);
            Capture("water-temple-approach",temple.TransformPoint(new Vector3(7,5,-12)),temple.TransformPoint(new Vector3(0,3,0)),temple.up);
            Capture("water-temple-ground-front",temple.TransformPoint(new Vector3(0,1.6f,-12)),temple.TransformPoint(new Vector3(0,2.7f,0)),temple.up);
            Capture("water-temple-ground-side",temple.TransformPoint(new Vector3(12,1.6f,-6)),temple.TransformPoint(new Vector3(0,2,1)),temple.up);
            player.enabled=false;player.Respawn(originalPosition,trial.transform.forward);trial.RefreshHud();yield return null;
            Check(!trial.MissionVisible&&entrancePrompt.PromptVisible,"Leaving water area restores exploration prompt");
            var doorway=trial.EntranceTarget;
            player.Respawn(surface.Point(doorway.TransformPoint(new Vector3(0,-1f,-1.6f))),doorway.forward);
            player.enabled=true;Physics.SyncTransforms();
            var atDoor=doorway.InverseTransformPoint(player.transform.position);
            Check(player.Grounded&&Mathf.Abs(atDoor.x)<1.6f&&atDoor.z> -3f&&atDoor.z<.8f&&Mathf.Abs(atDoor.y)<2.3f,
                "Player stands at the thawed water doorway for entry validation: "+atDoor);
            Check(trial.CanEnter,"Thawed water doorway offers E entry before temple completion");
            var observer=new GameObject("Water first-room entry validation").AddComponent<WaterEntrySmoke>();
            DontDestroyOnLoad(observer.gameObject);
            observer.Configure(trial,checks,output);
            entryObserverOwnsResult=true;
        }
        void CheckFraming(Vector3 point,string label)
        {
            var viewport=orbit.GetComponent<Camera>().WorldToViewportPoint(point);
            Check(viewport.z>0&&viewport.x>.08f&&viewport.x<.92f&&viewport.y>.08f&&viewport.y<.92f,label);
        }
        IEnumerator ReachGap()
        {
            Check(trial.TryClimb(),"Retry can grab the first contact");yield return new WaitForSeconds(.5f);
            foreach(var action in new[]{MountainClimbController.ClimbAction.Up,MountainClimbController.ClimbAction.Up,
                MountainClimbController.ClimbAction.Right,MountainClimbController.ClimbAction.Right,MountainClimbController.ClimbAction.Up})
            {Check(traversalAdvance(action),"Retry climb advances "+action);yield return WaitForMotion();}
        }
        IEnumerator WaitForMotion()
        {
            float start=Time.realtimeSinceStartup;
            while(trial.Climbing.IsMoving&&Time.realtimeSinceStartup-start<5)yield return null;
            Check(!trial.Climbing.IsMoving,"Climb motion completes within bounded time");
        }
        bool traversalAdvance(MountainClimbController.ClimbAction action)=>trial.Climbing.TryAdvance(action);
        void CheckContacts(string label)
        {
            var pose=player.GetComponentInChildren<NavigatorPose>();pose.Apply();
            Debug.Log("CLIMB_CONTACT "+label+" hands="+pose.ClimbHandError+" feet="+pose.ClimbFootError+" supportedFeet="+pose.SupportedClimbFeet);
            Check(pose.HasClimbContacts&&pose.ClimbHandError<.09f,"Hands settle on authored grip: "+label);
            Check(pose.ClimbFootError<.13f,"Reachable feet brace against sampled rock ("+pose.SupportedClimbFeet+"): "+label);
            if(label=="first grip")Check(pose.SupportedClimbFeet>0,"First grip offers actual reachable footing");
            float before=pose.ClimbHandError;for(int i=0;i<8;i++)pose.Apply();
            Check(pose.ClimbHandError<.09f&&Mathf.Abs(pose.ClimbHandError-before)<.01f,"Contact solve does not accumulate drift: "+label);
        }
    }
}
