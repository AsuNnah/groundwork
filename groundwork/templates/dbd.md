# DBD: <product> design brief

For any target with a UI. Link screens to FSD features.

## Audience and job
<who uses each screen, what they are trying to get done, how often, under what pressure>

## Principles
<3–5 rules that settle design arguments, e.g. "safe by default: destructive actions need preview">

## Look and feel
- Audience and tone: <who uses it, how it should feel>
- References: <apps or sites to resemble or avoid>
- Platform conventions: <Material 3 / Apple HIG / Fluent / web>

## Design tokens
| Token | Value | Use |
|---|---|---|
| color.primary | | buttons, links |
| color.surface / color.text | | backgrounds, body text (contrast ≥ 4.5:1) |
| font.body / font.heading | | |
| space.unit | e.g. 4 or 8 px | spacing scale |
| radius / elevation | | |
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

## Accessibility (minimum)
- WCAG 2.2 AA contrast; text resizes to 200 % without breaking
- every control has a label; focus order is logical; touch targets ≥ 44×44 pt / 48×48 dp
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
