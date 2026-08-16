from __future__ import annotations

import hashlib
import json
import math
import struct
from pathlib import Path

import numpy as np
import trimesh
from trimesh.transformations import rotation_matrix

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "tools" / "asset_forge" / "af002_v02" / "generated"
OUT.mkdir(parents=True, exist_ok=True)
GLB_PATH = OUT / "AF-002_TS_MECH_SHAFT_COUPLER_A_v0.3.0-dcc-candidate.glb"
EVIDENCE_PATH = OUT / "dcc_candidate_evidence.json"

ASSET_ID = "AF-002"
SKU = "TS_MECH_SHAFT_COUPLER_A"
SIGNATURE = "Tehkné Solutions"
REQUIRED_NODES = [
    "COUPLER_HALF_IN",
    "COUPLER_HALF_OUT",
    "ELASTIC_INSERT",
    "CLAMP_SCREW_IN_A",
    "CLAMP_SCREW_IN_B",
    "CLAMP_SCREW_OUT_A",
    "CLAMP_SCREW_OUT_B",
    "SOCKET_MECH_AXIS_IN",
    "SOCKET_MECH_AXIS_OUT",
    "SOCKET_MECH_INSPECT_A",
    "SOCKET_MECH_INSPECT_B",
]

scene = trimesh.Scene()

body_mat = trimesh.visual.material.PBRMaterial(
    name="MAT_COUPLER_BODY",
    baseColorFactor=[0.72, 0.74, 0.76, 1.0],
    metallicFactor=0.85,
    roughnessFactor=0.28,
)
steel_mat = trimesh.visual.material.PBRMaterial(
    name="MAT_FASTENER_STEEL",
    baseColorFactor=[0.08, 0.09, 0.10, 1.0],
    metallicFactor=0.9,
    roughnessFactor=0.32,
)
insert_mat = trimesh.visual.material.PBRMaterial(
    name="MAT_ELASTIC_INSERT",
    baseColorFactor=[0.12, 0.12, 0.13, 1.0],
    metallicFactor=0.0,
    roughnessFactor=0.78,
)


def add(mesh: trimesh.Trimesh, name: str, material, transform=None) -> None:
    mesh.visual = trimesh.visual.TextureVisuals(material=material)
    scene.add_geometry(
        mesh,
        node_name=name,
        geom_name=name,
        transform=np.eye(4) if transform is None else transform,
    )


outer_r = 0.015
inner_r = 0.005
half_len = 0.014
gap = 0.007
z_in = -(gap / 2 + half_len / 2)
z_out = +(gap / 2 + half_len / 2)

for name, z in [("COUPLER_HALF_IN", z_in), ("COUPLER_HALF_OUT", z_out)]:
    ring = trimesh.creation.annulus(
        r_min=inner_r, r_max=outer_r, height=half_len, sections=64
    )
    transform = np.eye(4)
    transform[:3, 3] = [0, 0, z]
    add(ring, name, body_mat, transform)

insert = trimesh.creation.annulus(
    r_min=0.006, r_max=0.0135, height=gap * 0.9, sections=48
)
add(insert, "ELASTIC_INSERT", insert_mat)


def add_screw(name: str, center: list[float], axis: str) -> None:
    screw = trimesh.creation.cylinder(radius=0.0018, height=0.008, sections=24)
    if axis == "x":
        transform = rotation_matrix(math.pi / 2, [0, 1, 0])
    else:
        transform = rotation_matrix(-math.pi / 2, [1, 0, 0])
    transform[:3, 3] = center
    add(screw, name, steel_mat, transform)


for suffix, z in [("IN", z_in), ("OUT", z_out)]:
    add_screw(f"CLAMP_SCREW_{suffix}_A", [0.0125, 0, z], "x")
    add_screw(f"CLAMP_SCREW_{suffix}_B", [0, 0.0125, z], "y")

socket_transforms = {
    "SOCKET_MECH_AXIS_IN": [0.0, 0.0, -0.0175],
    "SOCKET_MECH_AXIS_OUT": [0.0, 0.0, +0.0175],
    "SOCKET_MECH_INSPECT_A": [+0.015, 0.0, 0.0],
    "SOCKET_MECH_INSPECT_B": [-0.015, 0.0, 0.0],
}
for name, position in socket_transforms.items():
    transform = np.eye(4)
    transform[:3, 3] = position
    scene.graph.update(frame_to=name, matrix=transform)

scene.metadata.update(
    assetId=ASSET_ID,
    sku=SKU,
    stage="DCC_CANDIDATE",
    signature=SIGNATURE,
)


def materialize_socket_translations(glb: bytes) -> bytes:
    """Patch only GLB JSON socket-node transforms; preserve exported mesh/BIN payloads."""
    if glb[:4] != b"glTF":
        raise RuntimeError("AF-002 generated payload is not GLB")
    version, declared_length = struct.unpack_from("<II", glb, 4)
    if version != 2 or declared_length != len(glb):
        raise RuntimeError("AF-002 generated GLB header mismatch")

    chunks: list[tuple[int, bytes]] = []
    offset = 12
    json_seen = False
    while offset + 8 <= len(glb):
        chunk_len, chunk_type = struct.unpack_from("<II", glb, offset)
        offset += 8
        payload = glb[offset : offset + chunk_len]
        offset += chunk_len
        if chunk_type == 0x4E4F534A:
            if json_seen:
                raise RuntimeError("AF-002 GLB contains multiple JSON chunks")
            document = json.loads(payload.decode("utf-8").rstrip(" \t\r\n\x00"))
            nodes = document.get("nodes", [])
            node_by_name = {node.get("name"): node for node in nodes if node.get("name")}
            missing = [name for name in socket_transforms if name not in node_by_name]
            if missing:
                raise RuntimeError("AF-002 socket nodes missing before serialization patch: " + ", ".join(missing))
            for name, position in socket_transforms.items():
                node = node_by_name[name]
                node.pop("matrix", None)
                node["translation"] = position
                node.pop("rotation", None)
                node.pop("scale", None)
            patched = json.dumps(document, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
            patched += b" " * ((4 - len(patched) % 4) % 4)
            chunks.append((chunk_type, patched))
            json_seen = True
        else:
            chunks.append((chunk_type, payload))
    if not json_seen:
        raise RuntimeError("AF-002 GLB JSON chunk missing")

    total_length = 12 + sum(8 + len(payload) for _, payload in chunks)
    output = bytearray(struct.pack("<III", 0x46546C67, 2, total_length))
    for chunk_type, payload in chunks:
        output.extend(struct.pack("<II", len(payload), chunk_type))
        output.extend(payload)
    return bytes(output)


glb = trimesh.exchange.gltf.export_glb(scene)
glb = materialize_socket_translations(glb)
GLB_PATH.write_bytes(glb)

sha256 = hashlib.sha256(glb).hexdigest()
evidence = {
    "assetId": ASSET_ID,
    "sku": SKU,
    "stage": "DCC_CANDIDATE",
    "signature": SIGNATURE,
    "generator": "trimesh-procedural-reference+deterministic-socket-json-patch",
    "bytes": len(glb),
    "sha256": sha256,
    "requiredNodes": REQUIRED_NODES,
    "socketTranslations": socket_transforms,
    "note": "Procedural DCC candidate only; socket node transforms are materialized in GLB JSON; not HERO_CANDIDATE and not manufacturing evidence.",
}
EVIDENCE_PATH.write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")

print(f"AF002_DCC_CANDIDATE GENERATED bytes={len(glb)} sha256={sha256}")
print(GLB_PATH)
print(EVIDENCE_PATH)
print(SIGNATURE)