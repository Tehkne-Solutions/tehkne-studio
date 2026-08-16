from __future__ import annotations
import hashlib, json, struct
from pathlib import Path

ROOT=Path(__file__).resolve().parent
GLB=ROOT/"generated/AF-002_TS_MECH_SHAFT_COUPLER_A_v0.5.0-hero-quality.glb"
EVIDENCE=ROOT/"generated/hero_quality_evidence.json"
EXPECTED_BYTES=138136
EXPECTED_TRIANGLES=19520
EXPECTED_SHA256="b48f38c2c6d4e1d084c7c2fc1ae2cc8c09bf91dcd52cfcbf95c059f8caea3fda"
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
