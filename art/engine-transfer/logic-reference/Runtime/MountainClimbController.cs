using System.Collections;
using UnityEngine;
using UnityEngine.InputSystem;

namespace Mumu.Planet
{
    // Authored handhold graph for the water mountain. Movement between contacts
    // is continuous; the rock face never becomes a one-button elevator.
    [DefaultExecutionOrder(-200)]
    public sealed class MountainClimbController : MonoBehaviour
    {
        public enum ClimbAction { Up, Right, Left, Leap, Mantle, Release }
        [SerializeField] PlanetExplorer player;
        [SerializeField] Transform mountain,baseGrip;
        [SerializeField] Transform[] holds,walk;
        [SerializeField] NavigatorPose pose;
        bool moving,hanging,firstLedge,summit;
        int holdIndex=-1;
        int checkpointIndex=-1;
        bool charging;
        float charge;
        string feedback="";
        struct Contacts { public Vector3 leftHand,rightHand,leftFoot,rightFoot;public float leftSupport,rightSupport; }
        Contacts[] contacts;
        bool[] cachedContacts;
        public string LastFeedback=>feedback;
        public Vector3 WallForward=>mountain.forward;
        public Vector3 WallUp=>mountain.up;
        public bool CanPrepareLeap=>hanging&&!moving&&holdIndex==5;
        public float LeapPreparation=>charging?Mathf.Clamp01(charge/.35f):0;
        public Vector3 SafePosition=>checkpointIndex<0?baseGrip.position:walk[checkpointIndex].position;
        public string Hint=>charging?(charge>=.35f?"준비 완료 · 오른쪽 위 방향을 유지하고 Space를 놓으세요":"도약 준비 중 · 오른쪽 위 + Space 유지"):
            !string.IsNullOrEmpty(feedback)?feedback:holdIndex==5?"오른쪽 위에 다음 틈이 있다 · W+D + Space를 길게 누른 뒤 놓기":
            holdIndex==2||holdIndex==3?"오른쪽으로 이어진 틈을 따라 D · A로 되돌아가기":
            holdIndex==7||holdIndex==9?"머리 위 선반 · E로 올라서기":"W 위로 · A/D 옆으로 · Q 놓기";
        public bool IsHanging=>hanging;
        public bool IsMoving=>moving;
        public bool ReachedFirstLedge=>firstLedge;
        public bool ReachedSummit=>summit;
        public int HoldIndex=>holdIndex;
        public Transform[] Holds=>holds;
        public Transform[] Walk=>walk;
        public Vector3 GuidanceTarget
        {
            get
            {
                if(summit)return walk[5].position;
                if(!hanging)return firstLedge?walk[4].position:baseGrip.position;
                if(holdIndex==7)return walk[0].position;
                if(holdIndex==9)return walk[5].position;
                return holds[Mathf.Min(holdIndex+1,holds.Length-1)].position;
            }
        }
        public void Configure(PlanetExplorer explorer,Transform rock,Transform start,Transform[] contacts,Transform[] path,NavigatorPose navigator)
        {player=explorer;mountain=rock;baseGrip=start;holds=contacts;walk=path;pose=navigator;}

        Vector3 HangPosition(int index)
        {var c=ContactAt(index);return (c.leftHand+c.rightHand)*.5f-mountain.up*1.4f-mountain.forward*.23f;}
        Contacts ContactAt(int index)
        {
            if(contacts==null){contacts=new Contacts[holds.Length];cachedContacts=new bool[holds.Length];}
            if(cachedContacts[index])return contacts[index];
            var point=holds[index].position;
            var c=new Contacts {
                leftHand=HandContact(point-mountain.right*.17f),
                rightHand=HandContact(point+mountain.right*.17f)};
            var root=(c.leftHand+c.rightHand)*.5f-mountain.up*1.4f-mountain.forward*.23f;
            c.leftFoot=FootContact(point,root,-1);c.rightFoot=FootContact(point,root,1);
            c.leftSupport=Vector3.Distance(root+mountain.up*.72f-mountain.right*.075f,c.leftFoot)<.58f?1:0;
            c.rightSupport=Vector3.Distance(root+mountain.up*.72f+mountain.right*.075f,c.rightFoot)<.58f?1:0;
            contacts[index]=c;cachedContacts[index]=true;return c;
        }
        Vector3 HandContact(Vector3 point)
        {
            if(Physics.Raycast(point-mountain.forward*1.5f,mountain.forward,out var hit,3f,1<<8,QueryTriggerInteraction.Ignore))
                return hit.point-mountain.forward*.055f+mountain.up*.055f;
            return point-mountain.forward*.11f+mountain.up*.055f;
        }
        Vector3 FootContact(Vector3 grip,Vector3 root,float side)
        {
            // Find a reachable purchase below this handhold, including the
            // previous grip. Cache the small search once per static contact.
            var hip=root+mountain.up*.72f+mountain.right*(side*.075f);
            var best=grip-mountain.up*.9f;float score=float.PositiveInfinity;
            for(int row=0;row<6;row++)for(int column=0;column<3;column++)
            {
                float drop=.74f+row*.09f,offset=side*(.10f+column*.085f);
                var origin=grip+mountain.right*offset-mountain.up*drop-mountain.forward*1.5f;
                if(!Physics.Raycast(origin,mountain.forward,out var hit,3f,1<<8,QueryTriggerInteraction.Ignore))continue;
                var candidate=hit.point-mountain.forward*.08f+mountain.up*.06f;
                float distance=Vector3.Distance(hip,candidate);
                float cost=Mathf.Max(0,distance-.55f)*4+Mathf.Abs(drop-.94f)*.15f+distance*.1f;
                if(cost<score){score=cost;best=candidate;}
            }
            return best;
        }
        void PresentContact(int index)
        {
            if(pose==null)return;var c=ContactAt(index);
            pose.SetClimbing(true,index);pose.SetClimbContacts(c.leftHand,c.rightHand,c.leftFoot,c.rightFoot,1,c.leftSupport,c.rightSupport);
        }
        void PresentTransition(int from,int target,float t,bool airborne)
        {
            if(pose==null)return;
            var next=ContactAt(target);var previous=ContactAt(from<0?target:from);
            float first=Mathf.SmoothStep(0,1,Mathf.InverseLerp(0,.65f,t));
            float second=Mathf.SmoothStep(0,1,Mathf.InverseLerp(.3f,1,t));
            float feet=Mathf.SmoothStep(0,1,Mathf.InverseLerp(.2f,1,t));
            bool rightFirst=target%2==0;
            float l=rightFirst?second:first,r=rightFirst?first:second;
            float grip=airborne?Mathf.SmoothStep(0,1,Mathf.InverseLerp(.6f,1,t)):1;
            pose.SetClimbing(true,target+t);
            pose.SetClimbContacts(Vector3.Lerp(previous.leftHand,next.leftHand,l),Vector3.Lerp(previous.rightHand,next.rightHand,r),
                Vector3.Lerp(previous.leftFoot,next.leftFoot,feet),Vector3.Lerp(previous.rightFoot,next.rightFoot,feet),grip,
                grip*Mathf.Lerp(previous.leftSupport,next.leftSupport,feet),grip*Mathf.Lerp(previous.rightSupport,next.rightSupport,feet));
        }
        void SetHang(bool value)
        {
            hanging=value;
            if(player!=null)player.enabled=!value;
            if(pose!=null)pose.SetClimbing(value,holdIndex);
        }
        public bool TryGrab()
        {
            if(hanging||moving||player==null||!player.Grounded)return false;
            if(Vector3.Distance(player.transform.position,baseGrip.position)<2.1f)
            {holdIndex=0;StartCoroutine(MoveToHold(player.transform.position,0,.42f,false));return true;}
            return false;
        }
        public bool TryUpperGrab()
        {
            if(hanging||moving||!firstLedge||player==null||!player.Grounded)return false;
            if(Vector3.Distance(player.transform.position,walk[4].position)>1.65f)return false;
            holdIndex=8;StartCoroutine(MoveToHold(player.transform.position,8,.40f,true));return true;
        }
        public bool TryAdvance(ClimbAction action)
        {
            if(!hanging||moving)return false;
            if(action==ClimbAction.Release){Release();return true;}
            if(action==ClimbAction.Mantle)
            {
                if(holdIndex==7){StartCoroutine(Mantle(walk[0],false));return true;}
                if(holdIndex==9){StartCoroutine(Mantle(walk[5],true));return true;}
                return false;
            }
            int target=-1;
            if(action==ClimbAction.Up)
            {
                if(holdIndex==0||holdIndex==1||holdIndex==6||holdIndex==8)target=holdIndex+1;
                else if(holdIndex==4)target=5;
            }
            else if(action==ClimbAction.Right&&holdIndex>=2&&holdIndex<=3)target=holdIndex+1;
            else if(action==ClimbAction.Left&&holdIndex>=3&&holdIndex<=4)target=holdIndex-1;
            // Leaps require an explicit direction and preparation via TryLeap.
            if(target<0)return false;
            StartCoroutine(MoveToHold(player.transform.position,target,.34f,false));
            return true;
        }
        public bool TryLeap(Vector2 direction,float preparation)
        {
            if(!hanging||moving||holdIndex!=5)return false;
            charging=false;charge=0;
            bool ready=preparation>=.35f;
            bool aligned=direction.sqrMagnitude>.01f&&Vector2.Dot(direction.normalized,new Vector2(1,.35f).normalized)>.87f&&direction.y>.1f;
            if(!ready||!aligned)
            {
                feedback=!ready?"도약 준비가 짧았다. Space를 조금 더 눌러 보자.":"건너편 손잡이는 오른쪽 위에 있다. W+D로 방향을 잡자.";
                StartCoroutine(MissedLeap(direction));return false;
            }
            feedback="";StartCoroutine(MoveToHold(player.transform.position,6,.62f,true));return true;
        }
        IEnumerator MissedLeap(Vector2 direction)
        {
            moving=true;if(pose!=null)pose.SetClimbing(false,0);var from=player.transform.position;float elapsed=0;
            while(elapsed<.55f)
            {
                elapsed+=Time.deltaTime;float t=Mathf.Clamp01(elapsed/.55f);
                player.transform.position=from+mountain.right*Mathf.Clamp(direction.x,-1,1)*t*.65f+
                    mountain.up*(.3f*Mathf.Sin(t*Mathf.PI)-1.4f*t*t)-mountain.forward*t*.35f;
                yield return null;
            }
            RestoreCheckpoint();
        }
        public void RecordSafeFooting()
        {
            if(!firstLedge||hanging||moving||!player.Grounded||summit)return;
            if(Vector3.Distance(player.transform.position,walk[2].position)<.65f)checkpointIndex=2;
        }
        public void RestoreCheckpoint()
        {
            StopAllCoroutines();moving=false;charging=false;charge=0;SetHang(false);
            player.Respawn(SafePosition,mountain.forward);holdIndex=-1;
        }
        IEnumerator MoveToHold(Vector3 from,int target,float duration,bool airborne)
        {
            int previous=holdIndex;
            moving=true;feedback="";SetHang(true);
            var to=HangPosition(target);float clock=0;
            while(clock<duration)
            {
                clock+=Time.deltaTime;float t=Mathf.Clamp01(clock/duration);
                float eased=t*t*(3-2*t);
                player.transform.position=Vector3.Lerp(from,to,eased)+mountain.up*(airborne?.42f:0)*Mathf.Sin(t*Mathf.PI);
                player.transform.rotation=Quaternion.LookRotation(mountain.forward,mountain.up);
                PresentTransition(previous,target,t,airborne);
                yield return null;
            }
            holdIndex=target;player.transform.position=to;
            PresentContact(target);
            moving=false;
        }
        IEnumerator Mantle(Transform destination,bool top)
        {
            moving=true;var from=player.transform.position;var to=destination.position;float duration=.9f,clock=0;
            var contact=ContactAt(holdIndex);
            while(clock<duration)
            {
                clock+=Time.deltaTime;float t=Mathf.Clamp01(clock/duration);
                // Pull upward first, then bring the hips over the lip. A diagonal
                // root interpolation used to cut straight through the ledge.
                var delta=to-from;var rise=Vector3.Project(delta,mountain.up);var across=delta-rise;
                player.transform.position=from+rise*Mathf.SmoothStep(0,1,Mathf.InverseLerp(0,.72f,t))+
                    across*Mathf.SmoothStep(0,1,Mathf.InverseLerp(.35f,1,t));
                if(pose!=null)
                {
                    pose.SetClimbing(true,holdIndex+t);
                    float release=1-Mathf.SmoothStep(0,1,Mathf.InverseLerp(.4f,.85f,t));
                    pose.SetClimbContacts(contact.leftHand,contact.rightHand,contact.leftFoot,contact.rightFoot,release,
                        release*contact.leftSupport,release*contact.rightSupport);
                }
                yield return null;
            }
            SetHang(false);player.Respawn(to,mountain.forward);
            firstLedge=true;if(checkpointIndex<0)checkpointIndex=0;if(top)summit=true;
            holdIndex=-1;moving=false;
        }
        public void Release()
        {
            if(!hanging)return;
            RestoreCheckpoint();
        }
        void OnDisable(){if(hanging)Release();}
        public void PrepareLeap(float deltaTime,bool begin=false)
        {
            if(!CanPrepareLeap||NotebookUI.BlocksInput)return;
            if(begin){charging=true;charge=0;}
            if(charging)charge+=Mathf.Max(0,deltaTime);
        }
        void Update()
        {
            RecordSafeFooting();
            var key=Keyboard.current;
            if(key==null||NotebookUI.BlocksInput){charging=false;charge=0;return;}
            if(!hanging)
            {
                if(key.spaceKey.wasPressedThisFrame)TryUpperGrab();
                return;
            }
            if(moving)return;
            if(key.qKey.wasPressedThisFrame){TryAdvance(ClimbAction.Release);return;}
            if(key.eKey.wasPressedThisFrame){TryAdvance(ClimbAction.Mantle);return;}
            if(holdIndex==5)
            {
                if(key.spaceKey.wasPressedThisFrame)PrepareLeap(0,true);
                if(charging)
                {
                    PrepareLeap(Time.deltaTime);
                    if(key.spaceKey.wasReleasedThisFrame)
                    {
                        var direction=new Vector2((key.dKey.isPressed||key.rightArrowKey.isPressed?1:0)-(key.aKey.isPressed||key.leftArrowKey.isPressed?1:0),
                            (key.wKey.isPressed||key.upArrowKey.isPressed?1:0)-(key.sKey.isPressed||key.downArrowKey.isPressed?1:0));
                        TryLeap(direction,charge);
                    }
                    return;
                }
            }
            if(key.wKey.wasPressedThisFrame||key.upArrowKey.wasPressedThisFrame){TryAdvance(ClimbAction.Up);return;}
            if(key.dKey.wasPressedThisFrame||key.rightArrowKey.wasPressedThisFrame){TryAdvance(ClimbAction.Right);return;}
            if(key.aKey.wasPressedThisFrame||key.leftArrowKey.wasPressedThisFrame)TryAdvance(ClimbAction.Left);
        }
    }
}
