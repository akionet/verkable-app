# navigator-orchestrator-app

The operator console for [`navigator-orchestrator-api`](../navigator-orchestrator-api) —
a React + Vite + TypeScript single-page app for launching workflows, watching
them execute, reviewing previous runs, and resolving human-in-the-loop gates.

> **Status: pre-release.** The console is here and its checks are green
> (typecheck, lint, 27 unit tests, 8 browser scenarios), but the project is not
> published yet. See [`../navigator-orchestrator-api/EXTRACTION.md`](../navigator-orchestrator-api/EXTRACTION.md)
> for what was removed on the way out of its original codebase.

## Quick start

Run the API on port 8000 first — `vite.config.ts` proxies `/workflows` to it in
both dev and preview, so the app is same-origin and never holds a credential.

```bash
pnpm install
pnpm dev            # http://127.0.0.1:5173
pnpm check          # lint, typecheck, unit tests, build, bundle guard, browser BDD
```

## What it contains

Carried over from the upstream console, which is feature-complete through its
fourth delivery slice:

- **Workflow discovery** — registered workflows, their input JSON Schema, and
  exact registered YAML where the workflow is YAML-defined.
- **Launch and live execution** — generic JSON input, then an ordered SSE stream
  of node transitions, streamed tokens, and a terminal result.
- **Run history** — workflow-scoped, URL-backed filters that survive a browser
  reload, with run metadata, policy, principal, decision chain and execution log
  refetched from the runtime rather than held client-side.
- **Human gates** — opaque gate-payload rendering with approve / reject / amend
  and an optional comment, resuming the same run over the same streaming path.

The console renders gate payloads **generically**. There is no workflow-specific
renderer, which is what lets a new workflow appear in it without a frontend
change — and is worth preserving through the extraction.

## Notes for the copy

- The API base URL must stay **relative** so the app is served same-origin behind
  the runtime's trusted boundary. No credential ever reaches the browser.
- Upstream `vite.config.ts` defines `server.proxy` but not `preview.proxy`, so a
  production build served by `vite preview` has no route to the API. Fix that in
  the copy rather than inheriting it.
- No wildcard CORS. It is a shortcut that becomes the deployment model.

## Licence

Not yet chosen.
