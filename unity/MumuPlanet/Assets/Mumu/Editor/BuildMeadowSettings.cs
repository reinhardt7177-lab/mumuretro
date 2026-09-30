using System;
using TMPro;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;
using Mumu.Planet;

namespace Mumu.Editor
{
    public static class BuildMeadowSettings
    {
        public static void Populate(MeadowGrass meadow)
        {
            var font=AssetDatabase.LoadAssetAtPath<TMP_FontAsset>("Assets/Mumu/Generated/Balance/TempleKorean.asset");
            if(font==null)throw new Exception("Temple Korean font is required for meadow settings");
            font.atlasPopulationMode=AtlasPopulationMode.Dynamic;
            if(!font.TryAddCharacters("풀: 켜짐꺼 [G]",out string missing))throw new Exception("Missing meadow UI glyphs: "+missing);
            font.atlasPopulationMode=AtlasPopulationMode.Static;EditorUtility.SetDirty(font);
            foreach(var atlas in font.atlasTextures)EditorUtility.SetDirty(atlas);
            var old=GameObject.Find("Meadow display HUD");if(old!=null)UnityEngine.Object.DestroyImmediate(old);
            var root=new GameObject("Meadow display HUD",typeof(Canvas),typeof(CanvasScaler),typeof(GraphicRaycaster));
            root.GetComponent<Canvas>().renderMode=RenderMode.ScreenSpaceOverlay;root.GetComponent<Canvas>().sortingOrder=20;
            var scaler=root.GetComponent<CanvasScaler>();scaler.uiScaleMode=CanvasScaler.ScaleMode.ScaleWithScreenSize;scaler.referenceResolution=new Vector2(1440,900);scaler.matchWidthOrHeight=.5f;
            var buttonObject=new GameObject("Grass visibility",typeof(RectTransform),typeof(Image),typeof(Button));
            var rect=buttonObject.GetComponent<RectTransform>();rect.SetParent(root.transform,false);rect.anchorMin=rect.anchorMax=rect.pivot=Vector2.one;rect.anchoredPosition=new Vector2(-24,-24);rect.sizeDelta=new Vector2(224,56);
            var background=buttonObject.GetComponent<Image>();background.color=new Color(.035f,.11f,.12f,.96f);
            var outline=buttonObject.AddComponent<Outline>();outline.effectColor=new Color(.69f,.56f,.28f);outline.effectDistance=new Vector2(1,-1);
            var button=buttonObject.GetComponent<Button>();button.targetGraphic=background;button.navigation=new Navigation{mode=Navigation.Mode.None};
            var labelObject=new GameObject("Grass state",typeof(RectTransform),typeof(TextMeshProUGUI));
            var label=labelObject.GetComponent<TextMeshProUGUI>();label.rectTransform.SetParent(rect,false);label.rectTransform.anchorMin=Vector2.zero;label.rectTransform.anchorMax=Vector2.one;label.rectTransform.offsetMin=label.rectTransform.offsetMax=Vector2.zero;
            label.font=font;label.fontSize=23;label.alignment=TextAlignmentOptions.Center;label.raycastTarget=false;label.text="풀: 꺼짐  [G]";
            root.AddComponent<MeadowSettingsUI>().Configure(meadow,button,label);
            if(UnityEngine.Object.FindFirstObjectByType<EventSystem>()==null)
            {
                var events=new GameObject("Exploration UI input",typeof(EventSystem),typeof(InputSystemUIInputModule));
                events.GetComponent<InputSystemUIInputModule>().AssignDefaultActions();events.GetComponent<EventSystem>().sendNavigationEvents=false;
            }
        }
        public static void CreateAndBuild()
        {
            var scene=EditorSceneManager.OpenScene("Assets/Mumu/Scenes/PlanetExploration.unity");
            Populate(UnityEngine.Object.FindFirstObjectByType<MeadowGrass>());
            AssetDatabase.SaveAssets();EditorSceneManager.SaveScene(scene);BuildExploration.BuildWindows();
        }
    }
}
