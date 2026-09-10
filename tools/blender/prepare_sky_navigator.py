"""Reference studio and unbound skeleton guide; not a finished character mesh."""
import bpy, os, math, json
from mathutils import Vector
root=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
out=os.path.join(root,'art/sky-navigator')
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def v(p):return Vector((p[0],-p[2],p[1]))
refs=bpy.data.collections.new('01 Reference images - concept only');bpy.context.scene.collection.children.link(refs)
for name,pos,rot in [('front',(0,.7,.75),(math.pi/2,0,0)),('back',(2,.7,.75),(math.pi/2,0,0)),('right',(-.7,0,.75),(math.pi/2,0,math.pi/2))]:
    image=bpy.data.images.load(os.path.join(out,'reference',name+'-v01.png'));image.pack()
    o=bpy.data.objects.new(name+' reference',None);refs.objects.link(o);o.empty_display_type='IMAGE';o.data=image;o.empty_display_size=1.7;o.location=pos;o.rotation_euler=rot;o.color[3]=.55;o.empty_image_depth='BACK'
arm=bpy.data.armatures.new('Navigator guide - unbound');rig=bpy.data.objects.new('02 Skeleton guide - NOT rigged mesh',arm);bpy.context.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True);rig.show_in_front=True
bpy.ops.object.mode_set(mode='EDIT')
def bone(name,a,b,parent=None):
    o=arm.edit_bones.new(name);o.head=v(a);o.tail=v(b)
    if parent:o.parent=arm.edit_bones[parent]
bone('root',(0,0,0),(0,.1,0));bone('hips',(0,.65,0),(0,.8,0),'root');bone('spine',(0,.8,0),(0,.96,0),'hips');bone('chest',(0,.96,0),(0,1.12,0),'spine');bone('neck',(0,1.12,0),(0,1.19,0),'chest');bone('head',(0,1.19,0),(0,1.43,0),'neck')
for side,s in [('L',1),('R',-1)]:
    bone('upper_arm.'+side,(s*.19,1.08,0),(s*.30,.88,0),'chest');bone('forearm.'+side,(s*.30,.88,0),(s*.4,.71,0),'upper_arm.'+side);bone('hand.'+side,(s*.4,.71,0),(s*.44,.63,0),'forearm.'+side)
    bone('thigh.'+side,(s*.11,.68,0),(s*.13,.38,0),'hips');bone('shin.'+side,(s*.13,.38,0),(s*.15,.1,0),'thigh.'+side);bone('foot.'+side,(s*.15,.1,0),(s*.15,.05,.14),'shin.'+side)
bone('cape',(0,1.10,-.07),(0,.91,-.14),'chest');bone('scarf',(0,1.1,.1),(.08,.92,.13),'chest')
bpy.ops.object.mode_set(mode='OBJECT')
rig['status']='Unbound guide only. Adjust to generated mesh before skinning.'
bpy.context.scene.unit_settings.system='METRIC'
readme=bpy.data.texts.new('READ ME FIRST');readme.write('SKY NAVIGATOR: preparation studio only. Packed front/back/right references and 20-bone unbound guide. No character mesh or skin weights yet. Target game height 1.5, floor 0, glTF front +Z. Side concept has decorative differences: use front/back as authority. Meshy access required for the selected image reconstruction pipeline. Existing game character remains unchanged.')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out,'sky-navigator-preparation-v01.blend'))
with open(os.path.join(out,'preparation-report.json'),'w',encoding='utf8') as f:json.dump({'status':'preparation_only','packed_images':len(bpy.data.images),'guide_bones':len(arm.bones),'character_meshes':0,'skin_weights':False,'game_integrated':False},f,indent=2)
