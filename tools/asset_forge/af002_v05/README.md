# AF-002 v0.5 Hero-Quality Geometry Candidate

This directory contains the deterministic AF-002 v0.5 geometry-quality candidate pipeline.

The candidate is intentionally **not** runtime-integrated, **not** HERO-approved, and **not** Golden. Its purpose is to raise geometric and material-detail quality while preserving the canonical AF-002 socket transforms and engineering identity.

## Promotion discipline

A successful deterministic geometry gate is necessary but insufficient for promotion. Before any stage change, the generated GLB must pass canonical browser materialization, visual A/B review, socket preservation, runtime compatibility, performance budget, full platform regression, and explicit human visual approval where applicable.

Current pinned deterministic evidence:

- GLB bytes: `138120`
- triangles: `19520`
- SHA-256: `2eda04ec02fb31c65c2d1ecb342c18bc4d7eaedd02af9a93b676b8a66d1fc6e6`
- canonical sockets preserved: `SOCKET_MECH_AXIS_IN`, `SOCKET_MECH_AXIS_OUT`, `SOCKET_MECH_INSPECT_A`, `SOCKET_MECH_INSPECT_B`
- runtime integrated: `false`
- HERO candidate: `false`
- Golden asset: `false`

The pinned bytes/SHA were reproduced by the CI generator with Python 3.12, NumPy `2.3.5`, and trimesh `4.11.1`. Any future generator drift must fail closed until intentionally reviewed and re-pinned.

**Tehkné Solutions**
