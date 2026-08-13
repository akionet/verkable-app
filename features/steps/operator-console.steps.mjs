import assert from "node:assert/strict";

import { Given, Then, When } from "@cucumber/cucumber";

const BASE_URL = "http://127.0.0.1:4173";
const YAML = "name: echo\nsteps:\n  - id: echo\n    uses: core.echo\n";

Given("the gateway advertises a YAML-backed echo workflow", async function () {
  this.expectedYaml = YAML;
  await stubDiscovery(this.page, {
    name: "echo",
    input_schema: { type: "object", required: ["text"], properties: { text: { type: "string" } } },
    source_kind: "yaml",
    checkpointed: false,
  });
  await this.page.route("**/workflows/echo/source", (route) =>
    route.fulfill({ status: 200, contentType: "application/yaml", body: YAML }),
  );
  await this.page.route("**/workflows/echo/runs", async (route) => {
    this.submittedBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: 'event: final\ndata: {"type":"final","run_id":"r1","output":{}}\n\n',
    });
  });
  await stubEmptyLog(this.page, "echo", "r1");
});

Given("the gateway advertises a code-defined approval workflow", async function () {
  await stubDiscovery(this.page, {
    name: "approval",
    input_schema: { type: "object" },
    source_kind: "python",
    checkpointed: true,
  });
  await this.page.route("**/workflows/approval/source", (route) =>
    route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "yaml_source_unavailable" }),
    }),
  );
});

Given("the gateway advertises an approval workflow that pauses", async function () {
  await stubDiscovery(this.page, {
    name: "approval",
    input_schema: { type: "object" },
    source_kind: "python",
    checkpointed: true,
  });
  await this.page.route("**/workflows/approval/source", (route) =>
    route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "yaml_source_unavailable" }),
    }),
  );
  await this.page.route("**/workflows/approval/runs", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: 'event: node\ndata: {"type":"node","run_id":"r-pause","node":"gate","status":"started"}\n\n' +
        'event: interrupt\ndata: {"type":"interrupt","run_id":"r-pause","payload":{"proposal":"please approve"}}\n\n',
    }),
  );
  await stubEmptyLog(this.page, "approval", "r-pause");
});

Given("the gateway advertises an echo workflow that fails", async function () {
  await stubDiscovery(this.page, {
    name: "echo",
    input_schema: { type: "object" },
    source_kind: "python",
    checkpointed: false,
  });
  await this.page.route("**/workflows/echo/source", (route) =>
    route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "yaml_source_unavailable" }),
    }),
  );
  await this.page.route("**/workflows/echo/runs", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: 'event: error\ndata: {"type":"error","run_id":"r-fail","error":"provider_error","detail":{"message":"provider failed"}}\n\n',
    }),
  );
  await stubEmptyLog(this.page, "echo", "r-fail");
});

Given("the gateway streams an echo execution with an ordered log", async function () {
  await stubDiscovery(this.page, {
    name: "echo",
    input_schema: { type: "object" },
    source_kind: "python",
    checkpointed: false,
  });
  await this.page.route("**/workflows/echo/source", (route) =>
    route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "yaml_source_unavailable" }),
    }),
  );
  await this.page.route("**/workflows/echo/runs", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body:
        'event: node\ndata: {"type":"node","run_id":"r-live","node":"prepare","status":"started"}\n\n' +
        'event: token\ndata: {"type":"token","run_id":"r-live","text":"hello"}\n\n' +
        'event: node\ndata: {"type":"node","run_id":"r-live","node":"prepare","status":"completed"}\n\n' +
        'event: final\ndata: {"type":"final","run_id":"r-live","output":{"text":"hello"},"cached":false}\n\n',
    }),
  );
  await this.page.route("**/workflows/echo/runs/r-live/log", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ entries: [
        { run_id: "r-live", seq: 1, workflow: "echo", step: "prepare", status: "started", at: "2026-08-12T00:00:00Z", detail: {} },
        { run_id: "r-live", seq: 2, workflow: "echo", step: "prepare", status: "completed", at: "2026-08-12T00:00:01Z", detail: {} },
        { run_id: "r-live", seq: 3, workflow: "echo", step: null, status: "completed", at: "2026-08-12T00:00:02Z", detail: { cached: false } },
      ] }),
    }),
  );
});

Given("the gateway has completed echo run history", async function () {
  this.historyRequests = [];
  await stubDiscovery(this.page, {
    name: "echo", input_schema: { type: "object" }, source_kind: "python", checkpointed: false,
  });
  await this.page.route("**/workflows/echo/runs?*", async (route) => {
    this.historyRequests.push(route.request().url());
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ runs: [{
      id: "run-2", workflow: "echo", state: "completed", policy: { model: "fake:echo" },
      gate_payload: null,
      created_by: { subject: "operator@example.com", scopes: [], issuer: "header" },
      created_at: "2026-08-12T00:00:00Z", updated_at: "2026-08-12T00:00:01Z",
    }] }) });
  });
  await this.page.route("**/workflows/echo/runs/run-2", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({
      run: {
        id: "run-2", workflow: "echo", state: "completed", policy: { model: "fake:echo" },
        gate_payload: null,
        created_by: { subject: "operator@example.com", scopes: [], issuer: "header" },
        created_at: "2026-08-12T00:00:00Z", updated_at: "2026-08-12T00:00:01Z",
      },
      decisions: [{ id: "d1", run_id: "run-2", verdict: "approve", comment: "looks good",
        principal: { subject: "reviewer@example.com", scopes: [], issuer: "header" },
        decided_at: "2026-08-12T00:00:00Z" }],
    }),
  }));
  await this.page.route("**/workflows/echo/runs/run-2/log", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ entries: [
      { run_id: "run-2", seq: 1, workflow: "echo", step: "echo", status: "started", at: "2026-08-12T00:00:00Z", detail: {} },
      { run_id: "run-2", seq: 2, workflow: "echo", step: "echo", status: "completed", at: "2026-08-12T00:00:01Z", detail: {} },
    ] }),
  }));
});

Given("the gateway has an approval run awaiting a decision", async function () {
  this.approvalDecided = false;
  const run = () => ({
    id: "approval-1", workflow: "approval",
    state: this.approvalDecided ? "completed" : "awaiting_decision",
    policy: { model: "fake:echo" },
    gate_payload: this.approvalDecided ? null : { proposal: "<b>opaque proposal</b>", score: 7 },
    created_by: { subject: "starter@example.com", scopes: [], issuer: "header" },
    created_at: "2026-08-12T00:00:00Z", updated_at: "2026-08-12T00:00:01Z",
  });
  await stubDiscovery(this.page, {
    name: "approval", input_schema: { type: "object" }, source_kind: "python", checkpointed: true,
  });
  await this.page.route("**/workflows/approval/source", (route) => route.fulfill({
    status: 404, contentType: "application/json", body: JSON.stringify({ error: "yaml_source_unavailable" }),
  }));
  await this.page.route("**/workflows/approval/runs", (route) => route.fulfill({
    status: 200, contentType: "text/event-stream",
    body: 'event: interrupt\ndata: {"type":"interrupt","run_id":"approval-1","payload":{"proposal":"<b>opaque proposal</b>","score":7}}\n\n',
  }));
  await this.page.route("**/workflows/approval/runs?*", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ runs: [run()] }),
  }));
  await this.page.route("**/workflows/approval/runs/approval-1", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({
      run: run(), decisions: this.approvalDecided ? [{
        id: "d1", run_id: "approval-1", verdict: "approve", comment: "ship it",
        principal: { subject: "reviewer@example.com", scopes: [], issuer: "header" },
        decided_at: "2026-08-12T00:00:02Z",
      }] : [],
    }),
  }));
  await this.page.route("**/workflows/approval/runs/approval-1/log", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ entries: [
      { run_id: "approval-1", seq: 1, workflow: "approval", step: "gate", status: "started", at: "2026-08-12T00:00:00Z", detail: {} },
      { run_id: "approval-1", seq: 2, workflow: "approval", step: null, status: "awaiting_decision", at: "2026-08-12T00:00:01Z", detail: {} },
      ...(this.approvalDecided ? [
        { run_id: "approval-1", seq: 3, workflow: "approval", step: "gate", status: "completed", at: "2026-08-12T00:00:02Z", detail: {} },
        { run_id: "approval-1", seq: 4, workflow: "approval", step: null, status: "completed", at: "2026-08-12T00:00:03Z", detail: {} },
      ] : []),
    ] }),
  }));
  await this.page.route("**/workflows/approval/runs/approval-1/decisions", async (route) => {
    this.decisionBody = route.request().postDataJSON();
    this.approvalDecided = true;
    await route.fulfill({ status: 200, contentType: "text/event-stream", body:
      'event: node\ndata: {"type":"node","run_id":"approval-1","node":"gate","status":"completed"}\n\n' +
      'event: final\ndata: {"type":"final","run_id":"approval-1","output":{"verdict":"approve"},"cached":false}\n\n',
    });
  });
});

When("I open the operator console", async function () {
  await this.page.goto(BASE_URL);
  try {
    await this.page.getByRole("combobox", { name: "Workflow" }).waitFor({ timeout: 10_000 });
  } catch (error) {
    const body = await this.page.locator("body").innerText();
    throw new Error(`console did not load: ${this.pageErrors.join(" | ")}\n${body}`, {
      cause: error,
    });
  }
});

When("I open previous runs and filter completed runs", async function () {
  await this.page.goto(BASE_URL);
  await this.page.getByRole("button", { name: "Previous runs" }).click();
  const state = this.page.getByRole("combobox", { name: "State" });
  await state.click();
  await this.page.getByRole("option", { name: "completed" }).click();
  await this.page.getByText("run-2").waitFor();
});

When("I reload the previous runs page", async function () {
  await this.page.reload();
  await this.page.getByText("run-2").waitFor();
});

When("I open the newest previous run", async function () {
  await this.page.getByText("run-2").click();
});

When("I start and open the paused approval run", async function () {
  await this.page.goto(BASE_URL);
  await this.page.getByRole("combobox", { name: "Workflow" }).waitFor();
  await this.page.getByRole("button", { name: "Run", exact: true }).click();
  await this.page.getByText("Run of approval paused").waitFor();
  await this.page.getByRole("button", { name: "Previous runs" }).click();
  await this.page.getByText("approval-1").click();
  await this.page.getByLabel("Gate payload").getByText(/opaque proposal/).waitFor();
});

When("I approve it with comment {string}", async function (comment) {
  await this.page.getByLabel("Comment").fill(comment);
  await this.page.getByRole("button", { name: "Submit decision" }).click();
});

When("I submit input text {string}", async function (text) {
  await this.page.getByRole("textbox", { name: "Input JSON" }).fill(JSON.stringify({ text }));
  await this.page.getByRole("button", { name: "Run", exact: true }).click();
});

When("I open the raw YAML tab", async function () {
  await this.page.getByRole("tab", { name: "Raw YAML" }).click();
});

When("I start the selected workflow", async function () {
  await this.page.getByRole("button", { name: "Run", exact: true }).click();
});

Then("the echo workflow is started with that JSON", function () {
  assert.deepEqual(this.submittedBody, { text: "from-bdd" });
});

Then("the console reports that the run completed", async function () {
  await this.page.getByText("Run of echo completed").waitFor();
});

Then("the console reports that the run paused", async function () {
  await this.page.getByText("Run of approval paused").waitFor();
});

Then("the console reports that the run failed", async function () {
  await this.page.getByText("Run of echo failed").waitFor();
});

Then("the console does not report that the run completed", async function () {
  assert.equal(await this.page.getByText(/Run of .* completed/).count(), 0);
});

Then("I see the node transitions and final output in order", async function () {
  await this.page.getByText("Run of echo completed").waitFor();
  const timeline = this.page.getByTestId("node-timeline");
  assert.deepEqual(await timeline.locator("li").allTextContents(), [
    "prepare: started",
    "prepare: completed",
  ]);
  await this.page.getByLabel("Final output").getByText(/hello/).waitFor();
});

Then("I can inspect the matching raw execution log", async function () {
  await this.page.getByRole("tab", { name: "Raw log" }).click();
  const raw = this.page.getByTestId("raw-run-log");
  await raw.getByText(/r-live/).waitFor();
  assert.match(await raw.textContent(), /"seq": 3/);
});

Then("I see the exact registered YAML read-only", async function () {
  const source = this.page.getByTestId("workflow-source");
  assert.equal(await source.textContent(), this.expectedYaml);
  assert.equal(await source.evaluate((element) => element.tagName), "PRE");
  assert.equal(await source.getAttribute("contenteditable"), null);
});

Then("I see that no YAML source is available", async function () {
  await this.page
    .getByText("No YAML source is available for this code-defined workflow.")
    .waitFor();
});

Then("the history filters survive the reload", async function () {
  assert.match(this.page.url(), /view=history/);
  assert.match(this.page.url(), /state=completed/);
  assert.ok(this.historyRequests.filter((url) => url.includes("state=completed")).length >= 2);
});

Then("I see runtime metadata decisions and the ordered persisted log", async function () {
  await this.page.getByText("Run run-2").waitFor();
  await this.page.getByText(/Created by: operator@example.com/).waitFor();
  await this.page.getByText(/approve by reviewer@example.com/).waitFor();
  assert.deepEqual(
    await this.page.getByRole("list", { name: "Persisted run timeline" }).locator("li").allTextContents(),
    ["1. echo: started", "2. echo: completed"],
  );
});

Then("the same run completes after the decision", async function () {
  assert.deepEqual(this.decisionBody, { verdict: "approve", comment: "ship it" });
  await this.page.getByText("Run approval-1: completed").waitFor();
  assert.equal(await this.page.getByRole("button", { name: "Submit decision" }).count(), 0);
});

Then("the refreshed audit and continued log are visible", async function () {
  await this.page.getByText(/approve by reviewer@example.com/).waitFor();
  assert.deepEqual(
    await this.page.getByRole("list", { name: "Persisted run timeline" }).locator("li").allTextContents(),
    ["1. gate: started", "2. awaiting_decision", "3. gate: completed", "4. completed"],
  );
});

async function stubDiscovery(page, workflow) {
  await page.route("**/workflows", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ workflows: [workflow] }),
    }),
  );
}

async function stubEmptyLog(page, workflow, runId) {
  await page.route(`**/workflows/${workflow}/runs/${runId}/log`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ entries: [] }),
    }),
  );
}
