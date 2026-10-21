using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Mumu.Planet
{
    // Runs only inside the explicit Windows temple validation, never normal gameplay.
    public sealed class LeverTempleValidation
    {
        readonly string output;
        readonly List<string> checks;
        readonly LeverBalanceRoom room;
        readonly OrbitCamera orbit;
        readonly Animator animator;
        public LeverTempleValidation(string directory,List<string> results)
        {
            output=directory;checks=results;room=UnityEngine.Object.FindFirstObjectByType<LeverBalanceRoom>();
            orbit=UnityEngine.Object.FindFirstObjectByType<OrbitCamera>();animator=room.Player.GetComponentInChildren<Animator>();
            room.Player.enabled=false;orbit.enabled=false;
        }
        void Check(bool value,string text){if(!value)throw new InvalidOperationException(text);checks.Add(text);Debug.Log("LEVER_CHECK "+text);}
        IEnumerator Walk(Vector3 point)
        {
            point.y=0;int frames=0;
            while(Vector3.Distance(room.Player.transform.position,point)>.09f&&frames++<1500)
            {
                var delta=point-room.Player.transform.position;delta.y=0;
                room.Player.Step(delta.normalized*Mathf.Min(1,delta.magnitude*12),false,false,1f/60);animator.Update(1f/60);room.TickPresentation(1f/60);
                if(frames%30==0)yield return null;
            }
            Check(frames<1500,"Lever walk reaches "+point);room.Player.Step(Vector3.zero,false,false,1f/60);yield return null;
        }
        IEnumerator Pick(int box)
        {
            var home=room.Box(box).position;
            foreach(var point in new[]{new Vector3(5.7f,0,room.Player.transform.position.z),new Vector3(5.7f,0,home.z-1.1f),new Vector3(home.x,0,home.z-1.1f)})
            {var walk=Walk(point);while(walk.MoveNext())yield return walk.Current;}
            Check(room.Interact()&&room.State.Held==box,"Lever pickup "+box);
        }
        IEnumerator Place(int slot)
        {
            var target=room.Slot(slot);
            foreach(var point in new[]{new Vector3(5.7f,0,room.Player.transform.position.z),new Vector3(5.7f,0,target.z-1.1f),new Vector3(target.x,0,target.z-1.1f)})
            {var walk=Walk(point);while(walk.MoveNext())yield return walk.Current;}
            Check(room.Interact()&&room.State.At(slot)>=0&&room.State.Held<0,"Lever placement "+slot);
        }
        IEnumerator Shift(int direction)
        {
            var target=room.Control(direction);target.y=0;target.z-=.7f;
            foreach(var point in new[]{new Vector3(5.7f,0,room.Player.transform.position.z),new Vector3(5.7f,0,-2.8f),new Vector3(target.x,0,-2.8f),target})
            {var walk=Walk(point);while(walk.MoveNext())yield return walk.Current;}
            int pivot=room.State.Pivot;
            Check(room.Interact()&&room.State.Pivot==pivot+direction,"Physical fulcrum control moves one stop: "+direction);
            for(int i=0;i<100;i++)room.TickPresentation(1f/60);
            Check(Mathf.Abs(room.PivotX-(room.State.Pivot-3)*1.4f)<.001f,"Support reaches the selected rail stop");
        }
        void Capture(string name,bool overview=true)
        {
            animator.GetComponent<NavigatorPose>().Apply();orbit.Snap();var camera=orbit.GetComponent<Camera>();
            // A readable overview of all six cells, support, weights and game HUD.
            if(overview){camera.transform.position=new Vector3(3.3f,4.4f,-7);camera.transform.LookAt(new Vector3(0,1.3f,1.5f));}
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
            Check(hits.Exists(h=>h.gameObject==button.gameObject),"Lever reset button receives pointer input");
            ExecuteEvents.Execute(button.gameObject,click,ExecuteEvents.pointerClickHandler);
        }
        public IEnumerator Run()
        {
            int layouts=0,totalSolutions=0;
            for(int pivot=1;pivot<=5;pivot++)
            {
                int solutions=0;
                for(int a=0;a<6;a++)for(int b=0;b<6;b++)
                {
                    if(a==b)continue;
                    var state=new LeverBalanceState();while(state.Pivot!=pivot)state.Shift(pivot>state.Pivot?1:-1);
                    state.Pick(0);state.Place(a);Check(!state.Solved,"A single weight never unlocks the final gate");state.Pick(1);state.Place(b);
                    // Independent centre-of-mass oracle, rather than repeating the torque implementation.
                    bool expected=Math.Abs((2*(a+.5)+6*(b+.5))/8-pivot)<1e-8;
                    Check(state.Solved==expected,$"Lever layout pivot={pivot} light={a+1} heavy={b+1}");layouts++;if(state.Solved)solutions++;
                }
                Check(solutions>0,"Fulcrum stop "+pivot+" has a playable solution");totalSolutions+=solutions;
            }
            Check(layouts==150&&totalSolutions==8,"All 150 legal arrangements have exactly eight solutions");
            var rules=new LeverBalanceState();Check(!rules.Solved&&!rules.Pick(-1)&&!rules.Pick(2)&&!rules.Place(0)&&!rules.Shift(0)&&!rules.Shift(2),"Empty lever and invalid commands cannot solve or mutate it");
            Check(rules.Pick(0)&&!rules.Pick(1)&&rules.Place(0)&&rules.Pick(1)&&!rules.Place(0)&&!rules.Place(6)&&rules.Held==1,"Lever rejects duplicate carry and occupied or invalid slots atomically");
            Check(rules.Drop()&&rules.Location(1)==-1,"Lever drop releases ownership");rules.Reset();
            Check(rules.Shift(-1)&&!rules.Shift(-1)&&rules.Pivot==1,"Leftmost support stop is bounded");
            for(int i=0;i<4;i++)rules.Shift(1);
            Check(!rules.Shift(1)&&rules.Pivot==5&&!rules.Solved,"Rightmost stop is bounded and empty balance stays locked");
            foreach(var renderer in GameObject.Find("hall_lever Unity pivot").GetComponentsInChildren<Renderer>())
                foreach(var material in renderer.sharedMaterials)Check(material.shader.isSupported,"Supported lever hall material: "+material.name);
            room.Player.Respawn(new Vector3(0,0,7.2f),Vector3.forward);
            for(int i=0;i<120;i++)room.Player.Step(Vector3.forward,false,false,1f/60);
            Check(!room.DoorOpen&&room.Player.transform.position.z<8.5f,"Unsolved final gate physically blocks walking");
            room.Restart();Capture("lever-entry");Capture("lever-player-view",false);
            var run=Pick(0);while(run.MoveNext())yield return run.Current;
            Check(room.Player.Carrying,"Lever room activates the established carry pose");
            // Moving the support while carrying must not lose ownership.
            run=Shift(-1);while(run.MoveNext())yield return run.Current;
            Check(room.State.Held==0&&room.Player.Carrying,"Changing support preserves the held weight");
            room.Player.Step(Vector3.zero,false,true,1f/60);Check(room.Player.Grounded,"Carrying still prevents jumping");
            ClickReset();Check(!room.Player.Carrying&&room.State.Held<0&&room.State.Pivot==2&&!room.DoorOpen,"Reset releases held weight, support and gate");
            room.Player.Respawn(room.Control(1)+Vector3.back*.7f,Vector3.forward);room.Player.Step(Vector3.zero,false,true,.05f);
            Check(!room.Interact()&&room.State.Pivot==2,"Airborne input cannot change the fulcrum");room.Restart();
            // Same distances with unequal masses should tilt, not complete.
            run=Pick(0);while(run.MoveNext())yield return run.Current;run=Place(1);while(run.MoveNext())yield return run.Current;
            Check(!room.State.Solved&&!room.DoorOpen,"One placed weight leaves the physical final door locked");
            run=Pick(1);while(run.MoveNext())yield return run.Current;run=Place(3);while(run.MoveNext())yield return run.Current;
            for(int i=0;i<100;i++)room.TickPresentation(1f/60);
            Check(!room.State.Solved&&room.State.Power(0)==1&&room.State.Power(1)==9,"Incorrect ratio shows powers 1 and 9");
            Check(room.Tilt<0&&room.Slot(3).y<room.Slot(1).y,"Larger right-hand torque lowers the right side");Capture("lever-unbalanced");
            // Pick from the moving beam and safely drop, then restore the same wrong layout.
            run=Pick(0);while(run.MoveNext())yield return run.Current;
            Check(room.State.Power(0)==0,"Removing a weight immediately removes its torque");
            run=Walk(new Vector3(5.7f,0,-3.5f));while(run.MoveNext())yield return run.Current;
            room.Player.Respawn(new Vector3(5.7f,0,-3.5f),Vector3.back);Check(room.Drop()&&!room.Player.Carrying,"A beam weight can be dropped onto clear floor");
            run=Pick(0);while(run.MoveNext())yield return run.Current;run=Place(1);while(run.MoveNext())yield return run.Current;
            run=Shift(1);while(run.MoveNext())yield return run.Current;
            Check(room.State.Solved&&room.State.Power(0)==3&&room.State.Power(1)==3,"Shifting the support gives 2 x 1.5 = 6 x 0.5");
            for(int i=0;i<150;i++)room.TickPresentation(1f/60);
            Check(room.DoorOpen&&Mathf.Abs(room.Tilt)<.01f&&Mathf.Abs(room.Slot(1).y-room.Slot(3).y)<.002f,"Solved lever settles level and opens the final door");
            Check(!room.Interact()&&!room.State.Shift(1)&&!room.State.Pick(0),"Solved arrangement locks until restart");Capture("lever-balanced");
            foreach(var point in new[]{new Vector3(5.7f,0,-2.8f),new Vector3(5.7f,0,6.4f),new Vector3(0,0,7.2f),new Vector3(0,0,11.3f)})
            {run=Walk(point);while(run.MoveNext())yield return run.Current;}
            Check(room.Player.transform.position.z>10.9f,"Player can walk through the completed final gate");
            ClickReset();Check(!room.State.Solved&&!room.DoorOpen&&room.Player.transform.position.z<0&&room.State.Placed==0&&room.State.Pivot==2&&Mathf.Abs(room.Tilt)<.001f,"Reset beyond the gate safely restores the entire lever trial");
        }
    }
}
