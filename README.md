# Claude A-TEAM

A-TEAM is a set of Claude skills that simulate standard software development roles. It follows a typical workflow among participants (PM, architect, engineer, QA), producing artifacts that are AI-friendly and can be consumed by other models.

This project was originally designed to address issues in an ongoing codebase. I am now working on generalizing it to support a broader range of use cases.

This package is a modular rewrite of the attached monolithic `CLAUDE.md`.

## Design

- Keep **one canonical workflow contract**
- Move **role behavior** into discrete skills
- Keep the workflow **model-neutral**
- Make the artifact contract reusable by Claude, Codex, GPT, or non-LLM runtimes

## Folder structure

```text
claude-modular-layout/
├── CLAUDE.md
├── docs/
│   ├── contracts/
│   │   ├── artifact-envelope.md
│   │   └── stage-body-schemas.md
│   └── runtime/
│       ├── gates-and-flow.md
│       └── storage-layout.md
└── .claude/
    └── skills/
        ├── intake/
        ├── pm/
        ├── architect/
        ├── security/
        ├── engineer/
        ├── review/
        ├── qa/
        └── release-readiness/
```

## Why this split works

The original file mixes four concerns:

1. Global rules
2. Runtime setup and gate logic
3. Typed artifact contracts
4. Role prompts

This layout keeps the first three centralized and moves the fourth into skills.

## Migration guidance

1. Replace the long root `CLAUDE.md` with the short one in this package.
2. Copy the `docs/` folder intact.
3. Copy the `.claude/skills/` folder intact.
4. Keep schema edits centralized in `docs/contracts/`.
5. When a schema changes, update every affected skill in the same change.

## Notes

- The executor remains a runtime responsibility, not a skill.
- This package is intentionally model-neutral.
- Skills reference the centralized contract instead of duplicating it.
