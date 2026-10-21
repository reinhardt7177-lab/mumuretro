using System.Linq;
using UnityEngine;
using UnityEditor;
using UnityEditor.SceneManagement;
using TMPro;
using Mumu.Planet;
using static Mumu.Editor.BuildWeightTemple;

namespace Mumu.Editor
{
    public static class BuildTwinTemple
    {
        const string Root="Assets/Mumu/";
        [MenuItem("Mumu/Build weight temple second room")]
        public static void Create()
        {
            Prepare();
            // Reuse the generated architecture, camera, lights and HUD without changing room one.
            var scene=EditorSceneManager.OpenScene(Root+"Scenes/WeightTemple.unity");
            EditorSceneManager.SaveScene(scene,Root+"Scenes/TwinBalanceTemple.unity");
            var player=Object.FindFirstObjectByType<PlanetExplorer>();
            var doors=scene.GetRootGameObjects().Where(o=>o.name=="door_leaf Unity pivot").OrderBy(o=>o.transform.position.x).Select(o=>o.transform).ToArray();
            var gate=GameObject.Find("Closed gate collision").GetComponent<Collider>();
            var goal=GameObject.Find("Goal").GetComponent<TextMeshProUGUI>();
            var status=GameObject.Find("Feedback").GetComponent<TextMeshProUGUI>();
            var prompt=GameObject.Find("Interaction").GetComponent<TextMeshProUGUI>();
            var reset=GameObject.Find("다시 놓기").GetComponent<UnityEngine.UI.Button>();
            var leave=GameObject.Find("행성으로").GetComponent<UnityEngine.UI.Button>();
            foreach(var root in scene.GetRootGameObjects())
                if(new[]{"Weight order trial","scale Unity pivot","plinth Unity pivot","hall_order Unity pivot","Temple validation","Scale pedestal collider"}.Contains(root.name))Object.DestroyImmediate(root);
            Object.DestroyImmediate(GameObject.Find("Difficulty"));
            var floor=GameObject.Find("Flat temple floor").transform;
            foreach(var text in floor.GetComponentsInChildren<TextMeshPro>())Object.DestroyImmediate(text.gameObject);
            WorldText(floor,"다음은 지렛대의 원리",new Vector3(0,2.3f,12.7f),4,.6f,3.8f);
            var hall=Part("hall_twin",Vector3.zero);hall.localScale=new Vector3(1,1,1.125f);
            // The original twin frame is decorative; the foreground test pans move independently.
            Part("twin_scale",new Vector3(0,0,3.4f));
            Block("Twin frame pillar collider",new Vector3(0,1.35f,3.4f),new Vector3(.45f,2.7f,.45f),materials["Aged brass"]).GetComponent<Renderer>().enabled=false;
            var dim=Material("Twin unlit",new Color(.035f,.12f,.14f));
            var lit=Material("Twin turquoise",new Color(.24f,.87f,.77f));lit.EnableKeyword("_EMISSION");lit.SetColor("_EmissionColor",lit.color*.7f);
            var gold=Material("Twin solved gold",new Color(1,.76f,.28f));gold.EnableKeyword("_EMISSION");gold.SetColor("_EmissionColor",gold.color*.65f);
            var room=new GameObject("Two pan balance trial").AddComponent<TwinBalanceRoom>();
            var stock=new Transform[4];string[] letters={"D","A","C","B"};
            for(int i=0;i<4;i++){stock[i]=Part("crate",Vector3.zero,room.transform);WorldText(stock[i],letters[i],new Vector3(0,.4f,-.412f),.5f,.4f,3.5f);}
            var plates=new Transform[2];var slots=new Transform[4];var meters=new Renderer[20];var cells=new Renderer[4];
            for(int side=0;side<2;side++)
            {
                float x=side==0?-3:3;
                plates[side]=new GameObject(side==0?"Left moving pan":"Right moving pan").transform;plates[side].position=new Vector3(x,.32f,1.5f);
                var pan=Part("plinth",Vector3.zero,plates[side]);pan.localScale=new Vector3(1.7f,.35f,1.4f);
                WorldText(plates[side],side==0?"왼쪽 · 두 칸":"오른쪽 · 두 칸",new Vector3(0,.42f,-1.15f),2.9f,.4f,2.6f);
                for(int k=0;k<2;k++)
                {
                    int cell=side*2+k;
                    slots[cell]=new GameObject("Pan cell "+cell).transform;slots[cell].SetParent(plates[side],false);slots[cell].localPosition=new Vector3(k==0?-.63f:.63f,.18f,0);
                    var surface=Block("Cell light "+cell,slots[cell].position+Vector3.down*.02f,new Vector3(.98f,.035f,.98f),dim,false);
                    surface.transform.SetParent(plates[side],true);cells[cell]=surface.GetComponent<Renderer>();
                }
                float meterX=side==0?-5.15f:5.15f;
                Block("Weight light pillar",new Vector3(meterX,1.45f,1.65f),new Vector3(.85f,2.9f,.35f),materials["Midnight teal"]);
                for(int i=0;i<10;i++)meters[side*10+i]=Block("Weight light "+side+" "+i,new Vector3(meterX,.35f+i*.23f,1.45f),new Vector3(.57f,.16f,.08f),dim,false).GetComponent<Renderer>();
                WorldText(floor,"무게",new Vector3(meterX,2.8f,1.43f),1,.35f,2.5f);
            }
            room.Configure(player,stock,plates,slots,doors,gate,meters,cells,dim,lit,gold,goal,status,prompt,reset,leave);
            goal.text="두 판의 균형";status.text="각 판에 두 개씩 놓아 같은 무게를 만들어 보세요.";
            BuildNotebook.Populate();AssetDatabase.SaveAssets();EditorSceneManager.SaveScene(scene);
            EditorBuildSettings.scenes=new[]{"PlanetExploration","WeightTemple","TwinBalanceTemple"}.Select(n=>new EditorBuildSettingsScene(Root+"Scenes/"+n+".unity",true)).ToArray();
            Debug.Log("TWIN_TEMPLE_READY");
        }
        public static void CreateAndBuild(){Create();BuildLeverTemple.Create();BuildExploration.BuildWindows();}
    }
}
