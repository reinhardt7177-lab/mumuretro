using System;
using System.Collections;
using System.IO;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Mumu.Planet
{
    // This observer survives the sanctuary unload so the smoke test checks the real return scene.
    public sealed class WaterEndingSmoke : MonoBehaviour
    {
        WaterSanctuary room;
        WaterSanctuarySmoke.Result result;
        string output;

        public void Configure(WaterSanctuary sanctuary, WaterSanctuarySmoke.Result report, string directory)
        {
            room=sanctuary;
            result=report;
            output=directory;
            StartCoroutine(ObserveReturn());
        }

        void Check(bool condition, string label)
        {
            if(!condition)throw new Exception(label);
            result.checks.Add(label);
        }

        IEnumerator ObserveReturn()
        {
            // The sanctuary is disabled by the deterministic smoke; Tick uses the gameplay departure timer.
            yield return null;
            Exception transitionError=null;
            try { room.Tick(1.3f); }
            catch(Exception e) { transitionError=e; }
            if(transitionError!=null) { Fail(transitionError);yield break; }

            float deadline=Time.realtimeSinceStartup+20f;
            while(SceneManager.GetActiveScene().name!="PlanetExploration"&&Time.realtimeSinceStartup<deadline)
                yield return null;
            if(SceneManager.GetActiveScene().name!="PlanetExploration")
            {
                Fail(new TimeoutException("Water deity completion did not return to PlanetExploration."));
                yield break;
            }
            for(int i=0;i<20;i++)yield return null;

            try
            {
                Check(WaterApproachProgress.Current.Completed&&WaterApproachProgress.Current.Saved&&
                    new WaterApproachStore(WaterApproachProgress.SavePath).Completed,
                    "Planet return retains the saved water completion record");

                var player=FindFirstObjectByType<PlanetExplorer>();
                var doorway=FindFirstObjectByType<WaterSanctuaryEntrance>();
                var surface=FindFirstObjectByType<PlanetSurface>();
                Check(player!=null&&player.enabled&&!player.InputLocked&&doorway!=null&&surface!=null,
                    "Automatic planet return restores player controls and water exterior");
                Check(doorway.SealVisible,"Completed water temple visibly seals its entrance");
                Check(doorway.EntranceTarget.InverseTransformPoint(player.transform.position).z< -1.5f,
                    "Automatic return lands outside the permanently sealed doorway");

                player.enabled=false;
                var entrance=doorway.EntranceTarget;
                player.Respawn(surface.Point(entrance.TransformPoint(new Vector3(0,-1f,-1.6f))),entrance.forward);
                Physics.SyncTransforms();
                Check(player.Grounded&&doorway.InDoorway,
                    "Re-entry check stands at the sealed water doorway, not a distant location");
                Check(!doorway.CanEnter&&!doorway.TryEnter()&&SceneManager.GetActiveScene().name=="PlanetExploration",
                    "Sealed water doorway rejects a second visit even at the threshold");
                doorway.RefreshPrompt();
                Check(doorway.PromptVisible&&doorway.PromptText==WaterSanctuaryEntrance.PromptSealed,
                    "Sealed doorway prompt reports the recorded water wisdom");

                var orbit=FindFirstObjectByType<OrbitCamera>();
                Check(orbit!=null,"Planet camera is restored after the water ending");
                orbit.Snap();
                TempleAudienceValidation.Capture(orbit.GetComponent<Camera>(),Path.Combine(output,"water-seal-after-return.png"));
                player.enabled=true;

                var guide=FindFirstObjectByType<QuestGuide>();
                Check(guide!=null&&guide.HasTarget&&guide.Goal.Contains("무게의 신전"),
                    "After the water ending, guidance points to the remaining weight temple");

                var notebook=FindFirstObjectByType<NotebookUI>();
                Check(notebook!=null&&notebook.TryOpen(),"Notebook opens after the water deity returns the player to the planet");
                Check(notebook.RecordText.Contains("순환의 지혜 기록됨")&&notebook.BodyText.Contains("같은 물"),
                    "Notebook displays the earned water lesson from the completion record");
                notebook.Close();
                result.passed=true;
            }
            catch(Exception e) { result.error=e.ToString();Debug.LogException(e); }
            Finish();
        }

        void Fail(Exception exception)
        {
            result.error=exception.ToString();Debug.LogException(exception);Finish();
        }

        void Finish()
        {
            Directory.CreateDirectory(output);
            File.WriteAllText(Path.Combine(output,"sanctuary-result.json"),JsonUtility.ToJson(result,true));
            Application.Quit(result.passed?0:1);
        }
    }
}
