"""Preserve the exact reviewed web bracelet as an editable Blender source.
Run capture-water-bracelet-model.cjs first. No Unity project is required.
"""
import base64
import json
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "art" / "water-bracelet-web"
source = json.loads((OUT / "model-source.json").read_text(encoding="utf-8"))
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
convert = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))
parts = []
for i, part in enumerate(source["parts"]):
    matrix = Matrix([part["matrix"][j:j + 4] for j in range(0, 16, 4)]).transposed()
    transform = convert @ matrix
    raw = part["position"]
    vertices = [transform @ Vector(raw[j:j + 3]) for j in range(0, len(raw), 3)]
    indices = part["index"] or list(range(len(vertices)))
    faces = [indices[j:j + 3] for j in range(0, len(indices), 3)]
    mesh = bpy.data.meshes.new(f"Bracelet detail {i + 1}")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    for face in mesh.polygons:
        face.use_smooth = True
    normals = part["normal"]
    normal_matrix = transform.to_3x3().inverted().transposed()
    mesh.normals_split_custom_set_from_vertices([
        (normal_matrix @ Vector(normals[j:j + 3])).normalized()
        for j in range(0, len(normals), 3)
    ])
    uv = part.get("uv")
    if uv:
        layer = mesh.uv_layers.new(name="Web UV")
        for loop in mesh.loops:
            v = loop.vertex_index
            layer.data[loop.index].uv = uv[v * 2:v * 2 + 2]
    obj = bpy.data.objects.new(part["name"] or f"Bracelet detail {i + 1}", mesh)
    bpy.context.collection.objects.link(obj)
    material = bpy.data.materials.new(f"Bracelet material {i + 1}")
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*part["color"], 1)
    bsdf.inputs["Metallic"].default_value = part["metalness"]
    bsdf.inputs["Roughness"].default_value = part["roughness"]
    bsdf.inputs["Coat Weight"].default_value = part["clearcoat"]
    if part.get("map"):
        image_path = OUT / "enamel-patina.png"
        image_path.write_bytes(base64.b64decode(part["map"].split(",", 1)[1]))
        texture = material.node_tree.nodes.new("ShaderNodeTexImage")
        texture.image = bpy.data.images.load(str(image_path), check_existing=True)
        texture.image.pack()
        # Multiply the same linear material tint by the sRGB texture as Three.js.
        tint = material.node_tree.nodes.new("ShaderNodeMixRGB")
        tint.blend_type = "MULTIPLY"
        tint.inputs[0].default_value = 1
        tint.inputs[2].default_value = (*part["color"], 1)
        material.node_tree.links.new(texture.outputs["Color"], tint.inputs[1])
        material.node_tree.links.new(tint.outputs[0], bsdf.inputs["Base Color"])
    mesh.materials.append(material)
    parts.append(obj)

socket = bpy.data.objects.new("bracelet-light-origin", None)
socket.location = (0, -.091, 0)
bpy.context.collection.objects.link(socket)
socket["purpose"] = "Web emitter: Three.js (0, 0, 0.091), converted from Y-up to Blender Z-up."
bpy.context.scene.unit_settings.system = "METRIC"
bpy.context.scene["design_reference"] = "art/glacier-water-temple/interior/v01/bracelet-reference.png"
bpy.context.scene["runtime_source"] = "src/render/WaterBraceletFx.js — web procedural geometry"
for area in bpy.context.screen.areas:
    if area.type == "VIEW_3D":
        area.spaces.active.region_3d.view_distance = .30
        area.spaces.active.shading.type = "MATERIAL"
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "water-bracelet-v01.blend"))
bpy.ops.object.select_all(action="DESELECT")
for obj in parts:
    obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT / "water-bracelet-v01.glb"), export_format="GLB", use_selection=True)
print("WATER_BRACELET_SOURCE", len(parts), source["triangles"], "triangles")
