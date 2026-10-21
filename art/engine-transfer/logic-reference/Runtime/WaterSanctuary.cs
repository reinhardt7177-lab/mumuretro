using TMPro;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

namespace Mumu.Planet
{
    public sealed class WaterSanctuary : MonoBehaviour
    {
        public PlanetExplorer player;
        public OrbitCamera orbit;
        public Transform deity;
        public TextMeshProUGUI heading,speech;
        public Button next;
        public Image fade;
        public int LineIndex {get;private set;}=-1;
        public bool Met {get;private set;}
        public bool IsDeparting {get;private set;}
        float cooldown,departureClock;
        static readonly string[] Lines={
            "얼음으로 길을 만들고, 그 길을 녹여 다시 물을 모았구나.",
            "물은 얼음이 되고, 수증기가 되고, 다시 물방울이 된다.\n모습이 달라져도 같은 물이지.",
            "한 번 쓴 물에도 다음 길이 담겨 있다.\n네가 지나온 순환의 길을 기억하렴."
        };
        void Start(){next.onClick.AddListener(Advance);next.gameObject.SetActive(false);if(fade!=null)fade.gameObject.SetActive(false);Present();}
        public bool TryBegin()
        {
            if(Met||IsDeparting||WaterApproachProgress.Current.Completed||LineIndex>=0||NotebookUI.BlocksInput||!player.Grounded||Vector3.Distance(player.transform.position,new Vector3(0,0,9))>2)return false;
            LineIndex=0;player.InputLocked=true;cooldown=.3f;next.gameObject.SetActive(true);Present();return true;
        }
        public void Advance()
        {
            if(LineIndex<0||cooldown>0||NotebookUI.BlocksInput)return;
            cooldown=.3f;
            if(LineIndex+1<Lines.Length)LineIndex++;
            else
            {
                Met=true;IsDeparting=true;LineIndex=-1;departureClock=0;
                next.gameObject.SetActive(false);player.InputLocked=true;
                if(fade!=null)fade.gameObject.SetActive(true);
                if(!WaterApproachProgress.Current.Complete())
                    Debug.LogWarning("Water deity completed this session; the local record was not written: "+WaterApproachProgress.Current.Problem);
                WaterApproachProgress.ArrivalPending=true;
            }
            Present();
        }
        public void Tick(float dt)
        {
            cooldown=Mathf.Max(0,cooldown-Mathf.Max(0,dt));
            if(!IsDeparting)return;
            departureClock+=Mathf.Max(0,dt);
            if(fade!=null){var color=fade.color;color.a=Mathf.Clamp01(departureClock/.95f);fade.color=color;}
            if(departureClock>=1.25f)SceneManager.LoadScene("PlanetExploration");
        }
        void Update()
        {
            if(!NotebookUI.BlocksInput)Tick(Time.deltaTime);
            if(IsDeparting||NotebookUI.BlocksInput)return;
            var key=Keyboard.current;
            if(key!=null&&key.eKey.wasPressedThisFrame){if(LineIndex<0)TryBegin();else Advance();}
            if(player.transform.position.y< -2)player.Respawn(new Vector3(0,0,1),Vector3.forward);
        }
        public void Present()
        {
            heading.text=LineIndex>=0?"물의 신 · "+(LineIndex+1)+" / "+Lines.Length:IsDeparting?"순환의 지혜를 얻었다":"물의 성소 · 중앙 통로를 따라 물의 신에게 다가가세요";
            speech.text=LineIndex>=0?Lines[LineIndex]+"\nE / 다음":IsDeparting?
                (WaterApproachProgress.Current.Saved?"순환의 지혜가 수첩에 기록되었습니다.\n물의 신전 밖으로 돌아갑니다.":"순환의 지혜를 얻었습니다.\n저장하지 못했습니다 · 이번 탐사를 계속합니다."):
                "W A S D 이동 · 오른쪽 드래그 시점 · 물의 신 앞에서 E";
        }
        void OnDisable(){if(player!=null)player.InputLocked=false;}
        void OnDestroy(){if(next!=null)next.onClick.RemoveListener(Advance);}
    }
}
