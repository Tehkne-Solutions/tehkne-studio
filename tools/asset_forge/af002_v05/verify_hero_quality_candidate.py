from __future__ import annotations
import hashlib, json, struct
from pathlib import Path

ROOT=Path(__file__).resolve().parent
GLB=ROOT/"generated/AF-002_TS_MECH_SHAFT_COUPLER_A_v0.5.0-hero-quality.glb"
EVIDENCE=ROOT/"generated/hero_quality_evidence.json"
# Canonical fingerprint is established on the pinned Linux CI environment
# (Python 3.12, numpy 2.3.5, trimesh 4.11.1). The first gate intentionally
# failed closed and revealed the portable fingerprint below.
EXPECTED_BYTES=138120
EXPECTED_TRIANGLES=19520
EXPECTED_SHA256="2eda04ec02fb31c65c2d1ecb342c18bc4d7eaedd02af9a93b676b8a66d1fc6e6"
EXPECTED_SOCKETS={
 "SOCKET_MECH_AXIS_IN":[0,0,-.0175],
 "SOCKET_MECH_AXIS_OUT":[0,0,.0175],
 "SOCKET_MECH_INSPECT_A":[.015,0,0],
 "SOCKET_MECH_INSPECT_B":[-.015,0,0],
}
REQUIRED_FEATURES={"continuous-machined-profile","real-chamfers","machined-face-rings","six-lobe-elastic-insert","washer-head-shaft-fasteners","hex-recess-geometry","dual-metal-finishes","tehkne-witness-marks"}

def fail(msg): raise SystemExit("AF002_V05_FAIL "+msg)
if not GLB.exists() or not EVIDENCE.exists(): fail("generated payload/evidence missing")
data=GLB.read_bytes(); evidence=json.loads(EVIDENCE.read_text())
if len(data)!=EXPECTED_BYTES: fail(f"bytes {len(data)} != {EXPECTED_BYTES}")
if hashlib.sha256(data).hexdigest()!=EXPECTED_SHA256: fail("sha256 mismatch")
if evidence.get("bytes")!=EXPECTED_BYTES: fail("evidence bytes mismatch")
if evidence.get("sha256")!=EXPECTED_SHA256: fail("evidence sha256 mismatch")
if evidence.get("triangles")!=EXPECTED_TRIANGLES: fail("triangle count mismatch")
if evidence.get("socketTranslations")!=EXPECTED_SOCKETS: fail("socket transforms changed")
if not REQUIRED_FEATURES.issubset(set(evidence.get("qualityFeatures",[]))): fail("quality feature missing")
claims=evidence.get("claims",{})
for key in ["runtimeIntegrated","heroCandidate","goldenAsset","torqueCapacity","maxRpm","manufacturingCertification"]:
    if claims.get(key) is not False: fail(f"claim must remain false: {key}")
if data[:4]!=b"glTF": fail("not GLB")
version,total=struct.unpack_from("<II",data,4)
if version!=2 or total!=len(data): fail("GLB header mismatch")
print(f"AF002_V05_PASS bytes={len(data)} triangles={EXPECTED_TRIANGLES} sha256={EXPECTED_SHA256}")
print("Tehkné Solutions")
