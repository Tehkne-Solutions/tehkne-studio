# AF-002 v0.5 compare isolation

The AF-002 v0.5 A/B browser test consumes a GLB generated only by the dedicated visual comparison workflow. It must therefore remain skipped in the general browser smoke unless `AF002_V05_COMPARE=1` is explicitly supplied after candidate generation.

This preserves two independent authorities:

- general browser smoke validates only materialized product surfaces;
- the dedicated AF-002 v0.5 comparison gate generates, verifies, injects and reviews the ephemeral hero-quality candidate.

No runtime, HERO or GOLDEN promotion is implied by this isolation fix.

Tehkné Solutions
