using System.Linq;
using UnityEngine;
using UnityEditor;
using UnityEditor.SceneManagement;
using TMPro;
using Mumu.Planet;
using static Mumu.Editor.BuildWeightTemple;

namespace Mumu.Editor
{
    public static class BuildLeverTemple
    {
        const string Root="Assets/Mumu/";
        [MenuItem("Mumu/Build weight temple final lever room")]
        public static void Create()
        {
            Prepare();
            // Derive a separate scene from the authored first-room shell, never overwrite it.
            var scene=EditorSceneManager.OpenScene(Root+"Scenes/WeightTemple.unity");
            EditorSceneManager.SaveScene(scene,Root+"Scenes/LeverBalanceTemple.unity");
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
            WorldText(floor,"균형의 원리를 찾았습니다",new Vector3(0,2.3f,12.7f),4.5f,.7f,3.4f);
            var hall=Part("hall_lever",Vector3.zero);hall.localScale=new Vector3(14f/18,9f/11,18f/28);
            var room=new GameObject("Six cell lever trial").AddComponent<LeverBalanceRoom>();
            var stock=new Transform[2];
            for(int i=0;i<2;i++)
            {
                stock[i]=Part("crate",Vector3.zero,room.transform);
                WorldText(stock[i],i==0?"2":"6",new Vector3(0,.4f,-.412f),.5f,.4f,3.5f);
                WorldText(stock[i],i==0?"2":"6",new Vector3(0,.4f,.412f),.5f,.4f,3.5f);
                stock[i].GetComponentsInChildren<TextMeshPro>().Last().transform.localRotation=Quaternion.Euler(0,180,0);
            }
            var dim=Material("Lever dark inlay",new Color(.035f,.12f,.14f));
            var lit=Material("Lever turquoise",new Color(.24f,.87f,.77f));lit.EnableKeyword("_EMISSION");lit.SetColor("_EmissionColor",lit.color*.6f);
            var gold=Material("Lever solved gold",new Color(1,.76f,.28f));gold.EnableKeyword("_EMISSION");gold.SetColor("_EmissionColor",gold.color*.65f);
            var beam=new GameObject("Lever hinge in game coordinates").transform;beam.SetParent(room.transform,false);beam.localPosition=new Vector3(-1.4f,1.12f,1.5f);
            var art=Part("lever",new Vector3(1.4f,0,0),beam);
            var support=Part("fulcrum",new Vector3(-1.4f,0,1.5f),room.transform);
            support.localScale=new Vector3(1,1.06f,1);
            var safety=Block("Lever collision envelope",new Vector3(0,.82f,1.5f),new Vector3(8.6f,1.64f,.9f),dim);safety.GetComponent<Renderer>().enabled=false;
            var slots=new Transform[6];var cells=new Renderer[6];var labels=new TextMeshPro[6];
            for(int i=0;i<6;i++)
            {
                slots[i]=new GameObject("Lever cell "+(i+1)).transform;slots[i].SetParent(beam,false);slots[i].localPosition=new Vector3((i-2.5f)*1.4f+1.4f,.21f,0);
                var cell=Block("Cell light "+(i+1),Vector3.zero,new Vector3(1.16f,.016f,.69f),dim,false);
                cell.transform.SetParent(slots[i],false);cell.transform.localPosition=new Vector3(0,-.012f,0);cells[i]=cell.GetComponent<Renderer>();
                var tablet=Block("Number tablet "+(i+1),Vector3.zero,new Vector3(1.12f,.55f,.045f),dim,false);
                tablet.transform.SetParent(slots[i],false);tablet.transform.localPosition=new Vector3(0,-.19f,-.47f);
                WorldText(slots[i],(i+1)+"번\n거리",new Vector3(0,-.19f,-.5f),1.1f,.53f,2.3f);
                labels[i]=slots[i].GetComponentInChildren<TextMeshPro>();
            }
            // Five lit stops make the support's allowed positions readable on its rail.
            Block("Fulcrum track",new Vector3(0,.035f,1.5f),new Vector3(6.7f,.06f,1.15f),materials["Aged brass"],false);
            var marks=new Renderer[5];
            for(int i=0;i<5;i++)marks[i]=Block("Fulcrum stop "+(i+1),new Vector3((i-2)*1.4f,.07f,.85f),new Vector3(.32f,.05f,.18f),dim,false).GetComponent<Renderer>();
            var handles=new Transform[2];
            for(int i=0;i<2;i++)
            {
                float x=i==0?-1.25f:1.25f;
                handles[i]=new GameObject(i==0?"Move fulcrum left":"Move fulcrum right").transform;handles[i].SetParent(room.transform,false);handles[i].localPosition=new Vector3(x,0,-1.4f);
                var pad=Part("plinth",Vector3.zero,handles[i]);pad.localScale=Vector3.one*.42f;
                var control=Block("Fulcrum control stone",new Vector3(x,.38f,-1.4f),new Vector3(.56f,.76f,.56f),materials["Midnight teal"]);
                Block("Fulcrum instruction tablet",new Vector3(x,1.05f,-1.68f),new Vector3(1.72f,.42f,.035f),dim,false);
                WorldText(handles[i],i==0?"←":"→",new Vector3(0,.68f,-.30f),.5f,.4f,3.4f);
                WorldText(handles[i],i==0?"지지대 왼쪽":"지지대 오른쪽",new Vector3(0,1.05f,-.31f),1.65f,.35f,2.35f);
            }
            room.Configure(player,stock,slots,handles,beam,art,support,doors,gate,cells,marks,labels,dim,lit,gold,goal,status,prompt,reset,leave);
            BuildTempleAudience.PopulateRoom(room);
            goal.text="여섯 칸의 지레";status.text="두 추와 움직이는 지지대로 균형을 맞춰 보세요.";
            BuildNotebook.Populate();AssetDatabase.SaveAssets();EditorSceneManager.SaveScene(scene);
            EditorBuildSettings.scenes=new[]{"PlanetExploration","WeightTemple","TwinBalanceTemple","LeverBalanceTemple"}.Select(n=>new EditorBuildSettingsScene(Root+"Scenes/"+n+".unity",true)).ToArray();
            Debug.Log("LEVER_TEMPLE_READY");
        }
        public static void CreateAndBuild(){Create();BuildExploration.BuildWindows();}
    }
}
