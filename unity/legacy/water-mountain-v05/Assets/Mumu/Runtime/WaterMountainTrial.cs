using TMPro;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

namespace Mumu.Planet
{
    // A separate outdoor chapter: climb the stone route, aim a sun mirror, thaw the entrance.
    public sealed class WaterMountainTrial : MonoBehaviour
    {
        [SerializeField] PlanetExplorer player;
        [SerializeField] OrbitCamera orbit;
        [SerializeField] Transform mountain,climbStart,climbEnd,midway,mirror,mirrorFace,receiver,entrance;
        [SerializeField] Collider iceCollider;
        [SerializeField] GameObject ice,flow;
        [SerializeField] LineRenderer beam,sunlight;
        [SerializeField] TextMeshProUGUI objective,feedback,aimText;
        [SerializeField] GameObject aimPanel;
        [SerializeField] Button fire,left,right,close;
        [SerializeField] MountainClimbController climbController;
        [SerializeField] GameObject missionPanel;
        [SerializeField] Image preparationFill;
        [SerializeField] IceThawPresentation thaw;
        [SerializeField] GameObject completionSeal;
        public IceThawPresentation Thaw=>thaw;
        public Bounds IceBounds=>iceCollider.bounds;
        public void ConfigureThaw(IceThawPresentation presentation){thaw=presentation;}
        public void ConfigureCompletionSeal(GameObject value){completionSeal=value;}
        public bool SealVisible=>completionSeal!=null&&completionSeal.activeSelf;
        public bool ContextActive=>player!=null&&mountain!=null&&(aiming||
            climbController!=null&&climbController.IsHanging||
            Vector3.Distance(player.transform.position,climbStart.position)<9f||
            Vector3.Distance(player.transform.position,entrance.position)<9f||
            climbController!=null&&climbController.ReachedFirstLedge&&Vector3.Distance(player.transform.position,mountain.position)<23f);
        public bool MissionVisible=>missionPanel!=null&&missionPanel.activeSelf;
        public float VisiblePreparation=>preparationFill!=null?preparationFill.fillAmount:0;
        public void ConfigurePresentation(GameObject mission,Image preparation){missionPanel=mission;preparationFill=preparation;}
        Vector3 lastCheckpoint,cameraPosition;
        Quaternion cameraRotation;
        bool cameraWasEnabled,aiming,beamActive,hasClimbed,beamHit,opened;
        bool summitDiscovered;
        public bool SummitDiscovered=>summitDiscovered;
        public bool TryDiscoverSummit()
        {
            if(summitDiscovered||opened||aiming||NotebookUI.BlocksInput||climbController==null||
                !climbController.ReachedSummit||climbController.IsMoving||climbController.IsHanging||
                !player.Grounded||Vector3.Distance(player.transform.position,mirror.position)>3.5f)return false;
            summitDiscovered=hasClimbed=true;
            var toward=Vector3.ProjectOnPlane(receiver.position-mirror.position,mountain.up).normalized;
            var side=Vector3.Cross(mountain.up,toward).normalized;
            orbit.RevealLandmark(mirror.position-toward*5+side*3+mountain.up*2.8f,mirror.position,receiver.position);
            RefreshHud();return true;
        }
        float yaw=-34f,pitch=10f,melt,fallClock;
        string message="돌산의 손잡이를 붙잡고 정상으로 올라가 태양 거울을 찾자.";
        public bool EntranceOpen=>opened;
        public bool CanEnter
        {
            get
            {
                if(!opened||WaterApproachProgress.Current.Completed||aiming||player==null||!player.Grounded||NotebookUI.BlocksInput||
                   climbController!=null&&climbController.IsHanging)return false;
                var local=entrance.InverseTransformPoint(player.transform.position);
                return Mathf.Abs(local.x)<1.6f&&local.z> -3f&&local.z<.8f&&Mathf.Abs(local.y)<2.3f;
            }
        }
        public bool TryEnter()
        {
            if(!CanEnter)return false;
            if(!Application.CanStreamedLevelBeLoaded("WaterJourneyIce"))
            {message="물의 신전 내부 장면이 이 실행판에 없습니다.";RefreshHud();return false;}
            // Return outside the sealed slab even if the player entered from beyond the threshold.
            WaterApproachProgress.ReturnPosition=entrance.TransformPoint(new Vector3(0,-1f,-2f));
            var heading=entrance.position-WaterApproachProgress.ReturnPosition;
            WaterApproachProgress.ReturnHeading=heading.sqrMagnitude>.001f?heading.normalized:entrance.forward;
            message="물의 신전으로 들어갑니다.";RefreshHud();
            SceneManager.LoadScene("WaterJourneyIce");return true;
        }
        public bool Aiming=>aiming;
        public bool BeamHitsIce=>beamHit;
        public string BeamObstacle{get;private set;}="";
        public float Melt=>melt;
        public float Yaw=>yaw;
        public Transform BaseTarget=>climbStart;
        public Transform MirrorTarget=>mirror;
        public Transform EntranceTarget=>entrance;
        public Vector3 QuestTarget=>opened?entrance.position:hasClimbed?mirror.position:
            climbController!=null?climbController.GuidanceTarget:climbStart.position;
        public Transform ClimbLanding=>climbEnd;
        public Transform IceTarget=>receiver;
        public MountainClimbController Climbing=>climbController;
        public void ConfigureClimbing(MountainClimbController controller){climbController=controller;}

        public void Configure(PlanetExplorer explorer,OrbitCamera cameraRig,Transform hill,Transform grip,Transform landing,Transform checkpoint,
            Transform mirrorRoot,Transform face,Transform absorber,Transform door,Collider frozenGate,GameObject frozen,GameObject runningWater,
            LineRenderer reflected,LineRenderer incident,TextMeshProUGUI goal,TextMeshProUGUI status,TextMeshProUGUI bearing,
            GameObject controls,Button fireButton,Button turnLeft,Button turnRight,Button leaveButton)
        {
            player=explorer;orbit=cameraRig;mountain=hill;climbStart=grip;climbEnd=landing;midway=checkpoint;
            mirror=mirrorRoot;mirrorFace=face;receiver=absorber;entrance=door;iceCollider=frozenGate;ice=frozen;flow=runningWater;
            beam=reflected;sunlight=incident;objective=goal;feedback=status;aimText=bearing;aimPanel=controls;
            fire=fireButton;left=turnLeft;right=turnRight;close=leaveButton;
        }
        void Start()
        {
            opened=WaterApproachProgress.Current.EntranceOpen;
            if(WaterApproachProgress.Current.Completed){opened=true;message="순환의 지혜를 얻었다. 물의 신전은 밀봉되었다.";}
            else if(opened)message="녹은 입구 앞에서 E를 눌러 물의 신전으로 들어가자.";
            lastCheckpoint=climbEnd.position;
            ice.SetActive(!opened);iceCollider.enabled=!opened;flow.SetActive(opened);
            if(completionSeal!=null)completionSeal.SetActive(WaterApproachProgress.Current.Completed);
            if(thaw!=null)thaw.Present(opened?1:0,false);
            aimPanel.SetActive(false);beam.enabled=false;sunlight.enabled=!opened;
            mirrorFace.up=(receiver.position-mirror.position).normalized;
            if(WaterApproachProgress.ArrivalPending)
            {
                WaterApproachProgress.ArrivalPending=false;
                var landing=WaterApproachProgress.ReturnPosition;
                var heading=WaterApproachProgress.ReturnHeading;
                if(landing.sqrMagnitude<1)landing=entrance.TransformPoint(new Vector3(0,-1,-2));
                player.Respawn(landing,heading.sqrMagnitude>.001f?heading:entrance.forward);
                orbit.Snap();
            }
            if(System.Array.IndexOf(System.Environment.GetCommandLineArgs(),"-mumu-water-preview")>=0)
                player.Respawn(climbStart.position,climbEnd.position-climbStart.position);
            fire.onClick.AddListener(ToggleBeam);left.onClick.AddListener(()=>RotateAim(-6,0));
            right.onClick.AddListener(()=>RotateAim(6,0));close.onClick.AddListener(StopAim);
            RefreshHud();
        }
        void OnDestroy()
        {
            if(orbit!=null)orbit.EndReveal();
            if(fire!=null)fire.onClick.RemoveListener(ToggleBeam);
            if(close!=null)close.onClick.RemoveListener(StopAim);
            if(aiming)RestoreControl();
            if(player!=null)player.ElevatedTraversal=false;
        }
        public bool TryClimb()
        {
            return !aiming&&climbController!=null&&climbController.TryGrab();
        }
        public bool TryAim()
        {
            if(opened||aiming||(climbController!=null&&climbController.IsHanging)||player==null||!player.Grounded||Vector3.Distance(player.transform.position,mirror.position)>2.85f)return false;
            orbit.EndReveal();aiming=true;beamActive=false;beam.enabled=false;beamHit=false;
            cameraWasEnabled=orbit.enabled;cameraPosition=orbit.transform.position;cameraRotation=orbit.transform.rotation;
            player.enabled=false;orbit.enabled=false;
            var up=mirror.position.normalized;var toward=Vector3.ProjectOnPlane(receiver.position-mirror.position,up).normalized;
            var rightward=Vector3.Cross(up,toward).normalized;
            orbit.transform.position=mirror.position-toward*4.3f+rightward*2.2f+up*2.25f;
            orbit.transform.rotation=Quaternion.LookRotation(receiver.position+up*.7f-orbit.transform.position,up);
            aimPanel.SetActive(true);message="거울을 조정하고 빛을 발사해 얼음 중심에 모으자.";RefreshHud();return true;
        }
        public void RotateAim(float horizontal,float vertical)
        {
            if(!aiming)return;
            yaw=Mathf.Clamp(yaw+horizontal,-65,65);pitch=Mathf.Clamp(pitch+vertical,-30,30);
            RefreshHud();
        }
        public void ToggleBeam()
        {
            if(!aiming||opened)return;
            beamActive=!beamActive;beam.enabled=beamActive;beamHit=false;RefreshHud();
            if(thaw!=null)thaw.Present(melt,false);
        }
        public void StopAim()
        {
            if(!aiming)return;
            RestoreControl();aiming=false;beamActive=false;beamHit=false;beam.enabled=false;aimPanel.SetActive(false);
            if(thaw!=null)thaw.Present(melt,false);
            RefreshHud();
        }
        void RestoreControl()
        {
            if(player!=null)player.enabled=true;
            if(orbit!=null){orbit.enabled=cameraWasEnabled;orbit.transform.SetPositionAndRotation(cameraPosition,cameraRotation);}
        }
        Vector3 AimDirection()
        {
            Vector3 up=mirror.position.normalized;
            Vector3 target=(receiver.position-mirror.position).normalized;
            Vector3 side=Vector3.Cross(up,target).normalized;
            return Quaternion.AngleAxis(pitch,side)*Quaternion.AngleAxis(yaw,up)*target;
        }
        public void TickBeam(float dt)
        {
            if(!aiming||!beamActive||opened)return;
            var direction=AimDirection();mirrorFace.up=direction;
            Vector3 from=mirror.position+direction*.32f;
            beamHit=Physics.Raycast(from,direction,out var hit,75f,1<<8,QueryTriggerInteraction.Ignore)&&hit.collider==iceCollider;
            BeamObstacle=hit.collider!=null?hit.collider.name:"none";
            beam.SetPosition(0,from);beam.SetPosition(1,beamHit?hit.point:from+direction*37);
            if(beamHit)
            {
                melt=Mathf.Min(1,melt+dt/2.4f);
                if(thaw!=null)thaw.Present(melt,true);
                message="빛이 얼음에 닿았다. 얼음이 물로 바뀌고 있다.";
                if(melt>=1)CompleteMelt();
            }
            else
            {
                melt=Mathf.Max(0,melt-dt*.12f);
                if(thaw!=null)thaw.Present(melt,false);
                message="빛이 얼음을 비켜갔다. 거울 각도를 조금씩 바꿔 보자.";
            }
            RefreshHud();
        }
        void CompleteMelt()
        {
            opened=true;iceCollider.enabled=false;ice.SetActive(false);flow.SetActive(true);sunlight.enabled=false;
            if(!WaterApproachProgress.Current.Open())Debug.LogWarning("Water entrance opened this session; save was not written: "+WaterApproachProgress.Current.Problem);
            message="얼음이 녹아 물이 흐른다. 물의 신전 입구가 드러났다.";
            StopAim();RefreshHud();
            var view=receiver.position+(mirror.position-receiver.position).normalized*10+mountain.up*2;
            orbit.RevealLandmark(view,receiver.position,entrance.position);
        }
        void Update()
        {
            if(player==null||mountain==null)return;
            player.ElevatedTraversal=Vector3.Distance(player.transform.position,mountain.position)<23f;
            var key=Keyboard.current;
            TryDiscoverSummit();
            if(aiming)
            {
                if(key!=null)
                {
                    if(key.eKey.wasPressedThisFrame||key.escapeKey.wasPressedThisFrame)StopAim();
                    else
                    {
                        float h=(key.dKey.isPressed||key.rightArrowKey.isPressed?1:0)-(key.aKey.isPressed||key.leftArrowKey.isPressed?1:0);
                        float v=(key.wKey.isPressed||key.upArrowKey.isPressed?1:0)-(key.sKey.isPressed||key.downArrowKey.isPressed?1:0);
                        if(h!=0||v!=0)RotateAim(h*Time.deltaTime*35,v*Time.deltaTime*28);
                        if(key.spaceKey.wasPressedThisFrame)ToggleBeam();
                    }
                }
                TickBeam(Time.deltaTime);return;
            }
            if(climbController!=null&&climbController.IsHanging){RefreshHud();return;}
            if(key!=null&&key.eKey.wasPressedThisFrame&&!NotebookUI.BlocksInput)
            {if(!TryEnter()&&!TryClimb())TryAim();}
            if(climbController!=null&&climbController.ReachedSummit)hasClimbed=true;
            if(climbController!=null&&climbController.ReachedFirstLedge&&!opened)
            {
                lastCheckpoint=climbController.SafePosition;
                if(player.transform.position.magnitude<lastCheckpoint.magnitude-1.8f)
                {
                    fallClock+=Time.deltaTime;
                    if(fallClock>.45f)
                    {climbController.RestoreCheckpoint();fallClock=0;message="발을 헛디뎠다. 마지막 안전한 돌길에서 다시 시작하자.";}
                }
                else fallClock=0;
            }
            RefreshHud();
        }
        public void RefreshHud()
        {
            if(objective==null)return;
            bool visible=ContextActive&&!NotebookUI.BlocksInput;
            if(missionPanel!=null&&missionPanel.activeSelf!=visible)missionPanel.SetActive(visible);
            if(preparationFill!=null)
            {
                bool show=climbController!=null&&climbController.CanPrepareLeap;
                preparationFill.transform.parent.gameObject.SetActive(show);
                preparationFill.fillAmount=show?climbController.LeapPreparation:0;
                preparationFill.rectTransform.localScale=new Vector3(preparationFill.fillAmount,1,1);
                preparationFill.color=preparationFill.fillAmount>=1?new Color(.52f,.9f,.72f):new Color(1f,.75f,.24f);
            }
            string goal=WaterApproachProgress.Current.Completed?"물의 신전 밀봉 · 순환의 지혜 기록":opened?"물의 신전 입구 발견":orbit.RevealActive?"정상 도착 · 태양 거울 발견":aiming?"태양 거울 조준":hasClimbed?"돌산 정상의 태양 거울":
                climbController!=null&&climbController.ReachedFirstLedge?"좁은 돌길을 따라 정상 오르기":"절벽 손잡이를 따라 태양 거울까지 오르기";
            if(objective.text!=goal)objective.text=goal;
            string detail=opened?message:orbit.RevealActive?"거울의 빛을 얼어붙은 신전으로 보내자.\nE 거울 잡기 · Esc 연출 건너뛰기":aiming?message+"\nA/D 좌우 · W/S 상하 · Space 빛 발사 · E 취소":
                climbController!=null&&climbController.IsHanging?climbController.Hint:
                climbController!=null&&climbController.ReachedFirstLedge&&!hasClimbed&&player!=null&&Vector3.Distance(player.transform.position,climbController.Walk[4].position)<2f?"Space 점프해 위쪽 손잡이 붙잡기":
                player!=null&&Vector3.Distance(player.transform.position,climbStart.position)<2.1f?
                    (climbController!=null&&!string.IsNullOrEmpty(climbController.LastFeedback)?climbController.LastFeedback+"\nE 다시 붙잡기":"E 손잡이 붙잡기"):
                !opened&&player!=null&&Vector3.Distance(player.transform.position,mirror.position)<2.85f?"E 태양 거울 잡기":message;
            if(feedback.text!=detail)feedback.text=detail;
            if(aimText!=null)
            {
                string angle=$"좌우 {yaw:+0;-0;0}°  ·  높이 {pitch:+0;-0;0}°  ·  얼음 {Mathf.RoundToInt(melt*100)}%";
                if(aimText.text!=angle)aimText.text=angle;
            }
        }
    }
}
