from __future__ import annotations
import hashlib, json, math, struct
from pathlib import Path
import numpy as np
import trimesh
from trimesh.transformations import rotation_matrix

OUT=Path(__file__).resolve().parent/"generated"
OUT.mkdir(parents=True,exist_ok=True)
GLB_PATH=OUT/"AF-002_TS_MECH_SHAFT_COUPLER_A_v0.5.0-hero-quality.glb"
EVIDENCE_PATH=OUT/"hero_quality_evidence.json"
ASSET_ID="AF-002"; SKU="TS_MECH_SHAFT_COUPLER_A"; SIGNATURE="Tehkné Solutions"
scene=trimesh.Scene()

def pbr(name,color,metal,rough):
    return trimesh.visual.material.PBRMaterial(name=name,baseColorFactor=color,metallicFactor=metal,roughnessFactor=rough)
body=pbr("MAT_BODY_SATIN",[0.50,0.53,0.56,1],.92,.22)
cut=pbr("MAT_BODY_CUT",[0.68,0.70,0.72,1],.96,.16)
edge=pbr("MAT_DARK_ANODIZED",[0.11,0.12,0.13,1],.88,.24)
steel=pbr("MAT_FASTENER_STEEL",[0.045,0.05,0.055,1],.96,.20)
insert=pbr("MAT_ELASTIC_INSERT",[0.13,0.14,0.15,1],0,.70)
mark=pbr("MAT_TEHKNE_MARK",[0.30,0.22,0.09,1],.85,.26)

def add(mesh,name,material,transform=None):
    mesh.visual=trimesh.visual.TextureVisuals(material=material)
    scene.add_geometry(mesh,node_name=name,geom_name=name,transform=np.eye(4) if transform is None else transform)

def ztx(z):
    t=np.eye(4); t[:3,3]=[0,0,z]; return t

def ann(name,rmin,rmax,h,z,material,sections=128):
    add(trimesh.creation.annulus(r_min=rmin,r_max=rmax,height=h,sections=sections),name,material,ztx(z))

INNER=.005
Z_IN=-.0105; Z_OUT=.0105

def machined_half(name,zc):
    zvals=np.array([-.0070,-.0063,-.0056,-.0047,-.0022,0,.0022,.0047,.0056,.0063,.0070])
    rvals=np.array([.0138,.0147,.0150,.01465,.01445,.01475,.01445,.01465,.0150,.0147,.0138])
    pts=[[r,z] for r,z in zip(rvals,zvals)] + [[INNER,zvals[-1]],[INNER,zvals[0]]]
    add(trimesh.creation.revolve(np.array(pts),sections=128),name,body,ztx(zc))
    ann(name+"_FACE_A",.0052,.0138,.00035,zc-.0066,cut)
    ann(name+"_FACE_B",.0052,.0138,.00035,zc+.0066,cut)
    ann(name+"_DARK_BAND",.01462,.01503,.00042,zc-.00495,edge)
    ann(name+"_IDENTITY",.01455,.01495,.00030,zc+.00315,mark)

machined_half("COUPLER_HALF_IN",Z_IN)
machined_half("COUPLER_HALF_OUT",Z_OUT)
ann("ELASTIC_INSERT_CORE",.0061,.0112,.0053,0,insert,96)
ann("INSERT_RETENTION_IN",.0060,.0130,.0006,-.0030,edge,96)
ann("INSERT_RETENTION_OUT",.0060,.0130,.0006,.0030,edge,96)
for i in range(6):
    a=2*math.pi*i/6
    lobe=trimesh.creation.box(extents=[.0046,.0032,.0048])
    t=rotation_matrix(a,[0,0,1]); t[:3,3]=[math.cos(a)*.0102,math.sin(a)*.0102,0]
    add(lobe,f"ELASTIC_INSERT_LOBE_{i+1}",insert,t)

def screw(prefix,center,axis):
    rot=rotation_matrix(math.pi/2,[0,1,0]) if axis=="x" else rotation_matrix(-math.pi/2,[1,0,0])
    idx=0 if axis=="x" else 1
    shaft=trimesh.creation.cylinder(radius=.00135,height=.0066,sections=40)
    t=rot.copy(); t[:3,3]=center; add(shaft,prefix+"_SHAFT",steel,t)
    c=np.array(center,float); c[idx]+=.00355
    washer=trimesh.creation.annulus(r_min=.00145,r_max=.00255,height=.00042,sections=40)
    tw=rot.copy(); tw[:3,3]=c; add(washer,prefix+"_WASHER",cut,tw)
    c[idx]+=.00072
    head=trimesh.creation.cylinder(radius=.00235,height=.0019,sections=48)
    th=rot.copy(); th[:3,3]=c; add(head,prefix+"_HEAD",steel,th)
    c2=c.copy(); c2[idx]+=.0010
    recess=trimesh.creation.cylinder(radius=.00078,height=.00035,sections=6)
    tr=rot.copy(); tr[:3,3]=c2; add(recess,prefix+"_HEX_RECESS",insert,tr)

for suffix,z in [("IN",Z_IN),("OUT",Z_OUT)]:
    screw(f"CLAMP_SCREW_{suffix}_A",[.0117,0,z],"x")
    screw(f"CLAMP_SCREW_{suffix}_B",[0,.0117,z],"y")
for i,a in enumerate([0,math.pi]):
    witness=trimesh.creation.box(extents=[.0010,.0034,.00045])
    t=rotation_matrix(a,[0,0,1]); t[:3,3]=[math.cos(a)*.0149,math.sin(a)*.0149,0]
    add(witness,f"TEHKNE_WITNESS_{i+1}",mark,t)

SOCKETS={
 "SOCKET_MECH_AXIS_IN":[0,0,-.0175],
 "SOCKET_MECH_AXIS_OUT":[0,0,.0175],
 "SOCKET_MECH_INSPECT_A":[.015,0,0],
 "SOCKET_MECH_INSPECT_B":[-.015,0,0],
}
for name,pos in SOCKETS.items():
    t=np.eye(4); t[:3,3]=pos; scene.graph.update(frame_to=name,matrix=t)
scene.metadata.update(assetId=ASSET_ID,sku=SKU,stage="HERO_QUALITY_CANDIDATE",signature=SIGNATURE)

def materialize(glb:bytes)->bytes:
    if glb[:4]!=b"glTF": raise RuntimeError("not GLB")
    chunks=[]; off=12; seen=False
    while off+8<=len(glb):
        n,t=struct.unpack_from("<II",glb,off); off+=8
        payload=glb[off:off+n]; off+=n
        if t==0x4E4F534A:
            doc=json.loads(payload.decode().rstrip(" \t\r\n\x00"))
            by={node.get("name"):node for node in doc.get("nodes",[]) if node.get("name")}
            for name,pos in SOCKETS.items():
                if name not in by: raise RuntimeError("missing socket "+name)
                node=by[name]; node.pop("matrix",None); node["translation"]=pos; node.pop("rotation",None); node.pop("scale",None)
            payload=json.dumps(doc,separators=(",",":"),ensure_ascii=False).encode(); payload+=b" "*((4-len(payload)%4)%4); seen=True
        chunks.append((t,payload))
    if not seen: raise RuntimeError("missing JSON")
    total=12+sum(8+len(p) for _,p in chunks)
    out=bytearray(struct.pack("<III",0x46546C67,2,total))
    for t,p in chunks: out.extend(struct.pack("<II",len(p),t)); out.extend(p)
    return bytes(out)

glb=materialize(trimesh.exchange.gltf.export_glb(scene))
GLB_PATH.write_bytes(glb)
triangles=sum(len(g.faces) for g in scene.geometry.values())
sha=hashlib.sha256(glb).hexdigest()
evidence={
 "assetId":ASSET_ID,"sku":SKU,"version":"0.5.0-hero-quality","stage":"HERO_QUALITY_CANDIDATE",
 "signature":SIGNATURE,"bytes":len(glb),"sha256":sha,"triangles":triangles,"socketTranslations":SOCKETS,
 "qualityFeatures":["continuous-machined-profile","real-chamfers","machined-face-rings","six-lobe-elastic-insert","washer-head-shaft-fasteners","hex-recess-geometry","dual-metal-finishes","tehkne-witness-marks"],
 "claims":{"runtimeIntegrated":False,"heroCandidate":False,"goldenAsset":False,"torqueCapacity":False,"maxRpm":False,"manufacturingCertification":False}
}
EVIDENCE_PATH.write_text(json.dumps(evidence,indent=2)+"\n",encoding="utf-8")
print(json.dumps(evidence,indent=2))
