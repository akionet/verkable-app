import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { URL } from "node:url";
import { Given, When, Then } from "@cucumber/cucumber";

Given("Observe serves a valid report for an alternative tenant", async function () {
  const fixture = JSON.parse(await readFile(new URL("../fixtures/automation-report.json", import.meta.url), "utf8"));
  this.observeRequests = [];
  const report = { ...fixture, space: "editorial", published: [{ title: "Published recipe", run: "recipe", at: fixture.generated_at, decided_by: "human", url: "https://example.test/recipes/published" }], judge: { ...fixture.judge, stop: 1, stops: [{ issue: 7, run: "stop", workflow: "publish", subject: "Stopped recipe", reasons: ["Missing evidence"] }] } };
  await this.page.route("**/v1/**", async route => {
    const request = route.request();
    this.observeRequests.push({ url: request.url(), method: request.method(), headers: request.headers() });
    const url = new URL(request.url());
    let body;
    if (url.pathname.endsWith("/spaces")) body = { items: [{ id: "editorial", source: "vault", latest_report_at: fixture.generated_at }] };
    else if (url.pathname.endsWith("/pending")) body = { as_of: fixture.generated_at, items: [
      { issue: 2, run: "new", title: "New gate", workflow: "publish", reason: "Review image", waiting_since: "2026-11-14T00:00:00Z", age_hours: 24, issue_url: "https://github.com/example/gates/issues/2" },
      { issue: 1, run: "old", title: "Old gate", workflow: "nutrition", reason: "Check evidence", waiting_since: "2026-11-12T00:00:00Z", age_hours: 72, issue_url: "https://github.com/example/gates/issues/1" },
    ] };
    else if (url.pathname.endsWith("/trends")) body = { field: url.searchParams.get("field"), items: [{ at: fixture.window.from, report_id: "previous", value: 1 }, { at: fixture.generated_at, report_id: "latest", value: 3 }] };
    else if (url.pathname.endsWith("/reports")) body = { items: [{ id: "2026-11-15T0012Z", path: "report.json", window: fixture.window, headline: fixture.headline }], next_cursor: null };
    else body = report;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
});
When("I open that tenant's Automation view", async function () {
  await this.page.goto("http://127.0.0.1:4173/orgs/example/spaces/editorial/automation");
  await this.page.getByRole("link", { name: "Published recipe" }).waitFor();
});
Then("I see the report timeline, published recipes, judge stops and errors", async function () {
  for (const name of ["Report timeline", "Published recipes", "Judge stops", "Errors"]) await this.page.getByRole("heading", { level: 2, name, exact: true }).waitFor();
  await this.page.getByText("Missing evidence").waitFor();
  assert.equal(await this.page.getByRole("link", { name: "Published recipe" }).getAttribute("href"), "https://example.test/recipes/published");
  assert.deepEqual(this.pageErrors, []);
});
Then("the headline trends are drawn with Vega-Lite", async function () {
  await this.page.locator('[aria-label="Trend chart"] svg').first().waitFor();
});
Then("Observe requests are same-origin GETs without credentials", async function () {
  assert.ok(this.observeRequests.length > 4);
  for (const request of this.observeRequests) {
    assert.equal(new URL(request.url).origin, "http://127.0.0.1:4173");
    assert.match(new URL(request.url).pathname, /^\/v1\/orgs\/example\/spaces/);
    assert.equal(request.method, "GET");
    assert.equal(request.headers.authorization, undefined);
    assert.equal(request.headers.cookie, undefined);
  }
  assert.equal(await this.page.getByRole("button", { name: /approve|reject|revise/i }).count(), 0);
});
Then("the current pending queue shows oldest first with age workflow reason and issue links", async function () {
  const items = this.page.getByRole("list", { name: "Pending human gates" }).locator(":scope > li");
  await items.first().waitFor();
  assert.equal(await items.count(), 2);
  const oldest = await items.first().innerText();
  for (const text of ["Old gate", "72 hours", "nutrition", "Check evidence"]) assert.ok(oldest.includes(text));
  assert.equal(await items.first().getByRole("link").getAttribute("href"), "https://github.com/example/gates/issues/1");
});
