# AF-002 Runtime Candidate

`TS_MECH_SHAFT_COUPLER_A` is promoted from deterministic DCC QA evidence into a Studio runtime candidate without changing its engineering authority.

The runtime endpoint serves the exact socket-materialized GLB fingerprint promoted by AF-002 DCC QA: `22600 bytes`, SHA-256 `48e8363cdc38b5ae93ace0b975c42498663e03c922970fb2b60e80c65d26b50e`.

The component extension now points to `/api/asset-forge/af002/coupler`. The procedural proxy remains available only as an explicit fallback. `engineering_reference.json` and `dcc_qa_evidence.json` remain the dimensional and DCC authorities; the runtime payload does not create a second geometry or socket contract.

This stage claims runtime payload availability, physical socket materialization and deterministic integrity only. It does not claim HERO/GOLDEN status, torque capacity, maximum RPM, misalignment capacity, stiffness, damping, backlash, inertia, manufacturing certification or physical dynamics.

The next gate must prove Studio rendering and AF-001 `shaft-out` → AF-002 `axis-in` snapping/alignment through canonical `connectedTo` assembly semantics.

**Tehkné Solutions**
