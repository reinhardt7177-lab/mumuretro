using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using TMPro;
using Mumu.Planet;

namespace Mumu.Editor
{
    public static class BuildTempleExterior
    {
        const string Root="Assets/Mumu/",Output=Root+"Generated/TempleExterior/";
        [Serializable] class Surface {public string name;public float[] color;public float metal,emission;}
        [Serializable] class Geometry {public string name,part,material;public float[] vertices,normals;public int[] triangles;}
        [Serializable] class Export {public Surface[] materials;public Geometry[] meshes;}
        static Vector3[] Vectors(float[] values)
        {var result=new Vector3[values.Length/3];for(int i=0;i<result.Length;i++)result[i]=new Vector3(values[i*3],values[i*3+1],values[i*3+2]);return result;}
        static Mesh SaveMesh(string name,Vector3[] vertices,Vector3[] normals,int[] triangles)
        {
            var path=Output+name+".asset";var mesh=AssetDatabase.LoadAssetAtPath<Mesh>(path);
            if(mesh==null){mesh=new Mesh{name=name};AssetDatabase.CreateAsset(mesh,path);}else mesh.Clear();
            mesh.indexFormat=vertices.Length>65535?IndexFormat.UInt32:IndexFormat.UInt16;mesh.vertices=vertices;mesh.normals=normals;mesh.triangles=triangles;mesh.RecalculateBounds();EditorUtility.SetDirty(mesh);return mesh;
        }
        static void Collider(Transform parent,string name,Vector3 position,Vector3 size)
        {var obj=new GameObject(name);obj.layer=8;obj.transform.SetParent(parent,false);obj.transform.localPosition=position;obj.AddComponent<BoxCollider>().size=size;}
        public static void Populate(TempleEntrance entrance)
        {
            string source=Root+"Models/TempleExterior/exterior-v02.json";
            if(!File.Exists(source))throw new FileNotFoundException("Export the Blender sanctuary exterior first.",source);
            Directory.CreateDirectory(Output);AssetDatabase.Refresh();
            var data=JsonUtility.FromJson<Export>(File.ReadAllText(source));
            var materials=new Dictionary<string,Material>();
            foreach(var info in data.materials)
            {
                string path=Output+info.name+".mat";var mat=AssetDatabase.LoadAssetAtPath<Material>(path);
                if(mat==null){mat=new Material(Shader.Find("Universal Render Pipeline/Lit"));AssetDatabase.CreateAsset(mat,path);}
                var color=new Color(info.color[0],info.color[1],info.color[2],1).gamma;
                mat.color=color;mat.SetFloat("_Metallic",info.metal);mat.SetFloat("_Smoothness",info.metal>.5f?.4f:.24f);
                if(info.emission>0){mat.EnableKeyword("_EMISSION");mat.SetColor("_EmissionColor",color*info.emission);}
                else{mat.DisableKeyword("_EMISSION");mat.SetColor("_EmissionColor",Color.black);}
                EditorUtility.SetDirty(mat);materials[info.name]=mat;
            }
            // Only this generated entrance hierarchy is replaced; terrain and existing nature stay intact.
            foreach(var child in entrance.transform.Cast<Transform>().ToArray())UnityEngine.Object.DestroyImmediate(child.gameObject);
            // The old marker sat directly on the ridge route. Place the full building beside it.
            var ground=UnityEngine.Object.FindFirstObjectByType<PlanetSurface>();
            var player=UnityEngine.Object.FindFirstObjectByType<PlanetExplorer>();
            entrance.transform.position=ground.Point(player.transform.position+player.transform.forward*9-player.transform.right*6.5f);
            var up=entrance.transform.position.normalized;
            entrance.transform.rotation=Quaternion.LookRotation(Vector3.ProjectOnPlane(player.transform.forward,up).normalized,up);
            entrance.transform.localScale=Vector3.one;
            var exterior=new GameObject("Blender weight sanctuary exterior").transform;exterior.SetParent(entrance.transform,false);
            var door=new GameObject("Blender hinged bronze doors").AddComponent<SanctuaryDoor>();door.transform.SetParent(exterior,false);
            var leftHinge=new GameObject("Left outer hinge").transform;leftHinge.SetParent(door.transform,false);leftHinge.localPosition=new Vector3(-1.28f,0,1.55f);
            var rightHinge=new GameObject("Right outer hinge").transform;rightHinge.SetParent(door.transform,false);rightHinge.localPosition=new Vector3(1.28f,0,1.55f);
            door.Configure(leftHinge,rightHinge);entrance.ConfigureDoor(door);
            int triangles=0;
            foreach(var geometry in data.meshes)
            {
                var parent=geometry.part=="Left"?leftHinge:geometry.part=="Right"?rightHinge:exterior;
                var obj=new GameObject(geometry.name,typeof(MeshFilter),typeof(MeshRenderer));obj.transform.SetParent(parent,false);
                obj.GetComponent<MeshFilter>().sharedMesh=SaveMesh(geometry.name,Vectors(geometry.vertices),Vectors(geometry.normals),geometry.triangles);
                obj.GetComponent<MeshRenderer>().sharedMaterial=materials[geometry.material];triangles+=geometry.triangles.Length/3;
            }
            foreach(int side in new[]{-1,1})
            {
                Collider(exterior,"Sanctuary pier collision",new Vector3(side*2.5f,2,1.25f),new Vector3(2.2f,4.4f,3.9f));
                Collider(exterior,"Sanctuary rear buttress collision",new Vector3(side*3.2f,1.9f,3.05f),new Vector3(.9f,4.4f,1));
            }
            Collider(exterior,"Sanctuary back collision",new Vector3(0,2.2f,3.18f),new Vector3(5.9f,4.9f,.6f));
            // Keep the threshold blocked during the entry animation; the scene changes at its end.
            Collider(exterior,"Portal threshold collision",new Vector3(0,1.95f,1.48f),new Vector3(2.95f,3.95f,.24f));
            Collider(exterior,"Sanctuary roof collision",new Vector3(0,4.5f,1.4f),new Vector3(6.9f,.55f,3.8f));
            Collider(exterior,"Ruined pillar west collision",new Vector3(-4.1f,.6f,-.35f),new Vector3(.85f,1.6f,.85f));
            Collider(exterior,"Ruined pillar east collision",new Vector3(4,.4f,.2f),new Vector3(.85f,1.2f,.85f));
            BuildWeightTemple.WorldText(exterior,"무게의 신전",new Vector3(0,4.62f,-.265f),3.8f,.36f,3.4f);

            // Ground-following paving: no raised visual stairs for the radial controller to sink into.
            var vertices=new List<Vector3>();var normals=new List<Vector3>();var indices=new List<int>();
            for(int row=0;row<6;row++)for(int side=0;side<2;side++)
            {
                float x=(side-.5f)*1.04f,z=-2.5f+row*.68f;
                // Sample within each tile as well as at its corners; the terrain is not planar.
                for(int iz=0;iz<4;iz++)for(int ix=0;ix<4;ix++)
                {
                    int first=vertices.Count;float left=x-.49f+ix*.245f,near=z-.31f+iz*.155f;
                    foreach(var corner in new[]{new Vector3(left,0,near),new Vector3(left+.245f,0,near),new Vector3(left+.245f,0,near+.155f),new Vector3(left,0,near+.155f)})
                    {
                        var point=ground.Point(entrance.transform.TransformPoint(corner));vertices.Add(entrance.transform.InverseTransformPoint(point+point.normalized*.035f));normals.Add(entrance.transform.InverseTransformDirection(point.normalized));
                    }
                    indices.AddRange(new[]{first,first+2,first+1,first,first+3,first+2});
                }
            }
            var paving=new GameObject("Ground-following sanctuary approach",typeof(MeshFilter),typeof(MeshRenderer));paving.transform.SetParent(exterior,false);
            paving.GetComponent<MeshFilter>().sharedMesh=SaveMesh("Approach paving",vertices.ToArray(),normals.ToArray(),indices.ToArray());paving.GetComponent<MeshRenderer>().sharedMaterial=materials["Sanctuary cut edges"];
            var validation=UnityEngine.Object.FindFirstObjectByType<TempleExteriorSmoke>();
            if(validation==null)validation=new GameObject("Exterior validation").AddComponent<TempleExteriorSmoke>();
            validation.Configure(entrance,UnityEngine.Object.FindFirstObjectByType<PlanetExplorer>(),UnityEngine.Object.FindFirstObjectByType<OrbitCamera>(),ground);
            BuildTempleAudience.PopulateExterior(entrance);
            EditorUtility.SetDirty(entrance);AssetDatabase.SaveAssets();
            Debug.Log("TEMPLE_EXTERIOR_READY triangles="+triangles+" batches="+data.meshes.Length);
        }
        [MenuItem("Mumu/Build weight temple exterior")]
        public static void CreateAndBuild()
        {
            BuildWeightTemple.Prepare();
            var scene=EditorSceneManager.OpenScene(Root+"Scenes/PlanetExploration.unity");
            var entrance=UnityEngine.Object.FindFirstObjectByType<TempleEntrance>();
            if(entrance==null)throw new InvalidOperationException("Build the temple entrance before its exterior.");
            Populate(entrance);EditorSceneManager.SaveScene(scene);BuildExploration.BuildWindows();
        }
    }
}
