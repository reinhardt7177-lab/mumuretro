using System.Collections;
using UnityEngine;

namespace Mumu.Planet
{
    /// <summary>Capture static room surroundings once, after the room has initialized.</summary>
    [RequireComponent(typeof(ReflectionProbe))]
    public sealed class TempleReflectionCapture : MonoBehaviour
    {
        IEnumerator Start()
        {
            yield return null;
            GetComponent<ReflectionProbe>().RenderProbe();
        }
    }
}
