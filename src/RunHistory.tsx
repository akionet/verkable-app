import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  TextField,
} from "@mui/material";

import type {
  NavSavvyDataProvider,
  RunDetail,
  RunRecord,
  RunState,
  Verdict,
  WorkflowSummary,
} from "./dataProvider";
import { ApiError } from "./dataProvider";
import { BoundedPre } from "./BoundedPre";
import { RunLogPanel } from "./RunLogPanel";
import { reduceRun, type LiveRun } from "./runModel";

const STATES: RunState[] = ["running", "awaiting_decision", "completed", "failed", "cancelled"];

interface Filters {
  workflow: string;
  state: RunState | "";
  limit: number;
  runId: string;
}

function filtersFromUrl(): Filters {
  const query = new URLSearchParams(window.location.search);
  const state = query.get("state") ?? "";
  return {
    workflow: query.get("workflow") ?? "",
    state: STATES.includes(state as RunState) ? state as RunState : "",
    limit: [10, 25, 50, 100].includes(Number(query.get("limit"))) ? Number(query.get("limit")) : 50,
    runId: query.get("run") ?? "",
  };
}

export function RunHistory({ dataProvider }: { dataProvider: NavSavvyDataProvider }) {
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [filters, setFilters] = useState(filtersFromUrl);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [log, setLog] = useState<Awaited<ReturnType<NavSavvyDataProvider["getRunLog"]>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Every fetch below is guarded: whichever response lands last must not win if
  // the operator has already moved to another workflow, state or run.
  const latestFilters = useRef(filters);
  useEffect(() => {
    latestFilters.current = filters;
  }, [filters]);

  useEffect(() => {
    let active = true;
    dataProvider.getWorkflows().then((items) => {
      if (!active) return;
      setWorkflows(items);
      setFilters((current) => current.workflow ? current : { ...current, workflow: items[0]?.name ?? "" });
      // With nothing selectable the run-list effect never runs, so the spinner
      // has to be cleared here or the view hangs on it forever.
      if (!items.length) setLoading(false);
    }).catch((reason: unknown) => {
      if (!active) return;
      setError(messageOf(reason));
      setLoading(false);
    });
    return () => { active = false; };
  }, [dataProvider]);

  useEffect(() => {
    if (!filters.workflow) return;
    const query = new URLSearchParams(window.location.search);
    query.set("view", "history");
    query.set("workflow", filters.workflow);
    query.set("limit", String(filters.limit));
    if (filters.state) query.set("state", filters.state);
    else query.delete("state");
    if (filters.runId) query.set("run", filters.runId);
    else query.delete("run");
    window.history.replaceState(null, "", `${window.location.pathname}?${query}`);
  }, [filters]);

  useEffect(() => {
    if (!filters.workflow) return;
    let active = true;
    dataProvider.getRuns(filters.workflow, filters.state || undefined, filters.limit)
      .then((next) => { if (active) setRuns(next); })
      .catch((reason: unknown) => { if (active) setError(messageOf(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [dataProvider, filters.workflow, filters.state, filters.limit]);

  useEffect(() => {
    if (!filters.workflow || !filters.runId) return;
    let active = true;
    Promise.all([
      dataProvider.getRun(filters.workflow, filters.runId),
      dataProvider.getRunLog(filters.workflow, filters.runId),
    ]).then(([nextDetail, nextLog]) => {
      if (!active) return;
      setDetail(nextDetail);
      setLog(nextLog);
    }).catch((reason: unknown) => { if (active) setError(messageOf(reason)); });
    return () => { active = false; };
  }, [dataProvider, filters.workflow, filters.runId]);

  const selectedRun = useMemo(() => runs.find((run) => run.id === filters.runId), [runs, filters.runId]);
  const update = (patch: Partial<Filters>) => {
    if (patch.runId === "") {
      setDetail(null);
      setLog([]);
    }
    if ("workflow" in patch || "state" in patch || "limit" in patch) {
      setLoading(true);
      setError("");
    }
    setFilters((current) => ({ ...current, ...patch }));
  };
  const refresh = async () => {
    const { workflow, runId, state, limit } = filters;
    if (!workflow || !runId) return;
    const [nextRuns, nextDetail, nextLog] = await Promise.all([
      dataProvider.getRuns(workflow, state || undefined, limit),
      dataProvider.getRun(workflow, runId),
      dataProvider.getRunLog(workflow, runId),
    ]);
    // The operator may have navigated while the refresh was in flight.
    if (latestFilters.current.workflow !== workflow || latestFilters.current.runId !== runId) return;
    setRuns(nextRuns);
    setDetail(nextDetail);
    setLog(nextLog);
  };

  return (
    <Box>
      <Typography component="h1" variant="h4" gutterBottom>Previous runs</Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        In-memory history survives browser reloads but is lost when the runtime process restarts.
      </Alert>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Card sx={{ mb: 3 }}><CardContent sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        <FormControl sx={{ minWidth: 180 }}>
          <InputLabel id="history-workflow-label">Workflow</InputLabel>
          <Select labelId="history-workflow-label" label="Workflow" value={filters.workflow}
            onChange={(event) => update({ workflow: event.target.value, runId: "" })}>
            {workflows.map((workflow) => <MenuItem key={workflow.name} value={workflow.name}>{workflow.name}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 180 }}>
          <InputLabel id="history-state-label">State</InputLabel>
          <Select labelId="history-state-label" label="State" value={filters.state}
            onChange={(event) => update({ state: event.target.value as RunState | "", runId: "" })}>
            <MenuItem value="">All states</MenuItem>
            {STATES.map((state) => <MenuItem key={state} value={state}>{state}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel id="history-limit-label">Limit</InputLabel>
          <Select labelId="history-limit-label" label="Limit" value={filters.limit}
            onChange={(event) => update({ limit: Number(event.target.value), runId: "" })}>
            {[10, 25, 50, 100].map((limit) => <MenuItem key={limit} value={limit}>{limit}</MenuItem>)}
          </Select>
        </FormControl>
      </CardContent></Card>
      {loading ? <CircularProgress aria-label="Loading previous runs" /> : runs.length === 0 ? (
        <Alert severity="info">No runs match these filters.</Alert>
      ) : (
        <Card sx={{ mb: 3 }}><Table aria-label="Previous runs"><TableHead><TableRow>
          <TableCell>Run</TableCell><TableCell>State</TableCell><TableCell>Updated</TableCell><TableCell>Operator</TableCell>
        </TableRow></TableHead><TableBody>{runs.map((run) => (
          <TableRow key={run.id} hover selected={selectedRun?.id === run.id}
            tabIndex={0} aria-label={`Open run ${run.id}`}
            onClick={() => update({ runId: run.id })}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                update({ runId: run.id });
              }
            }} sx={{ cursor: "pointer" }}>
            <TableCell>{run.id}</TableCell><TableCell>{run.state}</TableCell>
            <TableCell>{new Date(run.updated_at).toLocaleString()}</TableCell><TableCell>{run.created_by.subject}</TableCell>
          </TableRow>
        ))}</TableBody></Table></Card>
      )}
      {detail && <RunDetailPanel detail={detail} log={log} dataProvider={dataProvider} onRefresh={refresh} />}
    </Box>
  );
}

function RunDetailPanel({ detail, log, dataProvider, onRefresh }: {
  detail: RunDetail;
  log: Awaited<ReturnType<NavSavvyDataProvider["getRunLog"]>>;
  dataProvider: NavSavvyDataProvider;
  onRefresh: () => Promise<void>;
}) {
  const [resume, setResume] = useState<LiveRun | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  useEffect(() => { detailRef.current?.focus(); }, [detail.run.state, detail.decisions.length]);
  // Deciding flips the run out of `awaiting_decision`, which unmounts
  // `DecisionPanel`. The outcome of that act has to outlive the panel that
  // triggered it, so it is held here instead.
  const [outcome, setOutcome] = useState<DecisionOutcome | null>(null);
  return <Card><CardContent ref={detailRef} tabIndex={-1} aria-label="Run detail">
    <Typography component="h2" variant="h5">Run {detail.run.id}</Typography>
    <Typography>State: {detail.run.state}</Typography>
    <Typography>Created by: {detail.run.created_by.subject} ({detail.run.created_by.issuer})</Typography>
    <Typography>Gate payload: {detail.run.gate_payload ? "present" : "none"}</Typography>
    {detail.run.gate_payload && <BoundedPre label="Gate payload" value={detail.run.gate_payload} />}
    <Typography component="h3" variant="h6" sx={{ mt: 2 }}>Policy</Typography>
    <BoundedPre label="Run policy" value={detail.run.policy} />
    <Typography component="h3" variant="h6">Decisions</Typography>
    {detail.decisions.length ? <ul>{detail.decisions.map((decision) => <li key={decision.id}>
      {decision.verdict} by {decision.principal.subject}{decision.comment ? ` — ${decision.comment}` : ""}
    </li>)}</ul> : <Typography>No decisions recorded.</Typography>}
    {outcome && (
      <Alert severity={outcome.kind} sx={{ my: 1 }}>{outcome.message}</Alert>
    )}
    {detail.run.state === "awaiting_decision" && (
      <DecisionPanel detail={detail} log={log} dataProvider={dataProvider} onRefresh={onRefresh}
        setResume={setResume} setOutcome={setOutcome} />
    )}
    {resume && <ResumePanel resume={resume} />}
    <Typography component="h3" variant="h6" sx={{ mt: 2 }}>Execution log</Typography>
    <RunLogPanel entries={log} />
  </CardContent></Card>;
}

interface DecisionOutcome {
  kind: "info" | "error" | "success";
  message: string;
}

function DecisionPanel({ detail, log, dataProvider, onRefresh, setResume, setOutcome }: {
  detail: RunDetail;
  log: Awaited<ReturnType<NavSavvyDataProvider["getRunLog"]>>;
  dataProvider: NavSavvyDataProvider;
  onRefresh: () => Promise<void>;
  setResume: React.Dispatch<React.SetStateAction<LiveRun | null>>;
  setOutcome: React.Dispatch<React.SetStateAction<DecisionOutcome | null>>;
}) {
  const [verdict, setVerdict] = useState<Verdict>("approve");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const setNotice = (message: string) => setOutcome({ kind: "success", message });
  const setError = (message: string) => setOutcome(message ? { kind: "error", message } : null);

  const decide = async () => {
    setSubmitting(true);
    setOutcome(null);
    setResume({
      runId: detail.run.id,
      status: "running",
      tokens: "",
      warnings: [],
      timeline: log.flatMap((entry) => entry.step && (entry.status === "started" || entry.status === "completed")
        ? [{ node: entry.step, status: entry.status }] : []),
    });
    try {
      const result = await dataProvider.decideWorkflow(
        detail.run.workflow,
        detail.run.id,
        { verdict, ...(comment ? { comment } : {}) },
        (event) => setResume((current) => reduceRun(current ?? {
          runId: detail.run.id, status: "running", timeline: [], tokens: "", warnings: [],
        }, event)),
      );
      if (result.kind === "already_decided") setNotice("This decision was already recorded; authoritative state refreshed.");
      else if (result.launch.outcome === "completed") setNotice("Decision accepted; the run completed.");
      else if (result.launch.outcome === "paused") setNotice("Decision accepted; the run paused at another gate.");
      else if (result.launch.outcome === "failed") setError("The resumed run failed after the decision was recorded.");
      else {
        setResume((current) => current && ({ ...current, status: "disconnected" }));
        setNotice("Decision accepted; the stream disconnected before a terminal event.");
      }
    } catch (reason) {
      // The decision never landed, so the optimistic resume view is a lie.
      setResume(null);
      if (reason instanceof ApiError && reason.status === 403) {
        setError("A trusted operator identity is required to decide this run.");
      } else if (reason instanceof ApiError && reason.status === 409) {
        const state = typeof reason.body.state === "string" ? ` (${reason.body.state})` : "";
        setError(`This run can no longer be decided${state}.`);
      } else {
        setError(messageOf(reason));
      }
    } finally {
      setSubmitting(false);
    }
    // Refreshed separately: a failed refresh must not be reported as a failed
    // decision, because the decision is already durably recorded.
    try {
      await onRefresh();
    } catch (reason) {
      setError(`The decision was recorded, but refreshing state failed: ${messageOf(reason)}`);
    }
  };

  return <Box sx={{ my: 2 }}>
    <Typography component="h3" variant="h6">Decision</Typography>
    <Box sx={{ display: "flex", gap: 2, alignItems: "start", flexWrap: "wrap" }}>
      <FormControl sx={{ minWidth: 160 }}>
        <InputLabel id="decision-verdict-label">Verdict</InputLabel>
        <Select labelId="decision-verdict-label" label="Verdict" value={verdict} disabled={submitting}
          onChange={(event) => setVerdict(event.target.value as typeof verdict)}>
          {(["approve", "reject", "amend"] as const).map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
        </Select>
      </FormControl>
      <TextField label="Comment" value={comment} disabled={submitting}
        onChange={(event) => setComment(event.target.value)} slotProps={{ htmlInput: { maxLength: 4096 } }} />
      <Button variant="contained" disabled={submitting} onClick={() => void decide()}>
        {submitting ? "Submitting…" : "Submit decision"}
      </Button>
    </Box>
  </Box>;
}

function ResumePanel({ resume }: { resume: LiveRun }) {
  return <Box aria-label="Resumed execution" aria-live="polite" sx={{ mt: 2 }}>
    <Typography>Run {resume.runId}: {resume.status}</Typography>
    <ol>{resume.timeline.map((entry, index) => <li key={`${entry.node}-${entry.status}-${index}`}>
      {entry.node}: {entry.status}
    </li>)}</ol>
    {resume.warnings.map((warning) => <Alert severity="warning" key={warning}>{warning}</Alert>)}
    {resume.tokens && <BoundedPre label="Resumed streamed output" value={resume.tokens} />}
    {resume.output && <BoundedPre label="Resumed final output" value={resume.output} />}
  </Box>;
}

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}
