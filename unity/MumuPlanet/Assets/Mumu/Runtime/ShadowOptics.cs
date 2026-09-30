using System.Collections.Generic;
using UnityEngine;

namespace Mumu.Planet
{
    // Shared optics for the shadow temple. Plane points are Vector2(x, z): world x right, world z forward.
    // The drawn target outlines and every judgement use these functions; the engine draws the real shadows
    // from the same caster geometry, and ShadowTempleSmoke compares the two pixel by pixel.
    public static class ShadowOptics
    {
        [System.Serializable]
        public struct Area
        {
            public float x0,x1,z0,z1;
            public Area(float x0,float x1,float z0,float z1){this.x0=x0;this.x1=x1;this.z0=z0;this.z1=z1;}
            public bool Contains(Vector2 p,float margin=0)=>p.x>=x0-margin&&p.x<=x1+margin&&p.y>=z0-margin&&p.y<=z1+margin;
        }
        public static Vector2 Flat(Vector3 p)=>new Vector2(p.x,p.z);
        public static float Cross(Vector2 a,Vector2 b,Vector2 c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);

        // Andrew monotone chain. Counter-clockwise in the (x, z) plane; collinear points removed.
        public static List<Vector2> Hull(List<Vector2> input)
        {
            var pts=new List<Vector2>(input);
            pts.Sort((a,b)=>a.x!=b.x?a.x.CompareTo(b.x):a.y.CompareTo(b.y));
            if(pts.Count<3)return pts;
            var hull=new List<Vector2>(pts.Count*2);
            foreach(var p in pts){while(hull.Count>=2&&Cross(hull[hull.Count-2],hull[hull.Count-1],p)<=1e-9f)hull.RemoveAt(hull.Count-1);hull.Add(p);}
            int lower=hull.Count+1;
            for(int i=pts.Count-2;i>=0;i--){var p=pts[i];while(hull.Count>=lower&&Cross(hull[hull.Count-2],hull[hull.Count-1],p)<=1e-9f)hull.RemoveAt(hull.Count-1);hull.Add(p);}
            hull.RemoveAt(hull.Count-1);return hull;
        }
        // Sutherland-Hodgman against one axis-aligned half plane: keeps sign*(coordinate-edge) >= 0.
        public static List<Vector2> Clip(List<Vector2> poly,bool xAxis,float edge,float sign)
        {
            var result=new List<Vector2>(poly.Count+2);
            for(int i=0;i<poly.Count;i++)
            {
                var a=poly[i];var b=poly[(i+1)%poly.Count];
                float da=sign*((xAxis?a.x:a.y)-edge),db=sign*((xAxis?b.x:b.y)-edge);
                if(da>=0)result.Add(a);
                if(da>=0!=db>=0){float t=da/(da-db);result.Add(a+(b-a)*t);}
            }
            return result;
        }
        public static List<Vector2> Clip(List<Vector2> poly,Area area)
        {
            poly=Clip(poly,true,area.x0,1);if(poly.Count<3)return poly;
            poly=Clip(poly,true,area.x1,-1);if(poly.Count<3)return poly;
            poly=Clip(poly,false,area.z0,1);if(poly.Count<3)return poly;
            return Clip(poly,false,area.z1,-1);
        }
        public static bool Inside(List<Vector2> poly,Vector2 p)
        {
            if(poly==null||poly.Count<3)return false;
            for(int i=0;i<poly.Count;i++)if(Cross(poly[i],poly[(i+1)%poly.Count],p)< -1e-6f)return false;
            return true;
        }
        public static bool InsideAny(List<List<Vector2>> polys,Vector2 p)
        {
            foreach(var poly in polys)if(Inside(poly,p))return true;
            return false;
        }
        public static float Area2(List<Vector2> poly)
        {
            float a=0;for(int i=0;i<poly.Count;i++){var p=poly[i];var q=poly[(i+1)%poly.Count];a+=p.x*q.y-q.x*p.y;}return a*.5f;
        }
        // Distance from p to the nearest polygon edge (used to separate penumbra pixels in the agreement test).
        public static float EdgeDistance(List<List<Vector2>> polys,Vector2 p)
        {
            float best=float.MaxValue;
            foreach(var poly in polys)for(int i=0;i<poly.Count;i++)best=Mathf.Min(best,SegmentDistance(p,poly[i],poly[(i+1)%poly.Count]));
            return best;
        }
        public static float SegmentDistance(Vector2 p,Vector2 a,Vector2 b)
        {
            var d=b-a;float t=d.sqrMagnitude<1e-12f?0:Mathf.Clamp01(Vector2.Dot(p-a,d)/d.sqrMagnitude);return Vector2.Distance(p,a+d*t);
        }

        // Point light above a convex solid: the ground shadow is the hull of the base and the projected top.
        // Vertex i of the n-gon sits at angle i*2pi/n measured from +Z toward +X, as the Blender pillar.
        public static List<Vector2> PrismShadow(Vector2 centre,float radius,float height,int sides,Vector3 lamp,Area clip)
        {
            var points=new List<Vector2>(sides*2);
            float factor=lamp.y/Mathf.Max(.001f,lamp.y-height);
            var l=Flat(lamp);
            for(int i=0;i<sides;i++)
            {
                float a=i*Mathf.PI*2/sides;
                var p=centre+new Vector2(Mathf.Sin(a),Mathf.Cos(a))*radius;
                points.Add(p);points.Add(l+(p-l)*factor);
            }
            var poly=Hull(points);
            return Clip(poly,clip);
        }
        // Convex caster parts (world vertices) projected from a point light onto y = 0.
        public static List<List<Vector2>> ProjectParts(IList<Vector3[]> parts,Vector3 lamp,Area clip)
        {
            var result=new List<List<Vector2>>();
            var l=Flat(lamp);
            foreach(var part in parts)
            {
                var pts=new List<Vector2>(part.Length);
                foreach(var v in part)
                {
                    float f=lamp.y/Mathf.Max(.001f,lamp.y-v.y);
                    pts.Add(l+(Flat(v)-l)*f);
                }
                var poly=Clip(Hull(pts),clip);
                if(poly.Count>=3&&Mathf.Abs(Area2(poly))>1e-6f)result.Add(poly);
            }
            return result;
        }
        // Outer outline of a union of convex polygons: edges split at every crossing, a piece is kept when
        // the point just outside it (right side of a counter-clockwise edge) is not covered by any polygon.
        public static List<Vector2> Boundary(List<List<Vector2>> polys)
        {
            var segments=new List<Vector2>();
            for(int pi=0;pi<polys.Count;pi++)
            {
                var poly=polys[pi];
                for(int i=0;i<poly.Count;i++)
                {
                    var a=poly[i];var b=poly[(i+1)%poly.Count];var d=b-a;
                    if(d.sqrMagnitude<1e-10f)continue;
                    var cuts=new List<float>{0,1};
                    for(int qi=0;qi<polys.Count;qi++)
                    {
                        if(qi==pi)continue;var q=polys[qi];
                        for(int j=0;j<q.Count;j++)if(Intersect(a,b,q[j],q[(j+1)%q.Count],out float t))cuts.Add(t);
                    }
                    cuts.Sort();
                    var normal=new Vector2(d.y,-d.x).normalized;
                    for(int k=0;k+1<cuts.Count;k++)
                    {
                        if(cuts[k+1]-cuts[k]<1e-5f)continue;
                        var p0=a+d*cuts[k];var p1=a+d*cuts[k+1];var probe=(p0+p1)*.5f+normal*1e-3f;
                        bool covered=false;
                        for(int qi=0;qi<polys.Count&&!covered;qi++)if(qi!=pi&&Inside(polys[qi],probe))covered=true;
                        if(!covered){segments.Add(p0);segments.Add(p1);}
                    }
                }
            }
            return segments;
        }
        static bool Intersect(Vector2 a,Vector2 b,Vector2 c,Vector2 d,out float t)
        {
            t=0;var r=b-a;var s=d-c;float den=r.x*s.y-r.y*s.x;
            if(Mathf.Abs(den)<1e-9f)return false;
            var ac=c-a;t=(ac.x*s.y-ac.y*s.x)/den;float u=(ac.x*r.y-ac.y*r.x)/den;
            return t>1e-5f&&t<1-1e-5f&&u>=-1e-5f&&u<=1+1e-5f;
        }

        // ---- Mirrors: 2D reflection in the (x, z) plane at beam height. ----
        public struct Mirror {public Vector2 centre;public float angle;public float half;public bool active;}
        public struct Target {public Vector2 centre;public float radius;public bool active;}
        public enum End {Wall,Mirror,Target}
        public struct Segment {public Vector2 a,b;public End end;public int index;}
        public static Vector2 Tangent(float angle)=>new Vector2(Mathf.Cos(angle),Mathf.Sin(angle));
        public static Vector2 Normal(float angle)=>new Vector2(-Mathf.Sin(angle),Mathf.Cos(angle));
        public static Vector2 Reflect(Vector2 d,Vector2 n)=>d-2*Vector2.Dot(d,n)*n;
        // Returns the index of the target that receives the beam, or -1. Segments are appended in order.
        public static int Trace(Vector2 origin,Vector2 direction,IList<Mirror> mirrors,IList<Target> targets,Area walls,int maxBounces,List<Segment> segments)
        {
            segments?.Clear();
            var p=origin;var d=direction.normalized;int skip=-1;
            for(int bounce=0;bounce<=maxBounces;bounce++)
            {
                float wall=float.MaxValue;
                if(d.x>1e-7f)wall=Mathf.Min(wall,(walls.x1-p.x)/d.x);else if(d.x< -1e-7f)wall=Mathf.Min(wall,(walls.x0-p.x)/d.x);
                if(d.y>1e-7f)wall=Mathf.Min(wall,(walls.z1-p.y)/d.y);else if(d.y< -1e-7f)wall=Mathf.Min(wall,(walls.z0-p.y)/d.y);
                float distance=Mathf.Max(0,wall);int hitMirror=-1;
                for(int i=0;i<mirrors.Count;i++)
                {
                    var m=mirrors[i];if(!m.active||i==skip)continue;
                    var n=Normal(m.angle);float den=Vector2.Dot(d,n);if(Mathf.Abs(den)<1e-6f)continue;
                    float t=Vector2.Dot(m.centre-p,n)/den;if(t<=1e-4f||t>=distance)continue;
                    var h=p+d*t;if(Mathf.Abs(Vector2.Dot(h-m.centre,Tangent(m.angle)))>m.half+1e-6f)continue;
                    distance=t;hitMirror=i;
                }
                for(int i=0;i<targets.Count;i++)
                {
                    var target=targets[i];if(!target.active)continue;
                    var v=target.centre-p;float proj=Vector2.Dot(v,d);
                    if(proj>1e-6f&&proj<distance&&Mathf.Abs(v.x*d.y-v.y*d.x)<target.radius)
                    {segments?.Add(new Segment{a=p,b=p+d*proj,end=End.Target,index=i});return i;}
                }
                var end=p+d*distance;
                segments?.Add(new Segment{a=p,b=end,end=hitMirror>=0?End.Mirror:End.Wall,index=hitMirror});
                if(hitMirror<0)return -1;
                d=Reflect(d,Normal(mirrors[hitMirror].angle)).normalized;p=end;skip=hitMirror;
            }
            return -1;
        }

        // ---- Silhouette: a flat square panel between a point lamp and a parallel screen. ----
        public static float ShadowWidth(float panel,float lampZ,float panelZ,float screenZ)=>panel*(screenZ-lampZ)/Mathf.Max(.4f,panelZ-lampZ);
    }
}
