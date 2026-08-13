import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";

import type { NavSavvyDataProvider, RunLogEntry, WorkflowSummary } from "./dataProvider";
import { ApiError } from "./dataProvider";
import { BoundedPre } from "./BoundedPre";
import { emptyLiveRun, reduceRun, type LiveRun } from "./runModel";

interface WorkflowConsoleProps {
  dataProvider: NavSavvyDataProvider;
}

type SourceState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "yaml"; text: string }
  | { kind: "unavailable" }
  | { kind: "error"; message: string };

type Notice = { severity: "success" | "info" | "warning"; text: string };

const DEFAULT_INPUT = "{\n  \"text\": \"hello\"\n}";

export function WorkflowConsole({ dataProvider }: WorkflowConsoleProps) {
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [selectedName, setSelectedName] = useState("");
  const [input, setInput] = useState(DEFAULT_INPUT);
  const [source, setSource] = useState<SourceState>({ kind: "idle" });
  const [tab, setTab] = useState<"schema" | "source">("schema");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [liveRun, setLiveRun] = useState<LiveRun>(emptyLiveRun);
  const [runLog, setRunLog] = useState<RunLogEntry[]>([]);
  const [runTab, setRunTab] = useState<"timeline" | "raw">("timeline");
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (liveRun.status !== "idle") statusRef.current?.focus();
  }, [liveRun.status]);

  useEffect(() => {
    let active = true;
    dataProvider
      .getWorkflows()
      .then((items) => {
        if (!active) return;
        setWorkflows(items);
        setSelectedName(items[0]?.name ?? "");
      })
      .catch((reason: unknown) => active && setError(messageOf(reason)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [dataProvider]);

  const selected = useMemo(
    () => workflows.find((workflow) => workflow.name === selectedName),
    [selectedName, workflows],
  );

  useEffect(() => {
    if (!selected) return;
    let active = true;
    dataProvider
      .getWorkflowSource(selected.name)
      .then((text) => {
        if (active) setSource(text === null ? { kind: "unavailable" } : { kind: "yaml", text });
      })
      .catch((reason: unknown) => {
        if (active) setSource({ kind: "error", message: messageOf(reason) });
      });
    return () => {
      active = false;
    };
  }, [dataProvider, selected]);

  let parsedInput: unknown;
  let inputError = "";
  try {
    parsedInput = JSON.parse(input);
  } catch (reason) {
    inputError = messageOf(reason);
  }

  const run = async () => {
    if (!selected || inputError) return;
    setRunning(true);
    setError("");
    setNotice(null);
    setRunLog([]);
    setLiveRun({ ...emptyLiveRun(), status: "running" });
    let latestRunId: string | undefined;
    let logFetched = false;
    try {
      const launch = await dataProvider.startWorkflow(selected.name, parsedInput, (event) => {
        latestRunId = event.run_id === "unknown" ? latestRunId : event.run_id;
        setLiveRun((current) => reduceRun(current, event));
      });
      if (launch.outcome === "failed") {
        setError(`Run of ${selected.name} failed`);
      } else if (launch.outcome === "paused") {
        setNotice({ severity: "warning", text: `Run of ${selected.name} paused` });
      } else if (launch.outcome === "completed") {
        setNotice({ severity: "success", text: `Run of ${selected.name} completed` });
      } else {
        setNotice({ severity: "info", text: `Run of ${selected.name} started` });
        setLiveRun((current) => ({ ...current, status: "disconnected" }));
        if (launch.runId) {
          try {
            const [authoritative, persistedLog] = await Promise.all([
              dataProvider.getRun(selected.name, launch.runId),
              dataProvider.getRunLog(selected.name, launch.runId),
            ]);
            setRunLog(persistedLog);
            logFetched = true;
            setLiveRun((current) => ({
              ...current,
              status: statusFromRecord(authoritative.run.state),
            }));
            setNotice({
              severity: "info",
              text: "The stream ended without a terminal event; state was refreshed from the runtime.",
            });
          } catch {
            // Keep the honest disconnected state; the runtime could not confirm it.
          }
        }
      }
      if (launch.runId && !logFetched) {
        try {
          setRunLog(await dataProvider.getRunLog(selected.name, launch.runId));
        } catch (reason) {
          setError(`Execution log unavailable: ${messageOf(reason)}`);
        }
      }
    } catch (reason) {
      setError(operatorMessage(reason));
      setLiveRun((current) => ({ ...current, status: "disconnected" }));
      if (latestRunId) {
        try {
          const [authoritative, persistedLog] = await Promise.all([
            dataProvider.getRun(selected.name, latestRunId),
            dataProvider.getRunLog(selected.name, latestRunId),
          ]);
          setRunLog(persistedLog);
          setLiveRun((current) => ({
            ...current,
            status: statusFromRecord(authoritative.run.state),
          }));
          setNotice({ severity: "info", text: "The stream ended unexpectedly; state was refreshed from the runtime." });
        } catch {
          // Keep the honest disconnected state and original stream error.
        }
      }
    } finally {
      setRunning(false);
    }
  };

  return (
    <Box component="main" sx={{ maxWidth: 1120, mx: "auto", p: 3 }}>
      <Typography component="h1" variant="h4" gutterBottom>
        Run a workflow
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Trusted operator console · registered workflows only
      </Typography>

      {error && <Alert severity="error" aria-live="assertive" sx={{ mb: 2 }}>{error}</Alert>}
      {notice && <Alert severity={notice.severity} aria-live="polite" sx={{ mb: 2 }}>{notice.text}</Alert>}
      {loading ? (
        <CircularProgress aria-label="Loading workflows" />
      ) : workflows.length === 0 ? (
        <Alert severity="info">No workflows are registered.</Alert>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: { md: "1fr 1fr" }, gap: 3 }}>
          <Card>
            <CardContent>
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel id="workflow-label">Workflow</InputLabel>
                <Select
                  labelId="workflow-label"
                  label="Workflow"
                  value={selectedName}
                  onChange={(event) => {
                    setSource({ kind: "loading" });
                    setSelectedName(event.target.value);
                  }}
                >
                  {workflows.map((workflow) => (
                    <MenuItem key={workflow.name} value={workflow.name}>
                      {workflow.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Input JSON"
                multiline
                minRows={14}
                fullWidth
                value={input}
                onChange={(event) => setInput(event.target.value)}
                error={Boolean(inputError)}
                helperText={inputError || "Validated again by the runtime when submitted."}
                slotProps={{ htmlInput: { "aria-label": "Input JSON" } }}
              />
              <Button
                variant="contained"
                sx={{ mt: 2 }}
                disabled={!selected || Boolean(inputError) || running}
                onClick={() => void run()}
              >
                {running ? "Running…" : "Run"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <Tabs value={tab} onChange={(_event, value: "schema" | "source") => setTab(value)}>
              <Tab label="Input schema" value="schema" />
              <Tab label="Raw YAML" value="source" />
            </Tabs>
            <CardContent>
              {tab === "schema" ? (
                <pre data-testid="workflow-schema">{JSON.stringify(selected?.input_schema, null, 2)}</pre>
              ) : (
                <SourcePanel source={source} />
              )}
            </CardContent>
          </Card>
          {liveRun.status !== "idle" && (
            <Card sx={{ gridColumn: { md: "1 / -1" } }}>
              <CardContent>
                <Typography component="h2" variant="h6">Live execution</Typography>
                <Alert ref={statusRef} tabIndex={-1} aria-live="polite"
                  severity={statusSeverity(liveRun.status)} data-testid="run-status" sx={{ my: 2 }}>
                  {liveRun.status}
                </Alert>
                {liveRun.warnings.map((warning) => <Alert severity="warning" key={warning}>{warning}</Alert>)}
                <Tabs value={runTab} onChange={(_event, value: "timeline" | "raw") => setRunTab(value)}>
                  <Tab label="Timeline" value="timeline" />
                  <Tab label="Raw log" value="raw" />
                </Tabs>
                {runTab === "timeline" ? <LiveRunPanel run={liveRun} log={runLog} /> : (
                  <BoundedPre label="Raw execution log" testId="raw-run-log" value={{ entries: runLog }} />
                )}
              </CardContent>
            </Card>
          )}
        </Box>
      )}
    </Box>
  );
}

function LiveRunPanel({ run, log }: { run: LiveRun; log: RunLogEntry[] }) {
  return (
    <Box sx={{ mt: 2 }}>
      <ol aria-label="Node timeline" data-testid="node-timeline">
        {run.timeline.map((event, index) => (
          <li key={`${event.node}-${event.status}-${index}`}>{event.node}: {event.status}</li>
        ))}
      </ol>
      {run.tokens && <BoundedPre label="Streamed output" value={run.tokens} />}
      {run.tokensTruncated && <Alert severity="warning">Streamed output truncated after 100,000 characters.</Alert>}
      {run.output && <BoundedPre label="Final output" value={run.output} />}
      {run.error && <BoundedPre label="Run error" value={run.error} />}
      {run.interrupt && <BoundedPre label="Interrupt payload" value={run.interrupt} />}
      <Typography variant="body2" color="text.secondary">Persisted log entries: {log.length}</Typography>
    </Box>
  );
}

function statusSeverity(status: LiveRun["status"]): "success" | "info" | "warning" | "error" {
  if (status === "completed") return "success";
  if (status === "failed") return "error";
  if (status === "paused" || status === "disconnected") return "warning";
  return "info";
}

function SourcePanel({ source }: { source: SourceState }) {
  if (source.kind === "loading" || source.kind === "idle") {
    return <CircularProgress aria-label="Loading workflow source" size={24} />;
  }
  if (source.kind === "unavailable") {
    return <Alert severity="info">No YAML source is available for this code-defined workflow.</Alert>;
  }
  if (source.kind === "error") return <Alert severity="error">{source.message}</Alert>;
  if (source.kind === "yaml") return <pre data-testid="workflow-source">{source.text}</pre>;
  return null;
}

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

function operatorMessage(reason: unknown): string {
  if (reason instanceof ApiError && reason.status === 422) {
    return `The runtime rejected the workflow input: ${messageOf(reason)}`;
  }
  if (reason instanceof TypeError) {
    return "The runtime is unavailable. Check that the same-origin proxy and runtime are running.";
  }
  return messageOf(reason);
}

function statusFromRecord(state: string): LiveRun["status"] {
  if (state === "completed") return "completed";
  if (state === "failed" || state === "cancelled") return "failed";
  if (state === "awaiting_decision") return "paused";
  return "disconnected";
}
