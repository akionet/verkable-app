import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, createDataProvider } from "./dataProvider";

afterEach(() => vi.unstubAllGlobals());

describe("createDataProvider", () => {
  it("uses the configured base URL and coalesces duplicate discovery requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        workflows: [
          {
            name: "echo",
            input_schema: { type: "object", required: ["text"] },
            source_kind: "python",
            checkpointed: false,
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = createDataProvider("http://runtime.example/api/");

    const [first, second] = await Promise.all([provider.getWorkflows(), provider.getWorkflows()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("http://runtime.example/api/workflows");
    expect(second).toEqual(first);
  });

  it("maps only yaml_source_unavailable to a null source", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ error: "yaml_source_unavailable" }, { status: 404 }),
      )
      .mockResolvedValueOnce(Response.json({ error: "unknown_workflow" }, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = createDataProvider("");

    await expect(provider.getWorkflowSource("echo")).resolves.toBeNull();
    const error = await provider.getWorkflowSource("missing").catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 404,
      body: { error: "unknown_workflow" },
    });
  });

  it("requests filtered history and workflow-scoped detail", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ runs: [{ id: "run/2" }] }))
      .mockResolvedValueOnce(Response.json({ run: { id: "run/2" }, decisions: [] }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = createDataProvider("/api");

    await provider.getRuns("review flow", "completed", 25);
    await provider.getRun("review flow", "run/2");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/workflows/review%20flow/runs?limit=25&state=completed",
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/workflows/review%20flow/runs/run%2F2",
    );
  });

  it.each([
    ["final", "completed"],
    ["interrupt", "paused"],
    ["error", "failed"],
    ["node", "started"],
  ] as const)("maps an SSE %s event to %s", async (event, outcome) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(`event: ${event}\r\ndata: {"type":"${event}"}\r\n\r\n`, {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        }),
      ),
    );

    await expect(createDataProvider("/api").startWorkflow("echo", { text: "hi" })).resolves
      .toMatchObject({ outcome });
  });

  it("surfaces an unknown event without losing the last attributable run", async () => {
    const onEvent = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      'event: node\ndata: {"type":"node","run_id":"r1","node":"echo","status":"started"}\n\n'
      + 'event: future\ndata: {"payload":true}\n\n',
      { status: 200, headers: { "content-type": "text/event-stream" } },
    )));

    await expect(createDataProvider("").startWorkflow("echo", {}, onEvent)).resolves
      .toEqual({ outcome: "started", runId: "r1" });
    expect(onEvent).toHaveBeenLastCalledWith(expect.objectContaining({
      type: "compatibility",
      event: "future",
    }));
  });

  it("branches decision responses by content type", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(
        'event: final\ndata: {"type":"final","run_id":"r1","output":{},"cached":false}\n\n',
        { status: 200, headers: { "content-type": "text/event-stream" } },
      ))
      .mockResolvedValueOnce(Response.json({ status: "already_decided", decision: { id: "d1" } }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = createDataProvider("/api");

    await expect(provider.decideWorkflow("approval", "r1", { verdict: "approve" })).resolves
      .toEqual({ kind: "stream", launch: { outcome: "completed", runId: "r1" } });
    await expect(provider.decideWorkflow("approval", "r1", { verdict: "approve" })).resolves
      .toMatchObject({ kind: "already_decided", decision: { id: "d1" } });
  });

  it("preserves a structured decision conflict", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(
      { error: "run_conflict", state: "completed", detail: "already moved" },
      { status: 409 },
    )));

    const error = await createDataProvider("").decideWorkflow(
      "approval", "r1", { verdict: "reject" },
    ).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, body: { error: "run_conflict", state: "completed" } });
  });
});
