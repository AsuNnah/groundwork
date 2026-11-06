# DBD: <product> design brief

<!-- "DBD" = Design Brief Document for the UI (Groundwork's name; not a database design). Sources: design-brief practice (objectives, audience, constraints, deliverables), W3C DTCG Design Tokens format 2025.10, WCAG 2.2 AA, Nielsen's 10 usability heuristics, platform guidance (Material 3, Apple HIG). -->

For any target with a UI. Link screens to FSD features.

## Objectives and success criteria
| Objective | Measurable success criterion (e.g. first entry in under 60 s, 4/5 test users finish the task unaided) |
|---|---|

## Audience and job
<who uses each screen, what they are trying to get done, how often, under what pressure>

## Principles
<3–5 rules that settle design arguments, e.g. "safe by default: destructive actions need preview">

## Look and feel
- Audience and tone: <who uses it, how it should feel>
- References: <apps or sites to resemble or avoid>
- Platform conventions: <Material 3 / Apple HIG / Fluent / web>

## Design tokens
Keep the source of truth in `docs/design/tokens.json`, in the W3C DTCG format (2025.10): `$value`, `$type`, aliases like `{color.primary}`. Figma variables and CSS variables are generated from it.
| Token | $type | Value or alias | Use |
|---|---|---|---|
| color.primary | color | | buttons, links |
| color.surface / color.text | color | | backgrounds, body text (contrast ≥ 4.5:1) |
| color.button.bg | color | {color.primary} | alias example |
| font.body / font.heading | fontFamily | | |
| space.unit | dimension | e.g. 4 or 8 px | spacing scale |
| radius / elevation | dimension / shadow | | |
Dark mode: <yes/no; token overrides>

## Screens
| Screen | Feature (REQ) | Purpose | Main actions |
|---|---|---|---|

For each screen, design every state: **default, empty, loading, error, offline, no permission, long content**.

## Information architecture
<the screen tree and what lives where>

## Components and states
| Component | Variants | States (default, hover, focus, disabled, loading, error) |
|---|---|---|

## Navigation
<tab bar / sidebar / stack; Mermaid diagram if non-trivial>

## Responsive and input
Breakpoints or device sizes, orientation, keyboard, touch, mouse, screen readers.

## Accessibility (minimum: WCAG 2.2 AA)
- contrast: text ≥ 4.5:1, large text and non-text UI (icons, borders, focus rings) ≥ 3:1 (1.4.3, 1.4.11); text resizes to 200 % without breaking
- every control has a label; focus order is logical; focus is never hidden behind sticky bars or dialogs (2.4.11)
- targets: WCAG minimum 24×24 CSS px (2.5.8); platform guidance 44×44 pt (Apple HIG) / 48×48 dp (Material)
- anything done by dragging also works with a single tap or click (2.5.7)
- sign-in doesn't require memorising or transcribing (allow paste and password managers) (3.3.8)
- never colour alone to convey meaning; motion respects reduced-motion settings

## Mockups (`groundwork/phases/MOCKUP.md`)
- Tool: <Figma / HTML prototype / wireframe> · link or path: <Figma URL / docs/mockups/index.html>
| Screen | States covered | Sizes | Status (wireframe / visual / clickable) |
|---|---|---|---|

| Round | Date | What the user asked to change | Done |
|---|---|---|---|

**Approval:** "<user's words>" · version/link: <…> · date: <YYYY-MM-DD>

## Deliberately absent
<things users may expect but this design leaves out on purpose, and why>

## Copy
Voice, terminology list, error-message style (what happened + what to do).
