using System;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace Mumu.Planet
{
    // Read-only guidance: this component never advances a quest or changes a puzzle.
    public sealed class QuestGuide : MonoBehaviour
    {
        const string Preference="Mumu.QuestGuide.Enabled";
        const int SparkCount=96;
        const int SurfaceSamples=32;
        static bool hasSessionPreference,sessionPreference;
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        static void ResetSessionPreference(){hasSessionPreference=false;sessionPreference=false;}
        [SerializeField] PlanetExplorer player;
        [SerializeField] StarsailIntro ship;
        [SerializeField] TempleEntrance temple;
        [SerializeField] WaterSanctuaryEntrance water;
        [SerializeField] PlanetSurface surface;
        [SerializeField] OrbitCamera orbit;
        [SerializeField] Button button;
        [SerializeField] TextMeshProUGUI headline,caption,direction;
        [SerializeField] GameObject directionPanel;
        [SerializeField] RectTransform arrow;
        [SerializeField] ParticleSystem dust;
        readonly ParticleSystem.Particle[] sparks=new ParticleSystem.Particle[SparkCount];
        readonly Vector3[] path=new Vector3[SparkCount];
        readonly Vector3[] groundSamples=new Vector3[SurfaceSamples];
        bool enabledByPlayer,hasTarget,pathValid;
        Vector3 target,lastStart,lastTarget;
        string goal="",hint="";
        float elapsed,descriptionAt;
        public bool GuidanceEnabled=>enabledByPlayer;
        public string Goal=>goal;
        public string Hint=>hint;
        public bool HasTarget=>hasTarget;
        public int ActiveSparks=>dust!=null?dust.particleCount:0;
        public Button ToggleButton=>button;

        public void Configure(PlanetExplorer explorer,StarsailIntro intro,TempleEntrance entrance,
            PlanetSurface ground,OrbitCamera camera,Button toggle,TextMeshProUGUI title,
            TextMeshProUGUI detail,GameObject bearingPanel,TextMeshProUGUI bearing,RectTransform pointer,ParticleSystem particles)
        {
            player=explorer;ship=intro;temple=entrance;surface=ground;orbit=camera;
            button=toggle;headline=title;caption=detail;directionPanel=bearingPanel;direction=bearing;arrow=pointer;dust=particles;
        }
        public void ConfigureWater(WaterSanctuaryEntrance entrance){water=entrance;}
        [SerializeField] ShadowSanctuaryEntrance shadow;
        public void ConfigureShadow(ShadowSanctuaryEntrance entrance){shadow=entrance;}
        public const string ShadowEnterGoal="그림자의 사당 들어가기",ShadowFindGoal="그림자의 사당 찾아가기",ShadowHint="E · 달의 문 앞에서 입장";

        void Start()
        {
            enabledByPlayer=hasSessionPreference?sessionPreference:PlayerPrefs.GetInt(Preference,0)==1;
            button.onClick.AddListener(Toggle);
            var emission=dust.emission;emission.enabled=false;
            dust.Play();Refresh(true);
        }

        public void Toggle()
        {
            enabledByPlayer=!enabledByPlayer;
            hasSessionPreference=true;sessionPreference=enabledByPlayer;
            try{PlayerPrefs.SetInt(Preference,enabledByPlayer?1:0);PlayerPrefs.Save();}
            catch(Exception e){Debug.LogWarning("Guide choice remains active this session; this device did not save it: "+e.Message);}
            pathValid=false;Refresh(true);
        }

        void Update()
        {
            if(player==null)return;
            elapsed+=Time.deltaTime;
            Refresh(false);
            if(!enabledByPlayer||!hasTarget||NotebookUI.BlocksInput||!player.enabled)
            {dust.Clear();directionPanel.SetActive(false);return;}

            Vector3 from=player.transform.position;
            Vector3 up=surface!=null?from.normalized:Vector3.up;
            Vector3 toward=Vector3.ProjectOnPlane(target-from,up);
            float distance=surface!=null?Vector3.Angle(from,target)*Mathf.Deg2Rad*from.magnitude:toward.magnitude;
            if(distance<1.5f)
            {dust.Clear();directionPanel.SetActive(true);arrow.gameObject.SetActive(false);
                if(direction.text!=hint)direction.text=hint;return;}

            if(!pathValid||Vector3.Distance(from,lastStart)>.65f||Vector3.Distance(target,lastTarget)>.1f)
                RebuildPath(from);
            float time=elapsed*.21f;
            for(int i=0;i<SparkCount;i++)
            {
                float phase=Mathf.Repeat(i/(float)SparkCount+time,1);
                float sample=phase*(SparkCount-1);int a=Mathf.FloorToInt(sample);
                Vector3 point=Vector3.Lerp(path[a],path[Mathf.Min(a+1,SparkCount-1)],sample-a);
                float shimmer=Mathf.Sin(elapsed*2.4f+i*1.7f);
                point+=up*(shimmer*.018f);
                float alpha=Mathf.Min(1f,Mathf.Min(phase*10f,(1-phase)*8f))*(.55f+.45f*Mathf.Pow(Mathf.Abs(shimmer),3));
                sparks[i].position=point;
                sparks[i].startSize=.026f+Hash(i)*.026f;
                sparks[i].startColor=new Color(1,.66f+Hash(i+11)*.24f,.24f,alpha);
                sparks[i].startLifetime=1;sparks[i].remainingLifetime=1;
            }
            dust.SetParticles(sparks,SparkCount);
            directionPanel.SetActive(true);arrow.gameObject.SetActive(true);
            var forward=Vector3.ProjectOnPlane(orbit.transform.forward,up).normalized;
            var right=Vector3.Cross(up,forward).normalized;
            float angle=Mathf.Atan2(Vector3.Dot(toward,right),Vector3.Dot(toward,forward))*Mathf.Rad2Deg;
            arrow.localRotation=Quaternion.Euler(0,0,-angle);
            if(elapsed>=descriptionAt)
            {direction.text="목적지 방향  ·  약 "+Mathf.CeilToInt(distance)+"걸음";descriptionAt=elapsed+.2f;}
        }

        static float Hash(int i)
        {
            float n=Mathf.Sin(i*127.1f+311.7f)*43758.5453f;
            return n-Mathf.Floor(n);
        }

        void RebuildPath(Vector3 from)
        {
            lastStart=from;lastTarget=target;pathValid=true;
            if(surface==null)
            {
                for(int i=0;i<SparkCount;i++)
                {
                    float t=i/(float)(SparkCount-1);
                    path[i]=Vector3.Lerp(from,target,t)+Vector3.up*(.47f+(Hash(i)-.5f)*.08f);
                }
                return;
            }
            Vector3 begin=from.normalized,end=target.normalized;
            for(int i=0;i<SurfaceSamples;i++)
            {
                float t=i/(float)(SurfaceSamples-1);
                Vector3 normal=Vector3.Slerp(begin,end,t).normalized;
                groundSamples[i]=surface.Point(normal)+normal*.55f;
            }
            for(int i=0;i<SparkCount;i++)
            {
                float sample=i/(float)(SparkCount-1)*(SurfaceSamples-1);
                int a=Mathf.FloorToInt(sample);
                path[i]=Vector3.Lerp(groundSamples[a],groundSamples[Mathf.Min(a+1,SurfaceSamples-1)],sample-a)
                    +Vector3.Slerp(begin,end,i/(float)(SparkCount-1)).normalized*((Hash(i)-.5f)*.08f);
            }
        }

        void Set(string title,string detail,bool directed,Vector3 point)
        {
            goal=title;hint=detail;hasTarget=directed;target=point;
        }

        void Refresh(bool force)
        {
            bool shadowOpen=shadow!=null&&!ShadowApproachProgress.Current.Completed;
            // Standing at the moon gate always names it; otherwise it follows the weight and water temples.
            if(shadowOpen&&shadow.ContextActive)
                Set(ShadowEnterGoal,ShadowHint,true,shadow.EntranceTarget.position);
            else if(water!=null&&WaterApproachProgress.Current.Completed)
            {
                if(temple!=null&&!TempleProgress.Current.Completed)
                    Set("순환의 지혜 기록 · 무게의 신전 찾아가기",
                        "N · 수첩 확인  /  E · 무게 신전 입장",true,
                        temple.transform.TransformPoint(new Vector3(0,0,-1.55f)));
                else if(shadowOpen)
                    Set(ShadowFindGoal,ShadowHint,true,shadow.EntranceTarget.position);
                else Set(TempleProgress.Current.Completed?(shadow!=null?"세 신전 탐사 완료":"두 신전 탐사 완료"):"물의 신전 탐사 완료",
                    WaterApproachProgress.Current.Saved?"탐사 완료 · N 수첩에서 기록 보기":"탐사 완료 · 저장 상태 확인",
                    false,Vector3.zero);
            }
            else if(ship!=null)
            {
                switch(ship.CurrentChapter)
                {
                    case StarsailIntro.Chapter.FindWinch:Set("우주 소포를 건져 올리기","E · 우현 회수 손잡이",true,new Vector3(4.3f,0,4));break;
                    case StarsailIntro.Chapter.Recovering:Set("소포가 도착하기를 기다리기","소포를 끌어올리는 중",false,Vector3.zero);break;
                    case StarsailIntro.Chapter.OpenParcel:Set("소포에서 수첩 찾기","E · 소포 열기",true,new Vector3(.4f,0,0));break;
                    case StarsailIntro.Chapter.ReadNotebook:Set("수첩에서 목적지 단서 읽기","수첩을 읽고 닫아 보자",false,Vector3.zero);break;
                    case StarsailIntro.Chapter.SetCourse:Set("별의 자리로 항로 맞추기","E · 항해 숫자판 돌리기",true,new Vector3(0,0,-5.8f));break;
                    case StarsailIntro.Chapter.ReachHelm:Set("무무 행성으로 출발하기","E · 항해대에서 출발",true,new Vector3(0,0,-5.8f));break;
                    default:Set("무무 행성으로 출발하는 중","새로운 탐사로",false,Vector3.zero);break;
                }
            }
            // The weight temple stays the first suggestion. The open water sanctuary takes over once the
            // player stands at it, has visited it before, or has finished the weight temple.
            else if(water!=null&&(water.ContextActive||water.Visited||TempleProgress.Current.Completed))
                Set(water.ContextActive?"물의 신전 들어가기":"물의 신전 찾아가기","E · 계단 위 열린 입구에서 입장",
                    true,water.EntranceTarget.position);
            else if(temple!=null&&TempleProgress.Current.Completed)
                Set("균형의 지혜를 기록했다","무게의 신전은 밀봉되었다",false,Vector3.zero);
            else if(temple!=null)
                Set("무게의 신전 찾아가기","E · 정문에서 입장",true,temple.transform.TransformPoint(new Vector3(0,0,-1.55f)));
            else Set("탐사 기록을 살펴보기","N · 수첩 열기",false,Vector3.zero);

            string newCaption=!hasTarget?hint:enabledByPlayer?"현재 퀘스트 · 금가루 안내 끄기":"현재 퀘스트 · 눌러서 길 안내";
            if(force||headline.text!=goal)headline.text=goal;
            if(force||caption.text!=newCaption)caption.text=newCaption;
            button.interactable=hasTarget;
            if(!enabledByPlayer||!hasTarget){dust.Clear();directionPanel.SetActive(false);}
        }

        void OnDestroy(){if(button!=null)button.onClick.RemoveListener(Toggle);}
    }
}
