import bpy,os
from mathutils import Vector
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'));ART=os.path.join(ROOT,'art/water-temple-mountain/v05')
bpy.ops.wm.read_factory_settings(use_empty=True)
font=bpy.data.fonts.load('C:/Windows/Fonts/malgun.ttf')
def text(body,x,y,size):
    c=bpy.data.curves.new('Label','FONT');c.body=body;c.font=font;c.size=size
    o=bpy.data.objects.new('Label',c);bpy.context.collection.objects.link(o);o.location=(x,y,.05)
    m=bpy.data.materials.new('Warm ink');m.use_nodes=True;nt=m.node_tree;nt.nodes.clear();e=nt.nodes.new('ShaderNodeEmission');e.inputs[0].default_value=(.82,.76,.62,1);out=nt.nodes.new('ShaderNodeOutputMaterial');nt.links.new(e.outputs[0],out.inputs[0]);o.data.materials.append(m)
text('태양 절벽 v05 · 실제 Blender 모델 6면도',-6.5,5.1,.35)
text('도면 단면에 기반한 단일 암반 / 동일 모델 · 동일 축척 / AI 생성 이미지가 아닌 실제 렌더',-6.5,4.62,.17)
for i,(f,label) in enumerate([('front','정면 · 남쪽'),('right','우측 · 동쪽'),('back','후면 · 북쪽'),('left','좌측 · 서쪽'),('top','평면 · 위'),('bottom','바닥 · 아래')]):
    x=-4.4+(i%3)*4.4;y=2.2-(i//3)*4.65
    bpy.ops.mesh.primitive_plane_add(size=4.2,location=(x,y,0));o=bpy.context.object
    m=bpy.data.materials.new(label);m.use_nodes=True;nt=m.node_tree;nt.nodes.clear()
    tex=nt.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(os.path.join(ART,f+'.png'));em=nt.nodes.new('ShaderNodeEmission');out=nt.nodes.new('ShaderNodeOutputMaterial');nt.links.new(tex.outputs['Color'],em.inputs['Color']);nt.links.new(em.outputs[0],out.inputs[0]);o.data.materials.append(m)
    text(label,x-2.05,y-2.42,.23)
text('정상 11.3m · 거울 중심 13.3m / 360도 30° 간격 12방향은 review.html에서 확인',-6.5,-5.35,.17)
bpy.ops.object.camera_add(location=(0,0,20));cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=13.7;bpy.context.scene.camera=cam
sc=bpy.context.scene;sc.render.engine='CYCLES';sc.cycles.samples=1;sc.world=bpy.data.worlds.new('Blueprint background');sc.world.color=(.025,.04,.05);sc.view_settings.view_transform='Standard';sc.render.resolution_x=1800;sc.render.resolution_y=1530;sc.render.resolution_percentage=100;sc.render.filepath=os.path.join(ART,'six-view-sheet.png');bpy.ops.render.render(write_still=True)

