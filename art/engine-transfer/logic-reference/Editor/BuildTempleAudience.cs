using UnityEngine;
using UnityEditor;
using UnityEditor.SceneManagement;
using Mumu.Planet;
using static Mumu.Editor.BuildWeightTemple;

namespace Mumu.Editor
{
    public static class BuildTempleAudience
    {
        static UnityEngine.UI.Image Flash(Transform parent,string name)
        {
            var rect=Rect(name,parent,Vector2.zero,Vector2.zero,Vector2.zero,Vector2.zero);
            rect.anchorMax=Vector2.one;rect.offsetMin=rect.offsetMax=Vector2.zero;
            var image=rect.gameObject.AddComponent<UnityEngine.UI.Image>();image.color=new Color(1,.94f,.76f,0);image.raycastTarget=false;return image;
        }
        public static void PopulateRoom(LeverBalanceRoom room)
        {
            Object.DestroyImmediate(GameObject.Find("End of first room"));
            foreach(var text in GameObject.Find("Flat temple floor").GetComponentsInChildren<TMPro.TextMeshPro>())Object.DestroyImmediate(text.gameObject);
            var hall=Part("hall_twin",new Vector3(0,0,19));hall.name="Blender audience hall";hall.localScale=new Vector3(.75f,1,.75f);
            var dark=materials["Midnight teal"];var gold=materials["Aged brass"];
            Block("Audience west wall",new Vector3(-5.35f,4,18.5f),new Vector3(.3f,8,12.3f),dark);
            Block("Audience east wall",new Vector3(5.35f,4,18.5f),new Vector3(.3f,8,12.3f),dark);
            Block("Audience rear wall",new Vector3(0,4,24.4f),new Vector3(10.7f,8,.3f),dark);
            for(int side=-1;side<=1;side+=2)Block("Audience shoulder wall",new Vector3(side*3.95f,3,12.6f),new Vector3(2.8f,6,.3f),dark);
            var guardian=BuildBalanceDeity.Create(new Vector3(0,0,20.8f));
            var baseCollider=Block("Guardian dais collision",new Vector3(0,.4f,20.8f),new Vector3(3.4f,.8f,3.4f),dark);baseCollider.GetComponent<Renderer>().enabled=false;
            var glow=Material("Audience blessing light",new Color(.42f,1,.84f));glow.EnableKeyword("_EMISSION");glow.SetColor("_EmissionColor",glow.color*1.3f);
            // A small faceted blessing replaces the old floating ball. Halo/scale are authored in Blender.
            var orb=GameObject.CreatePrimitive(PrimitiveType.Cube);orb.name="Balance blessing";Object.DestroyImmediate(orb.GetComponent<Collider>());orb.transform.position=new Vector3(0,3.0f,19.4f);orb.transform.localScale=new Vector3(.11f,.17f,.11f);orb.transform.rotation=Quaternion.Euler(0,0,45);orb.GetComponent<Renderer>().sharedMaterial=glow;
            var hud=Canvas("Audience HUD");hud.GetComponent<UnityEngine.Canvas>().sortingOrder=20;
            var panel=Panel(hud,"Audience dialogue",new Vector2(.5f,0),new Vector2(.5f,0),new Vector2(0,28),new Vector2(1120,245));
            Text(panel,"Speaker","균형의 신",new Vector2(0,1),new Vector2(0,1),new Vector2(25,-12),new Vector2(240,42),26).color=new Color(1,.82f,.42f);
            var speech=Text(panel,"Audience speech","",new Vector2(.5f,1),new Vector2(.5f,1),new Vector2(0,-61),new Vector2(1040,95),28);
            var counter=Text(panel,"Audience page","",new Vector2(0,0),Vector2.zero,new Vector2(24,17),new Vector2(760,45),18);
            var next=Button(panel,"다음",new Vector2(1,0),new Vector2(-26,20),new Vector2(155,48));
            var fade=Flash(hud,"Audience departure fade");
            var audience=new GameObject("Balance guardian encounter").AddComponent<TempleAudience>();
            audience.Configure(room,room.Player,Object.FindFirstObjectByType<OrbitCamera>(),guardian,orb.transform,GameObject.Find("Temple HUD"),panel.gameObject,speech,counter,next,fade);
            room.ConfigureAudience(audience);panel.gameObject.SetActive(false);
        }
        public static void PopulateExterior(TempleEntrance entrance)
        {
            var old=entrance.transform.Find("Completion seal");if(old!=null)Object.DestroyImmediate(old.gameObject);
            var seal=new GameObject("Completion seal").transform;seal.SetParent(entrance.transform,false);
            var gold=Material("Completion seal gold",new Color(.95f,.64f,.16f),.65f);gold.EnableKeyword("_EMISSION");gold.SetColor("_EmissionColor",new Color(.22f,.12f,.015f));
            for(int side=-1;side<=1;side+=2)
            {
                var bar=Block("Golden seal ribbon",Vector3.zero,new Vector3(2.65f,.075f,.045f),gold,false);bar.transform.SetParent(seal,false);bar.transform.localPosition=new Vector3(0,2,1.08f);bar.transform.localRotation=Quaternion.Euler(0,0,side*40);
            }
            var medallion=GameObject.CreatePrimitive(PrimitiveType.Cylinder);medallion.name="Completion medallion";Object.DestroyImmediate(medallion.GetComponent<Collider>());medallion.transform.SetParent(seal,false);
            medallion.transform.localPosition=new Vector3(0,2,1.035f);medallion.transform.localRotation=Quaternion.Euler(90,0,0);medallion.transform.localScale=new Vector3(.46f,.04f,.46f);medallion.GetComponent<Renderer>().sharedMaterial=gold;
            WorldText(seal,"균형의 지혜\n밀봉된 신전",new Vector3(0,.74f,1.04f),2.5f,.68f,2.5f);
            seal.gameObject.SetActive(false);
            var hud=GameObject.Find("Temple entrance HUD").transform;
            var previous=hud.Find("Audience arrival flash");if(previous!=null)Object.DestroyImmediate(previous.gameObject);
            entrance.ConfigureSeal(seal.gameObject,Flash(hud,"Audience arrival flash"));EditorUtility.SetDirty(entrance);
            if(Object.FindFirstObjectByType<TempleSealSmoke>()==null)new GameObject("Seal reload validation").AddComponent<TempleSealSmoke>();
        }
        [MenuItem("Mumu/Build guardian encounter and completion")]
        public static void CreateAndBuild()
        {
            Prepare();var scene=EditorSceneManager.OpenScene("Assets/Mumu/Scenes/PlanetExploration.unity");
            PopulateExterior(Object.FindFirstObjectByType<TempleEntrance>());AssetDatabase.SaveAssets();EditorSceneManager.SaveScene(scene);
            BuildLeverTemple.Create();BuildExploration.BuildWindows();
        }
    }
}
