# Tehkné Studio

Virtual Engineering Atelier by **Tehkné Solutions**.

## Current baseline

`0.1.0-alpha.1 · S1.12 + S2.21`

Tehkné Studio is an executable engineering workspace where products, components, experiments and spatial assemblies share the same engineering state instead of being disconnected demos.

### Implemented platform foundation

- canonical `EngineeringEntity`, `EngineeringGraph` and signed `.tks` project state;
- causal diagnosis, repair, failure evidence, redesign variants and prototype planning;
- persistence without replay of simulations or authored topology;
- Universal Component Library with signed extensions and overlays;
- Smartphone 01, Notebook 01, Tablet 01 and TV 01 product flows;
- Electronics Workbench with editable DC circuits, measurement, failure envelopes and multimeter evidence;
- blank invention authoring from canonical components and compatible ports;
- 3D invention workspace backed by the same Engineering Graph and `inventionSpatial` document;
- real Asset Forge rendering where a verified asset exists and explicit proxy fallback where it does not;
- direct socket authoring on physical Asset Forge sockets;
- `connectedTo`-derived mechanical assembly constraints;
- rigid assembly translation and RX/RY/RZ rotation;
- axial alignment for `mechanical.rotary-shaft` joints;
- **Rotary Joint DOF**: follower-only rotation around an already snapped and aligned shaft while the driver remains fixed;
- **Rotary Joint Relative Angle**: signed principal angle in `[-π, π]` derived directly from the existing driver/follower transforms and authored shaft axes, with no duplicate joint-angle state;
- **Multi-turn Rotary Kinematics**: explicit signed revolution memory per rotary `connectedTo` relationship, composed with the S2.20 principal angle to expose an unwrapped absolute angle across multiple turns.

## Engineering invariants

`connectedTo` remains the authoritative authored topology. Spatial wires, assembly constraints, axial constraints and rotary controls are projections of that same graph; Tehkné Studio does not maintain a parallel assembly, rotation, joint or kinematics graph.

The S2.20 principal joint angle remains **derived evidence**, not mutable state. S2.21 adds only the historical information that geometry alone cannot recover after principal-angle wrapping: an integer revolution count attached to the existing rotary relationship identity. The absolute angle is reconstructed as `revolutions × 2π + principalAngle`.

The S2.21 `inventionRotaryKinematics` extension is signed `Tehkné Solutions`, versioned and persisted in the same session snapshot. It accepts only authoritative `mechanical.rotary-shaft` `connectedTo` relationships, omits zero-revolution records, rejects ambiguous commanded steps at or above π radians and remains invariant under rigid assembly rotation.

Physics and simulation remain fail-closed. S2.21 does **not** claim RPM, angular velocity, angular acceleration or torque dynamics. Those require later explicitly modeled time/state/solver evidence.

## Asset Forge · AF-001

Current motor candidate: `TS_ELEC_MOTOR_DC_A v0.6.6-hero-candidate`.

- status: `HERO_CANDIDATE`;
- LOD0 triangles: `3,292`;
- payload: `243,848 bytes`;
- SHA-256: `65b82b78ecc038fa872a8d8ff9e6e720956cdcdec9e4e51d9eb7904adac8622c`;
- physical electrical, shaft and mount sockets are materialized in the runtime;
- AF-001L target hardware validation remains the only blocker before any `GOLDEN_ASSET` promotion.

The AF-001L gate is intentionally fail-closed: hosted CI validates its contract, while the physical benchmark requires an explicit target-hardware run and real hardware attestation.

## Verification

```bash
npm ci --ignore-scripts
npm run security:audit
npm run verify:s1.12
npm run verify:s2.21
npm run smoke:browser
```

The cumulative S2.21 CI preserves S2.14 Socket-Aware Wiring → S2.15 Direct Socket Wiring → S2.16 Mechanical Assembly → S2.17 Rigid Assembly Rotation → S2.18 Axial Joint Alignment → S2.19 Rotary Joint DOF → S2.20 Rotary Joint Relative Angle before validating S2.21 Multi-turn Rotary Kinematics, followed by the complete browser smoke and AF-001I deterministic evidence.

## Repository structure

- `apps/studio-web` — browser studio, workbenches, 3D invention and Asset Forge review surfaces;
- `packages/` — engineering, graph, session, component, persistence, spatial, invention and mechanical runtimes;
- `library/` — signed component catalog, extensions and compatibility overlays;
- `tests/domain` — deterministic domain contracts;
- `tests/browser` — Chromium product and engineering flows;
- `tools/asset_forge` — AF-001 DCC/runtime validation tooling;
- `.github/workflows` — read-only CI and explicit hardware gates.

## License

No open-source license has been granted by this repository unless a separate license file explicitly states otherwise.

**Tehkné Solutions**
