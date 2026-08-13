import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { defaultDataProvider } from "react-admin";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { NavSavvyDataProvider, RunRecord } from "./dataProvider";
import { RunHistory } from "./RunHistory";

const run: RunRecord = {
  id: "run-2",
  workflow: "echo",
  state: "completed",
  policy: { model: "fake:echo" },
  gate_payload: null,
  created_by: { subject: "operator@example.com", issuer: "header", scopes: [] },
  created_at: "2026-08-12T00:00:00Z",
  updated_at: "2026-08-12T00:00:01Z",
};

function provider(): NavSavvyDataProvider {
  return {
    ...defaultDataProvider,
    getWorkflows: vi.fn().mockResolvedValue([{ name: "echo", input_schema: {}, source_kind: "python", checkpointed: false }]),
    getWorkflowSource: vi.fn(),
    getRuns: vi.fn().mockResolvedValue([run]),
    getRun: vi.fn().mockResolvedValue({ run, decisions: [] }),
    getRunLog: vi.fn().mockResolvedValue([
      { run_id: "run-2", seq: 1, workflow: "echo", step: "echo", status: "completed", at: run.updated_at, detail: {} },
    ]),
    decideWorkflow: vi.fn(),
    startWorkflow: vi.fn(),
  };
}

beforeEach(() => window.history.replaceState(null, "", "/?view=history&state=completed&limit=25"));

describe("RunHistory", () => {
  it("restores URL filters and opens runtime-owned detail and log", async () => {
    const dataProvider = provider();
    render(<RunHistory dataProvider={dataProvider} />);

    expect(await screen.findByText("run-2")).toBeVisible();
    expect(dataProvider.getRuns).toHaveBeenCalledWith("echo", "completed", 25);
    fireEvent.click(screen.getByText("run-2"));

    expect(await screen.findByText("Run run-2")).toBeVisible();
    expect(screen.getByText(/^Created by: operator@example.com/)).toBeVisible();
    expect(screen.getByText("1. echo: completed")).toBeVisible();
    await waitFor(() => expect(window.location.search).toContain("run=run-2"));
  });

  it("opens a run row from the keyboard", async () => {
    render(<RunHistory dataProvider={provider()} />);
    const row = await screen.findByLabelText("Open run run-2");
    fireEvent.keyDown(row, { key: "Enter" });
    expect(await screen.findByText("Run run-2")).toBeVisible();
    expect(screen.getByLabelText("Run detail")).toHaveFocus();
  });

  it("renders an opaque gate and refreshes after a generic decision", async () => {
    const waiting = {
      ...run,
      state: "awaiting_decision" as const,
      gate_payload: { proposal: "<script>unsafe()</script>", arbitrary: { value: 3 } },
    };
    const completed = { ...run, state: "completed" as const, gate_payload: null };
    const dataProvider = provider();
    vi.mocked(dataProvider.getRuns).mockResolvedValue([waiting]);
    vi.mocked(dataProvider.getRun)
      .mockResolvedValueOnce({ run: waiting, decisions: [] })
      .mockResolvedValueOnce({ run: completed, decisions: [{
        id: "d1", run_id: "run-2", verdict: "approve", comment: "ship it",
        principal: waiting.created_by, decided_at: run.updated_at,
      }] });
    vi.mocked(dataProvider.decideWorkflow).mockImplementation(async (_workflow, runId, _decision, onEvent) => {
      onEvent?.({ type: "final", run_id: runId, output: { verdict: "approve" }, cached: false });
      return { kind: "stream", launch: { outcome: "completed", runId } };
    });
    render(<RunHistory dataProvider={dataProvider} />);
    fireEvent.click(await screen.findByText("run-2"));

    const payload = await screen.findByLabelText("Gate payload");
    expect(payload).toHaveTextContent("<script>unsafe()</script>");
    expect(payload.querySelector("script")).toBeNull();
    const comment = screen.getByLabelText("Comment");
    expect(comment).toHaveAttribute("maxlength", "4096");
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Verdict" }));
    expect(await screen.findByRole("option", { name: "approve" })).toBeVisible();
    expect(screen.getByRole("option", { name: "reject" })).toBeVisible();
    expect(screen.getByRole("option", { name: "amend" })).toBeVisible();
    fireEvent.click(screen.getByRole("option", { name: "approve" }));
    fireEvent.change(comment, { target: { value: "ship it" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit decision" }));

    await waitFor(() => expect(dataProvider.decideWorkflow).toHaveBeenCalledWith(
      "echo", "run-2", { verdict: "approve", comment: "ship it" }, expect.any(Function),
    ));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Submit decision" })).not.toBeInTheDocument());
    expect(screen.getByText(/approve by operator@example.com/)).toBeVisible();
    // Regression: deciding unmounts the decision panel, so the confirmation has
    // to live above it or the operator gets no feedback at all.
    expect(screen.getByText("Decision accepted; the run completed.")).toBeVisible();
  });

  it("clears the spinner when the runtime registers no workflows", async () => {
    const dataProvider = provider();
    vi.mocked(dataProvider.getWorkflows).mockResolvedValue([]);
    window.history.replaceState(null, "", "/?view=history");
    render(<RunHistory dataProvider={dataProvider} />);

    expect(await screen.findByText("No runs match these filters.")).toBeVisible();
    expect(screen.queryByLabelText("Loading previous runs")).not.toBeInTheDocument();
  });

  it("ignores a slow response for a workflow the operator already left", async () => {
    const dataProvider = provider();
    vi.mocked(dataProvider.getWorkflows).mockResolvedValue([
      { name: "echo", input_schema: {}, source_kind: "python", checkpointed: false },
      { name: "approval", input_schema: {}, source_kind: "python", checkpointed: true },
    ]);
    const stale: RunRecord = { ...run, id: "stale-echo-run" };
    const fresh: RunRecord = { ...run, id: "fresh-approval-run", workflow: "approval" };
    let releaseStale: (runs: RunRecord[]) => void = () => {};
    vi.mocked(dataProvider.getRuns)
      .mockImplementationOnce(() => new Promise<RunRecord[]>((resolve) => { releaseStale = resolve; }))
      .mockResolvedValue([fresh]);
    window.history.replaceState(null, "", "/?view=history&workflow=echo");
    render(<RunHistory dataProvider={dataProvider} />);

    fireEvent.mouseDown(await screen.findByRole("combobox", { name: "Workflow" }));
    fireEvent.click(await screen.findByRole("option", { name: "approval" }));
    expect(await screen.findByText("fresh-approval-run")).toBeVisible();

    releaseStale([stale]); // the abandoned echo request finally lands
    await waitFor(() => expect(screen.getByText("fresh-approval-run")).toBeVisible());
    expect(screen.queryByText("stale-echo-run")).not.toBeInTheDocument();
  });
});
