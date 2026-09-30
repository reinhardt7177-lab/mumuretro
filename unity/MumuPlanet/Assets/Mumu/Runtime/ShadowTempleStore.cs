using System;
using System.IO;
using System.Text;
using UnityEngine;

namespace Mumu.Planet
{
    // Progress inside the shadow temple. Layouts come from the seed; only mutable state is stored.
    [Serializable]
    public sealed class ShadowTempleRecord
    {
        public int version=1;
        public bool active=true;
        public int seed;
        // Rooms solved so far: 0 = shade walk open, 1 = mirrors open, 2 = silhouette open, 3 = sanctum open, 4 = sanctum solved.
        public int stage;
        public float x,z=-11.5f,yaw;
        public bool greeted,sanctumGreeted;
        public float lampPhase=Mathf.PI*.5f;
        public int shadeFails;
        public int[] mirrors={2,2,2,2};
        public int cart;
        public bool firstLock;
        public int round;
        public float panelZ=42.6f,lampZ=38.2f;
        public int direction,height;
        public bool orbRevealed,orbTaken;
        public int[] hintLevel=new int[4];
        public float[] hintTime=new float[4];

        static bool Finite(float v)=>!float.IsNaN(v)&&!float.IsInfinity(v);
        // Shape and range checks only. Seed-dependent consistency is checked by ShadowTemple before applying.
        public static bool Valid(ShadowTempleRecord r,out string problem)
        {
            problem=null;
            if(r==null){problem="empty record";return false;}
            if(r.version!=1){problem="unsupported version "+r.version;return false;}
            if(r.stage<0||r.stage>4){problem="stage out of range";return false;}
            if(!Finite(r.x)||!Finite(r.z)||!Finite(r.yaw)||Mathf.Abs(r.x)>12||r.z< -16||r.z>72){problem="checkpoint out of the temple";return false;}
            if(!Finite(r.lampPhase)||r.lampPhase<0||r.lampPhase>1e6f||r.shadeFails<0||r.shadeFails>9999){problem="shade walk state";return false;}
            if(r.mirrors==null||r.mirrors.Length!=4){problem="mirror count";return false;}
            foreach(int k in r.mirrors)if(k<0||k>7){problem="mirror step";return false;}
            if(r.cart<0||r.cart>4){problem="cart stop";return false;}
            if(r.round<0||r.round>3||!Finite(r.panelZ)||!Finite(r.lampZ)||r.panelZ<SilhouetteRoom.PanelMin-1e-3f||r.panelZ>SilhouetteRoom.PanelMax+1e-3f||
                r.lampZ<SilhouetteRoom.LampMin-1e-3f||r.lampZ>r.panelZ-SilhouetteRoom.Gap+1e-3f){problem="silhouette state";return false;}
            if(r.direction<0||r.direction>7||r.height<0||r.height>2){problem="sanctum state";return false;}
            if(r.orbTaken&&!r.orbRevealed||r.orbRevealed&&r.stage!=4){problem="orb state";return false;}
            if(r.hintLevel==null||r.hintTime==null||r.hintLevel.Length!=4||r.hintTime.Length!=4){problem="hint arrays";return false;}
            for(int i=0;i<4;i++)if(r.hintLevel[i]<0||r.hintLevel[i]>3||!Finite(r.hintTime[i])||r.hintTime[i]<0){problem="hint state";return false;}
            if(r.stage<1&&r.firstLock){problem="mirror lock before the mirror room";return false;}
            if(r.stage>=3&&r.round!=3||r.stage<2&&r.round!=0){problem="silhouette round does not match the stage";return false;}
            return true;
        }
        public ShadowTempleRecord Copy()=>JsonUtility.FromJson<ShadowTempleRecord>(JsonUtility.ToJson(this));
    }

    public sealed class ShadowTempleStore
    {
        readonly string path;
        bool protectedFile;
        public ShadowTempleRecord Current {get;private set;}
        public string Problem {get;private set;}
        public bool Protected=>protectedFile;
        public string FilePath=>path;
        public ShadowTempleStore(string file)
        {
            path=file;
            if(!File.Exists(path))return;
            try
            {
                var record=JsonUtility.FromJson<ShadowTempleRecord>(File.ReadAllText(path));
                if(!ShadowTempleRecord.Valid(record,out string reason))throw new InvalidDataException(reason);
                Current=record;
            }
            catch(Exception e){protectedFile=true;Problem="Shadow temple record kept unchanged: "+e.Message;}
        }
        // A valid but incompatible file (for example another seed layout mismatch) is preserved read-only.
        public void Protect(string reason){protectedFile=true;Problem=reason;Current=null;}
        public bool Save(ShadowTempleRecord record)
        {
            if(protectedFile)return false;
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(path)));
                string temporary=path+".tmp";
                File.WriteAllText(temporary,JsonUtility.ToJson(record,true),new UTF8Encoding(false));
                if(File.Exists(path))File.Replace(temporary,path,path+".bak");else File.Move(temporary,path);
                Current=record.Copy();Problem=null;return true;
            }
            catch(Exception e){Problem=e.Message;return false;}
        }
    }

    public static class ShadowTempleProgress
    {
        static ShadowTempleStore current;
        public static string SavePath
        {
            get
            {
                var args=Environment.GetCommandLineArgs();int index=Array.IndexOf(args,"-mumu-shadow-journey-file");
                if(index>=0&&index+1<args.Length)return Path.GetFullPath(args[index+1]);
                index=Array.IndexOf(args,"-mumu-progress-file");
                if(index>=0&&index+1<args.Length)return Path.GetFullPath(args[index+1])+".shadow-journey.json";
                return Path.Combine(Application.persistentDataPath,"shadow-temple-journey-v1.json");
            }
        }
        public static ShadowTempleStore Current=>current??(current=new ShadowTempleStore(SavePath));
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        static void ResetRuntime(){current=null;}
    }

    // Planet-side record: first visit and permanent completion (the moon gate is sealed afterwards).
    public sealed class ShadowApproachStore
    {
        [Serializable] sealed class Record {public int version=1;public bool entranceOpen,completed;}
        readonly string path;
        bool preserveUnreadable;
        public bool EntranceOpen {get;private set;}
        public bool Completed {get;private set;}
        public bool Saved {get;private set;}
        public string Problem {get;private set;}
        public ShadowApproachStore(string file)
        {
            path=file;
            if(!File.Exists(path))return;
            try
            {
                var record=JsonUtility.FromJson<Record>(File.ReadAllText(path));
                if(record==null||record.version!=1||record.completed&&!record.entranceOpen)
                    throw new InvalidDataException("Unsupported shadow entrance record.");
                EntranceOpen=record.entranceOpen;Completed=record.completed;Saved=record.completed;
            }
            catch(Exception e){preserveUnreadable=true;Problem=e.Message;}
        }
        public bool Open()
        {
            if(EntranceOpen)return true;
            if(preserveUnreadable)return false;
            return Write(true,Completed);
        }
        public bool Complete()
        {
            if(Completed&&Saved)return true;
            EntranceOpen=true;Completed=true;Saved=false;
            if(preserveUnreadable)return false;
            return Write(true,true);
        }
        bool Write(bool entranceOpen,bool completed)
        {
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(path)));
                string temporary=path+".tmp";
                File.WriteAllText(temporary,JsonUtility.ToJson(new Record{entranceOpen=entranceOpen,completed=completed},true),new UTF8Encoding(false));
                if(File.Exists(path))File.Replace(temporary,path,path+".bak");else File.Move(temporary,path);
                EntranceOpen=entranceOpen;Completed=completed;Saved=completed;Problem=null;return true;
            }
            catch(Exception e){Problem=e.Message;return false;}
        }
    }
    public static class ShadowApproachProgress
    {
        static ShadowApproachStore current;
        public static bool ArrivalPending {get;set;}
        public static Vector3 ReturnPosition {get;set;}
        public static Vector3 ReturnHeading {get;set;}=Vector3.forward;
        public static string SavePath
        {
            get
            {
                var args=Environment.GetCommandLineArgs();int index=Array.IndexOf(args,"-mumu-shadow-file");
                if(index>=0&&index+1<args.Length)return Path.GetFullPath(args[index+1]);
                index=Array.IndexOf(args,"-mumu-progress-file");
                if(index>=0&&index+1<args.Length)return Path.GetFullPath(args[index+1])+".shadow.json";
                return Path.Combine(Application.persistentDataPath,"shadow-approach-v1.json");
            }
        }
        public static ShadowApproachStore Current=>current??(current=new ShadowApproachStore(SavePath));
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        static void ResetRuntime(){current=null;ArrivalPending=false;ReturnPosition=Vector3.zero;ReturnHeading=Vector3.forward;}
    }
}
