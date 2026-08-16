# S2.32 — Rotary Waypoint Sequence Execution Evidence

S2.32 closes the deterministic `plan → run → evidence` loop without introducing a second execution state, scheduler, clock or dynamics solver.

`rotaryWaypointExecutionEvidence(session, relationshipId, sequenceName?)` and `latestRotaryWaypointExecutionEvidence(...)` are read-only projections over the existing `session-events` authority. They resolve `MechanicalRotaryWaypointSequenceRequested` events and the exact canonical movement events referenced by `movementCommandIds`.

Each reconstructed segment exposes its continuous before/after coordinates, delta, explicit duration when authored, segment-average rad/s and RPM when resolvable, canonical movement mode and rate mode. Aggregate evidence derives total delta, cumulative absolute travel, timed/untimed counts, explicit duration sum and total duration only when every segment is timed.

The projection fails closed when movement IDs are duplicated or missing, continuity breaks, signatures disagree, aggregate before/after/delta values diverge, the final movement ID is inconsistent or final rate mode does not match the canonical final movement.

No `sequenceExecution`, `rotaryWaypointExecutionEvidence` metadata document, execution map, event append, command dispatch or spatial mutation is introduced. Historical executions remain reconstructable from the existing persisted event stream.

AF-001 remains `0.6.6-hero-candidate` / `HERO_CANDIDATE`. AF-001L physical Target Hardware Bench remains the separate fail-closed gate before any Golden promotion.

**Tehkné Solutions**
