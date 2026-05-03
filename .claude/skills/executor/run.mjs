#!/usr/bin/env node
// Executor runner — applies a typed JSON contract and reports what happened.
// See .claude/skills/executor/SKILL.md for the contract.

import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

function die(msg, code = 1) {
  process.stderr.write(`executor: ${msg}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const args = { mode: null, session: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--mode") args.mode = argv[++i];
    else if (a === "--session") args.session = argv[++i];
    else die(`unknown argument: ${a}`);
  }
  if (!args.mode) die("--mode required (probe | impl)");
  if (!["probe", "impl"].includes(args.mode)) die(`invalid mode: ${args.mode}`);
  if (!args.session) die("--session required (path to session folder)");
  return args;
}

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    die(`cannot read JSON ${p}: ${e.message}`);
  }
}

function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n");
}

function nowUtc() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function envelope({ artifact_type, request_id, parent_ids, body }) {
  return {
    schema_version: "2.0",
    artifact_type,
    artifact_id: `${artifact_type}-${randomUUID()}`,
    request_id,
    producer: {
      role: "executor",
      model_provider: "deterministic",
      model_name: "executor-runner",
      runtime_name: `node-${process.version}`,
    },
    created_at_utc: nowUtc(),
    parent_artifact_ids: parent_ids,
    confidence: "high",
    context_cost_tokens: {
      input: null,
      cached_input: null,
      output: null,
      total: null,
    },
    body,
  };
}

function loadSession(sessionDir) {
  const sessionJsonPath = path.join(sessionDir, "session.json");
  if (!fs.existsSync(sessionJsonPath)) {
    die(`session.json not found at ${sessionJsonPath}`);
  }
  const session = readJson(sessionJsonPath);
  const reposByRootId = {};
  for (const entry of session.repo_roots ?? []) {
    if (!entry.repo_root_id || !entry.worktree_path) {
      die(`session.json repo_roots entries must have repo_root_id and worktree_path`);
    }
    reposByRootId[entry.repo_root_id] = entry;
  }
  return { session, reposByRootId };
}

function resolveWorktree(reposByRootId, repoRootId) {
  if (!repoRootId) {
    const first = Object.values(reposByRootId)[0];
    if (!first) die("no repo roots configured in session.json");
    return first.worktree_path;
  }
  const entry = reposByRootId[repoRootId];
  if (!entry) die(`repo_root_id ${repoRootId} not in session.json`);
  return entry.worktree_path;
}

function safeRelativePath(rel) {
  if (path.isAbsolute(rel)) return null;
  if (rel.split(/[\\/]/).includes("..")) return null;
  return rel;
}

function applyPlannedChange(change, worktree) {
  const safe = safeRelativePath(change.path);
  if (!safe) {
    return { status: "failed", message: `path rejected: ${change.path}` };
  }
  const target = path.join(worktree, safe);

  if (change.action === "delete") {
    try {
      fs.rmSync(target, { force: true });
      return { status: "applied", message: "deleted" };
    } catch (e) {
      return { status: "failed", message: `delete failed: ${e.message}` };
    }
  }

  if (change.content_mode === "full_file") {
    try {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, change.content);
      return { status: "applied", message: `${change.action} (full_file)` };
    } catch (e) {
      return { status: "failed", message: `write failed: ${e.message}` };
    }
  }

  if (change.content_mode === "unified_diff") {
    try {
      const result = spawnSync("git", ["apply", "--whitespace=nowarn", "-"], {
        cwd: worktree,
        input: change.content,
        encoding: "utf8",
      });
      if (result.status !== 0) {
        return { status: "failed", message: `git apply failed: ${result.stderr.trim()}` };
      }
      return { status: "applied", message: `${change.action} (unified_diff)` };
    } catch (e) {
      return { status: "failed", message: `git apply error: ${e.message}` };
    }
  }

  return { status: "failed", message: `unsupported content_mode: ${change.content_mode}` };
}

function runCommand(cmd, worktree, logsDir, artifactId) {
  fs.mkdirSync(path.join(logsDir, artifactId), { recursive: true });
  const stdoutPath = path.join(logsDir, artifactId, `${cmd.id}.stdout`);
  const stderrPath = path.join(logsDir, artifactId, `${cmd.id}.stderr`);
  const start = Date.now();
  let result;
  try {
    result = spawnSync(cmd.command, {
      cwd: worktree,
      shell: true,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (e) {
    return {
      id: cmd.id,
      command: cmd.command,
      attempted: true,
      exit_code: -1,
      duration_ms: Date.now() - start,
      stdout_path: null,
      stderr_path: null,
      blocked_reason: `spawn error: ${e.message}`,
    };
  }
  fs.writeFileSync(stdoutPath, result.stdout ?? "");
  fs.writeFileSync(stderrPath, result.stderr ?? "");
  return {
    id: cmd.id,
    command: cmd.command,
    attempted: true,
    exit_code: result.status ?? -1,
    duration_ms: Date.now() - start,
    stdout_path: path.relative(path.dirname(logsDir), stdoutPath).replace(/\\/g, "/"),
    stderr_path: path.relative(path.dirname(logsDir), stderrPath).replace(/\\/g, "/"),
    blocked_reason: null,
  };
}

function detectEnvironment(worktrees) {
  let shell = process.env.SHELL ?? process.env.ComSpec ?? null;
  return {
    os: process.platform,
    shell,
    working_directories: worktrees,
  };
}

function findArtifactByType(artifactsDir, type) {
  if (!fs.existsSync(artifactsDir)) return null;
  for (const entry of fs.readdirSync(artifactsDir)) {
    if (!entry.endsWith(".json")) continue;
    const obj = readJson(path.join(artifactsDir, entry));
    if (obj?.artifact_type === type) return obj;
  }
  return null;
}

function probeMode({ sessionDir, session, reposByRootId }) {
  const artifactsDir = path.join(sessionDir, "artifacts");
  const logsDir = path.join(sessionDir, "logs");

  const probe = findArtifactByType(artifactsDir, "probe_output");
  if (!probe) die("probe_output artifact not found");

  const commands = probe.body.diagnosis?.probe_commands ?? probe.body.tdd?.probe_commands ?? [];
  if (commands.length === 0) {
    die("probe_output has no probe_commands");
  }

  const commandsAttempted = commands.map((c) => {
    const wt = resolveWorktree(reposByRootId, c.repo_root_id);
    return runCommand(c, wt, logsDir, probe.artifact_id);
  });

  const body = {
    apply_status: "not_attempted",
    applied_changes: [],
    commands_attempted: commandsAttempted,
    environment: detectEnvironment(Object.values(reposByRootId).map((r) => r.worktree_path)),
    notes: ["probe mode: file changes not applied; only probe_commands executed"],
  };

  const out = envelope({
    artifact_type: "execution_results",
    request_id: probe.request_id,
    parent_ids: [probe.artifact_id],
    body,
  });
  writeJson(path.join(artifactsDir, "probe-results.json"), out);
  process.stdout.write(`probe-results.json written (${commandsAttempted.length} commands)\n`);
}

function implMode({ sessionDir, session, reposByRootId }) {
  const artifactsDir = path.join(sessionDir, "artifacts");
  const logsDir = path.join(sessionDir, "logs");

  const gate = findArtifactByType(artifactsDir, "probe_gate_output");
  if (!gate) {
    return refuse(sessionDir, [], "probe_gate_output artifact missing", null);
  }
  const decision = gate.body?.gate_decision?.decision;
  if (!["pass", "not_applicable"].includes(decision)) {
    return refuse(sessionDir, [gate.artifact_id], `probe gate decision is "${decision}"; impl mode requires pass or not_applicable`, gate.request_id);
  }

  const eng = findArtifactByType(artifactsDir, "engineer_output");
  if (!eng) {
    return refuse(sessionDir, [gate.artifact_id], "engineer_output artifact missing", gate.request_id);
  }

  const planned = eng.body.planned_changes ?? [];
  const appliedChanges = [];
  let anyApplied = false;
  let anyFailed = false;

  for (const change of planned) {
    const wt = resolveWorktree(reposByRootId, change.repo_root_id);
    const r = applyPlannedChange(change, wt);
    appliedChanges.push({
      repo_root_id: change.repo_root_id,
      path: change.path,
      action: change.action,
      status: r.status,
      message: r.message,
    });
    if (r.status === "applied") anyApplied = true;
    if (r.status === "failed") anyFailed = true;
  }

  let applyStatus;
  if (planned.length === 0) applyStatus = "not_attempted";
  else if (anyApplied && !anyFailed) applyStatus = "applied";
  else if (anyApplied && anyFailed) applyStatus = "partially_applied";
  else applyStatus = "failed";

  let commandsAttempted = [];
  if (applyStatus === "applied") {
    const cmds = eng.body.execution_handoff?.test_commands ?? [];
    commandsAttempted = cmds.map((c) => {
      const wt = resolveWorktree(reposByRootId, c.repo_root_id);
      return runCommand(c, wt, logsDir, eng.artifact_id);
    });
  }

  const notes = [];
  if (applyStatus === "partially_applied" || applyStatus === "failed") {
    notes.push("test_commands skipped because planned_changes did not apply cleanly");
  }

  const body = {
    apply_status: applyStatus,
    applied_changes: appliedChanges,
    commands_attempted: commandsAttempted,
    environment: detectEnvironment(Object.values(reposByRootId).map((r) => r.worktree_path)),
    notes,
  };

  const out = envelope({
    artifact_type: "execution_results",
    request_id: eng.request_id,
    parent_ids: [eng.artifact_id, gate.artifact_id],
    body,
  });
  writeJson(path.join(artifactsDir, "execution-results.json"), out);
  process.stdout.write(
    `execution-results.json written (status=${applyStatus}, ${commandsAttempted.length} commands)\n`,
  );
}

function refuse(sessionDir, parentIds, reason, requestId) {
  const out = envelope({
    artifact_type: "execution_results",
    request_id: requestId ?? "unknown",
    parent_ids: parentIds,
    body: {
      apply_status: "not_attempted",
      applied_changes: [],
      commands_attempted: [],
      environment: { os: process.platform, shell: null, working_directories: [] },
      notes: [`executor refused: ${reason}`],
    },
  });
  writeJson(path.join(sessionDir, "artifacts", "execution-results.json"), out);
  process.stderr.write(`executor refused: ${reason}\n`);
  process.exit(2);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const sessionDir = path.resolve(args.session);
  if (!fs.existsSync(sessionDir)) die(`session dir not found: ${sessionDir}`);
  const { session, reposByRootId } = loadSession(sessionDir);

  if (args.mode === "probe") {
    probeMode({ sessionDir, session, reposByRootId });
  } else {
    implMode({ sessionDir, session, reposByRootId });
  }
}

main();
