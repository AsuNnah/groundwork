# DBD: <product> design brief

For any target with a UI. Link screens to FSD features.

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

## Navigation
<tab bar / sidebar / stack; Mermaid diagram if non-trivial>

## Responsive and input
Breakpoints or device sizes, orientation, keyboard, touch, mouse, screen readers.

## Accessibility (minimum)
- WCAG 2.2 AA contrast; text resizes to 200 % without breaking
- every control has a label; focus order is logical; touch targets ≥ 44×44 pt / 48×48 dp
- never colour alone to convey meaning; motion respects reduced-motion settings

## Copy
Voice, terminology list, error-message style (what happened + what to do).
