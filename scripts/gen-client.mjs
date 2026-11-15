/* global process, console */
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { URL } from "node:url";
const require = createRequire(import.meta.url);
const openapiTS = require("openapi-typescript");

// B1 leaves the report response opaque in OpenAPI. Generate its type from the
// exact JSON Schema B1 validates, using a temporary OpenAPI 3.1 envelope.
const reportSchema = JSON.parse(await readFile("docs/openapi/automation-report.v1.schema.json", "utf8"));
const definitions = reportSchema.$defs;
delete reportSchema.$defs;
delete reportSchema.$id;
delete reportSchema.$schema;
const reportDocument = JSON.parse(JSON.stringify({
  openapi: "3.1.0", info: { title: "Automation report", version: "1" }, paths: {},
  components: { schemas: { AutomationReport: reportSchema, ...definitions } },
}).replaceAll("#/$defs/", "#/components/schemas/"));

const outputs = {
  "src/automation/api.d.ts": await openapiTS(new URL("../docs/openapi/observe.v1.json", import.meta.url)),
  "src/automation/report.d.ts": await openapiTS(reportDocument) + '\nexport type AutomationReport = components["schemas"]["AutomationReport"];\n',
};
for (const [path, content] of Object.entries(outputs)) {
  if (process.argv.includes("--check")) {
    if (await readFile(path, "utf8") !== content) throw new Error(`${path} is stale; run pnpm gen:client`);
  } else await writeFile(path, content);
}
console.log("Observe contract types are current.");
