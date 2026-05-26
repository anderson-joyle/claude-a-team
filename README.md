# Claude A-TEAM

> ⚠️ This is a personal project, under MIT license. ⚠️

A-TEAM is a structured, multi-role AI workflow for software engineering work. Each request moves through a pipeline of specialist skills — Intake, PM, Engineer, QA, and others — where every stage reads the previous stage's typed JSON artifact and writes a new one. This keeps each role's reasoning separate, auditable, and chainable across models or runtimes.

You invoke skills with `/intake`, `/pm`, `/engineer`, `/qa`, etc. The skills are self-contained: each one reads the contract docs and its predecessor artifacts, does its job, and produces a single JSON output. Claude Code runs the pipeline; you steer it.

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
| **Executor** | After Engineer probe; after Engineer impl | Runs commands/applies changes, records exit codes and output — no reasoning, no rewrites |
| **Probe Gate** | After Executor (probe run) | Pass/fail decision on probe evidence; hard stop before implementation |
| **Engineer (impl)** | After Probe Gate passes | Implementation plan, planned file changes, execution handoff |
| **Review** | Medium/high risk, 2nd opinion requested, >3 files change | Concerns, recommended changes, approval status |
| **QA** | After execution results exist | Verified acceptance criteria, findings, ship/hold recommendation |
| **Release Readiness** | After QA, or when user asks if it's ready to ship | Blocking issues, rollback readiness, final recommendation |

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
│       └── storage-layout.md        ← session folder structure and artifact filenames
├── skills/
│   ├── intake/
│   ├── pm/
│   ├── architect/
│   ├── security/
│   ├── engineer/
│   ├── diagnose/                    ← Diagnosis Probe methodology (called by engineer)
│   ├── executor/                    ← runtime stage: applies changes, runs commands
│   ├── review/
│   ├── qa/
│   └── release-readiness/
├── sessions/                        ← one subfolder per request, holds all artifacts
└── viewer/
    └── index.html                   ← local pipeline viewer (open in any browser)
```

---

## Viewer

The pipeline viewer is a single-file HTML app (`viewer/index.html`) that lets you inspect any session's artifacts visually — no server, no build step, no dependencies.

### Benefits

- **Full pipeline at a glance** — every stage appears in order with a pass/warn/fail/skip status dot. Missing optional stages are shown as skipped rather than hidden.
- **Expandable detail** — click any stage card to see its key fields rendered in a clean grid. Acceptance criteria, hypotheses, commands, planned file changes, and findings each get purpose-built layouts.
- **Token and cost tracking** — the summary bar shows total token consumption (input / cached / output) and an estimated USD cost derived from Anthropic's public pricing, aggregated across all artifacts in the session. Each expanded artifact card also shows its individual token breakdown and cost estimate. Hover the chips for the full input/cached/output split.
- **Developer mode** — toggle raw JSON view for any stage to inspect the full artifact envelope.
- **Multi-session sidebar** — load multiple session folders at once and switch between them without reloading.
- **Zero setup** — open `viewer/index.html` directly in your browser. Drag a session folder onto the page or use the file picker.

### How to use

1. Open `viewer/index.html` in any modern browser (Chrome, Edge, Firefox, Safari).
2. Drag a session folder (e.g. `sessions/fix-login-timeout/`) onto the page — or click **＋ Add sessions** and select the folder.
3. The viewer reads `*.json` files exclusively from the `artifacts/` subfolder inside the dropped session folder and maps them to pipeline stages by filename.
4. Use the sidebar to switch between sessions. Click any stage card to expand it. Toggle **Developer view** for the raw artifact JSON.

> Sessions live under `sessions/` — each subfolder is one request. You can load multiple session folders at once to compare runs side by side in the sidebar.

### Screenshot
<img width="1855" height="1244" alt="Screenshot 2026-05-25 190821" src="https://github.com/user-attachments/assets/ea11e2f3-b48a-405e-bf01-8cfd62be2451" />
<img width="1859" height="1248" alt="Screenshot 2026-05-25 190833" src="https://github.com/user-attachments/assets/5165cad7-3d04-4e4d-86a3-d07a89521092" />
<img width="1858" height="1247" alt="Screenshot 2026-05-25 190847" src="https://github.com/user-attachments/assets/7ed865bb-ecf3-461b-8f84-f9a5f13d379d" />




---

## Design principles

- **One canonical contract.** All stages share the same artifact envelope and centralized body schemas. Changing a schema in one place updates every consumer.
- **Role separation.** Each skill has a narrow job. PM does not propose code. Engineer does not redefine product intent. QA does not approve untested criteria.
- **Model-neutral.** The artifact format includes `producer` metadata so the pipeline can mix Claude, GPT, Codex, or non-LLM runtimes and still trace which model produced what.
- **Probe before implementation.** The Probe Gate enforces that bugs are reproducible and features are test-defined before any code is written. This prevents the common failure mode of implementing against a misunderstood problem.
- **Hard stops over silent progress.** Blocking questions, missing evidence, and failed gates surface explicitly. The pipeline does not guess or skip ahead.
