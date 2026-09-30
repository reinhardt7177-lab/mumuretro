using System.Collections.Generic;
using UnityEngine;

namespace Mumu.Planet
{
    // Sanctum: turn and raise the lamp so the guardian's real shadow lies on the gold outline (web ShadowSanctum).
    // The outline is the outer boundary of the projected convex caster parts at the answer state.
    // Audit improvements: both handles turn both ways, and the previous shadow's outline lingers for 1.5 s so the
    // player sees what one change did (direction or length) without any answer value being shown.
    public sealed class ShadowSanctum : ShadowRoom
    {
        public static readonly Vector2 Centre=new Vector2(0,63);
        public static readonly float[] Heights={4.16f,5.33f,6.825f};
        public static readonly Vector2 Wheel=new Vector2(-4.7f,58.5f),Grip=new Vector2(4.7f,58.5f),OrbSpot=new Vector2(0,59.8f);
        public static readonly ShadowOptics.Area Floor=new ShadowOptics.Area(-10.6f,10.6f,55.4f,70.6f);
        public const float Radius=5f,RailY=7.8f,Reach=2.0f,OrbY=1.25f,OrbReach=2.0f,LineWidth=.055f,EyeTime=1.5f,DropTime=1.4f,GhostTime=1.5f;
        public const string PromptWheel="E  등불을 한 칸 돌리기  ·  Q  거꾸로",PromptGrip="E  등불 올리기  ·  Q  내리기",
            PromptIdle="두 손잡이로 등불의 방향과 높이를 바꾼다",PromptOrbFalling="지혜의 구슬이 내려온다",PromptOrb="E  지혜의 구슬 줍기",PromptOrbFar="구슬 가까이 가서 E로 줍는다";

        [SerializeField] Transform statue,trolley,hanger,lampBody,wheelRotor,gripKnob,orb;
        [SerializeField] Renderer[] eyes=new Renderer[2];
        [SerializeField] MeshFilter outline,ghost;
        [SerializeField] Renderer outlineRenderer,ghostRenderer,orbRing;
        [SerializeField] Light orbLight;
        [SerializeField] Vector3[] casterPoints=new Vector3[0];
        [SerializeField] int[] casterStarts=new int[0];

        int answerA,answerH,direction,height;
        bool solved,orbRevealed,orbTaken,endingStarted;
        float shownA,shownH,eyes01,drop=-1,ghostClock,bob;
        List<Vector3[]> parts;
        Mesh outlineMesh,ghostMesh;
        MaterialPropertyBlock block;
        readonly Dictionary<int,List<List<Vector2>>> cache=new Dictionary<int,List<List<Vector2>>>();

        public void ConfigureDevices(Transform guardian,Transform railTrolley,Transform lampHanger,Transform body,Transform rotor,Transform knob,Transform wisdomOrb,
            Renderer[] guardianEyes,MeshFilter target,MeshFilter trace,Renderer ring,Light glow,Vector3[] points,int[] starts)
        {
            statue=guardian;trolley=railTrolley;hanger=lampHanger;lampBody=body;wheelRotor=rotor;gripKnob=knob;orb=wisdomOrb;eyes=guardianEyes;
            outline=target;ghost=trace;outlineRenderer=target.GetComponent<Renderer>();ghostRenderer=trace.GetComponent<Renderer>();orbRing=ring;orbLight=glow;
            casterPoints=points;casterStarts=starts;
        }
        public override string Title=>"그림자 신전";
        public override string Goal=>"손잡이 둘로 신의 그림자를 바닥 자리에 얹어라.";
        public override bool Solved=>solved;
        public int Direction=>direction;
        public int Height=>height;
        public int AnswerDirection=>answerA;
        public int AnswerHeight=>answerH;
        public bool OrbRevealed=>orbRevealed;
        public bool OrbTaken=>orbTaken;
        public float Eyes=>eyes01;
        public float Drop=>drop;
        public float GhostAlpha=>ghostClock>0?ghostClock/GhostTime:0;
        public bool LampSettled=>Mathf.Abs(shownA-Nearest(direction,shownA))<1e-3f&&Mathf.Abs(shownH-Heights[height])<1e-3f;
        public Vector3 OrbPosition=>orb!=null?orb.position:new Vector3(OrbSpot.x,OrbY,OrbSpot.y);
        public override string Hint(int level)=>level==1?"손잡이 하나는 방향, 하나는 길이를 바꾼다.":
            level==2?"한 번에 하나씩만 바꿔라. 둘을 같이 돌리면 무엇 때문에 달라졌는지 모른다.":
            "방향을 다 맞춘 뒤에 길이를 손대라. 과학자도 그렇게 한다.";

        public static Vector3 LampAt(float a,float y)
        {
            float angle=a*Mathf.PI/4;
            return new Vector3(Centre.x-Mathf.Cos(angle)*Radius,y,Centre.y-Mathf.Sin(angle)*Radius);
        }
        public List<Vector3[]> Parts
        {
            get
            {
                if(parts!=null)return parts;
                parts=new List<Vector3[]>();
                for(int i=0;i<casterStarts.Length;i++)
                {
                    int start=casterStarts[i],end=i+1<casterStarts.Length?casterStarts[i+1]:casterPoints.Length;
                    var world=new Vector3[end-start];
                    for(int j=start;j<end;j++)world[j-start]=statue!=null?statue.TransformPoint(casterPoints[j]):casterPoints[j];
                    parts.Add(world);
                }
                return parts;
            }
        }
        public List<List<Vector2>> ShadowFor(int a,int h)
        {
            int key=a*3+h;
            if(!cache.TryGetValue(key,out var polys)){polys=ShadowOptics.ProjectParts(Parts,LampAt(a,Heights[h]),Floor);cache[key]=polys;}
            return polys;
        }
        public override void Setup(ShadowTemple temple,System.Random random)
        {
            base.Setup(temple,random);
            answerA=1+random.Next(7);answerH=random.Next(3);
            direction=0;height=0;solved=false;orbRevealed=false;orbTaken=false;endingStarted=false;eyes01=0;drop=-1;ghostClock=0;
            shownA=0;shownH=Heights[0];parts=null;cache.Clear();
            outlineMesh=Rebuild(outlineMesh,outline,ShadowFor(answerA,answerH),.012f);
            Present(0);
        }
        static float Nearest(int target,float from){float t=target;while(t-from>4)t-=8;while(from-t>4)t+=8;return t;}
        public override void Tick(float dt,PlanetExplorer player,bool inside)
        {
            shownA=Mathf.MoveTowards(shownA,Nearest(direction,shownA),dt/.6f);
            shownH=Mathf.MoveTowards(shownH,Heights[height],dt*2.4f);
            if(!solved&&direction==answerA&&height==answerH&&LampSettled){solved=true;orbRevealed=true;drop=0;}
            if(solved)eyes01=Mathf.MoveTowards(eyes01,1,dt/EyeTime);
            if(orbRevealed&&!orbTaken&&drop>=0&&drop<1)drop=Mathf.MoveTowards(drop,1,dt/DropTime);
            if(ghostClock>0)ghostClock=Mathf.Max(0,ghostClock-dt);
            bob+=dt;
            if(orbTaken&&!endingStarted&&Temple!=null&&!Temple.SpeechActive){endingStarted=true;Temple.BeginEnding();}
            Present(dt);
        }
        void Present(float dt)
        {
            var lampPosition=LampAt(shownA,shownH);
            if(lamp!=null)lamp.transform.position=lampPosition;
            if(lampBody!=null)lampBody.position=lampPosition;
            if(trolley!=null)trolley.position=new Vector3(lampPosition.x,RailY,lampPosition.z);
            if(hanger!=null){hanger.position=lampPosition+Vector3.up*.46f;hanger.localScale=new Vector3(1,Mathf.Max(.05f,RailY-lampPosition.y-.46f),1);}
            // The knob (rotor local -X) points at the lamp: lamp angle = direction*45 + 180 degrees.
            if(wheelRotor!=null)wheelRotor.rotation=Quaternion.Euler(0,-shownA*45f,0);
            if(gripKnob!=null)
            {
                float index=shownH<=Heights[1]?Mathf.InverseLerp(Heights[0],Heights[1],shownH):1+Mathf.InverseLerp(Heights[1],Heights[2],shownH);
                var p=gripKnob.localPosition;p.y=.98f+.39f*index;gripKnob.localPosition=p;
            }
            block??=new MaterialPropertyBlock();
            foreach(var eye in eyes)
            {
                if(eye==null)continue;
                eye.GetPropertyBlock(block);
                var open=new Color(1,.82f,.48f);
                block.SetColor("_BaseColor",Color.Lerp(new Color(.16f,.14f,.19f),open,eyes01));
                block.SetColor("_EmissionColor",open*(eyes01*3.5f));
                eye.SetPropertyBlock(block);
            }
            if(outlineRenderer!=null)
            {
                outlineRenderer.GetPropertyBlock(block);
                block.SetColor("_BaseColor",solved?new Color(1,.82f,.48f,1):new Color(.84f,.66f,.32f,.95f));
                outlineRenderer.SetPropertyBlock(block);
            }
            if(ghostRenderer!=null)
            {
                bool show=ghostClock>0;
                if(ghostRenderer.enabled!=show)ghostRenderer.enabled=show;
                if(show){ghostRenderer.GetPropertyBlock(block);block.SetColor("_BaseColor",new Color(.72f,.80f,1,.75f*GhostAlpha));ghostRenderer.SetPropertyBlock(block);}
            }
            if(orb!=null)
            {
                bool show=orbRevealed&&!orbTaken;
                if(orb.gameObject.activeSelf!=show)orb.gameObject.SetActive(show);
                if(show)
                {
                    float k=1-Mathf.Pow(1-Mathf.Clamp01(drop),3);
                    float y=drop<1?Mathf.Lerp(4.6f,OrbY,k):OrbY+Mathf.Sin(bob*1.6f)*.12f;
                    orb.position=new Vector3(OrbSpot.x,y,OrbSpot.y);
                    orb.rotation=Quaternion.Euler(bob*28f,bob*63f,0);
                }
            }
            if(orbRing!=null){orbRing.GetPropertyBlock(block);block.SetColor("_EmissionColor",solved?new Color(1,.82f,.48f)*1.4f:Color.black);orbRing.SetPropertyBlock(block);}
        }
        int Near(Vector3 player)
        {
            var p=ShadowOptics.Flat(player);
            float dw=Vector2.Distance(p,Wheel),dg=Vector2.Distance(p,Grip);
            if(dw<Reach&&dw<=dg)return 1;
            if(dg<Reach)return 2;
            return 0;
        }
        bool NearOrb(Vector3 player)=>orbRevealed&&!orbTaken&&drop>=1&&Vector2.Distance(ShadowOptics.Flat(player),OrbSpot)<OrbReach;
        public override string Prompt(Vector3 player)
        {
            if(orbRevealed&&!orbTaken)return drop<1?PromptOrbFalling:NearOrb(player)?PromptOrb:PromptOrbFar;
            if(solved)return null;
            int near=Near(player);
            return near==1?PromptWheel:near==2?PromptGrip:PromptIdle;
        }
        public override bool Interact(Vector3 player,int direction)
        {
            if(direction>0&&NearOrb(player)){orbTaken=true;Present(0);return true;}
            if(solved)return false;
            int near=Near(player);
            if(near==0)return false;
            int oldA=this.direction,oldH=height;
            if(near==1)this.direction=(this.direction+(direction>0?1:7))%8;
            else{int next=Mathf.Clamp(height+(direction>0?1:-1),0,Heights.Length-1);if(next==height)return false;height=next;}
            ghostMesh=Rebuild(ghostMesh,ghost,ShadowFor(oldA,oldH),.010f);ghostClock=GhostTime;
            return true;
        }
        Mesh Rebuild(Mesh mesh,MeshFilter filter,List<List<Vector2>> polys,float y)
        {
            if(filter==null)return mesh;
            if(mesh==null){mesh=new Mesh{name="Shadow outline"};mesh.MarkDynamic();}
            var segments=ShadowOptics.Boundary(polys);
            var verts=new List<Vector3>();var tris=new List<int>();
            for(int i=0;i+1<segments.Count;i+=2)
            {
                var a=segments[i];var b=segments[i+1];var d=(b-a);if(d.sqrMagnitude<1e-8f)continue;d.Normalize();
                var n=new Vector2(-d.y,d.x)*(LineWidth*.5f);var e=d*(LineWidth*.5f);
                int s=verts.Count;
                verts.Add(new Vector3(a.x-n.x-e.x,y,a.y-n.y-e.y));verts.Add(new Vector3(a.x+n.x-e.x,y,a.y+n.y-e.y));
                verts.Add(new Vector3(b.x+n.x+e.x,y,b.y+n.y+e.y));verts.Add(new Vector3(b.x-n.x+e.x,y,b.y-n.y+e.y));
                // Front faces point up (+Y) whatever the segment direction.
                if(Vector3.Cross(verts[s+1]-verts[s],verts[s+2]-verts[s]).y>0)tris.AddRange(new[]{s,s+1,s+2,s,s+2,s+3});
                else tris.AddRange(new[]{s,s+2,s+1,s,s+3,s+2});
            }
            mesh.Clear();mesh.SetVertices(verts);mesh.SetTriangles(tris,0);mesh.RecalculateNormals();mesh.RecalculateBounds();
            filter.sharedMesh=mesh;return mesh;
        }
        public override void Capture(ShadowTempleRecord record)
        {
            record.direction=direction;record.height=height;record.orbRevealed=orbRevealed;record.orbTaken=orbTaken;
        }
        public override bool Restore(ShadowTempleRecord record,out string problem)
        {
            problem=null;direction=record.direction;height=record.height;shownA=direction;shownH=Heights[height];
            orbRevealed=record.orbRevealed;orbTaken=record.orbTaken;endingStarted=false;ghostClock=0;
            solved=record.stage>=4;
            if(solved&&(direction!=answerA||height!=answerH)){problem="sanctum marked solved with the wrong lamp";return false;}
            // A saved answer state that was not yet marked solved is solved again by the next Tick.
            if(solved)orbRevealed=true;
            eyes01=solved?1:0;drop=orbRevealed?1:-1;
            Present(0);return true;
        }
        // Validation hook.
        public void SetStateForValidation(int a,int h){direction=a;height=h;shownA=a;shownH=Heights[h];}
    }
}
