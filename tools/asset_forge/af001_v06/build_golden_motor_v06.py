import bpy, json, os, math
from pathlib import Path
from mathutils import Vector, Matrix

ASSET='TS_ELEC_MOTOR_DC_A'; VERSION='0.6.2-dcc-candidate'; SIGN='Tehkné Solutions'
SOCKETS=('SOCKET_MECH_AXIS_OUT','SOCKET_MECH_MOUNT_FRONT','SOCKET_ELEC_POWER_POS','SOCKET_ELEC_POWER_NEG')
BUDGET={'LOD0':(3000,4500),'LOD1':(1500,2400),'LOD2':(500,900)}
OUT=Path(os.environ.get('AF001_OUTPUT_DIR','build/asset-forge/af001g-v06')).resolve(); OUT.mkdir(parents=True,exist_ok=True)
# Tehkné runtime/glTF coordinates are +Y up / +Z forward. Blender is +Z up.
# Runtime (x,y,z) -> Blender (x,-z,y); glTF export maps it back to +Y up/+Z forward.
RUNTIME_TO_BLENDER=Matrix.Rotation(math.radians(90),4,'X')

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
      'shell':mat('TS_MAT_STAMPED_STEEL',(0.32,0.35,0.38,1),.82,.34),
      'dark':mat('TS_MAT_STAMPED_STEEL_DARK',(0.10,0.12,0.14,1),.68,.43),
      'steel':mat('TS_MAT_MACHINED_STEEL',(0.50,0.54,0.58,1),.95,.22),
      'poly':mat('TS_MAT_ENGINEERING_POLYMER',(0.025,0.032,0.04,1),.02,.56),
      'copper':mat('TS_MAT_COPPER_TERMINAL',(0.42,0.12,0.035,1),.86,.30),
      'pos':mat('TS_MAT_POSITIVE_INSULATOR',(0.38,0.018,0.012,1),.02,.50),
      'neg':mat('TS_MAT_NEGATIVE_INSULATOR',(0.012,0.018,0.024,1),0,.64),
      'id':mat('TS_MAT_TEHKNE_INLAY',(0.018,0.22,0.25,1),.06,.42),
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
        try:
            n=o.modifiers.new('weighted normals','WEIGHTED_NORMAL'); n.keep_sharp=True
        except Exception: pass
    o.data.materials.append(ma); move(o,c); apply(o)
    return o

def cyl(name,r,depth,loc,ma,verts,c,bev=0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=depth,location=loc); o=bpy.context.object; o.name=name
    if bev:
        m=o.modifiers.new('edge bevel','BEVEL'); m.width=bev; m.segments=1; m.limit_method='ANGLE'
    o.data.materials.append(ma); move(o,c); apply(o)
    for p in o.data.polygons: p.use_smooth=True
    return o

def socket(name,loc,c):
    o=bpy.data.objects.new(name,None); o.empty_display_type='SPHERE'; o.empty_display_size=.0012; o.location=loc; c.objects.link(o)
    return o

def orient_runtime_to_blender(c):
    for o in c.objects: o.matrix_world=RUNTIME_TO_BLENDER @ o.matrix_world

def runtime_to_blender(v):
    x,y,z=v; return (x,-z,y)

def triangulate(c):
    n=0
    for o in c.objects:
        if o.type!='MESH': continue
        o.modifiers.new('runtime triangulation','TRIANGULATE'); apply(o); n+=len(o.data.polygons)
    return n

def build(lod):
    reset(); m=materials(); c=collection(f'{ASSET}_{lod}'); level=int(lod[-1])
    # v0.6.2: LOD0 gets just enough radial density to recover the 3k floor;
    # LOD2 drops one radial step to stay below the 900-triangle ceiling.
    seg={0:3,1:2,2:1}[level]; radial={0:36,1:20,2:7}[level]
    body=cube('BODY_CAN',(.024,.018,.028),(0,0,0),m['shell'],{0:.00145,1:.00115,2:.00085}[level],seg,c); body['manufacturing']='stamped_steel_can'
    for z,n in ((.01415,'FRONT_ROLLED_SEAM'),(-.01415,'REAR_ROLLED_SEAM')): cube(n,(.0234,.0174,.00072),(0,0,z),m['dark'],.00036,max(1,seg-1),c)
    cube('FRONT_CAP',(.0224,.0164,.0024),(0,0,.01535),m['shell'],.00105,seg,c)
    cyl('FRONT_DISH',.0048,.00065,(0,0,.0169),m['dark'],radial,c,.00012)
    cyl('BEARING_BOSS',.00355,.0021,(0,0,.01825),m['steel'],radial,c,.00012)
    cyl('SHAFT_COLLAR',.00230,.00125,(0,0,.01995),m['steel'],radial,c,.00009)
    shaft=cyl('SHAFT',.001,.012,(0,0,.0260),m['steel'],radial,c,.00006); shaft['rotation_axis']='+Z'
    if level<2:
        for x,s in ((-.0076,'L'),(.0076,'R')):
            rv=max(12,radial//2)
            cyl(f'MOUNT_RECESS_{s}',.00145,.00048,(x,0,.01682),m['poly'],rv,c,.00005)
            cyl(f'MOUNT_LIP_{s}',.00168,.00014,(x,0,.01714),m['steel'],rv,c)
    cube('REAR_CAP',(.0217,.0157,.0027),(0,0,-.01545),m['poly'],.0010,seg,c)
    cube('TERMINAL_ISLAND',(.0142,.0083,.00155),(0,-.001,-.01755),m['poly'],.00052,max(1,seg-1),c)
    for x,n,ins in ((-.0047,'TERMINAL_POS',m['pos']),(.0047,'TERMINAL_NEG',m['neg'])):
        cube(n,(.0025,.0052,.0007),(x,-.001,-.019),m['copper'],.00013,1,c)
        cyl(n+'_INSULATOR',.00115,.00058,(x,.0025,-.01855),ins,max(8,radial//2),c,.00005)
    if level<2:
        zs=(-.006,0,.006) if level==0 else (-.0045,.0045)
        for side in (-1,1):
            for i,z in enumerate(zs): cube(f"SHELL_STAMP_{'L' if side<0 else 'R'}_{i}",(.00034,.0031,.0009),(side*.0120,0,z),m['dark'],.00008,1,c)
        # Flush identity inlay; never a protruding cyan fin.
        cube('IDENTITY_INLAY',(.0046,.00012,.00072),(0,.0090,.0035),m['id'],.00005,1,c)
    socket('SOCKET_MECH_AXIS_OUT',(0,0,.0320),c); socket('SOCKET_MECH_MOUNT_FRONT',(0,0,.0166),c)
    socket('SOCKET_ELEC_POWER_POS',(-.0047,-.001,-.01935),c); socket('SOCKET_ELEC_POWER_NEG',(.0047,-.001,-.01935),c)
    orient_runtime_to_blender(c)
    for o in c.objects: o['asset_id']=ASSET; o['version']=VERSION; o['signature']=SIGN; o['lod']=lod
    return c,triangulate(c)

def export(c,lod):
    bpy.ops.object.select_all(action='DESELECT')
    for o in c.objects: o.select_set(True)
    p=OUT/f'{ASSET}_{lod}.glb'; bpy.ops.export_scene.gltf(filepath=str(p),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_animations=False); return p

def camera(c):
    d=bpy.data.cameras.new('AF001_CAMERA'); d.lens=68; d.clip_start=.001; d.clip_end=5
    o=bpy.data.objects.new('AF001_CAMERA',d); c.objects.link(o); bpy.context.scene.camera=o; return o

def point(cam,pos,target):
    cam.location=pos; cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler()

def studio(c):
    floor=mat('TS_MAT_STUDIO_FLOOR',(0.035,.042,.048,1),.02,.84)
    floor_obj=cube('STUDIO_FLOOR',(.18,.12,.003),(0,0,-.011),floor,.0008,2,c)
    # Calibrated for a 24 mm product. Sub-watt area lights preserve metal response
    # without clipping every material to white in Eevee/llvmpipe.
    for name,runtime_loc,energy,size in (('KEY',(.09,.11,.10),1.20,.060),('FILL',(-.08,.035,.06),.35,.050),('RIM',(.025,.075,-.10),.65,.045)):
        loc=runtime_to_blender(runtime_loc); d=bpy.data.lights.new('AF001_'+name,'AREA'); d.energy=energy; d.shape='DISK'; d.size=size
        o=bpy.data.objects.new(d.name,d); o.location=loc; c.objects.link(o); point(o,loc,runtime_to_blender((0,0,0)))
    return floor_obj

def render_view(sc,cam,name,pos,target,projection,scale,floor):
    cam.data.type='PERSP' if projection=='perspective' else 'ORTHO'
    if projection=='perspective': cam.data.lens=72
    else: cam.data.ortho_scale=scale
    point(cam,runtime_to_blender(pos),runtime_to_blender(target))
    floor.hide_render = name!='three-quarter'
    p=OUT/f'AF001G_V06_{name}.png'; sc.render.filepath=str(p); bpy.ops.render.render(write_still=True); return p.name

def renders(c):
    sc=bpy.context.scene
    try: sc.render.engine='BLENDER_EEVEE_NEXT'
    except: sc.render.engine='BLENDER_EEVEE'
    sc.render.resolution_x=sc.render.resolution_y=960; sc.render.resolution_percentage=100; sc.render.image_settings.file_format='PNG'; sc.world.color=(.006,.008,.012)
    try: sc.view_settings.look='AgX - Medium High Contrast'
    except: pass
    sc.view_settings.exposure=-.90
    floor=studio(c); cam=camera(c)
    views={
      'three-quarter':((.105,.075,.135),(0,0,0),'perspective',0),
      'front':((0,.002,.12),(0,0,.014),'ortho',.064),
      'side':((.12,.002,0),(0,0,0),'ortho',.066),
      'rear':((0,.002,-.12),(0,0,-.014),'ortho',.064),
      'bearing':((.020,.010,.085),(0,0,.019),'ortho',.038),
      'terminals':((.020,-.003,-.085),(0,-.001,-.018),'ortho',.042),
    }
    out=[]
    for n,(pos,tgt,projection,scale) in views.items(): out.append(render_view(sc,cam,n,pos,tgt,projection,scale,floor))
    return out,views

def main():
    qa={'asset_id':ASSET,'version':VERSION,'signature':SIGN,'axis_contract':'Blender (x,-z,y) -> glTF +Y up/+Z forward','lods':{},'required_sockets':list(SOCKETS),'visual_status':'DCC_CANDIDATE_NOT_GOLDEN'}
    for lod in ('LOD0','LOD1','LOD2'):
        c,t=build(lod); p=export(c,lod); ss=sorted(o.name for o in c.objects if o.name.startswith('SOCKET_')); lo,hi=BUDGET[lod]
        qa['lods'][lod]={'triangles':t,'budget':[lo,hi],'budget_pass':lo<=t<=hi,'sockets':ss,'socket_pass':all(x in ss for x in SOCKETS),'glb':p.name,'bytes':p.stat().st_size}
    c,_=build('LOD0'); qa['renders'],view_config=renders(c); qa['render_config']={k:{'projection':v[2],'scale':v[3]} for k,v in view_config.items()}
    sc=bpy.context.scene; sc['asset_id']=ASSET; sc['version']=VERSION; sc['signature']=SIGN
    blend=OUT/f'{ASSET}_MASTER_CANDIDATE_v06.blend'; bpy.ops.wm.save_as_mainfile(filepath=str(blend)); qa['blend']=blend.name
    qa['automated_pass']=all(v['budget_pass'] and v['socket_pass'] for v in qa['lods'].values())
    (OUT/'AF001G_V06_DCC_QA.json').write_text(json.dumps(qa,indent=2),encoding='utf-8')
    if not qa['automated_pass']: raise SystemExit('AF-001G v0.6 DCC QA blocked')
if __name__=='__main__': main()
