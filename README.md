# Tehkné Studio

Virtual Engineering Atelier by **Tehkné Solutions**.

## Current baseline

`0.1.0-alpha.1 · S1.12 + S2.28`

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
- **Rotary Home Position (S2.27)**: the current continuous joint coordinate can be captured as an authored HOME on the same `connectedTo` relationship. `GO HOME` delegates movement to the canonical `setContinuousTarget` path, so S2.26 limits, atomic transforms and persisted movement evidence remain authoritative;
- **Rotary Segment Rate Evidence (S2.28)**: actual movement commands may carry explicit positive `durationSeconds`. The executed angular delta divided by that authored duration produces deterministic `segment-average` rad/s and RPM evidence. Without duration, the latest motion rate remains explicitly `RATE UNRESOLVED`.

## Engineering invariants

`connectedTo` remains the authoritative authored topology. Spatial wires, assembly constraints, axial constraints, rotary controls, S2.26 travel limits and S2.27 HOME are projections or metadata of that same graph; Tehkné Studio does not maintain a parallel assembly, rotation, joint, limit, home, revolution or rate graph.

The `inventionSpatial` document remains the only persisted physical spatial source of truth. `transformBatch(...)` prepares and validates the complete mutation set before committing. Mechanical commands do not introduce a shadow transform map or second joint state.

The mechanical runtime deliberately reuses the **existing session CommandBus**. Its rotary semantic command types are:

- `invention.mechanical.rotary.step` — signed incremental kinematic step;
- `invention.mechanical.rotary.setTarget` — absolute principal target using `principal-shortest`;
- `invention.mechanical.rotary.setContinuousTarget` — absolute continuous multi-turn target using `continuous-absolute`;
- `invention.mechanical.rotary.setTravelLimits` — author or replace an optional continuous travel envelope;
- `invention.mechanical.rotary.clearTravelLimits` — remove that envelope and restore unlimited travel;
- `invention.mechanical.rotary.setHome` — capture the current continuous coordinate as HOME;
- `invention.mechanical.rotary.goHome` — resolve the authored HOME and delegate movement to `setContinuousTarget`;
- `invention.mechanical.rotary.clearHome` — remove the authored HOME reference.

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

Limit authoring is itself dispatched through the session CommandBus and recorded as `MechanicalRotaryTravelLimitsSet` or `MechanicalRotaryTravelLimitsCleared`. Those events are audit evidence only and are intentionally excluded from the S2.24 kinematic fold, so setting or clearing a limit cannot manufacture angle, continuous travel, revolutions or segment rate.

For any movement command, the runtime derives current continuous kinematics first, calculates the intended continuous result, reads the optional relationship envelope and applies the travel-limit check **before** rate derivation, `planMechanicalRotaryJointStep(...)` and `transformBatch(...)`. Out-of-range commands are rejected rather than clamped. They produce no spatial mutation, no false movement-success event and no replacement rate evidence.

An authored envelope must contain the joint's current continuous position at the moment it is set. Inverted bounds and bounds that exclude the current state fail closed. Removing an envelope restores unlimited rotary travel; shafts without `rotaryTravelLimits` preserve all S2.25 behavior, including multi-turn targets such as 1080°.

### HOME authority and persistence

S2.27 stores HOME directly in the same authoritative connection metadata under `rotaryHome`:

```text
mode = continuous
homeContinuousRadians = captured current continuous coordinate
signature = Tehkné Solutions
```

`SET HOME` captures the already-derived continuous coordinate and updates only relationship metadata. It does not rotate the joint and its `MechanicalRotaryHomeSet` event is audit evidence, not kinematic or rate evidence. `CLEAR HOME` removes only `rotaryHome` and records `MechanicalRotaryHomeCleared`; it does not move the assembly, rewrite travel limits or replace the latest motion rate.

`GO HOME` is intentionally an orchestration command rather than a second movement planner. It resolves `rotaryHome`, then dispatches the existing `setContinuousTarget` operation on the same session CommandBus. The actual movement therefore remains `continuous-absolute`, passes through S2.26 travel-limit validation before the planner, commits through the same atomic `transformBatch(...)`, and records the canonical mechanical movement event. `MechanicalRotaryHomeRequested` only links the HOME request to that movement command and remains outside the S2.24 kinematic fold and S2.28 rate fold.

A HOME may remain authored even if a later travel envelope makes it temporarily unreachable. In that case `GO HOME` fails closed through the existing S2.26 limit check without spatial mutation or false HOME-request success evidence. Clearing or widening the envelope can make the same persisted HOME reachable again. No `homeMap`, home document, second planner or second spatial state exists.

### Explicit rotary segment-rate evidence

S2.28 introduces **explicit command-duration evidence**, not a hidden simulation clock. `durationSeconds` is optional and may be supplied to incremental `step`, `principal-shortest` target, `continuous-absolute` target and `GO HOME` movement requests. When supplied, it must be finite and greater than zero.

For a movement accepted by S2.26 travel validation, the runtime derives the completed segment's average angular rate from the actual executed delta:

```text
averageAngularVelocityRadPerSec = deltaRadians / durationSeconds
averageRpm = averageAngularVelocityRadPerSec × 60 / (2π)
rateMode = segment-average
```

For `SET ANGLE`, `deltaRadians` is the shortest principal delta actually selected by S2.21. For `SET CONTINUOUS`, it is the exact multi-turn delta selected by S2.25; a 720° command is therefore never reduced to its principal 0° representative for rate calculation. `GO HOME` propagates the same optional duration to its canonical `setContinuousTarget` movement, so the rate source remains the resulting `MechanicalRotaryContinuousTargetExecuted` event rather than the HOME orchestration event.

Successful movement events persist `durationSeconds`, average rad/s, average RPM and `rateMode` beside the existing angle and revolution evidence in `session.events`. `commands.rate(relationshipId)` recomputes the **latest successful movement segment** from persisted `deltaRadians + durationSeconds`, validating any recorded rate fields and failing closed if that evidence was tampered with. Save/restore therefore preserves rate evidence without replay and without a second rate document.

A successful movement with no explicit duration records `unresolved-no-duration`, deliberately making the latest observable rate `RATE UNRESOLVED` even if an older timed segment existed. By contrast, `SET LIMITS`, `CLEAR LIMITS`, `SET HOME`, `CLEAR HOME` and `MechanicalRotaryHomeRequested` are not independent movement segments and do not replace the last rate evidence. A timed movement rejected by travel limits creates no movement-success event and cannot publish or replace rate evidence.

S2.28 never subtracts `issuedAt`, `occurredAt`, `Date`, browser frame time or other wall-clock metadata to invent elapsed physical time. Audit timestamps remain audit timestamps.

Successful mechanical movement commands continue recording audit evidence in `session.events` with command ID, source, relationship, driver/follower, before/after principal angle, signed delta, continuous angle and revolutions. Restore reconstructs kinematics from evidence and current transforms; it does not replay commands or reapply transforms.

The S2.24 stabilization continues canonicalizing numerical zero within the established rotary epsilon. Its canonical wrap proof uses `170° → -170°`, while the exact `180°` boundary remains covered in domain regression.

S2.25 continuous targets remain exact kinematic state changes rather than time-resolved motor simulations. S2.26 adds an authored admissible envelope around those exact states. S2.27 adds a named authored HOME target on that coordinate system. S2.28 adds only an authored duration and a **segment-average** observation over an already accepted exact movement; it still does not integrate the path between states.

Mechanical endpoint resolution remains runtime-safe outside React. Canonical mechanical local positions come from authored component metadata or explicit proxy anchors; AF-001 `shaft-out` is `[0, 0, 0.03185] m`, matching AF-001M socket-transform QA for `SOCKET_MECH_AXIS_OUT`.

Physics and simulation remain fail-closed. S2.28 claims segment-average angular rate and RPM **only when explicit duration exists**. It does **not** claim instantaneous angular velocity, acceleration, torque or time integration, nor swept-path collision, inertia, backlash or motor dynamics.

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
npm run verify:s2.28
npm run smoke:browser
```

The cumulative S2.28 CI preserves S2.14 Socket-Aware Wiring → S2.15 Direct Socket Wiring → S2.16 Mechanical Assembly → S2.17 Rigid Assembly Rotation → S2.18 Axial Joint Alignment → S2.19 Rotary Joint DOF → S2.20 Rotary Joint Relative Angle → S2.21 Rotary Joint Target Angle → S2.22 Atomic Spatial Transform → S2.23 Mechanical Command Runtime → S2.24 Multi-turn Rotary Kinematics → S2.25 Rotary Continuous Target → S2.26 Rotary Travel Limits → S2.27 Rotary Home Position before validating S2.28 Rotary Segment Rate Evidence, followed by complete Chromium smoke and AF-001I deterministic evidence.

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
