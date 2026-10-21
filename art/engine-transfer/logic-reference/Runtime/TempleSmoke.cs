using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Mumu.Planet
{
    public sealed class TempleSmoke : MonoBehaviour
    {
        [SerializeField] BalanceRoom room;
        [SerializeField] OrbitCamera orbit;
        [SerializeField] Animator animator;
        readonly List<string> checks=new List<string>();string output;
        [Serializable] class Result { public bool passed;public string error;public string[] checks; }
        public void Configure(BalanceRoom trial,OrbitCamera camera,Animator body){room=trial;orbit=camera;animator=body;}
        void Check(bool ok,string text){if(!ok)throw new InvalidOperationException(text);checks.Add(text);Debug.Log("TEMPLE_CHECK "+text);}
        IEnumerator Start()
        {
            var args=Environment.GetCommandLineArgs();int index=Array.IndexOf(args,"-mumu-temple-smoke");if(index<0)yield break;
            output=args[index+1];Directory.CreateDirectory(output);DontDestroyOnLoad(gameObject);
            for(int i=0;i<20;i++)yield return null;
            room.Player.enabled=false;orbit.enabled=false;
            var run=Validate();string error=null;
            while(true){bool more=false;try{more=run.MoveNext();}catch(Exception e){error=e.ToString();Debug.LogException(e);}if(!more||error!=null)break;yield return run.Current;}
            File.WriteAllText(Path.Combine(output,"result.json"),JsonUtility.ToJson(new Result{passed=error==null,error=error??"",checks=checks.ToArray()},true));Application.Quit(error==null?0:1);
        }
        void Capture(string name,bool carry=false)
        {
            animator.GetComponent<NavigatorPose>().Apply();orbit.Snap();var camera=orbit.GetComponent<Camera>();
            if(carry){var player=room.Player.transform;var focus=player.position+Vector3.up*.9f;camera.transform.position=focus+player.forward*2.7f+player.right*2+Vector3.up*.4f;camera.transform.LookAt(focus);}
            var canvases=FindObjectsByType<Canvas>(FindObjectsSortMode.None);
            foreach(var canvas in canvases){canvas.renderMode=RenderMode.ScreenSpaceCamera;canvas.worldCamera=camera;canvas.planeDistance=.5f;}
            Canvas.ForceUpdateCanvases();var rt=new RenderTexture(1440,900,24);rt.Create();camera.targetTexture=rt;camera.Render();var previous=RenderTexture.active;RenderTexture.active=rt;
            var texture=new Texture2D(1440,900,TextureFormat.RGB24,false);texture.ReadPixels(new Rect(0,0,1440,900),0,0);texture.Apply();File.WriteAllBytes(Path.Combine(output,name+".png"),texture.EncodeToPNG());
            camera.targetTexture=null;RenderTexture.active=previous;rt.Release();Destroy(rt);Destroy(texture);foreach(var canvas in canvases)canvas.renderMode=RenderMode.ScreenSpaceOverlay;
        }
        IEnumerator Walk(Vector3 target)
        {
            target.y=0;int frames=0;
            while(Vector3.Distance(room.Player.transform.position,target)>.09f&&frames++<1500)
            {
                var delta=target-room.Player.transform.position;delta.y=0;
                room.Player.Step(delta.normalized*Mathf.Min(1,delta.magnitude*12),false,false,1f/60);animator.Update(1f/60);room.TickPresentation(1f/60);
                if(frames%30==0)yield return null;
            }
            Check(frames<1500,"Walk reaches "+target);room.Player.Step(Vector3.zero,false,false,1f/60);yield return null;
        }
        IEnumerator CarryTo(int box,int slot)
        {
            var home=room.Box(box).position;
            if(room.Player.transform.position.z>7.3f){var exitWalk=Walk(new Vector3(0,0,7.2f));while(exitWalk.MoveNext())yield return exitWalk.Current;}
            foreach(var point in new[]{new Vector3(5.7f,0,room.Player.transform.position.z),new Vector3(5.7f,0,-6.4f),new Vector3(home.x,0,home.z-1f)}){var walk=Walk(point);while(walk.MoveNext())yield return walk.Current;}
            Check(room.Interact()&&room.State.Held==box,"Pick up box "+box);
            foreach(var point in new[]{new Vector3(5.7f,0,-6.4f),new Vector3(5.7f,0,room.Slot(slot).z-1f),new Vector3(room.Slot(slot).x,0,room.Slot(slot).z-1f)}){var walk=Walk(point);while(walk.MoveNext())yield return walk.Current;}
            Check(room.Interact()&&room.State.Location(box)==slot,"Place box "+box+" in slot "+slot);
        }
        IEnumerator Validate()
        {
            Check(SceneManager.GetActiveScene().name=="WeightTemple","Planet entry loads temple scene");
            var events=UnityEngine.EventSystems.EventSystem.current;
            Check(events!=null&&events.currentInputModule is UnityEngine.InputSystem.UI.InputSystemUIInputModule,"New Input System is connected to temple UI");
            var button=GameObject.Find("4개 도전").GetComponent<UnityEngine.UI.Button>();
            Canvas.ForceUpdateCanvases();
            var click=new UnityEngine.EventSystems.PointerEventData(events){position=RectTransformUtility.WorldToScreenPoint(null,button.transform.position),button=UnityEngine.EventSystems.PointerEventData.InputButton.Left};
            var hits=new List<UnityEngine.EventSystems.RaycastResult>();events.RaycastAll(click,hits);
            Check(hits.Any(h=>h.gameObject==button.gameObject),"Difficulty button is reachable by UI raycast");
            UnityEngine.EventSystems.ExecuteEvents.Execute(button.gameObject,click,UnityEngine.EventSystems.ExecuteEvents.pointerClickHandler);
            Check(room.State.Count==4,"Clicking difficulty changes the actual puzzle");room.Select(3);
            room.Player.Respawn(new Vector3(0,0,7.2f),Vector3.forward);
            for(int i=0;i<120;i++)room.Player.Step(Vector3.forward,false,false,1f/60);
            Check(room.Player.transform.position.z<8.5f&&!room.DoorOpen,"Closed door blocks the player before solving");
            room.Player.Respawn(new Vector3(0,0,-7.2f),Vector3.forward);
            // Rules: no duplicate ownership, occupied pans, or false positive partial completion.
            foreach(int count in new[]{3,4,5})
            {
                var state=new BalanceOrderState();Check(state.Select(count),"Select "+count+" boxes");
                Check(state.Pick(0)&&!state.Pick(1)&&state.Place(5),"Only one box can be carried");
                Check(state.Pick(1)&&!state.Place(5)&&state.Held==1,"Occupied scale pan rejects placement atomically");
                state.Drop();state.Reset();
                for(int i=0;i<count;i++){state.Pick(i);state.Place(count-1-i);}
                Check(!state.Solved,"Reversed order stays locked for "+count);
                state.Reset();for(int i=0;i<count;i++){state.Pick(i);state.Place(i);if(i<count-1)Check(!state.Solved,"Partial placement stays locked");}
                Check(state.Solved&&!state.Select(5),"Selected count alone completes and locks choice for "+count);
            }
            Capture("room-entry");
            // Carry pose, drop, and switching difficulty while holding.
            var move=Walk(room.Box(0).position-Vector3.forward);while(move.MoveNext())yield return move.Current;
            Check(room.Interact(),"Physical pickup");yield return null;
            animator.GetComponent<NavigatorPose>().Apply();
            foreach(string side in new[]{"Left","Right"})
            {
                var hand=animator.GetComponentsInChildren<Transform>().First(t=>t.name==side+"Hand");var grip=room.Box(0).Find(side+" hand grip");
                float gap=Vector3.Distance(hand.position,grip.position);Check(gap<.10f,side+" hand stays on box (gap "+gap.ToString("F3")+")");
            }
            Capture("carry",true);
            move=Walk(new Vector3(4,0,-6.3f));while(move.MoveNext())yield return move.Current;
            Check(room.Drop()&&room.State.Held<0&&!room.Player.Carrying,"Drop releases carried state");
            move=Walk(room.Box(0).position-Vector3.forward);while(move.MoveNext())yield return move.Current;Check(room.Interact(),"Dropped box can be picked again");
            Check(room.Select(4)&&room.State.Held<0&&!room.Player.Carrying,"Difficulty change resets carried box safely");
            room.Select(3);
            // Compare without revealing numerical mass.
            for(int i=0;i<2;i++){var carry=CarryTo(i,i+5);while(carry.MoveNext())yield return carry.Current;}
            for(int i=0;i<90;i++)room.TickPresentation(1f/60);
            Check(room.Slot(6).y<room.Slot(5).y,"Heavier right box lowers the right pan");Capture("comparison");
            // Solve each difficulty through movement and the same interaction method as E.
            foreach(int count in new[]{3,4,5})
            {
                room.Restart();room.Select(count);
                for(int box=0;box<count;box++){var carry=CarryTo(box,box);while(carry.MoveNext())yield return carry.Current;}
                for(int i=0;i<80;i++)room.TickPresentation(1f/60);
                Check(room.State.Solved&&room.DoorOpen,"Door physically opens after "+count+" boxes");
                var walk=Walk(new Vector3(0,0,7.2f));while(walk.MoveNext())yield return walk.Current;Capture("solved-"+count);
                walk=Walk(new Vector3(0,0,11.3f));while(walk.MoveNext())yield return walk.Current;Check(room.Player.transform.position.z>10.9f,"Can walk through the opened door for "+count);
            }
            // Cross the end of the corridor through ordinary movement; scene change is game logic.
            for(int i=0;i<18;i++)room.Player.Step(Vector3.forward,false,false,1f/60);
            for(int i=0;i<20;i++)yield return null;
            Check(SceneManager.GetActiveScene().name=="TwinBalanceTemple","Walking beyond the first gate enters room two automatically");
            var twin=new TwinTempleValidation(output,checks);var second=twin.Run();while(second.MoveNext())yield return second.Current;
            var lever=new LeverTempleValidation(output,checks);var third=lever.Run();while(third.MoveNext())yield return third.Current;
            var audience=new TempleAudienceValidation(output,checks);var ending=audience.Run();while(ending.MoveNext())yield return ending.Current;
            Check(SceneManager.GetActiveScene().name=="PlanetExploration"&&FindFirstObjectByType<PlanetExplorer>()!=null,"Return to planet restores exploration");
        }
    }
}
