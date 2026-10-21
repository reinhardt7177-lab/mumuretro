using System.Collections.Generic;
using UnityEngine;

namespace Mumu.Planet
{
    // Presentation only: movement and landing are always owned by PlanetExplorer.
    public sealed class NavigatorPose : MonoBehaviour
    {
        [SerializeField] PlanetExplorer explorer;
        readonly Dictionary<string, Transform> bones = new Dictionary<string, Transform>();
        readonly Dictionary<string,Vector3> palmAxes=new Dictionary<string,Vector3>();
        static readonly string[] Sides = { "Left", "Right" };
        Transform leftGrip,rightGrip;
        bool waterAiming;
        Vector3 waterTarget;
        public void SetWaterAim(bool active,Vector3 target){waterAiming=active;waterTarget=target;}
        bool climbing;
        float climbPhase;
        bool contactPose;
        Vector3 climbLeftHand,climbRightHand,climbLeftFoot,climbRightFoot;
        float handContact,footContact,rightFootContact;
        public int SupportedClimbFeet=>(footContact>.99f?1:0)+(rightFootContact>.99f?1:0);
        public bool HasClimbContacts=>climbing&&contactPose;
        public float ClimbHandError=>!HasClimbContacts?0:Mathf.Max(
            Vector3.Distance(bones["LeftHand"].position,climbLeftHand),Vector3.Distance(bones["RightHand"].position,climbRightHand));
        public float ClimbFootError=>!HasClimbContacts?0:Mathf.Max(
            footContact>.99f?Vector3.Distance(bones["LeftFoot"].position,climbLeftFoot):0,
            rightFootContact>.99f?Vector3.Distance(bones["RightFoot"].position,climbRightFoot):0);
        public void SetClimbing(bool active,float phase)
        {climbing=active;climbPhase=phase;if(!active)contactPose=false;}
        public void SetClimbContacts(Vector3 leftHand,Vector3 rightHand,Vector3 leftFoot,Vector3 rightFoot,float hands=1,float feet=1,float rightFeet=-1)
        {
            contactPose=true;climbLeftHand=leftHand;climbRightHand=rightHand;
            climbLeftFoot=leftFoot;climbRightFoot=rightFoot;
            handContact=Mathf.Clamp01(hands);footContact=Mathf.Clamp01(feet);
            rightFootContact=Mathf.Clamp01(rightFeet<0?feet:rightFeet);
        }
        void ContactLimb(string rootName,string jointName,string endName,Vector3 target,Vector3 pole,float weight)
        {
            if(weight<=0||!bones.TryGetValue(rootName,out var root)||!bones.TryGetValue(jointName,out var joint)||!bones.TryGetValue(endName,out var end))return;
            float upper=Vector3.Distance(root.position,joint.position),lower=Vector3.Distance(joint.position,end.position);
            Vector3 delta=target-root.position;
            float distance=Mathf.Clamp(delta.magnitude,Mathf.Abs(upper-lower)+.0001f,upper+lower-.0001f);
            Vector3 direction=delta.sqrMagnitude>.000001f?delta.normalized:explorer.transform.forward;
            Vector3 bend=Vector3.ProjectOnPlane(pole,direction).normalized;
            if(bend.sqrMagnitude<.01f)bend=Vector3.ProjectOnPlane(explorer.transform.right,direction).normalized;
            float along=(upper*upper-lower*lower+distance*distance)/(2*distance);
            Vector3 elbow=root.position+direction*along+bend*Mathf.Sqrt(Mathf.Max(0,upper*upper-along*along));
            Aim(rootName,jointName,explorer.transform.InverseTransformDirection(elbow-root.position),weight);
            Aim(jointName,endName,explorer.transform.InverseTransformDirection(target-joint.position),weight);
        }
        public void SetCarry(Transform left,Transform right) { leftGrip=left;rightGrip=right; }
        void CarryArm(string side,Transform grip)
        {
            if(grip==null||!bones.TryGetValue(side+"Arm",out var shoulder))return;
            var elbow=bones[side+"ForeArm"];var hand=bones[side+"Hand"];
            float a=Vector3.Distance(shoulder.position,elbow.position),b=Vector3.Distance(elbow.position,hand.position);
            var delta=grip.position-shoulder.position;float distance=Mathf.Clamp(delta.magnitude,.001f,a+b-.0001f);
            var direction=delta.normalized;
            var pole=Vector3.ProjectOnPlane(-explorer.Up+explorer.transform.right*(side=="Left"?-.5f:.5f),direction).normalized;
            float along=(a*a-b*b+distance*distance)/(2*distance);
            var target=shoulder.position+direction*along+pole*Mathf.Sqrt(Mathf.Max(0,a*a-along*along));
            Aim(side+"Arm",side+"ForeArm",explorer.transform.InverseTransformDirection(target-shoulder.position),1);
            Aim(side+"ForeArm",side+"Hand",explorer.transform.InverseTransformDirection(grip.position-elbow.position),1);
        }
        public bool HasRequiredBones => bones.ContainsKey("LeftArm") && bones.ContainsKey("LeftLeg") && bones.ContainsKey("LeftFoot");
        public void Configure(PlanetExplorer owner) { explorer = owner; Cache(); }
        void Awake() { Cache(); }
        void Start()
        {
            // FBX renderer bounds include import padding. Ground the evaluated skin,
            // not that padded box, once the initial Animator pose is available.
            var animator=GetComponent<Animator>();animator.Update(0);
            var skin=GetComponentInChildren<SkinnedMeshRenderer>();var baked=new Mesh();skin.BakeMesh(baked,true);
            float foot=float.PositiveInfinity;
            foreach(var vertex in baked.vertices)foot=Mathf.Min(foot,Vector3.Dot(skin.transform.TransformPoint(vertex)-explorer.transform.position,explorer.Up));
            if(!float.IsInfinity(foot))transform.position-=explorer.Up*foot;
            Destroy(baked);
        }
        void Cache()
        {
            bones.Clear();palmAxes.Clear();foreach(var t in GetComponentsInChildren<Transform>())bones[t.name]=t;
            foreach(var side in Sides)
                if(bones.TryGetValue(side+"Hand",out var hand)&&bones.TryGetValue(side+"ForeArm",out var forearm))
                    palmAxes[side]=hand.InverseTransformVector(hand.position-forearm.position).normalized;
        }
        void PlacePalm(string side,float weight)
        {
            if(weight<=0||!palmAxes.TryGetValue(side,out var axis))return;
            var hand=bones[side+"Hand"];
            var toward=explorer.transform.forward*.8f-explorer.transform.up*.45f;
            var delta=Quaternion.FromToRotation(axis,hand.InverseTransformVector(toward));
            hand.localRotation*=Quaternion.Slerp(Quaternion.identity,delta,weight);
        }
        void Aim(string name, string child, Vector3 actorDirection, float weight)
        {
            if (!bones.TryGetValue(name, out var a) || !bones.TryGetValue(child, out var b)) return;
            // A direction relative to the joint preserves the imported limb length.
            // Absolute actor-space heights made short rigs lift elbows to shoulders.
            var target = a.position + explorer.transform.TransformDirection(actorDirection.normalized) * Vector3.Distance(a.position,b.position);
            // FBX conversion can leave a reflected ancestor scale. Solve in the
            // bone's local frame so reflected rigs bend toward the same target.
            var delta = Quaternion.FromToRotation(a.InverseTransformPoint(b.position), a.InverseTransformPoint(target));
            a.localRotation *= Quaternion.Slerp(Quaternion.identity, delta, weight);
        }
        void LateUpdate() { Apply(); }
        public void Apply()
        {
            if (explorer == null) return;
            if(climbing)
            {
                // Alternate reaches keep both hands and feet braced against
                // the wall while the root travels between authored grips.
                float reach=Mathf.Sin(climbPhase*Mathf.PI);
                foreach(var side in Sides)
                {
                    float sign=side=="Left"?-1f:1f;
                    float lift=(sign<0?reach:-reach)*.22f;
                    Aim(side+"Arm",side+"ForeArm",new Vector3(sign*.34f,.94f+lift,.38f),1);
                    Aim(side+"ForeArm",side+"Hand",new Vector3(sign*.08f,.63f,.77f),1);
                    Aim(side+"UpLeg",side+"Leg",new Vector3(sign*.22f,-.70f,.68f),1);
                    Aim(side+"Leg",side+"Foot",new Vector3(0,-.60f,-.80f),1);
                }
                if(contactPose)
                {
                    var actor=explorer.transform;
                    ContactLimb("LeftArm","LeftForeArm","LeftHand",climbLeftHand,-actor.up-actor.right*.5f,handContact);
                    ContactLimb("RightArm","RightForeArm","RightHand",climbRightHand,-actor.up+actor.right*.5f,handContact);
                    ContactLimb("LeftUpLeg","LeftLeg","LeftFoot",climbLeftFoot,actor.forward-actor.right*.45f,footContact);
                    ContactLimb("RightUpLeg","RightLeg","RightFoot",climbRightFoot,actor.forward+actor.right*.45f,rightFootContact);
                    PlacePalm("Left",handContact);PlacePalm("Right",handContact);
                    Aim("LeftFoot","LeftToeBase",new Vector3(0,-.12f,1),footContact);
                    Aim("RightFoot","RightToeBase",new Vector3(0,-.12f,1),rightFootContact);
                }
                return;
            }
            float rest = 1f - Mathf.Clamp01(explorer.Speed / 2f);
            foreach (var side in Sides)
            {
                float sign = side == "Left" ? -1f : 1f;
                Aim(side + "Arm", side + "ForeArm", new Vector3(sign * .16f, -1f, .015f), rest);
                Aim(side + "ForeArm", side + "Hand", new Vector3(sign * .06f, -1f, .12f), rest);
                if (!explorer.Grounded)
                {
                    float tuck = Mathf.SmoothStep(0f,1f,Mathf.InverseLerp(-3f,3f,explorer.VerticalSpeed));
                    float thigh=Mathf.Lerp(10f,35f,tuck)*Mathf.Deg2Rad;
                    float knee=Mathf.Lerp(25f,80f,tuck)*Mathf.Deg2Rad;
                    Aim(side + "UpLeg",side + "Leg",new Vector3(sign*.035f,-Mathf.Cos(thigh),Mathf.Sin(thigh)),1);
                    Aim(side + "Leg",side + "Foot",new Vector3(0,-Mathf.Cos(thigh-knee),Mathf.Sin(thigh-knee)),1);
                    Aim(side + "Arm",side + "ForeArm",new Vector3(sign*.18f,-1f,.15f),1);
                    Aim(side + "ForeArm",side + "Hand",new Vector3(sign*.04f,-.35f,.85f),1);
                }
            }
            if(explorer.Carrying) { CarryArm("Left",leftGrip);CarryArm("Right",rightGrip); }
            else if(waterAiming&&!NotebookUI.BlocksInput)
                ContactLimb("LeftArm","LeftForeArm","LeftHand",waterTarget,-explorer.Up-explorer.transform.right*.5f,1);
        }
    }
}
