using System;

namespace Mumu.Planet
{
    // Quantities are conserved water mass, not equal volumes of ice/water/steam.
    [Serializable]
    public sealed class WaterPhaseState
    {
        public float ice, liquid, vapour;
        public float Total => ice + liquid + vapour;
        public WaterPhaseState(float water) { liquid = water; }
        public float Advance(bool heating, int phase, float amount)
        {
            if (amount <= 0 || float.IsNaN(amount) || float.IsInfinity(amount)) return 0;
            float available = phase == 0 ? ice : phase == 1 ? liquid : vapour;
            float moved = Math.Min(available, amount);
            if (heating && phase == 0) { ice -= moved; liquid += moved; }
            else if (heating && phase == 1) { liquid -= moved; vapour += moved; }
            else if (!heating && phase == 2) { vapour -= moved; liquid += moved; }
            else if (!heating && phase == 1) { liquid -= moved; ice += moved; }
            else return 0;
            return moved;
        }
        public int SourcePhase(bool heating) => heating ? (ice > .0001f ? 0 : liquid > .0001f ? 1 : -1) :
            (liquid > .0001f ? 1 : vapour > .0001f ? 2 : -1);
    }

    // One press locks both the target and source phase. A held button cannot cross a boundary.
    public sealed class WaterPhasePress
    {
        WaterPhaseState target;
        bool heating;
        int source;
        float remaining, rate;
        public bool Active => target != null;
        public void Cancel() { target = null; }
        public bool Begin(WaterPhaseState value, bool heat)
        {
            Cancel();
            source = value.SourcePhase(heat);
            if (source < 0) return false;
            target = value; heating = heat;
            remaining = source == 0 ? value.ice : source == 1 ? value.liquid : value.vapour;
            rate = Math.Max(value.Total, .01f) / 2f;
            return true;
        }
        public bool Tick(float dt)
        {
            if (!Active || dt <= 0 || float.IsNaN(dt) || float.IsInfinity(dt)) return false;
            remaining -= target.Advance(heating, source, Math.Min(remaining, rate * dt));
            if (remaining > .0001f) return false;
            Cancel(); return true;
        }
    }
}
