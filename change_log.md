# Change Log

## 2026-04-29 — Replace TDD probe with Diagnosis Probe for bug work

### What changed

The Engineer skill previously ran a single TDD probe for all work types: write failing tests, run them, confirm they fail, then implement. This was replaced with a two-mode probe system:

- **Diagnosis Probe** (bugs): build a reproducible feedback loop, confirm the failure, and produce ranked falsifiable hypotheses before any implementation begins. The feedback loop can be a failing test, a curl script, a headless browser run, a bisection harness, or any of ten supported types — whatever produces a reliable signal fastest.
- **TDD Probe** (features / improvements / technical debt): unchanged from the original — write failing tests that define the expected behavior, confirm they fail, then implement.

The gate that enforces the probe was renamed from **TDD Gate** to **Probe Gate** and gained separate decision logic for each mode. For the diagnosis path, the gate now checks that a feedback loop is confirmed, the failure reproduces, and at least 3 ranked hypotheses are present — not just that tests failed as expected.

A new skill file (`.claude/skills/diagnose/SKILL.md`) holds the full diagnosis probe methodology, adapted from [mattpocock/skills](https://github.com/mattpocock/skills).

### Files affected

| File | Change |
|---|---|
| `CLAUDE.md` | Pipeline diagram, probe description, routing rule, skills list |
| `.claude/skills/engineer/SKILL.md` | Phase 1 split into Phase 1A (diagnosis) and Phase 1B (TDD); Phase 2 uses top-ranked hypothesis as implementation starting point for bugs |
| `.claude/skills/diagnose/SKILL.md` | New — diagnosis probe methodology (10 feedback loop types, reproduce checklist, hypothesise format) |
| `docs/runtime/gates-and-flow.md` | TDD Gate → Probe Gate; two decision tables, one per mode |
| `docs/contracts/stage-body-schemas.md` | `TDDProbeOutputBody` → `ProbeOutputBody` with `probe_mode` and separate `diagnosis`/`tdd` sub-blocks; `TDDGateOutputBody` → `ProbeGateOutputBody` |
| `docs/runtime/storage-layout.md` | Artifact filenames: `tdd-probe-output.json` → `probe-output.json`, `tdd-probe-results.json` → `probe-results.json`, `tdd-gate-output.json` → `probe-gate-output.json` |

### Idea behind it

The TDD probe works well for features — you know what you want to build, so you can write a test that describes it. For bugs, the TDD probe forces you to write failing tests before you understand what is actually wrong, which often results in tests that capture the symptom rather than the cause, or that cannot be written at all because the problem statement is not precise enough.

The diagnosis probe flips this: instead of starting with tests, it starts with the question "can I reliably reproduce this?" A feedback loop that reliably surfaces the bug is more valuable than a test written against an incomplete understanding. The hypothesis step then forces the engineer to reason about causes before touching any implementation code, which keeps fixes surgical and avoids the common failure mode of patching the symptom without addressing the root cause.

TDD remains the right discipline for feature and improvement work, where the behavior is specified in advance and failing tests are a natural way to express it.
