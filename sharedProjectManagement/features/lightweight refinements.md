## New Workspace Feature: Lightweight Refinement Requests

## Context

Some small design changes require code even when most common choices are editable by hand.

## Tyler's Request

Provide an inexpensive refinement workflow and explain whether it should use a chat, another model, or delegation.

## Conceptual gaps I, the agent, filled in

- Added an area-aware refinement note and **Copy request for agent** button to designer mode. The copied brief contains the request, relevant source/feature paths, and a focused implementation protocol.
- Keep the handoff explicit: copying does not start an agent or send a message. Short requests in the existing task remain useful; a reusable lightweight task suits an independent batch.
- Documented proportional verification, reuse of feature records, and no unrelated refactoring in [Small refinements](../../docs/REFINEMENTS.md). Delegation remains optional because coordination itself consumes work.

## What details should Tyler be able to fine tune by hand?

- Choose the refinement area and write/edit the request before copying it into the desired agent task.
- Choose the task/model used for the work in Codex. The app itself has no model picker or automatic agent execution.
