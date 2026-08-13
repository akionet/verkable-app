/* global fetch, process, setTimeout */
import { spawn, spawnSync } from "node:child_process";
import { resolve } from "node:path";

const webRoot = resolve(import.meta.dirname, "..");
const coreRoot = resolve(process.env.NAVIGATOR_CORE_PATH ?? "../navigator-orchestrator-api");
const isWindows = process.platform === "win32";
const children = [];

function start(command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    env: process.env,
    stdio: "inherit",
    shell: isWindows && command.endsWith(".cmd"),
  });
  children.push(child);
  return child;
}

async function waitFor(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch { /* process is still starting */ }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function stopAll() {
  for (const child of children.reverse()) {
    if (child.killed || child.exitCode !== null) continue;
    if (isWindows) {
      spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
      });
    } else {
      child.kill("SIGTERM");
    }
  }
}

process.on("SIGINT", () => { stopAll(); process.exit(130); });
process.on("SIGTERM", () => { stopAll(); process.exit(143); });

try {
  start(isWindows ? "uv.exe" : "uv", [
    "run", "--extra", "server", "uvicorn", "--app-dir", "tests/support", "operator_console_app:app",
    "--host", "127.0.0.1", "--port", "8000",
  ], coreRoot);
  await waitFor("http://127.0.0.1:8000/healthz");
  start(isWindows ? "pnpm.cmd" : "pnpm", [
    "exec", "vite", "preview", "--host", "127.0.0.1", "--port", "4174",
  ], webRoot);
  await waitFor("http://127.0.0.1:4174");

  const cucumber = start(isWindows ? "pnpm.cmd" : "pnpm", [
    "exec", "cucumber-js", "--config", "cucumber.mjs", "--tags", "@F-WFB-R2-06",
  ], webRoot);
  const code = await new Promise((resolveExit) => cucumber.on("exit", resolveExit));
  if (code) process.exitCode = Number(code);
} finally {
  stopAll();
}
