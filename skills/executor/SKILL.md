# Skill: Executor

The Executor is a **runtime stage**, not a creative stage. It applies a typed JSON contract and reports what happened. It does not reason, plan, refactor, or rewrite. If the contract is ambiguous, the Executor stops and surfaces the ambiguity — it never guesses.

The Executor runs in two modes:

- **Probe mode** — consume `probe-output.json`, run its `probe_commands`, write `probe-results.json`.
- **Implementation mode** — consume `engineer-output.json`, apply its `planned_changes`, run its `execution_handoff.test_commands`, write `execution-results.json`.

Both modes produce an `ExecutionResultsBody` (see `/docs/contracts/stage-body-schemas.md`).

---

## When the Executor runs

| Trigger | Mode | Input | Output |
|---|---|---|---|
| ENGINEER (probe) just completed | probe | `probe-output.json` | `probe-results.json` |
| ENGINEER (impl) just completed and Probe Gate passed | impl | `engineer-output.json` | `execution-results.json` |

The Executor does not run before the Probe Gate in implementation mode. It does not modify or rewrite the upstream artifact.

---

## Read first

- `/AGENTS.md`
- `/docs/contracts/artifact-envelope.md`
- `/docs/contracts/stage-body-schemas.md` (CommandSpec, PlannedFileChange, ExecutedCommandResult, ExecutionResultsBody)
- `/docs/runtime/storage-layout.md` (worktree rules)

---

## Inputs required

### Probe mode

- `probe-output.json` (this run's probe artifact)
- The session worktree (must already exist for the active repo roots)

### Implementation mode

- `engineer-output.json` (this run's implementation artifact)
- `probe-gate-output.json` with `decision = "pass"` or `"not_applicable"`
- The session worktree

The Executor refuses to run if any required input is missing. It writes a `not_attempted` result with `notes` explaining what was missing.

---

## Responsibilities

### Probe mode

1. Read `probe-output.json`.
2. For each `probe_commands[*]`:
   - Run the command in the worktree for the matching `repo_root_id`. If no `repo_root_id` is associated, run in the first repo's worktree.
   - Capture exit code, duration, stdout, stderr.
   - Write stdout to `logs/<artifact_id>/<command_id>.stdout` and stderr to `logs/<artifact_id>/<command_id>.stderr`.
3. Build `commands_attempted: [ExecutedCommandResult]`.
4. Set `apply_status = "not_attempted"` (probe mode never applies file changes).
5. Set `applied_changes = []`.
6. Write `probe-results.json` with `artifact_type = "execution_results"`, `producer.role = "executor"`.

### Implementation mode

1. Read `engineer-output.json`.
2. Verify `probe-gate-output.json` exists with `decision = "pass"` or `"not_applicable"`. If not, refuse: write a `not_attempted` result with `notes` explaining the missing or non-passing gate.
3. For each `planned_changes[*]`:
   - Resolve `repo_root_id` to the corresponding worktree path.
   - Validate `path` is repo-relative, not absolute, contains no `..`.
   - Apply the change:
     - `content_mode = "full_file"`: write the file (creating parent directories as needed).
     - `content_mode = "unified_diff"`: apply the patch with `git apply` from the worktree.
   - Record `applied_changes[*]` with `status: applied | failed | skipped` and a `message`.
4. For each `execution_handoff.test_commands[*]`:
   - Run, capture, log (same as probe mode).
5. Build `commands_attempted: [ExecutedCommandResult]`.
6. Set `apply_status`:
   - `applied` — every planned change applied successfully.
   - `partially_applied` — at least one applied, at least one failed.
   - `failed` — all planned changes failed.
7. Write `execution-results.json`.

---

## You must not

- Modify, summarize, or "improve" the upstream artifact's content.
- Apply changes outside the session worktree.
- Apply changes when `probe-gate-output.json` is missing or its `decision` is not `pass`/`not_applicable`.
- Skip a planned change because you disagree with it. If a change cannot be applied (path invalid, patch does not apply), record `failed` with the reason — do not silently skip.
- Run commands the artifact did not list.
- Reformat output. The runner's job is to record exit codes and raw streams, not to interpret them.
- Continue running test commands after a planned-change application failure unless the artifact explicitly authorizes it (`execution_handoff.run_tests_on_partial_apply = true` is reserved for future use; today the answer is always stop and report).

---

## Output contract

Both modes produce an `ExecutionResultsBody` envelope:

- `artifact_type = "execution_results"`
- `producer.role = "executor"`
- `parent_artifact_ids` includes the input artifact (`probe-output.json` or `engineer-output.json`) and, in impl mode, `probe-gate-output.json`.
- `confidence = "high"` always — runtime exit codes are not subjective.
- File: `probe-results.json` (probe mode) or `execution-results.json` (impl mode).

---

## Reference runner

The contract above is the source of truth. Any conformant runner is acceptable — Node.js, PowerShell, Python, or the harness's own tool execution. If you write a custom runner it must produce identical output shapes.

---

## Working style

- Be deterministic. Same input, same output (modulo timestamps and durations).
- Be terse. Notes record what happened in one line each. The artifact is not a narrative.
- Fail loudly. If the worktree is dirty, if a path resolves outside the repo, if a patch context-mismatches — record the failure and stop. Do not patch around it.
