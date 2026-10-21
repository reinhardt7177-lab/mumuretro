using System;
using System.Collections;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.SceneManagement;
using TMPro;

namespace Mumu.Planet
{
    public sealed class TempleEntrance : MonoBehaviour
    {
        [SerializeField] PlanetExplorer player;
        [SerializeField] TextMeshProUGUI prompt;
        [SerializeField] SanctuaryDoor door;
        [SerializeField] GameObject seal;
        [SerializeField] UnityEngine.UI.Image arrivalFlash;
        [SerializeField] WaterSanctuaryEntrance nearbyWater;
        [SerializeField] ShadowSanctuaryEntrance nearbyShadow;
        public void ConfigureWaterContext(WaterSanctuaryEntrance water){nearbyWater=water;}
        public void ConfigureShadowContext(ShadowSanctuaryEntrance shadow){nearbyShadow=shadow;}
        public bool PromptVisible=>prompt!=null&&prompt.transform.parent.gameObject.activeSelf;
        public bool IsSealed=>TempleProgress.Current.Completed;
        public bool SealVisible=>seal!=null&&seal.activeSelf;
        public void ConfigureSeal(GameObject marker,UnityEngine.UI.Image flash){seal=marker;arrivalFlash=flash;}
        bool entering,playerWasEnabled;
        public bool IsOpening => entering;
        public SanctuaryDoor Door => door;
        public void ConfigureDoor(SanctuaryDoor value){door=value;}
        static Vector3 returnPosition,returnHeading;
        static bool returning;
        static bool smokeStarted;
        public void Configure(PlanetExplorer p,TextMeshProUGUI text){player=p;prompt=text;}
        public bool CanEnter
        {
            get
            {
                if(NotebookUI.BlocksInput||IsSealed||entering||player==null||!player.Grounded)return false;
                var local=transform.InverseTransformPoint(player.transform.position);
                return Mathf.Abs(local.x)<1.5f&&local.z> -2.6f&&local.z<1.75f&&Mathf.Abs(local.y)<1.5f;
            }
        }
        public bool TryEnter(){if(!CanEnter)return false;Enter();return true;}
        void Start()
        {
            if(returning){player.Respawn(returnPosition,returnHeading);returning=false;}
            if(seal!=null)seal.SetActive(IsSealed);
            if(TempleProgress.ArrivalPending){TempleProgress.ArrivalPending=false;StartCoroutine(FadeArrival());}
            if(IsSealed)return;
            if(!smokeStarted&&Array.IndexOf(Environment.GetCommandLineArgs(),"-mumu-lever-preview")>=0)
            {smokeStarted=true;returnPosition=player.transform.position;returnHeading=player.transform.forward;returning=true;SceneManager.LoadScene("LeverBalanceTemple");return;}
            if(!smokeStarted&&Array.IndexOf(Environment.GetCommandLineArgs(),"-mumu-temple-smoke")>=0){smokeStarted=true;Enter();}
        }
        public void Enter()
        {
            if(NotebookUI.BlocksInput||IsSealed||entering)return;
            StartCoroutine(OpenAndEnter());
        }
        IEnumerator OpenAndEnter()
        {
            entering=true;playerWasEnabled=player.enabled;
            returnPosition=player.transform.position;returnHeading=player.transform.forward;returning=true;
            player.enabled=false;
            var animator=player.GetComponentInChildren<Animator>();
            if(animator!=null)animator.SetFloat("Speed",0);
            if(door!=null)
            {
                float elapsed=0;
                while(elapsed<1.45f)
                {
                    elapsed+=Time.deltaTime;door.SetOpening(elapsed/1.45f);
                    yield return null;
                }
                door.SetOpening(1);
                yield return new WaitForSeconds(.25f);
            }
            SceneManager.LoadScene(TempleJourney.ResumeScene??"WeightTemple");
        }
        void OnDisable()
        {
            StopAllCoroutines();
            if(!entering)return;
            if(player!=null)player.enabled=playerWasEnabled;
            if(door!=null)door.SetOpening(0);
            entering=false;
        }
        void Update()
        {
            if(seal!=null&&seal.activeSelf!=IsSealed)seal.SetActive(IsSealed);
            bool near=CanEnter;
            bool otherContext=nearbyWater!=null&&nearbyWater.ContextActive||nearbyShadow!=null&&nearbyShadow.ContextActive;
            bool show=near||entering||!otherContext;
            if(prompt!=null&&prompt.transform.parent.gameObject.activeSelf!=show)prompt.transform.parent.gameObject.SetActive(show);
            string label=IsSealed?(TempleProgress.Current.Saved?"무게의 신전 밀봉  ·  균형의 지혜 기록 완료":"무게의 신전 밀봉  ·  이번 탐사 완료 (저장 확인 필요)"):entering?"무게의 신전  ·  문이 열리고 있습니다":near?"E  무게의 신전 입장":"무게의 신전  ·  청록빛 정문으로 이동";
            if(prompt!=null&&prompt.text!=label)prompt.text=label;
            if(Keyboard.current!=null&&Keyboard.current.eKey.wasPressedThisFrame)TryEnter();
        }
        IEnumerator FadeArrival()
        {
            if(arrivalFlash==null)yield break;
            float amount=1;
            while(amount>0){var color=arrivalFlash.color;color.a=amount;arrivalFlash.color=color;amount-=Time.deltaTime;yield return null;}
            var clear=arrivalFlash.color;clear.a=0;arrivalFlash.color=clear;
        }
    }
}
