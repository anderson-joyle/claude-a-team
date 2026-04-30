#!/usr/bin/env node
// PreToolUse hook for Edit/Write/MultiEdit.
// Hook ID: pre:edit:probe-gate
//
// Enforces: if an active session has a probe_output but the probe gate has not
// passed, block edits to files inside that session's worktree/. This is what
// gives the Probe Gate teeth — Claude cannot "fix" the bug ahead of the gate.
//
// Edits to artifacts/, evidence/, .claude/, docs/, and other top-level files
// are always allowed. The hook only protects the worktree.
//
// Exit codes:
//   0 — allow
//   2 — block (stderr surfaced to Claude)

import { listActiveSessions, isUnderWorktree, probeGateStatus, readStdinJson } from "./_lib.mjs";

function targetPaths(input) {
  if (!input || !input.tool_input) return [];
  const ti = input.tool_input;
  if (typeof ti.file_path === "string") return [ti.file_path];
  if (Array.isArray(ti.edits)) {
    return ti.edits.map((e) => e?.file_path).filter((p) => typeof p === "string");
  }
  return [];
}

async function main() {
  const input = await readStdinJson();
  const paths = targetPaths(input);
  if (paths.length === 0) process.exit(0);

  const sessions = listActiveSessions();
  if (sessions.length === 0) process.exit(0);

  const blockers = [];
  for (const p of paths) {
    for (const session of sessions) {
      if (!isUnderWorktree(p, session)) continue;
      const status = probeGateStatus(session);
      if (status === "passed") continue;
      blockers.push({ file: p, session, status });
    }
  }

  if (blockers.length === 0) process.exit(0);

  const lines = [
    "claude-a-team: Probe Gate has not passed for the active session.",
    "",
    "The pipeline rule: no edits to a session worktree until probe-gate-output.json",
    "has decision = pass or not_applicable.",
    "",
    "Blocked edits:",
    ...blockers.map((b) => `  - ${b.file}  (session: ${b.session}, gate: ${b.status})`),
    "",
    "What to do:",
    "  1. Run the Engineer probe phase if probe-output.json is missing.",
    "  2. Run the Executor in probe mode to produce probe-results.json.",
    "  3. Run the Probe Gate. Surface its analysis to the user if it does not pass.",
    "  4. Only proceed to file edits via the Executor in implementation mode.",
  ];

  process.stderr.write(lines.join("\n") + "\n");
  process.exit(2);
}

main().catch((e) => {
  process.stderr.write(`pre-edit-gate hook error: ${e.message}\n`);
  process.exit(0); // fail-open: never block on hook bugs
});
