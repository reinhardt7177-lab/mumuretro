using UnityEngine;

namespace Mumu.Planet
{
    // Room 3: slide a square panel (and later the lamp) along one optical bench so that the panel's shadow
    // fills the gold outline on the screen. size = 0.9 * (screen - lamp) / (panel - lamp) (web SilhouetteCourt).
    // Audit improvements: the three rounds change the condition (enlarge, shrink, then move the light source),
    // and a held device is drawn gently onto the answer within 0.3 m instead of demanding a narrow tolerance.
    public sealed class SilhouetteRoom : ShadowRoom
    {
        // Screen at 47.8 (the art moved it from the web's 48.65 so its backing clears the z=49 gate post).
        public const float AxisX=-3.4f,BeamY=2.8f,ScreenZ=47.8f,Panel=.9f,LampHome=38.2f,PanelMin=39.4f,PanelMax=46.6f,Gap=1.2f,LampMin=37.6f,Home=42.6f;
        public const float HandleX=1.35f,Reach=1.4f,LetGo=2.4f,SnapZone=.3f,SnapSpeed=.9f,FollowSpeed=6f,Tolerance=.06f,ScreenSize=4f;
        public const string PromptRelease="E  놓기  ·  ",PromptPanel="E  가림판 손잡이 잡기",PromptLamp="E  등불 손잡이 잡기",
            PromptPanelLocked="가림판은 고정되었다 · 이번엔 등불을 옮긴다",PromptLampLocked="등불은 아직 움직이지 않는다 · 가림판을 옮긴다",
            PromptWalk="손잡이를 잡고 걸어서 옮긴다",CompareBig="그림자가 테두리보다 크다",CompareSmall="그림자가 테두리보다 작다",CompareNear="거의 맞았다",
            NoteMatch="맞았다 · 다음 테두리",NoteLampTurn="이번엔 가림판이 멈췄다 · 등불을 옮겨라";

        [SerializeField] Transform panelCart,lampStand;
        [SerializeField] Transform[] outline=new Transform[4];
        [SerializeField] Renderer[] pips=new Renderer[3];
        float d1,d2,u;
        int round;float panelZ=Home,lampZ=LampHome;int held;float dragOffset;
        MaterialPropertyBlock block;

        public void ConfigureDevices(Transform panelCarriage,Transform lampCarriage,Transform[] outlineBars,Renderer[] progress)
        {panelCart=panelCarriage;lampStand=lampCarriage;outline=outlineBars;pips=progress;}
        public override string Title=>"그림자 크기";
        public override string Goal=>round>=2?"이번엔 등불을 옮겨 판의 그림자를 테두리에 맞춰라.":"가림판을 밀어 판의 그림자를 화면의 테두리에 맞춰라.";
        public override bool Solved=>round>=3;
        public int Round=>round;
        public float PanelZ=>panelZ;
        public float LampZ=>lampZ;
        public int Held=>held;
        public float Size=>ShadowOptics.ShadowWidth(Panel,lampZ,panelZ,ScreenZ);
        public float PanelAnswer(int i)=>LampHome+(i==0?d1:d2);
        public float LampAnswer=>LampHome+u;
        public float Hole=>HoleFor(Mathf.Min(round,2));
        public float HoleFor(int r)=>r<2?ShadowOptics.ShadowWidth(Panel,LampHome,PanelAnswer(r),ScreenZ):ShadowOptics.ShadowWidth(Panel,LampAnswer,PanelAnswer(1),ScreenZ);
        public bool Matched=>Mathf.Abs(Size-Hole)<Hole*Tolerance;
        public Vector3 PanelHandle=>new Vector3(AxisX+HandleX,0,panelZ+.105f);
        public Vector3 LampHandle=>new Vector3(AxisX+HandleX,0,lampZ);

        public override string Hint(int level)
        {
            if(level==1)return "등불에 가까울수록 그림자가 커진다.";
            if(level==2)return "판을 등불 쪽으로 밀면 그림자가 커지고, 화면 쪽으로 밀면 작아진다. 등불을 옮겨도 마찬가지다.";
            bool small=Size<Hole;
            if(round>=2)return small?"등불을 판 쪽으로 옮겨라.":"등불을 판에서 먼 쪽으로 옮겨라.";
            return small?"판을 등불 쪽으로 밀어라.":"판을 화면 쪽으로 밀어라.";
        }
        public override void Setup(ShadowTemple temple,System.Random random)
        {
            base.Setup(temple,random);
            d1=Range(random,2.7f,3.5f);d2=Range(random,6.6f,8.0f);u=Range(random,3.2f,4.2f);
            round=0;panelZ=Home;lampZ=LampHome;held=0;dragOffset=0;Present();
        }
        static float Range(System.Random random,float a,float b)=>a+(float)random.NextDouble()*(b-a);
        bool CanGrab(int device)=>round<2?device==1:round==2&&device==2;
        int NearHandle(Vector3 p)
        {
            float dp=FlatDistance(p,PanelHandle),dl=FlatDistance(p,LampHandle);
            if(dp<Reach&&dp<=dl)return 1;
            if(dl<Reach)return 2;
            return 0;
        }
        public override void Tick(float dt,PlanetExplorer player,bool inside)
        {
            if(held!=0)
            {
                var p=player.transform.position;
                var handle=held==1?PanelHandle:LampHandle;
                if(!inside||Mathf.Abs(p.x-handle.x)>=LetGo)held=0;
                else
                {
                    float desired=p.z-dragOffset;
                    if(held==1)
                    {
                        desired=Mathf.Clamp(desired,Mathf.Max(PanelMin,lampZ+Gap),PanelMax);
                        float answer=PanelAnswer(round);
                        panelZ=Mathf.Abs(desired-answer)<SnapZone?Mathf.MoveTowards(panelZ,answer,SnapSpeed*dt):Mathf.MoveTowards(panelZ,desired,FollowSpeed*dt);
                    }
                    else
                    {
                        desired=Mathf.Clamp(desired,LampMin,panelZ-Gap);
                        lampZ=Mathf.Abs(desired-LampAnswer)<SnapZone?Mathf.MoveTowards(lampZ,LampAnswer,SnapSpeed*dt):Mathf.MoveTowards(lampZ,desired,FollowSpeed*dt);
                    }
                    if(Matched)Advance();
                }
            }
            Present();
        }
        void Advance()
        {
            held=0;round++;
            if(round==2){panelZ=PanelAnswer(1);Temple?.ShowNote(NoteLampTurn,3.2f);}
            else if(round<2)Temple?.ShowNote(NoteMatch,2.4f);
        }
        void Present()
        {
            if(panelCart!=null)panelCart.position=new Vector3(AxisX,0,panelZ);
            if(lampStand!=null)lampStand.position=new Vector3(AxisX,0,lampZ);
            float side=Mathf.Min(ScreenSize,Hole),t=.045f,z=ScreenZ-.012f;
            if(outline.Length==4&&outline[0]!=null)
            {
                outline[0].position=new Vector3(AxisX,BeamY+side*.5f,z);outline[0].localScale=new Vector3(side+t,t,.01f);
                outline[1].position=new Vector3(AxisX,BeamY-side*.5f,z);outline[1].localScale=new Vector3(side+t,t,.01f);
                outline[2].position=new Vector3(AxisX-side*.5f,BeamY,z);outline[2].localScale=new Vector3(t,side,.01f);
                outline[3].position=new Vector3(AxisX+side*.5f,BeamY,z);outline[3].localScale=new Vector3(t,side,.01f);
            }
            block??=new MaterialPropertyBlock();
            for(int i=0;i<pips.Length;i++)
            {
                if(pips[i]==null)continue;
                bool done=i<round;
                pips[i].GetPropertyBlock(block);
                block.SetColor("_BaseColor",done?new Color(1,.82f,.48f):new Color(.33f,.34f,.36f));
                block.SetColor("_EmissionColor",done?new Color(1,.82f,.48f)*1.6f:Color.black);
                pips[i].SetPropertyBlock(block);
            }
        }
        public override string Prompt(Vector3 player)
        {
            if(Solved)return null;
            string count="  ("+(round+1)+"/3)";
            if(held!=0)
            {
                float size=Size,hole=Hole;
                string compare=size>hole*(1+Tolerance)?CompareBig:size<hole*(1-Tolerance)?CompareSmall:CompareNear;
                return PromptRelease+compare+count;
            }
            int near=NearHandle(player);
            if(near!=0)return CanGrab(near)?(near==1?PromptPanel:PromptLamp)+count:(near==1?PromptPanelLocked:PromptLampLocked);
            return PromptWalk+count;
        }
        public override bool Interact(Vector3 player,int direction)
        {
            if(Solved)return false;
            if(held!=0){held=0;return true;}
            if(direction<0)return false;
            int near=NearHandle(player);
            if(near==0||!CanGrab(near))return false;
            held=near;dragOffset=player.z-(near==1?panelZ:lampZ);
            return true;
        }
        public override void Release(){held=0;}
        public override void Capture(ShadowTempleRecord record){record.round=round;record.panelZ=panelZ;record.lampZ=lampZ;}
        public override bool Restore(ShadowTempleRecord record,out string problem)
        {
            problem=null;held=0;round=record.round;panelZ=record.panelZ;lampZ=record.lampZ;
            if(round>=2&&Mathf.Abs(panelZ-PanelAnswer(1))>1e-3f){problem="silhouette panel is not at its locked position";return false;}
            if(round<2&&Mathf.Abs(lampZ-LampHome)>1e-3f){problem="silhouette lamp moved before its round";return false;}
            if(round>=3){panelZ=PanelAnswer(1);lampZ=LampAnswer;}
            Present();return true;
        }
        // Validation hook: move devices directly (planned walks use Interact and Step instead).
        public void PlaceForValidation(float panel,float lampPosition){panelZ=panel;lampZ=lampPosition;Present();}
    }
}
