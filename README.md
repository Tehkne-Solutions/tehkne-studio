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
- **Mechanical Command Runtime (S2.23)**: rotary step/target operations run through the existing `EngineeringSession.commands` `CommandBus`, preserving source (`ui`, `voice`, `automation`, `simulation`, `system`) and reusing the same authoritative graph, planners and atomic spatial commit;
- **Multi-turn Rotary Kinematics (S2.24)**: principal angle, continuous angle and integer revolutions are reconciled from the current `inventionSpatial` transform plus persisted `session.events`, without replaying commands or introducing a parallel kinematics document;
- **Rotary Segment Rate Evidence (S2.25)**: a rotary step or principal-shortest target may carry explicit `durationSeconds`; the executed delta and that authored duration produce deterministic `segment-average` rad/s and RPM evidence. Commands without duration remain `RATE UNRESOLVED`.

## Engineering invariants

`connectedTo` remains the authoritative authored topology. Spatial wires, assembly constraints, axial constraints and rotary controls are projections of that same graph; Tehkné Studio does not maintain a parallel assembly, rotation, joint, revolution or rate graph.

The `inventionSpatial` document remains the only persisted physical spatial source of truth. `transformBatch(...)` prepares and validates the complete mutation set before committing. Mechanical commands do not introduce a shadow transform map or second joint state.

S2.23 deliberately reuses the **existing session CommandBus**. The semantic command types remain `invention.mechanical.rotary.step` and `invention.mechanical.rotary.setTarget`. UI, voice and automation therefore invoke the same validated mechanical operations rather than separate implementations.

Successful mechanical commands record evidence in the existing `session.events` stream with command ID, source, relationship, driver/follower, before/after principal angle, signed delta and, from S2.24 onward, before/after continuous angle and revolutions. That stream is already part of the normal persistence snapshot. Restore reads evidence to reconstruct kinematics; it does not replay commands or reapply transforms.

S2.24 continuous state is derived by reconciling persisted command evidence with current principal transform evidence. With no prior evidence, continuous angle starts from the principal angle and revolutions are zero. Legacy S2.23 events remain compatible through their `beforeRadians + deltaRadians` evidence. Tampered continuous evidence fails closed instead of silently changing revolution count.

The S2.24 stabilization avoids using an exact `±π` target as the canonical directional test because `+π` and `-π` are equivalent shortest representatives. The canonical wrap proof uses `170° → -170°`, which has an unambiguous shortest delta of `+20°`. A separate domain regression preserves deterministic `180°` behavior after a complete turn.

S2.25 introduces **explicit command-duration evidence**, not a hidden simulation clock. `durationSeconds` is authored as part of a rotary command. The runtime derives the completed segment's average angular rate as `deltaRadians / durationSeconds` and converts that rate to RPM. It never subtracts `issuedAt`, `occurredAt`, `Date`, browser frame time or any other wall-clock metadata to manufacture physical motion evidence.

`commands.rate(relationshipId)` reconstructs only the **latest segment** from persisted `session.events`. If the latest command has no explicit positive duration, rate is `unresolved-no-duration` even if earlier commands had timed evidence and even though every event has audit timestamps. Recorded rate values are recomputed from delta + duration and tampered evidence fails closed.

The geometric transform still commits atomically. S2.25 does not animate or integrate motion across the supplied duration; the duration describes the commanded segment evidence. Therefore S2.25 does **not** claim instantaneous angular velocity, acceleration, torque or time integration. Those require a later explicit dynamics/time solver contract.

Mechanical endpoint resolution remains runtime-safe outside React. Canonical mechanical local positions come from authored component metadata or explicit proxy anchors; AF-001 `shaft-out` is `[0, 0, 0.03185] m`, matching the AF-001M socket-transform QA for `SOCKET_MECH_AXIS_OUT`.

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

The cumulative S2.25 CI preserves S2.14 Socket-Aware Wiring → S2.15 Direct Socket Wiring → S2.16 Mechanical Assembly → S2.17 Rigid Assembly Rotation → S2.18 Axial Joint Alignment → S2.19 Rotary Joint DOF → S2.20 Rotary Joint Relative Angle → S2.21 Rotary Joint Target Angle → S2.22 Atomic Spatial Transform → S2.23 Mechanical Command Runtime → S2.24 Multi-turn Rotary Kinematics before validating S2.25 Rotary Segment Rate Evidence, followed by the complete Chromium smoke and AF-001I deterministic evidence.

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
