// Shared helpers for claude-a-team hooks.
// Hook IDs follow the ECC pattern: pre:<event>:<purpose>.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

export const HOOK_IDS = {
  preEditGate: "pre:edit:probe-gate",
  sessionStart: "lifecycle:session-start:lease",
  sessionEnd: "lifecycle:session-end:lease",
  stopLearn: "stop:session:team-learning",
};

// Derive the project root from this file's location:
//   <project>/.claude/hooks/_lib.mjs  →  <project>
// This is more reliable than CLAUDE_PROJECT_DIR, which may be unset, point at
// the original repo when running inside a worktree, or point elsewhere on
// shells that do not export it to hook subprocesses.
const HOOK_LIB_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR_FROM_FILE = path.resolve(HOOK_LIB_DIR, "..", "..");

export function projectDir() {
  const fromEnv = process.env.CLAUDE_PROJECT_DIR;
  if (fromEnv && fs.existsSync(path.join(fromEnv, ".claude", "hooks", "_lib.mjs"))) {
    return fromEnv;
  }
  return PROJECT_DIR_FROM_FILE;
}

export function sessionsDir() {
  return path.join(projectDir(), "sessions");
}

export function leasesDir() {
  const d = path.join(projectDir(), ".claude", ".locks");
  fs.mkdirSync(d, { recursive: true });
  return d;
}

export function readJsonSafe(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

export function listActiveSessions() {
  const root = sessionsDir();
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root)
    .filter((name) => !name.startsWith("_") && !name.startsWith("."))
    .map((name) => path.join(root, name))
    .filter((p) => {
      try {
        return fs.statSync(p).isDirectory();
      } catch {
        return false;
      }
    });
}

export function findArtifactByType(sessionDir, type) {
  const dir = path.join(sessionDir, "artifacts");
  if (!fs.existsSync(dir)) return null;
  for (const entry of fs.readdirSync(dir)) {
    if (!entry.endsWith(".json")) continue;
    const obj = readJsonSafe(path.join(dir, entry));
    if (obj?.artifact_type === type) return { obj, file: path.join(dir, entry) };
  }
  return null;
}

export function probeGateStatus(sessionDir) {
  const probe = findArtifactByType(sessionDir, "probe_output");
  if (!probe) return "no_probe";
  const gate = findArtifactByType(sessionDir, "probe_gate_output");
  if (!gate) return "probe_without_gate";
  const decision = gate.obj.body?.gate_decision?.decision;
  if (decision === "pass" || decision === "not_applicable") return "passed";
  return `non_pass:${decision}`;
}

export function isUnderWorktree(filePath, sessionDir) {
  const wt = path.join(sessionDir, "worktree");
  try {
    const abs = path.resolve(filePath);
    const wtAbs = path.resolve(wt);
    const rel = path.relative(wtAbs, abs);
    return rel && !rel.startsWith("..") && !path.isAbsolute(rel);
  } catch {
    return false;
  }
}

export function readStdinJson() {
  return new Promise((resolve) => {
    let data = "";
    let settled = false;
    const finish = (v) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    try {
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (c) => (data += c));
      process.stdin.on("end", () => {
        try {
          finish(JSON.parse(data));
        } catch {
          finish(null);
        }
      });
      process.stdin.on("error", () => finish(null));
    } catch {
      finish(null);
    }
    // If nothing on stdin within 50ms, resolve null. Hooks always receive stdin
    // in production, but tests may not.
    setTimeout(() => finish(null), 50);
  });
}

// Read and discard stdin so the harness's writer does not see a broken pipe.
// Use in hooks that do not need the payload (e.g. Stop, where the JSON is
// informational and the hook only kicks off side effects).
export function drainStdin() {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    try {
      process.stdin.on("data", () => {});
      process.stdin.on("end", finish);
      process.stdin.on("error", finish);
      process.stdin.resume();
    } catch {
      finish();
    }
    setTimeout(finish, 50);
  });
}

export function leaseFile(sessionId) {
  const safe = sessionId.replace(/[^A-Za-z0-9_.-]/g, "_");
  return path.join(leasesDir(), `${safe}.lease`);
}

export function projectId() {
  // Stable per-checkout id for the lease pattern.
  return path.basename(projectDir());
}

export function hostnamePid() {
  return `${os.hostname()}:${process.pid}`;
}
