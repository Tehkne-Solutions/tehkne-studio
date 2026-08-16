# Tehkné Studio

Virtual Engineering Atelier by **Tehkné Solutions**.

## Current baseline

`0.1.0-alpha.1 · S1.12 + S2.29`

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
- **Rotary Named Positions (S2.28)**: multiple normalized bookmarks such as `Inspect`, `Load` and `Park` can be saved on the same rotary relationship. `GO POSITION` delegates to the canonical continuous-target path, while save/update/delete remain metadata-only operations;
- **Rotary Segment Rate Evidence (S2.29)**: movement commands may carry an explicit positive `durationSeconds`. The executed signed delta and authored duration produce deterministic `segment-average` rad/s and RPM evidence; commands without duration remain `RATE UNRESOLVED`.

## Engineering invariants

`connectedTo` remains the authoritative authored topology. Spatial wires, assembly constraints, axial constraints, rotary controls, S2.26 travel limits, S2.27 HOME and S2.28 named positions are projections or metadata of that same graph; Tehkné Studio does not maintain a parallel assembly, rotation, joint, limit, home, named-position, revolution or rate graph.

The `inventionSpatial` document remains the only persisted physical spatial source of truth. `transformBatch(...)` prepares and validates the complete mutation set before committing. Mechanical commands do not introduce a shadow transform map or second joint state.

The mechanical runtime deliberately reuses the **existing session CommandBus**. Its rotary semantic command types are:

- `invention.mechanical.rotary.step` — signed incremental kinematic step;
- `invention.mechanical.rotary.setTarget` — absolute principal target using `principal-shortest`;
- `invention.mechanical.rotary.setContinuousTarget` — absolute continuous multi-turn target using `continuous-absolute`;
- `invention.mechanical.rotary.setTravelLimits` — author or replace an optional continuous travel envelope;
- `invention.mechanical.rotary.clearTravelLimits` — remove that envelope and restore unlimited travel;
- `invention.mechanical.rotary.setHome` — capture the current continuous coordinate as HOME;
- `invention.mechanical.rotary.goHome` — resolve the authored HOME and delegate movement to `setContinuousTarget`;
- `invention.mechanical.rotary.clearHome` — remove the authored HOME reference;
- `invention.mechanical.rotary.saveNamedPosition` — create or update a normalized named bookmark from the current continuous coordinate;
- `invention.mechanical.rotary.goToNamedPosition` — resolve a bookmark and delegate movement to `setContinuousTarget`;
- `invention.mechanical.rotary.deleteNamedPosition` — remove only the selected bookmark.

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

Limit authoring is dispatched through the session CommandBus and recorded as `MechanicalRotaryTravelLimitsSet` or `MechanicalRotaryTravelLimitsCleared`. Those events are audit evidence only and are intentionally excluded from the S2.24 kinematic fold, so setting or clearing a limit cannot manufacture angle, continuous travel or revolutions.

For any movement command, the runtime derives current continuous kinematics first, calculates the intended continuous result, reads the optional relationship envelope and applies the travel-limit check **before** `planMechanicalRotaryJointStep(...)` and before `transformBatch(...)`. Out-of-range commands are rejected rather than clamped. They produce no spatial mutation and no false movement-success event.

An authored envelope must contain the joint's current continuous position at the moment it is set. Inverted bounds and bounds that exclude the current state fail closed. Removing an envelope restores unlimited rotary travel; shafts without `rotaryTravelLimits` preserve all S2.25 behavior, including multi-turn targets such as 1080°.

### HOME authority and persistence

S2.27 stores HOME directly in the same authoritative connection metadata under `rotaryHome`:

```text
mode = continuous
homeContinuousRadians = captured current continuous coordinate
signature = Tehkné Solutions
```

`SET HOME` captures the already-derived continuous coordinate and updates only relationship metadata. It does not rotate the joint and its `MechanicalRotaryHomeSet` event is audit evidence, not kinematic evidence. `CLEAR HOME` removes only `rotaryHome` and records `MechanicalRotaryHomeCleared`; it does not move the assembly or rewrite travel limits.

`GO HOME` is intentionally an orchestration command rather than a second movement planner. It resolves `rotaryHome`, then dispatches the existing `setContinuousTarget` operation on the same session CommandBus. The actual movement therefore remains `continuous-absolute`, passes through S2.26 travel-limit validation before the planner, commits through the same atomic `transformBatch(...)`, and records the canonical mechanical movement event. `MechanicalRotaryHomeRequested` only links the HOME request to that movement command and remains outside the S2.24 kinematic fold.

A HOME may remain authored even if a later travel envelope makes it temporarily unreachable. In that case `GO HOME` fails closed through the existing S2.26 limit check without spatial mutation or false HOME-request success evidence. Clearing or widening the envelope can make the same persisted HOME reachable again. No `homeMap`, home document, second planner or second spatial state exists.

### Named-position authority and persistence

S2.28 stores multiple bookmarks directly in the same authoritative connection metadata under `rotaryNamedPositions`:

```text
version = 1
positions[] = { key, name, continuousRadians, signature }
signature = Tehkné Solutions
```

Position names are Unicode-normalized, trimmed, internal whitespace is collapsed and identity is case-insensitive through a normalized key. Saving the same normalized name updates the existing bookmark instead of creating a duplicate. Names must contain 1–64 characters and tampered duplicate keys or invalid signatures fail closed.

`SAVE POSITION` captures the current continuous coordinate and updates only relationship metadata. `DELETE POSITION` removes only the selected bookmark. Their `MechanicalRotaryNamedPositionSaved` and `MechanicalRotaryNamedPositionDeleted` events are audit evidence and remain outside the S2.24 movement fold, so authoring bookmarks cannot manufacture angle or revolutions.

`GO POSITION` resolves the authored bookmark and delegates to the existing `setContinuousTarget` operation on the same session CommandBus. Movement therefore remains `continuous-absolute`, passes through S2.26 travel-limit validation, uses the established follower-only rotary planner and commits through the same atomic `transformBatch(...)`. `MechanicalRotaryNamedPositionRequested` links the bookmark request to the canonical movement command and also remains outside the kinematic fold.

A named position may remain persisted while temporarily unreachable because of a later travel envelope. In that case `GO POSITION` fails closed before spatial mutation and records no false request-success evidence. Clearing or widening the envelope restores reachability without rewriting the bookmark. HOME remains independent: it is the one special reference target, while named positions provide multiple reusable bookmarks. No `positionMap`, named-position document outside the relationship, second planner or second spatial state exists.

### Segment-rate evidence

S2.29 adds **explicit command-duration evidence**, not a hidden simulation clock. A movement command may carry `durationSeconds > 0`. The runtime computes the completed segment average from the movement that actually passed validation and executed:

```text
averageAngularVelocityRadPerSec = deltaRadians / durationSeconds
averageRpm = averageAngularVelocityRadPerSec * 60 / (2π)
mode = segment-average
signature = Tehkné Solutions
```

The same optional duration is accepted by signed incremental `step`, principal `setTarget`, absolute multi-turn `setContinuousTarget`, `GO HOME` and `GO POSITION`. HOME and Named Position orchestration only forward duration to the canonical continuous-target command. Their request events record the linked `movementCommandId`, duration and rate mode for auditability, but rate authority remains the canonical mechanical movement event.

Travel limits remain prior authority: the intended continuous coordinate is checked before rate derivation, planning or spatial mutation. A timed movement rejected by S2.26 creates no successful movement event, no request-success event and no false RPM. `SET/CLEAR LIMITS`, `SET/CLEAR HOME`, `SAVE/DELETE POSITION` and request audit events are not movement and therefore never replace the latest rate evidence.

`commands.rate(relationshipId)` reconstructs only the latest successful rotary movement segment from persisted `session.events`. If that latest movement had no explicit duration, the result is `unresolved-no-duration` and the UI shows `RATE UNRESOLVED`, even if an earlier movement was timed. Persisted rate values are recomputed from signed delta + duration; mismatched/tampered angular-rate or RPM evidence fails closed.

S2.29 never subtracts `issuedAt`, `occurredAt`, browser frame time, `Date`, `performance.now()` or any other wall-clock metadata to invent physical duration. The geometric transform still commits atomically as an exact state transition; the supplied duration describes evidence for the completed command segment rather than driving a time integrator.

Successful mechanical movement commands continue recording evidence in `session.events` with command ID, source, relationship, driver/follower, before/after principal angle, signed delta, continuous angle, revolutions and, when explicitly authored, duration plus segment-average rate. Restore reconstructs kinematics and latest rate from existing evidence and current transforms; it does not replay commands or reapply transforms.

The S2.24 stabilization continues canonicalizing numerical zero within the established rotary epsilon. Its canonical wrap proof uses `170° → -170°`, while the exact `180°` boundary remains covered in domain regression.

S2.29 **does not claim instantaneous angular velocity, acceleration, torque or time integration**. It also does not claim collision sweep, inertia, backlash or motor dynamics. Those require a later explicit dynamics/time solver contract.

Mechanical endpoint resolution remains runtime-safe outside React. Canonical mechanical local positions come from authored component metadata or explicit proxy anchors; AF-001 `shaft-out` is `[0, 0, 0.03185] m`, matching AF-001M socket-transform QA for `SOCKET_MECH_AXIS_OUT`.

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
npm run verify:s2.29
npm run smoke:browser
```

The cumulative S2.29 CI preserves S2.14 Socket-Aware Wiring → S2.15 Direct Socket Wiring → S2.16 Mechanical Assembly → S2.17 Rigid Assembly Rotation → S2.18 Axial Joint Alignment → S2.19 Rotary Joint DOF → S2.20 Rotary Joint Relative Angle → S2.21 Rotary Joint Target Angle → S2.22 Atomic Spatial Transform → S2.23 Mechanical Command Runtime → S2.24 Multi-turn Rotary Kinematics → S2.25 Rotary Continuous Target → S2.26 Rotary Travel Limits → S2.27 Rotary Home Position → S2.28 Rotary Named Positions before validating S2.29 Rotary Segment Rate Evidence, followed by complete Chromium smoke and AF-001I deterministic evidence.

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
