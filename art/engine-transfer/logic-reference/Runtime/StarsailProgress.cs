using System;
using System.IO;
using System.Text;
using UnityEngine;

namespace Mumu.Planet
{
    // Ship progress is independent of the temple completion record and of the web save.
    public sealed class StarsailProgressStore
    {
        [Serializable] sealed class Record
        {
            public int version=1;
            public bool recovered,opened,read,solved,departed;
            public int[] dials=new int[3];
        }

        readonly string path;
        bool preserveUnreadable;
        public bool Recovered {get;private set;}
        public bool Opened {get;private set;}
        public bool Read {get;private set;}
        public bool Solved {get;private set;}
        public bool Departed {get;private set;}
        public int[] Dials {get;private set;}=new int[3];
        public bool Saved {get;private set;}
        public string Problem {get;private set;}

        public StarsailProgressStore(string file)
        {
            path=file;
            if(!File.Exists(path))return;
            try
            {
                var value=JsonUtility.FromJson<Record>(File.ReadAllText(path));
                if(value==null||value.version!=1||value.dials==null||value.dials.Length!=3)
                    throw new InvalidDataException("Unsupported Starsail record.");
                foreach(var digit in value.dials)if(digit<0||digit>9)
                    throw new InvalidDataException("Invalid Starsail digit.");
                if(value.opened&&!value.recovered||value.read&&!value.opened||value.solved&&!value.read||
                   value.departed&&!value.solved||value.solved&&
                   (value.dials[0]!=3||value.dials[1]!=5||value.dials[2]!=8))
                    throw new InvalidDataException("Inconsistent Starsail progress.");
                Recovered=value.recovered;Opened=value.opened;Read=value.read;
                Solved=value.solved;Departed=value.departed;
                Dials=(int[])value.dials.Clone();Saved=true;
            }
            catch(Exception e){preserveUnreadable=true;Problem=e.Message;}
        }

        public bool Save(bool recovered,bool opened,bool read,bool solved,bool departed,int[] digits)
        {
            if(digits==null||digits.Length!=3)throw new ArgumentException("Three digits are required.",nameof(digits));
            foreach(int digit in digits)if(digit<0||digit>9)throw new ArgumentOutOfRangeException(nameof(digits));
            if(opened&&!recovered||read&&!opened||solved&&!read||departed&&!solved||
               solved&&(digits[0]!=3||digits[1]!=5||digits[2]!=8))
                throw new ArgumentException("Inconsistent Starsail progress.");
            Recovered|=recovered;Opened|=opened;Read|=read;Solved|=solved;Departed|=departed;
            Dials=(int[])digits.Clone();
            if(preserveUnreadable)return false; // Keep unknown/newer data untouched.
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(path)));
                var value=new Record{recovered=Recovered,opened=Opened,read=Read,solved=Solved,
                    departed=Departed,dials=(int[])Dials.Clone()};
                string temporary=path+".tmp";
                File.WriteAllText(temporary,JsonUtility.ToJson(value,true),new UTF8Encoding(false));
                if(File.Exists(path))File.Replace(temporary,path,path+".bak");else File.Move(temporary,path);
                Saved=true;Problem=null;return true;
            }
            catch(Exception e){Saved=false;Problem=e.Message;Debug.LogWarning("Starsail progress: "+e.Message);return false;}
        }
    }

    public static class StarsailProgress
    {
        static StarsailProgressStore current;
        public static string SavePath
        {
            get
            {
                var args=Environment.GetCommandLineArgs();int index=Array.IndexOf(args,"-mumu-intro-file");
                return index>=0&&index+1<args.Length?Path.GetFullPath(args[index+1]):
                    Path.Combine(Application.persistentDataPath,"starsail-intro-v1.json");
            }
        }
        public static StarsailProgressStore Current=>current??(current=new StarsailProgressStore(SavePath));
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        static void ResetRuntime(){current=null;}
    }
}
