using System;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.UI;
using TMPro;
using Mumu.Planet;
using static Mumu.Editor.BuildWeightTemple;

namespace Mumu.Editor
{
    public static class BuildQuestGuide
    {
        const string Output="Assets/Mumu/Generated/QuestGuide/";
        static Texture2D SparkTexture()
        {
            string path=Output+"GoldSpark.asset";
            var texture=AssetDatabase.LoadAssetAtPath<Texture2D>(path);
            bool fresh=texture==null;
            if(fresh)texture=new Texture2D(32,32,TextureFormat.RGBA32,true){name="Soft gold guide spark"};
            var pixels=new Color[32*32];
            for(int y=0;y<32;y++)for(int x=0;x<32;x++)
            {
                float radius=new Vector2(x-15.5f,y-15.5f).magnitude/15.5f;
                float alpha=Mathf.Pow(Mathf.Clamp01(1-radius),2.2f);
                pixels[y*32+x]=new Color(1,.91f,.65f,alpha);
            }
            texture.SetPixels(pixels);texture.Apply(true,false);
            if(fresh)AssetDatabase.CreateAsset(texture,path);else EditorUtility.SetDirty(texture);
            return texture;
        }
        static Material SparkMaterial()
        {
            string path=Output+"GoldSpark.mat";
            var material=AssetDatabase.LoadAssetAtPath<Material>(path);
            if(material==null)
            {
                var shader=Shader.Find("Universal Render Pipeline/Particles/Unlit");
                if(shader==null)throw new InvalidOperationException("URP particle shader is missing");
                material=new Material(shader);AssetDatabase.CreateAsset(material,path);
            }
            material.SetTexture("_BaseMap",SparkTexture());material.SetColor("_BaseColor",Color.white);
            material.SetFloat("_Surface",1);material.SetFloat("_Blend",1);material.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");
            material.SetFloat("_SrcBlend",(float)UnityEngine.Rendering.BlendMode.SrcAlpha);
            material.SetFloat("_DstBlend",(float)UnityEngine.Rendering.BlendMode.One);
            material.SetFloat("_SrcBlendAlpha",(float)UnityEngine.Rendering.BlendMode.One);
            material.SetFloat("_DstBlendAlpha",(float)UnityEngine.Rendering.BlendMode.One);
            material.SetFloat("_ZWrite",0);
            material.renderQueue=3000;EditorUtility.SetDirty(material);return material;
        }

        public static void Populate()
        {
            if(UnityEngine.Object.FindFirstObjectByType<QuestGuide>()!=null)return;
            var player=UnityEngine.Object.FindFirstObjectByType<PlanetExplorer>();
            if(player==null)throw new InvalidOperationException("Quest guide needs the current explorer");
            Directory.CreateDirectory(Output);AssetDatabase.Refresh();Prepare();
            var ship=UnityEngine.Object.FindFirstObjectByType<StarsailIntro>();
            var temple=UnityEngine.Object.FindFirstObjectByType<TempleEntrance>();
            var ground=UnityEngine.Object.FindFirstObjectByType<PlanetSurface>();
            var orbit=UnityEngine.Object.FindFirstObjectByType<OrbitCamera>();
            if(ship==null&&temple==null)return; // Interior rooms retain their own puzzle HUD.

            var hud=Canvas("Current quest and gold dust HUD");hud.GetComponent<UnityEngine.Canvas>().sortingOrder=34;
            var root=Rect("Current quest button",hud,new Vector2(.5f,1),new Vector2(.5f,1),new Vector2(0,-20),new Vector2(660,84));
            var background=root.gameObject.AddComponent<Image>();background.color=new Color(.035f,.13f,.16f,.97f);
            var outline=root.gameObject.AddComponent<Outline>();outline.effectColor=new Color(.87f,.66f,.29f,.95f);outline.effectDistance=new Vector2(2,-2);
            var button=root.gameObject.AddComponent<Button>();button.targetGraphic=background;
            button.navigation=new Navigation{mode=Navigation.Mode.None};
            var caption=Text(root,"Quest guidance caption","현재 퀘스트 · 눌러서 길 안내",new Vector2(.5f,1),new Vector2(.5f,1),new Vector2(0,-7),new Vector2(625,27),17);
            caption.color=new Color(.96f,.81f,.55f);caption.raycastTarget=false;
            var title=Text(root,"Current quest goal","현재 할 일",new Vector2(.5f,0),new Vector2(.5f,0),new Vector2(0,7),new Vector2(630,47),25);
            title.color=new Color(1,.97f,.86f);title.raycastTarget=false;
            var panel=Rect("Quest direction",hud,new Vector2(.5f,1),new Vector2(.5f,1),new Vector2(0,-110),new Vector2(430,49));
            panel.gameObject.AddComponent<Image>().color=new Color(.04f,.12f,.14f,.9f);
            var pointer=Text(panel,"Gold guidance arrow","↑",new Vector2(.5f,.5f),new Vector2(.5f,.5f),new Vector2(-173,0),new Vector2(42,44),32);
            pointer.color=new Color(1,.84f,.45f);pointer.raycastTarget=false;
            var bearing=Text(panel,"Quest bearing","목적지 방향",new Vector2(.5f,.5f),new Vector2(.5f,.5f),new Vector2(20,0),new Vector2(360,40),20);
            bearing.color=new Color(1,.9f,.66f);bearing.raycastTarget=false;
            var effect=new GameObject("One-batch golden guide dust",typeof(ParticleSystem));
            var particles=effect.GetComponent<ParticleSystem>();
            var main=particles.main;main.loop=false;main.playOnAwake=false;main.maxParticles=96;
            main.startLifetime=1;main.startSpeed=0;main.startSize=.11f;main.simulationSpace=ParticleSystemSimulationSpace.World;
            var emission=particles.emission;emission.enabled=false;
            var shape=particles.shape;shape.enabled=false;
            var renderer=effect.GetComponent<ParticleSystemRenderer>();
            renderer.renderMode=ParticleSystemRenderMode.Billboard;renderer.sharedMaterial=SparkMaterial();
            renderer.shadowCastingMode=UnityEngine.Rendering.ShadowCastingMode.Off;
            var guide=hud.gameObject.AddComponent<QuestGuide>();
            guide.Configure(player,ship,temple,ground,orbit,button,title,caption,panel.gameObject,bearing,pointer.rectTransform,particles);
            panel.gameObject.SetActive(false);
        }

        [MenuItem("Mumu/Add quest guide and notebook map")]
        public static void CreateAndBuild()
        {
            foreach(var name in new[]{"PlanetExploration","WeightTemple","TwinBalanceTemple","LeverBalanceTemple"})
            {
                var scene=EditorSceneManager.OpenScene("Assets/Mumu/Scenes/"+name+".unity");
                BuildNotebook.Populate();
                if(name=="PlanetExploration")Populate();
                AssetDatabase.SaveAssets();EditorSceneManager.SaveScene(scene);
            }
            BuildStarsailIntro.Create(); // Regenerate only the ship; planet and temple content stays in place.
            BuildExploration.BuildWindows();
        }
    }
}
