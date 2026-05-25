# Example: fix-empty-todo-list

A complete pipeline run for a simple bug fix. Use this as a reference for artifact shapes and the expected flow.

## Task

**Type**: bug  
**Title**: Fix TypeError when loading empty todo list

When a user has no todos, navigating to `/todos` throws:
```
TypeError: Cannot read properties of undefined (reading 'map')
```
The page should show `No todos yet. Create your first one!` instead.

## Pipeline stages run

```
INTAKE -> PM -> ENGINEER (diagnosis probe) -> EXECUTOR (probe run)
  -> PROBE-GATE (pass) -> ENGINEER (impl) -> EXECUTOR -> QA
```

Architect, Security, and Review were skipped — single-component fix with no API, schema, or security surface changes.

## Artifacts

| File | Stage | Description |
|------|-------|-------------|
| `request-envelope.json` | — | Normalized raw request |
| `intake-output.json` | INTAKE | Signal classification and gate suggestions |
| `pm-output.json` | PM | Problem statement, acceptance criteria |
| `probe-output.json` | ENGINEER (phase 1) | Diagnosis probe — feedback loop, reproduction, hypotheses |
| `probe-results.json` | EXECUTOR | Probe command execution results |
| `probe-gate-output.json` | PROBE-GATE | Gate decision (pass) |
| `engineer-output.json` | ENGINEER (phase 2) | Implementation plan and planned file changes |
| `execution-results.json` | EXECUTOR | Applied changes and test results |
| `qa-output.json` | QA | Acceptance criteria verification |
