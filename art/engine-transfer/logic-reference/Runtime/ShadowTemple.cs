using System;
using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

namespace Mumu.Planet
{
    // One room of the shadow temple. Rooms own their devices, optics and prompts; ShadowTemple owns the
    // player, doors, hints, keeper lines and the save record.
    public abstract class ShadowRoom : MonoBehaviour
    {
        [SerializeField] protected ShadowOptics.Area area;
        [SerializeField] protected Transform hintPost;
        [SerializeField] protected Light lamp;
        [SerializeField] protected float framingPitch=26,framingDistance=7;
        public ShadowTemple Temple {get;private set;}
        public ShadowOptics.Area Area=>area;
        public Transform HintPost=>hintPost;
        public Light Lamp=>lamp;
        public float FramingPitch=>framingPitch;
        public float FramingDistance=>framingDistance;
        public abstract string Title {get;}
        public abstract string Goal {get;}
        public abstract bool Solved {get;}
        // level 1 = what to look at, 2 = the relation, 3 = the next single action (audit: 공통 기준 2).
        public abstract string Hint(int level);
        public virtual void Setup(ShadowTemple temple,System.Random random){Temple=temple;}
        public abstract string Prompt(Vector3 player);
        public abstract bool Interact(Vector3 player,int direction);
        public abstract void Tick(float dt,PlanetExplorer player,bool inside);
        public abstract void Capture(ShadowTempleRecord record);
        public abstract bool Restore(ShadowTempleRecord record,out string problem);
        public virtual void Release(){}
        public bool Contains(Vector3 p)=>area.Contains(ShadowOptics.Flat(p));
        public void ConfigureRoom(ShadowOptics.Area walkable,Transform post,Light light,float pitch,float distance)
        {area=walkable;hintPost=post;lamp=light;framingPitch=pitch;framingDistance=distance;}
        protected static float FlatDistance(Vector3 a,Vector3 b)=>Vector2.Distance(ShadowOptics.Flat(a),ShadowOptics.Flat(b));
    }

    public sealed class ShadowTemple : MonoBehaviour
    {
        public const string SceneName="ShadowTemple",Keeper="거울의 지킴이";
        public static readonly Vector3 Spawn=new Vector3(0,0,-11.5f);
        public static readonly Vector3 PortalZone=new Vector3(0,0,-13.3f);
        public const float PortalRadius=1.6f,PostReach=1.5f,HintInterval=45f,FailHintBonus=8f;
        // Walkable segments in order and the stage that opens each: entry, room 1, bridge, room 2, bridge, room 3, bridge, sanctum.
        public static readonly ShadowOptics.Area[] Segments={
            new ShadowOptics.Area(-3.2f,3.2f,-14.1f,-8f),new ShadowOptics.Area(-6.7f,6.7f,-8f,11f),new ShadowOptics.Area(-1.8f,1.8f,11f,17f),
            new ShadowOptics.Area(-8.7f,8.7f,17f,31f),new ShadowOptics.Area(-1.8f,1.8f,31f,37f),new ShadowOptics.Area(-6.7f,6.7f,37f,49f),
            new ShadowOptics.Area(-1.8f,1.8f,49f,55f),new ShadowOptics.Area(-10.7f,10.7f,55f,71f)};
        static readonly int[] RequiredStage={0,0,1,1,2,2,3,3};
        public const string LineWelcome="불을 켜지 마라. 여긴 어둠이 길이다.",LineSanctum="네 그림자를 오래 본 적 있니.";
        public static readonly string[] EndingLines={
            "그림자는 네가 거기 있다는 증거다. 빛이 있으니까 생기는 거고.",
            "무서워하는 아이들이 많았다. 자기 그림자를.",
            "이제 너는 안 무섭겠구나."};
        public const string ClosingRemaining="…아직 남았구나. 이 별의 다른 신전도 너를 기다린다.",ClosingAll="…이 별의 세 지혜가 모두 네 수첩에 있다.";
        public const string PromptLeave="E  행성으로 돌아가기",PromptHint="E  힌트 보기",PromptHintsRead="힌트를 모두 읽었다",
            NoteDoor="문이 열렸다",NoteUnreadable="기록을 읽지 못했다. 기존 파일은 그대로 두고 이번 탐사를 이어 간다.",
            NoteUnsaved="이번 진행은 저장하지 못했다.",NoteLeaving="행성으로 돌아간다",NoteDone="그림자의 지혜를 수첩에 적었다",
            HintLocked="아직 잠겨 있다\n오래 머물거나 E로 연다",TitleShrine="그림자의 사당",GoalShrine="밤의 회랑을 따라 지킴이에게 가자",
            SpeechNext="E / Space  다음";

        [SerializeField] PlanetExplorer player;
        [SerializeField] OrbitCamera orbit;
        [SerializeField] ShadowRoom[] rooms=new ShadowRoom[0];
        [SerializeField] Renderer[] gateVeils=new Renderer[0];
        [SerializeField] Collider[] gateBlocks=new Collider[0];
        [SerializeField] Renderer[] gateGlows=new Renderer[0];
        [SerializeField] TextMeshProUGUI title,goal,prompt,note,speaker,speech;
        [SerializeField] GameObject promptPanel,notePanel,speechPanel;
        [SerializeField] Image fade;
        [SerializeField] TextMeshPro[] hintBoards=new TextMeshPro[0];

        ShadowTempleStore store;
        ShadowTempleRecord record;
        string lastSaved,noteText,problem;
        float noteClock,saveClock,speechCooldown,speechClock,departClock=-1;
        float[] gateOpen=new float[3];
        int currentRoom=-1,framedRoom=-2;
        string[] speechLines;int speechIndex=-1;Action speechDone;bool speechAuto;
        bool started,departingCompleted;
        MaterialPropertyBlock block;

        public bool ManualDrive {get;set;}
        public bool SuppressDeparture {get;set;}
        public bool DepartureRequested {get;private set;}
        public bool Departing=>departClock>=0;
        public ShadowRoom[] Rooms=>rooms;
        public ShadowTempleRecord Record=>record;
        public ShadowTempleStore Store=>store;
        public int Stage=>record!=null?record.stage:0;
        public int CurrentRoom=>currentRoom;
        public string PromptText=>promptPanel!=null&&promptPanel.activeSelf?prompt.text:"";
        public string NoteText=>notePanel!=null&&notePanel.activeSelf?note.text:"";
        public string TitleText=>title!=null?title.text:"";
        public string GoalText=>goal!=null?goal.text:"";
        public bool SpeechActive=>speechIndex>=0;
        public string SpeechText=>SpeechActive?speech.text:"";
        public string Problem=>problem;
        public TMP_FontAsset Font=>prompt!=null?prompt.font:null;
        public PlanetExplorer Player=>player;
        public OrbitCamera Orbit=>orbit;
        public bool GateOpen(int i)=>i>=0&&i<gateBlocks.Length&&gateBlocks[i]!=null&&!gateBlocks[i].enabled;
        public int HintLevel(int room)=>record.hintLevel[room];
        public float HintTime(int room)=>record.hintTime[room];
        public string HintBoardText(int room)=>room<hintBoards.Length&&hintBoards[room]!=null?hintBoards[room].text:"";
        public int FailCount=>record!=null?record.shadeFails:0;
        public bool Saved {get;private set;}

        public void Configure(PlanetExplorer explorer,OrbitCamera cameraRig,ShadowRoom[] roomList,Renderer[] veils,Collider[] blocks,Renderer[] glows,
            TextMeshProUGUI titleText,TextMeshProUGUI goalText,TextMeshProUGUI promptText,TextMeshProUGUI noteLine,TextMeshProUGUI speakerText,TextMeshProUGUI speechText,
            GameObject promptBox,GameObject noteBox,GameObject speechBox,Image fadeImage,TextMeshPro[] boards)
        {
            player=explorer;orbit=cameraRig;rooms=roomList;gateVeils=veils;gateBlocks=blocks;gateGlows=glows;
            title=titleText;goal=goalText;prompt=promptText;note=noteLine;speaker=speakerText;speech=speechText;
            promptPanel=promptBox;notePanel=noteBox;speechPanel=speechBox;fade=fadeImage;hintBoards=boards;
        }

        void Start()
        {
            block=new MaterialPropertyBlock();
            if(fade!=null){fade.gameObject.SetActive(false);}
            if(speechPanel!=null)speechPanel.SetActive(false);
            if(notePanel!=null)notePanel.SetActive(false);
            // A completed temple stays sealed: an old journey record must not reopen it.
            if(ShadowApproachProgress.Current.Completed&&!Application.isEditor&&Array.IndexOf(Environment.GetCommandLineArgs(),"-mumu-shadow-temple-smoke")<0)
            {SceneManager.LoadScene("PlanetExploration");return;}
            Begin(ShadowTempleProgress.Current);
        }

        // Also used by validation to restart on an isolated store without reloading the scene.
        public void Begin(ShadowTempleStore source)
        {
            store=source;problem=store.Problem;
            var saved=store.Current;
            ShadowTempleRecord restored=null;
            if(saved!=null&&saved.active)
            {
                if(TryApply(saved,out string reason))restored=saved.Copy();
                else{store.Protect("Shadow temple record kept unchanged: "+reason);problem=store.Problem;}
            }
            if(restored==null)
            {
                record=new ShadowTempleRecord{seed=NewSeed()};
                if(!TryApply(record,out string reason))throw new InvalidOperationException("A new shadow temple failed its own layout check: "+reason);
                player.Respawn(Spawn,Vector3.forward);
            }
            else
            {
                record=restored;
                var point=new Vector3(record.x,0,record.z);
                if(!CheckpointValid(point,record.stage))point=Spawn;
                player.Respawn(point,Quaternion.Euler(0,record.yaw,0)*Vector3.forward);
            }
            for(int i=0;i<gateOpen.Length;i++){gateOpen[i]=record.stage>i?1:0;ApplyGate(i);}
            if(orbit!=null)orbit.Snap();
            started=true;
            if(!string.IsNullOrEmpty(problem))ShowNote(NoteUnreadable,6);
            if(!record.greeted){record.greeted=true;Say(new[]{LineWelcome},null,true);}
            lastSaved=null;SaveNow();
            RefreshHud();
        }
        static int NewSeed(){unchecked{return Guid.NewGuid().GetHashCode()&0x7fffffff;}}
        // Builds every room layout from the seed, then applies the stored state if it is consistent with it.
        bool TryApply(ShadowTempleRecord candidate,out string reason)
        {
            var random=new System.Random(candidate.seed);
            foreach(var room in rooms)room.Setup(this,random);
            for(int i=0;i<rooms.Length;i++)if(!rooms[i].Restore(candidate,out reason)){return false;}
            reason=null;return true;
        }
        public static bool CheckpointValid(Vector3 p,int stage)
        {
            var flat=ShadowOptics.Flat(p);
            for(int i=0;i<Segments.Length;i++)if(Segments[i].Contains(flat)&&stage>=RequiredStage[i])return true;
            return false;
        }

        void Update()
        {
            if(!started||ManualDrive)return;
            if(NotebookUI.BlocksInput)return;
            Step(Mathf.Min(Time.deltaTime,.05f),true);
        }

        public void Step(float dt,bool readInput)
        {
            if(!started)return;
            dt=Mathf.Max(0,dt);
            if(Departing){TickDeparture(dt);return;}
            speechCooldown=Mathf.Max(0,speechCooldown-dt);
            if(noteClock>0){noteClock-=dt;if(noteClock<=0&&notePanel!=null)notePanel.SetActive(false);}
            for(int i=0;i<gateOpen.Length;i++)if(record.stage>i&&gateOpen[i]<1){gateOpen[i]=Mathf.MoveTowards(gateOpen[i],1,dt/1.2f);ApplyGate(i);}
            var k=readInput?Keyboard.current:null;
            if(SpeechActive)
            {
                player.InputLocked=true;
                speechClock+=dt;
                if(k!=null&&(k.eKey.wasPressedThisFrame||k.spaceKey.wasPressedThisFrame))AdvanceSpeech();
                else if(speechAuto&&speechClock>5.5f)AdvanceSpeech();
                RefreshHud();return;
            }
            player.InputLocked=false;
            currentRoom=-1;
            for(int i=0;i<rooms.Length;i++)if(rooms[i].Contains(player.transform.position)){currentRoom=i;break;}
            UpdateFraming();
            for(int i=0;i<rooms.Length;i++)rooms[i].Tick(dt,player,i==currentRoom);
            for(int i=0;i<rooms.Length;i++)if(rooms[i].Solved&&record.stage==i)
            {
                record.stage=i+1;
                if(i<3)ShowNote(NoteDoor,3);
                SaveNow();
            }
            if(currentRoom==3&&!record.sanctumGreeted){record.sanctumGreeted=true;Say(new[]{LineSanctum},null,true);}
            if(currentRoom>=0&&!rooms[currentRoom].Solved)
            {
                record.hintTime[currentRoom]+=dt;
                int auto=Mathf.Min(3,Mathf.FloorToInt(record.hintTime[currentRoom]/HintInterval));
                if(auto>record.hintLevel[currentRoom]){record.hintLevel[currentRoom]=auto;ShowNote("힌트 "+auto+"이 켜졌다 · 입구 옆 힌트 기둥",3);}
            }
            if(k!=null)
            {
                if(k.eKey.wasPressedThisFrame)Interact(1);
                else if(k.qKey.wasPressedThisFrame)Interact(-1);
            }
            if(player.transform.position.y< -3)
            {
                var point=new Vector3(record.x,0,record.z);if(!CheckpointValid(point,record.stage))point=Spawn;
                foreach(var room in rooms)room.Release();
                player.Respawn(point,Vector3.forward);if(orbit!=null)orbit.Snap();
            }
            CaptureCheckpoint();
            saveClock+=dt;if(saveClock>=1){saveClock=0;SaveNow();}
            RefreshHud();
        }

        // E = +1, Q = -1. Priority: exit portal, the hint post of the current room, then the room's devices.
        public bool Interact(int direction)
        {
            if(Departing)return false;
            if(SpeechActive){if(direction>0)AdvanceSpeech();return true;}
            var p=player.transform.position;
            if(direction>0&&NearPortal(p)){Leave();return true;}
            int post=NearPost(p);
            if(post>=0&&direction>0)
            {
                if(record.hintLevel[post]>=3)return false;
                record.hintLevel[post]++;RefreshHints();SaveNow();return true;
            }
            if(currentRoom<0)return false;
            bool changed=rooms[currentRoom].Interact(p,direction);
            if(changed)SaveNow();
            return changed;
        }
        public bool NearPortal(Vector3 p)=>Vector2.Distance(ShadowOptics.Flat(p),ShadowOptics.Flat(PortalZone))<PortalRadius;
        public int NearPost(Vector3 p)
        {
            for(int i=0;i<rooms.Length;i++)
                if(rooms[i].HintPost!=null&&Vector2.Distance(ShadowOptics.Flat(p),ShadowOptics.Flat(rooms[i].HintPost.position))<PostReach)return i;
            return -1;
        }
        // Called by rooms: failures add hint time (web rule +8 s) and show a note.
        public void ReportFailure(ShadowRoom room,string message)
        {
            int i=Array.IndexOf(rooms,room);
            if(i>=0)record.hintTime[i]+=FailHintBonus;
            ShowNote(message,2.6f);
        }
        public void ShowNote(string text,float seconds)
        {
            noteText=text;noteClock=seconds;
            if(note!=null)note.text=text;
            if(notePanel!=null)notePanel.SetActive(true);
        }

        public void Say(string[] lines,Action done,bool auto=false)
        {
            speechLines=lines;speechIndex=0;speechDone=done;speechAuto=auto;speechClock=0;speechCooldown=.3f;
            foreach(var room in rooms)room.Release();
            RefreshHud();
        }
        public void AdvanceSpeech()
        {
            if(!SpeechActive||speechCooldown>0)return;
            speechCooldown=.3f;speechClock=0;
            if(speechIndex+1<speechLines.Length){speechIndex++;RefreshHud();return;}
            speechIndex=-1;var done=speechDone;speechDone=null;
            if(speechPanel!=null)speechPanel.SetActive(false);
            player.InputLocked=false;
            done?.Invoke();RefreshHud();
        }

        // The sanctum calls this after the orb is taken.
        public void BeginEnding()
        {
            bool others=!TempleProgress.Current.Completed||!WaterApproachProgress.Current.Completed;
            var lines=new List<string>(EndingLines){others?ClosingRemaining:ClosingAll};
            Say(lines.ToArray(),Complete);
        }
        void Complete()
        {
            record.active=false;record.stage=4;
            bool journeySaved=store.Save(record);
            bool approachSaved=ShadowApproachProgress.Current.Complete();
            Saved=journeySaved&&approachSaved;
            if(!approachSaved)Debug.LogWarning("Shadow wisdom completed this session; the planet record was not written: "+ShadowApproachProgress.Current.Problem);
            ShowNote(Saved?NoteDone:NoteUnsaved,4);
            departingCompleted=true;BeginDeparture();
        }
        public void Leave()
        {
            foreach(var room in rooms)room.Release();
            CaptureCheckpoint();SaveNow();
            ShowNote(NoteLeaving,2);departingCompleted=false;BeginDeparture();
        }
        void BeginDeparture()
        {
            departClock=0;DepartureRequested=true;player.InputLocked=true;
            ShadowApproachProgress.ArrivalPending=true;
            if(fade!=null){fade.gameObject.SetActive(true);var c=fade.color;c.a=0;fade.color=c;}
        }
        void TickDeparture(float dt)
        {
            departClock+=dt;
            if(fade!=null){var c=fade.color;c.a=Mathf.Clamp01(departClock/.95f);fade.color=c;}
            if(departClock>=1.25f&&!SuppressDeparture){departClock=-2;SceneManager.LoadScene("PlanetExploration");}
        }
        public bool CompletedThisSession=>departingCompleted;

        void CaptureCheckpoint()
        {
            if(!player.Grounded)return;
            var p=player.transform.position;
            if(!CheckpointValid(p,record.stage))return;
            // An unsolved shade walk resumes before the lit band, like the web hazard checkpoint.
            if(record.stage==0&&rooms.Length>0&&rooms[0].Contains(p)&&p.z> -2.8f){record.x=0;record.z=-4.2f;record.yaw=0;return;}
            record.x=p.x;record.z=p.z;record.yaw=player.transform.eulerAngles.y;
        }
        public bool SaveNow()
        {
            if(record==null||store==null)return false;
            foreach(var room in rooms)room.Capture(record);
            string json=JsonUtility.ToJson(record);
            if(json==lastSaved)return Saved;
            if(!ShadowTempleRecord.Valid(record,out string reason)){Debug.LogWarning("Shadow temple state not saved: "+reason);return false;}
            Saved=store.Save(record);
            if(Saved)lastSaved=json;
            return Saved;
        }
        void OnApplicationPause(bool paused){if(paused&&started)SaveNow();}
        void OnApplicationFocus(bool focused){if(!focused&&started)SaveNow();}
        void OnApplicationQuit(){if(started&&!Departing)SaveNow();}

        void ApplyGate(int i)
        {
            if(i>=gateBlocks.Length)return;
            float open=gateOpen[i];
            if(gateBlocks[i]!=null)gateBlocks[i].enabled=open<.98f;
            if(i<gateVeils.Length&&gateVeils[i]!=null)
            {
                gateVeils[i].enabled=open<.995f;
                gateVeils[i].GetPropertyBlock(block??(block=new MaterialPropertyBlock()));
                block.SetColor("_BaseColor",new Color(.06f,.10f,.22f,.78f*(1-open)));
                gateVeils[i].SetPropertyBlock(block);
            }
            if(i<gateGlows.Length&&gateGlows[i]!=null)
            {
                gateGlows[i].GetPropertyBlock(block);
                block.SetColor("_EmissionColor",Color.Lerp(new Color(.35f,.33f,.28f),new Color(1.6f,1.25f,.55f),open));
                gateGlows[i].SetPropertyBlock(block);
            }
        }
        void UpdateFraming()
        {
            int target=currentRoom;
            if(target<0)
            {
                float z=player.transform.position.z;
                target=z<11?0:z<31?1:z<49?2:3;
            }
            for(int i=0;i<rooms.Length;i++)
                if(rooms[i].Lamp!=null)rooms[i].Lamp.shadows=i==target?LightShadows.Soft:LightShadows.None;
            if(target==framedRoom||orbit==null)return;
            framedRoom=target;orbit.BlendFraming(rooms[target].FramingPitch,rooms[target].FramingDistance);
        }
        void RefreshHints()
        {
            for(int i=0;i<rooms.Length&&i<hintBoards.Length;i++)
            {
                if(hintBoards[i]==null)continue;
                int level=record.hintLevel[i];
                string text="<b>힌트</b>\n";
                if(level==0)text+=HintLocked;
                for(int h=1;h<=level;h++)text+=(h>1?"\n":"")+h+". "+rooms[i].Hint(h);
                if(hintBoards[i].text!=text)hintBoards[i].text=text;
            }
        }
        void RefreshHud()
        {
            if(title==null)return;
            RefreshHints();
            string t=currentRoom>=0?rooms[currentRoom].Title:TitleShrine;
            string g=currentRoom>=0?(rooms[currentRoom].Solved?"다음 문으로":rooms[currentRoom].Goal):GoalShrine;
            if(title.text!=t)title.text=t;if(goal.text!=g)goal.text=g;
            if(SpeechActive)
            {
                if(speechPanel!=null&&!speechPanel.activeSelf)speechPanel.SetActive(true);
                if(speaker.text!=Keeper)speaker.text=Keeper;
                string line=speechLines[speechIndex]+"\n<size=70%>"+SpeechNext+"</size>";
                if(speech.text!=line)speech.text=line;
                if(promptPanel.activeSelf)promptPanel.SetActive(false);
                return;
            }
            var p=player.transform.position;
            string text=null;
            if(NearPortal(p))text=PromptLeave;
            else
            {
                int post=NearPost(p);
                if(post>=0)text=record.hintLevel[post]>=3?PromptHintsRead:PromptHint+" ("+(record.hintLevel[post]+1)+"/3)";
                else if(currentRoom>=0)text=rooms[currentRoom].Prompt(p);
            }
            bool show=!string.IsNullOrEmpty(text);
            if(promptPanel.activeSelf!=show)promptPanel.SetActive(show);
            if(show&&prompt.text!=text)prompt.text=text;
        }
        void OnDisable(){if(player!=null)player.InputLocked=false;}
    }
}
