using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.LowLevel;
using UnityEngine.SceneManagement;
using TMPro;

namespace Mumu.Planet
{
    public sealed class NotebookSmoke : MonoBehaviour
    {
        [Serializable] sealed class Result{public bool passed;public string error;public string[] checks;}
        readonly List<string> checks=new List<string>();
        string output;Keyboard keyboard,original;
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Install()
        {
            var args=Environment.GetCommandLineArgs();int i=Array.IndexOf(args,"-mumu-notebook-smoke");if(i<0||i+1>=args.Length)return;
            var test=new GameObject("Opt-in notebook validation").AddComponent<NotebookSmoke>();test.output=args[i+1];DontDestroyOnLoad(test.gameObject);
        }
        void Check(bool value,string text){if(!value)throw new InvalidOperationException(text);checks.Add(text);Debug.Log("NOTEBOOK_CHECK "+text);}
        IEnumerator Start()
        {
            Directory.CreateDirectory(output);original=Keyboard.current;keyboard=InputSystem.AddDevice<Keyboard>("NotebookValidationKeyboard");keyboard.MakeCurrent();
            var run=Validate();string error=null;
            while(true){bool more=false;try{more=run.MoveNext();}catch(Exception e){error=e.ToString();Debug.LogException(e);}if(!more||error!=null)break;yield return run.Current;}
            InputSystem.RemoveDevice(keyboard);if(original!=null&&original.added)original.MakeCurrent();
            File.WriteAllText(Path.Combine(output,"notebook-result.json"),JsonUtility.ToJson(new Result{passed=error==null,error=error??"",checks=checks.ToArray()},true));Application.Quit(error==null?0:1);
        }
        void Click(UnityEngine.UI.Button button)
        {
            Canvas.ForceUpdateCanvases();var rect=(RectTransform)button.transform;
            var data=new PointerEventData(EventSystem.current){position=RectTransformUtility.WorldToScreenPoint(null,rect.TransformPoint(rect.rect.center)),button=PointerEventData.InputButton.Left};
            var hits=new List<RaycastResult>();EventSystem.current.RaycastAll(data,hits);
            Check(hits.Count>0&&hits[0].gameObject==button.gameObject,"Visible notebook button receives the top pointer hit: "+button.name);
            ExecuteEvents.Execute(button.gameObject,data,ExecuteEvents.pointerClickHandler);
        }
        void Layout(NotebookUI ui)
        {
            Canvas.ForceUpdateCanvases();
            foreach(var t in ui.GetComponentsInChildren<TextMeshProUGUI>())
            {
                t.ForceMeshUpdate();Check(!t.isTextOverflowing,"Notebook text fits: "+t.name);
                bool hasGlyphs=true;foreach(char c in t.text)if(c>='가'&&c<='힣'&&!t.font.HasCharacter(c))hasGlyphs=false;
                Check(hasGlyphs,"Notebook font contains every displayed Korean character: "+t.name);
                var corners=new Vector3[4];t.rectTransform.GetWorldCorners(corners);
                foreach(var point in corners)Check(point.x>=-1&&point.y>=-1&&point.x<=Screen.width+1&&point.y<=Screen.height+1,"Text rectangle stays on screen: "+t.name);
            }
        }
        void Capture(string name)
        {
            var notebook=FindFirstObjectByType<NotebookUI>();
            // Batchmode does not guarantee an automatic camera render before this synchronous capture.
            if(notebook!=null&&notebook.Presentation.Rendering)
            {
                var book=notebook.Presentation.BookCamera;book.Render();var old=RenderTexture.active;RenderTexture.active=book.targetTexture;
                var sample=new Texture2D(8,8,TextureFormat.RGBA32,false);sample.ReadPixels(new Rect(book.targetTexture.width*.7f,book.targetTexture.height*.5f,8,8),0,0);sample.Apply();var pixel=sample.GetPixel(3,3);
                RenderTexture.active=old;Destroy(sample);
                Check(pixel.a>.9f&&pixel.r>.35f&&pixel.g>.30f,"Real Blender paper is visible in the notebook camera: "+name);
            }
            var camera=Camera.main;var canvases=FindObjectsByType<Canvas>(FindObjectsSortMode.None);
            foreach(var canvas in canvases){canvas.renderMode=RenderMode.ScreenSpaceCamera;canvas.worldCamera=camera;canvas.planeDistance=.3f;}
            Canvas.ForceUpdateCanvases();var rt=new RenderTexture(Screen.width,Screen.height,24);rt.Create();camera.targetTexture=rt;camera.Render();var previous=RenderTexture.active;RenderTexture.active=rt;
            var image=new Texture2D(rt.width,rt.height,TextureFormat.RGB24,false);image.ReadPixels(new Rect(0,0,rt.width,rt.height),0,0);image.Apply();File.WriteAllBytes(Path.Combine(output,name+".png"),image.EncodeToPNG());
            camera.targetTexture=null;RenderTexture.active=previous;rt.Release();Destroy(rt);Destroy(image);foreach(var canvas in canvases)canvas.renderMode=RenderMode.ScreenSpaceOverlay;
        }
        IEnumerator Validate()
        {
            var recordPath=TempleProgress.SavePath;string recordBefore=File.Exists(recordPath)?File.ReadAllText(recordPath):null;
            string[] scenes={"PlanetExploration","WeightTemple","TwinBalanceTemple","LeverBalanceTemple"};
            for(int sceneIndex=0;sceneIndex<scenes.Length;sceneIndex++)
            {
                if(SceneManager.GetActiveScene().name!=scenes[sceneIndex])SceneManager.LoadScene(scenes[sceneIndex]);
                for(int f=0;f<20;f++)yield return null;
                var ui=FindFirstObjectByType<NotebookUI>();var player=FindFirstObjectByType<PlanetExplorer>();var orbit=FindFirstObjectByType<OrbitCamera>();
                Check(FindObjectsByType<NotebookUI>(FindObjectsSortMode.None).Length==1&&FindObjectsByType<EventSystem>(FindObjectsSortMode.None).Length==1,"One notebook and EventSystem in "+scenes[sceneIndex]);
                Check(!NotebookUI.BlocksInput&&!ui.IsOpen&&!ui.Presentation.Rendering,"Closed notebook is not rendering or locking gameplay");
                Click(ui.Launcher);for(int f=0;f<3;f++)yield return null;
                Check(ui.IsOpen&&NotebookUI.BlocksInput&&!player.enabled&&!orbit.enabled&&ui.Presentation.Rendering,"Opening the notebook holds movement and enables only its presentation");
                foreach(var canvas in FindObjectsByType<Canvas>(FindObjectsSortMode.None))if(canvas!=ui.GetComponent<Canvas>())Check(!canvas.enabled,"Reading hides the background HUD: "+canvas.name);
                Check(TempleProgress.Current.Completed?ui.RecordText.Contains("완료 기록 저장됨")&&ui.BodyText.Contains("지렛대"):ui.RecordText.Contains("아직")&&ui.BodyText.Contains("기록된다"),"Notebook reflects real completion state");
                Layout(ui);Capture(scenes[sceneIndex]+"-journal");
                var pos=player.transform.position;InputSystem.QueueStateEvent(keyboard,new KeyboardState(Key.W,Key.E,Key.Q,Key.Space));
                for(int f=0;f<5;f++)yield return null;
                Check(player.transform.position==pos,"Movement/jump input does not move the player while reading");
                var order=FindFirstObjectByType<BalanceRoom>();var twin=FindFirstObjectByType<TwinBalanceRoom>();var lever=FindFirstObjectByType<LeverBalanceRoom>();
                if(order!=null){Check(!order.Interact()&&!order.Drop()&&!order.Select(5),"First puzzle refuses commands behind notebook");order.Restart();order.Leave();}
                if(twin!=null){Check(!twin.Interact()&&!twin.Drop(),"Twin puzzle refuses commands behind notebook");twin.Restart();twin.Leave();}
                if(lever!=null){Check(!lever.Interact()&&!lever.Drop()&&!lever.Audience.TryBegin(),"Lever and guardian refuse commands behind notebook");lever.Restart();lever.Leave();}
                Check(SceneManager.GetActiveScene().name==scenes[sceneIndex]&&player.transform.position==pos,"Notebook blocks reset and manual scene exit");
                InputSystem.QueueStateEvent(keyboard,new KeyboardState());yield return null;
                Click(ui.Next);yield return new WaitForSecondsRealtime(.18f);
                Check(ui.Turning&&ui.Presentation.LeafVisible&&!ui.SelectPage(2),"Physical paper turns and rejects overlapping page requests");Capture(scenes[sceneIndex]+"-turn");
                float deadline=Time.realtimeSinceStartup+3;while(ui.Turning&&Time.realtimeSinceStartup<deadline)yield return null;
                Check(ui.Page==1&&!ui.Turning&&!ui.Presentation.LeafVisible,"Forward page turn settles on experiment notes");yield return new WaitForSecondsRealtime(.16f);Layout(ui);Capture(scenes[sceneIndex]+"-experiments");
                Click(ui.Next);deadline=Time.realtimeSinceStartup+3;while(ui.Turning&&Time.realtimeSinceStartup<deadline)yield return null;
                Check(ui.Page==2&&ui.BodyText.Contains("Space"),"Controls page is connected");Layout(ui);
                InputSystem.QueueStateEvent(keyboard,new KeyboardState(Key.LeftArrow));yield return null;yield return null;InputSystem.QueueStateEvent(keyboard,new KeyboardState());
                deadline=Time.realtimeSinceStartup+3;while(ui.Turning&&Time.realtimeSinceStartup<deadline)yield return null;
                Check(ui.Page==1,"Left arrow turns to the previous page");
                InputSystem.QueueStateEvent(keyboard,new KeyboardState(Key.Escape));yield return null;yield return null;InputSystem.QueueStateEvent(keyboard,new KeyboardState());yield return null;
                Check(!ui.IsOpen&&!NotebookUI.BlocksInput&&!ui.Presentation.Rendering&&player.enabled&&orbit.enabled,"Escape closes the book and releases rendering and controls");
                Capture(scenes[sceneIndex]+"-hud");
                InputSystem.QueueStateEvent(keyboard,new KeyboardState(Key.N));yield return null;yield return null;InputSystem.QueueStateEvent(keyboard,new KeyboardState());yield return null;
                Check(ui.IsOpen,"N opens the notebook");Click(ui.CloseButton);
                Check(!ui.IsOpen&&!NotebookUI.BlocksInput,"Close button works");
                // Preserve held boxes and paused presentation when reading mid-puzzle.
                if(order!=null)
                {
                    player.enabled=false;player.Respawn(order.Box(0).position-Vector3.forward,Vector3.forward);Check(order.Interact(),"Carry a box before reading");
                    ui.TryOpen();Check(!order.Drop()&&order.State.Held==0,"Reading preserves the carried box");ui.Close();Check(!player.enabled&&order.State.Held==0,"Close restores an already-disabled controller and held box");order.Restart();player.enabled=true;
                }
                ui.TryOpen();ui.SelectPage(2);yield return null;ui.Close();
                Check(!ui.Turning&&!ui.Presentation.LeafVisible&&!ui.Presentation.Rendering,"Closing during a turn cancels it cleanly");
                ui.TryOpen(); // Next scene unloads an open modal and must clear its input lock.
            }
            SceneManager.LoadScene("PlanetExploration");for(int i=0;i<20;i++)yield return null;
            Check(!NotebookUI.BlocksInput&&FindFirstObjectByType<PlanetExplorer>().enabled,"Scene unload releases an open notebook lock");
            Check((File.Exists(recordPath)?File.ReadAllText(recordPath):null)==recordBefore,"Reading never rewrites completion data");
        }
    }
}
