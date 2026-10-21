using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using UnityEngine;

namespace Mumu.Planet
{
    public sealed class WaterIceRoomSmoke : MonoBehaviour
    {
        [Serializable] sealed class Result {public bool passed;public string error;public List<string> checks=new List<string>();}
        Result result=new Result();string output;WaterIceRoom room;WaterBraceletLab ability;PlanetExplorer player;
        void Check(bool value,string name){if(!value)throw new Exception(name);result.checks.Add(name);}
        void Tick(float dt)
        {ability.AdvanceUse(dt);room.TickFlow(dt);foreach(var target in ability.targets)target.Present(false);Physics.SyncTransforms();room.TickTraversal(dt);Physics.SyncTransforms();}
        void Move(Vector3 direction,int frames,bool run=false,bool jump=false)
        {for(int i=0;i<frames;i++){player.Step(direction,run,jump&&i==0,.02f);Tick(.02f);}}
        void Use(WaterBraceletTarget target,bool heat)
        {Check(ability.BeginUse(target,heat),"Begin "+target.displayName+(heat?" heat":" cool"));for(int i=0;i<180;i++)Tick(.02f);ability.Cancel();}
        IEnumerator Start()
        {
            var args=Environment.GetCommandLineArgs();
            if(Array.IndexOf(args,"-mumu-smoke")>=0){UnityEngine.SceneManagement.SceneManager.LoadScene("PlanetExploration");yield break;}
            int index=Array.IndexOf(args,"-mumu-ice-smoke");if(index<0||index+1>=args.Length)yield break;
            output=args[index+1];Directory.CreateDirectory(output);for(int i=0;i<18;i++)yield return null;
            room=GetComponent<WaterIceRoom>();ability=GetComponent<WaterBraceletLab>();player=ability.player;
            room.enabled=false;ability.enabled=false;player.enabled=false;
            try{Validate();result.passed=true;}catch(Exception e){result.error=e.ToString();Debug.LogException(e);}
            File.WriteAllText(Path.Combine(output,"result.json"),JsonUtility.ToJson(result,true));Application.Quit(result.passed?0:1);
        }
        void Validate()
        {
            Tick(0);Check(!room.trough.iceSupport.enabled&&!room.bridgeSupport.enabled,"empty gap has no hidden support");
            Check(room.CurrentStep==WaterIceStep.Acquire,"entry guidance asks for bracelet before power controls");
            Capture("guide-entry",new Vector3(4.7f,3.6f,-5.5f),new Vector3(-1,1,1));
            Check(!room.TryInteract()&&!room.DoorOpen,"door starts locked");
            player.Respawn(new Vector3(0,0,-2),Vector3.forward);Move(Vector3.forward,10);
            Check(player.Grounded&&Mathf.Abs(player.transform.position.y)<.01f,"ordinary bank walking stays grounded");
            Move(Vector3.zero,50,false,true);Check(player.Grounded,"bank jump lands on real support");
            int rescues=room.Rescues;player.Respawn(new Vector3(0,0,-.1f),Vector3.forward);
            for(int i=0;i<140&&room.Rescues==rescues;i++){player.Step(Vector3.forward,true,i==0,.02f);Tick(.02f);}
            Check(room.Rescues>rescues&&!room.BridgeLatched,"running jump cannot bypass five metre gap");
            Check(player.transform.position.z<0&&player.Grounded,"failed jump returns to entry checkpoint");
            player.Respawn(new Vector3(-3,0,-4.5f),Vector3.forward);Check(ability.TryAcquire(),"bracelet obtainable without crossing");
            Check(room.CurrentStep==WaterIceStep.Melt,"acquisition points to frozen supply");
            player.Respawn(new Vector3(-3,0,-3),Vector3.forward);Use(room.supply,true);
            Check(room.trough.Water.liquid>3.999f&&room.supply.Water.Total<.001f,"melted reservoir fills connected trough");
            Check(Mathf.Abs(ability.TotalWater-4)<.001f,"fill conserves water");
            Capture("crossing-water",new Vector3(4.7f,3.6f,-5.5f),new Vector3(0,1.5f,3.7f));
            player.Respawn(new Vector3(0,0,-1),Vector3.forward);
            Check(ability.BeginUse(room.trough,false),"partial freeze starts");Tick(.25f);ability.Cancel();
            Check(room.trough.Water.ice>0&&!room.trough.iceSupport.enabled,"partial ice cannot support full bridge");
            Check(room.CurrentStep==WaterIceStep.Freeze,"partial ice retains cooling objective rather than crossing");
            Check(ability.BeginUse(room.trough,false),"continue partial freeze");Tick(.75f);ability.Cancel();
            var phaseVisual=new MaterialPropertyBlock();room.trough.surface.GetPropertyBlock(phaseVisual);
            Check(phaseVisual.GetFloat("_Frozen")>.45f&&phaseVisual.GetFloat("_Frozen")<.55f&&phaseVisual.GetFloat("_SolidReady")==0,"half-frozen visual never marks an unsafe crossing as ready");
            Capture("crossing-half-frozen",new Vector3(4.7f,3.6f,-5.5f),new Vector3(0,1.5f,3.7f));
            Use(room.trough,false);Check(room.trough.iceSupport.enabled,"complete ice supports crossing");
            Check(room.CurrentStep==WaterIceStep.Cross&&room.GuidePosition.z>5,"ready crossing points to safe far landing");
            room.trough.surface.GetPropertyBlock(phaseVisual);Check(phaseVisual.GetFloat("_SolidReady")==1,"continuous ready edge follows actual support activation");
            Capture("ice-ready",new Vector3(4.7f,3.6f,-5.5f),new Vector3(0,1.5f,3.7f));
            Capture("gate-detail",new Vector3(2.2f,2.5f,5.8f),new Vector3(0,1.55f,10));
            player.Respawn(new Vector3(0,0,-.5f),Vector3.forward);Move(Vector3.forward,45);
            Check(player.Grounded&&player.transform.position.z>2&&player.transform.position.z<3,"player stands on ice above actual gap");
            Check(ability.BeginUse(room.trough,true),"melt from ice begins");Tick(.15f);ability.Cancel();
            room.trough.surface.GetPropertyBlock(phaseVisual);Check(phaseVisual.GetFloat("_SolidReady")==0,"heating immediately removes the ready indication with support");
            Capture("crossing-thawing",new Vector3(4.7f,3.6f,-5.5f),new Vector3(0,1.5f,3.7f));
            rescues=room.Rescues;Move(Vector3.zero,70);
            Check(room.Rescues>rescues&&!room.BridgeLatched,"melting support causes fall and safe return");
            Check(Mathf.Abs(ability.TotalWater-4)<.001f,"fall does not discard puzzle water");
            player.Respawn(new Vector3(0,0,-.5f),Vector3.forward);Use(room.trough,false);Move(Vector3.forward,108);
            Check(room.BridgeLatched&&player.Grounded&&player.transform.position.z>5.65f,"walking across ice latches far landing");
            Move(Vector3.zero,60);Check(room.bridgeSupport.enabled,"return stone bridge lowers and locks");
            Use(room.trough,true);Check(!room.trough.iceSupport.enabled,"ice can melt after crossing");
            player.Respawn(new Vector3(-4,0,6.3f),Vector3.back);Move(Vector3.back,110);
            Check(player.Grounded&&player.transform.position.z<0,"permanent bridge returns safely over melted gap");
            player.Respawn(new Vector3(0,0,-1),Vector3.forward);Use(room.trough,true);
            Check(room.recovery.Water.liquid>3.999f,"accidental evaporation is captured for recovery");
            room.RestoreProgress(false,false,false);
            Check(!room.bridgeSupport.enabled&&room.gateBlock.enabled,"restoring an earlier stage resets physical bridge and gate too");
            Check(room.CurrentStep==WaterIceStep.Recover,"evaporated water redirects guidance to recovery pump");
            Capture("guide-recovery",new Vector3(4.7f,3.6f,-5.5f),new Vector3(-1,1,1));
            room.RestoreProgress(true,false,false);
            player.Respawn(new Vector3(-5,0,-4.5f),Vector3.forward);Check(room.TryInteract(),"nearby recovery pump responds");
            for(int i=0;i<120;i++)Tick(.02f);
            Check(room.trough.Water.liquid>3.999f&&Mathf.Abs(ability.TotalWater-4)<.001f,"pump refills trough without duplication");
            player.Respawn(new Vector3(0,0,8),Vector3.forward);Move(Vector3.forward,40);
            Check(player.transform.position.z<9.7f&&!room.Completed,"closed exit gate blocks movement");
            Check(room.TryInteract()&&room.DoorOpen,"far gate interaction opens unlocked door");
            Check(room.gateCeremony!=null&&room.gateCeremony.source.clip!=null,"gate ceremony and sound are connected");
            Tick(.1f);Capture("gate-awakening-core",new Vector3(2.2f,2.5f,5.8f),new Vector3(0,1.55f,10));
            Tick(.35f);Capture("gate-awakening-rim",new Vector3(2.2f,2.5f,5.8f),new Vector3(0,1.55f,10));
            Check(room.gateBlock.enabled&&Mathf.Abs(room.gate.localPosition.y-1.5f)<.001f,"seal awakens before gate moves and keeps collision");
            room.TryInteract();Tick(.6f);
            Check(room.gateCeremony.CueCount==1&&room.gateBlock.enabled&&room.gate.localPosition.y>1.5f,"repeat interaction does not replay cue while gate rises");
            Capture("gate-rising",new Vector3(2.2f,2.5f,5.8f),new Vector3(0,2.3f,10));
            Move(Vector3.zero,65);Move(Vector3.forward,45);
            Check(room.Completed,"walking through open gate completes first room");
            room.RestoreProgress(true,true,true);Tick(0);
            Check(room.gateCeremony.CueCount==1&&room.gateCeremony.Progress==1&&!room.gateBlock.enabled,"restored open gate stays open without replaying sound");
            Capture("room-complete",new Vector3(4.7f,4.0f,-5.5f),new Vector3(0,1.7f,4));
        }
        void Capture(string name,Vector3 position,Vector3 focus)
        {
            var cam=ability.view;var orbit=cam.GetComponent<OrbitCamera>();orbit.enabled=false;
            cam.transform.SetPositionAndRotation(position,Quaternion.LookRotation(focus-position));
            ability.RefreshHud();var guide=room.GetComponent<WaterIceGuide>();if(guide)guide.Refresh();
            var canvases=FindObjectsByType<Canvas>(FindObjectsSortMode.None);foreach(var c in canvases){c.renderMode=RenderMode.ScreenSpaceCamera;c.worldCamera=cam;c.planeDistance=.5f;}
            Canvas.ForceUpdateCanvases();var rt=new RenderTexture(1440,900,24);rt.Create();cam.targetTexture=rt;cam.Render();var previous=RenderTexture.active;RenderTexture.active=rt;
            var image=new Texture2D(1440,900,TextureFormat.RGB24,false);image.ReadPixels(new Rect(0,0,1440,900),0,0);image.Apply();File.WriteAllBytes(Path.Combine(output,name+".png"),image.EncodeToPNG());
            cam.targetTexture=null;RenderTexture.active=previous;rt.Release();Destroy(rt);Destroy(image);foreach(var c in canvases)c.renderMode=RenderMode.ScreenSpaceOverlay;
        }
    }
}
