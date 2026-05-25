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
  "body": {}
}
```

## Rules

- `artifact_type` identifies the body schema.
- `artifact_id` must be unique within the request.
- `parent_artifact_ids` lists the upstream artifacts this artifact relied on.
- `confidence` reflects the producer's confidence in its own output, not release safety.
- `body` must match the stage-specific schema.

## Global contract rules

1. Output a single JSON object and nothing else.
2. Preserve `request_id`, `schema_version`, and relevant `parent_artifact_ids`.
3. Do not change field shapes in one producer without updating downstream consumers.
4. Do not fabricate upstream artifacts, evidence, or execution results.
5. Use producer metadata so multi-model runtimes can compare artifacts safely.
