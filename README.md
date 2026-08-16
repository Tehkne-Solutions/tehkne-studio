# Tehkné Studio

Virtual Engineering Atelier by **Tehkné Solutions**.

## Current baseline

`0.1.0-alpha.1 · S1.12 + S2.25`

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
- **Rotary Joint Relative Angle**: signed principal angle in `[-π, π]` derived directly from driver/follower transforms and authored shaft axes; it remains derived evidence, not duplicated joint state;
- **Rotary Joint Target Angle**: absolute principal positioning using a `principal-shortest` delta derived from current transform evidence;
- **Atomic Spatial Transform**: `transformBatch(...)` validates the complete mechanical transform set before any binding is committed;
- **Mechanical Command Runtime (S2.23)**: rotary operations run through the existing `EngineeringSession.commands` `CommandBus`, preserving source (`ui`, `voice`, `automation`, `simulation`, `system`) and reusing the same authoritative graph, planners and atomic spatial commit;
- **Multi-turn Rotary Kinematics (S2.24)**: principal angle, continuous angle and integer revolutions are reconciled from the current `inventionSpatial` transform plus persisted `session.events`, without replaying commands or introducing a parallel kinematics document;
- **Rotary Continuous Target (S2.25)**: a rotary joint can now receive an absolute multi-turn target such as `720°` or `−450°`; the runtime computes the exact continuous delta, dispatches it through the same CommandBus and records the resulting principal angle, continuous angle and revolutions as auditable evidence.

## Engineering invariants

`connectedTo` remains the authoritative authored topology. Spatial wires, assembly constraints, axial constraints and rotary controls are projections of that same graph; Tehkné Studio does not maintain a parallel assembly, rotation, joint or revolution graph.

The `inventionSpatial` document remains the only persisted physical spatial source of truth. `transformBatch(...)` prepares and validates the complete mutation set before committing. Mechanical commands do not introduce a shadow transform map or second joint state.

The mechanical runtime deliberately reuses the **existing session CommandBus**. Its rotary semantic command types are:

- `invention.mechanical.rotary.step` — signed incremental kinematic step;
- `invention.mechanical.rotary.setTarget` — absolute **principal** target using `principal-shortest`;
- `invention.mechanical.rotary.setContinuousTarget` — absolute **continuous** multi-turn target using `continuous-absolute`.

UI, voice and automation therefore invoke the same validated mechanical operations rather than separate implementations.

Successful mechanical commands record audit evidence in the existing `session.events` stream with command ID, source, relationship, driver/follower, before/after principal angle, signed delta, before/after continuous angle and revolutions. That stream is already part of the normal persistence snapshot. Restore reads evidence to reconstruct kinematics; it does not replay commands or reapply transforms.

S2.24 continuous state is derived by reconciling persisted command evidence with current principal transform evidence. With no prior evidence, continuous angle starts from the principal angle and revolutions are zero. Legacy S2.23 events remain compatible through their `beforeRadians + deltaRadians` evidence. Tampered continuous evidence fails closed instead of silently changing revolution count.

The S2.24 stabilization canonicalizes numerical zero within the established rotary epsilon. The canonical wrap proof uses `170° → -170°`, whose shortest delta is unambiguously `+20°`; the exact `180°` boundary remains covered in domain regression.

S2.25 does **not** reinterpret a continuous target as a shortest principal target. If the joint is at `0°` continuous and receives `720°`, its command delta is `+720°` and the resulting state is principal `0°`, continuous `720°`, revolutions `2`. From there, an absolute target of `−450°` commands `−1170°`, ending at principal `−90°`, continuous `−450°`, revolutions `−1`. This is an exact kinematic state change, not a time-resolved motor simulation.

Mechanical endpoint resolution remains runtime-safe outside React. Canonical mechanical local positions come from authored component metadata or explicit proxy anchors; AF-001 `shaft-out` is `[0, 0, 0.03185] m`, matching the AF-001M socket-transform QA for `SOCKET_MECH_AXIS_OUT`.

Physics and simulation remain fail-closed. S2.25 is **kinematics only**: it does not claim elapsed time, RPM, angular velocity, angular acceleration, torque, swept-path collision or motor dynamics.

## Asset Forge · AF-001

Current motor candidate: `TS_ELEC_MOTOR_DC_A v0.6.6-hero-candidate`.

- status: `HERO_CANDIDATE`;
- LOD0 triangles: `3,292`;
- payload: `243,848 bytes`;
- SHA-256: `65b82b78ecc038fa872a8d8ff9e6e720956cdcdec9e4e51d9eb7904adac8622c`;
- physical electrical, shaft and mount sockets are materialized in the runtime;
- AF-001L target hardware validation remains the only blocker before any `GOLDEN_ASSET` promotion.

The AF-001L gate remains intentionally fail-closed: hosted CI validates its contract while the physical benchmark requires explicit target-hardware execution and real hardware attestation.

## Verification

```bash
npm ci --ignore-scripts
npm run security:audit
npm run verify:s1.12
npm run verify:s2.25
npm run smoke:browser
```

The cumulative S2.25 CI preserves S2.14 Socket-Aware Wiring → S2.15 Direct Socket Wiring → S2.16 Mechanical Assembly → S2.17 Rigid Assembly Rotation → S2.18 Axial Joint Alignment → S2.19 Rotary Joint DOF → S2.20 Rotary Joint Relative Angle → S2.21 Rotary Joint Target Angle → S2.22 Atomic Spatial Transform → S2.23 Mechanical Command Runtime → S2.24 Multi-turn Rotary Kinematics before validating S2.25 Rotary Continuous Target, followed by the complete Chromium smoke and AF-001I deterministic evidence.

## Repository structure

- `apps/studio-web` — browser studio, workbenches, 3D invention and Asset Forge review surfaces;
- `packages/` — engineering, graph, session, component, persistence, spatial, invention, mechanical and command runtimes;
- `library/` — signed component catalog, extensions and compatibility overlays;
- `tests/domain` — deterministic domain contracts;
- `tests/browser` — Chromium product and engineering flows;
- `tools/asset_forge` — AF-001 DCC/runtime validation tooling;
- `.github/workflows` — read-only CI and explicit hardware gates.

## License

No open-source license has been granted by this repository unless a separate license file explicitly states otherwise.

**Tehkné Solutions**
