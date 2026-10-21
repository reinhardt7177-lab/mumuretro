using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.SceneManagement;
using TMPro;

namespace Mumu.Planet
{
    public sealed class BalanceRoom : MonoBehaviour
    {
        [SerializeField] PlanetExplorer player;
        [SerializeField] NavigatorPose pose;
        [SerializeField] Transform[] boxes,pads,panSlots,doors;
        [SerializeField] Transform beam,leftPan,rightPan;
        [SerializeField] Collider doorBlocker;
        [SerializeField] TextMeshProUGUI goal,status,prompt;
        [SerializeField] UnityEngine.UI.Button[] choices;
        [SerializeField] UnityEngine.UI.Button reset,leave;
        readonly Vector3[] floors=new Vector3[5];
        readonly Transform[,] grips=new Transform[5,2];
        readonly int[] homeOrder={2,0,4,1,3};
        readonly float[] sizes={1.06f,.82f,1.18f,.94f,1};
        public BalanceOrderState State { get; }=new BalanceOrderState();
        public PlanetExplorer Player=>player;
        public Transform Box(int i)=>boxes[i];
        public Vector3 Slot(int i)=>i<5?pads[i].position+Vector3.up*.24f:panSlots[i-5].position;
        public bool DoorOpen=>doorBlocker!=null&&!doorBlocker.enabled;
        public float DoorAmount {get;private set;}
        float tilt;
        bool enteringNext;
        bool loading;
        string message="상자의 크기는 무게의 힌트가 아닙니다. 두 접시에 올려 비교해 보세요.";
        public void Configure(PlanetExplorer p,Transform[] stock,Transform[] orderPads,Transform[] pans,Transform scaleBeam,Transform lPan,Transform rPan,Transform[] leaves,Collider blocker,
            TextMeshProUGUI objective,TextMeshProUGUI info,TextMeshProUGUI action,UnityEngine.UI.Button[] difficulty,UnityEngine.UI.Button restart,UnityEngine.UI.Button exit)
        {
            player=p;pose=p.GetComponentInChildren<NavigatorPose>();boxes=stock;pads=orderPads;panSlots=pans;beam=scaleBeam;leftPan=lPan;rightPan=rPan;doors=leaves;doorBlocker=blocker;
            goal=objective;status=info;prompt=action;choices=difficulty;reset=restart;leave=exit;
        }
        void Start()
        {
            for(int i=0;i<5;i++)for(int side=0;side<2;side++)
            {
                var grip=new GameObject(side==0?"Left hand grip":"Right hand grip").transform;
                grip.SetParent(boxes[i],false);grip.localPosition=new Vector3(side==0?-.38f:.38f,.40f,0);grips[i,side]=grip;
            }
            for(int i=0;i<3;i++){int count=i+3;choices[i].onClick.AddListener(()=>Select(count));}
            reset.onClick.AddListener(Restart);leave.onClick.AddListener(Leave);
            loading=true;Select(3);
            var saved=TempleJourney.For("WeightTemple");
            if(saved!=null)
            {
                Select(saved.count);
                if(State.Restore(saved.count,saved.locations))
                {
                    for(int i=0;i<saved.count;i++)floors[i]=new Vector3(saved.floorX[i],0,saved.floorZ[i]);
                    message="이전 배치가 복원되었습니다. 이어서 무게를 비교해 보세요.";SyncBoxes();RefreshHud();
                }
            }
            loading=false;Checkpoint();
        }
        void Checkpoint()
        {
            if(loading||State.Held>=0)return;
            var locations=new int[State.Count];var positions=new Vector3[State.Count];
            for(int i=0;i<State.Count;i++){locations[i]=State.Location(i);positions[i]=floors[i];}
            TempleJourney.Save("WeightTemple",State.Count,2,locations,positions);
        }
        public bool Select(int count)
        {
            if(NotebookUI.BlocksInput)return false;
            if(!State.Select(count))return false;
            ClearCarry();
            int rank=0;
            for(int home=0;home<5;home++)for(int i=0;i<count;i++)if(homeOrder[i]==home)floors[i]=new Vector3((rank++-(count-1)*.5f)*1.7f,0,-4.8f);
            for(int i=0;i<5;i++) {boxes[i].gameObject.SetActive(i<count);pads[i].gameObject.SetActive(i<count);pads[i].position=new Vector3((i-(count-1)*.5f)*2,.0f,5.3f);}
            message=$"{count}개 도전 시작 · 두 상자를 저울로 비교해 보세요.";
            SyncBoxes();RefreshHud();Checkpoint();return true;
        }
        public void Restart()
        {
            if(NotebookUI.BlocksInput)return;
            State.Reset();DoorAmount=0;doorBlocker.enabled=true;Select(State.Count);
            player.Respawn(new Vector3(0,0,-7.2f),Vector3.forward);
        }
        void ClearCarry() { player.Carrying=false;pose.SetCarry(null,null); }
        int Nearest(bool slot)
        {
            float best=1.4f;int found=-1;
            int total=slot?7:State.Count;
            for(int i=0;i<total;i++)
            {
                if(slot&&((i>=State.Count&&i<5)||State.At(i)>=0))continue;
                Vector3 p=slot?Slot(i):boxes[i].position;
                float distance=Vector2.Distance(new Vector2(p.x,p.z),new Vector2(player.transform.position.x,player.transform.position.z));
                if(distance<best){best=distance;found=i;}
            }
            return found;
        }
        public bool Interact()
        {
            if(NotebookUI.BlocksInput)return false;
            if(State.Solved)return false;
            if(!player.Grounded){message="바닥에 착지한 뒤 상자를 옮겨 주세요.";return false;}
            if(State.Held<0)
            {
                int box=Nearest(false);if(box<0||!State.Pick(box))return false;
                boxes[box].SetParent(player.transform,false);boxes[box].localPosition=new Vector3(0,.69f,.34f);boxes[box].localRotation=Quaternion.identity;boxes[box].localScale=Vector3.one*.70f;
                player.Carrying=true;pose.SetCarry(grips[box,0],grips[box,1]);message="저울 또는 빈 받침대 앞으로 이동하세요. Q는 바닥에 내려놓기입니다.";
            }
            else
            {
                int slot=Nearest(true);if(slot<0){message="빈 받침대에 가까이 가세요. 바닥에는 Q로 내려놓을 수 있습니다.";return false;}
                if(!State.Place(slot))return false;ClearCarry();SyncBoxes();Checkpoint();
                if(State.Solved)message="순서를 알아냈습니다! 열린 문을 지나 빛나는 문양으로 가세요.";
                else if(State.Placed==State.Count)message="순서가 다릅니다. 상자를 다시 들어 저울로 비교해 보세요.";
                else message=slot>=5?"저울에 놓았습니다. 내려가는 쪽이 더 무겁습니다.":"받침대에 놓았습니다. 왼쪽부터 가벼운 순서로 채워 주세요.";
            }
            RefreshHud();return true;
        }
        public bool Drop()
        {
            if(NotebookUI.BlocksInput)return false;
            int held=State.Held;if(held<0)return false;
            var point=player.transform.position+player.transform.forward*.9f;point.y=.4f;
            if(Physics.CheckBox(point,new Vector3(.45f,.38f,.45f),Quaternion.identity,1<<8)||Mathf.Abs(point.x)>6.3f||point.z>7.4f||point.z< -7.5f)
            {message="여기에는 공간이 부족합니다. 조금 옆으로 이동해 주세요.";return false;}
            for(int i=0;i<State.Count;i++)if(i!=held&&Vector3.Distance(boxes[i].position,point)<1f){message="다른 상자와 조금 떨어져 내려놓으세요.";return false;}
            floors[held]=new Vector3(point.x,0,point.z);State.Drop();ClearCarry();SyncBoxes();Checkpoint();message="바닥에 내려놓았습니다. E로 다시 들 수 있습니다.";return true;
        }
        string Comparison()
        {
            int left=State.At(5),right=State.At(6);
            if(left<0||right<0)return "저울의 양쪽 접시에 상자를 하나씩 올리세요.";
            return State.Compare()>0?"왼쪽 상자가 더 무겁습니다. 아래로 내려간 쪽을 살펴보세요.":"오른쪽 상자가 더 무겁습니다. 아래로 내려간 쪽을 살펴보세요.";
        }
        void SyncBoxes()
        {
            for(int i=0;i<State.Count;i++)
            {
                if(State.Held==i)continue;
                boxes[i].SetParent(transform,false);boxes[i].rotation=Quaternion.identity;boxes[i].localScale=Vector3.one*sizes[i];
                boxes[i].position=State.Location(i)>=0?Slot(State.Location(i)):floors[i];
            }
        }
        public void TickPresentation(float dt)
        {
            int left=State.At(5),right=State.At(6);
            float target=Mathf.Sign((left<0?0:State.Weight(left))-(right<0?0:State.Weight(right)))*10f;
            if(left<0&&right<0)target=0;
            tilt=Mathf.Lerp(tilt,target,1-Mathf.Exp(-dt*5));
            beam.localRotation=Quaternion.Euler(0,0,tilt);leftPan.localRotation=rightPan.localRotation=Quaternion.Euler(0,0,-tilt);
            if(State.Solved)DoorAmount=Mathf.MoveTowards(DoorAmount,1,dt/1.1f);
            for(int i=0;i<2;i++)doors[i].localPosition=new Vector3((i==0?-1:1)*(1.25f+DoorAmount*2.65f),0,8.65f);
            doorBlocker.enabled=DoorAmount<.98f;
            SyncBoxes();RefreshHud();
        }
        void RefreshHud()
        {
            Set(goal,State.Solved?"무게의 회랑  ·  문이 열렸습니다":$"무게의 회랑  ·  {State.Count}개 도전  ·  {State.Placed}/{State.Count} 배치\n왼쪽 1번부터 가벼운 순서대로 놓으세요");
            Set(status,message+(State.At(5)>=0&&State.At(6)>=0?"\n"+Comparison():""));
            int near=Nearest(State.Held>=0);
            Set(prompt,State.Solved?"열린 문을 통과하세요":State.Held>=0?(near>=0?(near>=5?"E  저울에 놓기":"E  받침대에 놓기"):"빈 받침대 가까이 이동  ·  Q  내려놓기"):near>=0?"E  상자 들기":"W A S D  이동  ·  마우스 오른쪽  시점 회전");
            for(int i=0;i<3;i++){choices[i].interactable=!State.Solved;choices[i].image.color=i+3==State.Count?new Color(.57f,.40f,.16f):new Color(.08f,.20f,.22f);}
        }
        static void Set(TextMeshProUGUI text,string value){if(text.text!=value)text.text=value;}
        void Update()
        {
            if(NotebookUI.BlocksInput)return;
            var keyboard=Keyboard.current;
            if(keyboard!=null&&keyboard.eKey.wasPressedThisFrame)Interact();
            if(keyboard!=null&&keyboard.qKey.wasPressedThisFrame)Drop();
            TickPresentation(Time.deltaTime);
            if(!enteringNext&&State.Solved&&DoorOpen&&player.transform.position.z>11.9f)
            {enteringNext=true;ClearCarry();SceneManager.LoadScene("TwinBalanceTemple");}
        }
        public void Leave() { if(NotebookUI.BlocksInput)return;ClearCarry();SceneManager.LoadScene("PlanetExploration"); }
    }
}
