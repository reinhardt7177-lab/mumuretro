using TMPro;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;

namespace Mumu.Planet
{
    public sealed class MeadowSettingsUI : MonoBehaviour
    {
        [SerializeField] MeadowGrass meadow;
        [SerializeField] Button toggle;
        [SerializeField] TextMeshProUGUI label;
        public Button ToggleButton=>toggle;
        public void Configure(MeadowGrass grass,Button button,TextMeshProUGUI text){meadow=grass;toggle=button;label=text;}
        void OnEnable(){if(toggle==null||meadow==null||label==null)return;toggle.onClick.AddListener(Toggle);meadow.VisibilityChanged+=Refresh;Refresh(meadow.IsVisible);}
        void OnDisable(){if(toggle!=null)toggle.onClick.RemoveListener(Toggle);if(meadow!=null)meadow.VisibilityChanged-=Refresh;}
        void Start(){Refresh(meadow.IsVisible);}
        void Update(){if(Keyboard.current!=null&&Keyboard.current.gKey.wasPressedThisFrame)Toggle();}
        void Toggle(){if(!NotebookUI.BlocksInput)meadow.SetVisible(!meadow.IsVisible);}
        void Refresh(bool visible)
        {
            label.text=visible?"풀: 켜짐  [G]":"풀: 꺼짐  [G]";
            label.color=visible?new Color(1f,.85f,.49f):new Color(.88f,.94f,.9f);
        }
    }
}
