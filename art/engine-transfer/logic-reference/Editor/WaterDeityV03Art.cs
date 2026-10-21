using System;
using System.IO;
using System.Collections.Generic;
using UnityEngine;
using UnityEditor;
using UnityEngine.Rendering;

namespace Mumu.Editor
{
    // Versioned PBR importer; existing temple materials and V01/V02 remain unchanged.
    public static class WaterDeityV03Art
    {
        const string Source="Assets/Mumu/Models/WaterDeityV03/";
        const string Output="Assets/Mumu/Generated/WaterDeityV03/";
        [Serializable] sealed class Surface {public string name,albedo,normal,metalSmooth,occlusion;public float[] color;public float metal,roughness;}
        [Serializable] sealed class Geometry {public string material;public float[] vertices,normals,uv;public int[] triangles;}
        [Serializable] sealed class Export {public Surface[] materials;public Geometry[] meshes;}
        public static Transform Create()
        {
            string file=Source+"water-deity-v03.json";
            if(!File.Exists(file))throw new FileNotFoundException("Prepare the V03 Blender source before scene integration.",file);
            Directory.CreateDirectory(Output);AssetDatabase.Refresh();
            var data=JsonUtility.FromJson<Export>(File.ReadAllText(file));var palette=new Dictionary<string,Material>();
            for(int i=0;i<data.materials.Length;i++)
            {
                var d=data.materials[i];string path=Output+"Surface-"+i+".mat";var m=AssetDatabase.LoadAssetAtPath<Material>(path);
                if(m==null){m=new Material(Shader.Find("Universal Render Pipeline/Lit"));AssetDatabase.CreateAsset(m,path);}
                m.SetColor("_BaseColor",new Color(d.color[0],d.color[1],d.color[2],d.color[3]));
                m.SetTexture("_BaseMap",Texture(d.albedo,true,false));
                // Re-baked against the final mesh normals/UVs; the source map used
                // a different tangent basis and left triangular marks on the face.
                m.SetTexture("_BumpMap",Texture("mat"+i+"-normal-final.png",false,true));m.SetFloat("_BumpScale",1f);
                // Meshy source declares double-sided cloth and hair surfaces.
                m.SetInt("_Cull",(int)CullMode.Off);
                Keyword(m,"_NORMALMAP",!string.IsNullOrEmpty(d.normal));
                m.SetTexture("_MetallicGlossMap",Texture(d.metalSmooth,false,false));
                Keyword(m,"_METALLICSPECGLOSSMAP",!string.IsNullOrEmpty(d.metalSmooth));
                m.SetFloat("_Metallic",string.IsNullOrEmpty(d.metalSmooth)?d.metal:1);
                m.SetFloat("_Smoothness",string.IsNullOrEmpty(d.metalSmooth)?1-d.roughness:1);
                m.SetFloat("_SmoothnessTextureChannel",0);m.DisableKeyword("_SMOOTHNESS_TEXTURE_ALBEDO_CHANNEL_A");
                m.SetTexture("_OcclusionMap",Texture(d.occlusion,false,false));m.SetFloat("_OcclusionStrength",.65f);Keyword(m,"_OCCLUSIONMAP",!string.IsNullOrEmpty(d.occlusion));
                EditorUtility.SetDirty(m);palette.Add(d.name,m);
            }
            var root=new GameObject("Water deity V03 textured Blender model").transform;
            for(int i=0;i<data.meshes.Length;i++)
            {
                var d=data.meshes[i];string path=Output+"Mesh-"+i+".asset";var mesh=AssetDatabase.LoadAssetAtPath<Mesh>(path);
                if(mesh==null){mesh=new Mesh();AssetDatabase.CreateAsset(mesh,path);}else mesh.Clear();
                mesh.indexFormat=IndexFormat.UInt32;mesh.vertices=Vectors(d.vertices);mesh.normals=Vectors(d.normals);mesh.triangles=d.triangles;
                var uv=new Vector2[d.uv.Length/2];for(int j=0;j<uv.Length;j++)uv[j]=new Vector2(d.uv[j*2],d.uv[j*2+1]);mesh.uv=uv;mesh.RecalculateTangents();mesh.RecalculateBounds();EditorUtility.SetDirty(mesh);
                var go=new GameObject("Deity surface "+i,typeof(MeshFilter),typeof(MeshRenderer));go.transform.SetParent(root,false);go.GetComponent<MeshFilter>().sharedMesh=mesh;go.GetComponent<MeshRenderer>().sharedMaterial=palette[d.material];
            }
            return root;
        }
        static void Keyword(Material m,string keyword,bool enabled){if(enabled)m.EnableKeyword(keyword);else m.DisableKeyword(keyword);}
        static Texture2D Texture(string name,bool srgb,bool normal)
        {
            if(string.IsNullOrEmpty(name))return null;string path=Source+name;
            var importer=AssetImporter.GetAtPath(path) as TextureImporter;if(importer==null)throw new FileNotFoundException("Missing deity texture",path);
            importer.textureType=normal?TextureImporterType.NormalMap:TextureImporterType.Default;importer.sRGBTexture=srgb;importer.maxTextureSize=4096;importer.mipmapEnabled=true;importer.anisoLevel=4;importer.textureCompression=TextureImporterCompression.CompressedHQ;importer.SaveAndReimport();
            return AssetDatabase.LoadAssetAtPath<Texture2D>(path);
        }
        static Vector3[] Vectors(float[] a){var v=new Vector3[a.Length/3];for(int i=0;i<v.Length;i++)v[i]=new Vector3(a[3*i],a[3*i+1],a[3*i+2]);return v;}
    }
}
