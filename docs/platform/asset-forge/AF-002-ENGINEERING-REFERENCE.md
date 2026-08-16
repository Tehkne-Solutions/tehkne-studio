# AF-002 — TS_MECH_SHAFT_COUPLER_A

Status: ENGINEERING_REFERENCE

Signature: Tehkné Solutions

## Purpose

AF-002 is the first reusable mechanical transmission asset after AF-001. It is a coaxial modular shaft coupler intended to prove that Asset Forge geometry, physical sockets and canonical `connectedTo` topology are reusable across more than one authored physical component.

The asset is not a dynamics solver and does not claim torque transfer, compliance, inertia, backlash or RPM simulation. Those values may exist later as engineering metadata, but AF-002 v0.2.0-engineering-reference is a geometric, assembly and compatibility contract.

## Canonical identity

- Asset ID: `AF-002`
- SKU: `TS_MECH_SHAFT_COUPLER_A`
- Family: Mechanical
- Subfamily: Power Transmission
- Type: Shaft Coupler
- Variant: A
- Stage: Engineering Reference
- Units: SI; authored geometry in metres
- Handedness: right-handed
- Rotary axis: local `+Z`
- Origin: geometric centre between shaft-interface faces

## Nominal envelope

The engineering-reference nominal size is intentionally conservative and becomes authoritative only for the produced DCC candidate:

- overall diameter: `0.030 m`
- overall length: `0.035 m`
- nominal shaft bore A: `0.010 m`
- nominal shaft bore B: `0.010 m`
- centre plane: `Z = 0`
- axis-in interface plane: `Z = -0.0175 m`
- axis-out interface plane: `Z = +0.0175 m`

These values define the initial geometric contract. Torque, balance limit, angular compliance and manufacturing tolerance are explicitly unresolved in this stage and MUST NOT be invented by runtime code.

## Required DCC node topology

LOD0 must expose these named nodes:

- `COUPLER_HALF_IN`
- `COUPLER_HALF_OUT`
- `ELASTIC_INSERT`
- `CLAMP_SCREW_IN_A`
- `CLAMP_SCREW_IN_B`
- `CLAMP_SCREW_OUT_A`
- `CLAMP_SCREW_OUT_B`
- `SOCKET_MECH_AXIS_IN`
- `SOCKET_MECH_AXIS_OUT`
- `SOCKET_MECH_INSPECT_A`
- `SOCKET_MECH_INSPECT_B`

The two body halves and insert remain separate nodes in LOD0 so the educational/exploded representation can be derived without authoring a second visual source of truth.

## Socket contract

### SOCKET_MECH_AXIS_IN

- type: `mechanical.rotary-shaft`
- role: input shaft interface
- local position: `[0, 0, -0.0175] m`
- outward axis: local `-Z`
- nominal diameter: `0.010 m`
- snap semantics: coaxial axial alignment

### SOCKET_MECH_AXIS_OUT

- type: `mechanical.rotary-shaft`
- role: output shaft interface
- local position: `[0, 0, +0.0175] m`
- outward axis: local `+Z`
- nominal diameter: `0.010 m`
- snap semantics: coaxial axial alignment

### SOCKET_MECH_INSPECT_A / B

Inspection sockets are non-transmission auxiliary anchors. They may be used by measurement, exploded-view and teaching tools, but MUST NOT be treated as rotary-shaft endpoints or manufacture a `connectedTo` transmission relationship.

## Assembly invariants

1. `connectedTo` remains the only authored assembly topology.
2. AF-002 does not maintain a parallel coupler graph.
3. Shaft attachment is resolved from physical socket transforms.
4. `SOCKET_MECH_AXIS_IN` and `SOCKET_MECH_AXIS_OUT` must be collinear with local `Z`.
5. The distance between the two interface planes must equal the authored overall length within the Asset Forge socket epsilon.
6. A successful snap never mutates a driver merely to hide socket misalignment.
7. AF-002 may sit between AF-001 and another rotary component using two distinct canonical relationships.
8. Visual exploded state is presentation-only and never rewrites engineering topology.

## Mesh and LOD production contract

### LOD0 — HERO

- body halves separated
- insert separated
- clamp screws materialized
- real through-bores
- visible split/clamp geometry
- no texture-only fake holes
- target triangle budget: `<= 7,500`

### LOD1 — HIGH

- preserve silhouette, bores, split lines and shaft sockets
- clamp screws may be simplified
- target triangle budget: `<= 3,500`

### LOD2 — MEDIUM

- preserve cylindrical body and shaft bores
- small fasteners may collapse into baked detail
- target triangle budget: `<= 1,500`

### LOD3 — LOW

- map/distant representation only
- preserve overall envelope and interface direction
- target triangle budget: `<= 600`

Collision geometry must be authored separately from render geometry and may not be inferred from the full hero mesh at runtime.

## Material contract

Initial material slots:

- `MAT_COUPLER_BODY` — anodized aluminium-like PBR reference
- `MAT_FASTENER_STEEL` — dark steel-like PBR reference
- `MAT_ELASTIC_INSERT` — dark elastomer-like PBR reference

Material names describe rendering intent only. AF-002 does not yet assert alloy grade, hardness, friction coefficient or elastomer Shore value as physical simulation truth.

## DCC orientation and export

- local `+Z`: rotary axis toward `SOCKET_MECH_AXIS_OUT`
- local `+Y`: authored up
- local `+X`: authored right
- transforms applied before export
- scale = `1,1,1`
- socket nodes remain transformable named nodes in GLB
- all production nodes must have deterministic names
- no hidden duplicate body mesh may exist in exported LOD0

## Runtime acceptance target

A future AF-002 runtime gate must at minimum prove:

- GLB magic/version/declared length are valid;
- payload transport and GLB have deterministic SHA-256 fingerprints;
- all required nodes are present exactly once;
- both rotary sockets exist and are coaxial;
- socket separation matches the authored envelope;
- input/output sockets have opposite outward directions;
- the asset can participate in two canonical `connectedTo` relationships;
- AF-001 → AF-002 axial assembly resolves from physical sockets rather than proxy anchors when the verified AF-002 asset is available.

## Explicit non-claims

AF-002 Engineering Reference does not claim:

- torque capacity;
- maximum RPM;
- fatigue life;
- angular/parallel misalignment capacity;
- stiffness or damping;
- motor dynamics;
- collision sweep;
- contact forces;
- manufacturing certification.

Those require separate evidence and gates.

## Promotion path

`CONCEPT → ENGINEERING_REFERENCE → DCC_CANDIDATE → RUNTIME_CANDIDATE → HERO_CANDIDATE → GOLDEN_ASSET`

Engineering Reference is complete when this document and its machine-readable manifest agree. DCC promotion requires actual exported geometry and deterministic evidence, not concept art.

Tehkné Solutions
