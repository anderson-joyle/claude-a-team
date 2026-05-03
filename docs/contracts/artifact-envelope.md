# Artifact Envelope

Every stage output must match this envelope exactly.

```json
{
  "schema_version": "2.0",
  "artifact_type": "string",
  "artifact_id": "string",
  "request_id": "string",
  "producer": {
    "role": "intake | pm | architect | security | engineer | review | executor | qa | release_readiness",
    "model_provider": "string",
    "model_name": "string",
    "runtime_name": "string | null"
  },
  "created_at_utc": "YYYY-MM-DDTHH:MM:SSZ",
  "parent_artifact_ids": ["string", "..."],
  "confidence": "low | medium | high",
  "context_cost_tokens": {
    "input": "number | null",
    "cached_input": "number | null",
    "output": "number | null",
    "total": "number | null"
  },
  "body": {}
}
```

## Rules

- `artifact_type` identifies the body schema.
- `artifact_id` must be unique within the request.
- `parent_artifact_ids` lists the upstream artifacts this artifact relied on.
- `confidence` reflects the producer's confidence in its own output, not release safety.
- `context_cost_tokens` reports the tokens the producer consumed to produce this artifact. The runtime that wraps the model call populates these from the provider's response. Use `null` for any field the runtime did not capture, and use `null` for `total` when the producer is deterministic (e.g. the executor) or otherwise does not consume model tokens. Stage-level budget and over-budget justification live on the `<stage>-quality.json` sidecar (see `StageQualityBody`), which compares this cost against the budget.
- `body` must match the stage-specific schema.

## Global contract rules

1. Output a single JSON object and nothing else.
2. Preserve `request_id`, `schema_version`, and relevant `parent_artifact_ids`.
3. Do not change field shapes in one producer without updating downstream consumers.
4. Do not fabricate upstream artifacts, evidence, or execution results.
5. Use producer metadata so multi-model runtimes can compare artifacts safely.
