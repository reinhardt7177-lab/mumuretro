using UnityEngine;
using System.Collections.Generic;

namespace Mumu.Planet
{
    public sealed class PlanetSurface : MonoBehaviour
    {
        [SerializeField] MeshCollider terrain;
        [SerializeField] MeshCollider grass;
        [SerializeField] MeshCollider[] elevated=new MeshCollider[0];
        // Read-only view for validation: every walkable surface above the terrain and grass carpet.
        public System.Collections.Generic.IReadOnlyList<MeshCollider> Elevated=>elevated;
        public void Configure(MeshCollider ground, MeshCollider carpet) { terrain = ground; grass = carpet; }
        public void AddElevated(MeshCollider platform)
        {
            if(platform==null)return;
            foreach(var existing in elevated)if(existing==platform)return;
            var next=new List<MeshCollider>();
            foreach(var existing in elevated)if(existing!=null)next.Add(existing);
            next.Add(platform);elevated=next.ToArray();
        }
        public void RemoveElevated(MeshCollider platform)
        {
            var next=new List<MeshCollider>();
            foreach(var existing in elevated)
                if(existing!=null&&existing!=platform)next.Add(existing);
            elevated=next.ToArray();
        }
        public Vector3 Point(Vector3 direction)
        {
            direction.Normalize();
            var ray = new Ray(direction * 110f, -direction);
            float radius = 68f;
            if (terrain.Raycast(ray, out var a, 70f)) radius = a.point.magnitude;
            if (grass.Raycast(ray, out var b, 70f)) radius = Mathf.Max(radius, b.point.magnitude);
            foreach(var platform in elevated)
                if(platform!=null&&platform.Raycast(ray,out var hit,70f))radius=Mathf.Max(radius,hit.point.magnitude);
            return direction * radius;
        }
        // Authoring ground datum excludes buildings and traversal platforms.
        public Vector3 TerrainPoint(Vector3 direction)
        {
            direction.Normalize();var ray=new Ray(direction*110f,-direction);float radius=68f;
            if(terrain.Raycast(ray,out var a,70f))radius=a.point.magnitude;
            if(grass.Raycast(ray,out var b,70f))radius=Mathf.Max(radius,b.point.magnitude);
            return direction*radius;
        }
        public bool RaycastTerrain(Ray ray,out RaycastHit hit,float distance)
        {
            bool found=terrain.Raycast(ray,out hit,distance);
            if(grass.Raycast(ray,out var other,distance)&&(!found||other.distance<hit.distance))
            {hit=other;found=true;}
            return found;
        }
        // During elevated traversal, ignore ledges above the actor's reachable foot height.
        public Vector3 PointBelow(Vector3 direction,float ceilingRadius)
        {
            direction.Normalize();var ray=new Ray(direction*ceilingRadius,-direction);
            float radius=40f;float length=Mathf.Max(1,ceilingRadius-40f);
            if(terrain.Raycast(ray,out var a,length))radius=Mathf.Max(radius,a.point.magnitude);
            if(grass.Raycast(ray,out var b,length))radius=Mathf.Max(radius,b.point.magnitude);
            foreach(var platform in elevated)
                if(platform!=null&&platform.Raycast(ray,out var hit,length))radius=Mathf.Max(radius,hit.point.magnitude);
            return direction*radius;
        }
    }
}
