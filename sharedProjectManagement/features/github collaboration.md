## New Project Feature: GitHub Collaboration

## Context

The prototype had been built locally while GitHub held only the original starter files. Other computers need a shared source baseline and clear collaboration rules.

## Tyler's Request

Set up the project's GitHub repository so other agents and collaborators on different computers can work with the team. Keep it public and invite GitHub user `bobjunga`.

## Conceptual gaps I, the agent, filled in

- Published the working app and collaboration setup on `codex/github-collaboration` in [PR #1](https://github.com/tyler-grffith/JungaWorkspace/pull/1), preserving Tyler's authority over the initial merge and deployment. Sent `bobjunga` a write-access invitation; acceptance is pending.
- Add portable agent instructions, first-checkout and contribution guidance, code ownership, PR/issue templates, Node 24 selection, and consistent text-file conventions.
- Run read-only GitHub-hosted application checks on every PR and main update, cancel obsolete runs, and retain failed browser artifacts. Enabled main protection requiring current checks/review, code-owner review, resolved conversations, and no force push/deletion; owner administrator override remains available.
- Keep ProductManagement owner-managed. Git shares committed source/design settings; browser libraries move separately through explicit backup/restore.

## What details should Tyler be able to fine tune by hand?

- In GitHub: repository visibility, collaborator invitations, reviews, branch rules, and issue assignment.
- In the repository: contributor/agent guidance, templates, and required checks. No automatic deployment is added.
