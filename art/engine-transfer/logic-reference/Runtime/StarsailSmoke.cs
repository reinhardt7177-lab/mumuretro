using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Mumu.Planet
{
    // Explicit player-build check of the complete opening journey.
    public sealed class StarsailSmoke : MonoBehaviour
    {
        [Serializable] sealed class Result{public bool passed;public string error;public string[] checks;}
        readonly List<string> checks=new List<string>();
        string output;
        bool resume;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Install()
        {
            var args=Environment.GetCommandLineArgs();int index=Array.IndexOf(args,"-mumu-ship-smoke");
            bool resuming=false;
            if(index<0){index=Array.IndexOf(args,"-mumu-ship-resume-smoke");resuming=true;}
            if(index<0||index+1>=args.Length)return;
            var smoke=new GameObject("Opt-in Starsail validation").AddComponent<StarsailSmoke>();
            smoke.output=args[index+1];smoke.resume=resuming;DontDestroyOnLoad(smoke.gameObject);
        }

        void Check(bool ok,string message)
        {if(!ok)throw new InvalidOperationException(message);checks.Add(message);Debug.Log("SHIP_CHECK "+message);}

        IEnumerator Start()
        {
            Directory.CreateDirectory(output);
            var run=resume?ValidateResume():Validate();string error=null;
            while(true)
            {
                bool more=false;
                try{more=run.MoveNext();}catch(Exception e){error=e.ToString();Debug.LogException(e);}
                if(!more||error!=null)break;
                yield return run.Current;
            }
            File.WriteAllText(Path.Combine(output,resume?"ship-resume-result.json":"ship-result.json"),
                JsonUtility.ToJson(new Result{passed=error==null,error=error??"",checks=checks.ToArray()},true));
            Application.Quit(error==null?0:1);
        }

        void Capture(string name)
        {
            var notebook=FindFirstObjectByType<NotebookUI>();
            if(notebook!=null&&notebook.Presentation.Rendering)notebook.Presentation.BookCamera.Render();
            var camera=Camera.main;var canvases=FindObjectsByType<Canvas>(FindObjectsSortMode.None);
            foreach(var canvas in canvases){canvas.renderMode=RenderMode.ScreenSpaceCamera;canvas.worldCamera=camera;canvas.planeDistance=.3f;}
            Canvas.ForceUpdateCanvases();var texture=new RenderTexture(Screen.width,Screen.height,24);texture.Create();
            camera.targetTexture=texture;camera.Render();var previous=RenderTexture.active;RenderTexture.active=texture;
            var pixels=new Texture2D(texture.width,texture.height,TextureFormat.RGB24,false);
            pixels.ReadPixels(new Rect(0,0,texture.width,texture.height),0,0);pixels.Apply();
            File.WriteAllBytes(Path.Combine(output,name+".png"),pixels.EncodeToPNG());
            camera.targetTexture=null;RenderTexture.active=previous;texture.Release();Destroy(texture);Destroy(pixels);
            foreach(var canvas in canvases)canvas.renderMode=RenderMode.ScreenSpaceOverlay;
        }

        IEnumerator Validate()
        {
            for(int i=0;i<20;i++)yield return null;
            Check(SceneManager.GetActiveScene().name=="StarsailIntro","Game opens on the Starsail");
            var story=FindFirstObjectByType<StarsailIntro>();Check(story!=null,"Starsail story controller exists");
            var player=story.Player;var notebook=story.Notebook;
            Check(FindFirstObjectByType<TempleEntrance>()==null,"Ship scene has no planet temple entrance");
            Check(!notebook.CanOpen&&!story.Interact(),"Parcel must be recovered before reading");
            Check(story.RetrievalCable!=null&&story.RetrievalCable.enabled&&story.RetrievalCable.positionCount==3,
                "Discovered parcel is visibly attached to the recovery boom");
            Check(story.Parcel.position.y<1.65f&&Vector3.Distance(story.RetrievalCable.GetPosition(2),story.Parcel.position+Vector3.up*.38f)<.02f,
                "Parcel hangs by its rope beside the rail rather than floating above it");
            Check(FindObjectsByType<MeshRenderer>(FindObjectsSortMode.None).Length>=15,"Ship and space vista render in the scene");
            Capture("01-starsail-deck");
            player.Respawn(new Vector3(3,0,4),Vector3.right);
            var sideCamera=Camera.main;
            var oldPosition=sideCamera.transform.position;var oldRotation=sideCamera.transform.rotation;
            sideCamera.transform.position=new Vector3(.5f,2.3f,4f);
            sideCamera.transform.LookAt(story.Parcel.position+Vector3.up*.1f);
            Capture("01b-parcel-side");
            sideCamera.transform.SetPositionAndRotation(oldPosition,oldRotation);

            player.Respawn(new Vector3(4.3f,0,4),Vector3.back);
            Check(story.Interact()&&story.CurrentChapter==StarsailIntro.Chapter.Recovering,"Winch pulls the found parcel from space");
            yield return new WaitForSeconds(1.7f);
            Check(story.CurrentChapter==StarsailIntro.Chapter.OpenParcel&&Vector3.Distance(story.Parcel.position,new Vector3(.4f,.56f,0))<.02f,
                "Parcel lands on deck after retrieval");
            Check(!story.RetrievalCable.enabled,"Recovery rope clears after the parcel lands");
            Capture("02-recovered-parcel");

            player.Respawn(new Vector3(.4f,0,1.15f),Vector3.back);
            Check(story.Interact()&&story.CurrentChapter==StarsailIntro.Chapter.ReadNotebook,"Opening the parcel begins the notebook scene");
            yield return new WaitForSeconds(.7f);
            Check(notebook.IsOpen&&notebook.CanOpen&&notebook.BodyText.Contains("다음 여행자"),"Blender notebook opens with the parcel message");
            Capture("03-found-notebook");
            notebook.Close();yield return null;
            Check(story.CurrentChapter==StarsailIntro.Chapter.SetCourse&&!NotebookUI.BlocksInput,"Closing the notebook enables the three-number course");
            Check(!story.Interact(),"Course cannot be set from the parcel position");
            Check(notebook.TryOpen()&&notebook.BodyText.Contains("3 · 5 · ?")&&notebook.BodyText.Contains("더한 수"),
                "Notebook gives two digits and the rule for the missing digit");
            notebook.Close();
            Check(FindObjectsByType<TMPro.TextMeshPro>(FindObjectsSortMode.None).Length>=3,"Three visible world-space digits exist");
            player.Respawn(new Vector3(1.65f,0,-4.9f),Vector3.back);
            Check(story.Interact()&&story.DialValues[0]==1&&!story.CourseSolved,"An incomplete course remains locked");
            var restored=new StarsailProgressStore(StarsailProgress.SavePath);
            Check(restored.Read&&restored.Dials[0]==1&&!restored.Solved,"Partial dial state survives a file read");
            Capture("04-unsolved-course");
            int[] answer={3,5,8};
            for(int i=0;i<3;i++)
            {
                player.Respawn(new Vector3((1-i)*1.65f,0,-4.9f),Vector3.back);
                while(story.DialValues[i]!=answer[i])Check(story.Interact(),"Course dial "+(i+1)+" turns");
            }
            Check(story.CourseSolved&&story.CurrentChapter==StarsailIntro.Chapter.ReachHelm,
                "Only 3 · 5 · 8 unlocks the planet course");
            player.Respawn(new Vector3(0,0,-2.4f),Vector3.back);
            yield return new WaitForSeconds(.12f);
            Capture("05-solved-course");
            Check(StarsailProgress.Current.Solved&&new StarsailProgressStore(StarsailProgress.SavePath).Solved,
                "Solved course is written to the local intro file");
            player.Respawn(new Vector3(0,0,-4.9f),Vector3.back);
            Check(story.Interact()&&story.CurrentChapter==StarsailIntro.Chapter.Departing,"Helm starts the planet voyage");
            yield return new WaitForSeconds(1.3f);
            for(int i=0;i<8;i++)yield return null;
            Check(SceneManager.GetActiveScene().name=="PlanetExploration"&&FindFirstObjectByType<PlanetExplorer>()!=null,
                "Voyage lands on the existing playable planet");
            Check(FindFirstObjectByType<NotebookUI>().CanOpen,"Acquired notebook remains usable on the planet");
            Check(new StarsailProgressStore(StarsailProgress.SavePath).Departed,"Departure is saved before leaving the ship");
            Capture("06-planet-arrival");
        }

        IEnumerator ValidateResume()
        {
            for(int i=0;i<22;i++)yield return null;
            Check(StarsailProgress.Current.Departed,"Previous voyage was loaded from disk");
            Check(SceneManager.GetActiveScene().name=="PlanetExploration", "Relaunch resumes on the playable planet");
            Check(FindFirstObjectByType<StarsailIntro>()==null,"Completed ship introduction is skipped on relaunch");
            Check(FindFirstObjectByType<NotebookUI>()?.CanOpen==true,"Found notebook is usable after relaunch");
            Capture("07-relaunch-planet");
        }
    }
}
