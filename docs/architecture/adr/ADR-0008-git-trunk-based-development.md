# ADR-0008: Use trunk-based development with conventional commits

Date: 2026-05-25
Status: Accepted

## Context

Even if this is a solo MVP project, the repository should be professional and must have organised branching structure and commits.

The workflow must be structured enough to preserve traceability, but not so heavy that it slows down early product development.

## Decision

Use trunk-based development with one permanent branch: `main`.

The frozen `deprecated` branch archives the previous implementation. Active
development continues only on `main`.

Use short-lived branches for meaningful units of work. Branches should be deleted after merging.

Use Conventional Commit-style messages:

```
type(scope): imperative description
```

Allowed Types: (branch naming is a subset of this)

feat      New user-facing or product behavior

fix       Bug fix

docs      Documentation, ADRs, diagrams, README

test      Tests

refactor  Code restructuring without changing behavior

chore     Repository maintenance, config, tooling

build     Build system or dependencies

ci        CI/CD workflows

perf      Performance improvement

style     Formatting only, no logic change

revert    Revert a previous commit

spike     Time-boxed exploration or prototype
