# Example: bug — 401 on valid bearer token after Firefox refresh

This session demonstrates a complete pipeline run for a bug request, end-to-end:

```
intake -> pm (work_type=bug)
       -> engineer (probe: diagnosis)
       -> executor (probe run)
       -> probe-gate (pass)
       -> engineer (impl)
       -> executor (impl run)
       -> review
       -> qa
```

The Architect, Security, and Release Readiness gates were not triggered for this request (no schema/API change, no auth-policy change beyond a bug fix, no deploy in scope).

Files of interest:

- `session.json` — repo roots and worktree path used by the executor.
- `artifacts/request-envelope.json` — the normalized request.
- `artifacts/intake-output.json` — gate suggestions and blocking-question screen.
- `artifacts/pm-output.json` — work_type, acceptance criteria, evidence refs.
- `artifacts/pm-quality.json` — sidecar showing the stage-quality contract.
- `artifacts/probe-output.json` — diagnosis-mode probe with feedback loop and 3 ranked hypotheses.
- `artifacts/probe-results.json` — executor probe-mode output (no file changes, just command runs).
- `artifacts/probe-gate-output.json` — gate decision = pass.
- `artifacts/engineer-output.json` — implementation plan and execution handoff.
- `artifacts/execution-results.json` — executor impl-mode output (planned changes applied, tests run).
- `artifacts/review-output.json` — second-opinion review.
- `artifacts/qa-output.json` — verified acceptance criteria.

This example is a **fixture for the contract**, not a real fix to a real product. The patches are illustrative; the values in `commands_attempted` and `applied_changes` are what a conformant Executor would produce.
