# MOCKUP: see the app before it's built

Use this in P5 for every target with screens (web, mobile, desktop), at small tier and above. Also use it when the user asks to "see it", "mockup", "wireframe", "desain", "tampilan", "Figma", or "UI/UX". It comes after the DBD (`templates/dbd.md`) and before GATE 1.

**Goal:** the user sees and approves how the app looks and flows, before any feature code exists. Changing a mockup costs minutes; changing built screens costs days.

Output:
- the mockups themselves: a Figma file or `docs/mockups/`;
- the **Mockups** section of `docs/dbd.md`: tool, link, screens, feedback rounds, the user's approval.

## 1. Pick the tool (offer once, recommend one)
| Tool | Needs | Best for |
|---|---|---|
| **Figma** (official Figma MCP server) | a Figma account (a free plan is enough to start) and the Figma MCP connected to the agent | real design files you can open, comment on and share; later design-to-code with exact tokens |
| **HTML clickable prototype** (`docs/mockups/`, starter: `templates/mockup/index.html`) | nothing: opens in any browser, works offline | fast, free, clickable flows; can be pushed into Figma later |
| **Wireframe sketch** (Excalidraw / draw.io / Mermaid, e.g. `diagram-design` skill) | nothing | the very first layout talk, or when the user only wants boxes |

Recommend **Figma** when the user wants Figma or plans to work with a designer. Otherwise recommend **HTML first**: it costs nothing, and the screens can be sent to Figma afterwards.

Connecting Figma:
- **The user connects their account through the platform's own flow:** the Figma plugin or connector, or `claude mcp add --transport http figma https://mcp.figma.com/mcp`, then authenticate when prompted.
- Never ask for a Figma password or token.
- Verify the connection with one harmless call, such as `whoami`, before promising Figma output (P4 rule).

## 2. Fidelity ladder: get approval at each step
1. **Wireframe** (low fidelity): layout and hierarchy for every screen in the DBD, plus the navigation between them. Grey boxes, real labels.
2. **Visual mockup** (high fidelity): apply the DBD tokens (colours, type, spacing, radius), real-looking sample content, and an icon set.
3. **Clickable prototype:** the main flows from the AFD, tappable end to end.

Small tier: steps 1–2 for the main screens are enough.

For every screen, cover:
- **the states:** default, empty, loading, error, offline, no permission, long content;
- **the sizes:** phone 390×844 for mobile targets; 1440×900 and 390-wide for web; the target window size for desktop;
- dark mode, if the DBD says so.

Check text contrast (WCAG AA, at least 4.5:1) and touch-target size before you show it.

## 3. How to build it
**Figma:**
1. Use the Figma skills when they're installed: `figma-use`, `figma-generate-design`, `figma-create-new-file`, `figma-generate-library`.
2. Create the file (`create_new_file`), or use one the user gives you.
3. Build the screens as **editable layers and components**, not a pasted screenshot.
4. A fast route: write the screens as HTML first, then use `html_to_figma`, or `generate_figma_design` for a running web app.
5. Use variables for the DBD tokens.
6. Share the file link, and read the user's comments and edits back with `get_screenshot` / `get_design_context`.

**HTML:**
1. Copy `templates/mockup/index.html` to `docs/mockups/index.html`. Put the DBD tokens in its CSS variables and add one `<section class="screen">` per screen.
2. Link the screens with buttons for the clickable flow.
3. Show it to the user:
   - give them the file path to open;
   - or take screenshots at each size with browser automation (Claude in Chrome or Playwright) into `docs/mockups/screens/`, and show them.

**Reference app** (from `phases/RESEARCH.md`): mirror its flow where the user wants that. Use its screenshots as reference only; never copy its brand, logos, or copyrighted assets.

## 4. Review loop
1. Show the user, then ask what to change: one round at a time, specific questions ("Is the add button easy to find?").
2. Iterate. Record each round in the DBD's Mockups table.
3. **Approval:** the user's own words, the mockup version or Figma link, and the date. GATE 1 needs a plan that matches the approved mockup.
4. Later changes to the look go through the mockup first, then the code.

## 5. Hand-off to P7
- **Figma:** build from the file with `get_design_context` and the `figma-design-to-code` skill. Code Connect (`figma-code-connect`) maps components when a design system exists.
- **HTML:** reuse the tokens (CSS variables) and the structure. The prototype is a picture of the target, not production code.
- In P8 and P9, compare the built screens with the approved mockup (screenshots side by side), and log any differences as tasks.
