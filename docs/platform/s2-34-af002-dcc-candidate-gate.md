# S2.34 — AF-002 DCC Candidate Deterministic Gate

S2.34 materializes the existing AF-002 procedural generator as reproducible CI evidence without promoting the asset beyond `DCC_CANDIDATE`.

## Authority chain

1. `engineering_reference.json` remains the authored engineering authority.
2. `generate_dcc_candidate.py` derives a GLB from that reference-oriented procedural model.
3. `verify_dcc_candidate.py` independently parses the GLB container and validates identity, fingerprint, required nodes, physical socket translations and LOD0 triangle budget.
4. CI generates the candidate twice in the same pinned environment and requires byte-for-byte equality plus identical SHA-256.
5. The final GLB and JSON evidence are uploaded only as CI artifacts.

## Reproducible environment

The generator dependencies are pinned in `tools/asset_forge/af002_v02/requirements.lock.txt`. S2.34 does not accept an unpinned generator environment as deterministic asset evidence.

## Required evidence

The gate fails closed unless all of the following are true:

- asset identity is `AF-002 / TS_MECH_SHAFT_COUPLER_A`;
- generated stage is exactly `DCC_CANDIDATE`;
- signature is `Tehkné Solutions`;
- every Engineering Reference required node exists in GLB JSON;
- `SOCKET_MECH_AXIS_IN` and `SOCKET_MECH_AXIS_OUT` translations match the reference exactly;
- all mesh primitives are triangles;
- total generated triangle count is positive and within the LOD0 engineering-reference budget;
- generator evidence byte count and SHA match the produced GLB;
- two independent generations produce identical bytes and SHA-256.

## Non-promotion boundary

Passing S2.34 does **not** mean `RUNTIME_CANDIDATE`, `HERO_CANDIDATE`, `GOLDEN_ASSET`, manufacturing readiness, physical torque capacity or validated RPM capability. It proves only deterministic DCC candidate generation against the current engineering-reference contract.

The next stage may consume the exact S2.34 fingerprint as the sole eligible input for runtime rendering and socket integration validation.

**Tehkné Solutions**
