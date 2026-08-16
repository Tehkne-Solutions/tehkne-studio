# Tehkné Studio

Virtual Engineering Atelier by **Tehkné Solutions**.

## Current baseline

`0.1.0-alpha.1 · S1.12 + S2.31`

Previous validated baseline: `0.1.0-alpha.1 · S1.12 + S2.30`.

Historical validated baseline: `0.1.0-alpha.1 · S1.12 + S2.29`.

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
- **Rotary Travel Limits (S2.26)**: an optional continuous travel envelope can be authored on the authoritative `connectedTo` relationship;
- **Rotary Home Position (S2.27)**: the current continuous coordinate can be captured as HOME and `GO HOME` delegates to the canonical continuous-target path;
- **Rotary Named Positions (S2.28)**: multiple normalized bookmarks such as `Inspect`, `Load` and `Park` are stored on the same rotary relationship and `GO POSITION` delegates to canonical movement;
- **Rotary Segment Rate Evidence (S2.29)**: an explicit positive `durationSeconds` on a completed movement segment produces deterministic `segment-average` rad/s and RPM evidence; untimed movement remains `RATE UNRESOLVED`;
- **Rotary Waypoint Sequence (S2.30)**: an ordered sequence references existing Named Positions and may author a duration per segment. `RUN SEQUENCE` executes each target through the same `setContinuousTarget` path;
- **Rotary Waypoint Sequence Plan (S2.31)**: `PREVIEW SEQUENCE` computes a read-only deterministic plan from the current continuous coordinate and live Named Positions, including per-segment delta/rate evidence, travel admissibility, route totals and explicit-duration completeness. `RUN SEQUENCE` consumes the same plan as its preflight.

## Engineering invariants

`connectedTo` remains the authoritative authored topology. Spatial wires, assembly constraints, axial constraints, rotary controls, travel limits, HOME, Named Positions and S2.30 `rotaryWaypointSequences` are projections or metadata of that same graph. The S2.31 waypoint plan is a read-only projection derived from those authorities and is not persisted. Tehkné Studio does not maintain a parallel assembly, rotation, joint, limit, home, named-position, sequence, plan, revolution or rate graph.

The `inventionSpatial` document remains the only persisted physical spatial source of truth. `transformBatch(...)` prepares and validates each mechanical state transition before committing. Mechanical commands do not introduce a shadow transform map or second joint state.

The mechanical runtime deliberately reuses the **existing session CommandBus**. Its rotary semantic command types include:

- `invention.mechanical.rotary.step`;
- `invention.mechanical.rotary.setTarget`;
- `invention.mechanical.rotary.setContinuousTarget`;
- `invention.mechanical.rotary.setTravelLimits` / `clearTravelLimits`;
- `invention.mechanical.rotary.setHome` / `goHome` / `clearHome`;
- `invention.mechanical.rotary.saveNamedPosition` / `goToNamedPosition` / `deleteNamedPosition`;
- `invention.mechanical.rotary.saveWaypointSequence` / `runWaypointSequence` / `deleteWaypointSequence`.

`planSequence(...)` is intentionally a pure query rather than a fourth sequence command. UI, voice and automation movement still invoke the same validated CommandBus operations; previewing a plan does not consume a command ID or manufacture an audit/movement event.

### Multi-turn evidence

S2.24 reconstructs continuous angle and integer revolutions from the current principal transform plus persisted successful movement evidence; restore does not replay commands. Its canonical wrap proof remains `170° → -170°`, an unambiguous shortest `+20°` transition across the principal boundary. The exact `180°` boundary remains covered separately by deterministic domain regression.

### Travel-limit authority

S2.26 stores an optional continuous envelope in `relationship.metadata.rotaryTravelLimits`. Any movement outside the envelope must **fail closed** before planner and spatial mutation; there is no silent clamp. Shafts without this metadata remain unlimited.

Travel-limit authoring events are audit evidence only and stay outside the movement fold. Save/restore persists the envelope naturally through the Engineering Graph snapshot.

### HOME authority

S2.27 stores HOME in `relationship.metadata.rotaryHome`. `SET HOME` and `CLEAR HOME` are metadata-only. `GO HOME` resolves the persisted continuous coordinate and delegates to `setContinuousTarget`, preserving travel-limit checks, follower-only planning, atomic spatial mutation and normal movement evidence.

### Named Positions authority

S2.28 stores multiple normalized bookmarks under `relationship.metadata.rotaryNamedPositions`. `SAVE POSITION` and `DELETE POSITION` are metadata-only. `GO POSITION` resolves the current bookmark and delegates to `setContinuousTarget`. `MechanicalRotaryNamedPositionRequested` links each successful GO POSITION request to the canonical movement command for auditability, while remaining outside the movement/rate fold.

Named Positions are live references for S2.30 and S2.31. If an existing bookmark is updated to a new continuous coordinate, both sequence execution and the next plan preview follow that new coordinate without rewriting the sequence. If the bookmark is removed, planning/execution fails closed rather than retaining a copied coordinate as shadow truth.

### Segment-rate evidence

S2.29 adds **explicit command-duration evidence**, not a hidden simulation clock:

```text
averageAngularVelocityRadPerSec = deltaRadians / durationSeconds
averageRpm = averageAngularVelocityRadPerSec * 60 / (2π)
mode = segment-average
signature = Tehkné Solutions
```

The duration is optional on incremental, principal, continuous, HOME and Named Position movement. `commands.rate(relationshipId)` reconstructs the latest successful movement segment from `session.events`. If the latest movement is untimed, rate is unresolved even if an earlier movement was timed.

S2.29 never subtracts `issuedAt`, `occurredAt`, browser frame time, `Date`, `performance.now()` or other wall-clock metadata to manufacture physical duration. Persisted rate values are recomputed from signed delta + explicit duration and tampered evidence fails closed.

S2.29 does not claim instantaneous angular velocity, acceleration, torque or time integration. It also does not claim collision sweep, inertia, backlash or motor dynamics.

### Rotary Waypoint Sequence authority

S2.30 stores authored sequences directly in the same authoritative relationship metadata under `rotaryWaypointSequences`:

```text
version = 1
sequences[] = {
  key,
  name,
  steps[] = { positionKey, positionName, durationSeconds | null, signature },
  signature
}
signature = Tehkné Solutions
```

A sequence contains between 1 and 32 ordered waypoints. Repeating a Named Position is allowed, so cycles such as `Inspect → Load → Inspect` remain expressible. Sequence names are Unicode-normalized, trimmed and case-insensitive through the same normalized-key principle used by Named Positions.

`SAVE SEQUENCE` resolves every draft waypoint against a real S2.28 Named Position and stores only its stable normalized reference plus optional positive duration. It does not move the joint, does not create rate evidence and records only `MechanicalRotaryWaypointSequenceSaved` audit evidence. `DELETE SEQUENCE` removes only the selected sequence and records `MechanicalRotaryWaypointSequenceDeleted`.

Each waypoint delegates to the existing `setContinuousTarget` command in authored order. The optional step duration is forwarded unchanged to S2.29. Every completed segment therefore produces the same canonical continuous/revolution/rate evidence it would have produced individually. The sequence request event stores the list of resulting movement command IDs for auditability but remains outside the movement/rate fold.

The rate after a successful sequence is simply the canonical rate of its **final movement segment**. S2.30 creates no aggregate RPM, average-over-sequence velocity or parallel rate state.

S2.30 **does not wait** for the authored duration to elapse and does not use timers. Durations describe evidence for each exact completed segment; they are not a wall-clock scheduler. There is no `setTimeout`, `setInterval`, animation loop, hidden timeline, acceleration solver, torque solver or time integrator in this sprint.

The UI may keep an unsaved waypoint draft in React so a user can compose and inspect it before pressing `SAVE SEQUENCE`. That draft is transient form state only. The persisted source of truth remains `relationship.metadata.rotaryWaypointSequences`.

### Rotary Waypoint Sequence Plan authority

S2.31 adds `planSequence(relationshipId, name)` to the existing S2.30 runtime. It is a **read-only query**. It resolves the current continuous coordinate, the current authored sequence, every live S2.28 Named Position and the current S2.26 travel envelope, then returns deterministic segments without dispatching a command, recording an event or mutating `inventionSpatial`/Engineering Graph state.

Each planned segment exposes:

```text
fromContinuousRadians
targetContinuousRadians
deltaRadians
durationSeconds | null
averageAngularVelocityRadPerSec | null
averageRpm | null
rateMode = segment-average | unresolved-no-duration
withinTravelLimits = true | false
```

If a segment has an explicit positive duration, S2.31 reuses the exact S2.29 `deriveRotarySegmentRate(deltaRadians, durationSeconds)` formula. If duration is absent, rate remains `unresolved-no-duration`; preview never infers timing from wall-clock timestamps.

The aggregate plan reports `totalDeltaRadians`, `cumulativeAbsoluteTravelRadians`, timed/untimed step counts and explicit authored duration. `totalDurationSeconds` exists only when **every** segment has explicit duration. Mixed sequences use `durationMode = partial-explicit` and keep total duration unresolved; completely untimed sequences use `unresolved-no-duration`.

Travel admissibility uses the same target-coordinate semantics as S2.26. The plan marks every segment `withinTravelLimits` and exposes aggregate `admissible`. It does not pretend to simulate collision sweep or the continuous physical path between exact target states.

`RUN SEQUENCE` now builds this same plan and calls the same admissibility gate **before the first `setContinuousTarget`**. Therefore `PREVIEW SEQUENCE` and execution cannot disagree because of separate preflight implementations. Missing Named Positions or malformed metadata still fail closed during live resolution.

S2.31 does not persist a `rotaryWaypointPlan`, `sequencePlan`, plan document or plan event. The UI may retain the last preview in transient React display state, but save/restore only persists the underlying sequence, Named Positions, limits, movement evidence and spatial state. A restored project recomputes the plan from current authorities.

S2.31 **does not wait** for durations, schedule future motion or introduce physical dynamics. There is no hidden clock, timer, motion timeline, acceleration solver, torque solver, inertia solver or alternate movement planner.

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
npm run verify:s2.31
npm run smoke:browser
```

The cumulative S2.31 CI preserves S2.14 Socket-Aware Wiring → S2.15 Direct Socket Wiring → S2.16 Mechanical Assembly → S2.17 Rigid Assembly Rotation → S2.18 Axial Joint Alignment → S2.19 Rotary Joint DOF → S2.20 Rotary Joint Relative Angle → S2.21 Rotary Joint Target Angle → S2.22 Atomic Spatial Transform → S2.23 Mechanical Command Runtime → S2.24 Multi-turn Rotary Kinematics → S2.25 Rotary Continuous Target → S2.26 Rotary Travel Limits → S2.27 Rotary Home Position → S2.28 Rotary Named Positions → S2.29 Rotary Segment Rate Evidence → S2.30 Rotary Waypoint Sequence before validating S2.31 Rotary Waypoint Sequence Plan, followed by complete Chromium smoke and AF-001I deterministic evidence.

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