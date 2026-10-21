using System;
using System.IO;
using System.Text;
using UnityEngine;

namespace Mumu.Planet
{
    // A dedicated, versioned completion record; not a mid-puzzle or whole-game save.
    public sealed class TempleCompletionStore
    {
        [Serializable] sealed class Record {public int version;public bool balanceCompleted;public string lesson;}
        readonly string path;
        bool preserveUnreadable;
        public bool Completed {get;private set;}
        public bool Saved {get;private set;}
        public string Problem {get;private set;}
        public TempleCompletionStore(string file)
        {
            path=file;
            if(!File.Exists(path))return;
            try
            {
                var record=JsonUtility.FromJson<Record>(File.ReadAllText(path));
                if(record==null||record.version!=1)throw new InvalidDataException("Unsupported temple completion record.");
                Completed=record.balanceCompleted;Saved=true;
            }
            catch(Exception e){preserveUnreadable=true;Problem=e.Message;}
        }
        public bool Complete()
        {
            if(Completed&&Saved)return true;
            Completed=true;
            if(preserveUnreadable)return false; // Never replace an unreadable or newer save.
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(path)));
                var record=new Record{version=1,balanceCompleted=true,lesson="무게와 지지대까지의 거리가 함께 균형을 만든다."};
                string temporary=path+".tmp";
                File.WriteAllText(temporary,JsonUtility.ToJson(record,true),new UTF8Encoding(false));
                if(File.Exists(path))File.Replace(temporary,path,path+".bak");else File.Move(temporary,path);
                Saved=true;Problem=null;return true;
            }
            catch(Exception e){Problem=e.Message;return false;}
        }
    }
    public static class TempleProgress
    {
        static TempleCompletionStore current;
        public static bool ArrivalPending {get;set;}
        public static string SavePath
        {
            get
            {
                var args=Environment.GetCommandLineArgs();int index=Array.IndexOf(args,"-mumu-progress-file");
                return index>=0&&index+1<args.Length?Path.GetFullPath(args[index+1]):Path.Combine(Application.persistentDataPath,"temple-completion-v1.json");
            }
        }
        public static TempleCompletionStore Current=>current??(current=new TempleCompletionStore(SavePath));
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        static void ResetRuntime(){current=null;ArrivalPending=false;}
    }
}
