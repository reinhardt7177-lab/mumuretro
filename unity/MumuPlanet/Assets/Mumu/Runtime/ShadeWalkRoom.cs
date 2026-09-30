using System.Collections.Generic;
using UnityEngine;

namespace Mumu.Planet
{
    // Room 1: cross the lit band only inside pillar shadows cast by a lamp that travels an ellipse.
    // Web rules (ShadeCourt): shadow = hull of the base and the projected top, exposure +dt in light, -2.2dt in shade.
    // Audit improvements: a safe practice pillar, growing exposure grace / slower lamp after failures,
    // and a retry behind the nearest pillar instead of the room start.
    public sealed class ShadeWalkRoom : ShadowRoom
    {
        public const float LampY=4.8f,CentreZ=3f,RadiusX=5.4f,RadiusZ=6.2f,Speed=.12f,PillarRadius=.76f,PillarHeight=3.6f;
        public const float SafeIn=-2.8f,SafeOut=8.8f,ExposeBase=1.8f,ExposeStep=.3f,ExposeMaxCap=3.0f,Recover=2.2f,Grace=1f,RetryDistance=1.35f;
        public const float PracticeRadius=.6f,PracticeHeight=2.4f;
        public static readonly Vector2[] Pillars={new Vector2(-2.6f,-.4f),new Vector2(2.4f,2.6f),new Vector2(-2.2f,6.2f),new Vector2(2.8f,9f)};
        public static readonly Vector2 Practice=new Vector2(-3.6f,-5.6f);
        public static readonly Vector3 PracticeStart=new Vector3(0,0,-4.2f);
        public static readonly ShadowOptics.Area LitBand=new ShadowOptics.Area(-7,7,SafeIn,SafeOut);
        public static readonly ShadowOptics.Area PracticeYard=new ShadowOptics.Area(-7,7,-8,SafeIn);
        public const string PromptPractice="연습 마당 · 빛에 서면 눈이 뜬다, 그늘로 가면 감긴다",PromptFollow="그림자를 따라 건너라",
            PromptDanger="들키는 중 · 그림자로!",NoteFail="빛에 들켰다 · 가까운 기둥 그림자에서 다시";

        [SerializeField] Transform lampRig;
        [SerializeField] Renderer eye;
        [SerializeField] Renderer footRing;
        float phase=Mathf.PI*.5f,expose,grace;
        int fails;bool solved;
        readonly List<List<Vector2>> shadows=new List<List<Vector2>>();
        readonly List<List<Vector2>> practiceShadows=new List<List<Vector2>>();
        MaterialPropertyBlock block;
        Vector3 cachedLamp=new Vector3(float.NaN,0,0);

        public void ConfigureDevices(Transform lampTransform,Renderer warningEye,Renderer ring){lampRig=lampTransform;eye=warningEye;footRing=ring;}
        public override string Title=>"그림자 밟기";
        public override string Goal=>"빛에 닿으면 들킨다. 기둥 그림자만 밟고 건너라.";
        public override bool Solved=>solved;
        public float Phase=>phase;
        public float Exposure=>expose;
        public int Fails=>fails;
        public float ExposeMax=>Mathf.Min(ExposeMaxCap,ExposeBase+ExposeStep*fails);
        public float LampSpeed=>Speed*(fails>=3?.8f:1f);
        public bool InGrace=>grace>0;
        public Vector3 LampPosition=>LampAt(phase);
        public static Vector3 LampAt(float a)=>new Vector3(RadiusX*Mathf.Cos(a),LampY,CentreZ-RadiusZ*Mathf.Sin(a));
        public List<List<Vector2>> Shadows=>shadows;

        public override string Hint(int level)=>level==1?"그림자는 등불 반대편에 생긴다. 연습 기둥 옆에서 먼저 봐라.":
            level==2?"등불이 돌면 그림자도 따라 돈다. 기둥 바로 뒤가 가장 오래 그늘이다.":
            "등불이 먼 쪽 기둥 뒤에서 기다렸다가, 다음 그림자가 이어질 때 건너라.";
        public override void Setup(ShadowTemple temple,System.Random random){base.Setup(temple,random);solved=false;expose=0;grace=0;fails=0;phase=Mathf.PI*.5f;}

        // Shadows of the four pillars clipped to the lit band (the rule) for a lamp at phase a.
        public static List<List<Vector2>> ShadowsAt(float a)
        {
            var lampPosition=LampAt(a);var list=new List<List<Vector2>>();
            foreach(var p in Pillars){var poly=ShadowOptics.PrismShadow(p,PillarRadius,PillarHeight,16,lampPosition,LitBand);if(poly.Count>=3)list.Add(poly);}
            return list;
        }
        public static bool ShadedAt(float a,Vector2 foot)=>ShadowOptics.InsideAny(ShadowsAt(a),foot);
        void Recompute()
        {
            var l=LampAt(phase);if(l==cachedLamp)return;cachedLamp=l;
            shadows.Clear();shadows.AddRange(ShadowsAt(phase));
            practiceShadows.Clear();
            var yard=ShadowOptics.PrismShadow(Practice,PracticeRadius,PracticeHeight,16,l,PracticeYard);if(yard.Count>=3)practiceShadows.Add(yard);
            foreach(var p in Pillars){var poly=ShadowOptics.PrismShadow(p,PillarRadius,PillarHeight,16,l,PracticeYard);if(poly.Count>=3)practiceShadows.Add(poly);}
        }
        public bool Shaded(Vector2 foot)
        {
            Recompute();
            return foot.y>SafeIn?ShadowOptics.InsideAny(shadows,foot):ShadowOptics.InsideAny(practiceShadows,foot);
        }

        public override void Tick(float dt,PlanetExplorer player,bool inside)
        {
            phase+=LampSpeed*dt;
            if(lampRig!=null)lampRig.position=LampPosition;
            if(lamp!=null)lamp.transform.position=LampPosition;
            Recompute();
            var foot=ShadowOptics.Flat(player.transform.position);
            if(inside&&!solved)
            {
                if(foot.y>=SafeOut){solved=true;expose=0;}
                else if(grace>0){grace-=dt;expose=0;}
                else
                {
                    bool shade=Shaded(foot);
                    if(foot.y>SafeIn)
                    {
                        practice=0;
                        expose=shade?Mathf.Max(0,expose-Recover*dt):expose+dt;
                        if(expose>=ExposeMax)Fail(player,foot);
                    }
                    else
                    {
                        // The yard shows the rule on its own meter; the real budget stays full for the band.
                        practice=shade?Mathf.Max(0,practice-Recover*dt):Mathf.Min(ExposeMax*.95f,practice+dt);
                        expose=Mathf.Max(0,expose-Recover*dt);
                    }
                }
            }
            else{expose=Mathf.Max(0,expose-Recover*dt);practice=Mathf.Max(0,practice-Recover*dt);}
            Present(player,inside);
        }
        float practice;
        public float PracticeExposure=>practice;
        float Shown(Vector3 p)=>p.z<=SafeIn?practice:expose;
        void Fail(PlanetExplorer player,Vector2 foot)
        {
            fails++;expose=0;grace=Grace;
            var point=RetryPoint(foot,phase,LampSpeed);
            var heading=Vector3.forward;
            player.Respawn(point,heading);
            Temple?.ReportFailure(this,NoteFail);
        }
        // Behind the nearest pillar (away from the lamp), inside the lit band and shaded for the next second.
        public static Vector3 RetryPoint(Vector2 fail,float a,float speed)
        {
            var l=ShadowOptics.Flat(LampAt(a));
            float best=float.MaxValue;Vector3 result=PracticeStart;
            foreach(var p in Pillars)
            {
                var away=(p-l);if(away.sqrMagnitude<1e-4f)continue;
                var s=p+away.normalized*RetryDistance;
                if(s.y<=SafeIn+.3f||s.y>=SafeOut-.3f||Mathf.Abs(s.x)>6.4f)continue;
                bool ok=true;
                for(int k=0;k<=4&&ok;k++)ok=ShadedAt(a+speed*.25f*k,s);
                if(!ok)continue;
                float d=Vector2.Distance(s,fail);
                if(d<best){best=d;result=new Vector3(s.x,0,s.y);}
            }
            return result;
        }
        void Present(PlanetExplorer player,bool inside)
        {
            float amount=solved?0:Mathf.Clamp01(Shown(player.transform.position)/ExposeMax);
            block??=new MaterialPropertyBlock();
            if(eye!=null)
            {
                eye.GetPropertyBlock(block);
                block.SetColor("_BaseColor",Color.Lerp(new Color(.16f,.13f,.18f),new Color(1,.47f,.42f),amount));
                block.SetColor("_EmissionColor",new Color(1,.47f,.42f)*(amount*3.2f));
                eye.SetPropertyBlock(block);
            }
            if(footRing!=null)
            {
                bool show=inside&&!solved&&amount>.02f;
                if(footRing.enabled!=show)footRing.enabled=show;
                if(show)
                {
                    footRing.transform.position=player.transform.position+Vector3.up*.03f;
                    footRing.GetPropertyBlock(block);
                    block.SetColor("_BaseColor",new Color(1,.47f,.42f,.85f*amount));
                    footRing.SetPropertyBlock(block);
                }
            }
        }
        public override string Prompt(Vector3 player)
        {
            if(solved)return null;
            if(player.z<=SafeIn)return PromptPractice;
            return expose>.1f?PromptDanger:PromptFollow;
        }
        public override bool Interact(Vector3 player,int direction)=>false;
        public override void Capture(ShadowTempleRecord record)
        {
            record.lampPhase=Mathf.Repeat(phase,Mathf.PI*2);record.shadeFails=fails;
        }
        public override bool Restore(ShadowTempleRecord record,out string problem)
        {
            problem=null;phase=record.lampPhase;fails=record.shadeFails;solved=record.stage>=1;expose=0;grace=0;cachedLamp=new Vector3(float.NaN,0,0);
            return true;
        }
        // Test hook: move the lamp without waiting (never used by gameplay).
        public void SetPhaseForValidation(float a){phase=a;cachedLamp=new Vector3(float.NaN,0,0);Recompute();if(lampRig!=null)lampRig.position=LampPosition;if(lamp!=null)lamp.transform.position=LampPosition;}
        public void SetFailsForValidation(int value){fails=value;}
    }
}
