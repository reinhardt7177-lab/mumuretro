using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Mumu.Planet
{
    // Opt-in, isolated Windows-player check. Fixtures enter through the real first scene.
    public sealed class TempleJourneySmoke : MonoBehaviour
    {
        [Serializable] sealed class Result {public bool passed;public string error;public string[] checks;}
        readonly List<string> checks=new List<string>();
        string output;
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
        static void Install()
        {
            if(Array.IndexOf(Environment.GetCommandLineArgs(),"-mumu-journey-smoke")<0)return;
            DontDestroyOnLoad(new GameObject("Temple journey smoke").AddComponent<TempleJourneySmoke>());
        }
        void Check(bool condition,string label)
        {
            if(!condition)throw new InvalidOperationException(label);
            checks.Add(label);Debug.Log("JOURNEY_CHECK "+label);
        }
        IEnumerator Start()
        {
            var args=Environment.GetCommandLineArgs();int index=Array.IndexOf(args,"-mumu-journey-smoke");
            output=args[index+1];Directory.CreateDirectory(output);
            string error=null;
            var run=Validate();
            while(true)
            {
                bool more=false;try{more=run.MoveNext();}catch(Exception e){error=e.ToString();Debug.LogException(e);}
                if(!more||error!=null)break;
                yield return run.Current;
            }
            File.WriteAllText(Path.Combine(output,"journey-result.json"),JsonUtility.ToJson(new Result{passed=error==null,error=error??"",checks=checks.ToArray()},true));
            Application.Quit(error==null?0:1);
        }
        IEnumerator Validate()
        {
                var saved=TempleJourney.Current.Current;
                Check(saved!=null&&saved.active,"Valid journey fixture loaded");
                int frames=0;
                while(SceneManager.GetActiveScene().name!=saved.scene&&frames++<180)yield return null;
                Check(SceneManager.GetActiveScene().name==saved.scene,"Ship resume opens saved room");
                for(int i=0;i<100;i++)yield return null;
                if(saved.scene=="WeightTemple")ValidateWeight(saved);
                else if(saved.scene=="TwinBalanceTemple")ValidateTwin(saved);
                else ValidateLever(saved);
                Check(TempleProgress.Current.Completed==false,"Mid-progress does not complete or seal temple");
                string foreign=Path.Combine(output,"unknown-version.json");
                File.WriteAllText(foreign,"{\"version\":99,\"active\":true}");
                var unknown=new TempleJourneyStore(foreign);
                Check(!unknown.Save(saved)&&File.ReadAllText(foreign)=="{\"version\":99,\"active\":true}","Newer record is preserved");
                string broken=Path.Combine(output,"broken.json");File.WriteAllText(broken,"{not json");
                var corrupt=new TempleJourneyStore(broken);
                Check(!corrupt.Save(saved)&&File.ReadAllText(broken)=="{not json","Corrupt record is preserved");
                Check(!new BalanceOrderState().Restore(3,new[]{0,0,-1}),"Duplicate order slot rejected");
                Check(!new TwinBalanceState().Restore(new[]{0,0,-1,-1}),"Duplicate twin slot rejected");
                Check(!new LeverBalanceState().Restore(0,new[]{0,4}),"Invalid fulcrum rejected");
        }
        void ValidateWeight(TempleJourneyRecord saved)
        {
            var room=FindFirstObjectByType<BalanceRoom>();
            Check(room!=null&&room.State.Count==saved.count,"Weight room difficulty restored");
            for(int i=0;i<saved.count;i++)
            {
                Check(room.State.Location(i)==saved.locations[i],"Weight box "+i+" placement restored");
                if(saved.locations[i]>=0)Check(Vector3.Distance(room.Box(i).position,room.Slot(saved.locations[i]))<.05f,"Weight box "+i+" visual restored");
            }
            Check(!room.DoorOpen,"Unsolved weight door remains closed");
            Check(room.Select(5),"Difficulty remains interactive after restore");
            var record=JsonUtility.FromJson<TempleJourneyRecord>(File.ReadAllText(TempleJourney.SavePath));
            Check(record.scene=="WeightTemple"&&record.count==5,"Difficulty change saved to disk");
        }
        void ValidateTwin(TempleJourneyRecord saved)
        {
            var room=FindFirstObjectByType<TwinBalanceRoom>();Check(room!=null,"Twin room loaded");
            for(int i=0;i<4;i++)
            {
                Check(room.State.Location(i)==saved.locations[i],"Twin box "+i+" placement restored");
                if(saved.locations[i]>=0)Check(Vector3.Distance(room.Box(i).position,room.Slot(saved.locations[i]))<.05f,"Twin box "+i+" visual restored");
            }
            Check(!room.DoorOpen,"Unsolved twin door remains closed");
            room.Restart();var record=JsonUtility.FromJson<TempleJourneyRecord>(File.ReadAllText(TempleJourney.SavePath));
            Check(record.scene=="TwinBalanceTemple"&&record.locations[0]==-1,"Twin reset saved to disk");
        }
        void ValidateLever(TempleJourneyRecord saved)
        {
            var room=FindFirstObjectByType<LeverBalanceRoom>();
            Check(room!=null&&room.State.Pivot==saved.pivot,"Lever fulcrum restored");
            for(int i=0;i<2;i++)
            {
                Check(room.State.Location(i)==saved.locations[i],"Lever weight "+i+" placement restored");
                if(saved.locations[i]>=0)Check(Vector3.Distance(room.Box(i).position,room.Slot(saved.locations[i]))<.05f,"Lever weight "+i+" visual restored");
            }
            Check(!room.DoorOpen,"Unsolved lever door remains closed");
            room.Restart();var record=JsonUtility.FromJson<TempleJourneyRecord>(File.ReadAllText(TempleJourney.SavePath));
            Check(record.scene=="LeverBalanceTemple"&&record.pivot==2&&record.locations[0]==-1,"Lever reset saved to disk");
        }
    }
}
