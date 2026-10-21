using System;

namespace Mumu.Planet
{
    // One owner for box locations; neither animations nor UI can unlock a door.
    public sealed class BalanceOrderState
    {
        readonly int[] locations={-1,-1,-1,-1,-1};
        public int Count { get; private set; }=3;
        public int Held { get; private set; }=-1;
        public bool Solved { get; private set; }
        public int Location(int box)=>locations[box];
        public int Weight(int box)=>box+1;
        public int At(int slot) { for(int i=0;i<Count;i++)if(locations[i]==slot)return i;return -1; }
        public int Placed { get { int n=0;for(int i=0;i<Count;i++)if(locations[i]>=0&&locations[i]<Count)n++;return n; } }
        public bool Select(int count)
        {
            if(count<3||count>5||Solved)return false;
            Count=count;Held=-1;Array.Fill(locations,-1);return true;
        }
        public void Reset() { Solved=false;Select(Count); }
        public bool Restore(int count,int[] saved)
        {
            if(count<3||count>5||saved==null||saved.Length!=count)return false;
            var occupied=new bool[7];
            for(int i=0;i<count;i++)
            {
                int slot=saved[i];
                if(slot< -1||slot>=7||(slot>=count&&slot<5)||slot>=0&&occupied[slot])return false;
                if(slot>=0)occupied[slot]=true;
            }
            Count=count;Held=-1;Array.Fill(locations,-1);
            for(int i=0;i<count;i++)locations[i]=saved[i];
            Solved=true;for(int i=0;i<count;i++)if(locations[i]!=i)Solved=false;
            return true;
        }
        public bool Pick(int box)
        {
            if(Solved||Held>=0||box<0||box>=Count)return false;
            locations[box]=-2;Held=box;return true;
        }
        public bool Place(int slot)
        {
            if(Solved||Held<0||!((slot>=0&&slot<Count)||slot==5||slot==6)||At(slot)>=0)return false;
            locations[Held]=slot;Held=-1;
            Solved=true;for(int i=0;i<Count;i++)if(locations[i]!=i)Solved=false;
            return true;
        }
        public bool Drop() { if(Solved||Held<0)return false;locations[Held]=-1;Held=-1;return true; }
        public int Compare() { int left=At(5),right=At(6);return left<0||right<0?0:Weight(left)-Weight(right); }
    }
}
