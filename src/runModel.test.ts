import { describe, expect, it } from "vitest";

import { decodeRuntimeEvent, emptyLiveRun, reduceRun } from "./runModel";

describe("run event model", () => {
  it("reduces ordered nodes and transient tokens to a final run", () => {
    let run = emptyLiveRun();
    run = reduceRun(run, { type: "node", run_id: "r1", node: "a", status: "started" });
    run = reduceRun(run, { type: "token", run_id: "r1", text: "hé" });
    run = reduceRun(run, { type: "node", run_id: "r1", node: "a", status: "completed" });
    run = reduceRun(run, { type: "final", run_id: "r1", output: { ok: true }, cached: false });
    expect(run).toMatchObject({ status: "completed", runId: "r1", tokens: "hé" });
    expect(run.timeline.map(({ status }) => status)).toEqual(["started", "completed"]);
  });

  it("rejects malformed/mismatched events and safely surfaces unknown events", () => {
    expect(() => decodeRuntimeEvent("final", "{")).toThrow("Malformed");
    expect(() => decodeRuntimeEvent("final", '{"type":"error"}')).toThrow("Invalid");
    const event = decodeRuntimeEvent("future", '{"type":"future","run_id":"r1"}');
    expect(event).toMatchObject({ type: "compatibility", run_id: "r1", event: "future" });
    expect(reduceRun(emptyLiveRun(), event)).toMatchObject({ status: "idle", warnings: [expect.stringContaining("future")] });
  });

  it("bounds transient tokens and marks truncation", () => {
    const run = reduceRun(emptyLiveRun(), {
      type: "token", run_id: "r1", text: "x".repeat(100_001),
    });
    expect(run.tokens).toHaveLength(100_000);
    expect(run.tokensTruncated).toBe(true);
  });
});
