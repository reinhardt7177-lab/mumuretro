using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
using UnityEngine.SceneManagement;

namespace Mumu.Planet
{
    // Invoked only by TempleSmoke's explicit command-line validation mode.
    public sealed class TwinTempleValidation
    {
        readonly string output;
        readonly List<string> checks;
        readonly TwinBalanceRoom room;
        readonly OrbitCamera orbit;
        readonly Animator animator;
        public TwinTempleValidation(string directory,List<string> results)
        {
            output=directory;checks=results;room=UnityEngine.Object.FindFirstObjectByType<TwinBalanceRoom>();
            orbit=UnityEngine.Object.FindFirstObjectByType<OrbitCamera>();animator=room.Player.GetComponentInChildren<Animator>();
            room.Player.enabled=false;orbit.enabled=false;
        }
        void Check(bool value,string text){if(!value)throw new InvalidOperationException(text);checks.Add(text);Debug.Log("TWIN_CHECK "+text);}
        IEnumerator Walk(Vector3 point)
        {
            point.y=0;int frames=0;
            while(Vector3.Distance(room.Player.transform.position,point)>.09f&&frames++<1500)
            {
                var delta=point-room.Player.transform.position;delta.y=0;
                room.Player.Step(delta.normalized*Mathf.Min(1,delta.magnitude*12),false,false,1f/60);animator.Update(1f/60);room.TickPresentation(1f/60);
                if(frames%30==0)yield return null;
            }
            Check(frames<1500,"Twin walk reaches "+point);room.Player.Step(Vector3.zero,false,false,1f/60);yield return null;
        }
        IEnumerator Pick(int box)
        {
            var home=room.Box(box).position;
            foreach(var point in new[]{new Vector3(room.Player.transform.position.x,0,-2),new Vector3(home.x,0,-2),new Vector3(home.x,0,home.z-1)})
            {var walk=Walk(point);while(walk.MoveNext())yield return walk.Current;}
            Check(room.Interact()&&room.State.Held==box,"Twin pickup "+box);
        }
        IEnumerator Place(int slot)
        {
            var target=room.Slot(slot);
            foreach(var point in new[]{new Vector3(room.Player.transform.position.x,0,-2),new Vector3(target.x,0,-2),new Vector3(target.x,0,target.z-1)})
            {var walk=Walk(point);while(walk.MoveNext())yield return walk.Current;}
            Check(room.Interact()&&room.State.At(slot)>=0&&room.State.Held<0,"Twin placement "+slot);
        }
        void Capture(string name)
        {
            animator.GetComponent<NavigatorPose>().Apply();orbit.Snap();var camera=orbit.GetComponent<Camera>();
            var canvases=UnityEngine.Object.FindObjectsByType<Canvas>(FindObjectsSortMode.None);
            foreach(var canvas in canvases){canvas.renderMode=RenderMode.ScreenSpaceCamera;canvas.worldCamera=camera;canvas.planeDistance=.5f;}
            Canvas.ForceUpdateCanvases();var rt=new RenderTexture(1440,900,24);rt.Create();camera.targetTexture=rt;camera.Render();var previous=RenderTexture.active;RenderTexture.active=rt;
            var texture=new Texture2D(1440,900,TextureFormat.RGB24,false);texture.ReadPixels(new Rect(0,0,1440,900),0,0);texture.Apply();File.WriteAllBytes(Path.Combine(output,name+".png"),texture.EncodeToPNG());
            camera.targetTexture=null;RenderTexture.active=previous;rt.Release();UnityEngine.Object.Destroy(rt);UnityEngine.Object.Destroy(texture);foreach(var canvas in canvases)canvas.renderMode=RenderMode.ScreenSpaceOverlay;
        }
        void ClickReset()
        {
            var button=GameObject.Find("다시 놓기").GetComponent<Button>();Canvas.ForceUpdateCanvases();
            var rect=(RectTransform)button.transform;var position=RectTransformUtility.WorldToScreenPoint(null,rect.TransformPoint(rect.rect.center));
            var click=new PointerEventData(EventSystem.current){position=position,button=PointerEventData.InputButton.Left};
            var hits=new List<RaycastResult>();EventSystem.current.RaycastAll(click,hits);
            Check(hits.Exists(h=>h.gameObject==button.gameObject),"Twin reset button receives pointer input");
            ExecuteEvents.Execute(button.gameObject,click,ExecuteEvents.pointerClickHandler);
        }
        public IEnumerator Run()
        {
            // Every legal full layout is tested, including both mirror solutions and all swaps.
            int layouts=0,solutions=0;
            for(int a=0;a<4;a++)for(int b=0;b<4;b++)for(int c=0;c<4;c++)for(int d=0;d<4;d++)
            {
                if(a==b||a==c||a==d||b==c||b==d||c==d)continue;
                var state=new TwinBalanceState();int[] order={a,b,c,d};
                for(int slot=0;slot<4;slot++){state.Pick(order[slot]);state.Place(slot);if(slot<3)Check(!state.Solved,"Incomplete twin layout remains locked");}
                bool equal=a+b==c+d;Check(state.Solved==equal,"Twin layout rule "+string.Join(",",order));layouts++;if(state.Solved)solutions++;
            }
            Check(layouts==24&&solutions==8,"All 24 permutations yield exactly eight balanced arrangements");
            var rules=new TwinBalanceState();Check(!rules.Solved&&!rules.Pick(-1)&&!rules.Pick(4)&&!rules.Place(0),"Empty balance and invalid indices cannot solve");
            Check(rules.Pick(0)&&!rules.Pick(1)&&rules.Place(0)&&rules.Pick(1)&&!rules.Place(0)&&!rules.Place(4)&&rules.Held==1,"Duplicate carry and occupied/invalid placement are rejected atomically");
            Check(rules.Drop()&&rules.Location(1)==-1,"Pure state drop releases ownership");
            room.Player.Respawn(new Vector3(0,0,7.2f),Vector3.forward);
            for(int i=0;i<120;i++)room.Player.Step(Vector3.forward,false,false,1f/60);
            Check(!room.DoorOpen&&room.Player.transform.position.z<8.5f,"Unsolved twin gate physically blocks walking");
            room.Restart();Capture("twin-entry");
            var run=Pick(0);while(run.MoveNext())yield return run.Current;
            Check(room.Player.Carrying,"Twin room activates carry pose");ClickReset();
            Check(room.State.Held<0&&!room.Player.Carrying&&room.State.Count(0)==0&&!room.DoorOpen,"Reset while holding releases box and closes gate");
            // Physically fill an incorrect 2:2 layout.
            for(int i=0;i<4;i++)
            {
                run=Pick(i);while(run.MoveNext())yield return run.Current;
                run=Place(i);while(run.MoveNext())yield return run.Current;
                Check(room.LitCells(i/2)==room.State.Sum(i/2),"Light cells match actual mass after placement "+i);
            }
            for(int i=0;i<90;i++)room.TickPresentation(1f/60);
            Check(!room.State.Solved&&!room.DoorOpen&&room.State.Sum(0)==3&&room.State.Sum(1)==7,"Incorrect full 2:2 arrangement stays locked");
            Check(room.PanHeight(1)<room.PanHeight(0),"Heavier twin pan descends");
            room.Player.Respawn(new Vector3(0,0,-6.3f),Vector3.forward);Capture("twin-unbalanced");
            // Swap the middle weights using the floor, as an actual player would.
            run=Pick(1);while(run.MoveNext())yield return run.Current;
            Check(room.LitCells(0)==1,"Removing a box immediately decreases the meter");
            run=Walk(new Vector3(0,0,-3));while(run.MoveNext())yield return run.Current;
            room.Player.Respawn(new Vector3(0,0,-3),Vector3.back);
            Check(room.Drop()&&!room.Player.Carrying,"Twin box can be dropped to make room for a swap");
            run=Pick(3);while(run.MoveNext())yield return run.Current;run=Place(1);while(run.MoveNext())yield return run.Current;
            Check(!room.State.Solved,"Three occupied cells never unlock the gate");
            run=Pick(1);while(run.MoveNext())yield return run.Current;run=Place(3);while(run.MoveNext())yield return run.Current;
            for(int i=0;i<120;i++)room.TickPresentation(1f/60);
            Check(room.State.Solved&&room.DoorOpen&&room.LitCells(0)==5&&room.LitCells(1)==5,"Two boxes per side with equal mass open the physical gate");
            Check(Mathf.Abs(room.PanHeight(0)-room.PanHeight(1))<.005f,"Solved pans settle level");
            Check(!room.Interact()&&!room.State.Pick(0),"Solved layout stays locked until restart");
            room.Player.Respawn(new Vector3(0,0,-6.3f),Vector3.forward);Capture("twin-balanced");
            // Avoid the decorative pillar, then cross the open gate.
            foreach(var point in new[]{new Vector3(1.3f,0,-2),new Vector3(1.3f,0,6.4f),new Vector3(0,0,7.2f),new Vector3(0,0,11.3f)}){run=Walk(point);while(run.MoveNext())yield return run.Current;}
            Check(room.Player.transform.position.z>10.9f,"Twin doorway can be crossed after completion");
            ClickReset();Check(!room.State.Solved&&!room.DoorOpen&&room.Player.transform.position.z<0&&room.LitCells(0)==0&&room.LitCells(1)==0,"Reset after gate traversal returns player safely and clears both meters");
            // Replay the already validated layout, then test the new scene boundary by walking.
            int[] destination={0,2,3,1};for(int i=0;i<4;i++){room.State.Pick(i);room.State.Place(destination[i]);}
            for(int i=0;i<100;i++)room.TickPresentation(1f/60);
            foreach(var point in new[]{new Vector3(1.3f,0,-2),new Vector3(1.3f,0,6.4f),new Vector3(0,0,7.2f),new Vector3(0,0,11.3f)}){run=Walk(point);while(run.MoveNext())yield return run.Current;}
            for(int i=0;i<18;i++)room.Player.Step(Vector3.forward,false,false,1f/60);
            for(int i=0;i<20;i++)yield return null;
            Check(SceneManager.GetActiveScene().name=="LeverBalanceTemple","Walking beyond room two enters the final lever chamber automatically");
        }
    }
}
