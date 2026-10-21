using UnityEngine;
using UnityEngine.InputSystem;

namespace Mumu.Planet
{
    public sealed class WaterCollectionRoom : MonoBehaviour
    {
        public WaterBraceletLab ability;
        public WaterBraceletTarget boiler,collector,tank,recovery;
        public Transform railControl,exitBridge,floatMarker;
        public Collider bridgeSupport;
        public LineRenderer preview,steam,drops,returnFlow;
        public bool Adjusting {get;private set;}
        public bool BridgeLatched {get;private set;}
        public bool GalleryVisited {get;private set;}
        public bool Completed {get;private set;}
        public int Rescues {get;private set;}
        public float RailX {get;private set;}=-2.5f;
        public bool Aligned=>Mathf.Abs(collector.transform.position.x-tank.transform.position.x)<.55f;
        public float CaptureFraction=>Mathf.Clamp01((1.05f-Mathf.Abs(collector.transform.position.x-tank.transform.position.x))/.5f);
        public string FlowFeedback {get;private set;}="관로가 아래 용기와 위쪽 집수판을 연결하고 있습니다.";
        float bridgeRise;
        MaterialPropertyBlock landingTint;
        static readonly int BaseColor=Shader.PropertyToID("_BaseColor");
        public string AlignmentHint=>CaptureFraction>=.999f?"낙하선이 청록색입니다 · 물받이 안으로 떨어집니다.":CaptureFraction>0?"낙하선이 황금색입니다 · 가장자리에 걸쳐 일부가 샙니다.":"낙하선이 황금색입니다 · 물받이 밖으로 떨어집니다.";
        public string Objective=>!ability.Acquired?"구름 집수실 · 제단에서 팔찌 찾기 [E]":Completed?"집수실 통과 · 기화한 물을 다시 모았습니다":BridgeLatched?(bridgeSupport.enabled?"다리 고정 완료 · 위층 출구로 건너세요":"물이 부표를 밀어 올립니다 · 다리가 올라오는 중"):
            Adjusting?"A / D로 집수판 이동 · 낙하선을 물받이에 맞추세요":
            collector.Cold<.999f?"왼쪽 계단으로 올라가 집수판 냉각 · 2 선택 후 누르기":
            CaptureFraction<.999f?"위층 손잡이에서 E · 집수판을 물받이 위로 옮기세요":
            recovery.Water.liquid>.001f&&boiler.Water.Total<.001f?"아래층 회수 펌프에서 E · 물을 되돌리세요":
            boiler.Water.vapour>.001f?"증기가 차가운 판에서 물방울로 변하고 있습니다":
            boiler.Water.ice>.001f?"아래 용기의 얼음을 먼저 녹이세요 · 1 가열":
            "아래 용기의 물을 기화시키세요 · 1 가열을 계속 누르기";
        public string Hint
        {
            get
            {
                if(!ability.Acquired)return "제단 가까이에서 E · 물의 팔찌를 얻으세요.\n차가운 집수판으로 증기를 물방울로 바꾸는 방입니다.";
                if(Completed)return "기화 → 응결 → 집수 · 같은 물을 다시 모아 길을 만들었습니다.";
                if(BridgeLatched)return "부표가 다리를 고정했습니다. 판을 다시 움직여도 다리는 유지됩니다.\n위층 다리가 완전히 올라오면 출구로 건너세요.";
                string amount="집수 "+Mathf.FloorToInt(Mathf.Clamp01(tank.Water.liquid/3)*100)+"% · 목표 3칸   |   회수조 "+recovery.Water.liquid.ToString("0.0")+"칸";
                string action=Adjusting?"A / D 또는 ← / → 판 이동 · E / Escape 놓기":
                    "F 팔찌 · 1 가열 / 2 냉각 · 왼쪽 버튼 누르기 · 손잡이/펌프 E";
                return amount+"\n"+(collector.Cold<.999f?"따뜻한 판은 증기를 모으지 못합니다 · 먼저 집수판을 냉각하세요.":AlignmentHint)+"\n"+action;
            }
        }
        public bool TryInteract()
        {
            var player=ability.player;
            if(Adjusting){Release();return true;}
            if(player.Grounded&&player.transform.position.y>=2.1f&&Vector3.Distance(player.transform.position,railControl.position)<1.8f)
            {Adjusting=true;player.InputLocked=true;ability.Cancel();return true;}
            if(Vector3.Distance(player.transform.position,recovery.transform.position)<2.3f)
            {bool hasWater=recovery.Water.liquid>.001f;boiler.Water.liquid+=recovery.Water.liquid;recovery.Water.liquid=0;FlowFeedback=hasWater?"회수한 물을 아래 용기로 돌려보냈습니다. 다시 시도하세요.":"회수조가 비어 있습니다. 물은 다른 장치에 남아 있습니다.";return true;}
            return false;
        }
        public void Release(){Adjusting=false;if(ability!=null)ability.player.InputLocked=false;}
        public void Shift(float direction,float dt)
        {
            if(!Adjusting||NotebookUI.BlocksInput)return;
            RailX=Mathf.Clamp(RailX+Mathf.Clamp(direction,-1,1)*1.3f*Mathf.Max(0,dt),-3,2);
            var position=collector.transform.position;position.x=RailX;collector.transform.position=position;
        }
        public void TickFlow(float dt)
        {
            steam.enabled=drops.enabled=returnFlow.enabled=false;
            foreach(var target in ability.targets)
            {
                float amount=Mathf.Min(target.Water.vapour,Mathf.Max(0,dt)*1.5f);if(amount<=0)continue;
                target.Water.vapour-=amount;
                bool condensed=target==boiler&&collector.Cold>=.999f;
                float accepted=condensed?Mathf.Min(amount*CaptureFraction,Mathf.Max(0,4-tank.Water.Total)):0;
                tank.Water.liquid+=accepted;recovery.Water.liquid+=amount-accepted;
                steam.enabled|=target==boiler;drops.enabled|=condensed;returnFlow.enabled|=amount-accepted>.00001f;
                FlowFeedback=target!=boiler?"이 증기는 회수관으로 돌아옵니다.":!condensed?"판이 따뜻해 증기를 모으지 못했습니다. 회수 펌프로 되돌리세요.":accepted<amount-.00001f?"물방울 일부가 밖으로 떨어졌습니다. 판 위치를 조정하고 남은 물을 회수하세요.":"차가운 판에서 물방울이 맺혀 물받이로 모입니다.";
            }
            if(tank.Water.liquid>=2.999f)BridgeLatched=true;
        }
        public void TickWorld(float dt)
        {
            var player=ability.player;
            if(player.transform.position.y< -3)
            {
                Release();ability.Cancel();var safe=GalleryVisited?new Vector3(-4,2.4f,3):new Vector3(0,0,-4);
                player.Respawn(safe,Vector3.forward);player.transform.position=safe;Rescues++;
            }
            if(player.Grounded&&player.transform.position.y>2.35f&&player.transform.position.z>2.2f&&player.transform.position.z<6)GalleryVisited=true;
            if(BridgeLatched)bridgeRise=Mathf.Min(1,bridgeRise+dt/1.5f);
            exitBridge.position=new Vector3(0,Mathf.Lerp(-2.15f,2.25f,Mathf.SmoothStep(0,1,bridgeRise)),8.6f);
            bridgeSupport.enabled=BridgeLatched&&bridgeRise>=1;
            floatMarker.localPosition=new Vector3(0,Mathf.Lerp(-.25f,.25f,Mathf.Clamp01(tank.Water.liquid/3)),0);
            if(bridgeSupport.enabled&&player.Grounded&&player.transform.position.z>12)Completed=true;
            var start=collector.transform.position-Vector3.up*.13f;var end=new Vector3(start.x,CaptureFraction>0?tank.transform.position.y+.35f:2.65f,start.z);
            preview.SetPosition(0,start);preview.SetPosition(1,end);
            preview.enabled=ability.Acquired&&!BridgeLatched&&!NotebookUI.BlocksInput&&(Adjusting||collector.Cold>=.999f);
            var landingColor=CaptureFraction>=.999f?new Color(.3f,1,.8f):new Color(1,.65f,.18f);
            preview.startColor=preview.endColor=landingColor;
            // URP Unlit does not use the LineRenderer vertex colour.
            if(landingTint==null)landingTint=new MaterialPropertyBlock();
            landingTint.SetColor(BaseColor,landingColor);preview.SetPropertyBlock(landingTint);
            preview.widthMultiplier=.045f;
            if(steam.positionCount>0)steam.SetPosition(steam.positionCount-1,collector.transform.position+Vector3.up*.15f);
            drops.SetPosition(0,start);drops.SetPosition(1,end);
        }
        public void TickControls(float dt)
        {
            var k=Keyboard.current;
            if(Adjusting)
            {
                if(NotebookUI.BlocksInput||k!=null&&(k.escapeKey.wasPressedThisFrame||k.nKey.wasPressedThisFrame)||Vector3.Distance(ability.player.transform.position,railControl.position)>2||!ability.player.Grounded)Release();
                else
                {
                    float input=k==null?0:(k.dKey.isPressed||k.rightArrowKey.isPressed?1:0)-(k.aKey.isPressed||k.leftArrowKey.isPressed?1:0);
                    Shift(input,dt);ability.player.Step(Vector3.zero,false,false,dt);
                }
            }
        }
        void Update(){float dt=Mathf.Min(Time.deltaTime,.05f);TickControls(dt);if(!NotebookUI.BlocksInput)TickWorld(dt);else preview.enabled=false;}
        public void RestoreProgress(bool bridgeLatched,bool gallery,float rail)
        {
            Release();BridgeLatched=bridgeLatched;GalleryVisited=gallery;RailX=rail;bridgeRise=bridgeLatched?1:0;
            var p=collector.transform.position;p.x=rail;collector.transform.position=p;
            var safe=gallery?new Vector3(-4,2.4f,3):new Vector3(0,0,-4);
            ability.player.Respawn(safe,Vector3.forward);ability.player.transform.position=safe;TickWorld(0);
        }
        void OnDisable(){Release();}
    }
}

