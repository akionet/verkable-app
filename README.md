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

## Automation reports (OBS-001 F1)

Open **Automation** from the console, then choose an organisation and space.
Direct links use `/orgs/:org/spaces/:space/automation`. The route is a client-only
React view; its chart code is loaded separately from the workflow console.

The view reads the six Observe GET endpoints from verkable-os B1. Start that
runtime on port 8000 with Observe configured (see the provider's
`docs/observe.md`). Vite dev and preview proxy `/v1` beside `/workflows`.
The browser supplies neither tokens nor identity headers; principal resolution
and source credentials belong to the backend/trusted proxy. The default runtime
stub principal has no Observe access. A 404 can mean unavailable or unauthorized.
The existing deployment example needs a same-origin `/v1` reverse-proxy route
before it can serve Observe; hosting remains outside F1.

The pending queue is current, refreshes every minute, and includes unchanged
gates. Report sections and headline counts describe the selected historical
window. Dates filter reports and trends in UTC, leaving the current queue intact.
Missing trend counters remain gaps, with values also available as text.
Issue and recipe links are shown only for absolute HTTP(S) URLs. Observe provides
no gate decisions or other write actions.

```bash
pnpm gen:client       # regenerate both contract types from vendored schemas
pnpm check:client     # fail on generated-file drift
pnpm test             # includes @OBS-001-F1-01 and @OBS-001-F1-02 component cases
pnpm test:bdd         # includes the Automation browser scenarios with stubbed API
pnpm test:observe-live # requires local B1 + preview and OBSERVE_TEST_ORG/SPACE
```

See [contract provenance](docs/openapi/SOURCE.md). For live acceptance, run against
the local vault-backed provider, capture the view and `/reports` and `/pending`
responses, and compare the queue count with the vault producer's `peek` output.
Stubbed browser tests do not replace this live evidence.

## Licence

Apache-2.0. See [LICENSE](LICENSE) for the full licence text and [NOTICE](NOTICE)
for copyright attribution.
