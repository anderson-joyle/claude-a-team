# Context Budget

Each stage operates under a token budget. The budget is not a hard limit — it is a contract between the team and the stage. Exceeding it requires an explicit justification recorded in `<stage>-quality.json`.

## Why per-stage budgets exist

A claude-a-team request spans many stages. Without a budget, an early stage can spend its entire window quoting evidence verbatim, leaving downstream stages with no headroom for their own work. Per-stage budgets keep each teammate disciplined so the *team* can finish the request.

## Default budgets

These defaults assume a 200k-token model and a request of moderate scope (one repo root, fewer than 20 evidence items, fewer than 10 acceptance criteria). Adjust upward only when the request envelope justifies it.

| Stage | Phase | Budget (input + output) | Notes |
|---|---|---|---|
| intake | — | 8k | Normalizes the request. Should not pull repo content. |
| pm | — | 16k | Reads intake + evidence. Avoid quoting full evidence files. |
| architect | — | 24k | May read selected source files. Cite file paths, not contents. |
| security | — | 20k | Same evidence access as architect. Quote only relevant lines. |
| engineer | probe | 32k | May read files needed to build the feedback loop or write probe tests. |
| executor | probe | 4k | Runtime stage. Token usage comes from result framing, not reasoning. |
| executor | impl | 4k | Same. |
| engineer | impl | 48k | Largest budget — produces planned changes. |
| review | — | 32k | Reads engineer output + a sampling of changed files. |
| qa | — | 24k | Reads acceptance criteria + execution results. |
| release_readiness | — | 16k | Reads QA + prior gate decisions. |

## Recording context cost

Token cost lives on the **artifact envelope itself** (`context_cost_tokens.{input, cached_input, output, total}`), so every artifact carries its own consumption. The stage-quality sidecar (`<stage>-quality.json`) records the budget and any over-budget justification:

- envelope `context_cost_tokens` — what the producer actually used to produce the artifact
- sidecar `context_budget_tokens` — the budget assumed for the stage
- sidecar `over_budget_reason` — required when the envelope `context_cost_tokens.total` of the described artifact exceeds `context_budget_tokens`, otherwise null

Tools that wrap the stage call (orchestrator, runtime) populate the envelope cost numbers from the model provider's response. Stages writing artifacts by hand may leave envelope `context_cost_tokens` fields null but must still emit the quality sidecar. Deterministic producers (e.g. the executor) leave the envelope cost fields null.

## Reading patterns

To stay within budget, follow these patterns at every stage:

1. **Reference, don't quote.** Use `evidence_refs[*].locator` (a line range, a JSON pointer, a file:line) instead of pasting the evidence body.
2. **Read once, summarize, drop.** Read a file, capture the relevant facts in your reasoning, and do not re-read it later in the same artifact.
3. **Defer to downstream.** If a fact will be needed by Engineer but not by PM, do not pull it in PM. Note its location and let Engineer fetch it.
4. **Prefer prompt cache.** Read the contracts and prior artifacts in the same order each stage so the prompt prefix caches across stages of the same request.

## When budgets must grow

A stage may legitimately exceed its default budget when:

- The request envelope contains more than 20 evidence items
- The acceptance criteria list more than 10 must-have items
- Architect or Security must reason across more than one repo root
- The user has explicitly asked for a deeper analysis

In every case, write the justification into `over_budget_reason` and proceed. Do not silently grow the budget.

## Enforcement

The pipeline does not refuse to advance on a single over-budget stage. But the team-learning skill aggregates budget overruns across requests; recurring overruns at the same stage become a `team_knowledge` pattern and may motivate a default budget revision.
