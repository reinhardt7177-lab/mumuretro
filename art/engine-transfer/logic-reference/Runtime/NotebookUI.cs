using TMPro;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.SceneManagement;

namespace Mumu.Planet
{
    [DefaultExecutionOrder(-100)]
    public sealed class NotebookUI : MonoBehaviour
    {
        [SerializeField] GameObject modal;
        [SerializeField] UnityEngine.UI.Button launcher,close,previous,next;
        [SerializeField] UnityEngine.UI.Button[] tabs;
        [SerializeField] TextMeshProUGUI launcherDetail,title,body,record,location,pageNumber,saveNote;
        [SerializeField] CanvasGroup ink;
        [SerializeField] NotebookPresentation presentation;
        [SerializeField] PlanetExplorer player;
        [SerializeField] OrbitCamera orbit;
        [SerializeField] TempleEntrance entrance;
        [SerializeField] TempleAudience audience;
        [SerializeField] bool available=true;
        [SerializeField] GameObject mapPanel;
        [SerializeField] RectTransform mapPlayer,mapTemple,mapPlayerLabel,mapTempleLabel;
        [SerializeField] TextMeshProUGUI mapStatus;
        [SerializeField] Vector3 mapOrigin;
        bool playerWasEnabled,orbitWasEnabled,completed,waterCompleted,shadowCompleted;
        Animator animator;
        float animatorSpeed,turnTime;
        int pendingPage;
        Canvas[] backgroundCanvases;
        bool[] backgroundWasEnabled;
        public static bool BlocksInput {get;private set;}
        public bool IsOpen {get;private set;}
        public bool Turning {get;private set;}
        public int Page {get;private set;}
        public string BodyText=>body.text;
        public string RecordText=>record.text;
        public UnityEngine.UI.Button Launcher=>launcher;
        public UnityEngine.UI.Button Next=>next;
        public UnityEngine.UI.Button CloseButton=>close;
        public NotebookPresentation Presentation=>presentation;
        public GameObject Modal=>modal;
        public UnityEngine.UI.Button[] Tabs=>tabs;
        public bool HasMap=>mapPanel!=null&&tabs!=null&&tabs.Length==4;
        public RectTransform MapPlayer=>mapPlayer;
        public RectTransform MapTemple=>mapTemple;
        public bool CanOpen=>available&&!(entrance!=null&&entrance.IsOpening)&&!(audience!=null&&audience.IsPlaying);
        public void SetAvailable(bool value){available=value;if(launcher!=null)RefreshLauncher();}
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        static void ResetRuntime(){BlocksInput=false;}
        public void Configure(GameObject panel,UnityEngine.UI.Button open,UnityEngine.UI.Button exit,UnityEngine.UI.Button back,UnityEngine.UI.Button forward,
            UnityEngine.UI.Button[] index,TextMeshProUGUI detail,TextMeshProUGUI heading,TextMeshProUGUI text,TextMeshProUGUI status,TextMeshProUGUI place,TextMeshProUGUI number,TextMeshProUGUI footer,CanvasGroup lettering,NotebookPresentation model)
        {modal=panel;launcher=open;close=exit;previous=back;next=forward;tabs=index;launcherDetail=detail;title=heading;body=text;record=status;location=place;pageNumber=number;saveNote=footer;ink=lettering;presentation=model;}
        public void ConfigureMap(GameObject panel,UnityEngine.UI.Button tab,RectTransform playerMark,
            RectTransform templeMark,RectTransform playerCaption,RectTransform templeCaption,
            TextMeshProUGUI status,Vector3 origin)
        {
            mapPanel=panel;mapPlayer=playerMark;mapTemple=templeMark;
            mapPlayerLabel=playerCaption;mapTempleLabel=templeCaption;mapStatus=status;mapOrigin=origin;
            var expanded=new UnityEngine.UI.Button[4];
            for(int i=0;i<3;i++)expanded[i]=tabs[i];expanded[3]=tab;tabs=expanded;
        }
        public void BindScene(PlanetExplorer explorer,OrbitCamera camera,TempleEntrance entry,TempleAudience guardian){player=explorer;orbit=camera;entrance=entry;audience=guardian;}
        void Start()
        {
            modal.SetActive(false);animator=player.GetComponentInChildren<Animator>();
            launcher.onClick.AddListener(Toggle);close.onClick.AddListener(Close);previous.onClick.AddListener(Previous);next.onClick.AddListener(NextPage);
            tabs[0].onClick.AddListener(Journal);tabs[1].onClick.AddListener(Experiments);tabs[2].onClick.AddListener(Controls);
            if(HasMap)tabs[3].onClick.AddListener(Map);
            completed=TempleProgress.Current.Completed;waterCompleted=WaterApproachProgress.Current.Completed;shadowCompleted=ShadowApproachProgress.Current.Completed;RefreshLauncher();Refresh();
        }
        void Journal(){SelectPage(0);}void Experiments(){SelectPage(1);}void Controls(){SelectPage(2);}void Map(){SelectPage(3);}
        void Previous(){SelectPage(Page-1);}void NextPage(){SelectPage(Page+1);}
        public void Toggle(){if(IsOpen)Close();else TryOpen();}
        public bool TryOpen()
        {
            if(IsOpen||!CanOpen)return false;
            IsOpen=BlocksInput=true;playerWasEnabled=player.enabled;orbitWasEnabled=orbit.enabled;
            player.enabled=false;orbit.enabled=false;
            if(animator!=null){animatorSpeed=animator.speed;animator.speed=0;}
            backgroundCanvases=FindObjectsByType<Canvas>(FindObjectsSortMode.None);backgroundWasEnabled=new bool[backgroundCanvases.Length];
            var ownCanvas=GetComponent<Canvas>();
            for(int i=0;i<backgroundCanvases.Length;i++){backgroundWasEnabled[i]=backgroundCanvases[i].enabled;if(backgroundCanvases[i]!=ownCanvas)backgroundCanvases[i].enabled=false;}
            launcher.gameObject.SetActive(false);
            EventSystem.current?.SetSelectedGameObject(null);completed=TempleProgress.Current.Completed;waterCompleted=WaterApproachProgress.Current.Completed;shadowCompleted=ShadowApproachProgress.Current.Completed;Refresh();
            modal.SetActive(true);presentation.Show(true);return true;
        }
        public void Close()
        {
            if(!IsOpen)return;
            IsOpen=BlocksInput=false;Turning=false;if(ink!=null)ink.alpha=1;if(modal!=null)modal.SetActive(false);if(presentation!=null)presentation.Show(false);
            if(player!=null)player.enabled=playerWasEnabled;if(orbit!=null)orbit.enabled=orbitWasEnabled;if(animator!=null)animator.speed=animatorSpeed;
            if(backgroundCanvases!=null)for(int i=0;i<backgroundCanvases.Length;i++)if(backgroundCanvases[i]!=null)backgroundCanvases[i].enabled=backgroundWasEnabled[i];
            backgroundCanvases=null;backgroundWasEnabled=null;
            EventSystem.current?.SetSelectedGameObject(null);RefreshLauncher();
        }
        public bool SelectPage(int index)
        {
            if(!IsOpen||Turning||index<0||index>=tabs.Length||index==Page)return false;
            pendingPage=index;turnTime=0;Turning=true;ink.alpha=0;return true;
        }
        void Update()
        {
            bool available=!IsOpen&&CanOpen;if(launcher.gameObject.activeSelf!=available)launcher.gameObject.SetActive(available);
            bool balanceNow=TempleProgress.Current.Completed,waterNow=WaterApproachProgress.Current.Completed,shadowNow=ShadowApproachProgress.Current.Completed;
            if(completed!=balanceNow||waterCompleted!=waterNow||shadowCompleted!=shadowNow){completed=balanceNow;waterCompleted=waterNow;shadowCompleted=shadowNow;RefreshLauncher();if(IsOpen)Refresh();}
            var k=Keyboard.current;
            if(k!=null)
            {
                if(k.nKey.wasPressedThisFrame)Toggle();
                else if(IsOpen&&k.escapeKey.wasPressedThisFrame)Close();
                else if(IsOpen&&k.rightArrowKey.wasPressedThisFrame)NextPage();
                else if(IsOpen&&k.leftArrowKey.wasPressedThisFrame)Previous();
            }
            if(IsOpen&&Page==3)UpdateMap();
            if(!Turning){if(IsOpen)ink.alpha=Mathf.MoveTowards(ink.alpha,1,Time.unscaledDeltaTime*8);return;}
            turnTime+=Time.unscaledDeltaTime;float fraction=Mathf.Clamp01(turnTime/.58f);presentation.Turn(fraction,pendingPage>Page);
            if(fraction>=1){Turning=false;Page=pendingPage;Refresh();ink.alpha=0;}
        }
        void RefreshLauncher()
        {
            bool balance=TempleProgress.Current.Completed,water=WaterApproachProgress.Current.Completed,shadow=ShadowApproachProgress.Current.Completed;
            launcherDetail.text=shadow?(balance&&water?"세 지혜 기록":balance?"균형·그림자 기록":water?"순환·그림자 기록":"그림자의 지혜 기록"):
                balance&&water?"균형·순환 기록":water?"순환의 지혜 기록":balance?"균형의 지혜 기록":"탐사 기록 열기";
            launcher.gameObject.SetActive(!IsOpen&&CanOpen);
        }
        void UpdateMap()
        {
            if(mapPanel==null)return;
            bool availableHere=entrance!=null&&player!=null&&mapOrigin.sqrMagnitude>1;
            mapPlayer.gameObject.SetActive(availableHere);mapTemple.gameObject.SetActive(availableHere);
            mapPlayerLabel.gameObject.SetActive(availableHere);mapTempleLabel.gameObject.SetActive(availableHere);
            if(!availableHere)
            {mapStatus.text=SceneManager.GetActiveScene().name=="StarsailIntro"?"행성에 내리면 주변 지도를 그릴 수 있다.":"신전 밖으로 나가면 주변 위치가 보인다.";return;}
            Vector3 up=mapOrigin.normalized;
            Vector3 destination=entrance.transform.TransformPoint(new Vector3(0,0,-1.55f));
            Vector3 north=Vector3.ProjectOnPlane(destination-mapOrigin,up).normalized;
            Vector3 east=Vector3.Cross(up,north).normalized;
            Vector2 Project(Vector3 point)
            {
                Vector3 delta=Vector3.ProjectOnPlane(point-mapOrigin,up);
                return Vector2.ClampMagnitude(new Vector2(Vector3.Dot(delta,east),Vector3.Dot(delta,north))*(145f/24f),145f);
            }
            mapPlayer.anchoredPosition=Project(player.transform.position);
            mapTemple.anchoredPosition=Project(destination);
            mapPlayerLabel.anchoredPosition=mapPlayer.anchoredPosition+new Vector2(44,-2);
            mapTempleLabel.anchoredPosition=mapTemple.anchoredPosition+new Vector2(63,4);
            mapPlayerLabel.gameObject.SetActive(Vector2.Distance(mapPlayer.anchoredPosition,mapTemple.anchoredPosition)>42);
            mapStatus.text=TempleProgress.Current.Completed&&WaterApproachProgress.Current.Completed?"착륙지 주변 · 두 신전 탐사 완료":
                TempleProgress.Current.Completed?"착륙지 주변 · 신전 밀봉":
                WaterApproachProgress.Current.Completed?"착륙지 주변 · 물의 신전 탐사 완료":"착륙지 주변 · 신전까지의 길";
        }
        void Refresh()
        {
            bool balanceDone=TempleProgress.Current.Completed,waterDone=WaterApproachProgress.Current.Completed;
            bool shadowDone=ShadowApproachProgress.Current.Completed;
            string currentScene=SceneManager.GetActiveScene().name;
            // Every state that involves the shadow temple has its own texts; the earlier texts are unchanged.
            if(currentScene==ShadowTemple.SceneName||shadowDone){RefreshShadow(currentScene,balanceDone,waterDone,shadowDone);FinishRefresh();return;}
            bool bothDone=balanceDone&&waterDone;
            string scene=SceneManager.GetActiveScene().name;
            bool waterScene=scene.StartsWith("Water");
            bool balanceScene=scene=="WeightTemple"||scene=="TwinBalanceTemple"||scene=="LeverBalanceTemple";
            if(saveNote!=null)saveNote.text=scene=="StarsailIntro"?"별의 자리를 읽어 항로를 맞추자.":"이 PC의 탐사 기록을 읽습니다.";
            location.text=scene=="StarsailIntro"?"우주 범선\n발견한 소포":
                waterScene?"물의 신전\n순환의 길":
                scene=="WeightTemple"?"무게의 회랑\n첫 번째 실험":
                scene=="TwinBalanceTemple"?"두 판의 균형\n두 번째 실험":
                scene=="LeverBalanceTemple"?"여섯 칸의 지레\n마지막 실험":
                bothDone?"두 신전\n탐사를 마친 기록":
                waterDone?"물의 신전\n탐사를 마친 기록":
                balanceDone?"무게의 신전\n탐사를 마친 기록":
                "작은 별의 탐사\n무게의 신전으로";
            if(scene=="StarsailIntro")record.text="받는 사람: 다음 여행자\n보낸 사람: 없음";
            else if(bothDone)record.text=TempleProgress.Current.Saved&&WaterApproachProgress.Current.Saved?
                "완료 기록 저장됨\n균형·순환의 지혜 · 두 신전 밀봉":
                "두 신전 탐사 완료\n기록 저장 상태를 확인해 주세요.";
            else if(waterDone)record.text=WaterApproachProgress.Current.Saved?
                "순환의 지혜 기록됨\n무게의 지혜는 아직 기다립니다.":
                "물의 신전 탐사 완료\n기록은 아직 저장되지 않았습니다.";
            else if(balanceDone)record.text=waterScene?
                "균형의 지혜 기록됨\n물의 신전 탐사 중":
                TempleProgress.Current.Saved?"완료 기록 저장됨\n신전은 밀봉되었습니다.":"이번 탐사 완료\n저장 상태를 확인해 주세요.";
            else record.text=waterScene?"아직 채워지지 않은 물의 기록\n얼음·물·수증기의 길을 살펴보세요.":
                "아직 채워지지 않은 기록\n세 실험을 마치고\n균형의 신을 만나 보세요.";
            if(!balanceDone&&!waterDone&&!string.IsNullOrEmpty(TempleProgress.Current.Problem))record.text="기록을 읽지 못했습니다.\n기존 파일은 보존됩니다.";
            if(!balanceDone&&!waterDone&&!string.IsNullOrEmpty(WaterApproachProgress.Current.Problem)&&waterScene)record.text="물의 기록을 읽지 못했습니다.\n기존 파일은 보존됩니다.";
            body.fontSize=bothDone&&(Page==0||Page==1)?22:25;
            if(Page==0)
            {
                title.text=scene=="StarsailIntro"?"받은 것 · 들은 것":bothDone?"두 신전의 지혜":
                    balanceScene&&!balanceDone?"무게의 탐사":waterScene&&!waterDone?"물의 탐사":
                    waterDone?"순환의 지혜":balanceDone?"내가 얻은 지혜":"오늘의 탐사";
                body.text=scene=="StarsailIntro"?"<b>다음 여행자에게</b>\n\n보낸 사람의 이름은 비어 있다. 소포 안에는 낡은 수첩 한 권.\n\n별의 자리: <b>3 · 5 · ?</b>\n셋째 자리는 잉크가 번졌다. 앞의 두 자리를 더한 수라고 적혀 있다.\n\n선미 항해대의 숫자판 세 개를 맞춰 작은 초록 별로 가 보자.":
                    bothDone?"<b>균형의 지혜</b>\n저울로 무게를 비교하고 두 판의 합을 맞췄다.\n지렛대에서는 무게와 받침점까지의 거리가 함께 균형을 만들었다.\n\n<b>순환의 지혜</b>\n같은 물이 얼음·물·수증기로 모습을 바꾼다.\n썼던 물도 다시 모으면 다음 길을 만든다.":
                    balanceScene&&!balanceDone?"<b>비교하고, 옮기고, 살펴보기</b>\n\n무게의 신전에는 세 가지 실험이 기다린다.\n\n한 번에 맞히려고 하지 않아도 된다. 상자 하나를 옮긴 뒤, 무엇이 달라졌는지 살펴보자.\n\n신과의 만남을 마치면 이 면에 배운 내용이 기록된다.":
                    waterScene&&!waterDone?"<b>얼음·물·수증기</b>\n\n물은 모습을 바꿔 길이 되기도 한다.\n얼린 물을 녹인 뒤에는 어디로 흐르는지 살펴보자.\n흩어진 물도 다시 모을 수 있다.\n\n물의 신을 만나면 이 여정이 기록된다.":
                    waterDone?"<b>같은 물, 다른 모습</b>\n\n얼음으로 길을 만들고 녹여 물을 되찾았다.\n흩어진 물을 모아 다시 흘려보냈다.\n수증기를 차가운 곳에서 물방울로 모았다.\n\n한 번 쓴 물에도 다음 길이 담겨 있다.\n이 여정이 수첩에 기록된다.":
                    balanceDone?"<b>무게와 거리, 함께 생각하기</b>\n\n크기가 크다고 더 무거운 것은 아니다. 저울로 비교하면 알 수 있다.\n\n양쪽에 상자를 두 개씩 놓고 총무게를 같게 맞추었다.\n\n지렛대에서는 무게뿐 아니라 지지대까지의 거리도 균형을 바꾼다.":
                    "<b>비교하고, 옮기고, 살펴보기</b>\n\n무게의 신전에는 세 가지 실험이 기다린다.\n\n한 번에 맞히려고 하지 않아도 된다. 상자 하나를 옮긴 뒤, 무엇이 달라졌는지 살펴보자.\n\n신과의 만남을 마치면 이 면에 배운 내용이 기록된다.";
            }
            else if(Page==1)
            {
                title.text="실험 노트";
                body.text=bothDone?
                    "<b>01  무게 순서</b>  저울에서 내려가는 쪽이 무겁다.\n<b>02  두 판</b>  두 개씩 놓고 합을 같게 맞춘다.\n<b>03  지렛대</b>  무게와 받침점까지의 거리.\n\n<b>04  얼음의 길</b>  얼려 건너고 녹여 회수한다.\n<b>05  물 모으기</b>  흩어진 물을 다시 모은다.\n<b>06  물의 순환</b>  수증기를 물방울로 모은다.":
                    (waterDone||waterScene)&&(!balanceScene||balanceDone)?
                    "<b>01  얼음으로 길 만들기</b>\n얼린 물을 발판으로 쓰고, 녹여 다시 거둔다.\n\n<b>02  흩어진 물 모으기</b>\n물을 모아 다음 장치로 옮긴다.\n\n<b>03  수증기에서 물로</b>\n차가운 곳에서 물방울을 모아 순환시킨다.":
                    "<b>01  가벼운 순서 찾기</b>\n저울의 내려가는 쪽이 더 무겁다. 두 상자씩 비교해 보자.\n\n<b>02  두 판의 균형</b>\n각 판에 두 개씩 올리고, 빛의 칸과 판의 높이를 살펴보자.\n\n<b>03  받치는 자리 옮기기</b>\n가벼운 추도 멀리 놓으면 균형을 바꿀 수 있다. 거리도 바꿔 보자.";
            }
            else if(Page==2)
            {
                title.text="탐사하는 방법";
                body.text="<b>W A S D / 방향키</b>  이동\n<b>Shift</b>  달리기   <b>Space</b>  점프\n\n<b>마우스 오른쪽</b>  시점 돌리기\n<b>마우스 휠</b>  거리 조절\n\n<b>E</b>  신전 입장 / 상자 들기·놓기\n<b>Q</b>  상자를 바닥에 내려놓기\n\n<b>N / Esc</b>  수첩 닫기\n<b>← →</b>  수첩 페이지 넘기기";
            }
            else{title.text="탐사 지도";body.text="";}
            FinishRefresh();
        }
        public const string ShadowLocation="그림자의 사당\n빛과 그림자의 길",ShadowRecordOpen="아직 채워지지 않은 그림자의 기록\n빛이 가려진 곳을 따라가 보자.",
            ShadowRecordUnreadable="그림자의 기록을 읽지 못했다.\n기존 파일은 그대로 둔다.",ShadowRecordDone="그림자의 지혜 기록됨",
            ShadowRecordUnsaved="그림자의 사당 탐사 완료\n기록은 아직 저장되지 않았다.",ThreeRecord="완료 기록 저장됨\n균형·순환·그림자의 지혜",
            ThreeRecordUnsaved="세 신전 탐사 완료\n기록 저장 상태를 확인하자.";
        void RefreshShadow(string scene,bool balanceDone,bool waterDone,bool shadowDone)
        {
            bool shadowScene=scene==ShadowTemple.SceneName;
            int done=(balanceDone?1:0)+(waterDone?1:0)+(shadowDone?1:0);
            bool exploring=shadowScene&&!shadowDone;
            if(saveNote!=null)saveNote.text="이 PC의 탐사 기록을 읽습니다.";
            location.text=shadowScene?ShadowLocation:done==3?"세 신전\n탐사를 마친 기록":"그림자의 사당\n탐사를 마친 기록";
            if(exploring)record.text=!string.IsNullOrEmpty(ShadowTempleProgress.Current.Problem)?ShadowRecordUnreadable:ShadowRecordOpen;
            else if(done==3)record.text=TempleProgress.Current.Saved&&WaterApproachProgress.Current.Saved&&ShadowApproachProgress.Current.Saved?ThreeRecord:ThreeRecordUnsaved;
            else record.text=(ShadowApproachProgress.Current.Saved?ShadowRecordDone:ShadowRecordUnsaved)+(done==2?"\n남은 신전 하나":"\n다른 신전의 지혜는 아직 기다린다.");
            body.fontSize=Page<=1?(done==3?21:22):25;
            if(Page==0)
            {
                title.text=exploring?"그림자의 탐사":done==3?"세 신전의 지혜":"그림자의 지혜";
                body.text=exploring?"<b>빛과 그림자</b>\n\n빛이 가려진 곳에 그림자가 생긴다.\n등불이 움직이면 그림자도 움직인다.\n거울은 빛이 가는 길을 꺾는다.\n\n거울의 지킴이를 만나면 이 여정이 기록된다.":
                    done==3?"<b>균형</b>  무게와 받침점까지의 거리가 함께 균형을 만든다.\n\n<b>순환</b>  같은 물이 얼음·물·수증기로 모습을 바꾼다.\n\n<b>그림자</b>  빛의 반대편에 생기고, 등불에 가까울수록 크다.\n\n세 신전이 모두 밀봉되었다.":
                    "<b>그림자는 빛의 반대편에</b>\n\n등불이 돌면 기둥 그림자도 함께 돌았다.\n거울은 빛을 들어온 각도 그대로 되돌렸다.\n가림판이 등불에 가까울수록 그림자가 컸다.\n등불을 높이면 그림자가 짧아졌다.";
            }
            else if(Page==1)
            {
                title.text="실험 노트";
                body.text=done==3?"<b>01</b> 무게 순서   <b>02</b> 두 판   <b>03</b> 지렛대\n<b>04</b> 얼음의 길   <b>05</b> 물 모으기   <b>06</b> 물의 순환\n<b>07</b> 그림자 밟기   <b>08</b> 거울 세 장\n<b>09</b> 그림자 크기   <b>10</b> 방향과 높이\n\n세 신전의 실험을 모두 마쳤다.":
                    "<b>01  그림자 밟기</b>\n등불 반대편, 기둥 그림자만 밟고 건넌다.\n\n<b>02  거울 세 장</b>\n거울을 돌리고 옮겨 빛을 표적에 잇는다.\n\n<b>03  그림자 크기</b>\n판과 등불 사이 거리로 크기를 맞춘다.\n\n<b>04  방향과 높이</b>\n등불로 신의 그림자를 자리에 얹는다.";
            }
            else if(Page==2)
            {
                title.text="탐사하는 방법";
                body.text=shadowScene?"<b>W A S D / 방향키</b>  이동\n<b>Shift</b>  달리기   <b>Space</b>  점프\n\n<b>마우스 오른쪽</b>  시점 돌리기\n<b>마우스 휠</b>  거리 조절\n\n<b>E</b>  돌리기 · 잡기와 놓기 · 힌트\n<b>Q</b>  반대로 돌리기 · 놓기\n\n<b>N / Esc</b>  수첩 닫기\n<b>← →</b>  수첩 페이지 넘기기":
                    "<b>W A S D / 방향키</b>  이동\n<b>Shift</b>  달리기   <b>Space</b>  점프\n\n<b>마우스 오른쪽</b>  시점 돌리기\n<b>마우스 휠</b>  거리 조절\n\n<b>E</b>  신전 입장 / 상자 들기·놓기\n<b>Q</b>  상자를 바닥에 내려놓기\n\n<b>N / Esc</b>  수첩 닫기\n<b>← →</b>  수첩 페이지 넘기기";
            }
            else{title.text="탐사 지도";body.text="";}
        }
        void FinishRefresh()
        {
            if(mapPanel!=null){mapPanel.SetActive(Page==3);if(Page==3)UpdateMap();}
            pageNumber.text=(Page+1)+" / "+tabs.Length;
            for(int i=0;i<tabs.Length;i++)tabs[i].image.color=i==Page?new Color(.52f,.32f,.10f):new Color(.06f,.18f,.16f);
            previous.interactable=Page>0;next.interactable=Page<tabs.Length-1;
        }
        void OnDisable(){Close();}
        void OnDestroy()
        {
            if(launcher!=null)launcher.onClick.RemoveListener(Toggle);if(close!=null)close.onClick.RemoveListener(Close);
            if(previous!=null)previous.onClick.RemoveListener(Previous);if(next!=null)next.onClick.RemoveListener(NextPage);
            if(tabs!=null&&tabs.Length>=3){tabs[0].onClick.RemoveListener(Journal);tabs[1].onClick.RemoveListener(Experiments);tabs[2].onClick.RemoveListener(Controls);if(tabs.Length>3)tabs[3].onClick.RemoveListener(Map);}
        }
    }
}
