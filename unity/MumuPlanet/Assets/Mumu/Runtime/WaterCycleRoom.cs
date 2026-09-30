using UnityEngine;

namespace Mumu.Planet
{
    public sealed class WaterCycleRoom : MonoBehaviour
    {
        public WaterIceRoom crossing;
        public WaterBraceletTarget boiler,collector,sanctum;
        public Transform routingLever,upperValve;
        public LineRenderer steam,condensation,drain;
        public Renderer valveLamp;
        public bool ToBoiler {get;private set;}
        public bool ValveOpen {get;private set;}
        public string Objective
        {
            get
            {
                if(!crossing.ability.Acquired)return "순환의 성소 · 물의 팔찌를 얻으세요 [E]";
                if(crossing.Completed)return "순환의 성소 해결 · 같은 물을 다시 사용했습니다";
                if(crossing.DoorOpen)return crossing.gateBlock.enabled?"성소에 물이 돌아왔습니다 · 문이 열리는 중입니다":"열린 문을 통과하세요";
                if(!crossing.BridgeLatched)
                {
                    if(crossing.trough.iceSupport.enabled)return "얼음길 완성 · 반대편 착지판까지 건너세요";
                    if(ToBoiler)return "시작 구역 물길 전환 E · 도랑으로 물을 보내세요";
                    if(crossing.trough.Water.ice+crossing.trough.Water.liquid>=3.999f)return "얼음길 "+Mathf.FloorToInt(crossing.trough.Water.ice/4*100)+"% · 2 냉각";
                    if(crossing.recovery.Water.liquid>.001f)return "시작 구역 회수 펌프 E · 도랑의 물을 되찾으세요";
                    if(crossing.supply.Water.ice>.001f)return "공급 저수조의 얼음을 녹이세요 · 1 가열";
                    if(crossing.supply.Water.liquid>.001f)return "저수조에서 도랑으로 물이 흐르는 중입니다";
                    if(boiler.Water.ice+boiler.Water.liquid>.001f)return "가열 용기의 물을 가열해 회수조로 돌려보내세요";
                    return "증기가 회수되기를 기다리세요 · 물은 사라지지 않습니다";
                }
                if(!crossing.bridgeSupport.enabled)return "복귀 돌다리가 내려옵니다 · 잠시 기다리세요";
                if(!ValveOpen)return "오른쪽 경사로로 올라가 상층 수문 E";
                if(collector.Cold<.999f)return "상층 집수판을 냉각하세요 · 2 선택 후 누르기";
                if(!ToBoiler)return "돌다리로 돌아가 물길 전환 E · 가열 용기로 연결하세요";
                if(boiler.Water.vapour>.001f)return "증기를 물방울로 모으는 중입니다";
                if(boiler.Water.ice>.001f)return "가열 용기의 얼음을 녹이세요 · 1 가열";
                if(boiler.Water.liquid>.001f)return "가열 용기의 물을 기화시키세요 · 1 가열";
                if(crossing.trough.Water.ice>.001f)return "얼음길의 물을 다시 사용하세요 · 도랑에 1 가열";
                if(crossing.recovery.Water.liquid>.001f)return "시작 구역 회수 펌프 E · 남은 물을 돌려보내세요";
                if(crossing.supply.Water.ice>.001f)return "공급 저수조의 얼음을 녹이세요 · 1 가열";
                return "남은 물이 가열 용기로 돌아오는 중입니다";
            }
        }
        public string Hint
        {
            get
            {
                if(!crossing.ability.Acquired)return "제단 가까이에서 E · 이번 방에는 물이 모두 6칸 있습니다.";
                if(crossing.Completed)return "얼리기 → 녹이기 → 기화 → 응결 · 물 6칸을 순환시켜 성소를 열었습니다.";
                string amounts="성소 "+sanctum.Water.liquid.ToString("0.0")+" / 5칸   ·   얼음길 "+crossing.trough.Water.Total.ToString("0.0")+"칸   ·   회수조 "+crossing.recovery.Water.liquid.ToString("0.0")+"칸";
                string clue=!crossing.BridgeLatched?"얼음길에는 4칸이 필요합니다. 완전히 얼린 뒤 반대편으로 건너세요.":
                    !crossing.bridgeSupport.enabled?"돌다리가 고정될 때까지 얼음길을 유지하세요.":
                    crossing.DoorOpen?"성소에 필요한 물이 모였습니다. 문이 완전히 열리면 통과하세요.":
                    !ValveOpen?"상층 수문이 닫혀 있으면 증기는 회수조로 돌아갑니다.":
                    collector.Cold<.999f?"따뜻한 집수판은 증기를 모으지 못합니다. 냉각한 뒤 가열하세요.":
                    crossing.trough.Water.ice>.001f?"남은 2칸만으로는 부족합니다. 고정된 돌다리를 이용해 얼음길의 물을 되찾으세요.":
                    "물길: "+(ToBoiler?"가열 용기로 연결됨":"도랑으로 연결됨")+" · 회수한 물도 다시 사용할 수 있습니다.";
                return amounts+"\n"+clue+"\nF 팔찌 · 1 가열 / 2 냉각 · 왼쪽 버튼 누르기 · E 장치 조작";
            }
        }
        public bool TryInteract()
        {
            var player=crossing.ability.player;var point=player.transform.position;
            if(Vector3.Distance(point,routingLever.position)<2)
            {ToBoiler=!ToBoiler;return true;}
            if(crossing.BridgeLatched&&player.Grounded&&point.y>=2.1f&&Vector3.Distance(point,upperValve.position)<1.7f)
            {ValveOpen=!ValveOpen;valveLamp.material.color=ValveOpen?Color.cyan:new Color(.5f,.3f,.1f);return true;}
            if(Vector3.Distance(point,crossing.pump.position)<2.5f)
            {crossing.supply.Water.liquid+=crossing.recovery.Water.liquid;crossing.recovery.Water.liquid=0;return true;}
            return false;
        }
        public void RestoreProgress(bool toBoiler,bool valveOpen)
        {ToBoiler=toBoiler;ValveOpen=valveOpen;valveLamp.material.color=ValveOpen?Color.cyan:new Color(.5f,.3f,.1f);}
        static float Transfer(WaterPhaseState from,WaterPhaseState to,float capacity,float dt)
        {
            float amount=Mathf.Min(from.liquid,Mathf.Min(Mathf.Max(0,capacity-to.Total),dt*2));
            from.liquid-=amount;to.liquid+=amount;return amount;
        }
        public void TickFlow(float dt)
        {
            dt=Mathf.Max(0,dt);
            float liquid=ToBoiler?Transfer(crossing.supply.Water,boiler.Water,6,dt)+Transfer(crossing.trough.Water,boiler.Water,6,dt):Transfer(crossing.supply.Water,crossing.trough.Water,4,dt);
            crossing.feed.enabled=!ToBoiler&&liquid>0;drain.enabled=ToBoiler&&liquid>0;
            float accepted=0,rejected=0;
            foreach(var target in crossing.ability.targets)
            {
                float amount=Mathf.Min(target.Water.vapour,dt*2);if(amount<=0)continue;
                target.Water.vapour-=amount;
                if(target==boiler&&ValveOpen&&collector.Cold>=.999f){sanctum.Water.liquid+=amount;accepted+=amount;}
                else {crossing.recovery.Water.liquid+=amount;rejected+=amount;}
            }
            steam.enabled=accepted+rejected>0;condensation.enabled=accepted>0;crossing.returnLine.enabled=rejected>0;
            if(sanctum.Water.liquid>=4.999f)crossing.UnlockExit();
        }
    }
}

