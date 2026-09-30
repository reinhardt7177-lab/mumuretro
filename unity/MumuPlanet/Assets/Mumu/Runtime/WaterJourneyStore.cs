using System;
using System.IO;
using System.Text;
using UnityEngine;

namespace Mumu.Planet
{
    [Serializable] public sealed class WaterTargetRecord
    {
        public string id;
        public float ice,liquid,vapour,cold;
    }
    [Serializable] public sealed class WaterJourneyRecord
    {
        public int version;
        public int room;
        public bool acquired,bridge,door,gallery,toBoiler,valve,finished;
        public float rail=-2.5f;
        public WaterTargetRecord[] water;
        public bool HasWater=>water!=null&&water.Length>0;
    }
    // A distinct file keeps the existing world and weight-temple records unchanged.
    public sealed class WaterJourneyStore
    {
        readonly string path;
        bool protectedFile;
        public string Problem {get;private set;}
        public WaterJourneyRecord Current {get;private set;}
        public WaterJourneyStore(string file)
        {
            path=file;
            if(!File.Exists(path))return;
            try
            {
                var r=JsonUtility.FromJson<WaterJourneyRecord>(File.ReadAllText(path));
                if(!Valid(r))throw new InvalidDataException("물의 신전 기록을 읽을 수 없습니다. 원본을 보존합니다.");
                Current=r;
            }
            catch(Exception e){protectedFile=true;Problem=e.Message;}
        }
        static bool Number(float v,float max)=>!float.IsNaN(v)&&!float.IsInfinity(v)&&v>=0&&v<=max;
        public static bool Valid(WaterJourneyRecord r)
        {
            if(r==null||r.version!=1||r.room<0||r.room>2||!Number(r.rail+3,5)||r.finished&&r.room!=2)return false;
            if(r.room>0&&!r.acquired)return false;
            if(!r.HasWater)return !r.finished&&!r.bridge&&!r.door&&!r.gallery&&!r.valve&&!r.toBoiler;
            int count=r.room==0?3:r.room==1?4:6;
            if(r.water.Length!=count)return false;
            float sum=0;
            var ids=new System.Collections.Generic.HashSet<string>();
            foreach(var t in r.water)
            {
                if(t==null||string.IsNullOrEmpty(t.id)||!ids.Add(t.id)||!Number(t.ice,6)||!Number(t.liquid,6)||!Number(t.vapour,6)||!Number(t.cold,1))return false;
                sum+=t.ice+t.liquid+t.vapour;
            }
            return Mathf.Abs(sum-(r.room==2?6:4))<.01f;
        }
        public void Protect(string reason){protectedFile=true;Problem=reason;}
        public bool Save(WaterJourneyRecord r)
        {
            if(protectedFile||!Valid(r))return false;
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(path)));
                var temp=path+".tmp";
                File.WriteAllText(temp,JsonUtility.ToJson(r,true),new UTF8Encoding(false));
                if(File.Exists(path))File.Replace(temp,path,path+".bak");else File.Move(temp,path);
                Current=r;Problem=null;return true;
            }
            catch(Exception e){Problem=e.Message;return false;}
        }
    }
}
