using UnityEngine;
using UnityEngine.InputSystem;

namespace Mumu.Planet
{
    public sealed class OrbitCamera : MonoBehaviour
    {
        [SerializeField] Transform target;
        PlanetExplorer explorer;
        [SerializeField] MountainClimbController climbing;
        float manualOrbitUntil;
        float revealStarted;
        bool revealing;
        Vector3 revealView,revealNear,revealFar,revealOrigin,revealPlayer;
        public bool RevealActive=>revealing;
        public void RevealLandmark(Vector3 view,Vector3 landmark,Vector3 destination)
        {
            revealView=view;revealNear=landmark;revealFar=destination;revealOrigin=transform.position;
            revealPlayer=target.position;revealStarted=Time.unscaledTime;revealing=true;
        }
        public void EndReveal(){revealing=false;}
        void OnDisable(){EndReveal();}
        public bool ClimbAssistActive=>climbing!=null&&climbing.IsHanging&&Time.unscaledTime>=manualOrbitUntil&&!NotebookUI.BlocksInput;
        public void ConfigureClimbing(MountainClimbController value){climbing=value;}
        public void NotifyManualOrbit(){manualOrbitUntil=Time.unscaledTime+2f;}
        Vector3 heading;
        [SerializeField] float pitch = 22f, distance = 6.5f;
        void Awake() { if (target != null) { explorer=target.GetComponent<PlanetExplorer>();heading = target.forward; Snap(); } }
        public void Configure(Transform player) { target = player;explorer=player.GetComponent<PlanetExplorer>(); heading = player.forward; Snap(); }
        public void ConfigureFraming(float angle,float range){pitch=Mathf.Clamp(angle,8f,65f);distance=Mathf.Clamp(range,3f,10f);Snap();}
        // Eases toward a new framing (shadow temple rooms); manual orbit or zoom cancels it.
        float blendPitch=-1,blendDistance=-1;
        public void BlendFraming(float angle,float range){blendPitch=Mathf.Clamp(angle,8f,65f);blendDistance=Mathf.Clamp(range,3f,10f);}
        public float Pitch=>pitch;
        public float Distance=>distance;
        void LateUpdate()
        {
            if (target == null) return;
            if(revealing&&(Time.unscaledTime-revealStarted>=3.2f||NotebookUI.BlocksInput||
                Vector3.Distance(target.position,revealPlayer)>.2f||
                Keyboard.current!=null&&Keyboard.current.escapeKey.wasPressedThisFrame))EndReveal();
            var up = explorer!=null?explorer.Up:target.up;
            heading = Vector3.ProjectOnPlane(heading, up).normalized;
            var mouse = Mouse.current;
            if (mouse != null)
            {
                if (mouse.rightButton.isPressed)
                {
                    EndReveal();
                    NotifyManualOrbit();
                    var delta = mouse.delta.ReadValue();
                    heading = Quaternion.AngleAxis(delta.x * .18f, up) * heading;
                    pitch = Mathf.Clamp(pitch - delta.y * .14f, 8f, 65f);
                }
                distance = Mathf.Clamp(distance - mouse.scroll.ReadValue().y * .008f, 3f, 10f);
                if(mouse.rightButton.isPressed||Mathf.Abs(mouse.scroll.ReadValue().y)>.01f)blendPitch=blendDistance=-1;
            }
            if(blendPitch>=0)
            {
                pitch=Mathf.MoveTowards(pitch,blendPitch,Time.deltaTime*24f);
                distance=Mathf.MoveTowards(distance,blendDistance,Time.deltaTime*3f);
                if(Mathf.Approximately(pitch,blendPitch)&&Mathf.Approximately(distance,blendDistance))blendPitch=blendDistance=-1;
            }
            Place(1f - Mathf.Exp(-Time.deltaTime * 12f));
        }
        public void Snap() { if (target != null) Place(1f); }
        void Place(float amount)
        {
            if(revealing&&!NotebookUI.BlocksInput)
            {
                float elapsed=Time.unscaledTime-revealStarted;
                var look=Vector3.Lerp(revealNear,revealFar,Mathf.SmoothStep(0,1,Mathf.InverseLerp(1.1f,2.7f,elapsed))*.65f);
                transform.position=Vector3.Lerp(revealOrigin,revealView,Mathf.SmoothStep(0,1,elapsed/.85f));
                transform.rotation=Quaternion.Slerp(transform.rotation,Quaternion.LookRotation(look-transform.position,target.up),amount);
                return;
            }
            var up = explorer!=null?explorer.Up:target.up;
            heading = Vector3.ProjectOnPlane(heading, up).normalized;
            var focus = target.position + up * 1f;
            var offset = (-heading * Mathf.Cos(pitch * Mathf.Deg2Rad) + up * Mathf.Sin(pitch * Mathf.Deg2Rad)) * distance;
            if(ClimbAssistActive)
            {
                up=climbing.WallUp;
                focus+=Vector3.ClampMagnitude(climbing.GuidanceTarget-focus,2f)*.3f;
                var side=Vector3.Cross(up,climbing.WallForward).normalized;
                offset=-climbing.WallForward*Mathf.Clamp(distance,4f,8f)+side*1.1f+up*1.3f;
            }
            if (Physics.SphereCast(focus, .2f, offset.normalized, out var hit, offset.magnitude, (1 << 8) | (1 << 9), QueryTriggerInteraction.Ignore)) offset = offset.normalized * Mathf.Max(.8f, hit.distance - .15f);
            transform.position = Vector3.Lerp(transform.position, focus + offset, amount);
            transform.rotation = Quaternion.LookRotation(focus - transform.position, up);
        }
    }
}
