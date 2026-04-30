#!/usr/bin/env node
// Stop hook.
// Hook ID: stop:session:team-learning
//
// Fires the team-learning scan asynchronously when Claude finishes responding.
// Non-blocking: the user does not wait for pattern extraction. Borrowed from
// ECC's continuous-learning-v2 design (Stop is preferred over UserPromptSubmit
// because it runs once per session and does not add latency to each turn).
//
// The scan walks completed sessions/, looks for repeated diagnosis hypotheses,
// repeated TDD failure signatures, repeated review concerns, and repeated QA
// regressions. It emits team_knowledge artifacts under _team-knowledge/.
//
// This hook is defensive on purpose:
//   - drains stdin so the harness's JSON write does not see a broken pipe
//   - resolves the project dir from this file's location (not from
//     CLAUDE_PROJECT_DIR, which may be unset or point at the wrong repo
//     when running inside a worktree)
//   - swallows spawn errors; the scan is best-effort, never fatal

import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { drainStdin, leasesDir, projectDir } from "./_lib.mjs";

function shouldRun() {
  // Only run when no other claude-a-team sessions hold a lease for this project.
  // Pattern: each session creates a lease in SessionStart and removes it in
  // SessionEnd. Stop fires before SessionEnd, so the current session's lease
  // is still present — count > 1 means another session is active.
  try {
    const files = fs.readdirSync(leasesDir()).filter((f) => f.endsWith(".lease"));
    return files.length <= 1;
  } catch {
    return true;
  }
}

async function main() {
  await drainStdin();

  if (!shouldRun()) {
    process.exit(0);
  }

  const root = projectDir();
  const scanner = path.join(root, ".claude", "skills", "team-learning", "scan.mjs");
  if (!fs.existsSync(scanner)) {
    process.exit(0);
  }

  // Detached, non-blocking. We do not wait for the scan to finish.
  try {
    const child = spawn(process.execPath, [scanner, "--project", root], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.on("error", () => {
      // best-effort; the scan is optional
    });
    child.unref();
  } catch {
    // best-effort
  }

  process.exit(0);
}

main().catch(() => process.exit(0));
