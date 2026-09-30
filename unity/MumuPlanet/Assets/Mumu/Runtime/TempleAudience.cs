using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.SceneManagement;
using TMPro;

namespace Mumu.Planet
{
    public sealed class TempleAudience : MonoBehaviour
    {
        [SerializeField] LeverBalanceRoom room;
        [SerializeField] PlanetExplorer player;
        [SerializeField] OrbitCamera orbit;
        [SerializeField] Transform guardian,blessing;
        [SerializeField] GameObject puzzleHud,dialogue;
        [SerializeField] TextMeshProUGUI speech,page;
        [SerializeField] UnityEngine.UI.Button next;
        [SerializeField] UnityEngine.UI.Image fade;
        enum Phase {Waiting,Dialogue,Departing}
        Phase phase;
        float clock,glowClock;
        bool playerEnabled,orbitEnabled;
        Vector3 cameraStart;
        Quaternion cameraRotation;
        float cameraFieldOfView;
        Camera dialogueCamera;
        static readonly string[] Lines={
            "눈으로 크기를 보던 너는\n이제 무게를 비교하는구나.",
            "두 판을 채우고, 받치는 자리를 옮겨\n수평을 찾았지.",
            "무게와 거리가 함께 균형을 만든다.\n이 지혜를 가지고 다음 길로 가거라.",
            "균형의 지혜를 얻었다.\n이 신전은 이제 잠들고, 너의 탐사는 계속되리라."
        };
        public bool IsPlaying=>phase!=Phase.Waiting;
        public bool IsDeparting=>phase==Phase.Departing;
        public int LineIndex {get;private set;}=-1;
        public Vector3 GuardianPosition=>guardian.position;
        public void Configure(LeverBalanceRoom trial,PlanetExplorer explorer,OrbitCamera camera,Transform god,Transform orb,
            GameObject hud,GameObject panel,TextMeshProUGUI text,TextMeshProUGUI counter,UnityEngine.UI.Button advance,UnityEngine.UI.Image transition)
        {room=trial;player=explorer;orbit=camera;guardian=god;blessing=orb;puzzleHud=hud;dialogue=panel;speech=text;page=counter;next=advance;fade=transition;}
        void Start(){dialogue.SetActive(false);next.onClick.AddListener(AdvanceFromButton);}
        void OnDestroy(){if(next!=null)next.onClick.RemoveListener(AdvanceFromButton);}
        void AdvanceFromButton(){Advance();}
        public bool TryBegin()
        {
            if(NotebookUI.BlocksInput)return false;
            if(IsPlaying||TempleProgress.Current.Completed||!room.State.Solved||!room.DoorOpen||!player.Grounded)return false;
            var offset=player.transform.position-guardian.position;offset.y=0;
            if(offset.magnitude>3.15f||player.transform.position.z<guardian.position.z-3.15f)return false;
            phase=Phase.Dialogue;clock=0;LineIndex=0;
            playerEnabled=player.enabled;orbitEnabled=orbit.enabled;player.enabled=false;orbit.enabled=false;
            player.Respawn(player.transform.position,guardian.position-player.transform.position);
            var animator=player.GetComponentInChildren<Animator>();if(animator!=null)animator.SetFloat("Speed",0);
            cameraStart=orbit.transform.position;cameraRotation=orbit.transform.rotation;dialogueCamera=orbit.GetComponent<Camera>();cameraFieldOfView=dialogueCamera.fieldOfView;
            puzzleHud.SetActive(false);dialogue.SetActive(true);ShowLine();return true;
        }
        void ShowLine(){speech.text=Lines[LineIndex];page.text=(LineIndex+1)+" / "+Lines.Length+"  ·  자동 진행  ·  E / Space / 다음";}
        public bool Advance()
        {
            if(phase!=Phase.Dialogue||clock<.35f)return false;
            clock=0;
            if(LineIndex+1<Lines.Length){LineIndex++;ShowLine();return true;}
            phase=Phase.Departing;next.interactable=false;
            bool saved=TempleProgress.Current.Complete();
            if(saved&&!TempleJourney.Current.Finish())Debug.LogWarning("Temple journey checkpoint retained: "+TempleJourney.Current.Problem);
            if(!saved)Debug.LogWarning("Temple completion retained for this session; original save preserved: "+TempleProgress.Current.Problem);
            TempleProgress.ArrivalPending=true;
            speech.text=saved?"균형의 지혜가 기록되었습니다.\n신전 밖으로 돌아갑니다.":"균형의 지혜를 얻었습니다.\n이번 탐사의 신전이 밀봉됩니다.";
            page.text="탐사 계속하기";return true;
        }
        void Update()
        {
            glowClock+=Time.deltaTime;
            blessing.localPosition=new Vector3(0,3.0f+Mathf.Sin(glowClock*1.6f)*.055f,19.4f);
            blessing.Rotate(0,Time.deltaTime*24,0,Space.Self);
            if(phase==Phase.Waiting){TryBegin();return;}
            clock+=Time.deltaTime;
            // Frame the crown/halo and both pans above the dialogue panel.
            var cameraTarget=new Vector3(3.25f,3.9f,13.3f);
            var rotation=Quaternion.LookRotation(new Vector3(0,2.9f,20.8f)-cameraTarget,Vector3.up);
            float ease=1-Mathf.Exp(-Time.deltaTime*3);
            orbit.transform.position=Vector3.Lerp(orbit.transform.position,cameraTarget,ease);
            orbit.transform.rotation=Quaternion.Slerp(orbit.transform.rotation,rotation,ease);
            dialogueCamera.fieldOfView=Mathf.Lerp(dialogueCamera.fieldOfView,56,ease);
            if(phase==Phase.Dialogue)
            {
                var key=Keyboard.current;
                if(clock>=4.5f||(key!=null&&(key.eKey.wasPressedThisFrame||key.spaceKey.wasPressedThisFrame)))Advance();
            }
            else
            {
                var color=fade.color;color.a=Mathf.Clamp01(clock/.9f);fade.color=color;
                if(clock>=1.05f)SceneManager.LoadScene("PlanetExploration");
            }
        }
        void OnDisable()
        {
            if(!IsPlaying)return;
            if(player!=null)player.enabled=playerEnabled;
            if(orbit!=null){orbit.enabled=orbitEnabled;orbit.transform.SetPositionAndRotation(cameraStart,cameraRotation);if(dialogueCamera!=null)dialogueCamera.fieldOfView=cameraFieldOfView;}
            if(puzzleHud!=null)puzzleHud.SetActive(true);
            if(dialogue!=null)dialogue.SetActive(false);
            phase=Phase.Waiting;
        }
    }
}
