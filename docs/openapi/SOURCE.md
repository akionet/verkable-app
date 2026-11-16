# Observe contract provenance

Both snapshots are copied without modification from `akionet/verkable-os`
commit `e50f817` (merged B1 PR #2):

- `docs/openapi/observe.v1.json`
- `src/navigator_orchestrator/observe/schema/automation-report.v1.schema.json`

`pnpm gen:client` generates `src/automation/api.d.ts` with openapi-typescript.
B1's report endpoint deliberately returns an opaque object. The same generator
also produces `report.d.ts` from the report JSON Schema, wrapped in an in-memory
OpenAPI 3.1 document with local `$defs` references relocated to components.
There is no handwritten copy of the report contract. Validation remains B1's
responsibility. `pnpm check:client` rejects generated-file drift in CI.

To update: copy both files from a reviewed, merged provider commit, update this
provenance, regenerate, and run the checks. Do not edit generated types.

The test fixture `features/fixtures/automation-report.json` is B1's committed
`tests/fixtures/observe/tenants/cuisinesavvy/automation-reports/2026/11/15/0012Z.json`.
Tests add synthetic publication and stop entries and use another tenant to check
that the UI does not assume CuisineSavvy.
