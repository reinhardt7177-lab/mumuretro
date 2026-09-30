using System.Collections.Generic;
using UnityEngine;

namespace Mumu.Planet
{
    // Room 2: three mirrors send the lamp beam to the first target (web MirrorGallery, rotated layout).
    // Audit improvements: turning both ways (E clockwise, Q counter-clockwise) and a second stage where a
    // fourth mirror rolls on a rail into the beam and must be placed as well as turned.
    public sealed class MirrorRoom : ShadowRoom
    {
        public const float BeamY=1.5f,CentreZ=24f,Half=.85f,SmallHalf=.6f,TargetRadius=.46f,MirrorReach=2.2f,LeverReach=1.7f,SecondTargetZ=29.6f;
        public static readonly Vector2 Source=new Vector2(-6.6f,24f);
        public static readonly ShadowOptics.Area Walls=new ShadowOptics.Area(-8.88f,8.88f,17.12f,30.88f);
        public static float StopX(int i)=>-1.7f+.5f*i;
        public const int Stops=5,MaxBounces=10;
        public const string PromptMirror="E  시계 방향  ·  Q  반대 방향  ·  ",PromptLever="E  수레를 광원에서 멀리  ·  Q  광원 쪽으로",
            PromptFirst="거울 가까이 가면 돌릴 수 있다",PromptSecond="넷째 거울은 레일 옆 손잡이로 옮긴다",NoteLock="첫 자물쇠가 걸렸다 · 넷째 거울이 올라온다";
        static readonly string[] Names={"거울 1","거울 2","거울 3","넷째 거울"};

        [SerializeField] Transform[] pedestals=new Transform[3];
        [SerializeField] Transform[] heads=new Transform[4];
        [SerializeField] Transform cart,rail,lever,emitter;
        [SerializeField] Transform[] receivers=new Transform[2];
        [SerializeField] Renderer[] hearts=new Renderer[2];
        [SerializeField] Renderer[] discs=new Renderer[2];
        [SerializeField] Transform[] beamCores=new Transform[0];
        [SerializeField] Transform[] beamHalos=new Transform[0];
        [SerializeField] Transform[] glints=new Transform[0];

        int side;float d1,dx,d2,r;int secondStop,startStop;
        readonly int[] steps={2,2,2,2};
        int cartStop;bool firstLock,solved;
        float rise;float[] shownAngle=new float[4];float cartShown;
        readonly List<ShadowOptics.Segment> segments=new List<ShadowOptics.Segment>();
        readonly ShadowOptics.Mirror[] mirrors=new ShadowOptics.Mirror[4];
        readonly ShadowOptics.Target[] targets=new ShadowOptics.Target[2];
        MaterialPropertyBlock block;
        int currentHit=-1;

        public void ConfigureDevices(Transform[] stands,Transform[] mirrorHeads,Transform railCart,Transform railTrack,Transform railLever,Transform lampSource,
            Transform[] targetRoots,Renderer[] targetHearts,Renderer[] targetDiscs,Transform[] cores,Transform[] halos,Transform[] sparks)
        {pedestals=stands;heads=mirrorHeads;cart=railCart;rail=railTrack;lever=railLever;emitter=lampSource;receivers=targetRoots;hearts=targetHearts;discs=targetDiscs;beamCores=cores;beamHalos=halos;glints=sparks;}

        public override string Title=>"거울 세 장";
        public override string Goal=>firstLock?"넷째 거울을 옮겨 빛을 문 앞 둘째 표적에 꽂아라.":"거울을 돌려 빛을 표적에 꽂아라.";
        public override bool Solved=>solved;
        public bool FirstLock=>firstLock;
        public int Side=>side;
        public int SecondStop=>secondStop;
        public int StartStop=>startStop;
        public int CartStop=>cartStop;
        public int Step(int i)=>steps[i];
        public int CurrentHit=>currentHit;
        public List<ShadowOptics.Segment> Segments=>segments;
        public float RailZ=>CentreZ+side*dx;
        public Vector2 MirrorCentre(int i)=>i==0?new Vector2(d1-7,CentreZ):i==1?new Vector2(d1-7,RailZ):i==2?new Vector2(d2-7,RailZ):new Vector2(StopX(cartStop),RailZ);
        public Vector2 TargetCentre(int i)=>i==0?new Vector2(d2-7,CentreZ-side*r):new Vector2(StopX(secondStop),SecondTargetZ);
        public Vector2 LeverCentre=>new Vector2(-.7f,RailZ-side*1.3f);
        public int[] FirstAnswer=>side>0?new[]{1,1,3}:new[]{3,3,1};
        public const int SecondAnswer=1;

        public override string Hint(int level)=>level==1?"빛이 어디서 끊겼는지 봐라. 거기가 고칠 거울이다.":
            level==2?"거울을 한 칸 돌리면 튕겨 나가는 빛은 두 칸만큼 돈다.":
            firstLock?"넷째 거울을 둘째 표적과 한 줄이 되는 자리로 옮긴 뒤 돌려라.":"광원에서 가장 가까운 거울부터 하나씩 맞춰라.";

        public override void Setup(ShadowTemple temple,System.Random random)
        {
            base.Setup(temple,random);
            side=random.NextDouble()<.5?-1:1;
            d1=Range(random,2.6f,3.6f);dx=Range(random,2.8f,3.6f);d2=Range(random,9.3f,10.5f);r=Range(random,3.0f,3.8f);
            secondStop=random.Next(Stops);startStop=secondStop<=2?Stops-1:0;
            for(int i=0;i<4;i++)steps[i]=2;cartStop=startStop;firstLock=false;solved=false;rise=0;
            PlaceDevices();
            for(int i=0;i<4;i++)shownAngle[i]=steps[i]*45f;cartShown=StopX(cartStop);
            Retrace();Present(0);
        }
        static float Range(System.Random random,float a,float b)=>a+(float)random.NextDouble()*(b-a);
        void PlaceDevices()
        {
            for(int i=0;i<3&&i<pedestals.Length;i++)if(pedestals[i]!=null){var c=MirrorCentre(i);pedestals[i].position=new Vector3(c.x,0,c.y);}
            if(rail!=null)rail.position=new Vector3(-.7f,0,RailZ);
            if(lever!=null)lever.position=new Vector3(LeverCentre.x,0,LeverCentre.y);
            for(int i=0;i<2&&i<receivers.Length;i++)if(receivers[i]!=null)
            {
                var c=TargetCentre(i);receivers[i].position=new Vector3(c.x,0,c.y);
                // Receivers face local -Z; turn the first one toward the beam coming from the third mirror.
                bool beamGoesDown=i==0&&c.y<RailZ;
                receivers[i].rotation=Quaternion.Euler(0,beamGoesDown?180:0,0);
            }
            if(emitter!=null)emitter.position=new Vector3(Source.x-.32f,0,Source.y);
        }
        public int TraceWith(int[] ks,int stop,bool secondStage,List<ShadowOptics.Segment> into)
        {
            for(int i=0;i<3;i++)mirrors[i]=new ShadowOptics.Mirror{centre=MirrorCentre(i),angle=ks[i]*Mathf.PI/4,half=Half,active=true};
            mirrors[3]=new ShadowOptics.Mirror{centre=new Vector2(StopX(stop),RailZ),angle=ks[3]*Mathf.PI/4,half=SmallHalf,active=secondStage};
            targets[0]=new ShadowOptics.Target{centre=TargetCentre(0),radius=TargetRadius,active=true};
            targets[1]=new ShadowOptics.Target{centre=TargetCentre(1),radius=TargetRadius,active=secondStage};
            return ShadowOptics.Trace(Source,Vector2.right,mirrors,targets,Walls,MaxBounces,into);
        }
        void Retrace()
        {
            currentHit=TraceWith(steps,cartStop,firstLock,null);
            if(!firstLock&&currentHit==0){firstLock=true;rise=0;Temple?.ShowNote(NoteLock,3);currentHit=TraceWith(steps,cartStop,true,null);}
            if(firstLock&&currentHit==1)solved=true;
        }

        public override void Tick(float dt,PlanetExplorer player,bool inside){Present(dt);}
        void Present(float dt)
        {
            if(firstLock)rise=Mathf.MoveTowards(rise,1,dt/1.6f);
            float lift=-1.4f*(1-Mathf.SmoothStep(0,1,rise));
            bool second=firstLock;
            if(cart!=null){if(cart.gameObject.activeSelf!=second)cart.gameObject.SetActive(second);cartShown=Mathf.MoveTowards(cartShown,StopX(cartStop),dt*1.2f);cart.position=new Vector3(cartShown,lift,RailZ);}
            if(rail!=null&&rail.gameObject.activeSelf!=second)rail.gameObject.SetActive(second);
            if(lever!=null){if(lever.gameObject.activeSelf!=second)lever.gameObject.SetActive(second);var c=LeverCentre;lever.position=new Vector3(c.x,lift,c.y);}
            if(receivers.Length>1&&receivers[1]!=null){if(receivers[1].gameObject.activeSelf!=second)receivers[1].gameObject.SetActive(second);var c=TargetCentre(1);receivers[1].position=new Vector3(c.x,lift,c.y);}
            for(int i=0;i<4&&i<heads.Length;i++)
            {
                if(heads[i]==null)continue;
                shownAngle[i]=Mathf.MoveTowardsAngle(shownAngle[i],steps[i]*45f,dt*360f);
                heads[i].rotation=Quaternion.Euler(0,-shownAngle[i],0);
            }
            // The drawn beam follows the turning heads; the lock and door use the settled steps (Retrace).
            var shown=new int[4];
            var drawMirrors=new ShadowOptics.Mirror[4];
            for(int i=0;i<3;i++)drawMirrors[i]=new ShadowOptics.Mirror{centre=MirrorCentre(i),angle=shownAngle[i]*Mathf.Deg2Rad,half=Half,active=true};
            drawMirrors[3]=new ShadowOptics.Mirror{centre=new Vector2(cartShown,RailZ),angle=shownAngle[3]*Mathf.Deg2Rad,half=SmallHalf,active=second&&rise>=1};
            targets[0]=new ShadowOptics.Target{centre=TargetCentre(0),radius=TargetRadius,active=true};
            targets[1]=new ShadowOptics.Target{centre=TargetCentre(1),radius=TargetRadius,active=second&&rise>=1};
            int hitShown=ShadowOptics.Trace(Source,Vector2.right,drawMirrors,targets,Walls,MaxBounces,segments);
            DrawBeam();
            block??=new MaterialPropertyBlock();
            for(int i=0;i<2;i++)
            {
                bool lit=hitShown==i||i==0&&firstLock;
                if(i<hearts.Length&&hearts[i]!=null&&hearts[i].enabled!=lit)hearts[i].enabled=lit;
                if(i<discs.Length&&discs[i]!=null)
                {
                    discs[i].GetPropertyBlock(block);
                    block.SetColor("_EmissionColor",hitShown==i?new Color(1,.93f,.73f)*2.2f:Color.black);
                    discs[i].SetPropertyBlock(block);
                }
            }
        }
        void DrawBeam()
        {
            int used=0,glint=0;
            foreach(var s in segments)
            {
                if(used>=beamCores.Length)break;
                var a=new Vector3(s.a.x,BeamY,s.a.y);var b=new Vector3(s.b.x,BeamY,s.b.y);
                float length=Vector3.Distance(a,b);
                if(length<.01f)continue;
                var rotation=Quaternion.FromToRotation(Vector3.up,(b-a)/length);
                Place(beamCores[used],(a+b)*.5f,rotation,new Vector3(.056f,length*.5f,.056f));
                if(used<beamHalos.Length)Place(beamHalos[used],(a+b)*.5f,rotation,new Vector3(.21f,length*.5f,.21f));
                used++;
                if(s.end==ShadowOptics.End.Mirror&&glint<glints.Length){glints[glint].gameObject.SetActive(true);glints[glint].position=b;glint++;}
            }
            for(int i=used;i<beamCores.Length;i++)if(beamCores[i].gameObject.activeSelf)beamCores[i].gameObject.SetActive(false);
            for(int i=used;i<beamHalos.Length;i++)if(beamHalos[i].gameObject.activeSelf)beamHalos[i].gameObject.SetActive(false);
            for(int i=glint;i<glints.Length;i++)if(glints[i].gameObject.activeSelf)glints[i].gameObject.SetActive(false);
        }
        static void Place(Transform t,Vector3 p,Quaternion q,Vector3 s){if(!t.gameObject.activeSelf)t.gameObject.SetActive(true);t.SetPositionAndRotation(p,q);t.localScale=s;}

        public const float LeverPriority=1.25f;
        int Nearest(Vector3 player,out bool isLever)
        {
            isLever=false;int best=-1;float bestDistance=float.MaxValue;var p=ShadowOptics.Flat(player);
            int count=firstLock&&rise>=1?4:3;
            // Standing at the rail lever keeps the lever selected while the cart rolls past (2026-09-30 fix:
            // the passing cart used to steal E presses from the lever).
            if(firstLock&&rise>=1&&Vector2.Distance(p,LeverCentre)<LeverPriority){isLever=true;return 4;}
            for(int i=0;i<count;i++){float d=Vector2.Distance(p,MirrorCentre(i));if(d<MirrorReach&&d<bestDistance){bestDistance=d;best=i;}}
            if(firstLock&&rise>=1){float d=Vector2.Distance(p,LeverCentre);if(d<LeverReach&&d<bestDistance){bestDistance=d;best=4;isLever=true;}}
            return best;
        }
        public override string Prompt(Vector3 player)
        {
            if(solved)return null;
            int i=Nearest(player,out bool isLever);
            if(isLever)return PromptLever;
            if(i>=0)return PromptMirror+Names[i];
            return firstLock?PromptSecond:PromptFirst;
        }
        public override bool Interact(Vector3 player,int direction)
        {
            if(solved)return false;
            int i=Nearest(player,out bool isLever);
            if(i<0)return false;
            if(isLever)
            {
                int next=Mathf.Clamp(cartStop+(direction>0?1:-1),0,Stops-1);
                if(next==cartStop)return false;
                cartStop=next;
            }
            else steps[i]=(steps[i]+(direction>0?7:1))%8;
            Retrace();return true;
        }
        public override void Capture(ShadowTempleRecord record)
        {
            for(int i=0;i<4;i++)record.mirrors[i]=steps[i];
            record.cart=cartStop;record.firstLock=firstLock;
        }
        public override bool Restore(ShadowTempleRecord record,out string problem)
        {
            problem=null;
            for(int i=0;i<4;i++){steps[i]=record.mirrors[i];shownAngle[i]=steps[i]*45f;}
            cartStop=record.cart;cartShown=StopX(cartStop);firstLock=record.firstLock;rise=firstLock?1:0;solved=false;
            int hit=TraceWith(steps,cartStop,firstLock,null);
            if(record.stage>=2)
            {
                if(!firstLock||hit!=1){problem="mirror room marked solved but the beam misses the second target";return false;}
                solved=true;
            }
            else if(!firstLock&&hit==0)firstLock=true; // a lock that was reached but not saved yet
            Present(0);return true;
        }
        // Validation hooks.
        public void SetStepsForValidation(int[] ks,int stop,bool secondStage){for(int i=0;i<4;i++)steps[i]=ks[i];cartStop=stop;firstLock=secondStage;Retrace();}
    }
}
