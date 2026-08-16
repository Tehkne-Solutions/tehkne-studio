from __future__ import annotations
import hashlib, json, math, struct
from pathlib import Path
import numpy as np
import trimesh
from trimesh.transformations import rotation_matrix

OUT = Path(__file__).resolve().parent / "generated"
OUT.mkdir(parents=True, exist_ok=True)
GLB_PATH = OUT / "AF-002_TS_MECH_SHAFT_COUPLER_A_v0.4.0-visual-quality.glb"
EVIDENCE_PATH = OUT / "visual_quality_evidence.json"

ASSET_ID="AF-002"
SKU="TS_MECH_SHAFT_COUPLER_A"
SIGNATURE="Tehkné Solutions"
scene=trimesh.Scene()

body_mat=trimesh.visual.material.PBRMaterial(name="MAT_COUPLER_BODY",baseColorFactor=[0.56,0.59,0.62,1],metallicFactor=.92,roughnessFactor=.24)
edge_mat=trimesh.visual.material.PBRMaterial(name="MAT_COUPLER_EDGE",baseColorFactor=[0.28,0.30,0.32,1],metallicFactor=.95,roughnessFactor=.20)
steel_mat=trimesh.visual.material.PBRMaterial(name="MAT_FASTENER_STEEL",baseColorFactor=[0.055,0.060,0.065,1],metallicFactor=.95,roughnessFactor=.27)
insert_mat=trimesh.visual.material.PBRMaterial(name="MAT_ELASTIC_INSERT",baseColorFactor=[0.16,0.17,0.18,1],metallicFactor=.0,roughnessFactor=.73)

def add(mesh,name,material,transform=None):
    mesh.visual=trimesh.visual.TextureVisuals(material=material)
    scene.add_geometry(mesh,node_name=name,geom_name=name,transform=np.eye(4) if transform is None else transform)

def tx(z):
    t=np.eye(4); t[:3,3]=[0,0,z]; return t

def ann(name,rmin,rmax,h,z,mat,sections=96):
    add(trimesh.creation.annulus(r_min=rmin,r_max=rmax,height=h,sections=sections),name,mat,tx(z))

inner_r=.005
half_total=.014
gap=.007
z_in=-(gap/2+half_total/2)
z_out=+(gap/2+half_total/2)

for z,prefix in [(z_in,"IN"),(z_out,"OUT")]:
    ann(f"COUPLER_HALF_{prefix}_CORE",inner_r,.0145,.0100,z,body_mat)
    ann(f"COUPLER_HALF_{prefix}_EDGE_A",inner_r,.0150,.0020,z-.0060,edge_mat)
    ann(f"COUPLER_HALF_{prefix}_EDGE_B",inner_r,.0150,.0020,z+.0060,edge_mat)
    ann(f"COUPLER_HALF_{prefix}_COLLAR",inner_r,.01485,.0020,z,body_mat)

ann("ELASTIC_INSERT",.0062,.0128,gap*.82,0,insert_mat,sections=72)
ann("INSERT_RETENTION_RING_IN",.0061,.0132,.0007,-gap*.41,edge_mat,sections=72)
ann("INSERT_RETENTION_RING_OUT",.0061,.0132,.0007,+gap*.41,edge_mat,sections=72)

def add_screw(prefix, center, axis):
    shaft=trimesh.creation.cylinder(radius=.00145,height=.007,sections=32)
    head=trimesh.creation.cylinder(radius=.00235,height=.0021,sections=32)
    recess=trimesh.creation.cylinder(radius=.00082,height=.00045,sections=24)
    rot=rotation_matrix(math.pi/2,[0,1,0]) if axis=="x" else rotation_matrix(-math.pi/2,[1,0,0])
    tr=rot.copy(); tr[:3,3]=center; add(shaft,prefix+"_SHAFT",steel_mat,tr)
    c=np.array(center,float); c[0 if axis=="x" else 1]+=.0037
    th=rot.copy(); th[:3,3]=c; add(head,prefix+"_HEAD",steel_mat,th)
    c2=c.copy(); c2[0 if axis=="x" else 1]+=.0010
    trc=rot.copy(); trc[:3,3]=c2; add(recess,prefix+"_HEX_RECESS",insert_mat,trc)

for suffix,z in [("IN",z_in),("OUT",z_out)]:
    add_screw(f"CLAMP_SCREW_{suffix}_A",[.0120,0,z],"x")
    add_screw(f"CLAMP_SCREW_{suffix}_B",[0,.0120,z],"y")

ann("IDENTITY_BAND_IN",.01486,.01502,.00028,z_in-.0030,edge_mat,sections=96)
ann("IDENTITY_BAND_OUT",.01486,.01502,.00028,z_out+.0030,edge_mat,sections=96)

socket_transforms={
 "SOCKET_MECH_AXIS_IN":[0,0,-.0175],
 "SOCKET_MECH_AXIS_OUT":[0,0,.0175],
 "SOCKET_MECH_INSPECT_A":[.015,0,0],
 "SOCKET_MECH_INSPECT_B":[-.015,0,0],
}
for name,pos in socket_transforms.items():
    t=np.eye(4); t[:3,3]=pos; scene.graph.update(frame_to=name,matrix=t)

scene.metadata.update(assetId=ASSET_ID,sku=SKU,stage="VISUAL_QUALITY_CANDIDATE",signature=SIGNATURE)

def materialize_socket_translations(glb: bytes)->bytes:
    if glb[:4]!=b"glTF": raise RuntimeError("not GLB")
    version,total=struct.unpack_from("<II",glb,4)
    if version!=2 or total!=len(glb): raise RuntimeError("GLB header mismatch")
    chunks=[]; off=12; json_seen=False
    while off+8<=len(glb):
        n,t=struct.unpack_from("<II",glb,off); off+=8
        payload=glb[off:off+n]; off+=n
        if t==0x4E4F534A:
            doc=json.loads(payload.decode("utf-8").rstrip(" \t\r\n\x00"))
            by={node.get("name"):node for node in doc.get("nodes",[]) if node.get("name")}
            for name,pos in socket_transforms.items():
                if name not in by: raise RuntimeError(f"missing socket {name}")
                node=by[name]; node.pop("matrix",None); node["translation"]=pos; node.pop("rotation",None); node.pop("scale",None)
            payload=json.dumps(doc,separators=(",",":"),ensure_ascii=False).encode()
            payload+=b" "*((4-len(payload)%4)%4); json_seen=True
        chunks.append((t,payload))
    if not json_seen: raise RuntimeError("missing JSON")
    total=12+sum(8+len(p) for _,p in chunks)
    out=bytearray(struct.pack("<III",0x46546C67,2,total))
    for t,p in chunks: out.extend(struct.pack("<II",len(p),t)); out.extend(p)
    return bytes(out)

glb=materialize_socket_translations(trimesh.exchange.gltf.export_glb(scene))
GLB_PATH.write_bytes(glb)
triangles=sum(len(g.faces) for g in scene.geometry.values())
sha=hashlib.sha256(glb).hexdigest()
evidence={
 "assetId":ASSET_ID,"sku":SKU,"version":"0.4.0-visual-quality","stage":"VISUAL_QUALITY_CANDIDATE",
 "signature":SIGNATURE,"bytes":len(glb),"sha256":sha,"triangles":triangles,
 "socketTranslations":socket_transforms,
 "qualityFeatures":["layered-machined-body","edge-bands","central-collars","retention-rings","socket-head-fasteners","hex-recess-geometry","identity-bands"],
 "claims":{"runtimeIntegrated":False,"heroCandidate":False,"goldenAsset":False,"torqueCapacity":False,"maxRpm":False,"manufacturingCertification":False}
}
EVIDENCE_PATH.write_text(json.dumps(evidence,indent=2)+"\n",encoding="utf-8")
print(json.dumps(evidence,indent=2))
