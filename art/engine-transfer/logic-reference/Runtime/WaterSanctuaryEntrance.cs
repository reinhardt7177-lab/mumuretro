using TMPro;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.SceneManagement;

namespace Mumu.Planet
{
    // The water sanctuary stands open on the planet: climb its stairs and press E at the doorway.
    // No cliff, mirror or thaw is required. The local water record only
    //  - remembers the first visit (the existing entranceOpen field), and
    //  - seals the doorway permanently after the water deity is met (completed).
    public sealed class WaterSanctuaryEntrance : MonoBehaviour
    {
        public const string FirstRoom="WaterJourneyIce";
        // Prompt/HUD and quest distances (metres from the doorway marker).
        public const float ContextRadius=9f;
        // The stairs and plinth need the stepped traversal rule (no radial pop-up onto the 1.1m plinth).
        // 14m covers the whole terrain-fitted footing (sanctuary-local x ±9, z -7..10).
        public const float TraversalRadius=14f;
        public const string PromptEnter="E  물의 신전 입장",PromptApproach="물의 신전  ·  계단 위 열린 입구로 이동",
            PromptEntering="물의 신전으로 들어갑니다",PromptSealed="물의 신전 밀봉  ·  순환의 지혜 기록 완료",
            PromptSealedUnsaved="물의 신전 밀봉  ·  이번 탐사 완료 (저장 확인 필요)",PromptMissingScene="물의 신전 내부 장면이 이 실행판에 없습니다";
        public static readonly string[] PromptTexts={PromptEnter,PromptApproach,PromptEntering,PromptSealed,PromptSealedUnsaved,PromptMissingScene};
        // Original nature placement is hidden only where the sanctuary would swallow it.
        public static readonly string[] NatureGroups={"Blender nature · original placement","Nature collisions"};
        public const string FootingName="Terrain fitted glacier footing";
        // A base buried deeper than this under the raised footing is hidden. Above the ~0.17m grass-carpet offset.
        public const float BuriedLimit=.3f;
        // Stone and glacier art bounds (glacier-temple-v03.json) plus 0.3m, in sanctuary-local metres.
        public static bool InsideFootprint(Vector3 local)=>Mathf.Abs(local.x)<6.9f&&local.z> -3f&&local.z<7.9f;
        public static bool ShouldHideNature(Transform sanctuary,Collider footing,Vector3 world)
        {
            var local=sanctuary.InverseTransformPoint(world);
            if(InsideFootprint(local))return true;
            if(footing==null)return false;
            var ray=new Ray(sanctuary.TransformPoint(new Vector3(local.x,40,local.z)),-sanctuary.up);
            return footing.Raycast(ray,out var hit,90)&&sanctuary.InverseTransformPoint(hit.point).y-local.y>BuriedLimit;
        }

        [SerializeField] PlanetExplorer player;
        [SerializeField] OrbitCamera orbit;
        [SerializeField] Transform doorway;
        [SerializeField] GameObject completionSeal,flow,promptPanel;
        [SerializeField] TextMeshProUGUI prompt;
        [SerializeField] Transform[] ribbons=new Transform[0];
        Vector3[] ribbonSizes;
        bool entering,ownsTraversal;
        string notice;

        public void Configure(PlanetExplorer explorer,OrbitCamera cameraRig,Transform door,GameObject seal,
            GameObject water,Transform[] waterRibbons,GameObject panel,TextMeshProUGUI label)
        {
            player=explorer;orbit=cameraRig;doorway=door;completionSeal=seal;flow=water;
            ribbons=waterRibbons??new Transform[0];promptPanel=panel;prompt=label;
        }

        public Transform EntranceTarget=>doorway;
        public bool Sealed=>WaterApproachProgress.Current.Completed;
        // A pre-existing thaw record from the retired cliff chapter also counts as a visit.
        public bool Visited=>WaterApproachProgress.Current.EntranceOpen;
        public bool SealVisible=>completionSeal!=null&&completionSeal.activeSelf;
        public bool PromptVisible=>promptPanel!=null&&promptPanel.activeSelf;
        public string PromptText=>prompt!=null?prompt.text:"";
        public TMP_FontAsset PromptFont=>prompt!=null?prompt.font:null;
        public bool IsEntering=>entering;
        public bool ContextActive=>player!=null&&doorway!=null&&
            Vector3.Distance(player.transform.position,doorway.position)<ContextRadius;
        // From the foot of the stairs to the doorway threshold (the threshold collider stops the player at local z ~0.8).
        public bool InDoorway
        {
            get
            {
                if(player==null||doorway==null)return false;
                var local=doorway.InverseTransformPoint(player.transform.position);
                return Mathf.Abs(local.x)<1.6f&&local.z> -3f&&local.z<1.3f&&Mathf.Abs(local.y)<2.3f;
            }
        }
        public bool CanEnter=>!entering&&!Sealed&&player!=null&&player.Grounded&&!NotebookUI.BlocksInput&&InDoorway;

        public bool TryEnter()
        {
            if(!CanEnter)return false;
            if(!Application.CanStreamedLevelBeLoaded(FirstRoom)){notice=PromptMissingScene;RefreshPrompt();return false;}
            // Return to the first stair, outside the slab that seals the doorway after completion.
            WaterApproachProgress.ReturnPosition=doorway.TransformPoint(new Vector3(0,-1f,-2f));
            var heading=doorway.position-WaterApproachProgress.ReturnPosition;
            WaterApproachProgress.ReturnHeading=heading.sqrMagnitude>.001f?heading.normalized:doorway.forward;
            // Remember the visit. An unreadable or read-only record never blocks the entrance.
            if(!WaterApproachProgress.Current.Open())
                Debug.LogWarning("Water sanctuary visit was not recorded; entry continues this session: "+WaterApproachProgress.Current.Problem);
            entering=true;notice=null;RefreshPrompt();
            SceneManager.LoadScene(FirstRoom);return true;
        }

        void Start()
        {
            if(completionSeal!=null)completionSeal.SetActive(Sealed);
            if(flow!=null)flow.SetActive(true);
            if(WaterApproachProgress.ArrivalPending)
            {
                WaterApproachProgress.ArrivalPending=false;
                var landing=WaterApproachProgress.ReturnPosition;
                var heading=WaterApproachProgress.ReturnHeading;
                if(landing.sqrMagnitude<1)landing=doorway.TransformPoint(new Vector3(0,-1,-2));
                player.Respawn(landing,heading.sqrMagnitude>.001f?heading:doorway.forward);
                if(orbit!=null)orbit.Snap();
            }
            else if(System.Array.IndexOf(System.Environment.GetCommandLineArgs(),"-mumu-water-preview")>=0)
            {
                player.Respawn(doorway.TransformPoint(new Vector3(0,-1.12f,-6f)),doorway.forward);
                if(orbit!=null)orbit.Snap();
            }
            RefreshTraversal();RefreshPrompt();
        }

        // Called every frame and by deterministic validation between manual Step calls.
        public void RefreshTraversal()
        {
            if(player==null)return;
            bool near=Vector3.Distance(player.transform.position,transform.position)<TraversalRadius;
            if(near&&!player.ElevatedTraversal){player.ElevatedTraversal=true;ownsTraversal=true;}
            else if(!near&&ownsTraversal){player.ElevatedTraversal=false;ownsTraversal=false;}
        }

        public void RefreshPrompt()
        {
            if(promptPanel==null||prompt==null)return;
            bool show=ContextActive&&!NotebookUI.BlocksInput;
            if(promptPanel.activeSelf!=show)promptPanel.SetActive(show);
            if(!ContextActive)notice=null;
            string label=Sealed?(WaterApproachProgress.Current.Saved?PromptSealed:PromptSealedUnsaved):
                entering?PromptEntering:notice!=null?notice:CanEnter?PromptEnter:PromptApproach;
            if(prompt.text!=label)prompt.text=label;
        }

        void Update()
        {
            if(player==null||doorway==null)return;
            RefreshTraversal();
            if(completionSeal!=null&&completionSeal.activeSelf!=Sealed)completionSeal.SetActive(Sealed);
            var key=Keyboard.current;
            if(key!=null&&key.eKey.wasPressedThisFrame&&!NotebookUI.BlocksInput)TryEnter();
            PulseRibbons();
            RefreshPrompt();
        }

        void PulseRibbons()
        {
            if(ribbons==null||ribbons.Length==0||flow==null||!flow.activeInHierarchy)return;
            if(ribbonSizes==null||ribbonSizes.Length!=ribbons.Length)
            {
                ribbonSizes=new Vector3[ribbons.Length];
                for(int i=0;i<ribbons.Length;i++)ribbonSizes[i]=ribbons[i]!=null?ribbons[i].localScale:Vector3.one;
            }
            for(int i=0;i<ribbons.Length;i++)
            {
                if(ribbons[i]==null)continue;
                float pulse=.85f+.15f*Mathf.Sin(Time.time*3.5f-i*1.8f);
                ribbons[i].localScale=Vector3.Scale(ribbonSizes[i],new Vector3(pulse,1,1));
            }
        }

        void OnDisable()
        {
            if(ownsTraversal&&player!=null)player.ElevatedTraversal=false;
            ownsTraversal=false;
        }
    }
}
