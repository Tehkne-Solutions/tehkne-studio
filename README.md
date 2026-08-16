# Tehkné Studio

Virtual Engineering Atelier by **Tehkné Solutions**.

## Current baseline

`0.1.0-alpha.1 · S1.12 + S2.27`

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
- **Rotary Joint Relative Angle**: signed principal angle in `[-π, π]` derived from driver/follower transforms and authored shaft axes;
- **Rotary Joint Target Angle**: absolute principal positioning using a `principal-shortest` delta;
- **Atomic Spatial Transform**: `transformBatch(...)` validates the complete mechanical transform set before any binding is committed;
- **Mechanical Command Runtime (S2.23)**: rotary operations run through the existing `EngineeringSession.commands` CommandBus;
- **Multi-turn Rotary Kinematics (S2.24)**: principal angle, continuous angle and integer revolutions are reconciled from `inventionSpatial + session.events` without replay;
- **Rotary Continuous Target (S2.25)**: absolute multi-turn targets such as `720°` and `−450°` use `continuous-absolute` semantics through the same CommandBus;
- **Rotary Travel Limits (S2.26)**: an optional continuous travel envelope can be authored on the authoritative `connectedTo` relationship. Incremental, principal and continuous targets are rejected fail closed before planning or spatial mutation if they would leave that envelope; a shaft with no envelope remains unlimited;
- **Rotary Segment Rate Evidence (S2.27)**: `step`, principal target and continuous target commands may carry explicit positive `durationSeconds`. The actually executed delta and that authored duration produce deterministic `segment-average` rad/s and RPM evidence. A motion command without duration remains `RATE UNRESOLVED`.

## Engineering invariants

`connectedTo` remains the authoritative authored topology. Spatial wires, assembly constraints, axial constraints, rotary controls and S2.26 travel limits are projections or metadata of that same graph; Tehkné Studio does not maintain a parallel assembly, rotation, joint, limit, revolution or rate graph.

The `inventionSpatial` document remains the only persisted physical spatial source of truth. `transformBatch(...)` prepares and validates the complete mutation set before committing. Mechanical commands do not introduce a shadow transform map or second joint state.

The mechanical runtime deliberately reuses the **existing session CommandBus**. Its rotary semantic command types are:

- `invention.mechanical.rotary.step` — signed incremental kinematic step;
- `invention.mechanical.rotary.setTarget` — absolute principal target using `principal-shortest`;
- `invention.mechanical.rotary.setContinuousTarget` — absolute continuous multi-turn target using `continuous-absolute`;
- `invention.mechanical.rotary.setTravelLimits` — author or replace an optional continuous travel envelope;
- `invention.mechanical.rotary.clearTravelLimits` — remove that envelope and restore unlimited travel.

UI, voice and automation therefore invoke the same validated operations rather than separate implementations.

### Travel-limit authority and persistence

S2.26 stores limits directly in the authoritative connection metadata under `rotaryTravelLimits`:

```text
mode = continuous
minContinuousRadians = authored minimum
maxContinuousRadians = authored maximum
signature = Tehkné Solutions
```

The graph exposes a safe `replaceRelationship(...)` primitive so relationship metadata can be updated without disconnecting/reconnecting the authored topology. Save/restore persists these limits naturally because they are part of the canonical Engineering Graph snapshot; no `travelLimitMap`, limit document or project-global state exists.

Limit authoring is dispatched through the session CommandBus and recorded as `MechanicalRotaryTravelLimitsSet` or `MechanicalRotaryTravelLimitsCleared`. Those events are audit evidence only and are intentionally excluded from the S2.24 kinematic fold, so setting or clearing a limit cannot manufacture angle, continuous travel, revolutions or S2.27 segment rate.

For any movement command, the runtime derives current continuous kinematics first, calculates the intended continuous result, reads the optional relationship envelope and applies the travel-limit check **before** `planMechanicalRotaryJointStep(...)` and before `transformBatch(...)`. Out-of-range commands are rejected rather than clamped. They produce no spatial mutation and no false movement-success event.

An authored envelope must contain the joint's current continuous position at the moment it is set. Inverted bounds and bounds that exclude the current state fail closed. Removing an envelope restores unlimited rotary travel; shafts without `rotaryTravelLimits` preserve all S2.25 behavior, including multi-turn targets such as 1080°.

### Explicit rotary segment-rate evidence

S2.27 introduces **explicit command-duration evidence**, not a hidden simulation clock. `durationSeconds` is optional and may be supplied to incremental, `principal-shortest` or `continuous-absolute` movement commands. When present it must be finite and greater than zero.

After S2.26 travel-limit validation accepts the intended continuous state, the runtime derives the completed segment's average angular rate as:

```text
averageAngularVelocityRadPerSec = deltaRadians / durationSeconds
averageRpm = averageAngularVelocityRadPerSec × 60 / (2π)
mode = segment-average
```

For `SET ANGLE`, `deltaRadians` is the actual shortest principal delta selected by S2.21. For `SET CONTINUOUS`, it is the exact multi-turn delta selected by S2.25, so a 720° command is never reduced to its principal 0° representative when rate evidence is calculated.

The successful movement event stores `durationSeconds`, the derived average rad/s, average RPM and `rateMode` beside the existing angle/revolution evidence in `session.events`. `commands.rate(relationshipId)` recomputes the **latest successful motion segment** from that persisted delta + explicit duration and fails closed if recorded rate evidence was tampered with. Save/restore therefore preserves rate evidence without command replay and without a separate rate document.

A movement command with no explicit duration records `unresolved-no-duration`; it deliberately replaces any older observable segment rate with `RATE UNRESOLVED`. By contrast, `SET LIMITS` and `CLEAR LIMITS` are not motion and do not replace the latest motion-rate evidence. A timed motion rejected by travel limits creates no success event, so it cannot publish or replace rate evidence.

S2.27 never subtracts `issuedAt`, `occurredAt`, `Date`, browser frame time or other wall-clock metadata to invent elapsed physical time. Audit timestamps remain audit timestamps.

Successful mechanical movement commands continue recording command ID, source, relationship, driver/follower, before/after principal angle, signed delta, continuous angle and revolutions. Restore reconstructs kinematics from evidence and current transforms; it does not replay commands or reapply transforms.

The S2.24 stabilization continues canonicalizing numerical zero within the established rotary epsilon. Its canonical wrap proof uses `170° → -170°`, while the exact `180°` boundary remains covered in domain regression.

Mechanical endpoint resolution remains runtime-safe outside React. Canonical mechanical local positions come from authored component metadata or explicit proxy anchors; AF-001 `shaft-out` is `[0, 0, 0.03185] m`, matching AF-001M socket-transform QA for `SOCKET_MECH_AXIS_OUT`.

Physics and simulation remain fail-closed. S2.27 now claims **segment-average angular rate and RPM only when an explicit command duration exists**. It does **not** claim instantaneous angular velocity, acceleration, torque or time integration, and it still does not simulate swept-path collision, inertia, backlash or motor dynamics.

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
npm run verify:s2.27
npm run smoke:browser
```

The cumulative S2.27 CI preserves S2.14 Socket-Aware Wiring → S2.15 Direct Socket Wiring → S2.16 Mechanical Assembly → S2.17 Rigid Assembly Rotation → S2.18 Axial Joint Alignment → S2.19 Rotary Joint DOF → S2.20 Rotary Joint Relative Angle → S2.21 Rotary Joint Target Angle → S2.22 Atomic Spatial Transform → S2.23 Mechanical Command Runtime → S2.24 Multi-turn Rotary Kinematics → S2.25 Rotary Continuous Target → S2.26 Rotary Travel Limits before validating S2.27 Rotary Segment Rate Evidence, followed by complete Chromium smoke and AF-001I deterministic evidence.

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
