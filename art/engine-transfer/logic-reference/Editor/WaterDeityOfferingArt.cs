using System;
using System.IO;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;

namespace Mumu.Editor
{
    // Scene-authoring only: preserve the imported ornament mesh and shared palette.
    public static class WaterDeityOfferingArt
    {
        const string Folder = "Assets/Mumu/Generated/WaterDeityOfferingV03/";
        const string CoreName = "Offering inner water core";

        public static void Configure(Transform droplet)
        {
            if (droplet == null) throw new ArgumentNullException(nameof(droplet));
            var renderers = droplet.GetComponentsInChildren<MeshRenderer>(true);
            if (renderers.Length == 0)
                throw new InvalidOperationException("The offering droplet has no imported mesh renderer.");

            if (!Directory.Exists(Folder))
            {
                Directory.CreateDirectory(Folder);
                AssetDatabase.Refresh();
            }

            var shell = Material("Clear aquamarine shell");
            shell.SetColor("_BaseColor", new Color(.10f, .68f, .77f, .34f));
            shell.SetFloat("_Surface", (float)BaseShaderGUI.SurfaceType.Transparent);
            shell.SetFloat("_Blend", (float)BaseShaderGUI.BlendMode.Alpha);
            // Preserve Fresnel/specular highlights as the diffuse tint becomes transparent.
            shell.SetFloat("_BlendModePreserveSpecular", 1);
            shell.SetFloat("_Smoothness", .94f);
            shell.SetColor("_EmissionColor", new Color(.003f, .018f, .023f));
            Finish(shell);

            var core = Material("Quiet aquamarine core");
            core.SetColor("_BaseColor", new Color(.52f, .86f, .90f, 1));
            core.SetFloat("_Surface", (float)BaseShaderGUI.SurfaceType.Opaque);
            core.SetFloat("_Smoothness", .88f);
            // Below the sanctuary's bloom threshold; the core must keep its shape.
            core.SetColor("_EmissionColor", new Color(.06f, .18f, .21f));
            Finish(core);

            foreach (var renderer in renderers)
            {
                if (renderer.name == CoreName) continue;
                var filter = renderer.GetComponent<MeshFilter>();
                if (filter == null || filter.sharedMesh == null)
                    throw new InvalidOperationException("The offering renderer is missing its imported mesh.");

                var slots = renderer.sharedMaterials;
                for (int i = 0; i < slots.Length; i++) slots[i] = shell;
                renderer.sharedMaterials = slots;
                // URP Lit's shadow pass cannot transmit this transparent water tint.
                renderer.shadowCastingMode = ShadowCastingMode.Off;
                renderer.reflectionProbeUsage = ReflectionProbeUsage.BlendProbes;

                var inner = renderer.transform.Find(CoreName);
                if (inner == null)
                {
                    inner = new GameObject(CoreName, typeof(MeshFilter), typeof(MeshRenderer)).transform;
                    inner.SetParent(renderer.transform, false);
                }
                const float coreScale = .28f;
                inner.localRotation = Quaternion.identity;
                inner.localScale = Vector3.one * coreScale;
                inner.localPosition = filter.sharedMesh.bounds.center * (1 - coreScale);
                inner.gameObject.layer = renderer.gameObject.layer;
                inner.GetComponent<MeshFilter>().sharedMesh = filter.sharedMesh;
                var innerRenderer = inner.GetComponent<MeshRenderer>();
                innerRenderer.sharedMaterial = core;
                innerRenderer.shadowCastingMode = ShadowCastingMode.Off;
                innerRenderer.reflectionProbeUsage = ReflectionProbeUsage.BlendProbes;
                EditorUtility.SetDirty(renderer);
                EditorUtility.SetDirty(inner.gameObject);
            }
        }

        static Material Material(string name)
        {
            var shader = Shader.Find("Universal Render Pipeline/Lit");
            if (shader == null) throw new InvalidOperationException("URP Lit shader is unavailable.");
            string path = Folder + name + ".mat";
            var material = AssetDatabase.LoadAssetAtPath<Material>(path);
            if (material == null)
            {
                material = new Material(shader) { name = name };
                AssetDatabase.CreateAsset(material, path);
            }
            else material.shader = shader;
            material.SetFloat("_WorkflowMode", 1);
            material.SetFloat("_Metallic", 0);
            material.SetFloat("_AlphaClip", 0);
            material.SetFloat("_Cull", (float)CullMode.Back);
            material.SetFloat("_SpecularHighlights", 1);
            material.SetFloat("_EnvironmentReflections", 1);
            material.SetFloat("_QueueOffset", 0);
            return material;
        }

        static void Finish(Material material)
        {
            BaseShaderGUI.SetupMaterialBlendMode(material);
            material.EnableKeyword("_EMISSION");
            material.globalIlluminationFlags = MaterialGlobalIlluminationFlags.None;
            material.SetShaderPassEnabled("ShadowCaster", false);
            EditorUtility.SetDirty(material);
        }
    }
}
