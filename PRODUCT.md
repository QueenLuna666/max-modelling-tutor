# MAX — Mathematical Modelling Tutor

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Middle-school students working on open-ended mathematical modelling tasks in Hebrew or Arabic.
- Teachers following their students' work through classroom dashboards.
- Researchers examining students' modelling processes through dashboards and conversations.

The user confirmed these audiences and the product purpose during Impeccable setup.

## Product Purpose

MAX supports mathematical modelling by asking questions and giving graded hints.
It guides students without solving the task for them. Staff can follow the
student's thinking process, rather than seeing only a final answer.

## Operating Context

The existing repository implements student entry with a class code and nickname,
a task library, and a task workspace with a tutor conversation. Staff workflows
include class management, classroom monitoring, student conversation review, and
research analysis. These implementation details are evidenced in README.md and
the app/student and app/staff routes.

## Capabilities and Constraints

- Preserve the distinction between student learning and teacher/researcher analysis.
- Preserve the tutor's questioning and graded-hint approach when changing UI or copy.
- Support Hebrew and Arabic, including right-to-left navigation and text.
- Preserve readable mathematical notation within right-to-left content.
- Existing implementation: Next.js App Router, React, TypeScript, Tailwind CSS,
  and server-mediated Supabase access. The codebase remains the technical authority.
- Students use nicknames rather than names or email addresses, as documented in README.md.
- Learning outcomes, deployment readiness, and measured usability improvements
  have not been established by this setup; do not present them as verified claims.

## Evidence on Hand

- README.md describes the product, roles, workflows, and privacy approach.
- tasks/*.json and lib/tasks.ts contain task content and task registration.
- prompts/max_base.md and prompts/analyzer.md contain tutoring and analysis instructions.
- lib/framework.ts records the modelling framework.
- lib/classSettings.ts records class-configurable learning and accessibility features.
- components/MessageText.tsx handles mathematical notation and drawings in conversations.

## Product Principles

- Help students develop their own reasoning through questions and appropriate hints.
- Make the task and the next learning action understandable.
- Keep staff analysis useful for observing the learning process.
- Give Hebrew and Arabic users equally usable learning flows.

## Accessibility & Inclusion

The existing interface includes class-configurable read-aloud, voice input,
simplified explanation, drawings, and text readability controls. Preserve those
capabilities in UI work. Existing CSS includes keyboard focus and reduced-motion
support. A formal accessibility conformance level is not confirmed.

## Open Decisions

No new visual direction or redesign scope was chosen during setup. Assess the
current interface before proposing a replacement visual system.
