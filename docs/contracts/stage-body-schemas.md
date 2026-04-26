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

## TDDProbeOutputBody

Produced by ENGINEER (phase 1 — tdd-probe). Set `artifact_type = "tdd_probe_output"`.

```json
{
  "probe_summary": "string",
  "expected_failure_signatures": [
    {
      "test_scenario_id": "TS-1",
      "expected_exit_code": "number | null",
      "expected_stderr_pattern": "string | null",
      "expected_stdout_pattern": "string | null",
      "rationale": "string"
    }
  ],
  "probe_test_scenarios": [TestScenario],
  "probe_commands": [CommandSpec],
  "confidence_in_reproduction": "low | medium | high",
  "questions_for_user": ["string", "..."],
  "assumptions": ["string", "..."]
}
```

Rules:
- `expected_failure_signatures` must contain one entry per `probe_test_scenarios` item.
- At least one `probe_commands` entry must be linked to a test scenario.
- `confidence_in_reproduction` reflects how certain the engineer is that running these commands will surface the described problem. If `low`, emit `questions_for_user`.
- Do **not** include implementation code or `planned_changes` in this artifact.

## TDDGateOutputBody

Produced by the TDD Gate check. Set `artifact_type = "tdd_gate_output"`.

```json
{
  "gate_decision": "GateDecision",
  "probe_analysis": "string",
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
  ],
  "skip_reason": "string | null",
  "options_for_user": ["string", "..."]
}
```

Rules:
- `gate_decision.decision` must be one of `pass | fail | not_applicable` (use `not_applicable` when user explicitly skips TDD).
- `options_for_user` is required when `decision` is `fail` or `not_applicable` was not yet chosen.
- `skip_reason` is required when `decision = not_applicable`.

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
