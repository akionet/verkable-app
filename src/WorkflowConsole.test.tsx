import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { defaultDataProvider } from "react-admin";
import { describe, expect, it, vi } from "vitest";

import type { NavSavvyDataProvider } from "./dataProvider";
import { WorkflowConsole } from "./WorkflowConsole";

const yaml = "name: echo\nsteps:\n  - id: echo\n";

function provider(overrides: Partial<NavSavvyDataProvider> = {}): NavSavvyDataProvider {
  return {
    ...defaultDataProvider,
    getWorkflows: vi.fn().mockResolvedValue([
      {
        name: "echo",
        input_schema: { type: "object", required: ["text"] },
        source_kind: "yaml",
        checkpointed: false,
      },
      {
        name: "approval",
        input_schema: { type: "object" },
        source_kind: "python",
        checkpointed: true,
      },
    ]),
    getWorkflowSource: vi.fn().mockImplementation((name: string) =>
      Promise.resolve(name === "echo" ? yaml : null),
    ),
    getRuns: vi.fn().mockResolvedValue([]),
    getRun: vi.fn(),
    decideWorkflow: vi.fn(),
    getRunLog: vi.fn().mockResolvedValue([
      {
        run_id: "r1", seq: 1, workflow: "echo", step: "echo", status: "completed",
        at: "2026-08-12T00:00:00Z", detail: {},
      },
    ]),
    startWorkflow: vi.fn().mockResolvedValue({
      outcome: "completed",
      runId: "r1",
    }),
    ...overrides,
  };
}

describe("WorkflowConsole", () => {
  it("shows exact YAML and an explicit code-defined state", async () => {
    render(<WorkflowConsole dataProvider={provider()} />);
    await screen.findByRole("combobox", { name: "Workflow" });

    fireEvent.click(screen.getByRole("tab", { name: "Raw YAML" }));
    expect((await screen.findByTestId("workflow-source")).textContent).toBe(yaml);

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Workflow" }));
    fireEvent.click(await screen.findByRole("option", { name: "approval" }));
    expect(
      await screen.findByText("No YAML source is available for this code-defined workflow."),
    ).toBeVisible();
  });

  it("blocks malformed input and submits parsed JSON", async () => {
    const dataProvider = provider();
    render(<WorkflowConsole dataProvider={dataProvider} />);
    await screen.findByRole("combobox", { name: "Workflow" });
    const editor = screen.getByRole("textbox", { name: "Input JSON" });
    const run = screen.getByRole("button", { name: "Run" });

    fireEvent.change(editor, { target: { value: "{" } });
    expect(run).toBeDisabled();
    fireEvent.change(editor, { target: { value: '{"text":"from-test"}' } });
    fireEvent.click(run);

    await waitFor(() =>
      expect(dataProvider.startWorkflow).toHaveBeenCalledWith(
        "echo",
        { text: "from-test" },
        expect.any(Function),
      ),
    );
    expect(await screen.findByText("Run of echo completed")).toBeVisible();
  });

  it("disables Run in flight and reports a paused run honestly", async () => {
    let finish: ((value: { outcome: "paused"; runId: string }) => void) | undefined;
    const startWorkflow = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    render(<WorkflowConsole dataProvider={provider({ startWorkflow })} />);
    await screen.findByRole("combobox", { name: "Workflow" });

    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    expect(screen.getByRole("button", { name: /^Running/ })).toBeDisabled();
    finish?.({ outcome: "paused", runId: "r1" });

    expect(await screen.findByText("Run of echo paused")).toBeVisible();
    expect(screen.queryByText("Run of echo completed")).not.toBeInTheDocument();
  });

  it("reports an SSE error outcome as failed", async () => {
    const dataProvider = provider({
      startWorkflow: vi.fn().mockResolvedValue({ outcome: "failed", runId: "r1" }),
    });
    render(<WorkflowConsole dataProvider={dataProvider} />);
    await screen.findByRole("combobox", { name: "Workflow" });
    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    expect(await screen.findByText("Run of echo failed")).toBeVisible();
    expect(screen.queryByText("Run of echo completed")).not.toBeInTheDocument();
  });

  it("renders live events and the raw persisted log", async () => {
    const dataProvider = provider({
      startWorkflow: vi.fn().mockImplementation(async (_name, _input, onEvent) => {
        onEvent?.({ type: "node", run_id: "r1", node: "echo", status: "started" });
        onEvent?.({ type: "token", run_id: "r1", text: "hello" });
        onEvent?.({ type: "node", run_id: "r1", node: "echo", status: "completed" });
        onEvent?.({ type: "final", run_id: "r1", output: { text: "hello" }, cached: false });
        return { outcome: "completed", runId: "r1" };
      }),
    });
    render(<WorkflowConsole dataProvider={dataProvider} />);
    await screen.findByRole("combobox", { name: "Workflow" });
    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    expect(await screen.findByText("echo: started")).toBeVisible();
    expect(screen.getByText("echo: completed")).toBeVisible();
    expect(screen.getByLabelText("Streamed output")).toHaveTextContent("hello");
    fireEvent.click(screen.getByRole("tab", { name: "Raw log" }));
    expect(await screen.findByTestId("raw-run-log")).toHaveTextContent('"seq": 1');
  });

  it("refetches authoritative state after a stream ends without a terminal event", async () => {
    const getRun = vi.fn().mockResolvedValue({
      run: {
        id: "r1",
        workflow: "echo",
        state: "completed",
        policy: {},
        gate_payload: null,
        created_by: { subject: "operator", scopes: [], issuer: "test" },
        created_at: "2026-08-13T00:00:00Z",
        updated_at: "2026-08-13T00:00:01Z",
      },
      decisions: [],
    });
    const dataProvider = provider({
      getRun,
      startWorkflow: vi.fn().mockImplementation(async (_name, _input, onEvent) => {
        onEvent?.({ type: "node", run_id: "r1", node: "echo", status: "started" });
        return { outcome: "started", runId: "r1" };
      }),
    });

    render(<WorkflowConsole dataProvider={dataProvider} />);
    await screen.findByRole("combobox", { name: "Workflow" });
    fireEvent.click(screen.getByRole("button", { name: "Run" }));

    expect(await screen.findByText(/state was refreshed from the runtime/i)).toBeVisible();
    expect(screen.getByText("completed")).toBeVisible();
    expect(getRun).toHaveBeenCalledWith("echo", "r1");
  });
});
