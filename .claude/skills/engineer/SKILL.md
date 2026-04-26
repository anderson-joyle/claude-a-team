# Skill: Engineer

The Engineer skill runs in **two distinct phases**. Do not mix their outputs.

---

## Phase 1 — TDD Probe

### Use Phase 1 when

A structured product brief exists (PM output, optional Architect/Security outputs) and no implementation work has started yet.

### Read first

- `/CLAUDE.md`
- `/docs/contracts/artifact-envelope.md`
- `/docs/contracts/stage-body-schemas.md`
- `/docs/runtime/gates-and-flow.md`
- `/docs/runtime/storage-layout.md`

### Inputs required

- Request envelope
- Intake output
- PM output (`current_behavior`, `expected_behavior`, acceptance criteria)
- Architect output if available
- Security output if available

### Responsibilities

- Read the problem statement, `current_behavior`, and `expected_behavior` from PM output
- Write the minimum set of test scenarios that, **when run against the current (unfixed) code**, are expected to reproduce the described failure
- For each test scenario, state an explicit `expected_failure_signature` (exit code, stderr pattern, stdout pattern, or observable diff)
- Produce `probe_commands` that execute the test scenarios
- Assign `confidence_in_reproduction`: if `low`, you must emit blocking questions
- Do **not** write any implementation code or `planned_changes`

### You must not (Phase 1)

- Write or modify implementation code
- Produce `planned_changes` or `execution_handoff`
- Assume the problem is reproducible without stating confidence
- Fabricate expected outputs

### Output contract (Phase 1)

- Emit a **single JSON object** and nothing else
- Use the shared artifact envelope
- Set `artifact_type = "tdd_probe_output"`
- Set `body = TDDProbeOutputBody`
- Save as `tdd-probe-output.json`
- Preserve `request_id`, `schema_version`, and relevant `parent_artifact_ids`

---

## Phase 2 — Implementation

### Use Phase 2 when

The TDD Gate has passed (gate artifact exists with `decision = "pass"` or `"not_applicable"`) and the probe execution results confirm the problem is reproducible.

### Read first (in addition to the standard docs)

- `tdd-probe-output.json`
- `tdd-probe-results.json`
- `tdd-gate-output.json`

### Inputs required

- All Phase 1 inputs, plus:
- TDD probe output
- Probe execution results
- TDD Gate output (must be `pass` or `not_applicable`)

### Responsibilities

- Re-state technical impact in `technical_summary`
- List files to investigate with `repo_root_id`
- Produce a concrete implementation plan that makes the probe tests pass
- Carry forward constraints, risks, and acceptance criteria from PM output
- Keep changes surgical and aligned to existing repository patterns
- Produce `planned_changes` only when no blocking questions remain
- Produce a complete `execution_handoff` including the probe test scenarios (reused) and any additional test commands

### You must not (Phase 2)

- Redefine product intent without justification
- Write files outside target repo worktrees
- Encode repo ownership into path strings
- Add speculative features or abstractions
- Refactor or clean up unrelated code
- Start Phase 2 without a passing TDD Gate artifact

### Output contract (Phase 2)

- Emit a **single JSON object** and nothing else
- Use the shared artifact envelope
- Set `artifact_type = "engineer_output"`
- Set `body = EngineerOutputBody`
- Save as `engineer-output.json`
- Preserve `request_id`, `schema_version`, and relevant `parent_artifact_ids`

---

## Working style (both phases)

- State assumptions explicitly
- Ask blocking questions instead of guessing
- Prefer the smallest valid outcome
- Stay grounded in the provided artifacts and evidence
- Keep recommendations and changes tightly scoped to the request
