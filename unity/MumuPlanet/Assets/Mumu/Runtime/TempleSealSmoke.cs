using System;
using System.Collections;
using System.IO;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Mumu.Planet
{
    // A second player process verifies that the seal comes from disk, not static memory.
    public sealed class TempleSealSmoke : MonoBehaviour
    {
        [Serializable] sealed class Result{public bool passed;public string error;}
        IEnumerator Start()
        {
            var args=Environment.GetCommandLineArgs();int index=Array.IndexOf(args,"-mumu-seal-smoke");if(index<0)yield break;
            string output=args[index+1];Directory.CreateDirectory(output);for(int i=0;i<20;i++)yield return null;
            string error=null;
            try
            {
                var entry=FindFirstObjectByType<TempleEntrance>();var player=FindFirstObjectByType<PlanetExplorer>();var surface=FindFirstObjectByType<PlanetSurface>();
                if(!TempleProgress.Current.Completed||!TempleProgress.Current.Saved||!entry.SealVisible)throw new Exception("Saved completion did not restore a visible seal in a new process.");
                player.enabled=false;player.Respawn(surface.Point(entry.transform.TransformPoint(new Vector3(0,0,-1.1f))),entry.transform.forward);
                if(entry.CanEnter||entry.TryEnter())throw new Exception("Saved seal allows re-entry.");entry.Enter();
                if(entry.IsOpening||SceneManager.GetActiveScene().name!="PlanetExploration")throw new Exception("Direct entry bypasses the saved seal.");
                for(int i=0;i<180;i++)player.Step(entry.transform.forward,false,false,1f/60);
                if(entry.transform.InverseTransformPoint(player.transform.position).z>1.2f)throw new Exception("Sealed door no longer blocks walking.");
                player.Respawn(surface.Point(entry.transform.TransformPoint(new Vector3(0,0,-1.1f))),entry.transform.forward);var orbit=FindFirstObjectByType<OrbitCamera>();orbit.Snap();
                TempleAudienceValidation.Capture(orbit.GetComponent<Camera>(),Path.Combine(output,"seal-after-relaunch.png"));
            }
            catch(Exception e){error=e.ToString();Debug.LogException(e);}
            File.WriteAllText(Path.Combine(output,"seal-reload-result.json"),JsonUtility.ToJson(new Result{passed=error==null,error=error??""},true));Application.Quit(error==null?0:1);
        }
    }
}
