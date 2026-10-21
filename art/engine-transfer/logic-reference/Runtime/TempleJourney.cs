using System;
using System.IO;
using System.Text;
using UnityEngine;

namespace Mumu.Planet
{
    [Serializable]
    public sealed class TempleJourneyRecord
    {
        public int version=1;
        public bool active=true;
        public string scene;
        public int count;
        public int pivot;
        public int[] locations;
        public float[] floorX;
        public float[] floorZ;
    }

    // Independent of the permanent completion seal. An invalid or newer file is never overwritten.
    public sealed class TempleJourneyStore
    {
        readonly string path;
        bool preserveUnreadable;
        public string Problem {get;private set;}
        public TempleJourneyRecord Current {get;private set;}
        public TempleJourneyStore(string file)
        {
            path=file;
            if(!File.Exists(path))return;
            try
            {
                var record=JsonUtility.FromJson<TempleJourneyRecord>(File.ReadAllText(path));
                if(!Valid(record))throw new InvalidDataException("Unsupported or invalid temple journey record.");
                Current=record;
            }
            catch(Exception e){preserveUnreadable=true;Problem=e.Message;}
        }
        public static bool Valid(TempleJourneyRecord r)
        {
            if(r==null||r.version!=1)return false;
            if(!r.active)return true;
            int size=r.scene=="WeightTemple"?r.count:r.scene=="TwinBalanceTemple"?4:r.scene=="LeverBalanceTemple"?2:0;
            if(size==0||r.scene=="WeightTemple"&&(r.count<3||r.count>5)||r.scene=="LeverBalanceTemple"&&(r.pivot<1||r.pivot>5))return false;
            if(r.locations==null||r.locations.Length!=size||r.floorX==null||r.floorX.Length!=size||r.floorZ==null||r.floorZ.Length!=size)return false;
            var seen=new bool[7];
            for(int i=0;i<size;i++)
            {
                int slot=r.locations[i];int limit=r.scene=="WeightTemple"?7:r.scene=="LeverBalanceTemple"?6:4;
                if(slot< -1||slot>=limit||r.scene=="WeightTemple"&&slot>=r.count&&slot<5||slot>=0&&seen[slot])return false;
                if(slot>=0)seen[slot]=true;
                if(float.IsNaN(r.floorX[i])||float.IsInfinity(r.floorX[i])||Mathf.Abs(r.floorX[i])>7||float.IsNaN(r.floorZ[i])||float.IsInfinity(r.floorZ[i])||r.floorZ[i]< -8||r.floorZ[i]>8)return false;
            }
            return true;
        }
        public bool Save(TempleJourneyRecord record)
        {
            if(preserveUnreadable||!Valid(record))return false;
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(path)));
                string temporary=path+".tmp";
                File.WriteAllText(temporary,JsonUtility.ToJson(record,true),new UTF8Encoding(false));
                if(File.Exists(path))File.Replace(temporary,path,path+".bak");else File.Move(temporary,path);
                Current=record;Problem=null;return true;
            }
            catch(Exception e){Problem=e.Message;return false;}
        }
        public bool Finish()
        {
            if(Current==null||!Current.active)return true;
            var done=new TempleJourneyRecord{active=false};return Save(done);
        }
    }

    public static class TempleJourney
    {
        static TempleJourneyStore current;
        public static string SavePath
        {
            get
            {
                var args=Environment.GetCommandLineArgs();
                int index=Array.IndexOf(args,"-mumu-journey-file");
                if(index>=0&&index+1<args.Length)return Path.GetFullPath(args[index+1]);
                // Existing isolated temple validators must never write the real student's journey.
                index=Array.IndexOf(args,"-mumu-progress-file");
                if(index>=0&&index+1<args.Length)return Path.GetFullPath(args[index+1])+".journey.json";
                return Path.Combine(Application.persistentDataPath,"temple-journey-v1.json");
            }
        }
        public static TempleJourneyStore Current=>current??(current=new TempleJourneyStore(SavePath));
        public static string ResumeScene=>TempleProgress.Current.Completed?null:Current.Current!=null&&Current.Current.active?Current.Current.scene:null;
        public static TempleJourneyRecord For(string scene)=>ResumeScene==scene?Current.Current:null;
        public static bool Save(string scene,int count,int pivot,int[] locations,Vector3[] floors)
        {
            var record=new TempleJourneyRecord{scene=scene,count=count,pivot=pivot,locations=(int[])locations.Clone(),floorX=new float[floors.Length],floorZ=new float[floors.Length]};
            for(int i=0;i<floors.Length;i++){record.floorX[i]=floors[i].x;record.floorZ[i]=floors[i].z;}
            return Current.Save(record);
        }
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        static void ResetRuntime(){current=null;}
    }
}
