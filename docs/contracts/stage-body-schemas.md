# Stage Body Schemas

This file centralizes the body schemas used by all stage skills.

## RequestEnvelopeBody

```json
{
  "request_title": "string",
  "request_text": "string",
  "request_source": {
    "kind": "github_issue | github_pr | jira | ado_work_item | slack | email | cli_text | csv_bundle | spec | manual | other",
    "id": "string | null",
    "uri": "string | null"
  },
  "tracking_refs": ["string", "..."],
  "repo_roots": [
    {
      "repo_root_id": "string",
      "absolute_path": "string"
    }
  ],
  "evidence_items": [
    {
      "evidence_id": "string",
      "kind": "csv | log | screenshot | spec | repro_steps | test_result | doc | other",
      "original_name": "string",
      "stored_path": "string",
      "description": "string | null"
    }
  ],
  "user_constraints": ["string", "..."],
  "requested_outputs": ["string", "..."]
}
```

## EvidenceRef

```json
{
  "evidence_id": "string",
  "locator": "string | null",
  "note": "string"
}
```

## AcceptanceCriterion

```json
{
  "id": "AC-1",
  "statement": "string",
  "priority": "must | should | could",
  "verification_hint": "string | null"
}
```

## PlannedFileChange

```json
{
  "repo_root_id": "string",
  "path": "string",
  "action": "create | modify | delete",
  "content_mode": "full_file | unified_diff",
  "rationale": "string",
  "linked_acceptance_criteria": ["AC-1", "..."],
  "content": "string"
}
```

Rules:
- `path` must be repo-relative.
- `path` must not be absolute.
- `path` must not contain `..`.
- `repo_root_id` is required.
- `content` is either the final file content or a valid patch.

## TestScenario

```json
{
  "id": "TS-1",
  "statement": "string",
  "linked_acceptance_criteria": ["AC-1", "..."],
  "expected_result": "string"
}
```

## CommandSpec

```json
{
  "id": "CMD-1",
  "command": "string",
  "purpose": "string",
  "linked_test_scenarios": ["TS-1", "..."]
}
```

## ExecutedCommandResult

```json
{
  "id": "CMD-1",
  "command": "string",
  "attempted": true,
  "exit_code": 0,
  "duration_ms": 1234,
  "stdout_path": "string | null",
  "stderr_path": "string | null",
  "blocked_reason": "string | null"
}
```

## GateDecision

```json
{
  "required": true,
  "decision": "pass | fail | needs_changes | not_applicable",
  "summary": "string"
}
```

## IntakeOutputBody

```json
{
  "normalized_title": "string",
  "short_request_name": "string",
  "request_summary": "string",
  "work_signals": ["string", "..."],
  "suggested_gates": {
    "architect": true,
    "security": false,
    "review": true,
    "release_readiness": true
  },
  "blocking_questions": ["string", "..."],
  "notes": ["string", "..."]
}
```

## PMOutputBody

```json
{
  "work_type": "bug | improvement | feature | technical_debt | unclear",
  "problem_statement": "string",
  "summary": "string",
  "current_behavior": "string | null",
  "expected_behavior": "string",
  "user_impact": "string",
  "business_impact": "string | null",
  "scope_in": ["string", "..."],
  "scope_out": ["string", "..."],
  "constraints": ["string", "..."],
  "non_functional_requirements": ["string", "..."],
  "acceptance_criteria": [AcceptanceCriterion],
  "priority": "low | medium | high | critical",
  "questions_for_user": ["string", "..."],
  "assumptions": ["string", "..."],
  "unknowns": ["string", "..."],
  "risks": ["string", "..."],
  "evidence_refs": [EvidenceRef]
}
```

## ArchitectOutputBody

```json
{
  "gate_decision": "GateDecision",
  "technical_scope_summary": "string",
  "affected_components": ["string", "..."],
  "interfaces_changed": ["string", "..."],
  "design_constraints": ["string", "..."],
  "recommended_approach": ["string", "..."],
  "alternatives_considered": ["string", "..."],
  "tradeoffs": ["string", "..."],
  "migration_impact": ["string", "..."],
  "operational_impact": ["string", "..."],
  "questions_for_user": ["string", "..."],
  "risks": ["string", "..."],
  "evidence_refs": [EvidenceRef]
}
```

## SecurityOutputBody

```json
{
  "gate_decision": "GateDecision",
  "security_scope_summary": "string",
  "threat_surfaces": ["string", "..."],
  "trust_boundaries": ["string", "..."],
  "data_sensitivity": ["string", "..."],
  "required_controls": ["string", "..."],
  "required_security_tests": ["string", "..."],
  "dependency_risks": ["string", "..."],
  "questions_for_user": ["string", "..."],
  "risks": ["string", "..."],
  "evidence_refs": [EvidenceRef]
}
```

## ProbeOutputBody

Produced by ENGINEER (phase 1 — probe). Set `artifact_type = "probe_output"`. Save as `probe-output.json`.

`probe_mode` is derived from PM output `work_type`: `"diagnosis"` for `bug`; `"tdd"` for `feature`, `improvement`, or `technical_debt`.

```json
{
  "probe_mode": "diagnosis | tdd",
  "probe_summary": "string",
  "confidence_in_reproduction": "low | medium | high",
  "questions_for_user": ["string", "..."],
  "assumptions": ["string", "..."],

  "diagnosis": {
    "feedback_loop_type": "failing_test | curl_http | cli_snapshot | headless_browser | trace_replay | throwaway_harness | property_fuzz | bisection | differential | hitl_script",
    "feedback_loop_description": "string",
    "reproduction_confirmed": true,
    "reproduction_rate": "string | null",
    "ranked_hypotheses": [
      {
        "id": "H-1",
        "rank": 1,
        "statement": "string",
        "prediction": "string"
      }
    ],
    "probe_commands": [CommandSpec]
  },

  "tdd": {
    "probe_test_scenarios": [TestScenario],
    "probe_commands": [CommandSpec],
    "expected_failure_signatures": [
      {
        "test_scenario_id": "TS-1",
        "expected_exit_code": "number | null",
        "expected_stderr_pattern": "string | null",
        "expected_stdout_pattern": "string | null",
        "rationale": "string"
      }
    ]
  }
}
```

Rules:
- Populate only the block that matches `probe_mode`. Leave the other block `null`.
- **Diagnosis mode**: `reproduction_confirmed` must be `true` for the gate to pass. `ranked_hypotheses` must have at least 3 entries. Each `prediction` must be falsifiable ("If X is the cause, then changing Y will..."). If `confidence_in_reproduction` is `low`, emit `questions_for_user`. `reproduction_rate` is required for non-deterministic bugs.
- **TDD mode**: `expected_failure_signatures` must have one entry per `probe_test_scenarios` item. At least one `probe_commands` entry must link to a test scenario.
- Do **not** include implementation code or `planned_changes` in this artifact.

## ProbeGateOutputBody

Produced by the Probe Gate check. Set `artifact_type = "probe_gate_output"`. Save as `probe-gate-output.json`.

```json
{
  "probe_mode": "diagnosis | tdd",
  "gate_decision": "GateDecision",
  "probe_analysis": "string",

  "diagnosis_assessment": {
    "feedback_loop_confirmed": "boolean",
    "reproduction_confirmed": "boolean",
    "hypotheses_count": "number",
    "reproduction_assessment": "string"
  },

  "tdd_assessment": {
    "matched_signatures": [
      {
        "test_scenario_id": "TS-1",
        "expected_signature": "string",
        "actual_output_excerpt": "string",
        "matched": true
      }
    ],
    "unmatched_signatures": [
      {
        "test_scenario_id": "TS-1",
        "expected_signature": "string",
        "actual_output_excerpt": "string",
        "mismatch_reason": "string"
      }
    ]
  },

  "skip_reason": "string | null",
  "options_for_user": ["string", "..."]
}
```

Rules:
- Populate only the assessment block that matches `probe_mode`. Leave the other `null`.
- `gate_decision.decision` must be one of `pass | fail | blocked | not_applicable`.
- Use `not_applicable` only when the user explicitly instructs to skip the probe. `skip_reason` is required in that case.
- `options_for_user` is required when `decision` is `fail` or `blocked`.

## EngineerOutputBody

```json
{
  "technical_summary": "string",
  "files_to_investigate": [
    {
      "repo_root_id": "string",
      "path": "string"
    }
  ],
  "implementation_plan": ["string", "..."],
  "questions_for_user": ["string", "..."],
  "assumptions": ["string", "..."],
  "design_notes": ["string", "..."],
  "observability_changes": ["string", "..."],
  "docs_changes": ["string", "..."],
  "migration_steps": ["string", "..."],
  "rollback_plan": ["string", "..."],
  "planned_changes": [PlannedFileChange],
  "execution_handoff": {
    "code_change_summary": "string",
    "changed_files": [
      {
        "repo_root_id": "string",
        "path": "string"
      }
    ],
    "risk_areas": ["string", "..."],
    "test_scenarios": [TestScenario],
    "test_commands": [CommandSpec],
    "additional_manual_checks": ["string", "..."]
  }
}
```

## ReviewOutputBody

```json
{
  "gate_decision": "GateDecision",
  "review_scope_summary": "string",
  "strengths": ["string", "..."],
  "concerns": ["string", "..."],
  "missed_files_or_cases": ["string", "..."],
  "recommended_changes": ["string", "..."],
  "approval_status": "approved | approved_with_notes | changes_requested",
  "evidence_refs": [EvidenceRef]
}
```

## ExecutionResultsBody

```json
{
  "apply_status": "not_attempted | applied | failed | partially_applied",
  "applied_changes": [
    {
      "repo_root_id": "string",
      "path": "string",
      "action": "create | modify | delete",
      "status": "applied | failed | skipped",
      "message": "string"
    }
  ],
  "commands_attempted": [ExecutedCommandResult],
  "environment": {
    "os": "string | null",
    "shell": "string | null",
    "working_directories": ["string", "..."]
  },
  "notes": ["string", "..."]
}
```

## QAOutputBody

```json
{
  "status": "pass | fail | inconclusive",
  "tests_run": ["string", "..."],
  "verified_acceptance_criteria": ["AC-1", "..."],
  "failed_acceptance_criteria": ["AC-1", "..."],
  "untested_acceptance_criteria": ["AC-1", "..."],
  "findings": ["string", "..."],
  "regression_risks": ["string", "..."],
  "coverage_gaps": ["string", "..."],
  "recommendation": "ship | hold | reject",
  "evidence_refs": [EvidenceRef],
  "command_results": [ExecutedCommandResult]
}
```

## ReleaseReadinessBody

```json
{
  "status": "ready | ready_with_caveats | not_ready",
  "summary": "string",
  "blocking_issues": ["string", "..."],
  "known_risks": ["string", "..."],
  "required_follow_ups": ["string", "..."],
  "rollback_readiness": "ready | partial | not_ready",
  "observability_readiness": "ready | partial | not_ready",
  "documentation_readiness": "ready | partial | not_ready",
  "recommendation": "ship | hold | reject"
}
```

## StageQualityBody

A small sidecar artifact written alongside any creative stage output (intake, pm, architect, security, engineer, review, qa, release_readiness). Save as `<stage>-quality.json` (e.g. `pm-quality.json`). Set `artifact_type = "stage_quality"` in the envelope. The `parent_artifact_ids` array must contain exactly the artifact this report describes.

```json
{
  "stage": "intake | pm | architect | security | engineer | review | qa | release_readiness",
  "phase": "string | null",
  "described_artifact_id": "string",
  "evidence_completeness": "none | partial | complete",
  "blocking_questions_count": "number",
  "assumptions_count": "number",
  "context_budget_tokens": "number | null",
  "over_budget_reason": "string | null",
  "duration_ms": "number | null",
  "notes": ["string", "..."]
}
```

Rules:
- `described_artifact_id` must equal the `artifact_id` of the stage output this quality record describes. Read that artifact's envelope `context_cost_tokens` to compare against `context_budget_tokens`.
- `phase` is required for stages with phases (e.g. engineer: `"probe"` or `"impl"`).
- `over_budget_reason` is required when the described artifact's envelope `context_cost_tokens.total` exceeds `context_budget_tokens`. Otherwise it must be `null`.
- `evidence_completeness = "none"` is permitted only for stages that legitimately need no evidence (e.g. intake on a fresh CLI request) and must be justified in `notes`.
- This artifact must never replace a stage output. It is additive metadata, not a substitute for the body schemas above.

See `/docs/runtime/context-budget.md` for stage-level budget defaults and how the executor enforces them.

## TeamKnowledgeBody

Produced by the team-learning skill at session end. Set `artifact_type = "team_knowledge"`. Save as `team-knowledge.json` under `_team-knowledge/<YYYY-MM>/<short-name>.json`.

```json
{
  "scope": "repo | request_type | file_pattern",
  "scope_value": "string",
  "pattern_kind": "diagnosis_recurrence | tdd_signature | gate_failure | review_concern | qa_regression | other",
  "pattern_summary": "string",
  "supporting_request_ids": ["string", "..."],
  "first_seen_at_utc": "YYYY-MM-DDTHH:MM:SSZ",
  "last_seen_at_utc": "YYYY-MM-DDTHH:MM:SSZ",
  "occurrence_count": "number",
  "suggested_action": "string | null",
  "consumers": ["intake | pm | architect | security | engineer | review | qa | release_readiness", "..."]
}
```

Rules:
- `supporting_request_ids` must reference at least 2 distinct requests. Single-occurrence observations are not patterns.
- `consumers` lists the stages that should read this pattern when their inputs match `scope_value`. Empty `consumers` is invalid — every pattern must have at least one stage that benefits.
- Producers must not invent supporting evidence. If only one request supports a pattern, do not write the artifact.
