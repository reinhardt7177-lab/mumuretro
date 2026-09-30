using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using UnityEngine;

namespace Mumu.Planet
{
    public sealed class WaterBraceletSmoke : MonoBehaviour
    {
        [Serializable] sealed class Result { public bool passed;public string error;public List<string> checks=new List<string>(); }
        Result result=new Result();string output;
        void Check(bool value,string name){if(!value)throw new Exception(name);result.checks.Add(name);}
        IEnumerator Start()
        {
            var args=Environment.GetCommandLineArgs();int index=Array.IndexOf(args,"-mumu-bracelet-smoke");
            if(index<0||index+1>=args.Length)yield break;
            output=args[index+1];Directory.CreateDirectory(output);
            for(int i=0;i<18;i++)yield return null;
            var lab=GetComponent<WaterBraceletLab>();lab.enabled=false;lab.player.enabled=false;
            try { Validate(lab);result.passed=true; }catch(Exception e){result.error=e.ToString();Debug.LogException(e);}
            lab.player.transform.position=new Vector3(0,0,-4);
            var camera=lab.view.GetComponent<OrbitCamera>();camera.ConfigureFraming(38,10);camera.Snap();
            foreach(var t in lab.targets)t.Present(false);
            lab.instruction.text="물의 팔찌 · 능력 시험실";
            lab.status.text="팔찌 획득 · 얼리기 / 녹이기 · 집수판 냉각 · 기화 / 응결 / 회수\nF 팔찌 · 1 가열 / 2 냉각 · 마우스 왼쪽 누르기 · 오른쪽 카메라";
            try { Capture(lab.view); } catch(Exception e){result.passed=false;result.error=e.ToString();}
            File.WriteAllText(Path.Combine(output,"result.json"),JsonUtility.ToJson(result,true));
            Application.Quit(result.passed?0:1);
        }
        void Capture(Camera camera)
        {
            var canvases=FindObjectsByType<Canvas>(FindObjectsSortMode.None);
            foreach(var canvas in canvases){canvas.renderMode=RenderMode.ScreenSpaceCamera;canvas.worldCamera=camera;canvas.planeDistance=.5f;}
            Canvas.ForceUpdateCanvases();
            var rt=new RenderTexture(1440,900,24);rt.Create();camera.targetTexture=rt;camera.Render();
            var previous=RenderTexture.active;RenderTexture.active=rt;
            var image=new Texture2D(1440,900,TextureFormat.RGB24,false);image.ReadPixels(new Rect(0,0,1440,900),0,0);image.Apply();
            File.WriteAllBytes(Path.Combine(output,"trial.png"),image.EncodeToPNG());
            camera.targetTexture=null;RenderTexture.active=previous;rt.Release();Destroy(rt);Destroy(image);
            foreach(var canvas in canvases)canvas.renderMode=RenderMode.ScreenSpaceOverlay;
        }
        void Validate(WaterBraceletLab lab)
        {
            var water=new WaterPhaseState(2);var press=new WaterPhasePress();
            Check(press.Begin(water,false),"start freezing");press.Tick(.5f);press.Cancel();
            Check(Mathf.Abs(water.ice-.5f)<.001f&&Mathf.Abs(water.liquid-1.5f)<.001f,"cancel retains converted mass");
            press.Begin(water,false);press.Tick(10);
            Check(Mathf.Abs(water.ice-2)<.001f,"resume freezes remaining water");
            press.Begin(water,true);press.Tick(10);press.Tick(10);
            Check(water.vapour==0&&Mathf.Abs(water.liquid-2)<.001f,"long press stops at ice to water boundary");
            press.Begin(water,true);press.Tick(10);
            Check(Mathf.Abs(water.vapour-2)<.001f,"new press vaporizes water");
            for(int i=0;i<30;i++){press.Begin(water,false);press.Tick(10);press.Begin(water,true);press.Tick(10);}
            Check(Mathf.Abs(water.Total-2)<.001f,"repeated opposite powers conserve mass");
            Check(!press.Begin(new WaterPhaseState(0),true),"empty target rejected");
            Check(Mathf.Abs(lab.TotalWater-4)<.001f,"scene begins with four mass units");
            Check(!lab.TryAcquire(),"distant pickup rejected");
            lab.player.Respawn(new Vector3(-3,0,-4.5f),Vector3.forward);
            Check(lab.TryAcquire()&&lab.cuff.parent==lab.wrist,"near pickup attaches cuff to hand bone");
            var pool=lab.targets[0];
            lab.player.Respawn(new Vector3(-3,0,-1),Vector3.forward);
            Check(lab.BeginUse(pool,false),"reachable cooling accepted");lab.AdvanceUse(1);lab.Cancel();
            Check(pool.Water.ice>0&&pool.Water.liquid>0,"scene cancellation retains partial freeze");
            lab.BeginUse(pool,false);lab.AdvanceUse(5);pool.Present(false);
            Check(pool.iceSupport.enabled,"full ice enables support collider");
            lab.BeginUse(pool,true);lab.AdvanceUse(.3f);pool.Present(false);
            Check(!pool.iceSupport.enabled,"partial melt disables full ice support");lab.AdvanceUse(5);
            Check(pool.Water.vapour==0,"runtime heating stops at melt boundary");
            var wall=GameObject.CreatePrimitive(PrimitiveType.Cube);wall.layer=8;wall.transform.position=new Vector3(-3,1,0);wall.transform.localScale=new Vector3(3,3,.2f);Physics.SyncTransforms();
            Check(!lab.BeginUse(pool,true),"wall blocks power from player");wall.SetActive(false);Destroy(wall);Physics.SyncTransforms();
            lab.player.Respawn(new Vector3(7,0,-5),Vector3.forward);
            Check(!lab.BeginUse(pool,true),"range above six metres rejected");
            lab.player.Respawn(new Vector3(-3,0,-1),Vector3.forward);lab.player.Carrying=true;
            Check(!lab.BeginUse(pool,true),"carrying blocks ability");lab.player.Carrying=false;
            var notebook=FindFirstObjectByType<NotebookUI>();notebook.Launcher.onClick.Invoke();
            Check(NotebookUI.BlocksInput&&!lab.BeginUse(pool,true),"notebook blocks power");notebook.CloseButton.onClick.Invoke();
            Check(!NotebookUI.BlocksInput,"notebook restores input");
            lab.BeginUse(pool,true);lab.AdvanceUse(5);lab.SimulateFlow(5);
            Check(lab.recovery.Water.liquid>1.99f,"unprepared collector returns water");
            lab.player.Respawn(new Vector3(-3,0,4),Vector3.forward);
            Check(lab.Pump()&&pool.Water.liquid>1.99f,"physical pump recovers supply");
            lab.player.Respawn(new Vector3(3,0,1),Vector3.forward);
            Check(lab.BeginUse(lab.collector,false),"collector cooling accepted");lab.AdvanceUse(5);
            Check(lab.collector.Cold==1,"collector stores cold after releasing");
            lab.player.Respawn(new Vector3(-3,0,-1),Vector3.forward);
            lab.BeginUse(pool,true);lab.AdvanceUse(5);lab.SimulateFlow(5);
            Check(lab.receiver.Water.liquid>1.99f,"prepared collector condenses into receiver");
            Check(Mathf.Abs(lab.TotalWater-4)<.001f,"complete scene cycle conserves water");
            lab.player.Respawn(new Vector3(-3,0,4),Vector3.forward);lab.Pump();
            Check(Mathf.Abs(lab.TotalWater-4)<.001f&&pool.Water.liquid>1.99f,"repeat loop restores supply without duplication");
        }
    }
}
