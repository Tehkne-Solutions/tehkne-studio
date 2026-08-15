import bpy, json, os
from pathlib import Path
from mathutils import Vector

ASSET='TS_ELEC_MOTOR_DC_A'; VERSION='0.6.0-dcc-candidate'; SIGN='Tehkné Solutions'
SOCKETS=('SOCKET_MECH_AXIS_OUT','SOCKET_MECH_MOUNT_FRONT','SOCKET_ELEC_POWER_POS','SOCKET_ELEC_POWER_NEG')
BUDGET={'LOD0':(3000,4500),'LOD1':(1500,2400),'LOD2':(500,900)}
OUT=Path(os.environ.get('AF001_OUTPUT_DIR','build/asset-forge/af001g-v06')).resolve(); OUT.mkdir(parents=True,exist_ok=True)

def reset():
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)

def mat(name,color,metal,rough):
    m=bpy.data.materials.get(name) or bpy.data.materials.new(name); m.use_nodes=True
    m.diffuse_color=color; m.metallic=metal; m.roughness=rough; m['signature']=SIGN
    b=m.node_tree.nodes.get('Principled BSDF')
    if b:
        b.inputs['Base Color'].default_value=color; b.inputs['Metallic'].default_value=metal; b.inputs['Roughness'].default_value=rough
    return m

def materials():
    return {
      'shell':mat('TS_MAT_STAMPED_STEEL',(0.42,0.46,0.49,1),.82,.31),
      'dark':mat('TS_MAT_STAMPED_STEEL_DARK',(0.19,0.21,0.23,1),.70,.39),
      'steel':mat('TS_MAT_MACHINED_STEEL',(0.66,0.70,0.74,1),.95,.19),
      'poly':mat('TS_MAT_ENGINEERING_POLYMER',(0.035,0.043,0.05,1),.02,.52),
      'copper':mat('TS_MAT_COPPER_TERMINAL',(0.55,0.20,0.055,1),.88,.26),
      'pos':mat('TS_MAT_POSITIVE_INSULATOR',(0.48,0.025,0.02,1),.02,.48),
      'neg':mat('TS_MAT_NEGATIVE_INSULATOR',(0.018,0.025,0.03,1),0,.62),
      'id':mat('TS_MAT_TEHKNE_INLAY',(0.025,0.34,0.38,1),.08,.38),
    }

def collection(name):
    c=bpy.data.collections.get(name) or bpy.data.collections.new(name)
    if c.name not in bpy.context.scene.collection.children: bpy.context.scene.collection.children.link(c)
    return c

def move(obj,c):
    for old in list(obj.users_collection): old.objects.unlink(obj)
    c.objects.link(obj)

def apply(obj):
    bpy.context.view_layer.objects.active=obj; obj.select_set(True)
    for mod in list(obj.modifiers): bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.select_set(False)

def cube(name,dim,loc,ma,bev,seg,c):
    bpy.ops.mesh.primitive_cube_add(location=loc); o=bpy.context.object; o.name=name; o.dimensions=dim
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bev:
        m=o.modifiers.new('manufacturing bevel','BEVEL'); m.width=bev; m.segments=seg; m.limit_method='ANGLE'
    o.data.materials.append(ma); move(o,c); apply(o)
    for p in o.data.polygons: p.use_smooth=True
    return o

def cyl(name,r,depth,loc,ma,verts,c,bev=0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=depth,location=loc); o=bpy.context.object; o.name=name
    if bev:
        m=o.modifiers.new('edge bevel','BEVEL'); m.width=bev; m.segments=2; m.limit_method='ANGLE'
    o.data.materials.append(ma); move(o,c); apply(o)
    for p in o.data.polygons: p.use_smooth=True
    return o

def socket(name,loc,c):
    o=bpy.data.objects.new(name,None); o.empty_display_type='SPHERE'; o.empty_display_size=.0012; o.location=loc; c.objects.link(o)
    return o

def triangulate(c):
    n=0
    for o in c.objects:
        if o.type!='MESH': continue
        o.modifiers.new('runtime triangulation','TRIANGULATE'); apply(o); n+=len(o.data.polygons)
    return n

def build(lod):
    reset(); m=materials(); c=collection(f'{ASSET}_{lod}'); level=int(lod[-1]); seg={0:5,1:3,2:1}[level]; radial={0:48,1:28,2:12}[level]
    body=cube('BODY_CAN',(.024,.018,.028),(0,0,0),m['shell'],{0:.00165,1:.00135,2:.001}[level],seg,c); body['manufacturing']='stamped_steel_can'
    for z,n in ((.01415,'FRONT_ROLLED_SEAM'),(-.01415,'REAR_ROLLED_SEAM')): cube(n,(.0234,.0174,.00072),(0,0,z),m['dark'],.00045,max(1,seg-1),c)
    cube('FRONT_CAP',(.0224,.0164,.0024),(0,0,.01535),m['shell'],.00125,seg,c)
    cyl('FRONT_DISH',.0048,.00065,(0,0,.0169),m['dark'],radial,c,.00016)
    cyl('BEARING_BOSS',.00375,.0023,(0,0,.01835),m['steel'],radial,c,.00016)
    cyl('SHAFT_COLLAR',.00245,.0014,(0,0,.02015),m['steel'],radial,c,.00012)
    shaft=cyl('SHAFT',.001,.012,(0,0,.02615),m['steel'],radial,c,.00008); shaft['rotation_axis']='+Z'
    if level<2:
        for x,s in ((-.0076,'L'),(.0076,'R')):
            cyl(f'MOUNT_RECESS_{s}',.00155,.00055,(x,0,.01685),m['poly'],max(16,radial//2),c,.00008)
            cyl(f'MOUNT_LIP_{s}',.00182,.00018,(x,0,.0172),m['steel'],max(16,radial//2),c)
    cube('REAR_CAP',(.0217,.0157,.0027),(0,0,-.01545),m['poly'],.00115,seg,c)
    cube('TERMINAL_ISLAND',(.0142,.0083,.00155),(0,-.001,-.01755),m['poly'],.00062,max(1,seg-1),c)
    for x,n,ins in ((-.0047,'TERMINAL_POS',m['pos']),(.0047,'TERMINAL_NEG',m['neg'])):
        cube(n,(.0025,.0052,.0007),(x,-.001,-.019),m['copper'],.00018,2,c)
        cyl(n+'_INSULATOR',.0012,.00065,(x,.0025,-.01855),ins,max(12,radial//2),c,.00008)
    if level<2:
        zs=(-.0065,0,.0065) if level==0 else (-.0045,.0045)
        for side in (-1,1):
            for i,z in enumerate(zs): cube(f"SHELL_STAMP_{'L' if side<0 else 'R'}_{i}",(.00042,.0036,.0011),(side*.01202,0,z),m['dark'],.00012,1,c)
        cube('IDENTITY_INLAY',(.0054,.00018,.001),(0,.00902,.004),m['id'],.00010,2,c)
    socket('SOCKET_MECH_AXIS_OUT',(0,0,.03215),c); socket('SOCKET_MECH_MOUNT_FRONT',(0,0,.0166),c)
    socket('SOCKET_ELEC_POWER_POS',(-.0047,-.001,-.01935),c); socket('SOCKET_ELEC_POWER_NEG',(.0047,-.001,-.01935),c)
    for o in c.objects: o['asset_id']=ASSET; o['version']=VERSION; o['signature']=SIGN; o['lod']=lod
    return c,triangulate(c)

def export(c,lod):
    bpy.ops.object.select_all(action='DESELECT')
    for o in c.objects: o.select_set(True)
    p=OUT/f'{ASSET}_{lod}.glb'; bpy.ops.export_scene.gltf(filepath=str(p),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_animations=False); return p

def camera(c):
    d=bpy.data.cameras.new('AF001_CAMERA'); d.lens=58; o=bpy.data.objects.new('AF001_CAMERA',d); c.objects.link(o); bpy.context.scene.camera=o; return o

def point(cam,pos,target):
    cam.location=pos; cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler()

def studio(c):
    floor=mat('TS_MAT_STUDIO_FLOOR',(0.07,.08,.085,1),.02,.76); cube('STUDIO_FLOOR',(.18,.004,.12),(0,-.011,0),floor,.001,2,c)
    for name,loc,energy,size in (('KEY',(.075,.09,.075),900,.055),('FILL',(-.07,.02,.045),400,.045),('RIM',(.02,.05,-.085),550,.038)):
        d=bpy.data.lights.new('AF001_'+name,'AREA'); d.energy=energy; d.shape='DISK'; d.size=size; o=bpy.data.objects.new(d.name,d); o.location=loc; c.objects.link(o); point(o,loc,(0,0,0))

def renders(c):
    sc=bpy.context.scene
    try: sc.render.engine='BLENDER_EEVEE_NEXT'
    except: sc.render.engine='BLENDER_EEVEE'
    sc.render.resolution_x=sc.render.resolution_y=960; sc.render.resolution_percentage=100; sc.render.image_settings.file_format='PNG'; sc.world.color=(.018,.022,.028)
    studio(c); cam=camera(c)
    views={'three-quarter':((.066,.046,.08),(0,0,0)),'front':((0,.003,.08),(0,0,.014)),'side':((.083,.004,.004),(0,0,0)),'rear':((0,.003,-.08),(0,0,-.014)),'bearing':((.025,.015,.052),(0,0,.019)),'terminals':((.025,-.004,-.054),(0,-.001,-.018))}
    out=[]
    for n,(pos,tgt) in views.items(): point(cam,pos,tgt); p=OUT/f'AF001G_V06_{n}.png'; sc.render.filepath=str(p); bpy.ops.render.render(write_still=True); out.append(p.name)
    return out

def main():
    qa={'asset_id':ASSET,'version':VERSION,'signature':SIGN,'lods':{},'required_sockets':list(SOCKETS),'visual_status':'DCC_CANDIDATE_NOT_GOLDEN'}
    for lod in ('LOD0','LOD1','LOD2'):
        c,t=build(lod); p=export(c,lod); ss=sorted(o.name for o in c.objects if o.name.startswith('SOCKET_')); lo,hi=BUDGET[lod]
        qa['lods'][lod]={'triangles':t,'budget':[lo,hi],'budget_pass':lo<=t<=hi,'sockets':ss,'socket_pass':all(x in ss for x in SOCKETS),'glb':p.name,'bytes':p.stat().st_size}
    c,_=build('LOD0'); qa['renders']=renders(c); sc=bpy.context.scene; sc['asset_id']=ASSET; sc['version']=VERSION; sc['signature']=SIGN
    blend=OUT/f'{ASSET}_MASTER_CANDIDATE_v06.blend'; bpy.ops.wm.save_as_mainfile(filepath=str(blend)); qa['blend']=blend.name
    qa['automated_pass']=all(v['budget_pass'] and v['socket_pass'] for v in qa['lods'].values())
    (OUT/'AF001G_V06_DCC_QA.json').write_text(json.dumps(qa,indent=2),encoding='utf-8')
    if not qa['automated_pass']: raise SystemExit('AF-001G v0.6 DCC QA blocked')
if __name__=='__main__': main()
