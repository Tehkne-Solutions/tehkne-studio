import json
import sys
from pathlib import Path

import bpy
import numpy as np

SCRIPT_DIR=Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0,str(SCRIPT_DIR))
import build_golden_motor_v06 as base

VERSION='0.6.5-dcc-candidate'
ROUGHNESS_NAME='TS_MOTOR_STAMPED_STEEL_ROUGHNESS'
ROUGHNESS_FILE='TS_MOTOR_STAMPED_STEEL_ROUGHNESS.png'

base.VERSION=VERSION
original_build=base.build


def ensure_roughness_texture():
    img=bpy.data.images.get(ROUGHNESS_NAME)
    if img is not None:
        return img
    size=128
    y=np.arange(size,dtype=np.float32)[:,None]
    x=np.arange(size,dtype=np.float32)[None,:]
    # Industrial finish: directional micrograin with very low amplitude.
    # No random cloud noise; the surface should read as stamped/brushed steel,
    # not mottled stone or procedural dirt.
    grain=0.355 + 0.0045*np.sin(y*1.65) + 0.0015*np.sin(x*0.37)
    grain=np.clip(grain,0.345,0.365)
    rgba=np.ones((size,size,4),dtype=np.float32)
    rgba[:,:,:3]=grain[:,:,None]
    img=bpy.data.images.new(ROUGHNESS_NAME,width=size,height=size,alpha=True,float_buffer=False)
    img.colorspace_settings.name='Non-Color'
    img.pixels.foreach_set(rgba.ravel())
    img.filepath_raw=str(base.OUT/ROUGHNESS_FILE)
    img.file_format='PNG'
    img.save()
    return img


def bind_stamped_steel_roughness():
    material=bpy.data.materials.get('TS_MAT_STAMPED_STEEL')
    if material is None or not material.use_nodes:
        return
    nodes=material.node_tree.nodes
    links=material.node_tree.links
    bsdf=nodes.get('Principled BSDF')
    if bsdf is None:
        return
    tex=nodes.get('AF001_STEEL_ROUGHNESS')
    if tex is None:
        tex=nodes.new('ShaderNodeTexImage')
        tex.name='AF001_STEEL_ROUGHNESS'
        tex.label='AF001 subtle directional stamped-steel roughness'
    tex.image=ensure_roughness_texture()
    tex.interpolation='Linear'
    for link in list(bsdf.inputs['Roughness'].links):
        links.remove(link)
    links.new(tex.outputs['Color'],bsdf.inputs['Roughness'])


def apply_seam_finish(collection):
    seam=base.mat('TS_MAT_ROLLED_SEAM',(0.13,0.145,0.16,1),.72,.48)
    for name in ('FRONT_ROLLED_SEAM','REAR_ROLLED_SEAM'):
        obj=collection.objects.get(name)
        if obj is None or obj.type!='MESH':
            continue
        obj.data.materials.clear()
        obj.data.materials.append(seam)
        obj['manufacturing']='rolled_shell_seam_low_contrast'


def add_vent_recesses(collection,lod):
    level=int(lod[-1])
    if level==2:
        return []
    dark=bpy.data.materials['TS_MAT_STAMPED_STEEL_DARK']
    new=[]
    z_positions=(-.0060,.0040) if level==0 else (-.0045,)
    for side in (-1,1):
        for index,runtime_z in enumerate(z_positions):
            runtime_loc=(side*.01194,0,runtime_z)
            obj=base.cube(
                f"VENT_RECESS_{'L' if side<0 else 'R'}_{index}",
                (.00008,.0040,.0020),
                base.runtime_to_blender(runtime_loc),
                dark,.00042 if level==0 else .00034,2 if level==0 else 1,collection
            )
            obj['manufacturing']='shallow_stamped_vent_recess'
            obj['asset_id']=base.ASSET; obj['version']=VERSION; obj['signature']=base.SIGN; obj['lod']=lod
            obj.modifiers.new('runtime triangulation','TRIANGULATE'); base.apply(obj)
            new.append(obj)
    return new


def patched_build(lod):
    collection,_=original_build(lod)
    bind_stamped_steel_roughness()
    apply_seam_finish(collection)
    add_vent_recesses(collection,lod)
    triangles=sum(len(o.data.polygons) for o in collection.objects if o.type=='MESH')
    return collection,triangles


base.build=patched_build


def main():
    base.main()
    qa_path=base.OUT/'AF001G_V06_DCC_QA.json'
    qa=json.loads(qa_path.read_text(encoding='utf-8'))
    qa['version']=VERSION
    qa['surface_textures']=[ROUGHNESS_FILE]
    qa['manufacturing_overlay']={
        'stamped_steel_roughness':'subtle directional 128x128 non-color roughness; no random cloud noise',
        'rolled_seams':'dedicated lower-contrast metallic seam material',
        'vent_recesses':'LOD0 two shallow recesses per side; LOD1 one per side; LOD2 omitted'
    }
    qa_path.write_text(json.dumps(qa,indent=2),encoding='utf-8')


if __name__=='__main__':
    main()
