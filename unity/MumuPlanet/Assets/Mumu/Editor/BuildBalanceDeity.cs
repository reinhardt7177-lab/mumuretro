using System;
using System.IO;
using System.Collections.Generic;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;

namespace Mumu.Editor
{
    // Imports evaluated Blender material batches without touching original FBX or temple sources.
    public static class BuildBalanceDeity
    {
        const string Output="Assets/Mumu/Generated/BalanceDeity/";
        [Serializable] class Surface {public string name;public float[] color;public float metal,roughness,emission;}
        [Serializable] class Geometry {public string name,material;public float[] vertices,normals;public int[] triangles;}
        [Serializable] class Export {public Surface[] materials;public Geometry[] meshes;}
        static Vector3[] Vectors(float[] values)
        {var a=new Vector3[values.Length/3];for(int i=0;i<a.Length;i++)a[i]=new Vector3(values[i*3],values[i*3+1],values[i*3+2]);return a;}
        public static Transform Create(Vector3 position)
        {
            const string source="Assets/Mumu/Models/BalanceDeity/deity-v01.json";
            if(!File.Exists(source))throw new FileNotFoundException("Export the Blender equilibrium deity first.",source);
            Directory.CreateDirectory(Output);AssetDatabase.Refresh();
            var data=JsonUtility.FromJson<Export>(File.ReadAllText(source));
            var palette=new Dictionary<string,Material>();
            foreach(var surface in data.materials)
            {
                string path=Output+surface.name+".mat";var mat=AssetDatabase.LoadAssetAtPath<Material>(path);
                if(mat==null){mat=new Material(Shader.Find("Universal Render Pipeline/Lit"));AssetDatabase.CreateAsset(mat,path);}
                var color=new Color(surface.color[0],surface.color[1],surface.color[2],1).gamma;
                mat.color=color;mat.SetFloat("_Metallic",surface.metal);mat.SetFloat("_Smoothness",1-surface.roughness);
                if(surface.emission>0){mat.EnableKeyword("_EMISSION");mat.SetColor("_EmissionColor",color*surface.emission);}
                else{mat.DisableKeyword("_EMISSION");mat.SetColor("_EmissionColor",Color.black);}
                EditorUtility.SetDirty(mat);palette[surface.name]=mat;
            }
            var root=new GameObject("Blender equilibrium deity v01").transform;root.position=position;
            int triangles=0;
            foreach(var geometry in data.meshes)
            {
                var path=Output+geometry.name+".asset";var mesh=AssetDatabase.LoadAssetAtPath<Mesh>(path);
                if(mesh==null){mesh=new Mesh{name=geometry.name};AssetDatabase.CreateAsset(mesh,path);}else mesh.Clear();
                mesh.indexFormat=geometry.vertices.Length/3>65535?IndexFormat.UInt32:IndexFormat.UInt16;
                mesh.vertices=Vectors(geometry.vertices);mesh.normals=Vectors(geometry.normals);mesh.triangles=geometry.triangles;mesh.RecalculateBounds();EditorUtility.SetDirty(mesh);
                var part=new GameObject(geometry.name,typeof(MeshFilter),typeof(MeshRenderer));part.transform.SetParent(root,false);
                part.GetComponent<MeshFilter>().sharedMesh=mesh;part.GetComponent<MeshRenderer>().sharedMaterial=palette[geometry.material];triangles+=geometry.triangles.Length/3;
            }
            if(triangles>100000||data.meshes.Length>8)throw new InvalidOperationException("Deity exceeds the authored geometry/render budget.");
            Debug.Log("DEITY_READY triangles="+triangles+" renderers="+data.meshes.Length);
            return root;
        }
    }
}
