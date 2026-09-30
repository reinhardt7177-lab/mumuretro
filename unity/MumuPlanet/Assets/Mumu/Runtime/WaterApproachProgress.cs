using System;
using System.IO;
using System.Text;
using UnityEngine;

namespace Mumu.Planet
{
    public sealed class WaterApproachStore
    {
        [Serializable] sealed class Record {public int version=1;public bool entranceOpen,completed;}
        readonly string path;
        bool preserveUnreadable;
        public bool EntranceOpen {get;private set;}
        public bool Completed {get;private set;}
        // Saved means that the permanent completion, rather than just the thaw, is on disk.
        public bool Saved {get;private set;}
        public string Problem {get;private set;}
        public WaterApproachStore(string file)
        {
            path=file;
            if(!File.Exists(path))return;
            try
            {
                var record=JsonUtility.FromJson<Record>(File.ReadAllText(path));
                if(record==null||record.version!=1||record.completed&&!record.entranceOpen)
                    throw new InvalidDataException("Unsupported water entrance record.");
                EntranceOpen=record.entranceOpen;
                Completed=record.completed;
                Saved=record.completed;
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
            // The encounter still finishes for this session when a record cannot be written.
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
    public static class WaterApproachProgress
    {
        static WaterApproachStore current;
        public static bool ArrivalPending {get;set;}
        public static Vector3 ReturnPosition {get;set;}
        public static Vector3 ReturnHeading {get;set;}=Vector3.forward;
        public static string SavePath
        {
            get
            {
                var args=Environment.GetCommandLineArgs();int index=Array.IndexOf(args,"-mumu-water-file");
                if(index>=0&&index+1<args.Length)return Path.GetFullPath(args[index+1]);
                index=Array.IndexOf(args,"-mumu-progress-file");
                if(index>=0&&index+1<args.Length)return Path.GetFullPath(args[index+1])+".water.json";
                return Path.Combine(Application.persistentDataPath,"water-approach-v1.json");
            }
        }
        public static WaterApproachStore Current=>current??(current=new WaterApproachStore(SavePath));
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        static void ResetRuntime(){current=null;ArrivalPending=false;ReturnPosition=Vector3.zero;ReturnHeading=Vector3.forward;}
    }
}
