using System;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Mumu.Planet
{
    public sealed class WaterTempleJourney : MonoBehaviour
    {
        public int roomIndex;
        public WaterBraceletLab ability;
        public string[] rooms;
        public WaterJourneyStore Store {get;private set;}
        public bool Ready {get;private set;}
        public bool Finished {get;private set;}
        static WaterJourneyRecord pending;
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)] static void ResetSession(){pending=null;}
        bool leaving;
        float nextSave;
        float sanctuaryDelay;
        string lastSnapshot;
        public static string SavePath
        {
            get
            {
                var args=Environment.GetCommandLineArgs();int i=Array.IndexOf(args,"-mumu-water-journey-file");
                return i>=0&&i+1<args.Length?System.IO.Path.GetFullPath(args[i+1]):System.IO.Path.Combine(Application.persistentDataPath,"water-interior-journey-v1.json");
            }
        }
        void Start()
        {
            var args=Environment.GetCommandLineArgs();
            if(Array.IndexOf(args,"-mumu-sanctuary-smoke")>=0){leaving=true;SceneManager.LoadScene("WaterSanctuary");return;}
            string validation=Array.IndexOf(args,"-mumu-ice-smoke")>=0?"WaterIceRoom":Array.IndexOf(args,"-mumu-collection-smoke")>=0?"WaterCollectionRoom":Array.IndexOf(args,"-mumu-cycle-smoke")>=0?"WaterCycleRoom":null;
            if(validation!=null){leaving=true;SceneManager.LoadScene(validation);return;}
            // A completed sanctuary is sealed. Old journey saves must not reopen it.
            if(WaterApproachProgress.Current.Completed)
            {leaving=true;SceneManager.LoadScene("PlanetExploration");return;}
            Store=new WaterJourneyStore(SavePath);
            var saved=pending??Store.Current;pending=null;
            if(saved!=null&&saved.room!=roomIndex){leaving=true;SceneManager.LoadScene(rooms[saved.room]);return;}
            foreach(var t in ability.targets)t.Initialize();
            if(saved!=null)
            {
                bool compatible=!saved.HasWater||saved.water.Length==ability.targets.Length;
                if(saved.HasWater&&compatible)for(int i=0;i<saved.water.Length;i++)compatible&=saved.water[i].id==ability.targets[i].name;
                if(compatible)Restore(saved);else Store.Protect("이 기록은 다른 방 구성으로 작성되었습니다. 원본을 보존합니다.");
            }
            Ready=true;SaveNow();
        }
        public WaterJourneyRecord Capture()
        {
            var r=new WaterJourneyRecord{version=1,room=roomIndex,acquired=ability.Acquired,finished=Finished,water=new WaterTargetRecord[ability.targets.Length]};
            for(int i=0;i<r.water.Length;i++)
            {
                var t=ability.targets[i];r.water[i]=new WaterTargetRecord{id=t.name,ice=t.Water.ice,liquid=t.Water.liquid,vapour=t.Water.vapour,cold=t.Cold};
            }
            if(ability.iceRoom!=null)
            {
                var ice=ability.iceRoom;r.bridge=ice.BridgeLatched;r.door=ice.DoorOpen;
                if(ice.cycle!=null){r.toBoiler=ice.cycle.ToBoiler;r.valve=ice.cycle.ValveOpen;}
            }
            if(ability.collectionRoom!=null)
            {var c=ability.collectionRoom;r.bridge=c.BridgeLatched;r.gallery=c.GalleryVisited;r.rail=c.RailX;}
            return r;
        }
        void Restore(WaterJourneyRecord r)
        {
            if(r.acquired)ability.RestoreAcquired();
            if(r.HasWater)for(int i=0;i<r.water.Length;i++)
            {var v=r.water[i];ability.targets[i].Restore(v.ice,v.liquid,v.vapour,v.cold);}
            if(ability.iceRoom!=null)
            {
                ability.iceRoom.RestoreProgress(r.bridge,r.door,r.finished);
                if(ability.iceRoom.cycle!=null)ability.iceRoom.cycle.RestoreProgress(r.toBoiler,r.valve);
            }
            if(ability.collectionRoom!=null)ability.collectionRoom.RestoreProgress(r.bridge,r.gallery,r.rail);
            Finished=r.finished;Physics.SyncTransforms();
        }
        public bool SaveNow()
        {
            if(!Ready||leaving)return false;
            var record=Capture();var json=JsonUtility.ToJson(record);
            if(json==lastSnapshot)return true;
            if(!Store.Save(record))return false;
            lastSnapshot=json;return true;
        }
        public void CheckTransition()
        {
            if(!Ready||leaving||Finished)return;
            bool completed=ability.collectionRoom!=null?ability.collectionRoom.Completed:ability.iceRoom.Completed;
            if(!completed)return;
            ability.Cancel();if(ability.collectionRoom!=null)ability.collectionRoom.Release();
            if(roomIndex==2){Finished=true;SaveNow();return;}
            // Persist the destination before switching. A read-only/broken disk does not trap play.
            pending=new WaterJourneyRecord{version=1,room=roomIndex+1,acquired=true};
            Store.Save(pending);
            leaving=true;
            SceneManager.LoadScene(rooms[roomIndex+1]);
        }
        public bool EnterSanctuary()
        {
            if(!Ready||leaving||!Finished||NotebookUI.BlocksInput)return false;
            SaveNow();leaving=true;SceneManager.LoadScene("WaterSanctuary");return true;
        }
        void Update(){if(!Ready||leaving)return;CheckTransition();if(Finished&&!NotebookUI.BlocksInput){sanctuaryDelay+=Time.deltaTime;if(sanctuaryDelay>=1.5f){EnterSanctuary();return;}}if(Time.unscaledTime>=nextSave){nextSave=Time.unscaledTime+1;SaveNow();}}
        void LateUpdate()
        {
            if(!Ready||leaving||NotebookUI.BlocksInput)return;
            if(Finished)ability.instruction.text="물의 신전 · 세 방 탐사 완료 — 기록이 이 PC에 남습니다";
            if(Store.Problem!=null)ability.status.text+="\n자동 저장 불가 · 기존 기록 보존 중";
        }
        void OnApplicationPause(bool pause){if(pause)SaveNow();}
        void OnApplicationFocus(bool focus){if(!focus)SaveNow();}
        void OnApplicationQuit(){SaveNow();}
    }
}

