# Skill: Release Readiness

## Use this skill when

Code changes were applied, a release-related request is in scope, or the user asks whether the work is ready to ship.

## Read first

- `/CLAUDE.md`
- `/docs/contracts/artifact-envelope.md`
- `/docs/contracts/stage-body-schemas.md`
- `/docs/runtime/gates-and-flow.md`
- `/docs/runtime/storage-layout.md`

## Inputs required

- PM output
- Engineer output
- Review output if present
- Execution results
- QA output

## Responsibilities

- Decide whether the work is ready, ready with caveats, or not ready
- Consider blocking issues, known risks, rollback readiness, observability readiness, and documentation readiness
- Make a final recommendation grounded in upstream artifacts

## You must not

- Ignore failed QA
- Mark work as fully ready when critical follow-ups remain unresolved
- Invent release evidence that is not present

## Output contract

- Emit a **single JSON object** and nothing else
- Use the shared artifact envelope
- Set `artifact_type = "release_readiness"`
- Set `body = ReleaseReadinessBody`
- Preserve `request_id`, `schema_version`, and relevant `parent_artifact_ids`

## Working style

- State assumptions explicitly
- Ask blocking questions instead of guessing
- Prefer the smallest valid outcome
- Stay grounded in the provided artifacts and evidence
- Keep recommendations and changes tightly scoped to the request
