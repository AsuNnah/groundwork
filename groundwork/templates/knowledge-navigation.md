# Knowledge navigation: Graphify + Obsidian (optional, large tier)

Use for multi-module repos or projects with many docs and decisions. Skip for small projects; a `docs/project-map.md` index is enough there.

- **Obsidian vault:** plain Markdown notes (project map, PRD/TRD/ADR, glossary) that link to each other. Obsidian desktop is optional. Don't install community plugins without a need, and don't use the user's personal vault without approval.
- **Graphify** (`Graphify-Labs/graphify`; PyPI package `graphifyy` with two y's; CLI `graphify`): a code/doc graph with query, path, and explain commands. Other projects use the same name, so verify the source.
- **Before installing:** check GitHub security advisories. GHSA-pcc4-rvhr-2pr8 affected `graphifyy >=0.7.2,<0.9.70` (path traversal via the Fortran extractor), fixed in 0.9.70; re-check for newer advisories. Install at project scope if the CLI supports it.
- **Indexing scope:** exclude `.env`, keys/certificates, database dumps, customer data, build/vendor output, and anything not cleared for processing. Don't rely on `.gitignore` alone.
- **Privacy:** code parsing is local, but semantic extraction of docs/media may send content to an AI model. Use code-only mode for sensitive repos unless the user approves.
- **Usage:** build the graph after docs and code structure exist; update it incrementally after milestones. Use it to find candidate files, then open the real source before editing or stating facts. Relations tagged INFERRED are not proof.
- **Review graph outputs** (graph.json, HTML, vault) for internal names or snippets before committing or sharing. Record the decision in `docs/skill-requirements.md`.
