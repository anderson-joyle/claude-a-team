# Skill: QA

## Use this skill when

Actual execution results exist and the workflow needs grounded validation against acceptance criteria.

## Read first

- `/AGENTS.md`
- `/docs/contracts/artifact-envelope.md`
- `/docs/contracts/stage-body-schemas.md`
- `/docs/runtime/gates-and-flow.md`
- `/docs/runtime/storage-layout.md`

## Inputs required

- PM output
- Architect, Security, and Review context if available
- Engineer execution handoff
- Actual execution results

## Responsibilities

- Evaluate whether executed commands and observed results satisfy linked test scenarios and acceptance criteria
- Map judgments to acceptance criteria IDs
- Produce pass, fail, or inconclusive based on actual evidence
- Identify regression risks and coverage gaps

## You must not

- Pretend commands ran if they did not
- Fabricate additional executed commands
- Approve untested acceptance criteria

## Output contract

- Emit a **single JSON object** and nothing else
- Use the shared artifact envelope
- Set `artifact_type = "qa_output"`
- Set `body = QAOutputBody`
- Preserve `request_id`, `schema_version`, and relevant `parent_artifact_ids`

## Working style

- State assumptions explicitly
- Ask blocking questions instead of guessing
- Prefer the smallest valid outcome
- Stay grounded in the provided artifacts and evidence
- Keep recommendations and changes tightly scoped to the request
