# AF-002 v0.5 Hero-Quality Geometry Candidate

This directory contains the deterministic AF-002 v0.5 geometry-quality candidate pipeline.

The candidate is intentionally **not** runtime-integrated, **not** HERO-approved, and **not** Golden. Its purpose is to raise geometric and material-detail quality while preserving the canonical AF-002 socket transforms and engineering identity.

## Promotion discipline

A successful deterministic geometry gate is necessary but insufficient for promotion. Before any stage change, the generated GLB must pass canonical browser materialization, visual A/B review, socket preservation, runtime compatibility, performance budget, full platform regression, and explicit human visual approval where applicable.

Current expected deterministic evidence:

- GLB bytes: `138136`
- triangles: `19520`
- SHA-256: `b48f38c2c6d4e1d084c7c2fc1ae2cc8c09bf91dcd52cfcbf95c059f8caea3fda`
- canonical sockets preserved: `SOCKET_MECH_AXIS_IN`, `SOCKET_MECH_AXIS_OUT`, `SOCKET_MECH_INSPECT_A`, `SOCKET_MECH_INSPECT_B`
- runtime integrated: `false`
- HERO candidate: `false`
- Golden asset: `false`

**Tehkné Solutions**
