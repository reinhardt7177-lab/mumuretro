using UnityEngine;

namespace Mumu.Planet
{
    // Two Blender-authored leaf meshes rotate around their real outer hinges.
    public sealed class SanctuaryDoor : MonoBehaviour
    {
        [SerializeField] Transform left, right;
        public float Progress { get; private set; }
        public float LeftAngle => Quaternion.Angle(Quaternion.identity,left.localRotation);
        public float RightAngle => Quaternion.Angle(Quaternion.identity,right.localRotation);
        public void Configure(Transform leftHinge,Transform rightHinge)
        {left=leftHinge;right=rightHinge;SetOpening(0);}
        void Awake(){SetOpening(0);}
        public void SetOpening(float progress)
        {
            Progress=Mathf.Clamp01(progress);
            // A slow initial push and soft stop convey the mass of the bronze leaves.
            float t=Progress;float angle=94*t*t*t*(t*(t*6-15)+10);
            if(left!=null)left.localRotation=Quaternion.Euler(0,-angle,0);
            if(right!=null)right.localRotation=Quaternion.Euler(0,angle,0);
        }
    }
}
