using System;
using System.IO;
using System.Collections.Generic;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;
using Mumu.Planet;

namespace Mumu.Editor
{
    public static class WaterInteriorArt
    {
        const string Folder="Assets/Mumu/Generated/WaterInteriorV05/";
        [Serializable] class MatData{public string name;public float[] color;public float metal;}
        [Serializable] class MeshData{public string material;public float[] vertices,normals,uv;public int[] triangles;}
        [Serializable] class ExportData{public MatData[] materials;public MeshData[] meshes;}
        static Vector3[] Vectors(float[] values){var a=new Vector3[values.Length/3];for(int i=0;i<a.Length;i++)a[i]=new Vector3(values[i*3],values[i*3+1],values[i*3+2]);return a;}
        static Texture2D StoneTexture(bool normal)
        {
            var path=Folder+(normal?"Limestone relief.asset":"Limestone subtle grain.asset");
            var texture=AssetDatabase.LoadAssetAtPath<Texture2D>(path);if(texture!=null)return texture;
            const int size=512;texture=new Texture2D(size,size,TextureFormat.RGBA32,true,normal);texture.name=normal?"Stone relief":"Subtle limestone";texture.wrapMode=TextureWrapMode.Repeat;texture.anisoLevel=4;
            var pixels=new Color[size*size];
            for(int y=0;y<size;y++)for(int x=0;x<size;x++)
            {
                float h=StoneHeight(x,y);
                if(normal){var n=new Vector3((h-StoneHeight(x+1,y))*1.8f,(h-StoneHeight(x,y+1))*1.8f,1).normalized;pixels[y*size+x]=new Color(n.x*.5f+.5f,n.y*.5f+.5f,n.z*.5f+.5f,1);}
                else {float value=.85f+h*.11f;pixels[y*size+x]=new Color(value,value*.995f,value*.978f,1);}
            }
            texture.SetPixels(pixels);texture.Apply();AssetDatabase.CreateAsset(texture,path);return texture;
        }
        static float StoneHeight(float x,float y)=>Mathf.PerlinNoise(x*.018f,y*.018f)*.50f+Mathf.PerlinNoise(x*.16f+17,y*.16f)*.32f+Mathf.PerlinNoise(x*.55f,y*.55f+9)*.18f;
        public static Transform Import(string file,Transform parent=null)
        {
            Directory.CreateDirectory(Folder);AssetDatabase.Refresh();
            var data=JsonUtility.FromJson<ExportData>(File.ReadAllText("Assets/Mumu/Models/WaterInterior/"+file+".json"));
            var root=new GameObject(file+" Blender architecture").transform;root.SetParent(parent,false);
            var mats=new Dictionary<string,Material>();
            foreach(var item in data.materials)
            {
                string path=Folder+item.name+".mat";
                var m=AssetDatabase.LoadAssetAtPath<Material>(path);
                if(m==null){m=new Material(Shader.Find("Universal Render Pipeline/Lit"));AssetDatabase.CreateAsset(m,path);}
                m.color=new Color(item.color[0],item.color[1],item.color[2]).gamma;m.SetFloat("_Metallic",item.metal);m.SetFloat("_Smoothness",item.metal>.5f?.55f:.25f);
                if(item.name.Contains("stone")||item.name.Contains("carved")){m.shader=Shader.Find("Mumu/Temple Weathered Stone");m.SetColor("_BaseColor",new Color(item.color[0],item.color[1],item.color[2]).gamma);}
                if(item.name.Contains("glacial")||item.name.Contains("frost")){m.shader=Shader.Find("Mumu/Interior Glacier");m.SetColor("_BaseColor",item.name.Contains("depths")?new Color(.045f,.16f,.22f):item.name.Contains("frost")?new Color(.28f,.54f,.64f):new Color(.10f,.34f,.48f));}
                if(item.name.StartsWith("Gate ")){m.shader=Shader.Find("Mumu/Water Gate Seal");m.SetColor("_BaseColor",new Color(item.color[0],item.color[1],item.color[2]).gamma);m.SetFloat("_Wake",0);}
                mats[item.name]=m;EditorUtility.SetDirty(m);
            }
            for(int i=0;i<data.meshes.Length;i++)
            {
                var d=data.meshes[i];string path=Folder+file+"-"+i+".asset";
                var mesh=AssetDatabase.LoadAssetAtPath<Mesh>(path);if(mesh==null){mesh=new Mesh();AssetDatabase.CreateAsset(mesh,path);}else mesh.Clear();
                mesh.indexFormat=IndexFormat.UInt32;mesh.vertices=Vectors(d.vertices);mesh.normals=Vectors(d.normals);mesh.triangles=d.triangles;
                var uv=new Vector2[d.uv.Length/2];for(int k=0;k<uv.Length;k++)uv[k]=new Vector2(d.uv[k*2],d.uv[k*2+1]);mesh.uv=uv;mesh.RecalculateTangents();mesh.RecalculateBounds();EditorUtility.SetDirty(mesh);
                var go=new GameObject(d.material,typeof(MeshFilter),typeof(MeshRenderer));go.transform.SetParent(root,false);go.GetComponent<MeshFilter>().sharedMesh=mesh;go.GetComponent<MeshRenderer>().sharedMaterial=mats[d.material];
            }
            return root;
        }
        static void Hide(string name)
        {foreach(var r in UnityEngine.Object.FindObjectsByType<Renderer>(FindObjectsSortMode.None))if(r.name==name)r.enabled=false;}
        static void LightAt(string name,Vector3 p,Color color,float intensity,float range)
        {var l=new GameObject(name).AddComponent<Light>();l.type=LightType.Point;l.transform.position=p;l.color=color;l.intensity=intensity;l.range=range;l.shadows=LightShadows.None;}
        static void Lighting(WaterBraceletLab ability)
        {
            RenderSettings.ambientMode=AmbientMode.Trilight;RenderSettings.ambientSkyColor=new Color(.23f,.32f,.42f);RenderSettings.ambientEquatorColor=new Color(.14f,.19f,.23f);RenderSettings.ambientGroundColor=new Color(.08f,.11f,.14f);
            foreach(var l in UnityEngine.Object.FindObjectsByType<Light>(FindObjectsSortMode.None))if(l.type==LightType.Directional){l.color=new Color(1,.86f,.68f);l.intensity=1.65f;l.transform.rotation=Quaternion.Euler(48,-32,0);}
            LightAt("Cool glacial daylight",new Vector3(4,4,6),new Color(.42f,.76f,1),18,14);
            LightAt("Warm entrance bounce",new Vector3(-3,3,-4),new Color(1,.80f,.57f),24,12);
            LightAt("Portal warm reflected light",new Vector3(0,4,7.5f),new Color(1,.84f,.62f),22,10);
            RenderSettings.fog=true;RenderSettings.fogMode=FogMode.Exponential;RenderSettings.fogDensity=.012f;RenderSettings.fogColor=new Color(.11f,.18f,.22f);
            ability.view.backgroundColor=new Color(.10f,.20f,.28f);ability.view.clearFlags=CameraClearFlags.SolidColor;
            var probe=new GameObject("One-time temple reflections").AddComponent<ReflectionProbe>();
            probe.transform.position=new Vector3(0,3,3);probe.size=new Vector3(22,20,30);
            probe.mode=ReflectionProbeMode.Realtime;probe.refreshMode=ReflectionProbeRefreshMode.ViaScripting;
            probe.timeSlicingMode=ReflectionProbeTimeSlicingMode.IndividualFaces;probe.resolution=128;
            probe.boxProjection=true;probe.hdr=true;probe.intensity=.8f;probe.nearClipPlane=.2f;probe.farClipPlane=40;
            probe.gameObject.AddComponent<TempleReflectionCapture>();
        }
        public static void Ice(WaterBraceletLab ability)
        {
            Import("ice-hall-v07");
            var gateDetail=Import("ice-gate-detail-v06",ability.iceRoom.gate);
            var gateScale=ability.iceRoom.gate.lossyScale;
            gateDetail.localScale=new Vector3(1/gateScale.x,1/gateScale.y,1/gateScale.z);
            AttachGateCeremony(ability.iceRoom,gateDetail);
            AttachGuide(ability.iceRoom);
            ability.iceRoom.gate.GetComponent<Renderer>().sharedMaterial=AssetDatabase.LoadAssetAtPath<Material>(Folder+"Interior water enamel.mat");
            Import("return-bridge-detail-v02",ability.iceRoom.bridge);
            Hide("Permanent return bridge");
            foreach(var name in new[]{"Entrance bank","Far bank","Continuous side wall","Exit facade","Rear boundary","Trough supporting lip"})Hide(name);
            Lighting(ability);
            var shader=Shader.Find("Mumu/Temple Phase Water");
            if(shader==null)throw new Exception("Phase water shader missing");
            var path=Folder+"Living water and ice.mat";var mat=AssetDatabase.LoadAssetAtPath<Material>(path);
            if(mat==null){mat=new Material(shader);AssetDatabase.CreateAsset(mat,path);}else mat.shader=shader;
            foreach(var t in ability.targets)if(!t.collector)t.surface.sharedMaterial=mat;
            EditorUtility.SetDirty(mat);
        }
        public static void Cycle(WaterBraceletLab ability)
        {
            Import("cycle-hall-v09");
            var room=ability.iceRoom;var cycle=room.cycle;
            var steamRoute=new[]{new Vector3(3,.9f,-2),new Vector3(3.88f,.32f,-2),new Vector3(3.88f,-.28f,-2),new Vector3(6.5f,-.28f,-2),new Vector3(6.5f,4.65f,-2),new Vector3(6.5f,4.65f,8.6f),new Vector3(3.7f,4.65f,8.6f),new Vector3(3.7f,3.35f,8.6f)};
            cycle.steam.positionCount=steamRoute.Length;cycle.steam.SetPositions(steamRoute);
            Hide("Fixed upper-gallery ramp");
            var detail=Import("ice-gate-detail-v06",room.gate);
            var scale=room.gate.lossyScale;detail.localScale=new Vector3(1/scale.x,1/scale.y,1/scale.z);
            room.gate.GetComponent<Renderer>().sharedMaterial=AssetDatabase.LoadAssetAtPath<Material>(Folder+"Interior water enamel.mat");
            Import("return-bridge-detail-v02",room.bridge);
            var plate=Import("collector-detail-v02",cycle.collector.transform);plate.localScale=new Vector3(1.4f,1,1);
            foreach(var name in new[]{"Entrance bank","Far bank","Continuous side wall","Exit facade","Rear boundary","Trough supporting lip","Permanent return bridge","Boiler foundation","Upper management gallery","Ramp top landing","Gallery grounded pillar","Ramp support","Supported steam riser","Steam pipe support","Sanctum basin footing","Sanctum basin side"})Hide(name);
            var stone=AssetDatabase.LoadAssetAtPath<Material>(Folder+"Interior limestone.mat");
            foreach(var r in UnityEngine.Object.FindObjectsByType<Renderer>(FindObjectsSortMode.None))
                if(r.name=="Gallery rear safety wall"||r.name=="Fixed upper-gallery ramp")r.sharedMaterial=stone;
            var water=AssetDatabase.LoadAssetAtPath<Material>(Folder+"Living water and ice.mat");
            if(water==null)throw new Exception("Build first-room water material before cycle art");
            foreach(var t in ability.targets)if(!t.collector)t.surface.sharedMaterial=water;
            Lighting(ability);
        }
        public static void Collection(WaterBraceletLab ability)
        {
            Import("collection-hall-v07");
            var collectorDetail=Import("collector-detail-v02",ability.collectionRoom.collector.transform);
            collectorDetail.localRotation=Quaternion.Euler(20,0,0);
            ability.collectionRoom.collector.surface.transform.localRotation=collectorDetail.localRotation;
            Lighting(ability);
            var c=ability.collectionRoom;
            // The trial cubes remain only as selection/water surfaces; bronze vessels now sit on the floor.
            Hide("Boiler footing");Hide("Recovery footing");
            Hide("Outer stone wall");Hide("Management gallery");
            // Replace only blockout visuals. Their original collision and interaction remain intact.
            foreach(var name in new[]{"Lower working floor","Gallery grounded column","Upper tank plinth","Receiver side","Steam conduit","Condensate catch gutter","Fixed collector rail","Rail support","Exit boundary"})Hide(name);
            for(int i=0;i<16;i++)Hide("Fixed stair "+i);
            var m=new Material(Shader.Find("Universal Render Pipeline/Unlit"));m.color=Color.white;
            string path=Folder+"Collector landing indicator.mat";var old=AssetDatabase.LoadAssetAtPath<Material>(path);
            if(old==null){AssetDatabase.CreateAsset(m,path);old=m;}else UnityEngine.Object.DestroyImmediate(m);
            c.preview.sharedMaterial=old;
        }
        public static void CorrectGateAndBuild()
        {
            foreach(var name in new[]{"WaterIceRoom","WaterJourneyIce"})
            {
                var scene=UnityEditor.SceneManagement.EditorSceneManager.OpenScene("Assets/Mumu/Scenes/"+name+".unity");
                var room=UnityEngine.Object.FindFirstObjectByType<WaterIceRoom>();
                for(int i=room.gate.childCount-1;i>=0;i--)
                    if(room.gate.GetChild(i).name.StartsWith("ice-gate-detail-"))UnityEngine.Object.DestroyImmediate(room.gate.GetChild(i).gameObject);
                var detail=Import("ice-gate-detail-v06",room.gate);
                var scale=room.gate.lossyScale;detail.localScale=new Vector3(1/scale.x,1/scale.y,1/scale.z);
                AttachGateCeremony(room,detail);
                UnityEditor.SceneManagement.EditorSceneManager.SaveScene(scene);
            }
            BuildWaterTempleJourney.BuildExisting();
        }
        static void AttachGateCeremony(WaterIceRoom room,Transform detail)
        {
            const string audioPath="Assets/Mumu/Generated/WaterGateCeremony/WaterGateOpen.wav";
            Directory.CreateDirectory(Path.GetDirectoryName(audioPath));
            if(!File.Exists(audioPath))
            {
                const int rate=22050;int samples=(int)(rate*2.2f);var random=new System.Random(731);float low=0;
                using(var writer=new BinaryWriter(File.Create(audioPath)))
                {
                    writer.Write(System.Text.Encoding.ASCII.GetBytes("RIFF"));writer.Write(36+samples*2);writer.Write(System.Text.Encoding.ASCII.GetBytes("WAVEfmt "));
                    writer.Write(16);writer.Write((short)1);writer.Write((short)1);writer.Write(rate);writer.Write(rate*2);writer.Write((short)2);writer.Write((short)16);
                    writer.Write(System.Text.Encoding.ASCII.GetBytes("data"));writer.Write(samples*2);
                    for(int i=0;i<samples;i++)
                    {
                        float t=(float)i/rate;low=Mathf.Lerp(low,(float)random.NextDouble()*2-1,.09f);
                        float chime=Mathf.Sin(t*660*2*Mathf.PI)+.4f*Mathf.Sin(t*990*2*Mathf.PI)+.2f*Mathf.Sin(t*1320*2*Mathf.PI);
                        float value=chime*.15f*Mathf.Exp(-t*5)*Mathf.Clamp01(t/.025f);
                        float moving=Mathf.SmoothStep(0,1,Mathf.InverseLerp(.65f,.85f,t))*(1-Mathf.SmoothStep(0,1,Mathf.InverseLerp(1.8f,2.05f,t)));
                        value+=moving*(low*.30f+Mathf.Sin(t*58*2*Mathf.PI)*.065f);
                        if(t>1.98f)value+=Mathf.Sin((t-1.98f)*110*2*Mathf.PI)*Mathf.Exp(-(t-1.98f)*30)*.13f;
                        writer.Write((short)(Mathf.Clamp(value,-.8f,.8f)*32767));
                    }
                }
                AssetDatabase.ImportAsset(audioPath);
            }
            var source=detail.gameObject.AddComponent<AudioSource>();source.playOnAwake=false;source.loop=false;source.spatialBlend=.7f;source.volume=.5f;source.minDistance=3;source.maxDistance=24;
            source.clip=AssetDatabase.LoadAssetAtPath<AudioClip>(audioPath);
            if(!source.clip)throw new Exception("Gate sound import failed");
            room.gateCeremony=detail.gameObject.AddComponent<WaterGateCeremony>();room.gateCeremony.source=source;
        }
        static void AttachGuide(WaterIceRoom room)
        {
            var guide=room.gameObject.AddComponent<WaterIceGuide>();guide.room=room;
            var go=new GameObject("Current objective gold marker");go.transform.SetParent(room.transform,false);
            var line=go.AddComponent<LineRenderer>();line.useWorldSpace=true;line.loop=true;line.positionCount=48;line.widthMultiplier=.025f;
            line.shadowCastingMode=ShadowCastingMode.Off;line.receiveShadows=false;
            string path=Folder+"Objective gold.mat";var mat=AssetDatabase.LoadAssetAtPath<Material>(path);
            if(!mat){mat=new Material(Shader.Find("Universal Render Pipeline/Unlit"));mat.color=new Color(1,.76f,.28f);AssetDatabase.CreateAsset(mat,path);}
            line.sharedMaterial=mat;guide.marker=line;
        }
    }
}


