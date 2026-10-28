# Task 1 — Design System

## What This Task Was

This task was about building a structured design system from Figma, then making it usable by an AI coding agent without allowing the agent to choose arbitrary colours or styles.

The goal was to establish a reliable source of truth for design decisions and demonstrate how token references affect consistency across an interface.

## What I Built

I created a design system with two main token layers:

- **Primitive tokens:** Define the brand colours and their tonal palettes using hex values.
- **Semantic tokens:** Reference primitive tones and assign them roles in the interface, so components can use meaningful roles instead of selecting raw hex values.

I configured the tokens in Figma before exporting them. I then converted the token structure into CSS variables for use in the application.

The task also includes documentation for the colour roles, typography, shadows, and divergences from the reference design system. I used a screen implementation to examine whether the agent was following the system and prepared evidence of the integration and a deliberate token-referencing regression.

## What I Decided

I separated primitive values from semantic roles so the design system could remain the single source of truth.

Instead of allowing components or the AI agent to select colours independently, semantic roles provide a consistent reference to the intended primitive tones. This makes global changes more predictable and reduces arbitrary styling choices.

I also chose to document the design decisions and deviations rather than relying on the exported files alone. The documentation helps explain not only which values exist, but why they exist and where the implementation differs from the reference.

For accessibility, I recognise that consistent tokens do not automatically guarantee sufficient contrast. Colour combinations still need to be checked and tested.

## What I Got Wrong and What I Learned

During the deliberate regression, I replaced a semantic colour reference with a hardcoded hex value. I then changed the source palette and regenerated the CSS variables.

The correctly referenced interface elements updated to the new palette, while elements using the hardcoded value retained the old colour. This demonstrated that placing colours in one file is not enough: the references between primitive tokens, semantic roles, and components must also be correct.

I learned that a design system is not simply a collection of exported values. Its usefulness depends on how consistently the application consumes those values.

## Status

Update this section to reflect the actual state of the task before submission.

- **Completed:** [List the token setup, exports, documentation, and implementation that are complete.]
- **In progress:** [List any unfinished integration, testing, or documentation.]
- **Not started:** [List anything not yet attempted.]

## Evidence and Documentation

The task's supporting files are organised within this folder:

- `docs/` — design-system documentation and agent prompts.
- `evidence/` — screenshots and text-based evidence of the implementation, token usage, and regression.
- `defects.md` — known defects in the implementation.
- `docs/interview-answers.md` — answers to the Task 1 interview questions.

See the evidence files for the actual results of the implementation and regression test.
