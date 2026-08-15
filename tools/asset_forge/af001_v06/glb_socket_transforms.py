import json
import struct
from pathlib import Path

SIGNATURE = "Tehkné Solutions"
GLB_MAGIC = 0x46546C67
GLB_VERSION = 2
JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942

SOCKET_TRANSLATIONS = {
    "SOCKET_MECH_AXIS_OUT": [0, 0, 0.03185],
    "SOCKET_MECH_MOUNT_FRONT": [0, 0, 0.01655],
    "SOCKET_ELEC_POWER_POS": [-0.0047, -0.00085, -0.01936],
    "SOCKET_ELEC_POWER_NEG": [0.0047, -0.00085, -0.01936],
}


def _parse_glb(payload: bytes):
    if len(payload) < 28:
        raise ValueError("AF-001 GLB is truncated")
    magic, version, total_length = struct.unpack_from("<III", payload, 0)
    if magic != GLB_MAGIC or version != GLB_VERSION or total_length != len(payload):
        raise ValueError("AF-001 GLB header mismatch")

    json_length, json_type = struct.unpack_from("<II", payload, 12)
    if json_type != JSON_CHUNK:
        raise ValueError("AF-001 GLB first chunk must be JSON")
    json_start = 20
    json_end = json_start + json_length
    if json_end + 8 > len(payload):
        raise ValueError("AF-001 GLB JSON chunk exceeds payload")

    bin_length, bin_type = struct.unpack_from("<II", payload, json_end)
    if bin_type != BIN_CHUNK:
        raise ValueError("AF-001 GLB second chunk must be BIN")
    bin_start = json_end + 8
    bin_end = bin_start + bin_length
    if bin_end != len(payload):
        raise ValueError("AF-001 GLB must contain exactly JSON + BIN chunks")

    document = json.loads(payload[json_start:json_end].rstrip(b" ").decode("utf-8"))
    return document, payload[bin_start:bin_end]


def _serialize_glb(document, binary_chunk: bytes) -> bytes:
    json_payload = json.dumps(document, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    json_payload += b" " * ((-len(json_payload)) % 4)
    total_length = 12 + 8 + len(json_payload) + 8 + len(binary_chunk)
    return b"".join(
        (
            struct.pack("<III", GLB_MAGIC, GLB_VERSION, total_length),
            struct.pack("<II", len(json_payload), JSON_CHUNK),
            json_payload,
            struct.pack("<II", len(binary_chunk), BIN_CHUNK),
            binary_chunk,
        )
    )


def patch_socket_transforms(path: Path) -> dict:
    document, binary_chunk = _parse_glb(path.read_bytes())
    nodes = document.get("nodes")
    if not isinstance(nodes, list):
        raise ValueError("AF-001 GLB nodes are missing")

    patched = {}
    for socket_name, translation in SOCKET_TRANSLATIONS.items():
        matches = [node for node in nodes if node.get("name") == socket_name]
        if len(matches) != 1:
            raise ValueError(f"AF-001 requires exactly one {socket_name} node; found {len(matches)}")
        matches[0]["translation"] = list(translation)
        patched[socket_name] = list(translation)

    path.write_bytes(_serialize_glb(document, binary_chunk))
    return patched


def inspect_socket_transforms(path: Path) -> dict:
    document, _ = _parse_glb(path.read_bytes())
    nodes = document.get("nodes")
    if not isinstance(nodes, list):
        raise ValueError("AF-001 GLB nodes are missing")
    evidence = {}
    for socket_name, expected in SOCKET_TRANSLATIONS.items():
        matches = [node for node in nodes if node.get("name") == socket_name]
        if len(matches) != 1:
            raise ValueError(f"AF-001 requires exactly one {socket_name} node; found {len(matches)}")
        actual = matches[0].get("translation")
        if not isinstance(actual, list) or len(actual) != 3:
            raise ValueError(f"AF-001 {socket_name} translation missing")
        if any(abs(float(a) - float(b)) > 1e-7 for a, b in zip(actual, expected)):
            raise ValueError(f"AF-001 {socket_name} translation mismatch: {actual} != {expected}")
        evidence[socket_name] = list(actual)
    return evidence