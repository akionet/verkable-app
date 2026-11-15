# OBS-001 F1 validation and relay handoff

Date: 2026-11-15. Branch: `agent/obs-001-f1-automation-view-in-verkable-app`.

Implementation is present but **not ready to merge**. Dependency installation,
lockfile refresh, executable tests, and live acceptance remain blocked/unverified.
No commit, push, PR, deployment, or vault edit was made.

## Test-first evidence

`features/automation.feature` and `AutomationView.test.tsx` were written before
the view components, with `@OBS-001-F1-01` and `@OBS-001-F1-02`. The initial
`pnpm exec vitest run src/automation/AutomationView.test.tsx` attempt could not
start the suite: pnpm tried to obtain missing dependencies and npm connections
were refused. Therefore no assertion-level red-to-green result is claimed.

## Commands and results

The existing installed tools from the local navigator-orchestrator-app checkout
were reused through ignored worktree-local node_modules links/copies. The cached
openapi-typescript 6.7.6 package was used to generate the declaration files.
No substitutes or handwritten declarations were used for missing libraries.

| Command | Result |
| --- | --- |
| `pnpm install --store-dir .pnpm-store` | BLOCKED: npm registry connections refused (`ECONNREFUSED`). |
| `node scripts/gen-client.mjs` | PASS: generated both declaration files. |
| `node scripts/gen-client.mjs --check` | PASS. |
| `node node_modules/eslint/bin/eslint.js .` | PASS after correcting Node URL imports. |
| `node scripts/check-license.mjs` | PASS: 3 tests. |
| `node --check features/steps/automation.steps.mjs` | PASS. |
| `node --check scripts/gen-client.mjs` | PASS. |
| `git diff --check` | PASS. |
| `node node_modules/typescript/bin/tsc --noEmit` | BLOCKED: missing openapi-fetch, vega-lite and vega-embed; associated unresolved callback type. |
| `node node_modules/vitest/vitest.mjs run src/automation/AutomationView.test.tsx` | NOT RUN: Vite config loading hits `spawn EPERM`. |
| `node node_modules/vitest/vitest.mjs run src/automation/AutomationView.test.tsx --configLoader native` | NOT RUN: worker creation hits `spawn EPERM`. |
| `node node_modules/vitest/vitest.mjs run src/automation/AutomationView.test.tsx --configLoader native --pool threads` | NOT RUN: worker initialization times out; zero tests execute. |
| `node node_modules/vite/bin/vite.js build --configLoader native` | FAILED: unresolved dependencies. Partial output is not a valid build. |
| `node scripts/check-bundle.mjs` | Passed over partial build output only; NOT accepted as full bundle validation. Rerun after a successful build. |
| `node node_modules/@cucumber/cucumber/bin/cucumber.js --config cucumber.mjs --tags '@OBS-001-F1-01 or @OBS-001-F1-02' --dry-run` | PASS discovery: 3 scenarios, 17 steps, all skipped; browser assertions NOT RUN. |
| `pnpm test:bdd` | NOT RUN: requires a successful build and browser execution. |
| `pnpm test:observe-live` | NOT RUN: no reachable configured local Observe service; screenshots/API evidence not collected. |
| `pnpm test:e2e` | NOT RUN: existing real-runtime journey requires its service and a successful build. |

An additional offline lockfile attempt used:

```text
node C:/Users/emily/AppData/Local/pnpm/.tools/pnpm/9.0.0_tmp_33620_0/node_modules/pnpm/bin/pnpm.cjs --dir node_modules/.observe-lock install --offline --lockfile-only --store-dir .pnpm-store --ignore-workspace
```

It failed with `ERR_PNPM_NO_OFFLINE_META` for openapi-typescript. The temporary
directory contains copies of package.json and the lockfile under ignored
node_modules. **pnpm-lock.yaml remains unchanged and does not contain the new
dependencies. Frozen-lockfile CI will fail until it is regenerated.**

Byte-for-byte comparison against the merged B1 checkout passed:

- OpenAPI SHA-256: `3adecb87b9b4314509523ddf663630adbf8abab4509ac4714d7da6cc14334dc9`
- Report schema SHA-256: `81acc1c118fb94957bf83729dee386602e7161a89895e33f94737affd5231dca`

## Remaining work in an enabled environment

1. Run `pnpm install` with the repo's CI pnpm version (10.32.1), review the lockfile,
   and run `pnpm check`. Resolve any dependency/type/runtime findings.
2. Run the live scenario against B1 with `OBSERVE_TEST_ORG` and
   `OBSERVE_TEST_SPACE`, a correctly configured server-side principal, and Vite
   preview on port 4173. It captures desktop/mobile screenshots and API JSON
   under ignored `test-results/observe-live`.
3. Compare the pending count with the vault producer's `peek` output and have the
   relay record evidence on the epic. This workspace did not edit the vault.

No P1–P5 scope was added. Report-body types are additionally generated from B1's
JSON Schema because its OpenAPI response intentionally leaves that body opaque.
