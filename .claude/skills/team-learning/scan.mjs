#!/usr/bin/env node
// Reference team-learning scanner — stub implementation.
// Walks completed sessions, extracts features, emits team_knowledge patterns
// for any bucket with >= 2 supporting requests.
//
// This is intentionally minimal. Real pattern extraction is the open work; the
// contract (TeamKnowledgeBody, _team-knowledge/<YYYY-MM>/<name>.json layout)
// is the part that should not change without a same-PR update to consumers.

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

function parseArgs(argv) {
  const args = { project: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--project") args.project = argv[++i];
  }
  if (!args.project) {
    process.stderr.write("scan.mjs: --project required\n");
    process.exit(1);
  }
  return args;
}

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function listSessions(projectDir) {
  const root = path.join(projectDir, "sessions");
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

function loadArtifacts(sessionDir) {
  const dir = path.join(sessionDir, "artifacts");
  if (!fs.existsSync(dir)) return {};
  const out = {};
  for (const entry of fs.readdirSync(dir)) {
    if (!entry.endsWith(".json")) continue;
    const obj = readJson(path.join(dir, entry));
    if (!obj) continue;
    out[obj.artifact_type] = obj;
  }
  return out;
}

function classifyFile(filePath) {
  // Bucket files into scope_value patterns. Conservative: only emit a pattern
  // if the filename matches a known cluster.
  const base = path.basename(filePath || "").toLowerCase();
  if (/^auth\b|\bauth\.[a-z]+$/.test(base)) return "auth.*";
  if (/^session\b|\bsession\.[a-z]+$/.test(base)) return "session.*";
  if (/migration|migrate/.test(base)) return "migrations/*";
  return null;
}

function extractFeatures(artifacts) {
  const features = [];
  const pm = artifacts.pm_output;
  const probe = artifacts.probe_output;
  const eng = artifacts.engineer_output;
  const review = artifacts.review_output;
  const qa = artifacts.qa_output;

  const requestType = pm?.body?.work_type ?? null;
  const filesInvestigated = (eng?.body?.files_to_investigate ?? []).map((f) => f.path);

  if (probe?.body?.probe_mode === "diagnosis") {
    const hypotheses = probe.body.diagnosis?.ranked_hypotheses ?? [];
    for (const h of hypotheses) {
      for (const f of filesInvestigated) {
        const cluster = classifyFile(f);
        if (!cluster) continue;
        features.push({
          kind: "diagnosis_recurrence",
          scope: "file_pattern",
          scope_value: cluster,
          summary_seed: h.statement?.slice(0, 80) ?? "",
          consumers: ["intake", "pm", "engineer"],
        });
      }
    }
  }

  if (probe?.body?.probe_mode === "tdd") {
    const sigs = probe.body.tdd?.expected_failure_signatures ?? [];
    if (sigs.length > 0 && requestType) {
      features.push({
        kind: "tdd_signature",
        scope: "request_type",
        scope_value: requestType,
        summary_seed: `tdd probe wrote ${sigs.length} failure signatures`,
        consumers: ["engineer"],
      });
    }
  }

  if (review?.body?.concerns?.length) {
    for (const c of review.body.concerns) {
      features.push({
        kind: "review_concern",
        scope: "request_type",
        scope_value: requestType ?? "unknown",
        summary_seed: typeof c === "string" ? c.slice(0, 100) : String(c).slice(0, 100),
        consumers: ["engineer", "review"],
      });
    }
  }

  if (qa?.body?.failed_acceptance_criteria?.length) {
    features.push({
      kind: "qa_regression",
      scope: "request_type",
      scope_value: requestType ?? "unknown",
      summary_seed: `qa failed ${qa.body.failed_acceptance_criteria.length} criteria`,
      consumers: ["pm", "engineer", "qa"],
    });
  }

  return features;
}

function bucketKey(f) {
  return `${f.kind}::${f.scope}::${f.scope_value}::${f.summary_seed}`;
}

function buildPatterns(allFeatures) {
  // Group by bucket key. Emit only when count >= 2 distinct request_ids.
  const buckets = new Map();
  for (const { feature, request_id, when } of allFeatures) {
    const key = bucketKey(feature);
    let b = buckets.get(key);
    if (!b) {
      b = {
        feature,
        requests: new Set(),
        first: when,
        last: when,
        consumers: new Set(feature.consumers),
      };
      buckets.set(key, b);
    }
    b.requests.add(request_id);
    if (when < b.first) b.first = when;
    if (when > b.last) b.last = when;
  }

  const patterns = [];
  for (const b of buckets.values()) {
    if (b.requests.size < 2) continue;
    patterns.push({
      kind: b.feature.kind,
      scope: b.feature.scope,
      scope_value: b.feature.scope_value,
      summary_seed: b.feature.summary_seed,
      first: b.first,
      last: b.last,
      requests: [...b.requests],
      consumers: [...b.consumers],
    });
  }
  return patterns;
}

function nowUtc() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function writePattern(projectDir, p) {
  const month = p.last.slice(0, 7); // YYYY-MM
  const dir = path.join(projectDir, "_team-knowledge", month);
  fs.mkdirSync(dir, { recursive: true });
  const slug =
    `${p.kind}-${p.scope_value}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") ||
    "pattern";
  const file = path.join(dir, `${slug}.json`);

  // Read existing pattern to preserve first_seen and merge requests.
  const existing = (() => {
    try {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      return null;
    }
  })();

  const supporting = [...new Set([...(existing?.body?.supporting_request_ids ?? []), ...p.requests])];
  const firstSeen = existing?.body?.first_seen_at_utc ?? p.first;

  const body = {
    scope: p.scope,
    scope_value: p.scope_value,
    pattern_kind: p.kind,
    pattern_summary: p.summary_seed || `${p.kind} pattern in ${p.scope_value}`,
    supporting_request_ids: supporting,
    first_seen_at_utc: firstSeen,
    last_seen_at_utc: p.last,
    occurrence_count: supporting.length,
    suggested_action: null,
    consumers: p.consumers,
  };

  const envelope = {
    schema_version: "2.0",
    artifact_type: "team_knowledge",
    artifact_id: existing?.artifact_id ?? `team_knowledge-${randomUUID()}`,
    request_id: "team-learning",
    producer: {
      role: "executor",
      model_provider: "deterministic",
      model_name: "team-learning-scanner",
      runtime_name: `node-${process.version}`,
    },
    created_at_utc: existing?.created_at_utc ?? nowUtc(),
    parent_artifact_ids: supporting,
    confidence: "low",
    body,
  };

  fs.writeFileSync(file, JSON.stringify(envelope, null, 2) + "\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectDir = path.resolve(args.project);
  const sessions = listSessions(projectDir);
  if (sessions.length < 2) return; // nothing to learn from

  const allFeatures = [];
  for (const s of sessions) {
    const artifacts = loadArtifacts(s);
    const requestId = artifacts.pm_output?.request_id ?? path.basename(s);
    const when = artifacts.qa_output?.created_at_utc ?? artifacts.pm_output?.created_at_utc ?? nowUtc();
    for (const f of extractFeatures(artifacts)) {
      allFeatures.push({ feature: f, request_id: requestId, when });
    }
  }

  const patterns = buildPatterns(allFeatures);
  for (const p of patterns) writePattern(projectDir, p);
}

main();
