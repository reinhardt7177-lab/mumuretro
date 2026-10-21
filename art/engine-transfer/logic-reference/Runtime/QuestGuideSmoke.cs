using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

namespace Mumu.Planet
{
    public sealed class QuestGuideSmoke : MonoBehaviour
    {
        [Serializable] sealed class Result{public bool passed;public string error;public string[] checks;}
        readonly List<string> checks=new List<string>();
        string output;
        const string Preference="Mumu.QuestGuide.Enabled";
        bool hadPreference;int originalPreference;
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Install()
        {
            var args=Environment.GetCommandLineArgs();int at=Array.IndexOf(args,"-mumu-guide-smoke");
            if(at<0||at+1>=args.Length)return;
            var validator=new GameObject("Opt-in quest guide validation").AddComponent<QuestGuideSmoke>();
            validator.output=args[at+1];DontDestroyOnLoad(validator.gameObject);
        }
        void Check(bool okay,string message)
        {if(!okay)throw new InvalidOperationException(message);checks.Add(message);Debug.Log("GUIDE_CHECK "+message);}
        IEnumerator Start()
        {
            Directory.CreateDirectory(output);
            hadPreference=PlayerPrefs.HasKey(Preference);originalPreference=PlayerPrefs.GetInt(Preference,0);
            var run=Validate();string error=null;
            while(true)
            {
                bool more=false;
                try{more=run.MoveNext();}catch(Exception e){error=e.ToString();Debug.LogException(e);}
                if(!more||error!=null)break;
                yield return run.Current;
            }
            try
            {
                if(hadPreference)PlayerPrefs.SetInt(Preference,originalPreference);else PlayerPrefs.DeleteKey(Preference);
                PlayerPrefs.Save();
            }
            catch(Exception e){Debug.LogWarning("Could not restore this device's guide test preference: "+e.Message);}
            File.WriteAllText(Path.Combine(output,"guide-result.json"),JsonUtility.ToJson(new Result{passed=error==null,error=error??"",checks=checks.ToArray()},true));
            Application.Quit(error==null?0:1);
        }
        void Click(Button button)
        {
            Canvas.ForceUpdateCanvases();var rect=(RectTransform)button.transform;
            var data=new PointerEventData(EventSystem.current){position=RectTransformUtility.WorldToScreenPoint(null,rect.TransformPoint(rect.rect.center)),button=PointerEventData.InputButton.Left};
            var hits=new List<RaycastResult>();EventSystem.current.RaycastAll(data,hits);
            Check(hits.Count>0&&hits[0].gameObject==button.gameObject,"Quest card receives the top pointer hit");
            ExecuteEvents.Execute(button.gameObject,data,ExecuteEvents.pointerClickHandler);
        }
        void Capture(string name)
        {
            var notebook=FindFirstObjectByType<NotebookUI>();
            if(notebook!=null&&notebook.Presentation.Rendering)notebook.Presentation.BookCamera.Render();
            var camera=Camera.main;var canvases=FindObjectsByType<Canvas>(FindObjectsSortMode.None);
            foreach(var canvas in canvases){canvas.renderMode=RenderMode.ScreenSpaceCamera;canvas.worldCamera=camera;canvas.planeDistance=.3f;}
            Canvas.ForceUpdateCanvases();var target=new RenderTexture(Screen.width,Screen.height,24);target.Create();
            camera.targetTexture=target;camera.Render();var previous=RenderTexture.active;RenderTexture.active=target;
            var pixels=new Texture2D(target.width,target.height,TextureFormat.RGB24,false);
            pixels.ReadPixels(new Rect(0,0,target.width,target.height),0,0);pixels.Apply();
            File.WriteAllBytes(Path.Combine(output,name+".png"),pixels.EncodeToPNG());
            camera.targetTexture=null;RenderTexture.active=previous;target.Release();Destroy(target);Destroy(pixels);
            foreach(var canvas in canvases)canvas.renderMode=RenderMode.ScreenSpaceOverlay;
        }
        IEnumerator Validate()
        {
            for(int i=0;i<20;i++)yield return null;
            Check(SceneManager.GetActiveScene().name=="StarsailIntro","Guide test starts on the Starsail");
            var ship=FindFirstObjectByType<StarsailIntro>();var guide=FindFirstObjectByType<QuestGuide>();
            Check(guide!=null&&guide.Goal.Contains("소포")&&guide.HasTarget,"Current ship goal points to the recovery winch");
            if(guide.GuidanceEnabled)guide.Toggle();
            Check(guide.ActiveSparks==0,"Guide begins hidden when switched off");
            Click(guide.ToggleButton);for(int i=0;i<6;i++)yield return null;
            Check(guide.GuidanceEnabled&&guide.ActiveSparks>0,"Clicking the quest card shows the golden dust path");
            Capture("01-ship-gold-path");
            ship.Player.Respawn(new Vector3(4.3f,0,4),Vector3.back);
            Check(ship.Interact(),"Ship progression is still controlled by the winch");
            yield return new WaitForSeconds(1.7f);
            Check(guide.Goal.Contains("수첩")&&guide.HasTarget,"Quest automatically follows the recovered parcel");
            ship.Player.Respawn(new Vector3(.4f,0,1.15f),Vector3.back);
            Check(ship.Interact(),"Parcel can still be opened with guidance on");
            yield return new WaitForSeconds(.7f);
            var notebook=ship.Notebook;
            Check(notebook.IsOpen&&notebook.HasMap&&guide.ActiveSparks==0,"Notebook hides the guide and has a map page");
            Check(notebook.SelectPage(3),"Fourth notebook page opens with a paper turn");
            yield return new WaitForSeconds(.75f);
            Check(notebook.Page==3&&!notebook.MapPlayer.gameObject.activeSelf,"Ship map waits for planet landing");
            Capture("02-ship-map");
            notebook.Close();for(int i=0;i<3;i++)yield return null;
            Check(guide.Goal.Contains("항로")&&guide.HasTarget,"After reading, guidance points to the course console");

            SceneManager.LoadScene("PlanetExploration");
            for(int i=0;i<24;i++)yield return null;
            guide=FindFirstObjectByType<QuestGuide>();
            Check(guide!=null&&guide.GuidanceEnabled&&guide.Goal.Contains("무게의 신전")&&guide.HasTarget,
                "On landing, the quest points to the actual temple entrance (actual: "+(guide!=null?guide.Goal:"missing")+
                ", enabled="+(guide!=null&&guide.GuidanceEnabled)+", target="+(guide!=null&&guide.HasTarget)+")");
            Check(guide.ActiveSparks>0,"Gold dust follows the planet surface toward the entrance");
            Capture("03-planet-gold-path");
            notebook=FindFirstObjectByType<NotebookUI>();
            Check(notebook.TryOpen()&&notebook.HasMap&&notebook.SelectPage(3),"Planet notebook opens the local landmark chart");
            yield return new WaitForSeconds(.75f);
            Check(notebook.Page==3&&notebook.MapPlayer.gameObject.activeSelf&&notebook.MapTemple.gameObject.activeSelf,
                "Chart shows both player and temple markers");
            Vector2 before=notebook.MapPlayer.anchoredPosition;
            var player=FindFirstObjectByType<PlanetExplorer>();var entrance=FindFirstObjectByType<TempleEntrance>();
            var ground=FindFirstObjectByType<PlanetSurface>();
            Vector3 toward=Vector3.Slerp(player.transform.position.normalized,entrance.transform.position.normalized,.45f);
            player.Respawn(ground.Point(toward),player.transform.forward);
            yield return null;
            Check(Vector2.Distance(before,notebook.MapPlayer.anchoredPosition)>5,"Player marker moves with the explorer");
            Capture("04-notebook-local-chart");
            notebook.Close();
            guide.Toggle();yield return null;
            Check(!guide.GuidanceEnabled&&guide.ActiveSparks==0,"Turning guidance off clears every spark");
        }
    }
}
