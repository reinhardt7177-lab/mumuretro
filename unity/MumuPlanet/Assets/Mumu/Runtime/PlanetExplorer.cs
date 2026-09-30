using UnityEngine;
using UnityEngine.InputSystem;

namespace Mumu.Planet
{
    public sealed class PlanetExplorer : MonoBehaviour
    {
        [SerializeField] PlanetSurface surface;
        [SerializeField] Transform view;
        [SerializeField] Animator animator;
        [SerializeField] Transform flatGround;
        [SerializeField] bool collisionFlatGround;
        public void EnableFlatCollisions(){collisionFlatGround=true;}
        [SerializeField] float walkSpeed = 3.2f, runSpeed = 5.8f, gravity = 18f, jumpSpeed = 6f;
        float height, verticalSpeed, jumpBuffer, coyote;
        Vector3 forward;
        public bool Grounded => height <= .001f;
        public float VerticalSpeed => verticalSpeed;
        public float Speed { get; private set; }
        public Vector3 Up => flatGround!=null?flatGround.up:transform.position.normalized;
        public bool Carrying { get; set; }
        public bool InputLocked { get; set; }
        // Opt-in for the authored mountain; ordinary planet locomotion is unchanged.
        public bool ElevatedTraversal { get; set; }
        public void ConfigureFlat(Transform floor,Transform cameraTransform,Animator body)
        { surface=null;flatGround=floor;view=cameraTransform;animator=body;forward=transform.forward; }
        Vector3 GroundPoint(Vector3 point)=>flatGround!=null?point-flatGround.up*Vector3.Dot(point-flatGround.position,flatGround.up):surface.Point(point);
        public void Configure(PlanetSurface ground, Transform cameraTransform, Animator body)
        { surface = ground; view = cameraTransform; animator = body; forward = transform.forward; }
        void Awake() { forward = transform.forward; }
        void Update()
        {
            var k = Keyboard.current;
            if (k == null || InputLocked || (surface == null&&flatGround==null) || view == null) return;
            var input = new Vector2((k.dKey.isPressed || k.rightArrowKey.isPressed ? 1 : 0) - (k.aKey.isPressed || k.leftArrowKey.isPressed ? 1 : 0),
                (k.wKey.isPressed || k.upArrowKey.isPressed ? 1 : 0) - (k.sKey.isPressed || k.downArrowKey.isPressed ? 1 : 0));
            var cameraForward = Vector3.ProjectOnPlane(view.forward, Up).normalized;
            Step(cameraForward * input.y + Vector3.Cross(Up, cameraForward) * input.x,
                k.leftShiftKey.isPressed, k.spaceKey.wasPressedThisFrame, Mathf.Min(Time.deltaTime, .05f));
        }
        // Input-independent entry point also used by deterministic traversal checks.
        public void Step(Vector3 desired, bool running, bool jump, float dt)
        {
            if(collisionFlatGround&&flatGround!=null){StepFlatCollisions(desired,running,jump,dt);return;}
            if(ElevatedTraversal&&surface!=null){StepElevated(desired,running,jump,dt);return;}
            var up = Up;
            desired = Vector3.ClampMagnitude(Vector3.ProjectOnPlane(desired, up), 1f);
            if (jump&&!Carrying) jumpBuffer = .14f; else jumpBuffer = Mathf.Max(0, jumpBuffer - dt);
            coyote = Grounded ? .1f : Mathf.Max(0, coyote - dt);
            if (jumpBuffer > 0 && coyote > 0) { verticalSpeed = jumpSpeed; jumpBuffer = coyote = 0; }
            verticalSpeed -= gravity * dt;
            height = Mathf.Max(0, height + verticalSpeed * dt);
            if (Grounded) verticalSpeed = 0;
            float speed = Carrying?2.4f:running ? runSpeed : walkSpeed;
            Vector3 displacement = desired * speed * dt;
            Vector3 bottom = transform.position + up * .3f, top = transform.position + up * 1.2f;
            if (displacement.sqrMagnitude > .000001f && Physics.CapsuleCast(bottom, top, .25f, displacement.normalized, out var hit, displacement.magnitude + .035f, 1 << 8, QueryTriggerInteraction.Ignore))
            {
                displacement = SlideAlong(displacement, hit.normal, up);
                if (displacement.sqrMagnitude > .000001f && Physics.CapsuleCast(bottom, top, .25f, displacement.normalized, displacement.magnitude + .035f, 1 << 8, QueryTriggerInteraction.Ignore)) displacement = Vector3.zero;
            }
            var point = GroundPoint(transform.position + displacement);
            transform.position = point + (flatGround!=null?flatGround.up:point.normalized) * height;
            up = Up;
            forward = Vector3.ProjectOnPlane(forward, up).normalized;
            if (desired.sqrMagnitude > .001f) forward = Vector3.Slerp(forward, Vector3.ProjectOnPlane(desired, up).normalized, 1f - Mathf.Exp(-dt * 15f));
            if (forward.sqrMagnitude < .01f) forward = Vector3.Cross(up, Vector3.right).normalized;
            transform.rotation = Quaternion.LookRotation(forward, up);
            Speed = displacement.magnitude / Mathf.Max(dt, .0001f);
            if (animator != null) animator.SetFloat("Speed", Grounded ? Speed : 0f, .10f, dt);
        }
        // Slide along a wall inside the ground plane. The wall normal is flattened onto the ground plane first.
        // Projecting onto the wall plane itself kept a component along the wall's own vertical; on the curved
        // planet a building's walls lean up to ~6 degrees from local up, and the radial ground snap turned that
        // component into a steady creep toward the wall (about 0.4mm per frame 6m from the building centre).
        // Once the capsule touched the wall, casts ignored it and the player walked through (2026-09-30).
        static Vector3 SlideAlong(Vector3 displacement,Vector3 wallNormal,Vector3 up)
        {
            var normal=Vector3.ProjectOnPlane(wallNormal,up);
            if(normal.sqrMagnitude<1e-6f)return displacement;
            normal.Normalize();
            float into=Vector3.Dot(displacement,normal);
            return into<0?displacement-normal*into:displacement;
        }
        void StepElevated(Vector3 desired,bool running,bool jump,float dt)
        {
            var up=Up;
            desired=Vector3.ClampMagnitude(Vector3.ProjectOnPlane(desired,up),1f);
            if(jump&&!Carrying)jumpBuffer=.14f;else jumpBuffer=Mathf.Max(0,jumpBuffer-dt);
            coyote=Grounded ? .1f : Mathf.Max(0,coyote-dt);
            if(jumpBuffer>0&&coyote>0){verticalSpeed=jumpSpeed;jumpBuffer=coyote=0;}
            verticalSpeed-=gravity*dt;
            float speed=Carrying?2.4f:running?runSpeed:walkSpeed;
            Vector3 displacement=desired*speed*dt;
            Vector3 bottom=transform.position+up*.3f,top=transform.position+up*1.2f;
            if(displacement.sqrMagnitude>.000001f&&Physics.CapsuleCast(bottom,top,.25f,displacement.normalized,out var hit,displacement.magnitude+.035f,1<<8,QueryTriggerInteraction.Ignore)
                &&Vector3.Dot(hit.normal,up)<.55f
                &&Physics.CapsuleCast(bottom+up*.32f,top+up*.32f,.25f,displacement.normalized,displacement.magnitude+.035f,1<<8,QueryTriggerInteraction.Ignore))
            {
                displacement=SlideAlong(displacement,hit.normal,up);
                if(displacement.sqrMagnitude>.000001f&&Physics.CapsuleCast(bottom,top,.25f,displacement.normalized,displacement.magnitude+.035f,1<<8,QueryTriggerInteraction.Ignore))displacement=Vector3.zero;
            }
            float reachable=transform.position.magnitude+.4f;
            var oldGround=surface.PointBelow(transform.position,reachable);
            var nextGround=surface.PointBelow(transform.position+displacement,reachable);
            var next=transform.position+displacement+up*verticalSpeed*dt;
            // A high ledge must be reached by a jump or climb interaction, never by radial snapping.
            if(nextGround.magnitude-oldGround.magnitude>.32f&&next.magnitude<nextGround.magnitude-.02f)
            {
                displacement=Vector3.zero;nextGround=oldGround;next=transform.position+up*verticalSpeed*dt;
            }
            float gap=next.magnitude-nextGround.magnitude;
            if(gap<=.10f&&verticalSpeed<=0)
            {transform.position=nextGround;height=0;verticalSpeed=0;}
            else
            {transform.position=next;height=Mathf.Max(.001f,gap);}
            up=Up;forward=Vector3.ProjectOnPlane(forward,up).normalized;
            if(desired.sqrMagnitude>.001f)forward=Vector3.Slerp(forward,Vector3.ProjectOnPlane(desired,up).normalized,1f-Mathf.Exp(-dt*15));
            if(forward.sqrMagnitude<.01f)forward=Vector3.Cross(up,Vector3.right).normalized;
            transform.rotation=Quaternion.LookRotation(forward,up);
            Speed=displacement.magnitude/Mathf.Max(dt,.0001f);
            if(animator!=null)animator.SetFloat("Speed",Grounded?Speed:0f,.10f,dt);
        }
        void StepFlatCollisions(Vector3 desired,bool running,bool jump,float dt)
        {
            var up=Up;
            desired=Vector3.ClampMagnitude(Vector3.ProjectOnPlane(desired,up),1);
            if(jump&&!Carrying)jumpBuffer=.14f;else jumpBuffer=Mathf.Max(0,jumpBuffer-dt);
            coyote=Grounded?.1f:Mathf.Max(0,coyote-dt);
            if(jumpBuffer>0&&coyote>0){verticalSpeed=jumpSpeed;jumpBuffer=coyote=0;}
            verticalSpeed-=gravity*dt;
            var displacement=desired*(Carrying?2.4f:running?runSpeed:walkSpeed)*dt;
            var bottom=transform.position+up*.3f;var top=transform.position+up*1.2f;
            if(displacement.sqrMagnitude>.000001f&&Physics.CapsuleCast(bottom,top,.25f,displacement.normalized,out var wall,displacement.magnitude+.035f,1<<8,QueryTriggerInteraction.Ignore))
            {
                displacement=Vector3.ProjectOnPlane(displacement,wall.normal);
                if(displacement.sqrMagnitude>.000001f&&Physics.CapsuleCast(bottom,top,.25f,displacement.normalized,displacement.magnitude+.035f,1<<8,QueryTriggerInteraction.Ignore))displacement=Vector3.zero;
            }
            var horizontal=transform.position+displacement;
            var next=horizontal+up*verticalSpeed*dt;
            // Only authored support colliders count: no invisible datum beneath a gap.
            float descent=Mathf.Max(0,-verticalSpeed*dt);
            bool support=Physics.Raycast(horizontal+up*.20f,-up,out var floor,.22f+descent,1<<9,QueryTriggerInteraction.Ignore)&&Vector3.Dot(floor.normal,up)>.65f;
            if(verticalSpeed<=0&&support&&Vector3.Dot(next-floor.point,up)<=.025f)
            {next=floor.point;verticalSpeed=0;height=0;}
            else height=Mathf.Max(.001f,height+verticalSpeed*dt);
            transform.position=next;
            forward=Vector3.ProjectOnPlane(forward,up).normalized;
            if(desired.sqrMagnitude>.001f)forward=Vector3.Slerp(forward,desired.normalized,1-Mathf.Exp(-dt*15));
            transform.rotation=Quaternion.LookRotation(forward,up);
            Speed=displacement.magnitude/Mathf.Max(.0001f,dt);
            if(animator!=null)animator.SetFloat("Speed",Grounded?Speed:0,.10f,dt);
        }
        public void Respawn(Vector3 point, Vector3 heading)
        {
            height = verticalSpeed = jumpBuffer = coyote = 0;
            transform.position = GroundPoint(point);
            forward = Vector3.ProjectOnPlane(heading, Up).normalized;
            transform.rotation = Quaternion.LookRotation(forward, Up);
        }
    }
}
