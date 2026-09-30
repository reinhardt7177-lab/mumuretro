using UnityEngine;

namespace Mumu.Planet
{
    public enum WaterIceStep { Acquire, Melt, Fill, Freeze, Cross, Recover, WaitRecovery, Open, Opening, Exit, Complete }
    public sealed class WaterIceGuide : MonoBehaviour
    {
        public WaterIceRoom room;
        public LineRenderer marker;
        readonly Vector3[] points=new Vector3[48];
        public void Refresh()
        {
            if(!room||!marker)return;
            var step=room.CurrentStep;
            marker.enabled=!NotebookUI.BlocksInput&&step!=WaterIceStep.Complete&&step!=WaterIceStep.Opening;
            if(!marker.enabled)return;
            Vector3 center=room.GuidePosition;
            float radius=step==WaterIceStep.Freeze?.85f:.62f;
            radius+=Mathf.Sin(Time.time*2)*.025f;
            for(int i=0;i<points.Length;i++)
            {float a=i*Mathf.PI*2/points.Length;points[i]=center+new Vector3(Mathf.Cos(a)*radius,0,Mathf.Sin(a)*radius);}
            marker.SetPositions(points);
        }
        void LateUpdate(){Refresh();}
    }
}
