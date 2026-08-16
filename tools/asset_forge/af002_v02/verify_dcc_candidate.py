from __future__ import annotations

import hashlib
import json
import math
import runpy
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
DIR = ROOT / "tools" / "asset_forge" / "af002_v02"
EVIDENCE = json.loads((DIR / "dcc_qa_evidence.json").read_text(encoding="utf-8"))
GENERATOR = DIR / "generate_dcc_candidate.py"
GLB = DIR / "generated" / "AF-002_TS_MECH_SHAFT_COUPLER_A_v0.3.0-dcc-candidate.glb"


def fail(message: str) -> None:
    raise SystemExit(f"AF002_DCC_QA BLOCKED: {message}")


def approx(a: float, b: float, eps: float = 1e-8) -> bool:
    return abs(a - b) <= eps


def parse_glb(data: bytes) -> dict:
    if data[:4] != b"glTF":
        fail("GLB magic mismatch")
    version, declared_length = struct.unpack_from("<II", data, 4)
    if version != 2:
        fail(f"GLB version {version} != 2")
    if declared_length != len(data):
        fail(f"GLB declared length {declared_length} != {len(data)}")
    offset = 12
    while offset + 8 <= len(data):
        chunk_len, chunk_type = struct.unpack_from("<II", data, offset)
        offset += 8
        chunk = data[offset : offset + chunk_len]
        offset += chunk_len
        if chunk_type == 0x4E4F534A:
            return json.loads(chunk.decode("utf-8").rstrip(" \t\r\n\x00"))
    fail("GLB JSON chunk missing")


runpy.run_path(str(GENERATOR), run_name="__main__")
if not GLB.exists():
    fail("generator did not materialize GLB")

data = GLB.read_bytes()
sha = hashlib.sha256(data).hexdigest()
if len(data) != EVIDENCE["glbBytes"]:
    fail(f"GLB bytes {len(data)} != {EVIDENCE['glbBytes']}")
if sha != EVIDENCE["glbSha256"]:
    fail(f"GLB SHA-256 {sha} != {EVIDENCE['glbSha256']}")

doc = parse_glb(data)
nodes = doc.get("nodes", [])
node_by_name = {node.get("name"): node for node in nodes if node.get("name")}
missing_nodes = [n for n in EVIDENCE["requiredNodes"] if n not in node_by_name]
if missing_nodes:
    fail("required nodes missing: " + ", ".join(missing_nodes))

materials = {m.get("name") for m in doc.get("materials", []) if m.get("name")}
missing_materials = [m for m in EVIDENCE["requiredMaterials"] if m not in materials]
if missing_materials:
    fail("required materials missing: " + ", ".join(missing_materials))

for name, expected in EVIDENCE["socketPositions"].items():
    node = node_by_name[name]
    actual = node.get("translation", [0.0, 0.0, 0.0])
    if len(actual) != 3 or any(not approx(float(a), float(b)) for a, b in zip(actual, expected)):
        fail(f"socket {name} translation {actual} != {expected}")

# Count indexed triangles from mesh primitives. Non-indexed primitives use POSITION accessor count / 3.
accessors = doc.get("accessors", [])
triangles = 0
for mesh in doc.get("meshes", []):
    for primitive in mesh.get("primitives", []):
        mode = primitive.get("mode", 4)
        if mode != 4:
            fail(f"unsupported non-triangle primitive mode {mode}")
        if "indices" in primitive:
            count = int(accessors[primitive["indices"]]["count"])
        else:
            position_accessor = primitive.get("attributes", {}).get("POSITION")
            if position_accessor is None:
                fail("primitive without indices or POSITION")
            count = int(accessors[position_accessor]["count"])
        if count % 3 != 0:
            fail(f"triangle primitive count {count} not divisible by 3")
        triangles += count // 3

max_triangles = int(EVIDENCE["limits"]["maxLod0Triangles"])
if triangles <= 0:
    fail("no triangles found")
if triangles > max_triangles:
    fail(f"LOD0 triangles {triangles} > {max_triangles}")

# Axis sockets must be coaxial, symmetric around origin and separated by the authored 35 mm envelope.
in_pos = EVIDENCE["socketPositions"]["SOCKET_MECH_AXIS_IN"]
out_pos = EVIDENCE["socketPositions"]["SOCKET_MECH_AXIS_OUT"]
if not (approx(in_pos[0], 0) and approx(in_pos[1], 0) and approx(out_pos[0], 0) and approx(out_pos[1], 0)):
    fail("axis sockets are not coaxial on +Z")
if not approx(abs(out_pos[2] - in_pos[2]), 0.035):
    fail("axis interface separation is not 35 mm")
if not approx(in_pos[2], -out_pos[2]):
    fail("axis sockets are not symmetric about origin")

claims = EVIDENCE["claims"]
if any(claims.get(key) for key in ["heroCandidate", "runtimeIntegrated", "torqueCapacity", "maxRpm", "dynamics"]):
    fail("DCC QA evidence makes an unsupported promotion/physics claim")

print(
    "AF002_DCC_QA PASS "
    f"bytes={len(data)} sha256={sha} nodes={len(EVIDENCE['requiredNodes'])} "
    f"materials={len(EVIDENCE['requiredMaterials'])} triangles={triangles}/{max_triangles}"
)
print("AF002_DCC_QA stage=DCC_QA_CANDIDATE runtime=false hero=false")
print("Tehkné Solutions")
