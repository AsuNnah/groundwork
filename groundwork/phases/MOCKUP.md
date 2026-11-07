# MOCKUP: see the app before it's built

Use this in P5 for every target with screens (web, mobile, desktop), at small tier and above. Also use it when the user asks to "see it", "mockup", "wireframe", "Figma", or "UI/UX". It comes after the DBD (`templates/dbd.md`) and before GATE 1.

**Goal:** the user sees and approves how the app looks and flows, before any feature code exists. Changing a mockup costs minutes; changing built screens costs days.

Output:
- the mockups themselves: a Figma file or `docs/mockups/`;
- the **Mockups** section of `docs/dbd.md`: tool, link, screens, feedback rounds, the user's approval.

## 1. Pick the tool: Figma when this machine can use it
**Figma is the default** for mockups when the agent can reach it. It runs in Figma's cloud through the official Figma MCP server, so any machine with internet works, even a headless server: the login link can be opened on any device.

Check in this order. **Say plainly which steps need the user's manual action.**

| What you find | What to tell the user |
|---|---|
| The Figma tools are present (e.g. `whoami`, `create_new_file`, `use_figma`) and `whoami` works | "Figma is ready; I'll build the mockups there." Use Figma. |
| `gw doctor` shows *Figma MCP is set up; login not verified*, or `whoami` fails | **Manual action:** "In Claude Code run `/mcp`, choose **figma**, **Authenticate**, and sign in to Figma in the browser. Tell me when done." Then verify with `whoami` again. |
| `gw doctor` shows Figma *missing* (no plugin or MCP) | Suggest turning it on. The agent can run `claude mcp add --transport http figma https://mcp.figma.com/mcp` with the user's approval, or the user installs the **Figma plugin** with `/plugin`. **Manual action:** restart the agent, then `/mcp` → figma → Authenticate. |
| The user has no Figma account | **Manual action:** sign up free at figma.com (the free plan is enough to start), then authenticate as above. |
| `whoami` shows no plan or seat that can create files | **Manual action:** the user picks or creates a team or workspace in Figma, or uses a file they own. Otherwise use HTML. |
| A step needs **the browser**, e.g.: capturing a running web app into Figma (`generate_figma_design`); opening the file to check it or read comments; the MCP login page; or no Figma MCP but a browser is available | Check browser access with the browser tools (e.g. list the connected browsers or tabs). **Manual action:** "Log in to figma.com in your browser, then install or turn on the **Claude in Chrome** extension (Chrome Web Store) and connect it to this session, so I can open and check the Figma file." Verify it by opening the file link. Driving Figma through the browser is slower than the MCP, so still suggest the MCP. |
| The Figma editor in the browser is blank, very slow, or says WebGL or hardware acceleration is off | Check `chrome://gpu`. **Manual action:** turn on Settings → System → *Use graphics acceleration when available*, then relaunch Chrome. If WebGL still shows *software only* (renderer `llvmpipe`/`SwiftShader`), the display isn't using the GPU: common on Linux remote desktops with a virtual (dummy) display driver or no GPU. Fixing that is a system display change the user makes; never change it yourself. The Figma MCP doesn't need WebGL, so keep building through it, and use the browser only to view. |
| No internet, the user declines, or setup fails twice | Use the **HTML clickable prototype**, and say it can be pushed into Figma later. |

Rules:
- Never ask for a Figma password or token. Account connection always goes through the platform's own login flow.
- Never claim Figma works until `whoami` succeeds in this session.
- Ask once. If the user says "HTML is fine", don't re-suggest Figma in this project. Record the choice in the DBD's Mockups line.

Other tools:

| Tool | Needs | Best for |
|---|---|---|
| **HTML clickable prototype** (`docs/mockups/`, starter: `templates/mockup/index.html`) | nothing: opens in any browser, works offline | fast, free, clickable flows; can be pushed into Figma later |
| **Wireframe sketch** (Excalidraw / draw.io / Mermaid, e.g. `diagram-design` skill) | nothing | the very first layout talk, or when the user only wants boxes |

## 2. Fidelity ladder: get feedback at each step
Each step is a feedback round, not a formal approval. The sign-off comes once, in the GATE 1 review packet with the intent and plan (`phases/P6.md` step 7), unless the user wants to sign the mockup off on its own.

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
5. Use Figma variables for the DBD tokens, generated from `docs/design/tokens.json` (W3C DTCG format).
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

**Blind review** (standard tier and above, before the mockup is final):
1. Give the mockup to independent reviewers: fresh-context subagents, or real people the user names. Each one gets a persona from the PRD's users, or a domain expert role, and sees only the mockup.
2. Write the synthesis in `docs/mockups/review-v<n>.md` (`templates/mockup-review.md`): scores, cross-cutting problems, factual errors, and the order of work.
3. Fix the mockup, then run a second round to confirm the fixes.
4. Show the user the synthesis before they approve.

Keep `docs/mockups/README.md` current: status, what changed in each version, and what the mockup deliberately leaves out.

## 5. Hand-off to P7
- **Figma:** build from the file with `get_design_context` and the `figma-design-to-code` skill. Code Connect (`figma-code-connect`) maps components when a design system exists.
- **HTML:** reuse the tokens (CSS variables) and the structure. The prototype is a picture of the target, not production code.
- In P8 and P9, compare the built screens with the approved mockup (screenshots side by side), and log any differences as tasks.
