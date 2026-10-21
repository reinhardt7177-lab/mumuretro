using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using TMPro;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;

namespace Mumu.Editor
{
    // Extends a static TMP atlas. In batch runs the font face was sometimes not found through the asset's
    // editor reference (WATER_FONT_MISSING listed every character, 2026-09-30), so the source is set explicitly.
    public static class ShadowFonts
    {
        public static string Extend(TMP_FontAsset font,string characters,string tag)
        {
            var source=AssetDatabase.LoadAssetAtPath<Font>("Assets/Mumu/Fonts/NanumGothic-Regular.ttf");
            var field=typeof(TMP_FontAsset).GetField("m_SourceFontFile",BindingFlags.NonPublic|BindingFlags.Instance);
            font.atlasPopulationMode=AtlasPopulationMode.Dynamic;
            if(field!=null&&field.GetValue(font)==null&&source!=null)field.SetValue(font,source);
            string wanted=new string(characters.Where(c=>!char.IsControl(c)&&!char.IsWhiteSpace(c)).Distinct().ToArray());
            font.TryAddCharacters(wanted,out string missing);
            missing=new string((missing??"").Where(c=>!font.characterLookupTable.ContainsKey(c)).Distinct().ToArray());
            if(!string.IsNullOrEmpty(missing))Debug.LogWarning(tag+" "+missing);
            return missing;
        }
        // Hangul in the given texts that the atlas lacks (the gate used by builders and smokes).
        public static string MissingHangul(TMP_FontAsset font,IEnumerable<string> texts)
        {
            var missing=new HashSet<char>();
            foreach(var text in texts)foreach(char c in text)if(c>=0xAC00&&c<=0xD7A3&&!font.characterLookupTable.ContainsKey(c))missing.Add(c);
            return new string(missing.ToArray());
        }
    }

    // Imports the Blender exports in Models/ShadowTemple (tools/blender/shadow_temple_common.py export()).
    public static class ShadowTempleArt
    {
        public const string Source="Assets/Mumu/Models/ShadowTemple/",Output="Assets/Mumu/Generated/ShadowTemple/";
        [Serializable] class MaterialData {public string name;public float[] color;public float metal,roughness,emission;}
        [Serializable] class MeshData {public string material;public float[] vertices,normals,uv;public int[] triangles;}
        [Serializable] class ExportData {public MaterialData[] materials;public MeshData[] meshes;}
        [Serializable] class PartData {public string name;public float[] vertices;}
        [Serializable] class PartsData {public PartData[] parts;}
        [Serializable] public class Anchors {public float[] eyes0,eyes1;public float height,footprint;}
        static readonly Dictionary<string,Material> cache=new Dictionary<string,Material>();

        public static void Prepare(){Directory.CreateDirectory(Output);AssetDatabase.Refresh();cache.Clear();}
        static Vector3[] Vectors(float[] v){var r=new Vector3[v.Length/3];for(int i=0;i<r.Length;i++)r[i]=new Vector3(v[i*3],v[i*3+1],v[i*3+2]);return r;}

        public static Material Palette(string name,float[] color,float metal,float roughness,float emission)
        {
            if(cache.TryGetValue(name,out var cached))return cached;
            string path=Output+name+".mat";
            var mat=AssetDatabase.LoadAssetAtPath<Material>(path);
            if(mat==null){mat=new Material(Shader.Find("Universal Render Pipeline/Lit"));AssetDatabase.CreateAsset(mat,path);}
            else mat.shader=Shader.Find("Universal Render Pipeline/Lit");
            var linear=new Color(color[0],color[1],color[2],1);
            mat.color=linear.gamma;mat.SetColor("_BaseColor",linear.gamma);
            mat.SetFloat("_Metallic",metal);mat.SetFloat("_Smoothness",Mathf.Clamp(1-roughness,0,.95f));
            if(emission>0){mat.EnableKeyword("_EMISSION");mat.SetColor("_EmissionColor",(linear*emission).gamma);mat.globalIlluminationFlags=MaterialGlobalIlluminationFlags.None;}
            else{mat.DisableKeyword("_EMISSION");mat.SetColor("_EmissionColor",Color.black);}
            EditorUtility.SetDirty(mat);cache[name]=mat;return mat;
        }
        // One child per material batch. Glowing batches never cast shadows; the rest use `cast`.
        public static Transform Import(string file,Transform parent,ShadowCastingMode cast,Vector3 position=default,Quaternion? rotation=null)
        {
            string path=Source+file+".json";
            if(!File.Exists(path))throw new FileNotFoundException("Export the Blender shadow temple art first (tools/blender/build_shadow_*.py).",path);
            var data=JsonUtility.FromJson<ExportData>(File.ReadAllText(path));
            var mats=new Dictionary<string,Material>();
            foreach(var m in data.materials)mats[m.name]=Palette(m.name,m.color,m.metal,m.roughness,m.emission);
            var root=new GameObject(file+" art").transform;root.SetParent(parent,false);
            root.localPosition=position;root.localRotation=rotation??Quaternion.identity;
            for(int i=0;i<data.meshes.Length;i++)
            {
                var d=data.meshes[i];string meshPath=Output+file+"-"+i+".asset";
                var mesh=AssetDatabase.LoadAssetAtPath<Mesh>(meshPath);
                if(mesh==null){mesh=new Mesh{name=file+"-"+i};AssetDatabase.CreateAsset(mesh,meshPath);}else mesh.Clear();
                var vertices=Vectors(d.vertices);
                mesh.indexFormat=vertices.Length>65535?IndexFormat.UInt32:IndexFormat.UInt16;
                mesh.vertices=vertices;mesh.normals=Vectors(d.normals);mesh.triangles=d.triangles;
                if(d.uv!=null&&d.uv.Length==vertices.Length*2){var uv=new Vector2[vertices.Length];for(int j=0;j<uv.Length;j++)uv[j]=new Vector2(d.uv[j*2],d.uv[j*2+1]);mesh.uv=uv;}
                mesh.RecalculateBounds();EditorUtility.SetDirty(mesh);
                var go=new GameObject(d.material,typeof(MeshFilter),typeof(MeshRenderer));go.transform.SetParent(root,false);
                go.GetComponent<MeshFilter>().sharedMesh=mesh;
                var renderer=go.GetComponent<MeshRenderer>();renderer.sharedMaterial=mats[d.material];
                bool glow=d.material.Contains("glow")||d.material.Contains("portal");
                renderer.shadowCastingMode=glow?ShadowCastingMode.Off:cast;renderer.receiveShadows=!glow;
            }
            return root;
        }
        public static (Vector3[] points,int[] starts) Parts(string file)
        {
            var data=JsonUtility.FromJson<PartsData>(File.ReadAllText(Source+file+".json"));
            var points=new List<Vector3>();var starts=new List<int>();
            foreach(var part in data.parts){starts.Add(points.Count);points.AddRange(Vectors(part.vertices));}
            return (points.ToArray(),starts.ToArray());
        }
        [Serializable] class AnchorsRaw {public float[][] eyes;public float height,footprint;}
        // JsonUtility cannot read nested arrays; the anchors file is tiny, so parse the two eye triples by hand.
        public static Vector3[] Eyes(out float height)
        {
            string text=File.ReadAllText(Source+"guardian-anchors-v01.json");
            var numbers=System.Text.RegularExpressions.Regex.Matches(text,@"-?\d+(\.\d+)?([eE]-?\d+)?").Cast<System.Text.RegularExpressions.Match>()
                .Select(m=>float.Parse(m.Value,System.Globalization.CultureInfo.InvariantCulture)).ToArray();
            // {"eyes":[[x,y,z],[x,y,z]],"eyeSize":[w,h],"height":H,"footprint":R}
            height=numbers[8];
            return new[]{new Vector3(numbers[0],numbers[1],numbers[2]),new Vector3(numbers[3],numbers[4],numbers[5])};
        }
        public static Material Transparent(string name,Color color,bool additive,bool twoSided=false)
        {
            string path=Output+name+".mat";
            var mat=AssetDatabase.LoadAssetAtPath<Material>(path);
            var shader=Shader.Find("Universal Render Pipeline/Unlit");
            if(mat==null){mat=new Material(shader);AssetDatabase.CreateAsset(mat,path);}else mat.shader=shader;
            mat.SetColor("_BaseColor",color);mat.color=color;
            mat.SetFloat("_Surface",1);mat.SetFloat("_Blend",additive?2:0);
            mat.SetFloat("_SrcBlend",(float)(additive?BlendMode.One:BlendMode.SrcAlpha));
            mat.SetFloat("_DstBlend",(float)(additive?BlendMode.One:BlendMode.OneMinusSrcAlpha));
            mat.SetFloat("_ZWrite",0);mat.SetFloat("_Cull",twoSided?0:2);
            mat.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");
            mat.renderQueue=(int)RenderQueue.Transparent;
            EditorUtility.SetDirty(mat);return mat;
        }
        public static Material Lit(string name,Color color,float metal=0,float smooth=.3f,Color? emission=null)
        {
            string path=Output+name+".mat";
            var mat=AssetDatabase.LoadAssetAtPath<Material>(path);
            if(mat==null){mat=new Material(Shader.Find("Universal Render Pipeline/Lit"));AssetDatabase.CreateAsset(mat,path);}
            mat.color=color;mat.SetColor("_BaseColor",color);mat.SetFloat("_Metallic",metal);mat.SetFloat("_Smoothness",smooth);
            if(emission.HasValue){mat.EnableKeyword("_EMISSION");mat.SetColor("_EmissionColor",emission.Value);}else{mat.DisableKeyword("_EMISSION");mat.SetColor("_EmissionColor",Color.black);}
            EditorUtility.SetDirty(mat);return mat;
        }
        public static Material Shaded(string name,string shader)
        {
            string path=Output+name+".mat";
            var mat=AssetDatabase.LoadAssetAtPath<Material>(path);
            var s=Shader.Find(shader);if(s==null)throw new InvalidOperationException("Missing shader "+shader);
            if(mat==null){mat=new Material(s);AssetDatabase.CreateAsset(mat,path);}else mat.shader=s;
            EditorUtility.SetDirty(mat);return mat;
        }
    }
}
