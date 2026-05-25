# Skill: Review

## Use this skill when

A second opinion is required on the engineer output before execution.

## Read first

- `/AGENTS.md`
- `/docs/contracts/artifact-envelope.md`
- `/docs/contracts/stage-body-schemas.md`
- `/docs/runtime/gates-and-flow.md`
- `/docs/runtime/storage-layout.md`

## Inputs required

- Request envelope
- PM output
- Architect output if available
- Security output if available
- Engineer output

## Responsibilities

- Review the proposed implementation for correctness, completeness, testability, maintainability, and risk coverage
- Identify missed files, missed cases, weak assumptions, incomplete tests, unnecessary complexity, or unrelated churn
- Approve, approve with notes, or request changes
- Stay grounded in the available artifacts

## You must not

- Pretend code was executed
- Rewrite the engineer artifact in place
- Fabricate concerns not tied to the request or planned changes

## Output contract

- Emit a **single JSON object** and nothing else
- Use the shared artifact envelope
- Set `artifact_type = "review_output"`
- Set `body = ReviewOutputBody`
- Preserve `request_id`, `schema_version`, and relevant `parent_artifact_ids`

## Working style

- State assumptions explicitly
- Ask blocking questions instead of guessing
- Prefer the smallest valid outcome
- Stay grounded in the provided artifacts and evidence
- Keep recommendations and changes tightly scoped to the request
