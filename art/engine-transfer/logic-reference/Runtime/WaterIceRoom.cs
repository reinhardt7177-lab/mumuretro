using UnityEngine;

namespace Mumu.Planet
{
    public sealed class WaterIceRoom : MonoBehaviour
    {
        public WaterBraceletLab ability;
        public WaterBraceletTarget supply,trough,recovery;
        public Transform bridge,gate,pump;
        public Collider bridgeSupport,gateBlock;
        public LineRenderer feed,returnLine;
        public WaterCycleRoom cycle;
        public WaterGateCeremony gateCeremony;
        public void UnlockExit(){DoorOpen=true;}
        public bool BridgeLatched {get;private set;}
        public bool DoorOpen {get;private set;}
        public bool Completed {get;private set;}
        public int Rescues {get;private set;}
        float bridgeTime,doorTime;
        public WaterIceStep CurrentStep
        {
            get
            {
                if(!ability.Acquired)return WaterIceStep.Acquire;
                if(Completed)return WaterIceStep.Complete;
                if(DoorOpen)return doorTime<1?WaterIceStep.Opening:WaterIceStep.Exit;
                if(BridgeLatched)return WaterIceStep.Open;
                if(trough.iceSupport.enabled)return WaterIceStep.Cross;
                if(trough.Water.ice+trough.Water.liquid>=3.999f)return WaterIceStep.Freeze;
                if(recovery.Water.liquid>.001f)return WaterIceStep.Recover;
                if(supply.Water.ice>.001f)return WaterIceStep.Melt;
                if(supply.Water.liquid>.001f)return WaterIceStep.Fill;
                return WaterIceStep.WaitRecovery;
            }
        }
        public Vector3 GuidePosition
        {
            get
            {
                switch(CurrentStep)
                {
                    case WaterIceStep.Acquire:return ability.pedestal.position+Vector3.up*.64f;
                    case WaterIceStep.Melt:return supply.transform.position+Vector3.up*.22f;
                    case WaterIceStep.Fill:case WaterIceStep.Freeze:return trough.transform.position+Vector3.up*.20f;
                    case WaterIceStep.Recover:case WaterIceStep.WaitRecovery:return pump.position+Vector3.up*.20f;
                    case WaterIceStep.Cross:return new Vector3(0,.06f,6.3f);
                    case WaterIceStep.Exit:return new Vector3(0,.06f,11);
                    default:return new Vector3(0,.06f,8.8f);
                }
            }
        }
        public string Objective
        {
            get
            {
                if(cycle!=null)return cycle.Objective;
                switch(CurrentStep)
                {
                    case WaterIceStep.Acquire:return "제단에서 물의 팔찌 찾기 [E]";
                    case WaterIceStep.Melt:return "얼음 저수조 가열 · 1 선택 후 왼쪽 버튼 누르기";
                    case WaterIceStep.Fill:return "물이 도랑으로 흐르는 중입니다";
                    case WaterIceStep.Freeze:return "얼음길 "+Mathf.FloorToInt(trough.Water.ice/4*100)+"% · 2 냉각을 계속하세요";
                    case WaterIceStep.Cross:return "얼음길 완성 · 반대편 착지판으로 건너세요";
                    case WaterIceStep.Recover:return "회수 펌프 옆에서 E · 모인 물을 돌려보내세요";
                    case WaterIceStep.WaitRecovery:return "증기를 회수하는 중입니다 · 물은 사라지지 않습니다";
                    case WaterIceStep.Open:return "복귀 돌다리 고정 · 수문 옆에서 E를 누르세요";
                    case WaterIceStep.Opening:return "수문이 열립니다";
                    case WaterIceStep.Exit:return "열린 수문을 통과하세요";
                    default:return "얼음길 통과 완료 · 다음 방으로 이동합니다";
                }
            }
        }
        public string Hint
        {
            get
            {
                if(cycle!=null)return cycle.Hint;
                if(CurrentStep==WaterIceStep.Acquire)return "제단 가까이에서 E를 누르면 물의 팔찌를 얻습니다.";
                if(BridgeLatched)return "돌다리는 얼음이 녹아도 유지됩니다. 수문 옆에서 E를 누르세요.";
                if(CurrentStep==WaterIceStep.Freeze)return "일부만 얼었을 때는 건널 수 없습니다. 양쪽 선이 이어지면 건너세요.";
                if(CurrentStep==WaterIceStep.Recover||CurrentStep==WaterIceStep.WaitRecovery)return "증기가 된 물도 회수됩니다. 처음부터 다시 시작할 필요가 없습니다.";
                if(CurrentStep==WaterIceStep.Cross)return "양쪽 선이 이어졌습니다. 얼음길을 건너세요.";
                return "황금 원은 지금 확인할 곳입니다. 물결 장치 가까이에서 팔찌를 사용하세요.";
            }
        }
        public void TickFlow(float dt)
        {
            if(cycle!=null){cycle.TickFlow(dt);return;}
            float moved=Mathf.Min(supply.Water.liquid,Mathf.Max(0,4-trough.Water.Total));moved=Mathf.Min(moved,dt*2);
            supply.Water.liquid-=moved;trough.Water.liquid+=moved;feed.enabled=moved>.00001f;
            float returned=0;
            foreach(var t in ability.targets)
            {
                float amount=Mathf.Min(t.Water.vapour,Mathf.Max(0,dt)*2);
                t.Water.vapour-=amount;recovery.Water.liquid+=amount;returned+=amount;
            }
            returnLine.enabled=returned>.00001f;
        }
        public bool TryInteract()
        {
            if(cycle!=null)return cycle.TryInteract();
            var player=ability.player;
            if(BridgeLatched&&Vector3.Distance(player.transform.position,new Vector3(0,0,9))<2.3f)
            {DoorOpen=true;return true;}
            if(Vector3.Distance(player.transform.position,pump.position)>2.5f)return false;
            supply.Water.liquid+=recovery.Water.liquid;recovery.Water.liquid=0;return true;
        }
        public void TickTraversal(float dt)
        {
            var player=ability.player;
            if(player.transform.position.y< -3)
            {
                ability.Cancel();player.Respawn(BridgeLatched?new Vector3(0,0,6.5f):new Vector3(0,0,-2),Vector3.forward);Rescues++;
            }
            if(!BridgeLatched&&player.Grounded&&player.transform.position.z>5.65f&&player.transform.position.z<8&&Mathf.Abs(player.transform.position.x)<2)
                BridgeLatched=true;
            if(BridgeLatched)
            {
                bridgeTime=Mathf.Min(1,bridgeTime+dt);
                bridge.localRotation=Quaternion.Euler(Mathf.Lerp(90,0,Mathf.SmoothStep(0,1,bridgeTime)),0,0);
                bridgeSupport.enabled=bridgeTime>=1;
            }
            if(DoorOpen)
            {
                doorTime=Mathf.Min(1,doorTime+Mathf.Max(0,dt)/(gateCeremony?2f:1f));
                float lift=gateCeremony?Mathf.SmoothStep(0,1,Mathf.InverseLerp(.35f,1,doorTime)):doorTime;
                gate.localPosition=new Vector3(0,1.5f+lift*3.3f,10);
                if(gateCeremony)gateCeremony.Present(doorTime);
                gateBlock.enabled=doorTime<1;
                if(doorTime>=1&&player.Grounded&&player.transform.position.z>10.4f)Completed=true;
            }
        }
        public void RestoreProgress(bool bridgeLatched,bool doorOpen,bool complete)
        {
            BridgeLatched=bridgeLatched;DoorOpen=doorOpen;Completed=complete;
            bridgeTime=bridgeLatched?1:0;doorTime=doorOpen?1:0;
            bridge.localRotation=Quaternion.Euler(bridgeLatched?0:90,0,0);bridgeSupport.enabled=bridgeLatched;
            gate.localPosition=new Vector3(0,doorOpen?4.8f:1.5f,10);gateBlock.enabled=!doorOpen;
            if(gateCeremony)gateCeremony.Present(doorTime,true);
            var safe=bridgeLatched?new Vector3(0,0,6.5f):new Vector3(0,0,-4);
            ability.player.Respawn(safe,Vector3.forward);ability.player.transform.position=safe;
            TickTraversal(0);
        }
        void Update(){if(gateCeremony)gateCeremony.SetPaused(NotebookUI.BlocksInput);if(!NotebookUI.BlocksInput)TickTraversal(Mathf.Min(Time.deltaTime,.05f));}
    }
}



