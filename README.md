# Claude A-TEAM

| ⚠️ This is a personal project, under MIT license. ⚠️ |  |
|--|--|
| **A-TEAM** is a structured, multi-role AI workflow for software engineering work.  Each request moves through a pipeline of specialist skills — Intake, PM, Engineer, QA, and others — where every stage reads the previous stage's typed JSON artifact and writes a new one. This keeps each role's reasoning separate, auditable, and chainable across models or runtimes. | <img width="341" height="512" alt="Image" src="https://github.com/user-attachments/assets/4063b4e3-4128-406c-9250-9f151a2f5ebc" /> |




You invoke skills with `/intake`, `/pm`, `/engineer`, `/qa`, etc. The skills are self-contained: each one reads the contract docs and its predecessor artifacts, does its job, and produces a single JSON output. Claude Code runs the pipeline; you steer it.

The pipeline has **teeth**: a `PreToolUse` hook blocks edits to a session's worktree until the Probe Gate has passed, the Executor is a real runtime with a Node runner that refuses to apply implementation changes without a passing gate, and a Stop hook fires the team-learning skill at session end so the team builds cross-request memory.

---

## Pipeline

The default flow is:

```
INTAKE → PM → [ARCHITECT?] → [SECURITY?]
  → ENGINEER (probe)
  → EXECUTOR (run probe)
  → PROBE-GATE  ← hard stop
  → ENGINEER (impl)
  → [REVIEW?] → EXECUTOR → QA → [RELEASE_READINESS?]
```

Stages in `[brackets?]` are conditional — the routing rules below say when they run.

**The probe phase is mandatory.** Before any implementation code is written, the Engineer either builds a feedback loop that reproduces the bug (Diagnosis Probe, for `bug` work) or writes failing tests that define the new behavior (TDD Probe, for `feature` / `improvement` / `technical_debt`). The Probe Gate is a hard stop: it will not advance unless the probe evidence is solid.

---

## Skills

| Skill | Trigger | Output |
|---|---|---|
| **Intake** | New request arrives | Normalized request, suggested gates, blocking questions |
| **PM** | After Intake | Work type, problem statement, acceptance criteria, scope |
| **Architect** | API/schema changes, cross-repo, architectural risk | Design constraints, recommended approach, gate decision |
| **Security** | Auth, secrets, external input, new deps, CI/CD changes | Threat surfaces, required controls, gate decision |
| **Engineer (probe)** | After PM (and optional gates) | Diagnosis Probe (`bug`) or TDD Probe (`feature`/`improvement`) |
| **Diagnose** | Called internally by Engineer for bugs | Feedback loop types, reproduce checklist, ranked hypotheses |
| **Executor** | After Engineer (probe or impl) | Deterministic runtime; applies planned changes, runs commands, writes `ExecutionResultsBody` |
| **Engineer (impl)** | After Probe Gate passes | Implementation plan, planned file changes, execution handoff |
| **Review** | Medium/high risk, 2nd opinion requested, >3 files change | Concerns, recommended changes, approval status |
| **QA** | After execution results exist | Verified acceptance criteria, findings, ship/hold recommendation |
| **Release Readiness** | After QA, or when user asks if it's ready to ship | Blocking issues, rollback readiness, final recommendation |
| **Team-Learning** | Fired at session end by the Stop hook | Cross-request `team_knowledge` patterns under `_team-knowledge/` |

---

## Routing rules

- **Architect** — run when a public API or contract changes, a schema or data model changes, more than one repo is in scope, or a new service boundary is introduced.
- **Security** — run when auth, secrets, external input, file access, network, code execution, PII, new dependencies, or CI/CD is involved.
- **Review** — run when the user asks for a second opinion, the change is medium/high risk, more than 3 files change, or a public interface changes.
- **Release Readiness** — run when code changes were applied or the user asks whether the work is ready to ship.
- **Engineer probe mode** — `bug` → Diagnosis Probe; `feature` / `improvement` / `technical_debt` → TDD Probe.

---

## Artifacts

Every skill produces a single JSON object wrapped in the artifact envelope:

```json
{
  "schema_version": "2.0",
  "artifact_type": "pm_output",
  "artifact_id": "pm-001",
  "request_id": "fix-login-timeout",
  "producer": { "role": "pm", "model_provider": "anthropic", "model_name": "claude-sonnet-4-6" },
  "created_at_utc": "2026-04-29T10:00:00Z",
  "parent_artifact_ids": ["intake-001"],
  "confidence": "high",
  "body": { ... }
}
```

Artifacts are stored under `sessions/{request-name}/artifacts/`. The session folder doubles as the audit trail.

Each creative stage may also emit a small `<stage>-quality.json` **sidecar** recording `evidence_completeness`, `context_budget_tokens`, `context_cost_tokens`, and an `over_budget_reason` if the stage exceeded its budget. The sidecar is additive metadata — it never replaces the stage output.

A reference end-to-end fixture lives at `sessions/_examples/bug-401-on-valid-token/` showing every artifact in the chain, including a stage-quality sidecar and the Executor's probe and impl results.

---

## Pipeline-enforcement hooks

`.claude/settings.json` registers four hooks that enforce the team contract programmatically:

| Hook | Event | What it does |
|---|---|---|
| `pre:edit:probe-gate` | PreToolUse on `Edit | Write | MultiEdit` | Blocks edits to a session worktree until that session's `probe-gate-output.json` has `decision = pass | not_applicable`. This is what gives the Probe Gate teeth. |
| `lifecycle:session-start:lease` | SessionStart | Writes a project-scoped lease so concurrent A-TEAM sessions can be detected. |
| `lifecycle:session-end:lease` | SessionEnd | Removes the lease. |
| `stop:session:team-learning` | Stop | Fires `team-learning/scan.mjs` detached so cross-request pattern extraction never blocks the user. |

Edits to artifacts (`sessions/<*>/artifacts/...`), workflow docs, or skills are always allowed. Only worktree code edits are gated.

---

## Cross-request memory

`_team-knowledge/<YYYY-MM>/<short-name>.json` holds typed `team_knowledge` patterns produced by the Team-Learning skill. A pattern requires at least two supporting requests; single-occurrence observations are discarded. Each pattern names the stages it should be read by, so a recurring diagnosis hint can flow into Intake or Engineer on the next matching request.

This is what turns A-TEAM from a memoryless team of contractors into a team that remembers what it has learned.

---

## Per-stage context budget

`docs/runtime/context-budget.md` defines a default token budget per stage (e.g. PM: 16k, Engineer-probe: 32k, Engineer-impl: 48k). Stages that legitimately need more must record an `over_budget_reason` in their quality sidecar. The pipeline does not refuse over-budget runs; it makes them visible so recurring overruns can be addressed.

---

## Examples

### Example 1 — Fixing a bug

**Scenario:** users report that the login form silently fails when the email contains a `+` character.

**Flow:**

1. `/intake` — normalizes the request, suggests no Architect or Security gate (small contained fix)
2. `/pm` — classifies `work_type = "bug"`, writes acceptance criterion: *login succeeds for `user+tag@example.com`*
3. `/engineer` (probe) — Diagnosis Probe mode; builds a `failing_test` feedback loop that calls the auth handler with `user+tag@example.com` and asserts on the error response; confirms reproduction; produces three ranked hypotheses:
   - H-1: `+` is URL-encoded as a space before the email is validated
   - H-2: the regex rejects `+` as an invalid character
   - H-3: the downstream identity provider rejects the address
4. EXECUTOR runs the probe commands; Probe Gate passes (loop confirmed, failure reproduced, 3 hypotheses)
5. `/engineer` (impl) — uses H-1 as the starting point; plans one file change (`auth/validate.ts`) to URL-decode before validation
6. EXECUTOR applies changes and runs tests
7. `/qa` — verifies AC-1 is satisfied; recommends ship
8. `/release-readiness` — confirms rollback plan exists; status: `ready`

**Key behavior:** the Probe Gate would have blocked if the loop was flaky or fewer than 3 hypotheses were produced, surfacing the gap before any code was written.

---

### Example 2 — Adding a feature

**Scenario:** add CSV export to the user activity report page.

**Flow:**

1. `/intake` — normalizes request; flags Review as suggested (touches UI, API, and file generation)
2. `/pm` — classifies `work_type = "feature"`; writes acceptance criteria: *Export button appears on the report page*, *clicking it downloads a valid CSV*, *CSV rows match the on-screen data*
3. `/architect` — change touches the API response shape and adds a new route; produces design constraints (no streaming for now, route must go through existing auth middleware)
4. `/engineer` (probe) — TDD Probe mode; writes three failing tests covering the new route, the CSV formatter, and the button rendering; confirms all three fail against the current code with expected signatures
5. EXECUTOR runs probes; Probe Gate passes (all tests failed as expected)
6. `/engineer` (impl) — produces planned changes for `api/reports.ts`, `components/ReportPage.tsx`, and a new `lib/csv.ts`
7. EXECUTOR applies changes and runs tests
8. `/review` — flags that the CSV formatter doesn't escape commas in user-supplied fields; recommends changes
9. Engineer addresses the review finding; EXECUTOR re-runs
10. `/qa` — all three acceptance criteria verified; ship
11. `/release-readiness` — new route requires a feature flag; status: `ready_with_caveats`

---

### Example 3 — Small improvement, no gates

**Scenario:** the error message shown when a file upload exceeds the size limit is unhelpful ("Upload failed"). Change it to include the limit and actual file size.

**Flow:**

1. `/intake` — normalizes request; suggests no optional gates
2. `/pm` — classifies `work_type = "improvement"`; AC: *error message reads "File too large: 12 MB uploaded, 5 MB limit"*
3. `/engineer` (probe) — TDD Probe; one failing test asserts on the error message string format
4. EXECUTOR runs probe; Probe Gate passes
5. `/engineer` (impl) — one file change to the upload error handler
6. EXECUTOR applies and runs
7. `/qa` — AC verified; ship

No Architect, Security, or Review stages were needed. The pipeline ran straight through in five stages.

---

## Folder structure

```text
claude-a-team/
├── CLAUDE.md                        ← global rules and pipeline definition
├── docs/
│   ├── contracts/
│   │   ├── artifact-envelope.md     ← shared JSON envelope all stages use
│   │   └── stage-body-schemas.md    ← body schema for every artifact type
│   └── runtime/
│       ├── gates-and-flow.md        ← gate triggers and Probe Gate decision tables
│       ├── storage-layout.md        ← session folder structure and artifact filenames
│       ├── context-budget.md        ← per-stage token defaults and reading patterns
│       └── skill-placement-policy.md ← strict policy on what kinds of content live where
├── sessions/
│   └── _examples/
│       └── bug-401-on-valid-token/   ← end-to-end fixture session for the contract
├── _team-knowledge/                  ← generated team_knowledge patterns (per-month)
└── .claude/
    ├── settings.json                 ← hook configuration (probe-gate teeth, lifecycle, Stop)
    ├── hooks/
    │   ├── _lib.mjs                  ← shared helpers (lease, gate-status, session enumeration)
    │   ├── pre-edit-gate.mjs         ← blocks worktree edits until Probe Gate passes
    │   ├── session-start.mjs         ← writes session lease
    │   ├── session-end.mjs           ← removes session lease
    │   └── stop-team-learning.mjs    ← fires team-learning scan detached
    └── skills/
        ├── intake/
        ├── pm/
        ├── architect/
        ├── security/
        ├── engineer/
        ├── diagnose/                 ← Diagnosis Probe methodology (called by engineer)
        ├── executor/                 ← runtime stage; SKILL.md + Node runner (run.mjs)
        ├── review/
        ├── qa/
        ├── release-readiness/
        └── team-learning/            ← reflective stage; SKILL.md + scanner (scan.mjs)
```

---

## Design principles

- **One canonical contract.** All stages share the same artifact envelope and centralized body schemas. Changing a schema in one place updates every consumer.
- **Role separation.** Each skill has a narrow job. PM does not propose code. Engineer does not redefine product intent. QA does not approve untested criteria.
- **Model-neutral.** The artifact format includes `producer` metadata so the pipeline can mix Claude, GPT, Codex, or non-LLM runtimes and still trace which model produced what.
- **Probe before implementation.** The Probe Gate enforces that bugs are reproducible and features are test-defined before any code is written. This prevents the common failure mode of implementing against a misunderstood problem.
- **Hard stops over silent progress.** Blocking questions, missing evidence, and failed gates surface explicitly. The pipeline does not guess or skip ahead.
- **Gates with teeth.** The Probe Gate is enforced by a `PreToolUse` hook, not just convention. Editing a session's worktree before the gate passes is physically blocked.
- **A team that remembers.** The Team-Learning skill scans completed sessions at session end and emits typed `team_knowledge` patterns that future stages can read. Patterns require at least two supporting requests, so the team's institutional memory is conservative by design.
- **Context as a zero-sum resource.** Each stage operates under a default token budget; over-budget runs must justify themselves in the quality sidecar. This is what keeps a long pipeline from spending its entire window in the first stage.
- **Strict skill-placement policy.** The skill catalog stays small on purpose. Domain skills, language-specific reviewers, and proactive agent-routing patterns are explicitly out of scope — they would dissolve the team into a marketplace of contractors.
