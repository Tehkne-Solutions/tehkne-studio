# S2.33 — AF-002 Dual-Shaft Assembly

AF-002 enters the executable Component Library as an **engineering-reference component**, not as a promoted runtime GLB.

## Scope

`mechanical.coupler.shaft-a-v1` exposes two independent canonical rotary interfaces:

- `axis-in` → input `mechanical.rotary-shaft`;
- `axis-out` → output `mechanical.rotary-shaft`.

Their proxy anchors mirror the AF-002 Engineering Reference exactly:

- input `[0, 0, -0.0175] m`, outward `-Z`;
- output `[0, 0, +0.0175] m`, outward `+Z`.

The acceptance topology is:

`AF-001 motor shaft-out → AF-002 axis-in → AF-002 axis-out → Drive Wheel hub-in`

This must materialize as **two distinct `connectedTo` relationships** in the existing Engineering Graph. No transmission graph, coupler graph or secondary topology is introduced.

## Asset authority

AF-002 remains `0.2.0-engineering-reference / ENGINEERING_REFERENCE`.

The component uses `PROXY_EXPLICIT_ENGINEERING_REFERENCE` until an actual generated GLB passes deterministic Runtime Candidate validation. The existing procedural DCC generator is an input to that future gate; its presence alone does not authorize a runtime/hero promotion.

## Explicit non-claims

S2.33 does not claim or simulate:

- torque capacity or torque transfer;
- maximum RPM;
- inertia;
- stiffness or damping;
- backlash;
- misalignment capacity;
- contact forces;
- manufacturing certification.

Those remain separate evidence problems.

## Acceptance

- AF-002 extension parses through the canonical Component Library extension path;
- component identity and engineering-reference provenance match AF-002;
- two rotary ports remain independent and compatible with `mechanical.rotary-shaft`;
- domain proof creates motor → coupler and coupler → wheel relationships using `InventionBuilder.connect`;
- no parallel transmission relationship type exists;
- S2.32 remains the validated predecessor;
- CI is read-only.

**Tehkné Solutions**
