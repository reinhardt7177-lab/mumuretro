namespace Mumu.Planet
{
    // The four unique boxes occupy floor (-1), hand (-2), or one of four pan cells.
    public sealed class TwinBalanceState
    {
        readonly int[] locations={-1,-1,-1,-1};
        public int Held {get;private set;}=-1;
        public bool Solved {get;private set;}
        public int Location(int box)=>locations[box];
        public int Weight(int box)=>box+1;
        public int At(int slot){for(int i=0;i<4;i++)if(locations[i]==slot)return i;return -1;}
        public int Count(int side){int n=0;for(int i=0;i<4;i++)if(locations[i]>=side*2&&locations[i]<side*2+2)n++;return n;}
        public int Sum(int side){int n=0;for(int i=0;i<4;i++)if(locations[i]>=side*2&&locations[i]<side*2+2)n+=Weight(i);return n;}
        public void Reset(){for(int i=0;i<4;i++)locations[i]=-1;Held=-1;Solved=false;}
        public bool Restore(int[] saved)
        {
            if(saved==null||saved.Length!=4)return false;
            var occupied=new bool[4];
            for(int i=0;i<4;i++)
            {
                int slot=saved[i];
                if(slot< -1||slot>=4||slot>=0&&occupied[slot])return false;
                if(slot>=0)occupied[slot]=true;
            }
            for(int i=0;i<4;i++)locations[i]=saved[i];Held=-1;
            Solved=Count(0)==2&&Count(1)==2&&Sum(0)==Sum(1);return true;
        }
        public bool Pick(int box)
        {
            if(Solved||Held>=0||box<0||box>=4)return false;
            locations[box]=-2;Held=box;return true;
        }
        public bool Place(int slot)
        {
            if(Solved||Held<0||slot<0||slot>=4||At(slot)>=0)return false;
            locations[Held]=slot;Held=-1;
            Solved=Count(0)==2&&Count(1)==2&&Sum(0)==Sum(1);return true;
        }
        public bool Drop(){if(Solved||Held<0)return false;locations[Held]=-1;Held=-1;return true;}
    }
}
