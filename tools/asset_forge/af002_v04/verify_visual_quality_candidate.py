from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
contract = json.loads((ROOT / "visual_quality_contract.json").read_text(encoding="utf-8"))
evidence = json.loads((ROOT / "generated" / "visual_quality_evidence.json").read_text(encoding="utf-8"))

def fail(message: str) -> None:
    raise SystemExit(f"AF002_V04_FAIL {message}")

for key in ("assetId", "sku", "version", "stage", "signature"):
    if evidence.get(key) != contract.get(key): fail(f"{key} mismatch")
if evidence.get("bytes") != contract["expectedBytes"]: fail("bytes mismatch")
if evidence.get("sha256") != contract["expectedSha256"]: fail("sha256 mismatch")
if evidence.get("triangles") != contract["expectedTriangles"]: fail("triangle fingerprint mismatch")
if evidence.get("triangles", 10**9) > contract["maxTriangles"]: fail("triangle budget exceeded")
if evidence.get("socketTranslations") != contract["requiredSockets"]: fail("socket transforms changed")
features = set(evidence.get("qualityFeatures", []))
for feature in contract["requiredQualityFeatures"]:
    if feature not in features: fail(f"missing quality feature {feature}")
claims = evidence.get("claims", {})
for claim in contract["forbiddenClaims"]:
    if claims.get(claim) is not False: fail(f"forbidden claim became true: {claim}")
print(f"AF002_V04_PASS bytes={evidence['bytes']} triangles={evidence['triangles']} sha256={evidence['sha256']}")
print(contract["signature"])
