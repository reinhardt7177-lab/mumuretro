using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Mumu.Planet
{
    // The planet-side smoke hands off to this object before the doorway unloads the planet scene.
    public sealed class WaterEntrySmoke : MonoBehaviour
    {
        [Serializable] sealed class Result {public bool passed;public string error;public string[] checks;}
        WaterSanctuaryEntrance entrance;
        List<string> checks;
        string output,mode;
        string recordPath;
        byte[] recordBefore;

        // mode: fresh (no water record), visited (existing entranceOpen record), unreadable (damaged record).
        public void Configure(WaterSanctuaryEntrance doorway, List<string> priorChecks, string directory, string recordMode)
        {
            entrance=doorway;
            checks=priorChecks;
            output=directory;
            mode=recordMode;
            StartCoroutine(ObserveEntry());
        }

        void Check(bool condition, string label)
        {
            if(!condition)throw new InvalidOperationException(label);
            checks.Add(label);
            Debug.Log("WATER_CHECK "+label);
        }

        IEnumerator ObserveEntry()
        {
            yield return null;
            Exception entryError=null;
            var doorwayToLocal=entrance.EntranceTarget.worldToLocalMatrix;
            try
            {
                recordPath=WaterApproachProgress.SavePath;
                recordBefore=File.Exists(recordPath)?File.ReadAllBytes(recordPath):null;
                Check(entrance.TryEnter(),"E action at the open doorway starts the connected water temple");
                Check(!entrance.TryEnter(),"A second E press during the transition is ignored");
                Check(doorwayToLocal.MultiplyPoint3x4(WaterApproachProgress.ReturnPosition).z< -1.5f,
                    "Return landing stays outside the doorway that will be sealed");
            }
            catch(Exception e) { entryError=e; }
            if(entryError!=null) { Finish(entryError);yield break; }

            float deadline=Time.realtimeSinceStartup+30f;
            while(SceneManager.GetActiveScene().name!=WaterSanctuaryEntrance.FirstRoom&&Time.realtimeSinceStartup<deadline)
                yield return null;
            if(SceneManager.GetActiveScene().name!=WaterSanctuaryEntrance.FirstRoom)
            {
                Finish(new TimeoutException("Open water doorway did not load "+WaterSanctuaryEntrance.FirstRoom+"."));
                yield break;
            }
            for(int i=0;i<20;i++)yield return null;

            Exception validationError=null;
            try
            {
                var journey=FindFirstObjectByType<WaterTempleJourney>();
                Check(journey!=null&&journey.Ready&&journey.roomIndex==0&&!journey.Finished,
                    "Outdoor entry lands in the initialized first water puzzle room");
                var player=journey.ability!=null?journey.ability.player:null;
                Check(player!=null&&player.enabled&&!player.InputLocked&&player.Grounded,
                    "First water room has an active controllable player");
                Check(!WaterApproachProgress.Current.Completed,"Entering does not award water completion early");
                if(mode=="fresh")
                {
                    Check(WaterApproachProgress.Current.EntranceOpen&&File.Exists(recordPath)&&
                        new WaterApproachStore(recordPath).EntranceOpen&&!new WaterApproachStore(recordPath).Completed,
                        "First entry records the visited doorway in a new local water record");
                }
                else
                {
                    Check(recordBefore!=null&&File.Exists(recordPath)&&
                        Convert.ToBase64String(File.ReadAllBytes(recordPath))==Convert.ToBase64String(recordBefore),
                        "Existing "+mode+" water record is kept byte-for-byte");
                    if(mode=="visited")Check(WaterApproachProgress.Current.EntranceOpen,"Earlier thaw record still counts as visited");
                    if(mode=="unreadable")Check(!string.IsNullOrEmpty(WaterApproachProgress.Current.Problem),
                        "Unreadable water record is reported, not replaced");
                }
                Check(File.Exists(WaterTempleJourney.SavePath)&&new WaterJourneyStore(WaterTempleJourney.SavePath).Current!=null,
                    "First-room progress is written to the isolated local journey record");
            }
            catch(Exception e) { validationError=e; }
            Finish(validationError);
        }

        void Finish(Exception error)
        {
            if(error!=null)Debug.LogException(error);
            Directory.CreateDirectory(output);
            File.WriteAllText(Path.Combine(output,"result.json"),JsonUtility.ToJson(new Result{
                passed=error==null,error=error==null?"":error.ToString(),checks=checks.ToArray()},true));
            Application.Quit(error==null?0:1);
        }
    }
}
