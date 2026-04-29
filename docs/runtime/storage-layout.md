# Runtime Storage Layout

## Path conventions

- `{root}` — the directory containing `CLAUDE.md` (the pipeline root).
- `{SESSION_ROOT}` — `{root}/sessions/{session_folder}` where `{session_folder}` is:
  - `{issue_number}_{short_description}` when the request originates from a GitHub issue (e.g. `123_fix-login-timeout`).
  - `{short_description}` otherwise (e.g. `fix-login-timeout`).
  - Use lowercase, hyphens only, max 60 characters.

## Session setup

Before the first request:

1. Ask the user for one or more absolute codebase root paths.
2. Verify each root exists and is a git repository.
3. Derive `{session_folder}` from the request title and issue number (if any).
4. Create `{SESSION_ROOT}/` — this is the single container for all session outputs.
5. Persist session metadata to `{SESSION_ROOT}/session.json`.

## Request setup

At the start of each request:

1. Create:
   - `{SESSION_ROOT}/artifacts/`
   - `{SESSION_ROOT}/evidence/`
   - `{SESSION_ROOT}/logs/`
2. Normalize the request into `request-envelope.json`.
3. Copy user-supplied evidence into `evidence/`.
4. Capture tracking references and store them in the request envelope.

## Artifact filenames

Use these canonical filenames when applicable:

- `request-envelope.json`
- `intake-output.json`
- `pm-output.json`
- `architect-output.json`
- `security-output.json`
- `probe-output.json` ← ENGINEER phase 1 (diagnosis probe for bugs | tdd probe for features)
- `probe-results.json` ← EXECUTOR probe run results
- `probe-gate-output.json` ← Probe Gate decision
- `engineer-output.json` ← ENGINEER phase 2 (implementation)
- `review-output.json`
- `execution-results.json`
- `qa-output.json`
- `release-readiness.json`

Versioned variants are allowed if the canonical artifact type remains unchanged.

## Worktree rules

All code edits must happen in fresh worktrees created from the up-to-date default branch of each target repo root.

For each codebase root:

1. Verify the repo is on the default branch.
2. Verify the working tree is clean.
3. Pull with fast-forward only.
4. Create a fresh worktree at `{SESSION_ROOT}/worktree` on a request-specific branch.
5. Record a stable `repo_root_id`.
6. Never edit the base repo directly.
