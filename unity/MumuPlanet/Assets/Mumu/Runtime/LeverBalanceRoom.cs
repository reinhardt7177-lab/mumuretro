using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.SceneManagement;
using UnityEngine.UI;
using TMPro;

namespace Mumu.Planet
{
    public sealed class LeverBalanceRoom : MonoBehaviour
    {
        [SerializeField] PlanetExplorer player;
        [SerializeField] Transform[] boxes,slots,controls,doors;
        [SerializeField] Transform beam,beamArt,fulcrum;
        [SerializeField] Renderer[] cells,pivotMarks;
        [SerializeField] TextMeshPro[] distances;
        [SerializeField] Material dim,lit,gold;
        [SerializeField] Collider blocker;
        [SerializeField] TextMeshProUGUI goal,status,prompt;
        [SerializeField] Button reset,leave;
        [SerializeField] TempleAudience audience;
        public TempleAudience Audience=>audience;
        public void ConfigureAudience(TempleAudience value){audience=value;}
        readonly Transform[,] grips=new Transform[2,2];
        readonly Vector3[] floors=new Vector3[2];
        NavigatorPose pose;
        string message,powerLine;
        float tilt,pivotX;
        bool atEnd;
        bool loading;
        int heldOriginalSlot=-1;
        int shownPivot=-1,shownMask=-1;
        public LeverBalanceState State {get;}=new LeverBalanceState();
        public PlanetExplorer Player=>player;
        public Transform Box(int i)=>boxes[i];
        public Vector3 Slot(int i)=>slots[i].position;
        public Vector3 Control(int direction)=>controls[direction<0?0:1].position;
        public float Tilt=>tilt;
        public float PivotX=>pivotX;
        public bool DoorOpen=>!blocker.enabled;
        public float DoorAmount {get;private set;}
        public void Configure(PlanetExplorer explorer,Transform[] stock,Transform[] targets,Transform[] handles,Transform rotatingBeam,Transform art,Transform support,
            Transform[] leaves,Collider gate,Renderer[] occupancy,Renderer[] marks,TextMeshPro[] labels,Material unlit,Material light,Material solved,
            TextMeshProUGUI objective,TextMeshProUGUI feedback,TextMeshProUGUI action,Button restart,Button exit)
        {
            player=explorer;boxes=stock;slots=targets;controls=handles;beam=rotatingBeam;beamArt=art;fulcrum=support;
            doors=leaves;blocker=gate;cells=occupancy;pivotMarks=marks;distances=labels;dim=unlit;lit=light;gold=solved;
            goal=objective;status=feedback;prompt=action;reset=restart;leave=exit;
        }
        void Start()
        {
            pose=player.GetComponentInChildren<NavigatorPose>();
            for(int i=0;i<2;i++)for(int side=0;side<2;side++)
            {
                var grip=new GameObject(side==0?"Left hand grip":"Right hand grip").transform;
                grip.SetParent(boxes[i],false);grip.localPosition=new Vector3(side==0?-.38f:.38f,.4f,0);grips[i,side]=grip;
            }
            reset.onClick.AddListener(Restart);leave.onClick.AddListener(Leave);
            loading=true;Restart();
            var saved=TempleJourney.For("LeverBalanceTemple");
            if(saved!=null&&State.Restore(saved.pivot,saved.locations))
            {
                for(int i=0;i<2;i++)floors[i]=new Vector3(saved.floorX[i],0,saved.floorZ[i]);
                message="이전 배치가 복원되었습니다. 추와 지지대의 거리를 이어 비교해 보세요.";TickPresentation(0);
            }
            loading=false;Checkpoint();
        }
        void Checkpoint()
        {
            if(loading)return;
            TempleJourney.Save("LeverBalanceTemple",2,State.Pivot,
                new[]{State.Held==0?heldOriginalSlot:State.Location(0),State.Held==1?heldOriginalSlot:State.Location(1)},floors);
        }
        void OnDestroy(){if(reset!=null)reset.onClick.RemoveListener(Restart);if(leave!=null)leave.onClick.RemoveListener(Leave);}
        void ClearCarry(){player.Carrying=false;pose.SetCarry(null,null);}
        public void Restart()
        {
            if(NotebookUI.BlocksInput)return;
            if(audience!=null&&audience.IsPlaying)return;
            State.Reset();ClearCarry();DoorAmount=0;tilt=0;pivotX=-1.4f;atEnd=false;shownPivot=shownMask=-1;
            floors[0]=new Vector3(-2,0,-4.8f);floors[1]=new Vector3(2,0,-4.8f);
            message="가벼운 추를 더 멀리! 지지대를 옮겨 수평을 맞춰 보세요.";
            player.Respawn(new Vector3(0,0,-7.2f),Vector3.forward);TickPresentation(0);Checkpoint();
        }
        int Nearest(bool target)
        {
            float best=1.35f;int found=-1;
            for(int i=0;i<(target?6:2);i++)
            {
                if(target&&State.At(i)>=0)continue;
                var delta=(target?Slot(i):boxes[i].position)-player.transform.position;delta.y=0;
                if(delta.magnitude<best){best=delta.magnitude;found=i;}
            }
            return found;
        }
        int NearControl()
        {
            for(int i=0;i<2;i++)
            {
                var delta=controls[i].position-player.transform.position;delta.y=0;
                if(delta.magnitude<.85f)return i==0?-1:1;
            }
            return 0;
        }
        public bool Interact()
        {
            if(NotebookUI.BlocksInput)return false;
            if(State.Solved)return false;
            if(!player.Grounded){message="착지한 뒤 장치를 움직여 주세요.";return false;}
            int direction=NearControl();
            if(direction!=0)
            {
                bool moved=State.Shift(direction);
                message=!moved?"지지대가 끝에 있습니다. 반대쪽으로 옮겨 보세요.":State.Solved?"무게와 거리의 힘이 같아졌습니다! 마지막 문이 열립니다.":"지지대를 옮겼습니다. 추까지의 거리와 기울기를 비교하세요.";
                TickPresentation(0);if(moved)Checkpoint();return moved;
            }
            if(State.Held<0)
            {
                int box=Nearest(false);if(box<0)return false;
                int previous=State.Location(box);if(!State.Pick(box))return false;heldOriginalSlot=previous;
                boxes[box].SetParent(player.transform,false);boxes[box].localPosition=new Vector3(0,.69f,.34f);boxes[box].localRotation=Quaternion.identity;boxes[box].localScale=Vector3.one*.7f;
                player.Carrying=true;pose.SetCarry(grips[box,0],grips[box,1]);message="번호가 있는 빈 칸 앞으로 이동해 E로 놓으세요.";
            }
            else
            {
                int slot=Nearest(true);if(slot<0){message="지렛대의 빈 칸 앞으로 다가가세요.";return false;}
                if(!State.Place(slot))return false;ClearCarry();
                message=State.Solved?"수평 완성! 가벼운 추가 먼 곳에서 무거운 추를 받쳤습니다.":State.Placed==2?(State.Power(0)==0||State.Power(1)==0?"두 추가 같은 쪽에 있습니다. 지지대 양쪽에 나눠 놓으세요.":"내려간 쪽의 힘이 더 큽니다. 추의 거리나 지지대를 바꿔 보세요."):"한 추만으로는 문이 열리지 않습니다. 반대쪽에도 추를 놓으세요.";
            }
            TickPresentation(0);Checkpoint();return true;
        }
        public bool Drop()
        {
            if(NotebookUI.BlocksInput)return false;
            int held=State.Held;if(held<0||!player.Grounded)return false;
            var point=player.transform.position+player.transform.forward*.9f;point.y=.4f;
            if(Mathf.Abs(point.x)>6.3f||point.z< -7.5f||point.z>7.4f||Physics.CheckBox(point,new Vector3(.45f,.38f,.45f),Quaternion.identity,1<<8))return false;
            if(Mathf.Abs(point.x)<4.9f&&Mathf.Abs(point.z-1.5f)<1.05f)return false;
            foreach(var control in controls)if(Vector2.Distance(new Vector2(point.x,point.z),new Vector2(control.position.x,control.position.z))<1)return false;
            if(Vector3.Distance(point,boxes[1-held].position)<1)return false;
            floors[held]=new Vector3(point.x,0,point.z);State.Drop();ClearCarry();message="추를 내려놓았습니다. E로 다시 들 수 있습니다.";TickPresentation(0);Checkpoint();return true;
        }
        public void TickPresentation(float dt)
        {
            pivotX=Mathf.MoveTowards(pivotX,(State.Pivot-3)*1.4f,dt*4);
            float target=State.Solved?0:Mathf.Clamp((State.Power(0)-State.Power(1))*.65f,-7,7);
            tilt=Mathf.Lerp(tilt,target,1-Mathf.Exp(-dt*5));
            beam.localPosition=new Vector3(pivotX,1.12f,1.5f);beam.localRotation=Quaternion.Euler(0,0,tilt);
            beamArt.localPosition=new Vector3(-pivotX,0,0);fulcrum.localPosition=new Vector3(pivotX,0,1.5f);
            for(int i=0;i<6;i++)slots[i].localPosition=new Vector3((i-2.5f)*1.4f-pivotX,.21f,0);
            for(int i=0;i<2;i++)
            {
                if(State.Held==i)continue;
                int slot=State.Location(i);boxes[i].SetParent(transform,false);boxes[i].localScale=Vector3.one;
                boxes[i].position=slot<0?floors[i]:Slot(slot);boxes[i].rotation=slot<0?Quaternion.identity:beam.rotation;
            }
            if(State.Solved)DoorAmount=Mathf.MoveTowards(DoorAmount,1,dt/1.1f);
            for(int i=0;i<2;i++)doors[i].localPosition=new Vector3((i==0?-1:1)*(1.25f+DoorAmount*2.65f),0,8.65f);
            blocker.enabled=DoorAmount<.98f;
            int mask=(State.Location(0)+2)*16+State.Location(1)+2+(State.Solved?256:0);
            if(shownMask!=mask||shownPivot!=State.Pivot)
            {
                shownMask=mask;shownPivot=State.Pivot;
                for(int i=0;i<6;i++)
                {
                    cells[i].sharedMaterial=State.At(i)<0?dim:State.Solved?gold:lit;
                    distances[i].text=(i+1)+"번\n거리 "+(Mathf.Abs(State.ArmTwice(i))*.5f).ToString("0.0");
                }
                for(int i=0;i<5;i++)pivotMarks[i].sharedMaterial=i+1==State.Pivot?(State.Solved?gold:lit):dim;
                powerLine=Formula(0)+"    |    "+Formula(1);
                Set(goal,State.Solved?"여섯 칸의 지레  ·  수평 완성! 열린 문으로 이동하세요":$"여섯 칸의 지레  ·  추 {State.Placed}/2\n지지대는 {State.Pivot}번과 {State.Pivot+1}번 사이  ·  두 추를 양쪽에 놓으세요");
            }
            Set(status,message+"\n"+powerLine);
            int direction=NearControl();
            Set(prompt,State.Solved?"열린 문을 통과하세요":direction!=0?"E  지지대를 "+(direction<0?"왼쪽":"오른쪽")+"으로 한 칸":State.Held>=0?(Nearest(true)>=0?"E  빈 칸에 놓기  ·  Q  내려놓기":"빈 칸 앞으로 이동  ·  Q  내려놓기"):Nearest(false)>=0?"E  추 들기":"E  추 옮기기  ·  앞쪽 두 장치로 지지대 이동");
        }
        string Formula(int side)
        {
            string terms="";
            for(int i=0;i<2;i++)if(State.Location(i)>=0)
            {
                int arm=State.ArmTwice(State.Location(i));if((side==0&&arm>0)||(side==1&&arm<0))continue;
                if(terms.Length>0)terms+=" + ";terms+=State.Weight(i)+" × "+(Mathf.Abs(arm)*.5f).ToString("0.0");
            }
            return (side==0?"왼쪽 힘 ":"오른쪽 힘 ")+(terms.Length==0?"0":terms+" = "+State.Power(side));
        }
        static void Set(TextMeshProUGUI text,string value){if(text.text!=value)text.text=value;}
        void Update()
        {
            if(NotebookUI.BlocksInput)return;
            var k=Keyboard.current;if(k!=null&&k.eKey.wasPressedThisFrame)Interact();if(k!=null&&k.qKey.wasPressedThisFrame)Drop();
            if(!atEnd&&State.Solved&&DoorOpen&&player.transform.position.z>10.9f){atEnd=true;message="마지막 문 너머, 빛나는 균형의 신에게 다가가세요.";}
            TickPresentation(Time.deltaTime);
        }
        public void Leave(){if(NotebookUI.BlocksInput||(audience!=null&&audience.IsPlaying))return;ClearCarry();SceneManager.LoadScene("PlanetExploration");}
    }
}
