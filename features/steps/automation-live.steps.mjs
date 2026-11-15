/* global process */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { Given, When, Then } from "@cucumber/cucumber";

Given("a live Observe organisation and space are configured for acceptance", function () {
  const org = process.env.OBSERVE_TEST_ORG;
  const space = process.env.OBSERVE_TEST_SPACE;
  assert.ok(org && space, "Set OBSERVE_TEST_ORG and OBSERVE_TEST_SPACE; run the configured local B1 service and Vite preview first.");
  const tenant = `/orgs/${encodeURIComponent(org)}/spaces/${encodeURIComponent(space)}`;
  this.liveObservePath = tenant;
});
When("I open the live Automation view", async function () {
  await this.page.goto(`http://127.0.0.1:4173${this.liveObservePath}/automation`);
  await this.page.getByRole("heading", { name: /^Pending human queue/ }).waitFor();
});
Then("its report and pending counts match the live API and evidence is captured", async function () {
  const prefix = `http://127.0.0.1:4173/v1${this.liveObservePath}`;
  const reportsResponse = await this.context.request.get(`${prefix}/reports?limit=25`);
  const pendingResponse = await this.context.request.get(`${prefix}/pending`);
  assert.equal(reportsResponse.status(), 200);
  assert.equal(pendingResponse.status(), 200);
  const reports = await reportsResponse.json();
  const pending = await pendingResponse.json();
  assert.ok(reports.items.length, "Live acceptance needs at least one valid report.");
  await this.page.getByRole("heading", { name: `Report ${reports.items[0].id}`, exact: true }).waitFor();
  await this.page.getByRole("heading", { name: `Pending human queue (${pending.items.length})`, exact: true }).waitFor();
  assert.equal(await this.page.getByRole("list", { name: "Pending human gates" }).locator(":scope > li").count(), pending.items.length);
  assert.deepEqual(this.pageErrors, []);
  await mkdir("test-results/observe-live", { recursive: true });
  await writeFile("test-results/observe-live/reports.json", JSON.stringify(reports, null, 2));
  await writeFile("test-results/observe-live/pending.json", JSON.stringify(pending, null, 2));
  await this.page.screenshot({ path: "test-results/observe-live/automation-desktop.png", fullPage: true });
  await this.page.setViewportSize({ width: 390, height: 844 });
  await this.page.screenshot({ path: "test-results/observe-live/automation-mobile.png", fullPage: true });
});
