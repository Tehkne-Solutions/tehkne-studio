# Tehkné Studio

Virtual Engineering Atelier by **Tehkné Solutions**.

## Current baseline

`0.1.0-alpha.1 · S1.12 + S2.22`

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
- **Rotary Joint Target Angle**: absolute principal positioning using a `principal-shortest` delta derived from the current transform evidence, then applied through the existing follower-only physical planner;
- **Atomic Spatial Transform**: `transformBatch(...)` validates every position/rotation/entity in a mechanical transform set before committing any binding, so axial snap, assembly translation, rigid rotation and rotary target changes are observed as one spatial transaction.

## Engineering invariants

`connectedTo` remains the authoritative authored topology. Spatial wires, assembly constraints, axial constraints and rotary controls are projections of that same graph; Tehkné Studio does not maintain a parallel assembly, rotation or joint graph.

The `inventionSpatial` document remains the only persisted spatial source of truth. S2.22 does not add a transaction graph, shadow binding map or pending-transform state. `transformBatch(...)` prepares and validates the complete mutation set first and writes to the canonical binding map only after every entry passes. Existing `move()` and `rotate()` APIs remain backward-compatible delegates to the same atomic transform primitive.

Mechanical paths now use the atomic primitive end-to-end: automatic coincident/axial snap, multi-member assembly translation, rigid assembly rotation, incremental rotary-joint steps and absolute target-angle positioning. A rejected batch cannot expose a partially moved or partially rotated assembly.

The S2.20 joint angle remains **derived evidence**, not mutable joint state. S2.21 target values remain commands, not persisted mechanical state. Save/reload reconstructs the resulting geometry from the signed `inventionSpatial` transforms.

Multi-turn revolution counting requires an explicit future kinematics contract rather than being inferred from principal transforms.

Physics and simulation remain fail-closed. S2.22 does **not** claim RPM, angular velocity, acceleration or torque dynamics. Those require later explicitly modeled state/solver evidence.

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
npm run verify:s2.22
npm run smoke:browser
```

The cumulative S2.22 CI preserves S2.14 Socket-Aware Wiring → S2.15 Direct Socket Wiring → S2.16 Mechanical Assembly → S2.17 Rigid Assembly Rotation → S2.18 Axial Joint Alignment → S2.19 Rotary Joint DOF → S2.20 Rotary Joint Relative Angle → S2.21 Rotary Joint Target Angle before validating atomic spatial commit semantics, followed by the complete browser smoke and AF-001I deterministic evidence.

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
