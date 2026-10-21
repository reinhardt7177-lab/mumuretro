using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using UnityEngine;

namespace Mumu.Planet
{
    public sealed class WaterCollectionRoomSmoke : MonoBehaviour
    {
        [Serializable] sealed class Result{public bool passed;public string error;public List<string> checks=new List<string>();}
        Result result=new Result();WaterCollectionRoom room;WaterBraceletLab ability;PlanetExplorer player;string output;
        void Check(bool value,string name){if(!value)throw new Exception(name);result.checks.Add(name);}
        void Tick(float dt)
        {ability.AdvanceUse(dt);room.TickFlow(dt);foreach(var t in ability.targets)t.Present(false);Physics.SyncTransforms();room.TickWorld(dt);Physics.SyncTransforms();}
        void Wait(int count=180){for(int i=0;i<count;i++)Tick(.02f);}
        void Move(Vector3 direction,int count,bool run=false,bool jump=false)
        {for(int i=0;i<count;i++){player.Step(direction,run,jump&&i==0,.02f);Tick(.02f);}}
        void Place(Vector3 point){player.Respawn(point,Vector3.forward);player.transform.position=point;}
        void Upper(){Place(new Vector3(-4,2.4f,3.6f));}
        void Use(WaterBraceletTarget target,bool heat){Check(ability.BeginUse(target,heat),"Begin "+target.displayName+(heat?" heat":" cool"));Wait();ability.Cancel();}
        void Pump(){Place(new Vector3(4,0,-3.5f));Check(room.TryInteract(),"recovery pump usable");}
        IEnumerator Start()
        {
            var args=Environment.GetCommandLineArgs();
            if(Array.IndexOf(args,"-mumu-smoke")>=0){UnityEngine.SceneManagement.SceneManager.LoadScene("PlanetExploration");yield break;}
            if(Array.IndexOf(args,"-mumu-bracelet-smoke")>=0){UnityEngine.SceneManagement.SceneManager.LoadScene("WaterBraceletLab");yield break;}
            int index=Array.IndexOf(args,"-mumu-collection-smoke");if(index<0||index+1>=args.Length)yield break;
            output=args[index+1];Directory.CreateDirectory(output);for(int i=0;i<18;i++)yield return null;
            room=GetComponent<WaterCollectionRoom>();ability=GetComponent<WaterBraceletLab>();player=ability.player;room.enabled=false;ability.enabled=false;player.enabled=false;
            try{Validate();result.passed=true;}catch(Exception e){result.error=e.ToString();Debug.LogException(e);}
            File.WriteAllText(Path.Combine(output,"result.json"),JsonUtility.ToJson(result,true));Application.Quit(result.passed?0:1);
        }
        void Validate()
        {
            room.RestoreProgress(false,false,1.8f);room.collector.Restore(0,0,0,1);room.boiler.Restore(0,0,4,0);
            room.TickFlow(2);room.TickWorld(0);
            Check(Mathf.Abs(room.tank.Water.liquid-1.5f)<.01f&&Mathf.Abs(room.recovery.Water.liquid-1.5f)<.01f,"edge alignment splits condensate between receiver and recovery");
            Check(Mathf.Abs(ability.TotalWater-4)<.001f&&!room.BridgeLatched,"partial overlap preserves mass without premature bridge");
            Check(room.drops.enabled&&room.returnFlow.enabled&&room.FlowFeedback.Contains("일부"),"missed droplets expose recoverable cause");
            Check(Vector3.Distance(room.steam.GetPosition(room.steam.positionCount-1),room.collector.transform.position+Vector3.up*.15f)<.01f,"steam endpoint follows moving collector");
            room.RestoreProgress(false,false,-2.5f);room.collector.Restore(0,0,0,0);room.boiler.Restore(0,4,0,0);room.tank.Restore(0,0,0,0);room.recovery.Restore(0,0,0,0);
            Tick(0);Check(Mathf.Abs(ability.TotalWater-4)<.001f,"initial four mass units");
            Check(!room.bridgeSupport.enabled,"exit bridge starts below gap without support");
            Place(new Vector3(-3,0,-4.5f));Check(ability.TryAcquire(),"bracelet obtainable before stairs");
            Check(room.Objective.Contains("냉각"),"warm plate guides cooling before boiling");
            Capture("guide-cooling");
            Place(new Vector3(-4,0,4.2f));Check(!room.TryInteract(),"cannot grab upper control from below");
            Place(new Vector3(-6,0,-3.3f));Move(Vector3.forward,91);
            Check(player.Grounded&&player.transform.position.y>2.35f&&room.GalleryVisited,"fixed stairs reach gallery before puzzle completion: "+player.transform.position);
            Move(Vector3.forward,18);Move(Vector3.right,30);
            Check(room.TryInteract()&&room.Adjusting&&player.InputLocked,"grab collector locks locomotion");
            float start=room.RailX;room.Shift(1,.1f);
            Check(room.RailX>start&&room.RailX<start+.2f,"collector moves continuously rather than preset slots");
            Check(!ability.BeginUse(room.collector,false),"holding control prevents simultaneous ability casting");
            room.Release();Check(!player.InputLocked,"release restores locomotion input");
            Place(new Vector3(-.7f,2.4f,5.99f));int rescues=room.Rescues;
            for(int i=0;i<160&&room.Rescues==rescues;i++){player.Step(Vector3.forward,true,i==0,.02f);Tick(.02f);}
            Check(room.Rescues>rescues&&!room.Completed,"running jump cannot bypass exit gap");
            Check(player.Grounded&&player.transform.position.y>2.35f,"fall returns to visited upper safe bank");
            Place(new Vector3(1,0,-4));Use(room.boiler,true);Wait();
            Check(room.recovery.Water.liquid>3.999f&&!room.BridgeLatched,"warm plate sends all vapour to recovery");Pump();
            Upper();Use(room.collector,false);Check(room.collector.Cold==1&&!room.Aligned,"cold plate can still be misaligned");
            room.TickWorld(0);Check(room.preview.enabled&&room.Objective.Contains("손잡이"),"cold misaligned plate shows landing line and handle objective");
            Capture("guide-misaligned");
            Place(new Vector3(1,0,-4));Use(room.boiler,true);Wait();
            Check(room.tank.Water.liquid<.001f&&room.recovery.Water.liquid>3.999f,"misaligned cold plate misses receiver without mass loss");Pump();
            Upper();Check(room.TryInteract(),"grab plate after cooling");room.Shift(-1,99);Check(room.RailX== -3,"left rail stop");room.Shift(1,99);Check(room.RailX==2,"right rail stop");room.Shift(-1,1/1.3f);
            Check(room.Aligned&&room.collector.Cold==1,"alignment adjustment preserves prepared cold");
            var notebook=FindFirstObjectByType<NotebookUI>();notebook.TryOpen();float before=room.RailX;room.Shift(1,.5f);room.TickControls(.02f);
            Check(NotebookUI.BlocksInput&&room.RailX==before&&!room.Adjusting&&!player.InputLocked,"notebook interrupts adjustment without trapping movement");notebook.Close();
            Check(room.TryInteract(),"control can be grabbed again after notebook");
            Capture("collector-aligned");
            room.Release();
            room.TickWorld(0);Check(room.preview.enabled&&room.Objective.Contains("기화"),"aligned cold plate keeps landing line after release and guides heating");
            room.boiler.Restore(0,0,0,0);room.recovery.Restore(0,4,0,0);
            Check(room.Objective.Contains("회수 펌프"),"empty boiler with recovered water guides pumping");
            Capture("guide-recovery");Pump();
            Place(new Vector3(1,0,-4));Check(ability.BeginUse(room.boiler,true),"start partial successful collection");Wait(30);ability.Cancel();Wait(30);
            Check(room.tank.Water.liquid>1&&room.tank.Water.liquid<2&&!room.BridgeLatched,"partial collection visibly fills tank but does not unlock bridge");
            Check(Mathf.Abs(room.tank.surface.bounds.min.y-2.8f)<.01f,"water level rises from fixed basin bottom");
            Check(room.Hint.Contains("집수 ")&&room.Hint.Contains("%"),"partial receiver reports progress against bridge threshold");
            Capture("guide-collecting");
            Use(room.boiler,true);Wait();Check(room.BridgeLatched&&room.bridgeSupport.enabled,"full receiver lifts and mechanically locks bridge");
            Check(!room.preview.enabled&&room.Objective.Contains("다리 고정"),"latched bridge hides setup guide and directs exit");
            Check(Mathf.Abs(room.exitBridge.position.y-2.25f)<.001f,"bridge top matches upper walking datum");
            Check(Mathf.Abs(ability.TotalWater-4)<.001f,"warm failure misalignment and retry conserve all water");
            Upper();Use(room.collector,true);Check(room.BridgeLatched&&room.bridgeSupport.enabled,"locked bridge remains safe after plate reheats");
            Place(new Vector3(-.7f,2.4f,5.9f));Move(Vector3.forward,110);
            Check(room.Completed&&player.Grounded&&player.transform.position.z>12,"player crosses raised bridge and completes collection room");
            Capture("collection-complete");
        }
        void Capture(string name)
        {
            var camera=ability.view;camera.GetComponent<OrbitCamera>().enabled=false;
            var position=new Vector3(5.5f,3.7f,-5.9f);camera.transform.SetPositionAndRotation(position,Quaternion.LookRotation(new Vector3(-.8f,2.9f,4)-position));
            ability.RefreshHud();room.TickWorld(0);
            var canvases=FindObjectsByType<Canvas>(FindObjectsSortMode.None);foreach(var c in canvases){c.renderMode=RenderMode.ScreenSpaceCamera;c.worldCamera=camera;c.planeDistance=.5f;}
            Canvas.ForceUpdateCanvases();var rt=new RenderTexture(1440,900,24);rt.Create();camera.targetTexture=rt;camera.Render();var old=RenderTexture.active;RenderTexture.active=rt;
            var image=new Texture2D(1440,900,TextureFormat.RGB24,false);image.ReadPixels(new Rect(0,0,1440,900),0,0);image.Apply();File.WriteAllBytes(Path.Combine(output,name+".png"),image.EncodeToPNG());camera.targetTexture=null;RenderTexture.active=old;rt.Release();Destroy(rt);Destroy(image);
            foreach(var c in canvases)c.renderMode=RenderMode.ScreenSpaceOverlay;
        }
    }
}
