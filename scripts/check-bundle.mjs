/* global console */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const forbidden = [
  /localhost:8000/i,
  /127\.0\.0\.1:8000/,
  /AWS_SECRET_ACCESS_KEY/,
  /GOOGLE_APPLICATION_CREDENTIALS/,
  /LANGFUSE_SECRET_KEY/,
  /NAVIGATOR_[A-Z_]*(?:SECRET|TOKEN|PASSWORD)/,
  /VITE_[A-Z_]*(?:SECRET|TOKEN|PASSWORD)/,
  /navigator_orchestrator\.(?:sdk|cli)/,
  /\b(?:record|cuisine)\b/i,
];

const files = await readdir("dist/assets");
const assets = files.filter((file) => /\.(?:js|css)$/.test(file));
if (!assets.length) throw new Error("No built browser assets found; run pnpm build first");

const violations = [];
for (const file of assets) {
  const content = await readFile(join("dist/assets", file), "utf8");
  for (const pattern of forbidden) {
    if (pattern.test(content)) violations.push(`${file}: ${pattern}`);
  }
}
if (violations.length) {
  throw new Error(`Browser bundle contains server-only or secret-bearing material:\n${violations.join("\n")}`);
}
console.log(`Bundle guard passed (${assets.length} assets scanned).`);
