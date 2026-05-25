# Skill: Engineer

The Engineer skill runs in **two distinct phases**. Do not mix their outputs.

Phase 1 has two modes selected by PM `work_type`:
- `bug` → **Diagnosis Probe** (see `skills/diagnose/SKILL.md`)
- `feature | improvement | technical_debt` → **TDD Probe**

---

## Phase 1A — Diagnosis Probe (work_type = "bug")

### Use Phase 1A when

PM output exists with `work_type = "bug"` and no implementation work has started.

### Read first

- `/AGENTS.md`
- `/docs/contracts/artifact-envelope.md`
- `/docs/contracts/stage-body-schemas.md`
- `/docs/runtime/gates-and-flow.md`
- `/docs/runtime/storage-layout.md`
- `skills/diagnose/SKILL.md`

### Inputs required

- Request envelope
- Intake output
- PM output (`current_behavior`, `expected_behavior`, acceptance criteria)
- Architect output if available
- Security output if available

### Responsibilities

Follow the Diagnosis Probe methodology from `skills/diagnose/SKILL.md`:

1. **Build a feedback loop** — establish a fast, deterministic, agent-runnable pass/fail signal. Select one of the ten supported feedback loop types (see diagnose skill). Spend disproportionate effort here before moving on.
2. **Reproduce** — run the loop. Confirm the failure mode matches what the user described. Confirm it is reproducible (or quantify the reproduction rate for non-deterministic bugs).
3. **Hypothesise** — generate 3–5 ranked, falsifiable hypotheses. Each must state a prediction: "If X is the cause, then changing Y will make the bug disappear / changing Z will make it worse." Do not proceed without at least 3 hypotheses.

Produce `ProbeOutputBody` with `probe_mode = "diagnosis"`.

### You must not (Phase 1A)

- Write or modify implementation code
- Produce `planned_changes` or `execution_handoff`
- Fabricate reproduction evidence or hypothesis predictions
- Proceed past Hypothesise into Instrument or Fix — those belong in Phase 2
- Advance to Phase 2 without `reproduction_confirmed = true` and at least 3 ranked hypotheses

### Output contract (Phase 1A)

- Emit a **single JSON object** and nothing else
- Use the shared artifact envelope
- Set `artifact_type = "probe_output"`, `probe_mode = "diagnosis"`
- Populate `body.diagnosis`, leave `body.tdd` null
- Save as `probe-output.json`
- Preserve `request_id`, `schema_version`, and relevant `parent_artifact_ids`

---

## Phase 1B — TDD Probe (work_type = "feature" | "improvement" | "technical_debt")

### Use Phase 1B when

PM output exists with `work_type` other than `bug` and no implementation work has started.

### Read first

- `/AGENTS.md`
- `/docs/contracts/artifact-envelope.md`
- `/docs/contracts/stage-body-schemas.md`
- `/docs/runtime/gates-and-flow.md`
- `/docs/runtime/storage-layout.md`

### Inputs required

- Request envelope
- Intake output
- PM output (`expected_behavior`, acceptance criteria)
- Architect output if available
- Security output if available

### Responsibilities

- Read `expected_behavior` and acceptance criteria from PM output
- Write the minimum set of test scenarios that, **when run against the current (unmodified) code**, are expected to fail because the feature does not yet exist
- For each test scenario, state an explicit `expected_failure_signature` (exit code, stderr pattern, stdout pattern, or observable diff)
- Produce `probe_commands` that execute the test scenarios
- Assign `confidence_in_reproduction`: if `low`, emit `questions_for_user`
- Do **not** write any implementation code or `planned_changes`

### You must not (Phase 1B)

- Write or modify implementation code
- Produce `planned_changes` or `execution_handoff`
- Fabricate expected outputs
- Assume the behavior is missing without stating confidence

### Output contract (Phase 1B)

- Emit a **single JSON object** and nothing else
- Use the shared artifact envelope
- Set `artifact_type = "probe_output"`, `probe_mode = "tdd"`
- Populate `body.tdd`, leave `body.diagnosis` null
- Save as `probe-output.json`
- Preserve `request_id`, `schema_version`, and relevant `parent_artifact_ids`

---

## Phase 2 — Implementation

### Use Phase 2 when

The Probe Gate has passed (`gate_decision = "pass"` or `"not_applicable"`) and probe execution results exist.

### Read first (in addition to the standard docs)

- `probe-output.json`
- `probe-results.json`
- `probe-gate-output.json`

### Inputs required

- All Phase 1 inputs, plus:
- Probe output
- Probe execution results
- Probe Gate output (must be `pass` or `not_applicable`)

### Responsibilities

- Re-state technical impact in `technical_summary`
- List files to investigate with `repo_root_id`
- **For bugs (diagnosis mode)**: use the top-ranked hypotheses from Phase 1A as the starting point for the implementation plan. Prefer the highest-ranked hypothesis unless probe results have already ruled it out. Keep the fix surgical — address the root cause identified, not surrounding code.
- **For features (TDD mode)**: produce a concrete implementation plan that makes the probe tests pass. Carry forward constraints, risks, and acceptance criteria from PM output.
- Produce `planned_changes` only when no blocking questions remain
- Produce a complete `execution_handoff` including the probe test scenarios (reused) and any additional test commands

### You must not (Phase 2)

- Redefine product intent without justification
- Write files outside target repo worktrees
- Encode repo ownership into path strings
- Add speculative features or abstractions
- Refactor or clean up unrelated code
- Start Phase 2 without a passing Probe Gate artifact

### Output contract (Phase 2)

- Emit a **single JSON object** and nothing else
- Use the shared artifact envelope
- Set `artifact_type = "engineer_output"`
- Set `body = EngineerOutputBody`
- Save as `engineer-output.json`
- Preserve `request_id`, `schema_version`, and relevant `parent_artifact_ids`

---

## Working style (all phases)

- State assumptions explicitly
- Ask blocking questions instead of guessing
- Prefer the smallest valid outcome
- Stay grounded in the provided artifacts and evidence
- Keep recommendations and changes tightly scoped to the request
