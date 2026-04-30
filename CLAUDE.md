# CLAUDE.md

This repository uses a modular Claude Code workflow.

The goal is to keep this root file short and stable while moving stage-specific behavior into reusable skills.
The canonical workflow remains model-neutral: every stage reads typed JSON artifacts from the current request folder and writes a new typed JSON artifact back into that same folder.

## What stays global in this file

These rules apply to every stage and every skill:

1. Every stage output is a **single JSON object** and nothing else.
2. Every stage output uses the shared **Artifact Envelope** and the matching body schema.
3. Preserve `request_id`, `schema_version`, and relevant `parent_artifact_ids`.
4. Do not mix stage responsibilities.
5. Do not fabricate evidence, execution results, or tracking references.
6. All file writes must stay within approved worktrees or artifact folders.
7. If a required input artifact or evidence file is missing, stop and surface the problem instead of guessing.
8. If a field shape changes in one producer, update every downstream consumer in the same change.

## Universal behavior rules

- State assumptions explicitly.
- Ask blocking questions instead of guessing when a material ambiguity remains.
- Prefer the minimum solution that satisfies the request.
- Keep changes surgical.
- Tie implementation and evaluation back to acceptance criteria and evidence.
- For bug fixes, prefer a path that reproduces before the fix and passes after the fix.
- When practical, express plans as `step -> verify: check`.

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

## Read these files before running any stage

- `docs/contracts/artifact-envelope.md`
- `docs/contracts/stage-body-schemas.md`
- `docs/runtime/gates-and-flow.md`
- `docs/runtime/storage-layout.md`
- `docs/runtime/context-budget.md`
- `docs/runtime/skill-placement-policy.md`

## Skills

Use the matching skill for each creative stage:

- `.claude/skills/intake/SKILL.md`
- `.claude/skills/pm/SKILL.md`
- `.claude/skills/architect/SKILL.md`
- `.claude/skills/security/SKILL.md`
- `.claude/skills/engineer/SKILL.md` — routes internally to `.claude/skills/diagnose/SKILL.md` (bugs) or TDD probe (features/improvements)
- `.claude/skills/executor/SKILL.md` — runtime stage; applies probe and engineer artifacts deterministically
- `.claude/skills/review/SKILL.md`
- `.claude/skills/qa/SKILL.md`
- `.claude/skills/release-readiness/SKILL.md`
- `.claude/skills/team-learning/SKILL.md` — reflective; emits `team_knowledge` patterns at session end (fired by Stop hook)

## Pipeline-enforcement hooks

Hooks in `.claude/settings.json` enforce the team contract programmatically:

- **PreToolUse** on `Edit | Write | MultiEdit` blocks edits to a session worktree until that session's `probe-gate-output.json` has `decision = pass | not_applicable`. This is what gives the Probe Gate teeth.
- **SessionStart / SessionEnd** manage a project-scoped lease so concurrent sessions can be detected.
- **Stop** fires `team-learning` asynchronously to extract cross-request patterns into `_team-knowledge/`.

## Stage-quality sidecars

Every creative stage may emit a `<stage>-quality.json` alongside its output (see `StageQualityBody` in stage-body-schemas.md). The sidecar records `evidence_completeness`, `context_budget_tokens`, `context_cost_tokens`, and `over_budget_reason`. It is additive metadata, not a replacement for the stage output.

## Reference example sessions

`sessions/_examples/` contains end-to-end fixture sessions (e.g. `bug-401-on-valid-token`) that demonstrate every artifact on the contract. Read them when the schemas alone are insufficient.

## Stage routing rules

- Run **Architect** when cross-repo boundaries, API changes, schema changes, runtime behavior changes, or architectural risk are present.
- Run **Security** when auth, permissions, secrets, external input, file access, network access, code execution, sensitive data, dependency trust, CI/CD, release, or supply-chain concerns are present.
- Run **Review** when a second opinion is requested or the change is medium/high risk.
- Run **Release Readiness** when code changes were applied or the user asks whether the work is ready to ship.
- **Engineer probe mode is determined by PM `work_type`**: use Diagnosis Probe for `bug`; use TDD Probe for `feature`, `improvement`, or `technical_debt`.
- **PROBE-GATE always runs** between the probe executor and the implementation phase. If probe results are unsatisfactory, suspend and surface the analysis to the user — do not proceed to implementation without explicit user direction.

For the full details, use the runtime docs.
