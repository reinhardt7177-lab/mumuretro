using System;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
using Mumu.Planet;

namespace Mumu.Editor
{
    public static class BuildWaterTempleJourney
    {
        [MenuItem("Mumu/Build connected water temple")]
        public static void Build()
        {
            // Derived copies preserve the individual regression scenes and their entry points.
            BuildWaterIceRoom.Create();BuildWaterCollectionRoom.Create();BuildWaterCycleRoom.Create();
            string root="Assets/Mumu/Scenes/";
            string[] source={"WaterIceRoom","WaterCollectionRoom","WaterCycleRoom"};
            string[] names={"WaterJourneyIce","WaterJourneyCollection","WaterJourneyCycle"};
            var paths=new string[3];
            for(int i=0;i<3;i++)
            {
                var scene=EditorSceneManager.OpenScene(root+source[i]+".unity");
                var ability=UnityEngine.Object.FindFirstObjectByType<WaterBraceletLab>();
                if(i==0)WaterInteriorArt.Ice(ability);
                if(i==1)WaterInteriorArt.Collection(ability);
                if(i==2)WaterInteriorArt.Cycle(ability);
                EditorSceneManager.SaveScene(scene,root+source[i]+".unity");
                var journey=ability.gameObject.AddComponent<WaterTempleJourney>();journey.roomIndex=i;journey.ability=ability;journey.rooms=names;
                ability.gameObject.AddComponent<WaterJourneySmoke>();
                paths[i]=root+names[i]+".unity";EditorSceneManager.SaveScene(scene,paths[i]);
            }
            BuildWaterSanctuary.Create();
            AssetDatabase.SaveAssets();
            BuildExisting();
        }
        public static void BuildExisting()
        {
            string[] paths={"Assets/Mumu/Scenes/WaterJourneyIce.unity","Assets/Mumu/Scenes/WaterJourneyCollection.unity","Assets/Mumu/Scenes/WaterJourneyCycle.unity","Assets/Mumu/Scenes/WaterIceRoom.unity","Assets/Mumu/Scenes/WaterCollectionRoom.unity","Assets/Mumu/Scenes/WaterCycleRoom.unity","Assets/Mumu/Scenes/WaterBraceletLab.unity","Assets/Mumu/Scenes/PlanetExploration.unity"};
            System.Array.Resize(ref paths,paths.Length+1);paths[paths.Length-1]="Assets/Mumu/Scenes/WaterSanctuary.unity";
            string output="Builds/WaterTempleJourney/WaterTempleJourney.exe";Directory.CreateDirectory(Path.GetDirectoryName(output));
            var report=BuildPipeline.BuildPlayer(new BuildPlayerOptions{scenes=paths,locationPathName=output,target=BuildTarget.StandaloneWindows64,options=BuildOptions.None});
            if(report.summary.result!=UnityEditor.Build.Reporting.BuildResult.Succeeded)throw new Exception("Water journey build failed");
        }
    }
}
