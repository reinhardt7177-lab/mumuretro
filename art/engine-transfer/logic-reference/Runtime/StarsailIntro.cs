using System;
using System.Collections;
using TMPro;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

namespace Mumu.Planet
{
    public sealed class StarsailIntro : MonoBehaviour
    {
        public enum Chapter { FindWinch, Recovering, OpenParcel, ReadNotebook, SetCourse, ReachHelm, Departing }
        static readonly int[] CourseCode={3,5,8};
        // The camera looks toward -Z; its screen-left is world +X.
        static readonly float[] DialX={1.65f,0,-1.65f};

        [SerializeField] PlanetExplorer player;
        [SerializeField] OrbitCamera orbit;
        [SerializeField] NotebookUI notebook;
        [SerializeField] TextMeshProUGUI objective;
        [SerializeField] TextMeshProUGUI prompt;
        [SerializeField] Transform parcel;
        [SerializeField] Transform lid;
        [SerializeField] LineRenderer cable;
        [SerializeField] Image departureFade;
        [SerializeField] TextMeshPro[] dialFaces;
        [SerializeField] Light courseLight;
        Chapter chapter;
        bool awaitingFirstClose;
        bool previewOnly;
        readonly int[] dials=new int[3];
        float elapsed;
        // The discovered parcel hangs just beyond the rail from the recovery boom.
        readonly Vector3 outside = new Vector3(7.3f, 1.45f, 2.7f);
        readonly Vector3 onDeck = new Vector3(.4f, .56f, 0);
        readonly Vector3 winchAnchor = new Vector3(4.3f, 1.35f, 4f);
        readonly Vector3 pulleyAnchor = new Vector3(5.6f, 2.65f, 3.2f);

        public Chapter CurrentChapter => chapter;
        public NotebookUI Notebook => notebook;
        public Transform Parcel => parcel;
        public LineRenderer RetrievalCable => cable;
        public PlanetExplorer Player => player;
        public int[] DialValues=>(int[])dials.Clone();
        public bool CourseSolved=>chapter==Chapter.ReachHelm||chapter==Chapter.Departing;

        public void Configure(PlanetExplorer explorer, OrbitCamera camera, NotebookUI journal,
            TextMeshProUGUI goal, TextMeshProUGUI hint, Transform package, Transform packageLid,
            LineRenderer retrievalCable, Image fade, TextMeshPro[] faces, Light indicator)
        {
            player=explorer;orbit=camera;notebook=journal;objective=goal;prompt=hint;
            parcel=package;lid=packageLid;cable=retrievalCable;departureFade=fade;
            dialFaces=faces;courseLight=indicator;
        }

        void Awake()
        {
            // Existing opt-in validators still begin on the planet despite the new first scene.
            var args=Environment.GetCommandLineArgs();
            // The shadow temple validator and preview start inside the temple scene.
            if(Array.IndexOf(args,"-mumu-shadow-temple-smoke")>=0||Array.IndexOf(args,"-mumu-shadow-temple-preview")>=0)
            {SceneManager.LoadScene(ShadowTemple.SceneName);return;}
            foreach(var flag in new[]{"-mumu-smoke","-mumu-temple-smoke","-mumu-notebook-smoke",
                "-mumu-exterior-smoke","-mumu-meadow-smoke","-mumu-lever-preview","-mumu-seal-smoke",
                "-mumu-water-entrance-smoke","-mumu-water-preview","-mumu-shadow-entrance-smoke","-mumu-shadow-preview"})
                if(Array.IndexOf(args,flag)>=0){SceneManager.LoadScene("PlanetExploration");return;}
            var progress=StarsailProgress.Current;
            previewOnly=Array.IndexOf(args,"-mumu-ship-preview")>=0;
            if(progress.Departed&&!previewOnly&&Array.IndexOf(args,"-mumu-ship-smoke")<0)
            {SceneManager.LoadScene(TempleJourney.ResumeScene??"PlanetExploration");return;}
            if(previewOnly){chapter=Chapter.FindWinch;if(notebook!=null)notebook.SetAvailable(false);return;}
            Array.Copy(progress.Dials,dials,3);
            chapter=progress.Solved?Chapter.ReachHelm:progress.Read?Chapter.SetCourse:
                progress.Opened?Chapter.ReadNotebook:progress.Recovered?Chapter.OpenParcel:Chapter.FindWinch;
            awaitingFirstClose=chapter==Chapter.ReadNotebook;
            if(notebook!=null)notebook.SetAvailable(progress.Opened);
        }

        void Start()
        {
            if(parcel==null)return;
            parcel.position=chapter==Chapter.FindWinch||chapter==Chapter.Recovering?outside:onDeck;
            if(chapter>=Chapter.ReadNotebook&&lid!=null)lid.localRotation=Quaternion.Euler(-112,0,0);
            if(cable!=null)
            {
                cable.positionCount=3;
                cable.enabled=chapter==Chapter.FindWinch||chapter==Chapter.Recovering;
                UpdateCable();
            }
            UpdateDials();
            SetFade(0);
            RefreshText();
            if(chapter==Chapter.ReadNotebook)StartCoroutine(OpenRestoredNotebook());
        }

        IEnumerator OpenRestoredNotebook()
        {
            yield return null;
            if(notebook!=null&&!notebook.IsOpen)notebook.TryOpen();
        }

        void Update()
        {
            if(parcel==null||player==null)return;
            if(chapter==Chapter.FindWinch)
            {
                parcel.position=outside+Vector3.up*Mathf.Sin(Time.time*.85f)*.06f;
                UpdateCable();
            }
            if(chapter==Chapter.ReadNotebook&&awaitingFirstClose&&notebook.IsOpen)awaitingFirstClose=false;
            if(chapter==Chapter.ReadNotebook&&!awaitingFirstClose&&!notebook.IsOpen)
            {chapter=Chapter.SetCourse;Save();RefreshText();}
            if(chapter!=Chapter.Departing)RefreshText();
            if(Keyboard.current!=null&&Keyboard.current.eKey.wasPressedThisFrame)Interact();
        }

        bool Near(float x,float z,float distance)
        {
            var p=player.transform.position;
            return (new Vector2(p.x-x,p.z-z)).sqrMagnitude<distance*distance&&player.Grounded;
        }

        public bool Interact()
        {
            if(player==null||!player.enabled||NotebookUI.BlocksInput)return false;
            switch(chapter)
            {
                case Chapter.FindWinch:
                    if(!Near(4.3f,4f,1.65f))return false;
                    chapter=Chapter.Recovering;StartCoroutine(Recover());return true;
                case Chapter.OpenParcel:
                    if(!Near(.4f,0,1.8f))return false;
                    awaitingFirstClose=true;chapter=Chapter.ReadNotebook;Save();StartCoroutine(OpenParcel());return true;
                case Chapter.SetCourse:
                    int index=NearestDial();
                    if(index<0)return false;
                    dials[index]=(dials[index]+1)%10;
                    bool solved=true;for(int i=0;i<3;i++)if(dials[i]!=CourseCode[i])solved=false;
                    if(solved)chapter=Chapter.ReachHelm;
                    UpdateDials();Save();RefreshText();return true;
                case Chapter.ReachHelm:
                    if(!Near(0,-5.8f,2.1f))return false;
                    chapter=Chapter.Departing;Save();StartCoroutine(Depart());return true;
                default:return false;
            }
        }

        int NearestDial()
        {
            int best=-1;float distance=1.25f*1.25f;
            for(int i=0;i<3;i++)
            {
                var p=player.transform.position;
                float candidate=new Vector2(p.x-DialX[i],p.z+5.8f).sqrMagnitude;
                if(candidate<distance){best=i;distance=candidate;}
            }
            return player.Grounded?best:-1;
        }

        void Save()
        {
            if(previewOnly)return;
            bool recovered=chapter>=Chapter.OpenParcel,opened=chapter>=Chapter.ReadNotebook,
                read=chapter>=Chapter.SetCourse,solved=chapter>=Chapter.ReachHelm,
                departed=chapter>=Chapter.Departing;
            StarsailProgress.Current.Save(recovered,opened,read,solved,departed,dials);
        }

        void UpdateDials()
        {
            if(dialFaces!=null)for(int i=0;i<Mathf.Min(3,dialFaces.Length);i++)
                if(dialFaces[i]!=null)dialFaces[i].text=dials[i].ToString();
            if(courseLight!=null){courseLight.enabled=CourseSolved;courseLight.intensity=CourseSolved?5:0;}
        }

        void UpdateCable()
        {
            if(cable==null||parcel==null)return;
            cable.SetPosition(0,winchAnchor);
            cable.SetPosition(1,pulleyAnchor);
            cable.SetPosition(2,parcel.position+Vector3.up*.38f);
        }

        IEnumerator Recover()
        {
            elapsed=0;cable.enabled=true;
            while(elapsed<1.5f)
            {
                elapsed+=Time.deltaTime;
                float t=Mathf.SmoothStep(0,1,Mathf.Clamp01(elapsed/1.5f));
                parcel.position=Vector3.Lerp(outside,onDeck,t)+Vector3.up*Mathf.Sin(t*Mathf.PI)*1.7f;
                UpdateCable();
                yield return null;
            }
            parcel.position=onDeck;cable.enabled=false;
            chapter=Chapter.OpenParcel;Save();RefreshText();
        }

        IEnumerator OpenParcel()
        {
            float t=0;
            while(t<.55f){t+=Time.deltaTime;lid.localRotation=Quaternion.Euler(-Mathf.SmoothStep(0,112,Mathf.Clamp01(t/.55f)),0,0);yield return null;}
            notebook.SetAvailable(true);
            RefreshText();
            notebook.TryOpen();
        }

        IEnumerator Depart()
        {
            player.enabled=false;orbit.enabled=false;
            for(float t=0;t<1.1f;t+=Time.deltaTime){SetFade(Mathf.Clamp01(t/1.1f));yield return null;}
            SetFade(1);
            SceneManager.LoadScene("PlanetExploration");
        }

        void SetFade(float alpha)
        {
            if(departureFade==null)return;
            var color=departureFade.color;color.a=alpha;departureFade.color=color;
            departureFade.raycastTarget=alpha>0;
        }

        void RefreshText()
        {
            if(objective==null||prompt==null)return;
            string goal="",hint="";
            switch(chapter)
            {
                case Chapter.FindWinch:
                    goal="우주에서 발견한 소포";
                    hint=Near(4.3f,4f,1.65f)?"E  우현 회수 손잡이 당기기":"배 오른쪽의 금빛 손잡이로 가서 소포를 건져 올리자";break;
                case Chapter.Recovering:goal="소포를 건져 올리는 중";hint="소포가 갑판으로 올라오고 있다";break;
                case Chapter.OpenParcel:
                    goal="누가 보낸 소포일까?";
                    hint=Near(.4f,0,1.8f)?"E  갑판 가운데의 소포 열기":"갑판 가운데에 내려온 소포를 살펴보자";break;
                case Chapter.ReadNotebook:goal="소포 속 낡은 수첩";hint="받는 사람: 다음 여행자  ·  보낸 사람: 없음";break;
                case Chapter.SetCourse:
                    goal="수첩의 별자리 숫자로 항로 맞추기";
                    int dial=NearestDial();
                    hint=dial>=0?"E  "+(dial+1)+"번째 항해 다이얼 돌리기 · 현재 "+dials[dial]:
                        "선미의 숫자판 세 개를 수첩 뒷장의 자리와 맞추자 · N 수첩";break;
                case Chapter.ReachHelm:
                    goal="항로 완성 · 작은 초록 별로 출발";
                    hint=Near(0,-5.8f,2.1f)?"E  항해대에서 행성으로 출발":"숫자판에 불이 들어왔다. 항해대에서 출발하자";break;
                case Chapter.Departing:goal="무무 행성으로";hint="범선이 행성으로 향한다";break;
            }
            if(objective.text!=goal)objective.text=goal;
            if(prompt.text!=hint)prompt.text=hint;
        }

        void OnDisable(){StopAllCoroutines();if(cable!=null)cable.enabled=false;}
    }
}
