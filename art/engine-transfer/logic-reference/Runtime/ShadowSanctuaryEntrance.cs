using TMPro;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.SceneManagement;

namespace Mumu.Planet
{
    // The moon gate of the shadow temple on the planet. Walk up to the night portal and press E.
    // The planet record only remembers the first visit and seals the gate after the guardian is met.
    public sealed class ShadowSanctuaryEntrance : MonoBehaviour
    {
        public const string TempleScene=ShadowTemple.SceneName;
        public const float ContextRadius=9f;
        public const string PromptEnter="E  그림자의 사당 입장",PromptApproach="그림자의 사당  ·  달의 문 앞으로 이동",
            PromptEntering="그림자의 사당으로 들어간다",PromptSealed="그림자의 사당 밀봉  ·  그림자의 지혜 기록 완료",
            PromptSealedUnsaved="그림자의 사당 밀봉  ·  이번 탐사 완료 (저장 확인 필요)",PromptMissingScene="그림자의 사당 내부 장면이 이 실행판에 없다";
        public static readonly string[] PromptTexts={PromptEnter,PromptApproach,PromptEntering,PromptSealed,PromptSealedUnsaved,PromptMissingScene};
        public static readonly string[] NatureGroups=WaterSanctuaryEntrance.NatureGroups;
        // Gate art bounds (shadow-gate-exterior-v01) plus the forecourt, in gate-local metres.
        public static bool InsideFootprint(Vector3 local)=>Mathf.Abs(local.x)<4.8f&&local.z> -5.6f&&local.z<2.2f;

        [SerializeField] PlanetExplorer player;
        [SerializeField] OrbitCamera orbit;
        [SerializeField] Transform doorway;
        [SerializeField] GameObject completionSeal,promptPanel;
        [SerializeField] TextMeshProUGUI prompt;
        [SerializeField] Renderer beacon;
        bool entering;string notice;
        MaterialPropertyBlock block;

        public void Configure(PlanetExplorer explorer,OrbitCamera cameraRig,Transform door,GameObject seal,GameObject panel,TextMeshProUGUI label,Renderer light)
        {player=explorer;orbit=cameraRig;doorway=door;completionSeal=seal;promptPanel=panel;prompt=label;beacon=light;}
        public Transform EntranceTarget=>doorway;
        public bool Sealed=>ShadowApproachProgress.Current.Completed;
        public bool Visited=>ShadowApproachProgress.Current.EntranceOpen;
        public bool SealVisible=>completionSeal!=null&&completionSeal.activeSelf;
        public bool PromptVisible=>promptPanel!=null&&promptPanel.activeSelf;
        public string PromptText=>prompt!=null?prompt.text:"";
        public TMP_FontAsset PromptFont=>prompt!=null?prompt.font:null;
        public bool IsEntering=>entering;
        public Renderer Beacon=>beacon;
        public bool ContextActive=>player!=null&&doorway!=null&&Vector3.Distance(player.transform.position,doorway.position)<ContextRadius;
        // Standing on the forecourt in front of the portal (the gate body stops the player at local z -0.7).
        public bool InDoorway
        {
            get
            {
                if(player==null||doorway==null)return false;
                var local=doorway.InverseTransformPoint(player.transform.position);
                return Mathf.Abs(local.x)<1.8f&&local.z> -3.4f&&local.z<.2f&&Mathf.Abs(local.y)<2f;
            }
        }
        public bool CanEnter=>!entering&&!Sealed&&player!=null&&player.Grounded&&!NotebookUI.BlocksInput&&InDoorway;
        public Vector3 ArrivalPoint=>doorway.TransformPoint(new Vector3(0,0,-2.6f));

        public bool TryEnter()
        {
            if(!CanEnter)return false;
            if(!Application.CanStreamedLevelBeLoaded(TempleScene)){notice=PromptMissingScene;RefreshPrompt();return false;}
            ShadowApproachProgress.ReturnPosition=ArrivalPoint;
            ShadowApproachProgress.ReturnHeading=-doorway.forward;
            if(!ShadowApproachProgress.Current.Open())
                Debug.LogWarning("Shadow temple visit was not recorded; entry continues this session: "+ShadowApproachProgress.Current.Problem);
            entering=true;notice=null;RefreshPrompt();
            SceneManager.LoadScene(TempleScene);return true;
        }

        void Start()
        {
            if(completionSeal!=null)completionSeal.SetActive(Sealed);
            if(ShadowApproachProgress.ArrivalPending)
            {
                ShadowApproachProgress.ArrivalPending=false;
                var landing=ShadowApproachProgress.ReturnPosition;
                var heading=ShadowApproachProgress.ReturnHeading;
                if(landing.sqrMagnitude<1)landing=ArrivalPoint;
                player.Respawn(landing,heading.sqrMagnitude>.001f?heading:-doorway.forward);
                if(orbit!=null)orbit.Snap();
            }
            else if(System.Array.IndexOf(System.Environment.GetCommandLineArgs(),"-mumu-shadow-preview")>=0)
            {
                player.Respawn(doorway.TransformPoint(new Vector3(0,0,-6.5f)),doorway.forward);
                if(orbit!=null)orbit.Snap();
            }
            RefreshPrompt();
        }

        public void RefreshPrompt()
        {
            if(promptPanel==null||prompt==null)return;
            bool show=ContextActive&&!NotebookUI.BlocksInput;
            if(promptPanel.activeSelf!=show)promptPanel.SetActive(show);
            if(!ContextActive)notice=null;
            string label=Sealed?(ShadowApproachProgress.Current.Saved?PromptSealed:PromptSealedUnsaved):
                entering?PromptEntering:notice!=null?notice:CanEnter?PromptEnter:PromptApproach;
            if(prompt.text!=label)prompt.text=label;
        }

        void Update()
        {
            if(player==null||doorway==null)return;
            if(completionSeal!=null&&completionSeal.activeSelf!=Sealed)completionSeal.SetActive(Sealed);
            var key=Keyboard.current;
            if(key!=null&&key.eKey.wasPressedThisFrame&&!NotebookUI.BlocksInput)TryEnter();
            if(beacon!=null)
            {
                block??=new MaterialPropertyBlock();
                beacon.GetPropertyBlock(block);
                float pulse=.8f+.2f*Mathf.Sin(Time.time*1.3f);
                var colour=Sealed?new Color(1,.78f,.36f):new Color(.93f,.91f,.84f);
                block.SetColor("_BaseColor",new Color(colour.r,colour.g,colour.b,.34f*pulse));
                beacon.SetPropertyBlock(block);
            }
            RefreshPrompt();
        }
    }
}
