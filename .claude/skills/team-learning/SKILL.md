# Skill: Team-Learning

Team-learning is a **reflective skill** that runs at session end. It scans completed sessions, finds patterns that recur across requests, and emits `team_knowledge` artifacts that future stages can read. It is what turns claude-a-team from a memoryless team of contractors into a team that *remembers*.

This skill is fired by the Stop hook (`.claude/hooks/stop-team-learning.mjs`). It does not run at the user's prompt and does not block the conversation.

---

## Why this exists

Each request, on its own, is an isolated transaction with a clean handoff chain. But the *team* should accumulate institutional knowledge. If the Engineer's diagnosis probes have flagged SQL escaping in `auth.ts` four times in eight weeks, the next intake of an `auth.ts` bug should mention that pattern. If the QA stage repeatedly finds that release-readiness reports `documentation_readiness = partial`, the team has a documentation-flow problem worth surfacing.

Team-learning produces these patterns. It does **not** modify stage skills, prompts, or the artifact contract. It writes typed `team_knowledge` JSON that consumers read on demand.

---

## When team-learning runs

The Stop hook fires after Claude finishes responding. The hook:

1. Counts active session leases. If more than one is active, defer (another session will run the scan when it stops).
2. Spawns `.claude/skills/team-learning/scan.mjs` detached. The scan runs in the background.
3. Returns control to Claude immediately.

The scan never blocks user-visible work.

---

## What the scan does

For each completed session in `sessions/`:

1. Walk `sessions/<*>/artifacts/` and read every artifact.
2. Derive features:
   - Files referenced in `engineer-output.json` `files_to_investigate`.
   - Hypothesis statements from `probe-output.json` (diagnosis mode).
   - Failure signatures from `probe-output.json` (TDD mode).
   - Concerns from `review-output.json`.
   - Failed acceptance criteria from `qa-output.json`.
3. Bucket features by scope: `repo`, `request_type` (PM `work_type`), or `file_pattern` (e.g. files matching `auth.*`).
4. For each bucket with at least 2 supporting requests, emit a `team_knowledge` artifact.

The scan is idempotent: re-running it produces the same artifacts. Re-runs update `last_seen_at_utc` and `occurrence_count` rather than creating duplicates.

---

## Output contract

Each pattern is written to `_team-knowledge/<YYYY-MM>/<short-name>.json` using the `team_knowledge` envelope and `TeamKnowledgeBody`. See `/docs/contracts/stage-body-schemas.md`.

Required fields:
- `supporting_request_ids` must list at least 2 distinct requests.
- `consumers` must list at least one stage that should read this pattern.
- Patterns with only one supporting request are discarded.

---

## How stages consume team-knowledge

Each creative stage may, before producing its output, glob `_team-knowledge/<*>/*.json` and filter by:

- `consumers` includes the current stage
- `scope = "request_type"` and `scope_value` matches PM `work_type`, **or**
- `scope = "file_pattern"` and `scope_value` matches a file in scope, **or**
- `scope = "repo"` and `scope_value` matches the active repo root

The stage then references the matching patterns in its output (e.g. PM might add to `risks`; Engineer might add to `assumptions`). The stage does **not** treat patterns as ground truth — they are heuristics from prior runs, not contracts.

---

## You must not

- Modify or delete artifacts in `sessions/`. Team-learning is read-only on session content.
- Emit a pattern with `supporting_request_ids.length < 2`.
- Hand-edit files under `_team-knowledge/`. They are generated content.
- Run the scan synchronously inside Claude's response loop. It must be detached.
- Cite a `team_knowledge` pattern in a stage output without verifying the supporting requests still exist (sessions can be deleted).

---

## Working style

- Be conservative. A false-positive pattern poisons every downstream stage.
- Be specific. "Auth bugs are tricky" is not a pattern. "Diagnosis probes for files matching `auth.*` flagged SQL escape concerns in 3 of the last 5 requests" is.
- Be short. Each pattern's `pattern_summary` should fit in one line; `suggested_action` in two.
- Decay gracefully. Patterns whose `last_seen_at_utc` is more than 90 days old should be re-validated by the next scan and removed if no longer active.

---

## Reference scanner

A reference scanner ships at `.claude/skills/team-learning/scan.mjs`. It is intentionally a stub — pattern extraction is the open work. The contract is fixed; the heuristics are pluggable.
