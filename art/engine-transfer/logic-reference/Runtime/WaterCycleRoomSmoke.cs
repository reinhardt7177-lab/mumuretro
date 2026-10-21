using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using UnityEngine;

namespace Mumu.Planet
{
    public sealed class WaterCycleRoomSmoke : MonoBehaviour
    {
        [Serializable] sealed class Result {public bool passed;public string error;public List<string> checks=new List<string>();}
        Result result=new Result();string output;WaterCycleRoom cycle;WaterIceRoom crossing;WaterBraceletLab ability;PlanetExplorer player;
        void Check(bool condition,string name){if(!condition)throw new Exception(name);result.checks.Add(name);}
        void Tick(float dt)
        {ability.AdvanceUse(dt);cycle.TickFlow(dt);foreach(var t in ability.targets)t.Present(false);Physics.SyncTransforms();crossing.TickTraversal(dt);Physics.SyncTransforms();}
        void Wait(int frames=180){for(int i=0;i<frames;i++)Tick(.02f);}
        void Move(Vector3 direction,int frames)
        {for(int i=0;i<frames;i++){player.Step(direction,false,false,.02f);Tick(.02f);}}
        void Use(WaterBraceletTarget target,bool heat)
        {Check(ability.BeginUse(target,heat),"Begin "+target.displayName+(heat?" heat":" cool"));Wait();ability.Cancel();}
        IEnumerator Start()
        {
            var args=Environment.GetCommandLineArgs();
            if(Array.IndexOf(args,"-mumu-ice-smoke")>=0){UnityEngine.SceneManagement.SceneManager.LoadScene("WaterIceRoom");yield break;}
            int index=Array.IndexOf(args,"-mumu-cycle-smoke");if(index<0||index+1>=args.Length)yield break;
            output=args[index+1];Directory.CreateDirectory(output);for(int i=0;i<18;i++)yield return null;
            cycle=GetComponent<WaterCycleRoom>();crossing=GetComponent<WaterIceRoom>();ability=GetComponent<WaterBraceletLab>();player=ability.player;
            crossing.enabled=false;ability.enabled=false;player.enabled=false;
            try{Validate();result.passed=true;}catch(Exception e){result.error=e.ToString();Debug.LogException(e);}
            File.WriteAllText(System.IO.Path.Combine(output,"result.json"),JsonUtility.ToJson(result,true));Application.Quit(result.passed?0:1);
        }
        void Validate()
        {
            Wait();Check(Mathf.Abs(ability.TotalWater-6)<.001f,"finite initial mass is six");
            Check(Mathf.Abs(crossing.trough.Water.liquid-4)<.001f&&Mathf.Abs(crossing.supply.Water.liquid-2)<.001f,"four units in crossing and only two remain");
            player.Respawn(new Vector3(-3,0,-4.5f),Vector3.forward);Check(ability.TryAcquire(),"obtain bracelet");
            Check(cycle.Objective.Contains("냉각"),"filled crossing guides freezing before traversal");
            Capture("guide-crossing");
            Check(!ability.CanReach(cycle.collector),"upper collector beyond initial reach");
            player.Respawn(new Vector3(0,0,-5),Vector3.forward);
            Check(!cycle.TryInteract()&&!cycle.ValveOpen,"upper valve cannot be opened from entry");
            player.Respawn(new Vector3(0,0,-1),Vector3.forward);Use(crossing.trough,false);
            Move(Vector3.forward,118);Check(crossing.BridgeLatched,"ice crossing opens permanent return route");Wait(60);
            Check(crossing.bridgeSupport.enabled,"return bridge ready before upper preparations");
            Check(cycle.Objective.Contains("상층 수문"),"safe return bridge advances guide to upper valve");
            player.Respawn(new Vector3(2,0,8),Vector3.forward);Check(!cycle.TryInteract()&&!cycle.ValveOpen,"valve requires physically reaching upper gallery");
            player.Respawn(new Vector3(5.25f,0,5.5f),Vector3.forward);Move(Vector3.forward,53);
            Check(player.Grounded&&player.transform.position.y>2.35f,"fixed ramp reaches upper gallery using real movement: "+player.transform.position);
            Move(Vector3.left,45);Check(cycle.TryInteract()&&cycle.ValveOpen,"upper gallery valve opens on nearby interaction");
            Use(cycle.collector,false);Check(cycle.collector.Cold==1,"cold collector persists while player leaves");
            Check(cycle.Objective.Contains("물길 전환"),"prepared upper devices guide routing to boiler");
            Capture("upper-prepared");
            player.Respawn(new Vector3(0,0,-2.4f),Vector3.forward);Check(cycle.TryInteract()&&cycle.ToBoiler,"pump changes route to boiler");Wait();
            Check(cycle.boiler.Water.liquid>1.999f&&crossing.trough.Water.ice>3.999f,"routing liquid does not steal frozen bridge water");
            player.Respawn(new Vector3(3,0,-3.6f),Vector3.forward);Use(cycle.boiler,true);Wait();
            Check(Mathf.Abs(cycle.sanctum.Water.liquid-2)<.001f&&!crossing.DoorOpen,"remaining two units cannot solve sanctuary");
            Check(cycle.Objective.Contains("얼음길의 물")&&cycle.Hint.Contains("2.0 / 5"),"two-unit shortfall explains reuse and shows sanctuary amount");
            Capture("guide-reuse-ice");
            player.Respawn(new Vector3(0,0,-1),Vector3.forward);Use(crossing.trough,true);Wait();
            Check(cycle.boiler.Water.liquid>3.999f&&!crossing.trough.iceSupport.enabled,"melting bridge releases four units for reuse");
            player.Respawn(new Vector3(5.25f,0,5.5f),Vector3.forward);Move(Vector3.forward,53);Move(Vector3.left,45);
            Check(cycle.TryInteract()&&!cycle.ValveOpen,"upper valve may be closed for failure test");
            player.Respawn(new Vector3(3,0,-3.6f),Vector3.forward);Use(cycle.boiler,true);Wait();
            Check(crossing.recovery.Water.liquid>3.999f&&Mathf.Abs(cycle.sanctum.Water.liquid-2)<.001f,"closed valve returns vapour without losing water");
            Check(cycle.Objective.Contains("상층 수문")&&cycle.Hint.Contains("회수조 4.0"),"failed collection identifies closed valve and conserved recovery volume");
            Capture("guide-closed-valve");
            player.Respawn(new Vector3(-5,0,-4.5f),Vector3.forward);Check(cycle.TryInteract(),"recovery pump recirculates failed attempt");Wait();
            Check(cycle.boiler.Water.liquid>3.999f&&Mathf.Abs(ability.TotalWater-6)<.001f,"recovered water returns only through supply route");
            player.Respawn(new Vector3(5.25f,0,5.5f),Vector3.forward);Move(Vector3.forward,53);Move(Vector3.left,45);Check(cycle.TryInteract()&&cycle.ValveOpen,"retry opens upper valve");
            Use(cycle.collector,true);Check(cycle.collector.Cold==0,"warming collector removes its preparation");
            player.Respawn(new Vector3(3,0,-3.6f),Vector3.forward);Use(cycle.boiler,true);Wait();
            Check(crossing.recovery.Water.liquid>3.999f&&!crossing.DoorOpen,"warm collector also returns water safely");
            player.Respawn(new Vector3(-5,0,-4.5f),Vector3.forward);cycle.TryInteract();Wait();
            player.Respawn(new Vector3(5.25f,0,5.5f),Vector3.forward);Move(Vector3.forward,53);Move(Vector3.left,45);Use(cycle.collector,false);
            player.Respawn(new Vector3(3,0,-3.6f),Vector3.forward);Use(cycle.boiler,true);Wait();
            Check(cycle.sanctum.Water.liquid>5.999f&&crossing.DoorOpen,"reused bridge water fills sanctuary and opens exit");
            Check(cycle.Objective.Contains("열린 문"),"fully opened gate guides final traversal");
            Check(Mathf.Abs(ability.TotalWater-6)<.001f,"two failed attempts and success conserve all mass");
            player.Respawn(new Vector3(-3,0,6.8f),Vector3.forward);Check(!ability.BeginUse(cycle.sanctum,true),"protected completed basin cannot be emptied");
            player.Respawn(new Vector3(0,0,8),Vector3.forward);Move(Vector3.forward,50);Check(crossing.Completed,"open exit can be crossed to finish prototype");
            Capture("cycle-complete");
        }
        void Capture(string name)
        {
            var camera=ability.view;camera.GetComponent<OrbitCamera>().enabled=false;
            var position=new Vector3(5.5f,3.7f,-5.9f);camera.transform.SetPositionAndRotation(position,Quaternion.LookRotation(new Vector3(0,1.8f,5)-position));
            ability.RefreshHud();
            var canvases=FindObjectsByType<Canvas>(FindObjectsSortMode.None);foreach(var canvas in canvases){canvas.renderMode=RenderMode.ScreenSpaceCamera;canvas.worldCamera=camera;canvas.planeDistance=.5f;}
            Canvas.ForceUpdateCanvases();var rt=new RenderTexture(1440,900,24);rt.Create();camera.targetTexture=rt;camera.Render();var old=RenderTexture.active;RenderTexture.active=rt;
            var image=new Texture2D(1440,900,TextureFormat.RGB24,false);image.ReadPixels(new Rect(0,0,1440,900),0,0);image.Apply();File.WriteAllBytes(System.IO.Path.Combine(output,name+".png"),image.EncodeToPNG());
            camera.targetTexture=null;RenderTexture.active=old;rt.Release();Destroy(rt);Destroy(image);foreach(var canvas in canvases)canvas.renderMode=RenderMode.ScreenSpaceOverlay;
        }
    }
}
