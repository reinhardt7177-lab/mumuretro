using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.SceneManagement;
using UnityEngine.UI;
using TMPro;

namespace Mumu.Planet
{
    public sealed class TwinBalanceRoom : MonoBehaviour
    {
        [SerializeField] PlanetExplorer player;
        [SerializeField] Transform[] boxes,plates,slots,doors;
        [SerializeField] Renderer[] bars,cells;
        [SerializeField] Material dim,lit,gold;
        [SerializeField] Collider blocker;
        [SerializeField] TextMeshProUGUI goal,status,prompt;
        [SerializeField] Button reset,leave;
        readonly Transform[,] grips=new Transform[4,2];
        readonly Vector3[] floors=new Vector3[4];
        NavigatorPose pose;
        string message;
        bool atEnd;
        bool loading;
        public TwinBalanceState State {get;}=new TwinBalanceState();
        public PlanetExplorer Player=>player;
        public Transform Box(int i)=>boxes[i];
        public Vector3 Slot(int i)=>slots[i].position;
        public bool DoorOpen=>!blocker.enabled;
        public float DoorAmount {get;private set;}
        public float PanHeight(int side)=>plates[side].position.y;
        public int LitCells(int side){int n=0;for(int i=0;i<10;i++)if(bars[side*10+i].sharedMaterial!=dim)n++;return n;}
        public void Configure(PlanetExplorer explorer,Transform[] stock,Transform[] pans,Transform[] targets,Transform[] leaves,Collider gate,
            Renderer[] meters,Renderer[] occupancy,Material unlit,Material light,Material solved,TextMeshProUGUI objective,TextMeshProUGUI feedback,TextMeshProUGUI action,Button restart,Button exit)
        {
            player=explorer;boxes=stock;plates=pans;slots=targets;doors=leaves;blocker=gate;bars=meters;cells=occupancy;dim=unlit;lit=light;gold=solved;
            goal=objective;status=feedback;prompt=action;reset=restart;leave=exit;
        }
        void Start()
        {
            pose=player.GetComponentInChildren<NavigatorPose>();
            for(int i=0;i<4;i++)for(int side=0;side<2;side++)
            {
                var grip=new GameObject(side==0?"Left hand grip":"Right hand grip").transform;
                grip.SetParent(boxes[i],false);grip.localPosition=new Vector3(side==0?-.38f:.38f,.40f,0);grips[i,side]=grip;
            }
            reset.onClick.AddListener(Restart);leave.onClick.AddListener(Leave);
            loading=true;Restart();
            var saved=TempleJourney.For("TwinBalanceTemple");
            if(saved!=null&&State.Restore(saved.locations))
            {
                for(int i=0;i<4;i++)floors[i]=new Vector3(saved.floorX[i],0,saved.floorZ[i]);
                message="이전 배치가 복원되었습니다. 두 판의 균형을 이어 맞춰 보세요.";TickPresentation(0);
            }
            loading=false;Checkpoint();
        }
        void Checkpoint()
        {
            if(loading||State.Held>=0)return;
            var locations=new int[4];for(int i=0;i<4;i++)locations[i]=State.Location(i);
            TempleJourney.Save("TwinBalanceTemple",4,2,locations,floors);
        }
        void ClearCarry(){player.Carrying=false;pose.SetCarry(null,null);}
        public void Restart()
        {
            if(NotebookUI.BlocksInput)return;
            State.Reset();ClearCarry();DoorAmount=0;atEnd=false;
            int[] order={2,0,3,1};for(int i=0;i<4;i++)floors[i]=new Vector3((order[i]-1.5f)*1.7f,0,-4.8f);
            for(int side=0;side<2;side++)plates[side].position=new Vector3(side==0?-3:3,.32f,1.5f);
            message="한 상자를 올리고 빛의 칸이 얼마나 차는지 보세요. 크기와 무게는 다릅니다.";
            player.Respawn(new Vector3(0,0,-7.2f),Vector3.forward);TickPresentation(0);Checkpoint();
        }
        int Nearest(bool target)
        {
            float best=1.35f;int found=-1;
            for(int i=0;i<4;i++)
            {
                if(target&&State.At(i)>=0)continue;
                var delta=(target?Slot(i):boxes[i].position)-player.transform.position;delta.y=0;
                if(delta.magnitude<best){best=delta.magnitude;found=i;}
            }
            return found;
        }
        public bool Interact()
        {
            if(NotebookUI.BlocksInput)return false;
            if(State.Solved)return false;
            if(!player.Grounded){message="착지한 뒤 상자를 옮겨 주세요.";return false;}
            if(State.Held<0)
            {
                int box=Nearest(false);if(box<0||!State.Pick(box))return false;
                boxes[box].SetParent(player.transform,false);boxes[box].localPosition=new Vector3(0,.69f,.34f);boxes[box].localRotation=Quaternion.identity;boxes[box].localScale=Vector3.one*.7f;
                player.Carrying=true;pose.SetCarry(grips[box,0],grips[box,1]);message="빈 칸 앞으로 이동해 E로 놓으세요. Q는 바닥에 내려놓기입니다.";
            }
            else
            {
                int slot=Nearest(true);if(slot<0){message="판 위의 빈 칸 앞으로 다가가세요.";return false;}
                if(!State.Place(slot))return false;ClearCarry();
                message=State.Solved?"두 개씩, 같은 무게! 균형을 맞추어 문이 열립니다.":State.Count(0)+State.Count(1)==4?"네 칸은 찼지만 무게가 다릅니다. 양쪽 상자를 하나씩 바꿔 보세요.":"상자를 놓았습니다. 더 많이 빛나는 판이 무겁고 아래로 내려갑니다.";
            }
            TickPresentation(0);Checkpoint();return true;
        }
        public bool Drop()
        {
            if(NotebookUI.BlocksInput)return false;
            int held=State.Held;if(held<0)return false;
            var point=player.transform.position+player.transform.forward*.9f;point.y=.4f;
            if(Mathf.Abs(point.x)>6.3f||point.z< -7.5f||point.z>7.4f||Physics.CheckBox(point,new Vector3(.45f,.38f,.45f),Quaternion.identity,1<<8))return false;
            // Keep loose boxes out of pan surfaces and other boxes.
            foreach(var plate in plates)if(Vector2.Distance(new Vector2(point.x,point.z),new Vector2(plate.position.x,plate.position.z))<1.7f)return false;
            for(int i=0;i<4;i++)if(i!=held&&Vector3.Distance(point,boxes[i].position)<1)return false;
            floors[held]=new Vector3(point.x,0,point.z);State.Drop();ClearCarry();message="내려놓았습니다. E로 다시 들 수 있습니다.";TickPresentation(0);Checkpoint();return true;
        }
        public void TickPresentation(float dt)
        {
            for(int side=0;side<2;side++)
            {
                int sum=State.Sum(side);var pos=plates[side].position;
                float height=.32f+Mathf.Clamp((State.Sum(1-side)-sum)*.035f,-.18f,.18f);
                pos.y=Mathf.Lerp(pos.y,height,1-Mathf.Exp(-dt*6));plates[side].position=pos;
                for(int i=0;i<10;i++)bars[side*10+i].sharedMaterial=i<sum?(State.Solved?gold:lit):dim;
            }
            for(int i=0;i<4;i++)
            {
                cells[i].sharedMaterial=State.At(i)<0?dim:State.Solved?gold:lit;
                if(State.Held==i)continue;
                boxes[i].SetParent(transform,false);boxes[i].rotation=Quaternion.identity;
                boxes[i].localScale=Vector3.one*(i==0?1.02f:i==1?.88f:i==2?1.1f:.96f);
                boxes[i].position=State.Location(i)<0?floors[i]:Slot(State.Location(i));
            }
            if(State.Solved)DoorAmount=Mathf.MoveTowards(DoorAmount,1,dt/1.1f);
            for(int i=0;i<2;i++)doors[i].localPosition=new Vector3((i==0?-1:1)*(1.25f+DoorAmount*2.65f),0,8.65f);
            blocker.enabled=DoorAmount<.98f;
            Set(goal,State.Solved?"두 판의 균형  ·  성공! 열린 문으로 이동하세요":$"두 판의 균형  ·  왼쪽 {State.Count(0)}/2  ·  오른쪽 {State.Count(1)}/2\n각 판에 두 개씩 놓아 빛의 높이를 같게 맞추세요");
            Set(status,message);
            Set(prompt,State.Solved?"열린 문을 통과하세요":State.Held>=0?(Nearest(true)>=0?"E  빈 칸에 놓기  ·  Q  내려놓기":"빈 칸 앞으로 이동  ·  Q  내려놓기"):Nearest(false)>=0?"E  상자 들기":"W A S D  이동  ·  마우스 오른쪽  시점 회전");
        }
        static void Set(TextMeshProUGUI text,string value){if(text.text!=value)text.text=value;}
        void Update()
        {
            if(NotebookUI.BlocksInput)return;
            var k=Keyboard.current;if(k!=null&&k.eKey.wasPressedThisFrame)Interact();if(k!=null&&k.qKey.wasPressedThisFrame)Drop();
            TickPresentation(Time.deltaTime);
            if(!atEnd&&State.Solved&&DoorOpen&&player.transform.position.z>11.9f){atEnd=true;ClearCarry();SceneManager.LoadScene("LeverBalanceTemple");}
        }
        public void Leave(){if(NotebookUI.BlocksInput)return;ClearCarry();SceneManager.LoadScene("PlanetExploration");}
    }
}
