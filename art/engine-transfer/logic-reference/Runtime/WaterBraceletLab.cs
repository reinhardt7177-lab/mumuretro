using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.EventSystems;
using TMPro;

namespace Mumu.Planet
{
    public sealed class WaterBraceletLab : MonoBehaviour
    {
        public PlanetExplorer player;
        public Camera view;
        public NavigatorPose pose;
        public Transform pedestal, cuff, wrist, collectorDrop, returnDrop;
        public WaterBraceletTarget[] targets;
        public WaterBraceletTarget collector, receiver, recovery;
        public TextMeshProUGUI instruction, status;
        public LineRenderer beam, flow;
        public WaterIceRoom iceRoom;
        public WaterCollectionRoom collectionRoom;
        public bool Acquired { get; private set; }
        public bool Mode { get; private set; }
        public bool Heating { get; private set; } = true;
        public WaterBraceletTarget Selected { get; private set; }
        readonly WaterPhasePress press = new WaterPhasePress();
        WaterBraceletTarget working;
        bool plateWorking, needsRelease;
        string notice = "제단의 물의 팔찌를 찾아 가까이에서 E를 누르세요.";
        public float TotalWater { get { float sum=0;foreach(var t in targets)sum+=t.Water.Total;return sum; } }
        void Start() { foreach(var t in targets)t.Initialize(); }
        public bool TryAcquire()
        {
            if(Acquired || Vector3.Distance(player.transform.position,pedestal.position)>2.5f)return false;
            RestoreAcquired();return true;
        }
        public void RestoreAcquired()
        {
            Acquired=true;Mode=true;
            cuff.SetParent(wrist,false);cuff.localPosition=Vector3.zero;
            cuff.localRotation=Quaternion.FromToRotation(Vector3.up,wrist.InverseTransformDirection(wrist.position-wrist.parent.position));
            var scale=wrist.lossyScale;
            cuff.localScale=new Vector3(.075f/Mathf.Max(.00001f,Mathf.Abs(scale.x)),.075f/Mathf.Max(.00001f,Mathf.Abs(scale.y)),.075f/Mathf.Max(.00001f,Mathf.Abs(scale.z)));
            notice="팔찌를 얻었습니다. F 모드 · 1 가열 / 2 냉각 · 대상을 가리키고 왼쪽 버튼을 누르세요.";
        }
        public bool CanReach(WaterBraceletTarget t)
        {
            var origin=player.transform.position+player.Up;
            if(t==null||Vector3.Distance(origin,t.transform.position)>6)return false;
            bool blocked=Physics.Linecast(origin,t.transform.position+Vector3.up*.35f,out var obstruction,(1<<8)|(1<<9),QueryTriggerInteraction.Ignore);
            return !blocked||obstruction.collider.GetComponentInParent<WaterBraceletTarget>()==t;
        }
        public bool BeginUse(WaterBraceletTarget t,bool heat)
        {
            Cancel();
            if(!Acquired||!Mode||NotebookUI.BlocksInput||player.Carrying||player.InputLocked||!CanReach(t)||!t.acceptsPower)return false;
            Heating=heat;working=t;
            if(t.collector){plateWorking=heat?t.Cold>0:t.Cold<1;if(!plateWorking)Cancel();return plateWorking;}
            bool started=press.Begin(t.Water,heat);if(!started)Cancel();return started;
        }
        public void AdvanceUse(float dt)
        {
            if(working==null)return;
            if(NotebookUI.BlocksInput||player.Carrying||!CanReach(working)){Cancel();return;}
            if(plateWorking)
            {
                working.CoolPlate(Heating,dt);
                if(Heating?working.Cold<=0:working.Cold>=1){Cancel();notice="집수판 준비 완료. 버튼을 놓고 다음 대상을 선택하세요.";}
            }
            else if(press.Tick(dt)){Cancel();notice="한 단계 완료. 더 바꾸려면 버튼을 놓고 다시 누르세요.";}
        }
        public void Cancel(){press.Cancel();plateWorking=false;working=null;if(beam!=null)beam.enabled=false;if(pose!=null)pose.SetWaterAim(false,Vector3.zero);}
        public void SimulateFlow(float dt)
        {
            if(collectionRoom!=null){collectionRoom.TickFlow(dt);return;}
            if(iceRoom!=null){iceRoom.TickFlow(dt);return;}
            flow.enabled=false;
            foreach(var t in targets)
            {
                if(t.collector)continue;
                float amount=Mathf.Min(t.Water.vapour,Mathf.Max(0,dt)*1.5f);
                if(amount<=0)continue;
                var destination=collector.Cold>=.999f?receiver:recovery;
                t.Water.vapour-=amount;destination.Water.liquid+=amount;
                flow.enabled=true;flow.SetPosition(0,t.transform.position+Vector3.up*.3f);
                flow.SetPosition(1,collector.transform.position+Vector3.up*.5f);
                flow.SetPosition(2,(destination==receiver?collectorDrop:returnDrop).position);
                flow.SetPosition(3,destination.transform.position);
            }
        }
        public bool Pump()
        {
            if(collectionRoom!=null)return collectionRoom.TryInteract();
            if(iceRoom!=null)return iceRoom.TryInteract();
            if(Vector3.Distance(player.transform.position,recovery.transform.position)>2.5f)return false;
            targets[0].Water.liquid+=recovery.Water.liquid+receiver.Water.liquid;
            recovery.Water.liquid=receiver.Water.liquid=0;
            notice="회수한 물을 처음 수조로 돌려보냈습니다.";return true;
        }
        void Update()
        {
            var k=Keyboard.current;var m=Mouse.current;if(k==null||m==null)return;
            bool blocked=NotebookUI.BlocksInput||player.Carrying||Time.timeScale==0;
            if(blocked){Cancel();needsRelease=true;return;}
            if(k.eKey.wasPressedThisFrame){if(!Acquired)TryAcquire();else Pump();}
            if(Acquired&&k.fKey.wasPressedThisFrame){Mode=!Mode;Cancel();needsRelease=true;}
            if(k.escapeKey.wasPressedThisFrame){Mode=false;Cancel();needsRelease=true;}
            if(Mode&&(k.digit1Key.wasPressedThisFrame||k.digit2Key.wasPressedThisFrame))
            {Heating=k.digit1Key.wasPressedThisFrame;Cancel();needsRelease=true;}
            Selected=null;
            bool overUI=EventSystem.current!=null&&EventSystem.current.IsPointerOverGameObject();
            if(Mode&&!overUI&&Physics.Raycast(view.ScreenPointToRay(m.position.ReadValue()),out var hit,60,~0,QueryTriggerInteraction.Collide))
                Selected=hit.collider.GetComponentInParent<WaterBraceletTarget>();
            if(!m.leftButton.isPressed){needsRelease=false;Cancel();}
            if(overUI||Selected!=working&&working!=null){Cancel();needsRelease=true;}
            if(Mode&&!overUI&&m.leftButton.wasPressedThisFrame&&!needsRelease)
            {needsRelease=true;if(!BeginUse(Selected,Heating))notice="물을 담은 문양 장치를 6m 안에서 조준하세요.";}
            if(working!=null&&m.leftButton.isPressed)AdvanceUse(Mathf.Min(Time.deltaTime,.05f));
            if(working!=null)pose.SetWaterAim(true,working.transform.position);
            SimulateFlow(Mathf.Min(Time.deltaTime,.05f));
            foreach(var t in targets)t.Present(t==Selected&&CanReach(t));
            RefreshHud();
        }
        public void RefreshHud()
        {
            if(collectionRoom!=null){instruction.text=collectionRoom.Objective;status.text=collectionRoom.Hint;return;}
            if(iceRoom!=null&&iceRoom.cycle!=null){instruction.text=iceRoom.cycle.Objective;status.text=iceRoom.cycle.Hint;return;}
            instruction.text=Acquired?"물의 팔찌 시험실  ·  집수판을 냉각한 뒤 물을 기화시켜 모아 보세요":"물의 팔찌 시험실  ·  제단에서 팔찌 찾기 [E]";
            if(iceRoom!=null)instruction.text=iceRoom.Objective;
            status.text=notice+"\n"+(Mode?(Heating?"가열 선택":"냉각 선택")+" · "+(Selected!=null?Selected.displayName+(CanReach(Selected)?"":" · 너무 멀거나 벽에 가려짐"):"물결 문양 장치를 조준하세요") :"F 팔찌 켜기")+"\nN 수첩 · 오른쪽 드래그 카메라 · 회수 펌프 옆 E";
            if(iceRoom!=null)status.text=(Mode?(Heating?"가열":"냉각")+" · "+(Selected!=null?Selected.displayName:"물결 장치를 가리키세요"):"F 팔찌 켜기")+"\n1 가열 · 2 냉각 · 왼쪽 버튼 누르기 · E 장치 조작 · N 수첩\n"+iceRoom.Hint;
            if(iceRoom!=null&&iceRoom.cycle==null)
            {
                string control=!Acquired?"E 팔찌 얻기 · N 수첩":!Mode?"F 팔찌 켜기":Selected!=null&&!CanReach(Selected)?"대상이 너무 멀거나 벽에 가려져 있습니다 · 가까이 이동하세요":(Heating?"1 가열":"2 냉각")+" · "+(Selected!=null?Selected.displayName:"물결 장치를 가리키세요");
                status.text=iceRoom.Hint+"\n"+control+(Acquired?"\n1 가열 · 2 냉각 · 왼쪽 버튼 누르기 · E 장치 조작 · N 수첩":"");
            }
        }
        void LateUpdate()
        {
            if(collectionRoom!=null&&!NotebookUI.BlocksInput){instruction.text=collectionRoom.Objective;status.text=collectionRoom.Hint;}
            if(working==null)return;
            beam.enabled=true;beam.SetPosition(0,wrist.position);beam.SetPosition(1,working.transform.position);
            beam.startColor=beam.endColor=Heating?new Color(1,.65f,.2f):new Color(.4f,.9f,1);
        }
        void OnDisable(){Cancel();if(flow!=null)flow.enabled=false;}
    }
}


