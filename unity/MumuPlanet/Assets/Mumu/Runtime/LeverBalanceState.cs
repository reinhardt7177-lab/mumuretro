namespace Mumu.Planet
{
    // Original web rule: masses 2 and 6, six cells, five gaps for the fulcrum.
    // Twice the arm length keeps half-cell distances exact without float tolerances.
    public sealed class LeverBalanceState
    {
        readonly int[] locations={-1,-1};
        public int Held {get;private set;}=-1;
        public int Pivot {get;private set;}=2;
        public bool Solved {get;private set;}
        public int Placed => (locations[0]>=0?1:0)+(locations[1]>=0?1:0);
        public int Weight(int box)=>box==0?2:6;
        public int Location(int box)=>locations[box];
        public int At(int slot){for(int i=0;i<2;i++)if(locations[i]==slot)return i;return -1;}
        public int ArmTwice(int slot)=>2*slot+1-2*Pivot;
        public int Power(int side)
        {
            int power=0;
            for(int i=0;i<2;i++)if(locations[i]>=0)
            {
                int arm=ArmTwice(locations[i]);
                if(side==0&&arm<0)power-=Weight(i)*arm;
                if(side==1&&arm>0)power+=Weight(i)*arm;
            }
            return power/2; // Both authored masses are even.
        }
        void Check(){Solved=Placed==2&&Power(0)>0&&Power(0)==Power(1);}
        public void Reset(){locations[0]=locations[1]=-1;Held=-1;Pivot=2;Solved=false;}
        public bool Restore(int pivot,int[] saved)
        {
            if(pivot<1||pivot>5||saved==null||saved.Length!=2)return false;
            for(int i=0;i<2;i++)if(saved[i]< -1||saved[i]>=6)return false;
            if(saved[0]>=0&&saved[0]==saved[1])return false;
            locations[0]=saved[0];locations[1]=saved[1];Held=-1;Pivot=pivot;Check();return true;
        }
        public bool Pick(int box)
        {
            if(Solved||Held>=0||box<0||box>=2)return false;
            locations[box]=-2;Held=box;Check();return true;
        }
        public bool Place(int slot)
        {
            if(Solved||Held<0||slot<0||slot>=6||At(slot)>=0)return false;
            locations[Held]=slot;Held=-1;Check();return true;
        }
        public bool Drop()
        {
            if(Solved||Held<0)return false;
            locations[Held]=-1;Held=-1;Check();return true;
        }
        public bool Shift(int direction)
        {
            if(Solved||(direction!=-1&&direction!=1)||Pivot+direction<1||Pivot+direction>5)return false;
            Pivot+=direction;Check();return true;
        }
    }
}
