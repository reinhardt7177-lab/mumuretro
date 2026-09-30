using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.EventSystems;

namespace Mumu.Planet
{
    public sealed class TempleAudienceValidation
    {
        readonly string output;
        readonly List<string> checks;
        public TempleAudienceValidation(string directory,List<string> results){output=directory;checks=results;}
        void Check(bool value,string text){if(!value)throw new InvalidOperationException(text);checks.Add(text);Debug.Log("AUDIENCE_CHECK "+text);}
        public static void Capture(Camera camera,string path)
        {
            var notebook=UnityEngine.Object.FindFirstObjectByType<NotebookUI>();if(notebook!=null&&notebook.Presentation.Rendering)notebook.Presentation.BookCamera.Render();
            var canvases=UnityEngine.Object.FindObjectsByType<Canvas>(FindObjectsSortMode.None);
            foreach(var canvas in canvases){canvas.renderMode=RenderMode.ScreenSpaceCamera;canvas.worldCamera=camera;canvas.planeDistance=.3f;}
            Canvas.ForceUpdateCanvases();var rt=new RenderTexture(1440,900,24);rt.Create();camera.targetTexture=rt;camera.Render();var previous=RenderTexture.active;RenderTexture.active=rt;
            var texture=new Texture2D(1440,900,TextureFormat.RGB24,false);texture.ReadPixels(new Rect(0,0,1440,900),0,0);texture.Apply();File.WriteAllBytes(path,texture.EncodeToPNG());
            camera.targetTexture=null;RenderTexture.active=previous;rt.Release();UnityEngine.Object.Destroy(rt);UnityEngine.Object.Destroy(texture);foreach(var canvas in canvases)canvas.renderMode=RenderMode.ScreenSpaceOverlay;
        }
        void StorageChecks()
        {
            string directory=Path.Combine(output,"storage-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(directory);
            string path=Path.Combine(directory,"completion.json");var store=new TempleCompletionStore(path);
            Check(!store.Completed&&!File.Exists(path),"A missing completion record starts unsealed without creating data");
            Check(store.Complete()&&new TempleCompletionStore(path).Completed,"Completion persists and reloads from its local record");
            string original=File.ReadAllText(path);Check(store.Complete()&&File.ReadAllText(path)==original,"Repeated completion is idempotent");
            string existing=Path.Combine(directory,"existing.json");string empty="{\"version\":1,\"balanceCompleted\":false}";File.WriteAllText(existing,empty);
            Check(new TempleCompletionStore(existing).Complete()&&File.ReadAllText(existing+".bak")==empty,"Replacing a valid record keeps the previous file as backup");
            foreach(string data in new[]{"not json","{\"version\":99,\"balanceCompleted\":false,\"future\":7}"})
            {
                string broken=Path.Combine(directory,Guid.NewGuid().ToString("N")+".json");File.WriteAllText(broken,data);var unreadable=new TempleCompletionStore(broken);
                Check(!unreadable.Complete()&&unreadable.Completed&&File.ReadAllText(broken)==data,"Unreadable or future data survives intact; completion remains session-only");
            }
        }
        IEnumerator Walk(LeverBalanceRoom room,Vector3 target)
        {
            int frames=0;var animator=room.Player.GetComponentInChildren<Animator>();
            while(Vector3.Distance(room.Player.transform.position,target)>.09f&&!room.Audience.IsPlaying&&frames++<1500)
            {
                var delta=target-room.Player.transform.position;delta.y=0;
                room.Player.Step(delta.normalized*Mathf.Min(1,delta.magnitude*12),false,false,1f/60);animator.Update(1f/60);room.TickPresentation(1f/60);
                if(frames%30==0)yield return null;
            }
            Check(frames<1500,"Audience approach reaches "+target);yield return null;
        }
        public IEnumerator Run()
        {
            StorageChecks();var room=UnityEngine.Object.FindFirstObjectByType<LeverBalanceRoom>();var audience=room.Audience;var orbit=UnityEngine.Object.FindFirstObjectByType<OrbitCamera>();
            Check(audience!=null&&!TempleProgress.Current.Completed,"Guardian encounter is linked without prematurely awarding completion");
            room.Player.Respawn(new Vector3(0,0,17.9f),Vector3.forward);
            Check(!audience.TryBegin(),"Reaching the guardian without solving cannot trigger completion");room.Restart();
            room.State.Shift(1);room.State.Pick(0);room.State.Place(1);room.State.Pick(1);room.State.Place(3);
            room.Player.Respawn(new Vector3(0,0,17.9f),Vector3.forward);Check(!audience.TryBegin(),"A solved but still closed gate cannot trigger the encounter");
            room.Player.Respawn(new Vector3(0,0,-7.2f),Vector3.forward);for(int i=0;i<100;i++)room.TickPresentation(1f/60);
            Check(!audience.TryBegin(),"Solving from a distance does not start the conversation");
            foreach(var point in new[]{new Vector3(5.7f,0,-7.2f),new Vector3(5.7f,0,6.4f),new Vector3(0,0,7.2f),new Vector3(0,0,11.3f),new Vector3(0,0,15.8f)})
            {var walk=Walk(room,point);while(walk.MoveNext())yield return walk.Current;}
            orbit.Snap();Capture(orbit.GetComponent<Camera>(),Path.Combine(output,"audience-approach.png"));
            var approach=Walk(room,new Vector3(0,0,17.95f));while(approach.MoveNext())yield return approach.Current;
            Check(audience.IsPlaying&&audience.LineIndex==0,"Walking up to the guardian starts the first dialogue line automatically");
            Check(!audience.TryBegin()&&!audience.Advance(),"Duplicate activation and same-frame advance cannot skip the dialogue");
            Check(!room.Player.enabled&&!orbit.enabled&&!TempleProgress.Current.Completed,"Dialogue holds movement and camera without awarding completion early");
            var position=room.Player.transform.position;room.Restart();room.Leave();
            Check(room.State.Solved&&room.Player.transform.position==position&&SceneManager.GetActiveScene().name=="LeverBalanceTemple","Reset and leave are blocked during the completion encounter");
            float deadline=Time.realtimeSinceStartup+15;
            while(audience.LineIndex==0&&Time.realtimeSinceStartup<deadline)yield return null;
            Check(audience.LineIndex==1,"Dialogue advances automatically without input");
            var audienceCamera=orbit.GetComponent<Camera>();
            Check(!Physics.Linecast(audienceCamera.transform.position,audience.GuardianPosition+Vector3.up*4.6f),"Dialogue camera has an unobstructed view of the deity mask");
            foreach(float side in new[]{-1f,1f})
            {
                var pan=audienceCamera.WorldToViewportPoint(audience.GuardianPosition+new Vector3(side*1.26f,1.99f,-1.085f));
                Check(pan.z>0&&pan.x>.05f&&pan.x<.95f&&pan.y>.315f&&pan.y<.95f,"Balance dish is inside the frame and above the dialogue panel: "+side);
            }
            var crown=audienceCamera.WorldToViewportPoint(audience.GuardianPosition+Vector3.up*6.1f);
            Check(crown.z>0&&crown.y<.97f&&crown.y>.315f,"Entire deity crown remains inside the dialogue frame");
            Capture(audienceCamera,Path.Combine(output,"audience-dialogue.png"));
            float wait=Time.time+.4f;while(Time.time<wait)yield return null;
            var button=GameObject.Find("다음").GetComponent<UnityEngine.UI.Button>();Canvas.ForceUpdateCanvases();var rect=(RectTransform)button.transform;
            var click=new PointerEventData(EventSystem.current){position=RectTransformUtility.WorldToScreenPoint(null,rect.TransformPoint(rect.rect.center)),button=PointerEventData.InputButton.Left};
            var hits=new List<RaycastResult>();EventSystem.current.RaycastAll(click,hits);Check(hits.Exists(h=>h.gameObject==button.gameObject),"Dialogue next button receives pointer input");
            ExecuteEvents.Execute(button.gameObject,click,ExecuteEvents.pointerClickHandler);Check(audience.LineIndex==2,"Clicking next advances the actual conversation");
            wait=Time.time+.4f;while(Time.time<wait)yield return null;
            Check(audience.Advance()&&audience.LineIndex==3&&!TempleProgress.Current.Completed,"Manual advance reaches the last line; reward is still pending");
            deadline=Time.realtimeSinceStartup+15;while(audience!=null&&!audience.IsDeparting&&Time.realtimeSinceStartup<deadline)yield return null;
            Check(TempleProgress.Current.Completed&&new TempleCompletionStore(TempleProgress.SavePath).Completed,"Finishing the last line records the completed temple before departure");
            while(SceneManager.GetActiveScene().name!="PlanetExploration"&&Time.realtimeSinceStartup<deadline)yield return null;
            Check(SceneManager.GetActiveScene().name=="PlanetExploration","Completed conversation returns to the planet automatically");
            for(int i=0;i<20;i++)yield return null;
            var entry=UnityEngine.Object.FindFirstObjectByType<TempleEntrance>();var player=UnityEngine.Object.FindFirstObjectByType<PlanetExplorer>();
            Check(entry.IsSealed&&entry.SealVisible&&player.enabled&&!player.Carrying,"Planet return restores controls and shows the completed seal");
            var ground=UnityEngine.Object.FindFirstObjectByType<PlanetSurface>();player.enabled=false;
            player.Respawn(ground.Point(entry.transform.TransformPoint(new Vector3(0,0,-1.1f))),entry.transform.forward);
            Check(!entry.CanEnter&&!entry.TryEnter(),"Even at the front door a completed temple rejects re-entry");entry.Enter();
            Check(!entry.IsOpening,"Direct entry cannot bypass the completion seal");
            wait=Time.time+1.2f;while(Time.time<wait)yield return null;
            var camera=UnityEngine.Object.FindFirstObjectByType<OrbitCamera>();camera.Snap();Capture(camera.GetComponent<Camera>(),Path.Combine(output,"temple-sealed.png"));
            var notebook=UnityEngine.Object.FindFirstObjectByType<NotebookUI>();
            Check(notebook!=null&&notebook.TryOpen(),"Notebook opens after the actual guardian completion event");
            Check(notebook.RecordText.Contains("완료 기록 저장됨")&&notebook.BodyText.Contains("지렛대"),"Newly earned wisdom is shown in the notebook from the completion record");
            for(int i=0;i<3;i++)yield return null;
            Capture(camera.GetComponent<Camera>(),Path.Combine(output,"notebook-earned-wisdom.png"));notebook.Close();
            player.enabled=true;
        }
    }
}
