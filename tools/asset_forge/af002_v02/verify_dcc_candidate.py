from __future__ import annotations

import hashlib
import json
import math
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / "tools" / "asset_forge" / "af002_v02"
REFERENCE_PATH = BASE / "engineering_reference.json"
GLB_PATH = BASE / "generated" / "AF-002_TS_MECH_SHAFT_COUPLER_A_v0.3.0-dcc-candidate.glb"
EVIDENCE_PATH = BASE / "generated" / "dcc_candidate_evidence.json"
SIGNATURE = "Tehkné Solutions"


def read_glb_json(path: Path) -> tuple[dict, int]:
    raw = path.read_bytes()
    if len(raw) < 20:
        raise RuntimeError("AF-002 GLB is truncated")
    magic, version, total_length = struct.unpack_from("<4sII", raw, 0)
    if magic != b"glTF" or version != 2 or total_length != len(raw):
        raise RuntimeError("AF-002 GLB header mismatch")
    json_length, json_type = struct.unpack_from("<I4s", raw, 12)
    if json_type != b"JSON":
        raise RuntimeError("AF-002 GLB first chunk must be JSON")
    start = 20
    document = json.loads(raw[start : start + json_length].decode("utf-8").rstrip(" \t\r\n\x00"))
    return document, len(raw)


def vector_close(actual: list[float], expected: list[float], epsilon: float = 1e-9) -> bool:
    return len(actual) == len(expected) and all(math.isclose(float(a), float(b), abs_tol=epsilon) for a, b in zip(actual, expected))


def triangle_count(document: dict) -> int:
    accessors = document.get("accessors", [])
    total = 0
    for mesh in document.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            mode = primitive.get("mode", 4)
            if mode != 4:
                raise RuntimeError(f"AF-002 primitive mode must be TRIANGLES, got {mode}")
            index_accessor = primitive.get("indices")
            if index_accessor is None:
                position_accessor = primitive.get("attributes", {}).get("POSITION")
                if position_accessor is None:
                    raise RuntimeError("AF-002 primitive lacks indices and POSITION")
                count = int(accessors[position_accessor]["count"])
            else:
                count = int(accessors[index_accessor]["count"])
            if count % 3 != 0:
                raise RuntimeError("AF-002 triangle primitive index count is not divisible by 3")
            total += count // 3
    return total


reference = json.loads(REFERENCE_PATH.read_text(encoding="utf-8"))
evidence = json.loads(EVIDENCE_PATH.read_text(encoding="utf-8"))
document, payload_bytes = read_glb_json(GLB_PATH)
sha256 = hashlib.sha256(GLB_PATH.read_bytes()).hexdigest()

if reference.get("assetId") != "AF-002" or evidence.get("assetId") != "AF-002":
    raise RuntimeError("AF-002 identity mismatch")
if reference.get("sku") != "TS_MECH_SHAFT_COUPLER_A" or evidence.get("sku") != reference.get("sku"):
    raise RuntimeError("AF-002 SKU mismatch")
if reference.get("signature") != SIGNATURE or evidence.get("signature") != SIGNATURE:
    raise RuntimeError("AF-002 signature mismatch")
if evidence.get("stage") != "DCC_CANDIDATE":
    raise RuntimeError("AF-002 generated stage must remain DCC_CANDIDATE")
if evidence.get("generator") != "trimesh-procedural-reference":
    raise RuntimeError("AF-002 generator provenance mismatch")
if evidence.get("bytes") != payload_bytes or evidence.get("sha256") != sha256:
    raise RuntimeError("AF-002 generated fingerprint evidence mismatch")

nodes = document.get("nodes", [])
node_by_name = {node.get("name"): node for node in nodes if isinstance(node.get("name"), str)}
required_nodes = reference.get("requiredNodes", [])
missing = [name for name in required_nodes if name not in node_by_name]
if missing:
    raise RuntimeError(f"AF-002 GLB missing required nodes: {missing}")
if sorted(evidence.get("requiredNodes", [])) != sorted(required_nodes):
    raise RuntimeError("AF-002 evidence required-node list diverges from engineering reference")

for socket_name in ("SOCKET_MECH_AXIS_IN", "SOCKET_MECH_AXIS_OUT"):
    expected_socket = next((entry for entry in reference.get("sockets", []) if entry.get("name") == socket_name), None)
    if expected_socket is None:
        raise RuntimeError(f"AF-002 reference missing {socket_name}")
    node = node_by_name[socket_name]
    translation = node.get("translation", [0.0, 0.0, 0.0])
    if not vector_close(translation, expected_socket["position"]):
        raise RuntimeError(f"AF-002 socket translation mismatch: {socket_name} {translation} != {expected_socket['position']}")

triangles = triangle_count(document)
lod0 = next((entry for entry in reference.get("lods", []) if entry.get("name") == "LOD0"), None)
if not lod0:
    raise RuntimeError("AF-002 LOD0 budget missing")
if triangles <= 0 or triangles > int(lod0["maxTriangles"]):
    raise RuntimeError(f"AF-002 LOD0 triangle budget exceeded: {triangles} > {lod0['maxTriangles']}")

extras = document.get("asset", {}).get("extras", {})
scene_extras = document.get("scenes", [{}])[document.get("scene", 0)].get("extras", {}) if document.get("scenes") else {}
metadata_candidates = [extras, scene_extras]
if any(candidate.get("stage") in {"RUNTIME_CANDIDATE", "HERO_CANDIDATE", "GOLDEN_ASSET"} for candidate in metadata_candidates if isinstance(candidate, dict)):
    raise RuntimeError("AF-002 DCC gate cannot contain promoted runtime/hero/golden stage")

result = {
    "assetId": "AF-002",
    "sku": reference["sku"],
    "stage": "DCC_CANDIDATE",
    "bytes": payload_bytes,
    "sha256": sha256,
    "triangles": triangles,
    "requiredNodeCount": len(required_nodes),
    "socketCountValidated": 2,
    "verdict": "DCC_CANDIDATE_PASS",
    "signature": SIGNATURE,
}
print(json.dumps(result, indent=2))
