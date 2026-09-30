using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using UnityEngine;

namespace Mumu.Planet
{
    public sealed class WaterSanctuarySmoke : MonoBehaviour
    {
        [Serializable] public sealed class Result{public bool passed;public string error;public List<string> checks=new List<string>();}
        Result result=new Result();WaterSanctuary room;string output;
        void Check(bool ok,string name){if(!ok)throw new Exception(name);result.checks.Add(name);}
        void StorageChecks()
        {
            string directory=Path.Combine(output,"water-record-cases",Guid.NewGuid().ToString("N"));Directory.CreateDirectory(directory);
            string missing=Path.Combine(directory,"missing.json");var fresh=new WaterApproachStore(missing);
            Check(!fresh.Completed&&!File.Exists(missing),"Missing water record does not grant completion or create a file");
            string older=Path.Combine(directory,"thawed.json");const string thawed="{\"version\":1,\"entranceOpen\":true,\"completed\":false}";
            File.WriteAllText(older,thawed);
            var opened=new WaterApproachStore(older);
            Check(opened.EntranceOpen&&!opened.Completed,"Existing thaw record restores the open entrance without completion");
            Check(opened.Complete()&&new WaterApproachStore(older).Completed&&File.ReadAllText(older+".bak")==thawed,
                "Completion upgrades an existing thaw record and keeps its previous bytes");
            string completed=File.ReadAllText(older);
            Check(opened.Complete()&&File.ReadAllText(older)==completed,"Repeated water completion leaves the saved record unchanged");
            foreach(string data in new[]{"{broken","{\"version\":99,\"entranceOpen\":true,\"completed\":false}"})
            {
                string path=Path.Combine(directory,Guid.NewGuid().ToString("N")+".json");File.WriteAllText(path,data);
                var unreadable=new WaterApproachStore(path);
                Check(!unreadable.Complete()&&unreadable.Completed&&!unreadable.Saved&&File.ReadAllText(path)==data,
                    "Unreadable or future water record survives while the session can finish");
            }
        }
        IEnumerator Start()
        {
            var args=Environment.GetCommandLineArgs();int i=Array.IndexOf(args,"-mumu-sanctuary-smoke");
            if(i>=0&&i+1<args.Length)output=args[i+1];
            else {i=Array.IndexOf(args,"-mumu-water-journey-smoke");if(i<0||i+2>=args.Length||args[i+1]!="sanctuary-entry")yield break;output=args[i+2];}
            Directory.CreateDirectory(output);for(int j=0;j<18;j++)yield return null;
            room=GetComponent<WaterSanctuary>();room.enabled=false;room.player.enabled=false;
            bool transitionPending=false;
            try
            {
                StorageChecks();
                Check(!WaterApproachProgress.Current.Completed&&!WaterApproachProgress.Current.Saved,
                    "Water completion has not been granted before the deity encounter");
                Check(room.deity.GetComponentsInChildren<Renderer>().Length>0,"Blender deity rendered in sanctuary");
                Check(!room.TryBegin(),"dialogue cannot start from entrance");Capture("sanctuary-entry",new Vector3(0,2.5f,1),new Vector3(0,2.4f,12));
                for(int j=0;j<260&&room.player.transform.position.z<8.4f;j++){room.player.Step(Vector3.forward,false,false,.02f);Physics.SyncTransforms();}
                Check(room.player.Grounded&&room.player.transform.position.z>8,"central dry aisle is walkable");
                Check(room.TryBegin()&&room.player.InputLocked,"approaching deity starts dialogue and locks movement");
                room.Advance();Check(room.LineIndex==0,"input debounce prevents skipped opening line");
                var notebook=FindFirstObjectByType<NotebookUI>();notebook.TryOpen();room.Tick(1);room.Advance();Check(room.LineIndex==0,"notebook blocks dialogue advancement");notebook.Close();
                Capture("deity-audience",new Vector3(2.6f,2.9f,7.5f),new Vector3(0,2.3f,12));
                var deityRotation=room.deity.localRotation;
                try
                {
                    foreach(int angle in new[]{0,90,180,270})
                    {
                        room.deity.localRotation=deityRotation*Quaternion.Euler(0,angle,0);
                        Capture("deity-review-"+angle,new Vector3(0,2.4f,7.4f),new Vector3(0,2.25f,12),false);
                    }
                }
                finally{room.deity.localRotation=deityRotation;}
                Capture("deity-face",new Vector3(.32f,3.35f,10.6f),new Vector3(0,3.15f,12),false);
                room.Tick(1);room.Advance();Check(room.LineIndex==1,"second dialogue line shown");room.Tick(1);room.Advance();Check(room.LineIndex==2,"third dialogue line shown");room.Tick(1);room.Advance();
                Check(room.Met&&room.IsDeparting&&room.player.InputLocked&&!room.next.gameObject.activeSelf,
                    "Final dialogue locks input and starts the automatic departure");
                Check(WaterApproachProgress.Current.Completed&&WaterApproachProgress.Current.Saved&&
                    new WaterApproachStore(WaterApproachProgress.SavePath).Completed,
                    "Deity encounter permanently records water completion before the scene changes");
                Check(!room.TryBegin(),"Completed audience cannot restart during departure");
                var observer=new GameObject("Water ending transition validation").AddComponent<WaterEndingSmoke>();
                DontDestroyOnLoad(observer.gameObject);observer.Configure(room,result,output);
                transitionPending=true;
            }
            catch(Exception e){result.error=e.ToString();Debug.LogException(e);}
            if(transitionPending)yield break;
            File.WriteAllText(Path.Combine(output,"sanctuary-result.json"),JsonUtility.ToJson(result,true));Application.Quit(result.passed?0:1);
        }
        void Capture(string name,Vector3 position,Vector3 look,bool showHud=true)
        {
            room.orbit.enabled=false;var camera=room.orbit.GetComponent<Camera>();camera.transform.SetPositionAndRotation(position,Quaternion.LookRotation(look-position));room.Present();
            var canvases=FindObjectsByType<Canvas>(FindObjectsSortMode.None);var enabled=new bool[canvases.Length];for(int i=0;i<canvases.Length;i++){var c=canvases[i];enabled[i]=c.enabled;c.enabled=showHud&&c.enabled;c.renderMode=RenderMode.ScreenSpaceCamera;c.worldCamera=camera;c.planeDistance=.5f;}Canvas.ForceUpdateCanvases();
            var rt=new RenderTexture(1440,900,24);rt.Create();camera.targetTexture=rt;camera.Render();var old=RenderTexture.active;RenderTexture.active=rt;
            var image=new Texture2D(1440,900,TextureFormat.RGB24,false);image.ReadPixels(new Rect(0,0,1440,900),0,0);image.Apply();File.WriteAllBytes(Path.Combine(output,name+".png"),image.EncodeToPNG());
            camera.targetTexture=null;RenderTexture.active=old;rt.Release();Destroy(rt);Destroy(image);for(int i=0;i<canvases.Length;i++){canvases[i].renderMode=RenderMode.ScreenSpaceOverlay;canvases[i].enabled=enabled[i];}
        }
    }
}
