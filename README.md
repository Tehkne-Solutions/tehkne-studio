# Tehkné Studio

Virtual Engineering Atelier by **Tehkné Solutions**.

## Current baseline

`0.1.0-alpha.1 · S1.12 + S2.24`

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
- **Rotary Joint Target Angle**: absolute principal positioning using a `principal-shortest` delta derived from the current transform evidence;
- **Atomic Spatial Transform**: `transformBatch(...)` validates every position/rotation/entity in a mechanical transform set before committing any binding;
- **Mechanical Command Runtime**: rotary step/target operations are dispatched through the existing `EngineeringSession.commands` `CommandBus`, preserving command source (`ui`, `voice`, `automation`, `simulation`, `system`) while reusing the same authoritative graph, planners and atomic spatial commit;
- **Multi-turn Rotary Kinematics**: continuous rotary angle and integer revolutions are derived from persisted `session.events` plus current `inventionSpatial` principal evidence, preserving command history without a parallel kinematics document or replay.

## Engineering invariants

`connectedTo` remains the authoritative authored topology. Spatial wires, assembly constraints, axial constraints and rotary controls are projections of that same graph; Tehkné Studio does not maintain a parallel assembly, rotation, kinematics or joint graph.

The `inventionSpatial` document remains the only persisted spatial source of truth. `transformBatch(...)` prepares and validates the complete mutation set first and writes to the canonical binding map only after every entry passes. Mechanical commands do not introduce a shadow transform map, command graph or second joint state.

S2.23 deliberately reuses the **existing session CommandBus** instead of creating a mechanical bus. The semantic command types are `invention.mechanical.rotary.step` and `invention.mechanical.rotary.setTarget`. UI controls are projections of those commands rather than owners of mechanical planning. The same runtime accepts `voice` and `automation` origins, so future Studio Intelligence and automation surfaces can invoke the exact same validated operation.

Successful mechanical commands record evidence in the existing `session.events` stream with command ID, source, relationship, driver/follower, principal before/after angle and signed delta. S2.24 extends that same evidence with continuous before/after angle and integer revolutions. The event stream is already part of the normal persistence snapshot, so restore folds persisted evidence without replaying commands or reapplying transforms.

`InventionMechanicalCommandRuntime.kinematics(...)` reconstructs continuous multi-turn state from `session.events + inventionSpatial`. With no prior rotary evidence, continuous angle equals the current principal angle and revolutions are zero. With evidence, each recorded command delta advances the continuous angle, while the current transform-derived principal angle remains the physical consistency check. Tampered continuous evidence fails closed.

Mechanical endpoint resolution remains runtime-safe outside React. Canonical mechanical local positions come from authored component metadata or explicit proxy anchors; AF-001 `shaft-out` is `[0, 0, 0.03185] m`, matching the AF-001M socket-transform QA for `SOCKET_MECH_AXIS_OUT`. React socket evidence remains a rendering concern, not a requirement for command execution.

The S2.20 joint angle remains **derived evidence**, not mutable joint state. S2.21 target values remain commands, not persisted mechanical state. S2.24 adds historical turns by folding the existing persisted event stream; it does not add `inventionRotaryKinematics`, project-global maps or a second source of truth.

Physics and simulation remain fail-closed. S2.24 does **not** claim RPM, angular velocity, acceleration, torque or time integration. Those require a future explicit dynamics/time contract.

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
npm run verify:s2.24
npm run smoke:browser
```

The cumulative S2.24 CI preserves S2.14 Socket-Aware Wiring → S2.15 Direct Socket Wiring → S2.16 Mechanical Assembly → S2.17 Rigid Assembly Rotation → S2.18 Axial Joint Alignment → S2.19 Rotary Joint DOF → S2.20 Rotary Joint Relative Angle → S2.21 Rotary Joint Target Angle → S2.22 Atomic Spatial Transform → S2.23 Mechanical Command Runtime before validating S2.24 Multi-turn Rotary Kinematics, followed by the complete browser smoke and AF-001I deterministic evidence.

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
