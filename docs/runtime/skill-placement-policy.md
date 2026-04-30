# Skill Placement Policy

This file defines where each kind of content lives in the repository. The policy exists because claude-a-team is a *team*, not a *catalog*: every artifact must have a single, predictable home so teammates can find it without searching.

## The four kinds of skill content

### 1. Stage skills (canonical, hand-curated)

Where: `.claude/skills/<stage>/SKILL.md`

What belongs here: the nine pipeline stages, each with one `SKILL.md` describing inputs, responsibilities, output contract, and "you must not" rules.

Allowed stages:
- `intake`, `pm`, `architect`, `security`, `engineer`, `diagnose`, `executor`, `review`, `qa`, `release-readiness`, `team-learning`

Adding a new stage skill requires updating CLAUDE.md, gates-and-flow.md, and stage-body-schemas.md in the same change. Do not introduce a stage skill that has no body schema.

### 2. Runtime skills (deterministic, non-creative)

Where: `.claude/skills/<runtime>/SKILL.md` plus optional `<runtime>/run.*` scripts

What belongs here: stages that execute a well-defined contract instead of reasoning. Today the only runtime skill is `executor`. A runtime skill may ship with an executable runner (e.g. `executor/run.mjs`) so the contract can be applied without an LLM in the loop.

Runtime skills must be model-neutral. Their `SKILL.md` describes the contract; their runner enforces it.

### 3. Reflective skills (cross-request memory)

Where: `.claude/skills/team-learning/SKILL.md`

What belongs here: skills that scan completed sessions and emit `team_knowledge` artifacts. There is one reflective skill (`team-learning`). New reflective skills are rare and must produce typed JSON that downstream stages can consume.

### 4. Patterns and learned content (generated, not hand-curated)

Where: `_team-knowledge/<YYYY-MM>/<short-name>.json`

What belongs here: `team_knowledge` artifacts produced by `team-learning`. This directory is generated content. Do not hand-edit. Do not import patterns directly into SKILL.md files — read them at stage runtime via the consumer list.

## Where things do *not* belong

- **No domain skills.** Skills like "react-testing" or "api-design" do not belong in this repository. claude-a-team is a workflow, not a catalog. Domain knowledge belongs in the repos being worked on (their CLAUDE.md, READMEs, and source).
- **No language reviewers.** The Review stage is a single skill that produces a `review_output` artifact. Language-specific review variants would shatter the artifact contract.
- **No proactive agents.** This project does not use the proactive agent pattern. Stages run when the pipeline routes to them, based on PM `work_type` and gate triggers.
- **No slash-command shims as primary entry points.** Stages are invoked via skills. Commands (if any) must be thin redirections to the matching skill.

## Session content

Where: `sessions/<session_folder>/`

Each request creates a session folder with `artifacts/`, `evidence/`, `logs/`, and (after first code edit) `worktree/`. Do not place stage-skill content under `sessions/`. Do not place sessions inside `.claude/`.

Reference example sessions live under `sessions/_examples/` and may be checked into git. Live request sessions are local to the developer machine and should be `.gitignore`d.

## Adding new content: decision tree

```
Is the content one of the nine pipeline stages?
  yes -> .claude/skills/<stage>/SKILL.md (must update contracts in same change)
  no  -> Is it a deterministic runtime contract?
           yes -> .claude/skills/<runtime>/SKILL.md + runner
           no  -> Is it cross-request memory?
                    yes -> .claude/skills/team-learning/ (extend existing skill)
                    no  -> It probably does not belong here.
                           Reconsider whether claude-a-team is the right home.
```

## Why this policy is strict

The everything-claude-code project demonstrates the alternative: 182 skills, 48 agents, ongoing audits to find low-signal entries. That model works for a catalog. It fails for a team — when stages can be added freely, the artifact contract erodes and the pipeline stops being a pipeline.

This policy keeps the team small, the contract tight, and the routing predictable.
