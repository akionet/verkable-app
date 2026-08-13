export type RuntimeEvent =
  | { type: "node"; run_id: string; node: string; status: "started" | "completed" }
  | { type: "token"; run_id: string; text: string }
  | { type: "interrupt"; run_id: string; payload: Record<string, unknown> }
  | { type: "error"; run_id: string; error: string; detail: Record<string, unknown> }
  | { type: "final"; run_id: string; output: Record<string, unknown>; cached: boolean }
  | { type: "compatibility"; run_id: string; event: string; message: string };

export const MAX_TRANSIENT_CHARS = 100_000;

export interface TimelineEvent {
  node: string;
  status: "started" | "completed";
}

export type LiveStatus = "idle" | "running" | "paused" | "failed" | "completed" | "disconnected";

export interface LiveRun {
  runId?: string;
  status: LiveStatus;
  timeline: TimelineEvent[];
  tokens: string;
  interrupt?: Record<string, unknown>;
  error?: { error: string; detail: Record<string, unknown> };
  output?: Record<string, unknown>;
  warnings: string[];
  tokensTruncated?: boolean;
}

export const emptyLiveRun = (): LiveRun => ({ status: "idle", timeline: [], tokens: "", warnings: [] });

export function reduceRun(run: LiveRun, event: RuntimeEvent): LiveRun {
  const base = { ...run, runId: event.run_id };
  switch (event.type) {
    case "node":
      return { ...base, status: "running", timeline: [...run.timeline, event] };
    case "token":
      return {
        ...base,
        status: "running",
        tokens: (run.tokens + event.text).slice(0, MAX_TRANSIENT_CHARS),
        tokensTruncated: run.tokensTruncated || run.tokens.length + event.text.length > MAX_TRANSIENT_CHARS,
      };
    case "interrupt":
      return { ...base, status: "paused", interrupt: event.payload };
    case "error":
      return { ...base, status: "failed", error: { error: event.error, detail: event.detail } };
    case "final":
      return { ...base, status: "completed", output: event.output };
    case "compatibility":
      return { ...base, warnings: [...run.warnings, event.message] };
  }
}

export function decodeRuntimeEvent(eventName: string, data: string): RuntimeEvent {
  let value: unknown;
  try {
    value = JSON.parse(data);
  } catch {
    throw new Error(`Malformed ${eventName} SSE event`);
  }
  if (!value || typeof value !== "object") {
    throw new Error(`Invalid ${eventName} SSE event`);
  }
  if (!["node", "token", "interrupt", "error", "final"].includes(eventName)) {
    const runId = "run_id" in value && typeof value.run_id === "string" ? value.run_id : "unknown";
    return {
      type: "compatibility",
      run_id: runId,
      event: eventName,
      message: `Runtime sent unsupported event '${eventName}'; it was ignored.`,
    };
  }
  if (!("type" in value) || value.type !== eventName) {
    throw new Error(`Invalid ${eventName} SSE event`);
  }
  return value as RuntimeEvent;
}
