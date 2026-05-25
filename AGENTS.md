# AGENTS.md

This repository implements a modular, model-neutral AI engineering pipeline.
Any agent or harness connected to this directory should follow these instructions.

## Pipeline

Default flow:

```
INTAKE -> PM -> [ARCHITECT?] -> [SECURITY?]
  -> ENGINEER (probe: diagnosis if bug | tdd if feature/improvement)
  -> EXECUTOR (probe run)
  -> PROBE-GATE
  -> ENGINEER (impl)
  -> [REVIEW?] -> EXECUTOR -> QA -> [RELEASE_READINESS?]
```

The executor is a runtime stage, not a creative stage.

The probe phase exists to validate problem clarity before any implementation code is written. For bugs, this is a **Diagnosis Probe**: the engineer builds a reproducible feedback loop, confirms the failure, and produces ranked hypotheses. For features and improvements, this is a **TDD Probe**: the engineer writes failing tests that define the expected behavior. The Probe Gate enforces this check in both modes and is a hard stop.

## Universal rules

1. Every stage output is a **single JSON object** and nothing else.
2. Every stage output uses the Artifact Envelope (see below) and the matching body schema.
3. Preserve `request_id`, `schema_version`, and relevant `parent_artifact_ids`.
4. Do not mix stage responsibilities.
5. Do not fabricate evidence, execution results, or tracking references.
6. All file writes must stay within approved worktrees or artifact folders.
7. If a required input artifact or evidence file is missing, stop and surface the problem instead of guessing.
8. If a field shape changes in one producer, update every downstream consumer in the same change.

## Universal behavior

- State assumptions explicitly.
- Ask blocking questions instead of guessing when a material ambiguity remains.
- Prefer the minimum solution that satisfies the request.
- Keep changes surgical.
- Tie implementation and evaluation back to acceptance criteria and evidence.
- For bug fixes, prefer a path that reproduces before the fix and passes after the fix.
- When practical, express plans as `step -> verify: check`.

## Stage routing rules

- Run **Architect** when: cross-repo boundaries, API changes, schema changes, runtime behavior changes, new subsystems, or architectural risk is medium/high.
- Run **Security** when: auth, permissions, secrets, external input, file access, network access, code execution, sensitive data, new dependencies, CI/CD, release, or supply-chain concerns.
- Run **Review** when: second opinion requested, change is medium/high risk, >3 files change, or a public interface changes.
- Run **Release Readiness** when: code changes were applied, or the user asks whether the work is ready to ship.
- **Engineer probe mode is determined by PM `work_type`**: use Diagnosis Probe for `bug`; use TDD Probe for `feature`, `improvement`, or `technical_debt`.
- **PROBE-GATE always runs** between the probe executor and the implementation phase. If probe results are unsatisfactory, suspend and surface the analysis to the user — do not proceed to implementation without explicit user direction.

## Skills

Read the relevant skill file before running each stage:

| Stage             | Skill file                                  |
|-------------------|---------------------------------------------|
| Intake            | `skills/intake/SKILL.md`                    |
| PM                | `skills/pm/SKILL.md`                        |
| Architect         | `skills/architect/SKILL.md`                 |
| Security          | `skills/security/SKILL.md`                  |
| Engineer          | `skills/engineer/SKILL.md`                  |
| Diagnose (probe)  | `skills/diagnose/SKILL.md`                  |
| Executor          | `skills/executor/SKILL.md`                  |
| Review            | `skills/review/SKILL.md`                    |
| QA                | `skills/qa/SKILL.md`                        |
| Release Readiness | `skills/release-readiness/SKILL.md`         |

## Artifact Envelope

Every stage output must wrap its body in this envelope:

```json
{
  "schema_version": "2.0",
  "artifact_type": "string",
  "artifact_id": "string",
  "request_id": "string",
  "producer": {
    "role": "intake | pm | architect | security | engineer | review | executor | qa | release_readiness",
    "model_provider": "string",
    "model_name": "string",
    "runtime_name": "string | null"
  },
  "created_at_utc": "YYYY-MM-DDTHH:MM:SSZ",
  "parent_artifact_ids": ["string"],
  "confidence": "low | medium | high",
  "body": {}
}
```

## Further reference

Full body schemas: `docs/contracts/stage-body-schemas.md`
Gate logic and flow rules: `docs/runtime/gates-and-flow.md`
Storage layout and artifact filenames: `docs/runtime/storage-layout.md`
