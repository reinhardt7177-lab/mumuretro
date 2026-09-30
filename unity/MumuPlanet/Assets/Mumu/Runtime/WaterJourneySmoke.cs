using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using UnityEngine;

namespace Mumu.Planet
{
    public sealed class WaterJourneySmoke : MonoBehaviour
    {
        [Serializable] sealed class Result{public bool passed;public string error;public List<string> checks=new List<string>();}
        static Result result;
        string stage,output;
        WaterTempleJourney journey;WaterBraceletLab ability;
        void Awake()
        {
            var args=Environment.GetCommandLineArgs();int i=Array.IndexOf(args,"-mumu-water-journey-smoke");
            if(i<0||i+2>=args.Length)return;
            stage=args[i+1];output=args[i+2];
            journey=GetComponent<WaterTempleJourney>();ability=GetComponent<WaterBraceletLab>();
            ability.enabled=false;ability.player.enabled=false;
            if(ability.iceRoom!=null)ability.iceRoom.enabled=false;
            if(ability.collectionRoom!=null)ability.collectionRoom.enabled=false;
            if(result==null)result=new Result();
        }
        void Check(bool valid,string label){if(!valid)throw new Exception(label);result.checks.Add(label);}
        void Place(Vector3 p){ability.player.Respawn(p,Vector3.forward);ability.player.transform.position=p;}
        IEnumerator Start()
        {
            if(stage==null)yield break;
            yield return null;
            if(!journey.Ready)yield break;
            journey.enabled=false;
            bool done=false;
            try{done=Validate();}catch(Exception e){result.error=e.ToString();Debug.LogException(e);done=true;}
            if(!done)yield break;
            result.passed=result.error==null;
            Directory.CreateDirectory(output);File.WriteAllText(Path.Combine(output,stage+".json"),JsonUtility.ToJson(result,true));
            Application.Quit(result.passed?0:1);
        }
        bool Validate()
        {
            if(stage=="sanctuary-entry")
            {
                Check(journey.Finished,"completed record restored before sanctuary transition");
                Check(journey.EnterSanctuary(),"completed journey accepts sanctuary transition");return false;
            }
            if(stage=="seed")
            {
                Check(journey.roomIndex==0&&!ability.Acquired,"fresh journey starts before bracelet");
                Place(ability.pedestal.position);Check(ability.TryAcquire(),"first room bracelet pickup");
                var room=ability.iceRoom;room.supply.Restore(2,2,0,0);
                Check(journey.SaveNow(),"partial melt saved to isolated disk record");
                var reread=new WaterJourneyStore(WaterTempleJourney.SavePath);
                Check(reread.Current.acquired&&reread.Current.water[0].ice==2,"new store reads partial melt and bracelet");
                TestInvalidFiles();return true;
            }
            if(stage=="ice-resume"&&journey.roomIndex==0)
            {
                Check(ability.Acquired&&ability.iceRoom.supply.Water.ice==2&&ability.iceRoom.supply.Water.liquid==2,"second process restores partial water phases");
                var room=ability.iceRoom;room.supply.Restore(0,0,0,0);room.trough.Restore(4,0,0,0);
                Place(new Vector3(0,0,6.5f));room.TickTraversal(1.1f);Check(room.BridgeLatched,"far arrival fixes return bridge");
                Place(new Vector3(0,0,9));Check(room.TryInteract(),"exit opens through normal interaction");
                room.TickTraversal(2.1f);Place(new Vector3(0,0,11));room.TickTraversal(0);
                Check(room.Completed,"first room completion observed");journey.CheckTransition();return false;
            }
            if(stage=="ice-resume"&&journey.roomIndex==1)
            {
                Check(ability.Acquired,"bracelet carried across first real scene transition");
                var c=ability.collectionRoom;c.boiler.Restore(0,2.5f,0,0);c.tank.Restore(0,1.5f,0,0);c.collector.Restore(0,0,0,1);
                c.RestoreProgress(false,true,1);Check(journey.SaveNow(),"partial collector tank and rail checkpoint saved");return true;
            }
            if(stage=="collection-resume"&&journey.roomIndex==1)
            {
                var c=ability.collectionRoom;
                Check(c.GalleryVisited&&Mathf.Abs(ability.player.transform.position.y-2.4f)<.01f,"third process resumes at upper safe gallery");
                Check(c.RailX==1&&c.collector.Cold==1&&c.tank.Water.liquid==1.5f,"rail position cooling and partial receiver restored");
                Check(!c.Adjusting&&!ability.player.InputLocked&&!c.bridgeSupport.enabled,"reload releases controls without granting bridge early");
                c.boiler.Restore(0,0,2.5f,0);c.TickFlow(3);c.TickWorld(2);
                Check(c.bridgeSupport.enabled&&Mathf.Abs(ability.TotalWater-4)<.001f,"restored preparation completes bridge with conserved water");
                Place(new Vector3(0,2.4f,12.5f));c.TickWorld(0);Check(c.Completed,"second room completed");journey.CheckTransition();return false;
            }
            if(stage=="collection-resume"&&journey.roomIndex==2)
            {
                Check(ability.Acquired,"bracelet carried across second scene transition");
                var ice=ability.iceRoom;var c=ice.cycle;
                foreach(var t in ability.targets)t.Restore(0,0,0,0);
                ice.trough.Restore(4,0,0,0);c.boiler.Restore(0,2,0,0);c.collector.Restore(0,0,0,1);
                ice.RestoreProgress(true,false,false);c.RestoreProgress(true,true);
                Check(journey.SaveNow(),"cycle bridge route valve and cold plate saved");return true;
            }
            if(stage=="cycle-resume")
            {
                Check(journey.roomIndex==2,"fourth process resumes final room automatically");
                var ice=ability.iceRoom;var c=ice.cycle;
                Check(ice.BridgeLatched&&ice.bridgeSupport.enabled&&c.ToBoiler&&c.ValveOpen&&c.collector.Cold==1,"permanent bridge and water route settings restored");
                Check(ice.trough.Water.ice==4&&c.boiler.Water.liquid==2,"all six units restored at correct devices");
                ice.trough.Restore(0,4,0,0);c.TickFlow(3);c.boiler.Restore(0,0,6,0);c.TickFlow(3);ice.TickTraversal(2);
                Check(ice.DoorOpen&&!ice.gateBlock.enabled,"reused water opens final exit");
                Place(new Vector3(0,0,11));ice.TickTraversal(0);journey.CheckTransition();
                Check(journey.Finished&&journey.Store.Current.finished,"final traversal persists completion");return true;
            }
            if(stage=="finished")
            {
                Check(journey.roomIndex==2&&journey.Finished,"fifth process restores completion without replaying rooms");
                Check(ability.iceRoom.DoorOpen&&!ability.iceRoom.gateBlock.enabled,"completed exit remains open");
                Check(Mathf.Abs(ability.TotalWater-6)<.001f,"water mass preserved through all reloads");return true;
            }
            throw new Exception("Unexpected test stage or scene "+stage+" "+journey.roomIndex);
        }
        void TestInvalidFiles()
        {
            Directory.CreateDirectory(output);
            foreach(var text in new[]{"{broken", "{}", "{\"version\":99,\"room\":0}","{\"version\":1,\"room\":9}"})
            {
                string path=Path.Combine(output,"invalid-"+Guid.NewGuid().ToString("N")+".json");File.WriteAllText(path,text);
                var s=new WaterJourneyStore(path);Check(s.Problem!=null&&!s.Save(journey.Capture())&&File.ReadAllText(path)==text,"invalid or newer record preserved verbatim");
            }
            var entry=new WaterJourneyRecord{version=1,room=1,acquired=true};
            Check(WaterJourneyStore.Valid(JsonUtility.FromJson<WaterJourneyRecord>(JsonUtility.ToJson(entry))),"next-room entry survives Unity JSON empty-array round trip");
            var bad=journey.Capture();bad.water[0].ice=float.NaN;Check(!WaterJourneyStore.Valid(bad),"non-finite mass rejected");
            bad=journey.Capture();bad.water[0].liquid+=1;Check(!WaterJourneyStore.Valid(bad),"incorrect total mass rejected");
        }
    }
}
