import { defaultDataProvider, type DataProvider } from "react-admin";

import { decodeRuntimeEvent, type RuntimeEvent } from "./runModel";
import { readSse } from "./sse";

export type SourceKind = "yaml" | "python";

export interface WorkflowSummary {
  name: string;
  input_schema: Record<string, unknown>;
  source_kind: SourceKind;
  checkpointed: boolean;
}

export interface WorkflowListResponse {
  workflows: WorkflowSummary[];
}

export type RunOutcome = "completed" | "paused" | "failed" | "started";

export interface RunLaunch {
  outcome: RunOutcome;
  runId?: string;
}

export interface RunLogEntry {
  run_id: string;
  seq: number;
  workflow: string;
  step: string | null;
  status: string;
  at: string;
  detail: Record<string, unknown>;
}

export type RunState = "running" | "awaiting_decision" | "completed" | "failed" | "cancelled";

export interface PrincipalRecord {
  subject: string;
  scopes: string[];
  issuer: string;
}

export interface RunRecord {
  id: string;
  workflow: string;
  state: RunState;
  policy: Record<string, unknown>;
  gate_payload: Record<string, unknown> | null;
  created_by: PrincipalRecord;
  created_at: string;
  updated_at: string;
}

export type Verdict = "approve" | "reject" | "amend";

export interface DecisionRecord {
  id: string;
  run_id: string;
  verdict: Verdict;
  principal: PrincipalRecord;
  comment: string | null;
  decided_at: string;
}

export interface RunDetail {
  run: RunRecord;
  decisions: DecisionRecord[];
}

export interface DecisionInput {
  verdict: Verdict;
  comment?: string;
}

export type DecisionResult =
  | { kind: "stream"; launch: RunLaunch }
  | { kind: "already_decided"; decision: DecisionRecord };

export interface NavSavvyDataProvider extends DataProvider {
  getWorkflows(): Promise<WorkflowSummary[]>;
  getWorkflowSource(name: string): Promise<string | null>;
  getRuns(name: string, state?: RunState, limit?: number): Promise<RunRecord[]>;
  getRun(name: string, runId: string): Promise<RunDetail>;
  decideWorkflow(
    name: string,
    runId: string,
    decision: DecisionInput,
    onEvent?: (event: RuntimeEvent) => void,
  ): Promise<DecisionResult>;
  getRunLog(name: string, runId: string): Promise<RunLogEntry[]>;
  startWorkflow(
    name: string,
    input: unknown,
    onEvent?: (event: RuntimeEvent) => void,
  ): Promise<RunLaunch>;
}

export interface ApiErrorBody {
  error?: string;
  detail?: unknown;
  state?: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
  ) {
    super(typeof body.detail === "string" ? body.detail : body.error ?? `HTTP ${status}`);
  }
}

async function checked(response: Response): Promise<Response> {
  if (response.ok) return response;
  let body: ApiErrorBody;
  try {
    body = (await response.json()) as ApiErrorBody;
  } catch {
    body = { detail: response.statusText };
  }
  throw new ApiError(response.status, body);
}

export function createDataProvider(apiBaseUrl: string): NavSavvyDataProvider {
  const baseUrl = apiBaseUrl.replace(/\/+$/, "");
  const url = (path: string) => `${baseUrl}${path}`;
  let workflowRequest: Promise<WorkflowSummary[]> | undefined;
  return {
    ...defaultDataProvider,
    async getWorkflows() {
      workflowRequest ??= (async () => {
        const response = await checked(await fetch(url("/workflows")));
        const body = (await response.json()) as WorkflowListResponse;
        return body.workflows;
      })().catch((error: unknown) => {
        workflowRequest = undefined;
        throw error;
      });
      return workflowRequest;
    },
    async getWorkflowSource(name) {
      const response = await fetch(url(`/workflows/${encodeURIComponent(name)}/source`));
      if (response.status === 404) {
        const body = (await response.json()) as ApiErrorBody;
        if (body.error === "yaml_source_unavailable") return null;
        throw new ApiError(response.status, body);
      }
      return (await checked(response)).text();
    },
    async getRuns(name, state, limit = 50) {
      const query = new URLSearchParams({ limit: String(limit) });
      if (state) query.set("state", state);
      const response = await checked(
        await fetch(url(`/workflows/${encodeURIComponent(name)}/runs?${query.toString()}`)),
      );
      const body = (await response.json()) as { runs: RunRecord[] };
      return body.runs;
    },
    async getRun(name, runId) {
      const response = await checked(
        await fetch(url(`/workflows/${encodeURIComponent(name)}/runs/${encodeURIComponent(runId)}`)),
      );
      return (await response.json()) as RunDetail;
    },
    async decideWorkflow(name, runId, decision, onEvent) {
      const response = await checked(await fetch(
        url(`/workflows/${encodeURIComponent(name)}/runs/${encodeURIComponent(runId)}/decisions`),
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(decision),
        },
      ));
      if (response.headers.get("content-type")?.includes("application/json")) {
        const body = (await response.json()) as { status: "already_decided"; decision: DecisionRecord };
        return { kind: "already_decided", decision: body.decision };
      }
      let outcome: RunOutcome = "started";
      let nextRunId: string | undefined;
      await readSse(response, ({ event, data }) => {
        const runtimeEvent = decodeRuntimeEvent(event, data);
        if (runtimeEvent.run_id !== "unknown") nextRunId = runtimeEvent.run_id;
        if (runtimeEvent.type === "final") outcome = "completed";
        if (runtimeEvent.type === "interrupt") outcome = "paused";
        if (runtimeEvent.type === "error") outcome = "failed";
        onEvent?.(runtimeEvent);
      });
      return { kind: "stream", launch: { outcome, runId: nextRunId } };
    },
    async getRunLog(name, runId) {
      const response = await checked(
        await fetch(url(`/workflows/${encodeURIComponent(name)}/runs/${encodeURIComponent(runId)}/log`)),
      );
      const body = (await response.json()) as { entries: RunLogEntry[] };
      return body.entries;
    },
    async startWorkflow(name, input, onEvent) {
      const response = await checked(
        await fetch(url(`/workflows/${encodeURIComponent(name)}/runs`), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        }),
      );
      let outcome: RunOutcome = "started";
      let runId: string | undefined;
      await readSse(response, ({ event, data }) => {
        const runtimeEvent = decodeRuntimeEvent(event, data);
        if (runtimeEvent.run_id !== "unknown") runId = runtimeEvent.run_id;
        if (runtimeEvent.type === "final") outcome = "completed";
        if (runtimeEvent.type === "interrupt") outcome = "paused";
        if (runtimeEvent.type === "error") outcome = "failed";
        onEvent?.(runtimeEvent);
      });
      return { outcome, runId };
    },
  };
}
