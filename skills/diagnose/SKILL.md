# Skill: Diagnose

This skill is used by the Engineer (Phase 1A) when `work_type = "bug"`. It defines the Diagnosis Probe methodology: build a feedback loop, reproduce the failure, and hypothesise before any implementation begins.

> Methodology inspired by the `/diagnose` skill from [mattpocock/skills](https://github.com/mattpocock/skills). Adapted here to fit the A-TEAM artifact pipeline and scoped to the probe phase only.

---

## Step 1 — Build a Feedback Loop

**This is the most important step.** Everything else depends on it. A fast, deterministic, agent-runnable pass/fail signal is the prerequisite for all subsequent reasoning. Without one, no amount of code reading will reliably find the cause.

Spend disproportionate effort here. Be aggressive. Be creative. Do not move to Step 2 until you have a loop you believe in.

### Supported feedback loop types

Try them in roughly this order. Use the first one that produces a reliable signal.

1. **failing_test** — unit, integration, or e2e test at whatever seam reaches the bug.
2. **curl_http** — curl or HTTP script against a running dev server.
3. **cli_snapshot** — CLI invocation with a fixture input, diffing stdout against a known-good snapshot.
4. **headless_browser** — Playwright/Puppeteer script driving the UI, asserting on DOM/console/network.
5. **trace_replay** — saved real network request, payload, or event log replayed through the code path in isolation.
6. **throwaway_harness** — minimal subset of the system (one service, mocked external deps) that exercises the bug code path with a single function call.
7. **property_fuzz** — if the bug is "sometimes wrong output", run many random inputs and look for the failure mode.
8. **bisection** — if the bug appeared between two known states (commit, dataset, version), automate boot-at-state-X-check-repeat so it can be `git bisect run`.
9. **differential** — run the same input through old vs. new version (or two configs) and diff outputs.
10. **hitl_script** — last resort. If a human must click, drive them with a structured script so the loop is still recorded and output feeds back into the artifact.

### Loop quality criteria

Once you have a loop, ask:

- Can I make it faster? (Cache setup, skip unrelated init, narrow the scope.)
- Can I make the signal sharper? (Assert on the specific symptom, not just "didn't crash".)
- Can I make it more deterministic? (Pin time, seed RNG, isolate filesystem, freeze network.)

A 30-second flaky loop is barely better than no loop. A 2-second deterministic loop is a debugging superpower.

### Non-deterministic bugs

The goal is not a clean repro but a **higher reproduction rate**. Loop the trigger many times, parallelise, add stress, narrow timing windows. A 50%-flake bug is debuggable; a 1%-flake is not. Raise the rate until it is debuggable. Record the rate in `reproduction_rate`.

### When you genuinely cannot build a loop

Stop and surface this explicitly. List what you tried. Ask the user for: (a) access to the environment that reproduces it, (b) a captured artifact (HAR file, log dump, core dump, screen recording with timestamps), or (c) permission to add temporary production instrumentation. Do not proceed to Step 2 without a loop.

---

## Step 2 — Reproduce

Run the loop. Watch the failure appear.

Confirm all of the following before proceeding:

- [ ] The loop produces the failure mode **the user described** — not a different failure that happens to be nearby. Wrong bug = wrong fix.
- [ ] The failure is reproducible across multiple runs (or, for non-deterministic bugs, at a high enough rate to debug against).
- [ ] You have captured the exact symptom (error message, wrong output, slow timing) so Phase 2 can verify the fix actually addresses it.

Set `reproduction_confirmed = true` only when all three are satisfied.

---

## Step 3 — Hypothesise

Generate **3–5 ranked hypotheses** before testing any of them. Single-hypothesis generation anchors on the first plausible idea.

Each hypothesis must be **falsifiable**. State the prediction it makes:

> "If `<X>` is the cause, then `<changing Y>` will make the bug disappear / `<changing Z>` will make it worse."

If you cannot state the prediction, the hypothesis is a vibe — discard or sharpen it.

Rank them by plausibility given the evidence so far. The top-ranked hypothesis becomes the starting point for Phase 2 implementation unless probe results rule it out.

Do not proceed to the Probe Gate without at least 3 ranked, falsifiable hypotheses.

---

## What this skill does NOT cover

Steps 4–6 of the full diagnose process (Instrument, Fix, Cleanup) are handled in **Engineer Phase 2** after the Probe Gate passes. This skill covers only the probe phase: feedback loop + reproduce + hypothesise.
