# Gates and Flow

## Default flow

`INTAKE -> PM -> [ARCHITECT?] -> [SECURITY?] -> ENGINEER (probe) -> EXECUTOR (probe run) -> PROBE-GATE -> ENGINEER (impl) -> [REVIEW?] -> EXECUTOR -> QA -> [RELEASE_READINESS?]`

## Gate triggers

### Architect must run when

- more than one repo root is in scope
- a public API or contract changes
- a schema or data model changes
- infra or runtime behavior changes
- a new dependency, service boundary, or subsystem is introduced
- PM or Engineer marks architectural risk as medium or high
- the user explicitly asks for architectural review

### Security must run when

- auth, authz, identity, secrets, tokens, or permissions are involved
- external input parsing, file access, network access, or code execution is involved
- customer data, PII, payment data, or sensitive logs are involved
- a new dependency is added or dependency trust changes
- CI/CD, release, package publishing, supply chain, or signing changes are involved
- PM, Architect, or Engineer identifies meaningful security risk
- the user explicitly asks for security review

### Review should run when

- the user asks for a second opinion
- a second model is available and the change is medium or high risk
- more than 3 files change
- a public interface changes
- the change touches tests, migrations, packaging, deployment, or documentation
- runtime policy requires review before execution

### Release Readiness should run when

- code changes were applied
- a release, package publication, deployment, or migration is part of the request
- QA is `pass` but waivers, untested areas, or rollout risks remain
- the user explicitly asks whether it is ready to ship

## Probe Gate (always runs between probe executor and implementation)

### When the Probe Gate runs

The Probe Gate runs whenever an ENGINEER probe artifact and its corresponding probe execution results both exist. It always runs — it is not optional. The gate evaluates differently depending on `probe_mode`.

### Probe Gate decision logic — Diagnosis mode (bugs)

| Condition | Decision | Action |
|---|---|---|
| Feedback loop is confirmed, failure reproduces consistently, and at least 3 ranked hypotheses are present | **PASS** | Advance to ENGINEER (impl phase) automatically |
| Feedback loop exists but failure does not reproduce (or reproduces at too low a rate to debug) | **FAIL** | **Suspend.** Report that the described failure could not be confirmed. Ask user to verify environment, repro steps, or provide a captured artifact. |
| No feedback loop could be established (problem statement too ambiguous, environment inaccessible) | **BLOCKED** | **Suspend.** Surface what was tried and what is missing. Ask the user for access, captured evidence, or a clearer problem statement. |
| Feedback loop reproduces but `ranked_hypotheses` is empty or has fewer than 3 entries | **FAIL** | **Suspend.** Ask the engineer to complete the hypothesise step before proceeding. |

### Probe Gate decision logic — TDD mode (features / improvements)

| Condition | Decision | Action |
|---|---|---|
| All probe tests failed in the expected way (error signatures match `expected_failure_signatures`) | **PASS** | Advance to ENGINEER (impl phase) automatically |
| Any probe test produced output that does not match an expected failure signature | **FAIL** | **Suspend.** Present analysis to user. Wait for explicit direction. |
| No probe tests could be written (requirements too ambiguous) | **BLOCKED** | **Suspend.** Surface the ambiguity. Ask the user to clarify before proceeding. |
| Probe tests passed when they should have failed (behavior already exists) | **FAIL** | **Suspend.** Report that the described behavior is already present. Ask user to confirm scope or revise acceptance criteria. |

### Suspend behavior

When the Probe Gate suspends the pipeline:

1. Write a `probe-gate-output.json` artifact with `gate_decision = "fail"` or `"blocked"` and a `probe_analysis` summary.
2. Present the analysis to the user in plain language: what was expected, what was observed, and what is ambiguous.
3. List explicit options for the user to choose from (e.g., refine problem statement, adjust expected signatures or hypotheses, skip probe and proceed with justification).
4. Do **not** advance to ENGINEER (impl) or any later stage until the user responds.

### After user responds to a Probe Gate suspension

- If the user provides more information: re-run ENGINEER (probe) with the updated context.
- If the user instructs to skip the probe and proceed: record the skip decision in the gate artifact and advance with `gate_decision = "not_applicable"` and a `skip_reason`.
- If the user terminates the request: stop.

## Stage advancement rules

1. Start every new request at `INTAKE`.
2. Announce the current stage before running it.
3. Advance automatically only when the current stage has no blocking questions and required upstream gates have passed or been skipped.
4. If a stage emits blocking questions, stop and present them to the user.
5. Persist every stage artifact before invoking the next stage.
6. If multiple models are used, preserve `producer` metadata for each artifact.
7. The Probe Gate is a hard stop — never advance past it silently on a non-pass decision.
