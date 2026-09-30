using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace Mumu.Editor
{
    // Keep the outdoor sanctuary, its seal and the indoor departure in the same pair of builds.
    public static class BuildWaterEnding
    {
        [MenuItem("Mumu/Build complete water temple ending")]
        public static void CreateAndBuild()
        {
            var planet=EditorSceneManager.OpenScene("Assets/Mumu/Scenes/PlanetExploration.unity");
            BuildWaterSanctuaryExterior.Populate();
            EditorSceneManager.SaveScene(planet);
            BuildWaterSanctuary.Create();
            AssetDatabase.SaveAssets();
            BuildWaterTempleJourney.BuildExisting();
            BuildExploration.BuildWindows();
            Debug.Log("MUMU_WATER_ENDING_BUILDS_OK");
        }

        public static void BuildExisting()
        {
            BuildWaterTempleJourney.BuildExisting();
            BuildExploration.BuildWindows();
            Debug.Log("MUMU_WATER_ENDING_BUILDS_OK");
        }
    }
}
