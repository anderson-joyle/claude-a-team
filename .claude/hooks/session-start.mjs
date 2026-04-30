#!/usr/bin/env node
// SessionStart hook.
// Hook ID: lifecycle:session-start:lease
//
// Writes a lease file so concurrent claude-a-team sessions in the same project
// can be detected by the team-learning observer. Pattern borrowed from ECC's
// continuous-learning-v2 observer.

import fs from "node:fs";
import { hostnamePid, leaseFile, projectId, readStdinJson } from "./_lib.mjs";

async function main() {
  const input = await readStdinJson();
  const sessionId = input?.session_id || `${Date.now()}`;
  try {
    const f = leaseFile(`${projectId()}-${sessionId}`);
    fs.writeFileSync(
      f,
      JSON.stringify(
        {
          session_id: sessionId,
          host_pid: hostnamePid(),
          started_at: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
  } catch {
    // best-effort; lease management never fails the hook
  }
  process.exit(0);
}

main().catch(() => process.exit(0));
