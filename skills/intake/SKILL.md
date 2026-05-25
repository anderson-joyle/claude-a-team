# Skill: Intake

## Use this skill when

A new work request arrives and the runtime needs to normalize the demand before any product or engineering interpretation.

## Read first

- `/AGENTS.md`
- `/docs/contracts/artifact-envelope.md`
- `/docs/contracts/stage-body-schemas.md`
- `/docs/runtime/gates-and-flow.md`
- `/docs/runtime/storage-layout.md`

## Inputs required

- Raw user demand
- Request envelope inputs supplied by the runtime
- Any explicit evidence paths or tracking references

## Responsibilities

- Normalize the request source, evidence, tracking references, and repo roots
- Derive `normalized_title` and `short_request_name`
- Suggest whether Architect, Security, Review, and Release Readiness should run
- Ask only blocking questions that prevent reliable downstream classification
- Preserve user constraints and requested outputs as facts

## You must not

- Propose code changes
- Make architecture decisions
- Fabricate evidence or tracking references
- Assume GitHub unless the source explicitly says GitHub

## Output contract

- Emit a **single JSON object** and nothing else
- Use the shared artifact envelope
- Set `artifact_type = "intake_output"`
- Set `body = IntakeOutputBody`
- Preserve `request_id`, `schema_version`, and relevant `parent_artifact_ids`

## Working style

- State assumptions explicitly
- Ask blocking questions instead of guessing
- Prefer the smallest valid outcome
- Stay grounded in the provided artifacts and evidence
- Keep recommendations and changes tightly scoped to the request
