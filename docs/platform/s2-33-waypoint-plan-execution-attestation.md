# S2.33 — Rotary Waypoint Plan-Execution Attestation

**Tehkné Solutions**

## Purpose

S2.33 preserves the exact **live S2.31 plan consumed by a successful sequence run** and attests it against the canonical **S2.32 read-only execution evidence** reconstructed from `session.events`.

S2.32 remains the authority for what actually executed. S2.33 does not replace or duplicate that projection. It adds the historical context that S2.32 intentionally does not persist: waypoint names/keys and target coordinates as they existed at the instant the run was planned.

## Command path

`invention.mechanical.rotary.runWaypointSequenceAttested`

1. capture `planSequence(...)` from current live Named Positions and limits;
2. execute the canonical `runWaypointSequence(...)` path;
3. resolve the resulting S2.32 `rotaryWaypointExecutionEvidence(...)` by the canonical sequence run command ID;
4. compare every planned segment against the actual canonical movement evidence;
5. compare aggregate before/after/delta/absolute travel;
6. only after a complete match record `MechanicalRotaryWaypointPlanExecutionAttested` in `session.events`.

A blocked S2.31 plan produces no successful sequence run and therefore no attestation.

## Attestation evidence

Each segment stores the consumed plan snapshot together with the corresponding S2.32 actual segment:

```text
positionKey / positionName
planned from / target / delta
planned explicit duration / rate or unresolved rate
movementCommandId
actual before / after / delta
actual explicit duration / rate or unresolved rate
actual movement mode
matched = true
signature = Tehkné Solutions
```

Aggregate evidence stores plan and actual before/after, total delta and cumulative absolute travel. `derivedFrom = consumed-plan+s2.32-execution-evidence`.

## Historical immutability

Named Positions remain live authority for **future** previews and executions. Editing `Inspect` from 90° to 120° after a successful run changes the next S2.31 plan, but the S2.33 attestation retains the 90° target that was actually consumed by the historical run.

Attestations are stored only as audit evidence in `session.events`; they are not written to `connectedTo` metadata and do not become a current planning source. Restore reads them without replay. `lastAttestation(...)` revalidates stored actual values against the canonical S2.32 execution projection, so tampering in either the attestation or underlying movement evidence fails closed.

## Explicit non-claims

S2.33 introduces no wall-clock measurement, scheduler, motion timeline, instantaneous angular velocity, acceleration, torque, inertia, backlash, compliance, collision sweep or dynamics solver. Duration/rate values are only the explicit S2.29 segment-average evidence already recorded by canonical movements.

AF-001 remains `0.6.6-hero-candidate` / `HERO_CANDIDATE`; AF-001L target-hardware validation remains a separate physical gate before any Golden promotion.
