import assert from "node:assert/strict";

import { Given, Then, When } from "@cucumber/cucumber";

const DELIVERY_URL = "http://127.0.0.1:4174";

Given("the hermetic runtime is available through the console origin", async function () {
  const response = await this.page.request.get(`${DELIVERY_URL}/workflows`);
  assert.equal(response.status(), 200);
  assert.deepEqual((await response.json()).workflows.map((workflow) => workflow.name), ["approval", "echo"]);
});

When("I run the YAML-backed echo workflow and reload its history", async function () {
  await this.page.goto(DELIVERY_URL);
  await selectOption(this.page, "Workflow", "echo");
  await this.page.getByRole("tab", { name: "Raw YAML" }).click();
  await this.page.getByTestId("workflow-source").getByText(/uses: core.echo/).waitFor();
  await this.page.getByRole("textbox", { name: "Input JSON" }).fill('{"text":"real-http-demo"}');
  await this.page.getByRole("button", { name: "Run", exact: true }).click();
  await this.page.getByText("Run of echo completed").waitFor();

  await this.page.getByRole("button", { name: "Previous runs" }).click();
  await selectOption(this.page, "Workflow", "echo");
  await this.page.reload();
  const completedRow = this.page.getByRole("row").filter({ hasText: "completed" }).last();
  this.echoRunId = (await completedRow.getByRole("cell").first().textContent()).trim();
  await completedRow.click();
  await this.page.getByText(`Run ${this.echoRunId}`).waitFor();
  await this.page.getByRole("tab", { name: "Raw log" }).click();
  await this.page.getByLabel("Raw persisted run log").getByText(/"seq":/).waitFor();
});

When("I approve a real paused approval run", async function () {
  await this.page.getByRole("button", { name: "Run workflow" }).click();
  await selectOption(this.page, "Workflow", "approval");
  await this.page.getByRole("textbox", { name: "Input JSON" }).fill('{"text":"approve-real-http"}');
  await this.page.getByRole("button", { name: "Run", exact: true }).click();
  await this.page.getByText("Run of approval paused").waitFor();
  await this.page.getByRole("button", { name: "Previous runs" }).click();
  await selectOption(this.page, "Workflow", "approval");
  const waitingRow = this.page.getByRole("row").filter({ hasText: "awaiting_decision" }).last();
  this.approvalRunId = (await waitingRow.getByRole("cell").first().textContent()).trim();
  await waitingRow.click();
  await this.page.getByLabel("Gate payload").getByText(/approve-real-http/).waitFor();
  await this.page.getByLabel("Comment").fill("approved in real HTTP demo");
  await this.page.getByRole("button", { name: "Submit decision" }).click();
});

Then("the same-origin demo shows the completed decision and continued log", async function () {
  await this.page.getByText("Decision accepted; the run completed.").waitFor();
  await this.page.getByText(/approve by anonymous/).waitFor();
  await this.page.getByText(`Run ${this.approvalRunId}: completed`).waitFor();
  const timeline = this.page.getByRole("list", { name: "Persisted run timeline" });
  const entries = await timeline.locator("li").allTextContents();
  assert.ok(entries.some((entry) => entry.includes("awaiting_decision")));
  assert.match(entries.at(-1), /completed/);
});

async function selectOption(page, label, option) {
  const select = page.getByRole("combobox", { name: label });
  await select.click();
  await page.getByRole("option", { name: option }).click();
}
