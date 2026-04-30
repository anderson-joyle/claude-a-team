#!/usr/bin/env node
// SessionEnd hook.
// Hook ID: lifecycle:session-end:lease
//
// Removes the session lease so the team-learning observer can detect when no
// sessions are active.

import fs from "node:fs";
import { leaseFile, projectId, readStdinJson } from "./_lib.mjs";

async function main() {
  const input = await readStdinJson();
  const sessionId = input?.session_id || `${Date.now()}`;
  try {
    const f = leaseFile(`${projectId()}-${sessionId}`);
    fs.rmSync(f, { force: true });
  } catch {
    // best-effort
  }
  process.exit(0);
}

main().catch(() => process.exit(0));
