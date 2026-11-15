import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import fixture from "../../features/fixtures/automation-report.json";
import { AutomationView } from "./AutomationView";
import { PendingQueue } from "./PendingQueue";

vi.mock("./VegaChart", () => ({ VegaChart: () => <div aria-label="Trend chart" /> }));
afterEach(() => vi.unstubAllGlobals());
const pending = [
  { issue: 2, run: "new", title: "New gate", workflow: "publish", reason: "Review image", waiting_since: "2026-11-14T00:00:00Z", age_hours: 24, issue_url: "https://github.com/example/gates/issues/2" },
  { issue: 1, run: "old", title: "Old gate", workflow: "nutrition", reason: "Check evidence", waiting_since: "2026-11-12T00:00:00Z", age_hours: 72, issue_url: "https://github.com/example/gates/issues/1" },
];
const report = { ...fixture, space: "editorial", published: [{ title: null, run: "recipe-run", at: fixture.generated_at, decided_by: "human", url: "https://example.test/recipe" }], judge: { ...fixture.judge, stops: [{ issue: 7, run: "stop-run", workflow: "publish", subject: "Stopped recipe", reasons: ["Missing evidence"] }] } };

function setup(failReport = false) {
  const fetcher = vi.fn(async (request: Request) => {
    const url = new URL(request.url, "http://localhost");
    let body: unknown;
    if (url.pathname.endsWith("/spaces")) body = { items: [{ id: "editorial", source: "vault", latest_report_at: fixture.generated_at }, { id: "other", source: "vault", latest_report_at: null }] };
    else if (url.pathname.endsWith("/pending")) body = { as_of: fixture.generated_at, items: pending };
    else if (url.pathname.endsWith("/trends")) body = { field: url.searchParams.get("field"), items: [{ at: fixture.generated_at, report_id: "latest", value: null }] };
    else if (url.pathname.endsWith("/reports")) body = { items: [{ id: "latest", path: "report.json", window: fixture.window, headline: fixture.headline }], next_cursor: url.searchParams.has("cursor") ? null : "older" };
    else if (failReport) return new Response(JSON.stringify({ error: { code: "invalid_report", message: "Report failed validation" } }), { status: 502, headers: { "Content-Type": "application/json" } });
    else body = report;
    return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetcher);
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AutomationView org="example" space="editorial" /></QueryClientProvider>);
  return fetcher;
}

it("@OBS-001-F1-01 renders a valid report including null titles and additive counters via tenant-scoped GETs", async () => {
  const fetcher = setup();
  expect(await screen.findByRole("link", { name: "recipe-run" })).toHaveAttribute("href", "https://example.test/recipe");
  expect(screen.getByText("Missing evidence")).toBeInTheDocument();
  expect(screen.getByText("Held by backpressure")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Errors" })).toBeInTheDocument();
  expect(screen.getByLabelText("Space")).toHaveValue("editorial");
  await waitFor(() => expect(screen.getAllByLabelText("Trend chart").length).toBeGreaterThan(0));
  for (const [request] of fetcher.mock.calls) {
    expect(new URL(request.url, "http://localhost").pathname).toMatch(/^\/v1\/orgs\/example\/spaces/);
    expect(request.method).toBe("GET");
    expect(request.headers.has("Authorization")).toBe(false);
    expect(request.credentials).toBe("omit");
  }
  fireEvent.click(screen.getByRole("button", { name: "Load older reports" }));
  await waitFor(() => expect(fetcher.mock.calls.some(([r]) => r.url.includes("cursor=older"))).toBe(true));
});

it("@OBS-001-F1-01 shows API validation errors without rendering report data", async () => {
  setup(true);
  expect(await screen.findByText(/Report failed validation/)).toBeInTheDocument();
  expect(screen.queryByText("Stopped recipe")).not.toBeInTheDocument();
  expect(await screen.findByText("Old gate")).toBeInTheDocument();
});

it("@OBS-001-F1-02 shows the complete current queue oldest first with ages, reasons and safe links", () => {
  render(<PendingQueue items={[...pending, { ...pending[0], issue: 3, title: "No safe link", issue_url: "javascript:alert(1)" }]} asOf={fixture.generated_at} />);
  const rows = within(screen.getByRole("list", { name: "Pending human gates" })).getAllByRole("listitem");
  expect(rows[0]).toHaveTextContent("Old gate");
  expect(rows[0]).toHaveTextContent("72 hours");
  expect(rows[0]).toHaveTextContent("nutrition");
  expect(rows[0]).toHaveTextContent("Check evidence");
  expect(within(rows[0]).getByRole("link")).toHaveAttribute("href", pending[1].issue_url);
  expect(screen.queryByRole("link", { name: "No safe link" })).not.toBeInTheDocument();
});
