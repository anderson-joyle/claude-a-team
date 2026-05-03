# Change Log

## 2026-05-03 — Move token cost onto the artifact envelope

### What changed

`context_cost_tokens` (input / cached_input / output / total) is now a top-level field on the **artifact envelope**, so every stage artifact carries its own token consumption directly. It was previously only on the `<stage>-quality.json` sidecar.

The sidecar (`StageQualityBody`) keeps `context_budget_tokens` and `over_budget_reason` — those are stage-level constraints, not artifact properties. The over-budget rule now reads cost from the described artifact's envelope rather than from a duplicated copy on the sidecar.

Deterministic producers (the executor) emit envelopes with `context_cost_tokens` fields set to `null`. Stages writing artifacts by hand may also leave the fields `null`, but the runtime that wraps a model call should populate them from the provider's response.

### Files affected

| File | Change |
|---|---|
| `docs/contracts/artifact-envelope.md` | Adds `context_cost_tokens` to the envelope and a rule explaining when it is `null` |
| `docs/contracts/stage-body-schemas.md` | Removes `context_cost_tokens` from `StageQualityBody`; sidecar rule now references the envelope of the described artifact |
| `docs/runtime/context-budget.md` | "Recording context cost" section rewritten to point cost at the envelope and budget/justification at the sidecar |
| `CLAUDE.md` | Stage-quality-sidecars section updated to match |
| `.claude/skills/executor/run.mjs` | `envelope()` helper emits `context_cost_tokens` with all fields `null` (executor is deterministic) |
| `sessions/_examples/bug-401-on-valid-token/artifacts/*.json` | Every example envelope gains `context_cost_tokens`; `pm-quality.json` no longer carries the duplicated cost block |

### Idea behind it

Cost-of-production is a property of the artifact, not of a separate quality report. Putting it on the envelope means any consumer — pipeline gate, team-learning scanner, future cost dashboard — can read consumption per artifact without joining to a sidecar. The sidecar becomes the place where a stage records its budget and explains overruns; the envelope is the canonical record of what each producer actually spent.

## 2026-04-30 — Pipeline teeth, runtime executor, and cross-request memory

### What changed

The team metaphor now has machinery behind it. Five additions:

1. **Executor skill (`.claude/skills/executor/SKILL.md` + `run.mjs`)** — the runtime stage referenced by CLAUDE.md but previously unimplemented. The Executor consumes `probe-output.json` (probe mode) or `engineer-output.json` (impl mode), applies planned changes deterministically, runs commands, and writes `ExecutionResultsBody`. It refuses to run impl mode without a passing `probe-gate-output.json`.

2. **Pipeline-enforcement hooks (`.claude/settings.json` + `.claude/hooks/`)** — a `PreToolUse` hook on `Edit | Write | MultiEdit` blocks edits to a session worktree until the Probe Gate has passed. SessionStart/SessionEnd manage a project-scoped lease so concurrent sessions can be detected. Stop fires the team-learning scan asynchronously. Hook IDs follow the ECC pattern (`pre:edit:probe-gate`, `lifecycle:session-start:lease`, `stop:session:team-learning`).

3. **Stage-quality sidecars (`StageQualityBody`)** — every creative stage may emit a `<stage>-quality.json` recording `evidence_completeness`, `context_budget_tokens`, `context_cost_tokens`, `over_budget_reason`, and `duration_ms`. Additive metadata, not a replacement for the stage output.

4. **Team-learning skill + scanner (`.claude/skills/team-learning/`)** — reflective stage that walks completed sessions, extracts repeated diagnosis hypotheses, TDD failure signatures, review concerns, and QA regressions, and emits `team_knowledge` patterns under `_team-knowledge/<YYYY-MM>/<name>.json`. Patterns require ≥2 supporting requests; consumers are typed.

5. **Per-stage context budgets and skill placement policy** — two new runtime docs (`docs/runtime/context-budget.md`, `docs/runtime/skill-placement-policy.md`). Budgets default per stage and are enforced by report rather than refusal: overruns must be justified in the quality sidecar. Placement policy keeps the skill catalog small and predictable; explicitly rejects domain skills, language reviewers, and proactive agent patterns.

A reference fixture session (`sessions/_examples/bug-401-on-valid-token/`) demonstrates the full chain end-to-end, including the new `probe-results.json`, `execution-results.json`, and `pm-quality.json` artifacts.

### Files affected

| File | Change |
|---|---|
| `CLAUDE.md` | Skills list adds executor and team-learning; new sections for hook-enforced gating, stage-quality sidecars, and reference example sessions |
| `.claude/settings.json` | New — hook configuration for PreToolUse/SessionStart/SessionEnd/Stop |
| `.claude/hooks/_lib.mjs` | New — shared helpers (lease management, gate-status check, session enumeration) |
| `.claude/hooks/pre-edit-gate.mjs` | New — PreToolUse hook: blocks worktree edits before Probe Gate passes |
| `.claude/hooks/session-start.mjs`, `.claude/hooks/session-end.mjs` | New — lease management |
| `.claude/hooks/stop-team-learning.mjs` | New — fires team-learning scanner detached |
| `.claude/skills/executor/SKILL.md` | New — runtime stage contract |
| `.claude/skills/executor/run.mjs` | New — reference Node runner enforcing the contract |
| `.claude/skills/team-learning/SKILL.md` | New — reflective stage contract |
| `.claude/skills/team-learning/scan.mjs` | New — reference scanner stub |
| `.claude/skills/engineer/SKILL.md` | Phase 2 output contract gains an explicit Executor handoff section |
| `docs/contracts/stage-body-schemas.md` | Adds `StageQualityBody` and `TeamKnowledgeBody` |
| `docs/runtime/gates-and-flow.md` | Adds "Hook-enforced gating" section explaining the PreToolUse safety net |
| `docs/runtime/storage-layout.md` | Documents stage-quality sidecars, `_team-knowledge/`, lease files, and `sessions/_examples/` |
| `docs/runtime/context-budget.md` | New — per-stage default budgets and reading patterns |
| `docs/runtime/skill-placement-policy.md` | New — strict policy on what kinds of content live where |
| `.gitignore` | Live sessions are ignored; `sessions/_examples/` remains tracked |
| `sessions/_examples/bug-401-on-valid-token/` | New — end-to-end fixture for the contract |

### Idea behind it

Claude-a-team's strength is the artifact contract. Its weakness, until now, was that the contract was enforced by Claude's discipline rather than by the system. Three failure modes were possible: Claude could edit code before the Probe Gate passed; the Executor existed only as a description; and there was no mechanism for the team to remember what it had already learned across requests.

The everything-claude-code project demonstrates a different approach — agent-first orchestration with a 182-skill catalog. Most of its patterns dilute the team contract (proactive routing, language-specific reviewers, on-demand specialist delegation). But four patterns translate cleanly: hook IDs with semantic matchers, Stop-hook continuous learning, the autonomous-loops sequential pipeline, and per-stage context budgets. This change imports those four and nothing else, in a form that *strengthens* rather than dilutes the artifact handoff.

The Probe Gate now has teeth via the PreToolUse hook. The Executor is real code, not a referenced abstraction. Stage quality is recorded next to every creative artifact. Recurring patterns become typed `team_knowledge` artifacts that future stages can read. The team is now a team that remembers, with discipline enforced where it costs the most to break it.

## 2026-04-29 — Replace TDD probe with Diagnosis Probe for bug work

### What changed

The Engineer skill previously ran a single TDD probe for all work types: write failing tests, run them, confirm they fail, then implement. This was replaced with a two-mode probe system:

- **Diagnosis Probe** (bugs): build a reproducible feedback loop, confirm the failure, and produce ranked falsifiable hypotheses before any implementation begins. The feedback loop can be a failing test, a curl script, a headless browser run, a bisection harness, or any of ten supported types — whatever produces a reliable signal fastest.
- **TDD Probe** (features / improvements / technical debt): unchanged from the original — write failing tests that define the expected behavior, confirm they fail, then implement.

The gate that enforces the probe was renamed from **TDD Gate** to **Probe Gate** and gained separate decision logic for each mode. For the diagnosis path, the gate now checks that a feedback loop is confirmed, the failure reproduces, and at least 3 ranked hypotheses are present — not just that tests failed as expected.

A new skill file (`.claude/skills/diagnose/SKILL.md`) holds the full diagnosis probe methodology, adapted from [mattpocock/skills](https://github.com/mattpocock/skills).

### Files affected

| File | Change |
|---|---|
| `CLAUDE.md` | Pipeline diagram, probe description, routing rule, skills list |
| `.claude/skills/engineer/SKILL.md` | Phase 1 split into Phase 1A (diagnosis) and Phase 1B (TDD); Phase 2 uses top-ranked hypothesis as implementation starting point for bugs |
| `.claude/skills/diagnose/SKILL.md` | New — diagnosis probe methodology (10 feedback loop types, reproduce checklist, hypothesise format) |
| `docs/runtime/gates-and-flow.md` | TDD Gate → Probe Gate; two decision tables, one per mode |
| `docs/contracts/stage-body-schemas.md` | `TDDProbeOutputBody` → `ProbeOutputBody` with `probe_mode` and separate `diagnosis`/`tdd` sub-blocks; `TDDGateOutputBody` → `ProbeGateOutputBody` |
| `docs/runtime/storage-layout.md` | Artifact filenames: `tdd-probe-output.json` → `probe-output.json`, `tdd-probe-results.json` → `probe-results.json`, `tdd-gate-output.json` → `probe-gate-output.json` |

### Idea behind it

The TDD probe works well for features — you know what you want to build, so you can write a test that describes it. For bugs, the TDD probe forces you to write failing tests before you understand what is actually wrong, which often results in tests that capture the symptom rather than the cause, or that cannot be written at all because the problem statement is not precise enough.

The diagnosis probe flips this: instead of starting with tests, it starts with the question "can I reliably reproduce this?" A feedback loop that reliably surfaces the bug is more valuable than a test written against an incomplete understanding. The hypothesis step then forces the engineer to reason about causes before touching any implementation code, which keeps fixes surgical and avoids the common failure mode of patching the symptom without addressing the root cause.

TDD remains the right discipline for feature and improvement work, where the behavior is specified in advance and failing tests are a natural way to express it.
