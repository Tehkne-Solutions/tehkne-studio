import json
from pathlib import Path

import bpy
import numpy as np

import build_golden_motor_v06 as base

VERSION='0.6.4-dcc-candidate'
ROUGHNESS_NAME='TS_MOTOR_STAMPED_STEEL_ROUGHNESS'
ROUGHNESS_FILE='TS_MOTOR_STAMPED_STEEL_ROUGHNESS.png'

base.VERSION=VERSION
original_build=base.build


def ensure_roughness_texture():
    img=bpy.data.images.get(ROUGHNESS_NAME)
    if img is not None:
        return img
    size=128
    rng=np.random.default_rng(604)
    y=np.arange(size,dtype=np.float32)[:,None]
    grain=0.34 + 0.016*np.sin(y*0.92) + rng.normal(0,0.010,(size,size)).astype(np.float32)
    grain=np.clip(grain,0.27,0.43)
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
        tex.label='AF001 authored stamped-steel roughness'
    tex.image=ensure_roughness_texture()
    # idempotent: replace any old roughness link with the authoritative texture.
    for link in list(bsdf.inputs['Roughness'].links):
        links.remove(link)
    links.new(tex.outputs['Color'],bsdf.inputs['Roughness'])


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
            # Runtime dimensions: 80 µm shell depth × 2 mm height × 4 mm length.
            # After (x,-z,y) conversion the Blender dimensions are x, z-length, y-height.
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
        'stamped_steel_roughness':'authored 128x128 non-color roughness map',
        'vent_recesses':'LOD0 two shallow recesses per side; LOD1 one per side; LOD2 omitted'
    }
    qa_path.write_text(json.dumps(qa,indent=2),encoding='utf-8')


if __name__=='__main__':
    main()
